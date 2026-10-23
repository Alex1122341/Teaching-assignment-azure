'use strict';
// Initialise or reset the independent PAWS Testing database with synthetic data.
//
// Safety model (fails closed):
//   * PAWS_ENVIRONMENT must be "testing" and pass the same checks as the Testing runtime
//     (server/src/runtime/environment.js): never a production SQL server, never the production
//     Firebase project, an explicit PAWS_TESTING_ENVIRONMENT_ID.
//   * A database is only touched when it already carries paws_env.EnvironmentIdentity =
//     ('testing', PAWS_TESTING_ENVIRONMENT_ID) (reset), or when it is provably EMPTY and the operator
//     passes --initialise-empty (first-time setup). "Empty" is only trusted when the connecting
//     principal holds VIEW DEFINITION, so metadata hidden by permissions cannot look empty.
//   * Nothing is ever read from or copied out of Production.
//
// Steps: marker -> drop all non-marker objects (reset only) -> stand-in principals -> migrations
// 001-002 -> synthetic seed -> remaining migrations (documented test-only adaptations) ->
// Teaching Assignment fixture -> runtime principal role membership -> workflow fixtures through the
// real API code (seed-workflows.js) -> verification of counts and fixture-coverage.json.
//
// Usage (Azure SQL, from CI with the Testing environment's own identity):
//   PAWS_ENVIRONMENT=testing PAWS_TESTING_ENVIRONMENT_ID=<uuid> FIREBASE_PROJECT_ID=<testing project> \
//   PAWS_SQL_CONNECTION_STRING="Server=tcp:<testing-server>.database.windows.net;Database=VetMed-Ops;Encrypt=true" \
//   PAWS_SQL_MI_CLIENT_ID=<uuid> PAWS_TESTING_RUNTIME_PRINCIPAL=<runtime identity name> \
//   node tools/testing-db/reset-testing-db.js --confirm-reset            (add --initialise-empty the first time)
// Local LocalDB (Windows, developer machine):
//   ... PAWS_SQL_CONNECTION_STRING="Server=(localdb)\\MSSQLLocalDB;Database=VetMed-Ops" \
//   PAWS_TESTING_LOCAL_ODBC="Driver={SQL Server};Server=np:\\\\.\\pipe\\LOCALDB#xxxx\\tsql\\query;Database=VetMed-Ops;Trusted_Connection=Yes;" \
//   node tools/testing-db/reset-testing-db.js --confirm-reset
const fs = require('node:fs');
const path = require('node:path');
const { resolveEnvironment, sqlServerHost } = require('../../server/src/runtime/environment');
const { resolveSqlTarget } = require('../../server/src/runtime/sql-environment-target');
const { buildSqlConnectionConfig } = require('../../server/src/data/sql-connection');
const { connectTestingProfile } = require('./connection-profile');
const { adaptUniversitySql, sourceHash, assertUniversityInventory } = require('./university-migration-adapter');

const ROOT = path.resolve(__dirname, '../..');
const MIGRATIONS = path.join(ROOT, 'database', 'azure-sql');
const SEED_AFTER = '002_calendar_view.sql';
const STAND_IN_PRINCIPALS = Object.freeze(['paws_swa_beta', 'paws-sql-beta-mi']);

// Test-only adaptations. Production migration files are never modified.
const SKIP = Object.freeze({
  '003_app_permissions.sql': 'invalid T-SQL (EXEC with REPLACE()); superseded by 004/017 grants'
});
const TOLERATED_FAILURES = Object.freeze({
  '007_afc_manual_write_permissions.sql': 'asserts the exact live pre-B1 permission rows of the production principal'
});
function adapt(file, text, principal) {
  if (file === '006_teaching_responsibility_concurrent_assignees.sql') {
    // The CHECK references a column added earlier in the same batch; split the batch.
    return text.replace(/^(IF NOT EXISTS \(\s*)$/m, 'GO\n$1');
  }
  if (file === '015_afc_manual_batch.sql') return text.split("N'UC\\sa-xinyu.zhu1'").join(`N'${principal.replace(/'/g, "''")}'`);
  return text;
}

function splitBatches(text, vars) {
  const batches = []; let current = [];
  for (const line of text.split(/\r?\n/)) {
    const setvar = /^\s*:setvar\s+(\w+)\s+"?([^"]*)"?\s*$/i.exec(line);
    if (setvar) { vars[setvar[1]] = setvar[2]; continue; }
    if (/^\s*:on\s+error/i.test(line)) continue;
    if (/^\s*GO\s*(--.*)?$/i.test(line)) { batches.push(current.join('\n')); current = []; continue; }
    current.push(line);
  }
  batches.push(current.join('\n'));
  return batches.filter(b => b.trim()).map(b => b.replace(/\$\((\w+)\)/g, (m, name) => (name in vars ? vars[name] : m)));
}

