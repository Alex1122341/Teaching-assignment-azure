'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const freeze = require('../tools/beta-freeze.js');
const apiFreeze = require('../tools/beta-api-freeze.js');


const root = path.resolve(__dirname, '..');
const PRIOR_MAIN = '49f34d0a3bdc1412439d05f2cf5476634f8d1cc8';
const PRODUCT = '58daab3a2401af69c2298cc1f078d78aad069ea9';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const ACCEPTED = '8bb40c60370bcce3d0135efd4327d42fba657903';
const report = JSON.parse(git('show', ACCEPTED + ':tools/beta-baseline.json'));
const historicalFreeze = git('show', ACCEPTED + ':tools/beta-freeze.js');
const changed = (before, after) => git('diff', '--name-only', before, after).split(/\r?\n/).filter(Boolean);

test('SQL hex correction modifies only the Dashboard repository among protected runtime assets', () => {
  git('merge-base', '--is-ancestor', PRIOR_MAIN, PRODUCT);
  git('merge-base', '--is-ancestor', PRODUCT, 'HEAD');
  const beforeStatic = JSON.parse(git('show', PRIOR_MAIN + ':tools/static-assets.json'));
  const nextStatic = JSON.parse(git('show', PRODUCT + ':tools/static-assets.json'));
  assert.deepEqual(nextStatic, beforeStatic);
  assert.deepEqual(changed(PRIOR_MAIN, PRODUCT).filter(f => beforeStatic.includes(f)), []);
  const previousApi = apiFreeze.baselineRuntimeFiles({ root, baselineCommit: PRIOR_MAIN });
  const newApi = apiFreeze.baselineRuntimeFiles({ root, baselineCommit: PRODUCT });
  assert.deepEqual(newApi, previousApi);
  assert.deepEqual(changed(PRIOR_MAIN, PRODUCT).filter(f => newApi.includes(f)), ['server/src/data/sql-dashboard-repository.js']);
  assert.deepEqual(changed(PRIOR_MAIN, PRODUCT).filter(f => f.startsWith('frontend/') || f.startsWith('.github/workflows/')), []);
  assert.deepEqual(changed(PRIOR_MAIN, PRODUCT).filter(f => f === 'database/azure-sql/035_role_appointment_periods.sql'), []);
  assert.ok(changed(PRIOR_MAIN, PRODUCT).includes('database/azure-sql/058_role_appointment_rowversion_hex.sql'));
});

test('governance commit promotes exact immutable product without weakening the source and API freeze', () => {
  assert.ok(historicalFreeze.includes("const BASELINE_COMMIT='" + PRODUCT + "'"));
  git('merge-base', '--is-ancestor', PRODUCT, freeze.BASELINE_COMMIT);
  assert.equal(apiFreeze.BASELINE_COMMIT, freeze.BASELINE_COMMIT);
  assert.equal(report.sourceCommit, PRODUCT);
  const assets = JSON.parse(git('show', PRODUCT + ':tools/static-assets.json'));
  assert.deepEqual(Object.keys(report.sha256).sort(), [...assets].sort());
  for (const file of assets) assert.equal(report.sha256[file], freeze.sha256Canonical(
    freeze.readBaselineFile({ root, baselineCommit: PRODUCT, file })
  ), file);
  const protectedApi = apiFreeze.baselineRuntimeFiles({ root, baselineCommit: PRODUCT });
  const safe = [...new Set([...protectedApi, ...apiFreeze.BUILD_DEFINITION_FILES, ...apiFreeze.REPOSITORY_INPUT_FILES])];
  assert.deepEqual(changed(PRODUCT, ACCEPTED).filter(f => assets.includes(f) || safe.includes(f)), []);
  assert.equal(freeze.verifyFreeze({ root }).ok, true);
  assert.equal(apiFreeze.verifyFreeze({ root }).ok, true);
});
