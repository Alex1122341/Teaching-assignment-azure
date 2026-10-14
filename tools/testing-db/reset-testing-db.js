'use strict';
// Initialise or reset the independent PAWS Testing database with synthetic data.
//
// Safety model (fails closed):
//   * PAWS_ENVIRONMENT must be "testing" and pass the same checks as the Testing runtime
//     (server/src/runtime/environment.js): never a production SQL server, never the production
//     Firebase project, an explicit PAWS_TESTING_ENVIRONMENT_ID.
//   * A database is only touched when it is EMPTY (no user tables and no marker) or when it already
//     carries paws_env.EnvironmentIdentity = ('testing', PAWS_TESTING_ENVIRONMENT_ID).
//   * Nothing is ever read from or copied out of Production.
//
// Steps: marker -> drop all non-marker objects (reset only) -> stand-in principals -> migrations
// 001-002 -> synthetic seed -> remaining migrations (documented test-only adaptations) ->
// Teaching Assignment fixture -> runtime principal role membership -> verification.
//
// Usage (Azure SQL, from CI with the Testing environment's own identity):
//   PAWS_ENVIRONMENT=testing PAWS_TESTING_ENVIRONMENT_ID=<uuid> FIREBASE_PROJECT_ID=<testing project> \
//   PAWS_SQL_CONNECTION_STRING="Server=tcp:<testing-server>.database.windows.net;Database=VetMed-Ops;Encrypt=true" \
//   PAWS_SQL_MI_CLIENT_ID=<uuid> PAWS_TESTING_RUNTIME_PRINCIPAL=<runtime identity name> \
//   node tools/testing-db/reset-testing-db.js --confirm-reset
// Local LocalDB (Windows, developer machine):
//   ... PAWS_SQL_CONNECTION_STRING="Server=(localdb)\\MSSQLLocalDB;Database=VetMed-Ops" \
//   PAWS_TESTING_LOCAL_ODBC="Driver={SQL Server};Server=np:\\\\.\\pipe\\LOCALDB#xxxx\\tsql\\query;Database=VetMed-Ops;Trusted_Connection=Yes;" \
//   node tools/testing-db/reset-testing-db.js --confirm-reset
const fs = require('node:fs');
const path = require('node:path');
const { resolveEnvironment, sqlServerHost } = require('../../server/src/runtime/environment');
const { buildSqlConnectionConfig } = require('../../server/src/data/sql-connection');

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

async function connect(env) {
  const local = env.PAWS_TESTING_LOCAL_ODBC;
  if (local) {
    if (!/\(localdb\)/i.test(env.PAWS_SQL_CONNECTION_STRING || '')) throw new Error('PAWS_TESTING_LOCAL_ODBC is only accepted for a (localdb) server');
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
      (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0 AND SCHEMA_NAME(schema_id) <> N'paws_env') AS userTables,
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

async function ensurePrincipals(pool, runtimePrincipal, azure) {
  for (const name of STAND_IN_PRINCIPALS) {
    await run(pool, `IF USER_ID(N'${name}') IS NULL CREATE USER ${'[' + name + ']'} WITHOUT LOGIN;`);
  }
  const escaped = runtimePrincipal.replace(/]/g, ']]');
  await run(pool, azure
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
  return roles.map(r => r.name);
}

async function applyFile(pool, file, text, vars, log) {
  for (const batch of splitBatches(text, vars)) await run(pool, batch);
  log(`${file}: ok`);
}

async function main(argv, env = process.env, log = message => console.log(message)) {
  const environment = resolveEnvironment(env);
  if (!environment.testing) throw new Error('reset-testing-db only runs with PAWS_ENVIRONMENT=testing');
  if (!argv.includes('--confirm-reset')) throw new Error('Pass --confirm-reset to initialise or reset the Testing database');
  const host = sqlServerHost(env.PAWS_SQL_CONNECTION_STRING);
  const azure = /\.database\.windows\.net$/i.test(host);
  const runtimePrincipal = String(env.PAWS_TESTING_RUNTIME_PRINCIPAL || 'paws_testing_runtime').trim();
  const { pool } = await connect(env);
  try {
    const state = await readState(pool);
    if (state.databaseName !== 'VetMed-Ops') throw new Error(`The Testing database must be named VetMed-Ops (the migrations require it); found ${state.databaseName}`);
    const marker = state.marker;
    if (marker.length) {
      if (marker.length !== 1 || marker[0].environment !== 'testing' || marker[0].environmentId.toLowerCase() !== environment.testingEnvironmentId) {
        throw new Error('This database belongs to a different environment; refusing to touch it');
      }
      log('marker verified: resetting existing Testing database');
      await dropAll(pool);
    } else {
      if (state.userTables > 0) throw new Error('Database is not empty and carries no Testing marker; refusing to touch it');
      log('empty database: initialising new Testing database');
      await createMarker(pool, environment.testingEnvironmentId);
    }
    await ensurePrincipals(pool, runtimePrincipal, azure);
    const files = fs.readdirSync(MIGRATIONS).filter(f => /^\d{3}_.*\.sql$/.test(f) && !/(rollback|_proof|_acceptance)/.test(f)).sort();
    const vars = { PAWS_API_PRINCIPAL: runtimePrincipal };
    const outcome = [];
    for (const file of files) {
      if (SKIP[file]) { outcome.push({ file, status: 'skipped', reason: SKIP[file] }); log(`${file}: skipped (${SKIP[file]})`); }
      else {
        try { await applyFile(pool, file, adapt(file, fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'), runtimePrincipal), { ...vars }, log); outcome.push({ file, status: 'ok' }); }
        catch (error) {
          if (!TOLERATED_FAILURES[file]) throw new Error(`${file} failed: ${error.message}`);
          outcome.push({ file, status: 'tolerated', reason: TOLERATED_FAILURES[file] }); log(`${file}: tolerated (${TOLERATED_FAILURES[file]})`);
        }
      }
      if (file === SEED_AFTER) {
        await run(pool, fs.readFileSync(path.join(__dirname, 'seed-base.sql'), 'utf8'));
        outcome.push({ file: 'seed-base.sql', status: 'ok' }); log('seed-base.sql: ok');
      }
    }
    await run(pool, fs.readFileSync(path.join(__dirname, 'seed-ta.sql'), 'utf8'));
    outcome.push({ file: 'seed-ta.sql', status: 'ok' }); log('seed-ta.sql: ok');
    const roles = await grantRuntimeRoles(pool, runtimePrincipal);
    const [counts] = await run(pool, `SELECT (SELECT COUNT(*) FROM paws.Faculty) AS faculty, (SELECT COUNT(*) FROM paws.Session) AS sessions,
      (SELECT COUNT(*) FROM paws.UserProfile) AS userProfiles, (SELECT COUNT(*) FROM paws.AfcRecord) AS afcRecords,
      (SELECT COUNT(*) FROM paws_env.EnvironmentIdentity WHERE Environment = N'testing') AS marker`);
    const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-manifest.json'), 'utf8'));
    if (counts.marker !== 1 || counts.sessions !== expected.sessions || counts.afcRecords !== expected.afc) {
      throw new Error(`verification failed: ${JSON.stringify(counts)}`);
    }
    const summary = { ok: true, environment: 'testing', database: state.databaseName, server: host, counts, runtimePrincipal, runtimeRoles: roles, migrations: outcome };
    log(JSON.stringify(summary));
    return summary;
  } finally {
    await pool.close();
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(error => { console.error(`TESTING_DB_RESET_FAILED: ${error.message}`); process.exit(1); });
}

module.exports = { main, splitBatches, adapt, SKIP, TOLERATED_FAILURES };