// The local ODBC override must itself point at a LocalDB instance (named pipe or (localdb)), not merely
// be paired with a (localdb) PAWS_SQL_CONNECTION_STRING: otherwise it could name any server.
function assertLocalOdbc(env) {
  const local = env.PAWS_TESTING_LOCAL_ODBC;
  if (!local) return null;
  if (!/\(localdb\)/i.test(env.PAWS_SQL_CONNECTION_STRING || '')) throw new Error('PAWS_TESTING_LOCAL_ODBC is only accepted for a (localdb) server');
  const servers = [...String(local).matchAll(/(?:^|;)\s*(?:server|data source|address|addr)\s*=\s*([^;]*)/gi)].map(m => m[1].trim());
  const localDb = value => /^\(localdb\)\\[^;\\]+$/i.test(value) || /^np:\\\\\.\\pipe\\LOCALDB#[^\\;]+\\tsql\\query$/i.test(value);
  if (servers.length !== 1 || !localDb(servers[0])) throw new Error('PAWS_TESTING_LOCAL_ODBC is only accepted for a (localdb) server: its own Server must be a LocalDB instance or named pipe');
  return local;
}

// Decides what the tool may do with the database it connected to. Pure: throws instead of guessing.
function decideAction(state, testingEnvironmentId, { initialiseEmpty = false } = {}) {
  const marker = state.marker || [];
  if (marker.length) {
    if (marker.length !== 1 || marker[0].environment !== 'testing' || String(marker[0].environmentId).toLowerCase() !== testingEnvironmentId) {
      throw new Error('This database belongs to a different environment; refusing to touch it');
    }
    return 'reset';
  }
  if (state.hasMarker) throw new Error('The Testing marker table exists but holds no Testing identity; refusing to touch it');
  if (Number(state.canViewDefinition) !== 1) throw new Error('Cannot prove the database is empty: the connecting principal lacks VIEW DEFINITION; refusing to touch it');
  if (Number(state.userObjects) > 0 || Number(state.userSchemas) > 0) throw new Error('Database is not empty and carries no Testing marker; refusing to touch it');
  if (!initialiseEmpty) throw new Error('Database is empty and has no Testing marker. Pass --initialise-empty to initialise a new Testing database');
  return 'initialise';
}

// The runtime principal must be able to read the marker, or environment.js cannot see it and Testing never serves.
function markerGrantSql(runtimePrincipal) {
  return `GRANT SELECT ON OBJECT::paws_env.EnvironmentIdentity TO [${String(runtimePrincipal).replace(/]/g, ']]')}];`;
}

async function connect(env) {
  const local = assertLocalOdbc(env);
  if (local) {
    const sql = require(path.join(ROOT, 'server', 'node_modules', 'mssql', 'msnodesqlv8'));
    return { sql, pool: await new sql.ConnectionPool({ connectionString: local }).connect() };
  }
  const sql = require(path.join(ROOT, 'server', 'node_modules', 'mssql'));
  const config = buildSqlConnectionConfig({ connectionString: env.PAWS_SQL_CONNECTION_STRING, miClientId: env.PAWS_SQL_MI_CLIENT_ID, driver: 'tedious' });
  return { sql, pool: await new sql.ConnectionPool(config).connect() };
}

async function run(pool, text) {
  const result = await pool.request().batch(text);
  return result.recordset || [];
}

async function readState(pool) {
  const [state] = await run(pool, `SELECT DB_NAME() AS databaseName,
      HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'VIEW DEFINITION') AS canViewDefinition,
      (SELECT COUNT(*) FROM sys.objects WHERE is_ms_shipped = 0 AND SCHEMA_NAME(schema_id) <> N'paws_env') AS userObjects,
      (SELECT COUNT(*) FROM sys.schemas WHERE schema_id BETWEEN 5 AND 16383 AND name <> N'paws_env') AS userSchemas,
      CASE WHEN OBJECT_ID(N'paws_env.EnvironmentIdentity', N'U') IS NULL THEN 0 ELSE 1 END AS hasMarker`);
  let marker = [];
  if (state.hasMarker) marker = await run(pool, 'SELECT Environment AS environment, CONVERT(varchar(36), EnvironmentId) AS environmentId FROM paws_env.EnvironmentIdentity');
  return { ...state, marker };
}

