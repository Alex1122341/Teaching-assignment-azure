'use strict';
// A Testing feature-parity guard independent of the immutable Production freeze.
// It fails closed for ANY extra shared runtime or SQL file drift.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const base = 'origin/main';
git('merge-base', '--is-ancestor', base, 'HEAD');
const current = JSON.parse(fs.readFileSync(path.join(root, 'tools/static-assets.json'), 'utf8'));
const baseline = JSON.parse(git('show', base + ':tools/static-assets.json'));
assert.equal(baseline.length, 95, 'Review the new accepted Beta manifest before changing the Testing parity gate');
assert.equal(current.length, baseline.length + 1, 'Testing can add only its environment switcher asset');
assert.deepEqual(current.filter(file => !baseline.includes(file)), ['paws-environment-nav.js']);
assert.deepEqual(baseline.filter(file => !current.includes(file)), []);
const expectedFrontend = [
  'frontend/pages/faculty-admin.html',
  'frontend/pages/index.html',
  'frontend/pages/password.html',
  'frontend/pages/teaching-assignments.html',
  'frontend/pages/user-management.html',
  'frontend/scripts/bulk-import-ui.js',
  'frontend/scripts/developer-support.js',
  'frontend/scripts/faculty-access.js',
  'frontend/scripts/faculty-admin.js',
  'frontend/scripts/paws-api-origin.js',
  'frontend/scripts/paws-data-client.js',
  'frontend/scripts/paws-environment-nav.js',
  'frontend/scripts/teaching-assignments.js',
  'frontend/scripts/timetable.js'
].sort();
const expectedApi = [
  'server/src/data/sql-connection.js',
  'server/src/data/write-gates.js',
  'server/src/runtime/environment.js',
  'server/src/runtime/sql-environment-target.js',
  'server/src/runtime/swa-sql-runtime.js',
  'server/src/runtime/university-api.js',
  'server/src/runtime/university-http-server.js',
  'server/src/support/support-service.js'
].sort();
const changes = (...folders) => git('diff', '--name-only', base, 'HEAD', '--', ...folders)
  .split(/\r?\n/).filter(Boolean).sort();
const actualFrontend = changes('frontend/pages', 'frontend/scripts', 'frontend/styles', 'frontend/assets');
const actualApi = changes('server/src');
const actualSql = changes('database/azure-sql');
assert.deepEqual(actualFrontend, expectedFrontend, 'Unreviewed Beta frontend deviation in Testing overlay');
assert.deepEqual(actualApi, expectedApi, 'Unreviewed Beta API deviation in Testing overlay');
assert.deepEqual(actualSql, [], 'Testing must inherit the exact accepted Beta SQL source; migrations use a separate guarded adapter');
for (const file of baseline) {
  const { assetSourcePath, sourcePathAtCommit } = require('../build/frontend-paths');
  const location = sourcePathAtCommit(root, base, file);
  assert.ok(location, 'Beta source missing: ' + file);
  assert.ok(fs.existsSync(assetSourcePath(root, file)), 'Testing asset missing: ' + file);
}
console.log(JSON.stringify({
  ok: true, base, betaAssets: baseline.length, testingAssets: current.length,
  reviewedFrontendOverlays: actualFrontend.length,
  reviewedApiOverlays: actualApi.length,
  sqlDrift: actualSql.length,
  note: 'Code parity only. This does not prove Testing Firebase/SQL/Node deployment.'
}));
