'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const { main, splitBatches, adapt, SKIP, TOLERATED_FAILURES } = require('../tools/testing-db/reset-testing-db');

const TESTING = {
  PAWS_ENVIRONMENT: 'testing', PAWS_TESTING_ENVIRONMENT_ID: '3f0c9a52-7d1e-4b6a-9c2f-0a1b2c3d4e5f', FIREBASE_PROJECT_ID: 'paws-testing',
  PAWS_SQL_CONNECTION_STRING: 'Server=tcp:paws-testing-sql.database.windows.net;Database=VetMed-Ops;Encrypt=true'
};

test('reset refuses anything but an explicitly configured Testing environment, before connecting', async () => {
  await assert.rejects(main(['--confirm-reset'], { ...TESTING, PAWS_ENVIRONMENT: 'production', PAWS_TESTING_ENVIRONMENT_ID: undefined }), /only runs with PAWS_ENVIRONMENT=testing/);
  await assert.rejects(main(['--confirm-reset'], { ...TESTING, PAWS_ENVIRONMENT: undefined }), /PAWS_ENVIRONMENT/);
  await assert.rejects(main(['--confirm-reset'], { ...TESTING, PAWS_SQL_CONNECTION_STRING: 'Server=ITAPPVETOPSDB01;Database=VetMed-Ops' }), /production SQL server/);
  await assert.rejects(main(['--confirm-reset'], { ...TESTING, FIREBASE_PROJECT_ID: 'tester-teaching' }), /production Firebase/);
  await assert.rejects(main([], TESTING), /--confirm-reset/);
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