async function createMarker(pool, environmentId) {
  await run(pool, `IF SCHEMA_ID(N'paws_env') IS NULL EXEC(N'CREATE SCHEMA paws_env');
IF OBJECT_ID(N'paws_env.EnvironmentIdentity', N'U') IS NULL
  CREATE TABLE paws_env.EnvironmentIdentity (
    Environment nvarchar(16) NOT NULL CONSTRAINT CK_EnvironmentIdentity_Testing CHECK (Environment = N'testing'),
    EnvironmentId uniqueidentifier NOT NULL CONSTRAINT PK_EnvironmentIdentity PRIMARY KEY,
    CreatedAtUtc datetime2(7) NOT NULL CONSTRAINT DF_EnvironmentIdentity_CreatedAt DEFAULT SYSUTCDATETIME(),
    Note nvarchar(200) NOT NULL CONSTRAINT DF_EnvironmentIdentity_Note DEFAULT N'PAWS Testing database: synthetic data only');
INSERT paws_env.EnvironmentIdentity (Environment, EnvironmentId) VALUES (N'testing', '${environmentId}');`);
}

// Drops every user object except the paws_env marker, in dependency-safe order.
async function dropAll(pool) {
  await run(pool, `
DECLARE @sql nvarchar(max) = N'';
SELECT @sql += N'DROP TRIGGER ' + QUOTENAME(SCHEMA_NAME(o.schema_id)) + N'.' + QUOTENAME(t.name) + N';' FROM sys.triggers t JOIN sys.objects o ON o.object_id = t.parent_id WHERE t.parent_class = 1 AND SCHEMA_NAME(o.schema_id) <> N'paws_env';
SELECT @sql += N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name) + N' DROP CONSTRAINT ' + QUOTENAME(f.name) + N';' FROM sys.foreign_keys f JOIN sys.tables t ON t.object_id = f.parent_object_id WHERE SCHEMA_NAME(t.schema_id) <> N'paws_env';
SELECT @sql += N'DROP ' + CASE o.type WHEN 'V' THEN N'VIEW' WHEN 'P' THEN N'PROCEDURE' WHEN 'FN' THEN N'FUNCTION' WHEN 'IF' THEN N'FUNCTION' WHEN 'TF' THEN N'FUNCTION' END + N' ' + QUOTENAME(SCHEMA_NAME(o.schema_id)) + N'.' + QUOTENAME(o.name) + N';'
  FROM sys.objects o WHERE o.type IN ('V','P','FN','IF','TF') AND o.is_ms_shipped = 0 AND SCHEMA_NAME(o.schema_id) NOT IN (N'paws_env', N'sys');
SELECT @sql += N'DROP TABLE ' + QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name) + N';' FROM sys.tables t WHERE t.is_ms_shipped = 0 AND SCHEMA_NAME(t.schema_id) <> N'paws_env';
SELECT @sql += N'DROP TYPE ' + QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name) + N';' FROM sys.types t WHERE t.is_user_defined = 1 AND SCHEMA_NAME(t.schema_id) <> N'paws_env';
EXEC sys.sp_executesql @sql;
DECLARE @roles nvarchar(max) = N'';
SELECT @roles += N'ALTER ROLE ' + QUOTENAME(r.name) + N' DROP MEMBER ' + QUOTENAME(m.name) + N';' FROM sys.database_role_members rm JOIN sys.database_principals r ON r.principal_id = rm.role_principal_id JOIN sys.database_principals m ON m.principal_id = rm.member_principal_id WHERE r.is_fixed_role = 0 AND r.name <> N'public';
SELECT @roles += N'DROP ROLE ' + QUOTENAME(name) + N';' FROM sys.database_principals WHERE type = 'R' AND is_fixed_role = 0 AND name <> N'public';
EXEC sys.sp_executesql @roles;
DECLARE @schemas nvarchar(max) = N'';
SELECT @schemas += N'DROP SCHEMA ' + QUOTENAME(name) + N';' FROM sys.schemas WHERE name IN (N'paws', N'paws_api', N'staging');
EXEC sys.sp_executesql @schemas;`);
}

