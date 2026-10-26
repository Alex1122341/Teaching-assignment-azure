'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
test('personal Azure deployment entry points are retired', () => {
  for (const name of ['.github/workflows/azure-beta-aca-deploy.yml', '.github/workflows/azure-beta-acr-publish.yml', 'tools/beta-acr-tag-guard.js']) {
    assert.equal(fs.existsSync(path.join(root,name)), false, name);
  }
});
test('the beta build retains freezes and artifacts without building ACA containers', () => {
  const workflow = read('.github/workflows/azure-beta-build.yml');
  assert.doesNotMatch(workflow, /docker build|az (?:acr|containerapp)|azure\/login@|npm ci --prefix swa-api/);
  for (const required of ['npm ci --prefix server', 'npm test', 'npm run test:emulator', 'node tools/build-beta-release.js', 'node tools/beta-freeze.js --artifact .azure-production/app', 'node tools/beta-api-freeze.js --artifact .azure-production/api', 'name: azure-beta-']) {
    assert.ok(workflow.includes(required), required);
  }
});
test('Firebase exact-artifact, University API and hosting checks stay in place', () => {
  const workflow = read('.github/workflows/firebase-hosting-deploy.yml');
  for (const required of ['.github/workflows/azure-beta-build.yml', 'azure-beta-', 'GET', '/api/health/runtime', '/api/health/sql', '/api/v1/me', '--only hosting']) {
    assert.ok(workflow.includes(required), required);
  }
  assert.doesNotMatch(workflow, /azure\/login@|az (?:acr|containerapp)/);
});
test('University API and active SQL migrations are not removed', () => {
  for (const name of ['server/src/runtime/university-api.js', 'server/src/runtime/swa-sql-runtime.js', 'database/azure-sql/059_swap_approval_read.sql', '.github/workflows/calendar-activity-sql.yml']) {
    assert.equal(fs.existsSync(path.join(root,name)), true, name);
  }
});