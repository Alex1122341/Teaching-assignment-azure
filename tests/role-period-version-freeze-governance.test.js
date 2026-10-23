'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const freeze = require('../tools/beta-freeze.js');
const apiFreeze = require('../tools/beta-api-freeze.js');
const report = require('../tools/beta-baseline.json');

const root = path.resolve(__dirname, '..');
const PREVIOUS = '5a3117d4aec48b685e734651f4caa24d9050ba4f';
const PRODUCT = '4c23f7f1d096437c4fcc020556cb1f0253701ecb';
const changedStatic = ['faculty-role-periods.js'];
const changedApi = ['server/src/data/dashboard-api.js'];
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const manifest = ref => JSON.parse(git('show', ref + ':tools/static-assets.json'));

test('role period fix changes only one frozen static and one frozen API runtime file', () => {
  git('merge-base', '--is-ancestor', PREVIOUS, PRODUCT);
  git('merge-base', '--is-ancestor', PRODUCT, 'HEAD');
  const oldAssets = manifest(PREVIOUS);
  const newAssets = manifest(PRODUCT);
  assert.deepEqual(newAssets, oldAssets);
  const oldApi = apiFreeze.baselineRuntimeFiles({ root, baselineCommit: PREVIOUS });
  const newApi = apiFreeze.baselineRuntimeFiles({ root, baselineCommit: PRODUCT });
  assert.deepEqual(newApi, oldApi);
  for (const file of oldAssets.filter(file => !changedStatic.includes(file))) {
    assert.ok(freeze.bytesMatch(
      freeze.readBaselineFile({ root, baselineCommit: PREVIOUS, file }),
      freeze.readBaselineFile({ root, baselineCommit: PRODUCT, file })
    ), file);
  }
  for (const file of oldApi.filter(file => !changedApi.includes(file))) {
    assert.ok(apiFreeze.bytesMatch(
      apiFreeze.readBaselineFile({ root, baselineCommit: PREVIOUS, file }),
      apiFreeze.readBaselineFile({ root, baselineCommit: PRODUCT, file })
    ), file);
  }
  const original = freeze.readBaselineFile({ root, baselineCommit: PREVIOUS, file: changedStatic[0] });
  const updated = freeze.readBaselineFile({ root, baselineCommit: PRODUCT, file: changedStatic[0] });
  assert.equal(freeze.bytesMatch(original, updated), false);
  assert.equal(apiFreeze.bytesMatch(
    apiFreeze.readBaselineFile({ root, baselineCommit: PREVIOUS, file: changedApi[0] }),
    apiFreeze.readBaselineFile({ root, baselineCommit: PRODUCT, file: changedApi[0] })
  ), false);
});

test('separate governance commit pins the reviewed product without hiding runtime drift', () => {
  assert.equal(freeze.BASELINE_COMMIT, PRODUCT);
  assert.equal(apiFreeze.BASELINE_COMMIT, PRODUCT);
  assert.equal(report.sourceCommit, PRODUCT);
  const files = manifest(PRODUCT);
  assert.deepEqual(Object.keys(report.sha256).sort(), [...files].sort());
  for (const file of files) assert.equal(report.sha256[file], freeze.sha256Canonical(
    freeze.readBaselineFile({ root, baselineCommit: PRODUCT, file })
  ), file);
  const protectedApi = apiFreeze.baselineRuntimeFiles({ root, baselineCommit: PRODUCT });
  const changes = git('diff', '--name-only', PRODUCT, 'HEAD').split(/\r?\n/).filter(Boolean);
  assert.deepEqual(changes.filter(file => files.includes(file) || protectedApi.includes(file)), []);
  assert.equal(freeze.verifyFreeze({ root }).ok, true);
  assert.equal(apiFreeze.verifyFreeze({ root }).ok, true);
});