async function assertWindowsPrincipal(pool, runtimePrincipal) {
    // Provisioning must map the actual Windows login before reset. Never
    // silently substitute a WITHOUT LOGIN user for the runtime identity.
    const rows = await run(pool, `SELECT name FROM sys.database_principals WHERE name=N'${runtimePrincipal.replace(/'/g, "''")}' AND type IN ('U','G');`);
    if (rows.length !== 1) throw new Error('University Testing runtime principal must be an existing mapped Windows identity');
}

async function ensurePrincipals(pool, runtimePrincipal, azure, university = false) {
  for (const name of STAND_IN_PRINCIPALS) {
    await run(pool, `IF USER_ID(N'${name}') IS NULL CREATE USER ${'[' + name + ']'} WITHOUT LOGIN;`);
  }
  const escaped = runtimePrincipal.replace(/]/g, ']]');
  if (!university) await run(pool, azure
    ? `IF USER_ID(N'${runtimePrincipal.replace(/'/g, "''")}') IS NULL CREATE USER [${escaped}] FROM EXTERNAL PROVIDER;`
    : `IF USER_ID(N'${runtimePrincipal.replace(/'/g, "''")}') IS NULL CREATE USER [${escaped}] WITHOUT LOGIN;`);
  // Match the hardened production database: public holds only CONNECT at database scope.
  await run(pool, `IF EXISTS (SELECT 1 FROM sys.database_permissions WHERE grantee_principal_id = 0 AND class = 0 AND permission_name = N'VIEW ANY COLUMN MASTER KEY DEFINITION') REVOKE VIEW ANY COLUMN MASTER KEY DEFINITION FROM public;
IF EXISTS (SELECT 1 FROM sys.database_permissions WHERE grantee_principal_id = 0 AND class = 0 AND permission_name = N'VIEW ANY COLUMN ENCRYPTION KEY DEFINITION') REVOKE VIEW ANY COLUMN ENCRYPTION KEY DEFINITION FROM public;`);
}

async function grantRuntimeRoles(pool, runtimePrincipal) {
  // The runtime identity joins only the PAWS roles the migrations define (least privilege, never db_owner).
  const roles = await run(pool, `SELECT name FROM sys.database_principals WHERE type = 'R' AND is_fixed_role = 0 AND name LIKE N'paws%' ORDER BY name`);
  for (const { name } of roles) {
    await run(pool, `IF NOT EXISTS (SELECT 1 FROM sys.database_role_members rm JOIN sys.database_principals r ON r.principal_id = rm.role_principal_id JOIN sys.database_principals m ON m.principal_id = rm.member_principal_id WHERE r.name = N'${name}' AND m.name = N'${runtimePrincipal.replace(/'/g, "''")}') ALTER ROLE [${name.replace(/]/g, ']]')}] ADD MEMBER [${runtimePrincipal.replace(/]/g, ']]')}];`);
  }
  await run(pool, markerGrantSql(runtimePrincipal));
  return roles.map(r => r.name);
}

async function applyFile(pool, file, text, vars, log) {
  for (const batch of splitBatches(text, vars)) await run(pool, batch);
  log(`${file}: ok`);
}

