'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const { main, splitBatches, adapt, assertLocalOdbc, decideAction, markerGrantSql, SKIP, TOLERATED_FAILURES } = require('../tools/testing-db/reset-testing-db');

const TESTING = {
  PAWS_ENVIRONMENT: 'testing', PAWS_TESTING_ENVIRONMENT_ID: '3f0c9a52-7d1e-4b6a-9c2f-0a1b2c3d4e5f', FIREBASE_PROJECT_ID: 'paws-testing',
  PAWS_SQL_CONNECTION_STRING: 'Server=tcp:paws-testing-sql.database.windows.net;Database=VetMed-Ops;Encrypt=true',
  PAWS_TESTING_SQL_SERVER: 'paws-testing-sql.database.windows.net'
};

test('reset refuses anything but an explicitly configured Testing environment, before connecting', async () => {
  await assert.rejects(main(['--confirm-reset'], { ...TESTING, PAWS_ENVIRONMENT: 'production', PAWS_TESTING_ENVIRONMENT_ID: undefined, PAWS_TESTING_SQL_SERVER: undefined }), /only runs with PAWS_ENVIRONMENT=testing/);
  await assert.rejects(main(['--confirm-reset'], { ...TESTING, PAWS_ENVIRONMENT: undefined }), /PAWS_ENVIRONMENT/);
  await assert.rejects(main(['--confirm-reset'], { ...TESTING, PAWS_SQL_CONNECTION_STRING: 'Server=ITAPPVETOPSDB01;Database=VetMed-Ops' }), /production SQL server/);
  await assert.rejects(main(['--confirm-reset'], { ...TESTING, FIREBASE_PROJECT_ID: 'tester-teaching' }), /production Firebase/);
  await assert.rejects(main([], TESTING), /--confirm-reset/);
  await assert.rejects(main(['--confirm-reset'], { ...TESTING, PAWS_ENVIRONMENT: 'production', PAWS_TESTING_ENVIRONMENT_ID: undefined }), /not valid in production/);
  await assert.rejects(main(['--confirm-reset'], { ...TESTING, PAWS_TESTING_SQL_SERVER: 'other-sql.database.windows.net' }), /does not match PAWS_TESTING_SQL_SERVER/);
  await assert.rejects(main(['--confirm-reset'], { ...TESTING, PAWS_TESTING_LOCAL_ODBC: 'Driver={SQL Server};Server=x' }), /only accepted for a \(localdb\)/);
});

test('sqlcmd batch handling: GO, :setvar, :on error and $(VAR)', () => {
  const vars = { PAWS_API_PRINCIPAL: 'runtime' };
  const batches = splitBatches(':setvar OTHER "x"\n:ON ERROR EXIT\nSELECT N\'$(PAWS_API_PRINCIPAL)\';\nGO\nSELECT N\'$(OTHER)\', N\'$(UNKNOWN)\'\ngo -- trailing\n', vars);
  assert.deepEqual(batches, ["SELECT N'runtime';", "SELECT N'x', N'$(UNKNOWN)'"]);
});

