'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const resolve = file => path.join(root, file);

test('Testing environment scripts and configuration live under the dedicated folder', () => {
  for (const file of [
    'tools/testing/config/environment.json', 'tools/testing/config/testing.template.json',
    'tools/testing/config/firestore-calendar-index.json', 'tools/testing/config/write-gate-matrix.json',
    'tools/testing/db/reset-testing-db.js', 'tools/testing/db/seed-base.sql',
    'tools/testing/host/host-cli.js', 'tools/testing/host/Prepare-UniversityTestingHost.ps1',
    'tools/testing/build-testing-release.js', 'tools/testing/publish-testing-hosting.js',
    'tools/testing/testing-preflight.js', 'tools/testing/testing-runtime-attestation.js',
    'tools/testing/verify-testing-api-env.js', 'tools/testing/firestore-read-runtime.js'
  ]) assert.ok(fs.existsSync(resolve(file)), file);
  assert.equal(fs.existsSync(resolve('config/environments/testing.json')), false);
  assert.equal(fs.existsSync(resolve('config/environments/testing.template.json')), false);
  assert.equal(fs.existsSync(resolve('deploy/testing')), false);
  const { configPath } = require('../tools/render-environment-config');
  assert.equal(configPath('testing'), resolve('tools/testing/config/environment.json'));
  assert.equal(configPath('production'), resolve('config/environments/production.json'));
});

test('legacy directories contain only short compatibility entry points', () => {
  for (const dir of ['tools/testing-db', 'tools/testing-host']) {
    for (const name of fs.readdirSync(resolve(dir))) {
      const content = fs.readFileSync(resolve(`${dir}/${name}`), 'utf8');
      assert.match(content, /Compatibility entry point/);
      assert.ok(content.split(/\r?\n/).length <= 15, `${dir}/${name} contains implementation`);
    }
  }
});

test('legacy JavaScript entry points resolve to the centralized implementation', () => {
  for (const [oldPath, newPath] of [
    ['../tools/testing-db/university-admin', '../tools/testing/db/university-admin'],
    ['../tools/testing-host/host-policy', '../tools/testing/host/host-policy'],
    ['../tools/testing-runtime-attestation', '../tools/testing/testing-runtime-attestation'],
    ['../tools/verify-testing-api-env', '../tools/testing/verify-testing-api-env']
  ]) assert.equal(require(oldPath), require(newPath), oldPath);
});

test('legacy Testing build command delegates its arguments and exit status', () => {
  const run = file => spawnSync(process.execPath, [resolve(file), '--if-provisioned'], { cwd: root, encoding: 'utf8' });
  const direct = run('tools/testing/build-testing-release.js');
  const legacy = run('tools/build-testing-release.js');
  assert.equal(direct.status, 0);
  assert.equal(legacy.status, direct.status);
  assert.deepEqual(JSON.parse(legacy.stdout), JSON.parse(direct.stdout));
});

test('the staged university supervisor resolves its dependencies without the checkout', t => {
  const base = path.resolve(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(base, 'paws-supervisor-layout-'));
  t.after(() => {
    assert.ok(path.resolve(dir).startsWith(base + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const files = [
    'tools/testing/host/host-cli.js', 'tools/testing/host/host-platform.js',
    'tools/testing/host/host-policy.js', 'tools/testing/host/artifact-attestation.js',
    'tools/testing/host/Invoke-PawsTestingHost.ps1', 'tools/testing/testing-runtime-attestation.js',
    'tools/testing/db/university-admin.js', 'server/src/runtime/sql-environment-target.js',
    'server/src/data/write-gates.js'
  ];
  for (const file of files) {
    const destination = path.join(dir, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(resolve(file), destination);
  }
  const child = spawnSync(process.execPath, ['-e', "const api=require('./tools/testing/host/host-cli.js'); if(typeof api.main!=='function') process.exit(2)"], { cwd: dir, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
});