// Runs seed-workflows.js against this Testing database through the normal runtime (environment guard
// included). LocalDB goes through the same ODBC override as the reset itself.
async function runWorkflowFixtures(env, log) {
  const { seedWorkflows, fixtureAdmin, fixtureEnv } = require('./seed-workflows');
  const { createSwaSqlRuntime } = require(path.join(ROOT, 'server', 'src', 'runtime', 'swa-sql-runtime'));
  const local = assertLocalOdbc(env);
  let runtimeEnv = fixtureEnv(env), sqlModule;
  if (local) {
    const base = require(path.join(ROOT, 'server', 'node_modules', 'mssql', 'msnodesqlv8'));
    class LocalPool extends base.ConnectionPool { constructor(config) { super({ ...config, connectionString: local, options: { ...(config.options || {}), encrypt: false } }); } }
    sqlModule = Object.assign(Object.create(base), { ConnectionPool: LocalPool });
    runtimeEnv = { ...runtimeEnv, PAWS_SQL_DRIVER: 'msnodesqlv8', PAWS_SQL_MI_CLIENT_ID: undefined, PAWS_SQL_CONNECTION_STRING: `${env.PAWS_SQL_CONNECTION_STRING};Encrypt=true` };
  } else if (env.PAWS_TESTING_SQL_PROFILE === 'university-testing') {
    sqlModule = require(path.join(ROOT, 'server', 'node_modules', 'mssql', 'msnodesqlv8'));
    runtimeEnv = { ...runtimeEnv, PAWS_SQL_DRIVER: 'msnodesqlv8' };
  } else {
    sqlModule = require(path.join(ROOT, 'server', 'node_modules', 'mssql'));
    runtimeEnv = { ...runtimeEnv, PAWS_SQL_DRIVER: 'tedious' };
  }
  const runtime = createSwaSqlRuntime({ env: runtimeEnv, admin: fixtureAdmin(env.FIREBASE_PROJECT_ID), sql: sqlModule });
  try {
    await runtime.assertEnvironment();
    return await seedWorkflows({ handler: runtime, log });
  } finally {
    await runtime.close();
  }
}

async function verifyFixtureCoverage(pool, coverage = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture-coverage.json'), 'utf8'))) {
  const results = [];
  for (const item of coverage.workflows) {
    if (item.status !== 'seeded') { results.push({ id: item.id, status: item.status }); continue; }
    const [row] = await run(pool, item.query);
    const n = Number(row && row.n);
    results.push({ id: item.id, status: n >= item.min ? 'ok' : 'missing', n, min: item.min });
  }
  const missing = results.filter(result => result.status === 'missing');
  if (missing.length) throw new Error(`fixture coverage incomplete: ${missing.map(m => `${m.id} ${m.n}/${m.min}`).join(', ')}`);
  return results;
}