test('test-only migration adaptations are explicit and leave production migration files untouched', () => {
  assert.deepEqual(Object.keys(SKIP), ['003_app_permissions.sql']);
  assert.deepEqual(Object.keys(TOLERATED_FAILURES), ['007_afc_manual_write_permissions.sql']);
  const m006 = fs.readFileSync(path.join(root, 'database/azure-sql/006_teaching_responsibility_concurrent_assignees.sql'), 'utf8');
  assert.match(adapt('006_teaching_responsibility_concurrent_assignees.sql', m006, 'r'), /\nGO\nIF NOT EXISTS \(/);
  const m015 = fs.readFileSync(path.join(root, 'database/azure-sql/015_afc_manual_batch.sql'), 'utf8');
  const adapted = adapt('015_afc_manual_batch.sql', m015, 'paws_testing_runtime');
  assert.ok(!adapted.includes("N'UC\\sa-xinyu.zhu1'"), 'hard-coded principal comparison replaced');
  assert.ok(m015.includes("UC\\sa-xinyu.zhu1"), 'source migration unchanged');
});

test('synthetic seed is deterministic, matches its manifest, and contains no real identities', () => {
  const seed = fs.readFileSync(path.join(root, 'tools/testing-db/seed-base.sql'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tools/testing-db/seed-manifest.json'), 'utf8'));
  assert.equal((seed.match(/INSERT INTO paws\.Session \(/g) || []).length, manifest.sessions);
  assert.equal((seed.match(/INSERT INTO paws\.AfcRecord \(/g) || []).length, manifest.afc);
  const emails = [...seed.matchAll(/N'([^' ]+@[^' ]+)'/g)].map(m => m[1]);
  assert.ok(emails.length > 0 && emails.every(email => email.endsWith('@example.test')), 'only reserved example.test addresses');
  assert.ok(!/ucalgary\.ca/i.test(seed));
  const ucids = [...seed.matchAll(/N'(SYN\d+)'/g)];
  assert.ok(ucids.length >= 30);
  const python = process.platform === 'win32' ? 'python' : 'python3';
  try {
    const regenerated = path.join(require('node:os').tmpdir(), `paws-seed-${process.pid}`);
    fs.mkdirSync(regenerated, { recursive: true });
    fs.copyFileSync(path.join(root, 'tools/testing-db/generate_synthetic_seed.py'), path.join(regenerated, 'generate_synthetic_seed.py'));
    execFileSync(python, [path.join(regenerated, 'generate_synthetic_seed.py')], { stdio: 'pipe' });
    assert.equal(fs.readFileSync(path.join(regenerated, 'seed-base.sql'), 'utf8'), seed, 'committed seed equals regenerated seed');
  } catch (error) {
    if (error.code === 'ENOENT') return; // python unavailable: determinism is covered in CI
    throw error;
  }
});

const TID = TESTING.PAWS_TESTING_ENVIRONMENT_ID;
const EMPTY = { databaseName: 'VetMed-Ops', canViewDefinition: 1, userObjects: 0, userSchemas: 0, hasMarker: 0, marker: [] };

test('reset decision: only a database with this Testing marker is reset', () => {
  assert.equal(decideAction({ ...EMPTY, hasMarker: 1, marker: [{ environment: 'testing', environmentId: TID.toUpperCase() }] }, TID), 'reset');
  assert.throws(() => decideAction({ ...EMPTY, hasMarker: 1, marker: [{ environment: 'testing', environmentId: '00000000-0000-4000-8000-000000000000' }] }, TID), /different environment/);
  assert.throws(() => decideAction({ ...EMPTY, hasMarker: 1, marker: [{ environment: 'testing', environmentId: TID }, { environment: 'testing', environmentId: TID }] }, TID), /different environment/);
  assert.throws(() => decideAction({ ...EMPTY, hasMarker: 1, marker: [] }, TID), /holds no Testing identity/);
});

test('reset decision: a database without a marker is initialised only when provably empty and explicitly requested', () => {
  assert.equal(decideAction(EMPTY, TID, { initialiseEmpty: true }), 'initialise');
  assert.throws(() => decideAction(EMPTY, TID), /--initialise-empty/);
  assert.throws(() => decideAction({ ...EMPTY, userObjects: 1 }, TID, { initialiseEmpty: true }), /not empty/);
  assert.throws(() => decideAction({ ...EMPTY, userSchemas: 1 }, TID, { initialiseEmpty: true }), /not empty/);
  // Hidden metadata must never look empty (e.g. Production seen through a low-privilege principal).
  assert.throws(() => decideAction({ ...EMPTY, canViewDefinition: 0 }, TID, { initialiseEmpty: true }), /VIEW DEFINITION/);
  assert.throws(() => decideAction({ ...EMPTY, canViewDefinition: null }, TID, { initialiseEmpty: true }), /VIEW DEFINITION/);
});

test('local ODBC override must itself name a LocalDB instance', () => {
  const localConn = 'Server=(localdb)\\MSSQLLocalDB;Database=VetMed-Ops';
  assert.equal(assertLocalOdbc({}), null);
  assert.ok(assertLocalOdbc({ PAWS_SQL_CONNECTION_STRING: localConn, PAWS_TESTING_LOCAL_ODBC: 'Driver={SQL Server};Server=np:\\\\.\\pipe\\LOCALDB#ABC123\\tsql\\query;Database=VetMed-Ops;Trusted_Connection=Yes;' }));
  assert.ok(assertLocalOdbc({ PAWS_SQL_CONNECTION_STRING: localConn, PAWS_TESTING_LOCAL_ODBC: 'Driver={ODBC Driver 18 for SQL Server};Server=(localdb)\\MSSQLLocalDB;Database=VetMed-Ops;' }));
  for (const odbc of [
    'Driver={SQL Server};Server=ITAPPVETOPSDB01;Database=VetMed-Ops;Trusted_Connection=Yes;',
    'Driver={SQL Server};Server=tcp:prod.database.windows.net;Database=VetMed-Ops;',
    'Driver={SQL Server};Server=(localdb)\\MSSQLLocalDB;Server=ITAPPVETOPSDB01;Database=VetMed-Ops;',
    'Driver={SQL Server};Database=VetMed-Ops;'
  ]) assert.throws(() => assertLocalOdbc({ PAWS_SQL_CONNECTION_STRING: localConn, PAWS_TESTING_LOCAL_ODBC: odbc }), /LocalDB/, odbc);
});

test('the runtime principal is granted read access to the Testing marker, and nothing else on it', () => {
  assert.equal(markerGrantSql('paws_testing_runtime'), 'GRANT SELECT ON OBJECT::paws_env.EnvironmentIdentity TO [paws_testing_runtime];');
  assert.equal(markerGrantSql('odd]name'), 'GRANT SELECT ON OBJECT::paws_env.EnvironmentIdentity TO [odd]]name];');
  const source = fs.readFileSync(path.join(root, 'tools/testing-db/reset-testing-db.js'), 'utf8');
  assert.match(source, /await run\(pool, markerGrantSql\(runtimePrincipal\)\)/);
  assert.doesNotMatch(source, /GRANT (INSERT|UPDATE|DELETE|CONTROL|ALTER)[^;]*EnvironmentIdentity/);
});

test('reset workflow initialises an empty database only when the operator asks for it', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/paws-testing-db-reset.yml'), 'utf8');
  assert.match(workflow, /initialise_empty:[\s\S]*default: false/);
  assert.match(workflow, /--confirm-reset --initialise-empty/);
});

test('local acceptance never drops a LocalDB database it did not create', () => {
  const source = fs.readFileSync(path.join(root, 'tools/testing-db/local-acceptance.js'), 'utf8');
  assert.match(source, /did not create; refusing to drop it/);
  assert.match(source, /paws_acceptance\.StandIn/);
});

test('operator-class test personas never get a shared-password sign-in', () => {
  const { accountPlan, SEED_PERSONAS, OPERATOR_PERSONAS } = require('../tools/testing-db/provision-test-accounts');
  const plan = accountPlan([...SEED_PERSONAS, 'syn-unknown']);
  assert.deepEqual(plan.disabled.sort(), ['syn-adfa-general', 'syn-admin', 'syn-developer', 'syn-owner']);
  assert.deepEqual(plan.disabled.sort(), [...OPERATOR_PERSONAS].sort());
  for (const uid of ['syn-hicc', 'syn-visc', 'syn-faculty-a', 'syn-faculty-b', 'syn-faculty-reportee', 'syn-adc', 'syn-lab']) assert.ok(plan.signIn.includes(uid), uid);
  for (const uid of OPERATOR_PERSONAS) assert.ok(!plan.signIn.includes(uid), uid);
  assert.ok(!plan.signIn.includes('syn-unknown') && !plan.disabled.includes('syn-unknown'));
});

// ------------------------------------------------------------------ fixture coverage (PR #125 I11)
test('fixture coverage: every seeded workflow has a bounded verification query; every UAT-created one says how to create it', () => {
  const coverage = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'testing-db', 'fixture-coverage.json'), 'utf8'));
  const ids = new Set();
  for (const item of coverage.workflows) {
    assert.ok(!ids.has(item.id), `duplicate ${item.id}`); ids.add(item.id);
    assert.ok(['seeded', 'uat-created'].includes(item.status), item.id);
    assert.match(item.workflow, /\w/); assert.match(item.fixture, /\w/);
    if (item.status === 'seeded') {
      assert.ok(Number.isInteger(item.min) && item.min >= 1, item.id);
      assert.match(item.query, /^SELECT COUNT\((DISTINCT \w+|\*)\) AS n FROM /, item.id);
      assert.doesNotMatch(item.query, /;|\b(INSERT|UPDATE|DELETE|DROP|ALTER|EXEC|MERGE|GRANT)\b/i, `${item.id} is read-only`);
    } else assert.match(item.fixture, /^(UAT|Not pre-seeded)/, item.id);
  }
  const workflows = fs.readFileSync(path.join(__dirname, '..', 'tools', 'testing-db', 'seed-workflows.js'), 'utf8');
  for (const state of ['pending_report_to', 'pending_admin', 'approved', 'rejected', 'withdrawn']) assert.ok(workflows.includes(`afc.${state}`), state);
  for (const area of ['afc', 'swap', 'ta', 'timetable', 'roles', 'faculty']) assert.ok([...ids].some(id => id.startsWith(area + '.')), area);
});

test('verifyFixtureCoverage fails the reset when a seeded workflow is missing and skips UAT-created ones', async () => {
  const { verifyFixtureCoverage } = require('../tools/testing-db/reset-testing-db');
  const pool = counts => ({ request: () => ({ batch: async text => ({ recordset: [{ n: counts[text] ?? 0 }] }) }) });
  const coverage = { workflows: [{ id: 'a', status: 'seeded', min: 2, query: 'QA' }, { id: 'b', status: 'uat-created' }] };
  assert.deepEqual((await verifyFixtureCoverage(pool({ QA: 3 }), coverage)).map(r => r.status), ['ok', 'uat-created']);
  await assert.rejects(verifyFixtureCoverage(pool({ QA: 1 }), coverage), /fixture coverage incomplete: a 1\/2/);
});

test('workflow fixtures run only through the guarded runtime and accept only synthetic fixture identities', async () => {
  const { fixtureAdmin, fixtureEnv, SYNTHETIC_UIDS } = require('../tools/testing-db/seed-workflows');
  const verifier = fixtureAdmin('paws-testing').auth();
  assert.equal((await verifier.verifyIdToken('syn-fixture:syn-hicc')).uid, 'syn-hicc');
  for (const token of ['syn-fixture:real-user', 'syn-fixture:syn-developer', 'syn-fixture:syn-owner', 'syn-token:syn-admin', 'eyJhbGciOi']) await assert.rejects(verifier.verifyIdToken(token), /invalid fixture token/, token);
  assert.ok(!SYNTHETIC_UIDS.some(uid => ['syn-developer', 'syn-owner', 'syn-adfa-general'].includes(uid)), 'no operator-class fixture identity');
  const env = fixtureEnv({ PAWS_ENVIRONMENT: 'testing' });
  assert.equal(env.PAWS_ENVIRONMENT, 'testing');
  assert.equal(env.PAWS_TA_DRAFT_WRITE_ENABLED, 'true');
  const source = fs.readFileSync(path.join(__dirname, '..', 'tools', 'testing-db', 'reset-testing-db.js'), 'utf8');
  assert.match(source, /await runtime\.assertEnvironment\(\);\s*return await seedWorkflows/);
  const seed = fs.readFileSync(path.join(__dirname, '..', 'tools', 'testing-db', 'seed-base.sql'), 'utf8');
  assert.ok(!/@(?!example\.test)[a-z0-9.-]+\.[a-z]{2,}/i.test(seed.replace(/N'[^']*@example\.test'/g, '')), 'only @example.test addresses');
});