async function main(argv, env = process.env, log = message => console.log(message), dependencies = {}) {
  const environment = resolveEnvironment(env);
  if (!environment.testing) throw new Error('reset-testing-db only runs with PAWS_ENVIRONMENT=testing');
  if (!argv.includes('--confirm-reset')) throw new Error('Pass --confirm-reset to initialise or reset the Testing database');
  assertLocalOdbc(env);
  const host = sqlServerHost(env.PAWS_SQL_CONNECTION_STRING);
  const azure = /\.database\.windows\.net$/i.test(host);
  const runtimePrincipal = String(env.PAWS_TESTING_RUNTIME_PRINCIPAL || 'paws_testing_runtime').trim();
  const university = env.PAWS_TESTING_SQL_PROFILE === 'university-testing';
  const target = university ? resolveSqlTarget(env) : null;
  if (!runtimePrincipal || /[\x00-\x1f]/.test(runtimePrincipal) || runtimePrincipal.length>128 || (university && !/^[A-Za-z0-9_.@\\ -]+$/.test(runtimePrincipal))) throw new Error('Invalid Testing runtime principal');
  const files = fs.readdirSync(MIGRATIONS).filter(f => /^\d{3}_.*\.sql$/.test(f) && !/(rollback|_proof|_acceptance)/.test(f)).sort();
  if (university) assertUniversityInventory([...files,'seed-base.sql','seed-ta.sql','seed-readers.sql']);
  const sources = new Map(), receipts = [];
  // Validate the complete inventory BEFORE connecting or dropping any object.
  for (const file of [...files,'seed-base.sql','seed-ta.sql','seed-readers.sql']) {
    const original = fs.readFileSync(path.join(file.startsWith('seed-') ? __dirname : MIGRATIONS,file),'utf8');
    const converted = university ? adaptUniversitySql({file,text:original,sourceSha256:sourceHash(original),target}) : {text:original};
    const text = adapt(file,converted.text,runtimePrincipal);
    sources.set(file,text);
    if (university) receipts.push({file,normalization:'utf8-lf',sourceSha256:converted.sourceSha256,
      transformedSha256:converted.transformedSha256,effectiveSha256:sourceHash(text),guardCount:converted.guardCount});
  }
  const connection = university ? dependencies.connection || await connectTestingProfile(env, dependencies) : await connect(env);
  const { pool } = connection;
  try {
    const state = university ? await connection.inspectState() : await readState(pool);
    if(university&&(!connection.target||Object.keys(target).some(key=>connection.target[key]!==target[key])))throw new Error('Testing administration connection target mismatch');
    const expectedDatabase = university ? connection.target.database : 'VetMed-Ops';
    if (state.databaseName !== expectedDatabase) throw new Error('The Testing database does not match the resolved target');
    const action = decideAction(state, environment.testingEnvironmentId, { initialiseEmpty: argv.includes('--initialise-empty') });
    if(university&&(typeof dependencies.beforeDestructive!=='function'||await dependencies.beforeDestructive({target,action,state})!==true))throw new Error('University Testing requires verified backup/stopped-host administration orchestration');
    if (university && action==='reset') await assertWindowsPrincipal(pool,runtimePrincipal);
    if (action === 'reset') {
      log('marker verified: resetting existing Testing database');
      await dropAll(pool);
    } else {
      log('empty database: initialising new Testing database');
      if (university) await connection.initializeMarker();
      else await createMarker(pool, environment.testingEnvironmentId);
      if (university) await assertWindowsPrincipal(pool,runtimePrincipal);
    }
    await ensurePrincipals(pool, runtimePrincipal, azure, university);
    const vars = { PAWS_API_PRINCIPAL: runtimePrincipal };
    const outcome = [];
    for (const file of files) {
      if (SKIP[file]) { outcome.push({ file, status: 'skipped', reason: SKIP[file] }); log(`${file}: skipped (${SKIP[file]})`); }
      else {
        try { await applyFile(pool, file, sources.get(file), { ...vars }, log); outcome.push({ file, status: 'ok' }); }
        catch (error) {
          if (!TOLERATED_FAILURES[file]) throw new Error(`${file} failed: ${error.message}`);
          outcome.push({ file, status: 'tolerated', reason: TOLERATED_FAILURES[file] }); log(`${file}: tolerated (${TOLERATED_FAILURES[file]})`);
        }
      }
      if (file === SEED_AFTER) {
        await run(pool, sources.get('seed-base.sql'));
        outcome.push({ file: 'seed-base.sql', status: 'ok' }); log('seed-base.sql: ok');
      }
    }
    await run(pool, sources.get('seed-ta.sql'));
    outcome.push({ file: 'seed-ta.sql', status: 'ok' }); log('seed-ta.sql: ok');
    await run(pool, sources.get('seed-readers.sql'));
    outcome.push({ file: 'seed-readers.sql', status: 'ok' }); log('seed-readers.sql: ok');
    const roles = await grantRuntimeRoles(pool, runtimePrincipal);
    // Workflow fixtures go through the real API code (see seed-workflows.js), then every seeded
    // workflow in fixture-coverage.json is verified, so a reset always restores the same baseline.
    const workflowFixtures = await runWorkflowFixtures(env, log);
    outcome.push({ file: 'seed-workflows.js', status: 'ok' });
    const fixtureCoverage = await verifyFixtureCoverage(pool);
    const [counts] = await run(pool, `SELECT (SELECT COUNT(*) FROM paws.Faculty) AS faculty, (SELECT COUNT(*) FROM paws.Session) AS sessions,
      (SELECT COUNT(*) FROM paws.UserProfile) AS userProfiles, (SELECT COUNT(*) FROM paws.AfcRecord) AS afcRecords,
      (SELECT COUNT(*) FROM paws_env.EnvironmentIdentity WHERE Environment = N'testing') AS marker`);
    const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-manifest.json'), 'utf8'));
    if (counts.marker !== 1 || counts.sessions !== expected.sessions || counts.afcRecords !== expected.afc || counts.faculty !== expected.faculty + 2) {
      throw new Error(`verification failed: ${JSON.stringify(counts)}`);
    }
    const summary = { ok: true, environment: 'testing', database: state.databaseName, server: host, counts, runtimePrincipal, runtimeRoles: roles, migrations: outcome, migrationReceipts:receipts, workflowFixtures, fixtureCoverage };
    log(JSON.stringify(summary));
    return summary;
  } finally {
    if(!university||!dependencies.connection)await pool.close();
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(error => { console.error(`TESTING_DB_RESET_FAILED: ${error.message}`); process.exit(1); });
}

module.exports = { main, splitBatches, adapt, assertLocalOdbc, decideAction, markerGrantSql, verifyFixtureCoverage, SKIP, TOLERATED_FAILURES };
