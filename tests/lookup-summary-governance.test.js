'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=repositoryPath(__dirname,'..');
const freeze=require('../tools/beta-freeze');
const api=require('../tools/beta-api-freeze');
const report=require('../tools/beta-baseline.json');
const PREVIOUS='b5d33762f3544faa94e47d4b7feaf380f0e8a864';
const PRODUCT='846858a242cf2a96b0257822ac22d8ab6a770c94';
// Immutable pre-promotion governance snapshot: do not redefine the reviewed Lookup product.
const ORIGINAL_GOVERNANCE='6addfb9125066c5dd14ca7a3d7c38be6a01a870a';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
test('Lookup AFC/Leave/DOE governance pins only the reviewed two-file static delta',()=>{
  const historicReport=JSON.parse(git('show',ORIGINAL_GOVERNANCE+':tools/beta-baseline.json'));
  const historicFreeze=git('show',ORIGINAL_GOVERNANCE+':tools/beta-freeze.js');
  assert.equal(historicReport.sourceCommit,PRODUCT);
  assert.ok(historicFreeze.includes("const BASELINE_COMMIT='"+PRODUCT+"'"));
  // A later approved promotion must not invalidate this historical two-file delta.
  assert.equal(freeze.BASELINE_COMMIT,report.sourceCommit);
  assert.equal(api.BASELINE_COMMIT,report.sourceCommit);
  git('merge-base','--is-ancestor',PRODUCT,freeze.BASELINE_COMMIT);
  git('merge-base','--is-ancestor',PREVIOUS,PRODUCT);
  git('merge-base','--is-ancestor',PRODUCT,'HEAD');
  const manifest=commit=>JSON.parse(git('show',commit+':tools/static-assets.json')).sort();
  const before=manifest(PREVIOUS),after=manifest(PRODUCT);
  assert.equal(before.length,81);
  assert.deepEqual(after,before);
  const oldApi=api.baselineRuntimeFiles({root,baselineCommit:PREVIOUS});
  const newApi=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});
  assert.deepEqual(newApi,oldApi);
  const protectedApi=[...new Set([...newApi,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES])];
  const changed=git('diff','--name-only',PREVIOUS,PRODUCT).split(/\r?\n/);
  const allowed=['dashboard-view-model.js','faculty-admin.js'];
  assert.deepEqual(changed.filter(p=>after.includes(p)).sort(),allowed);
  assert.deepEqual(changed.filter(p=>protectedApi.includes(p)),[]);
  for(const file of before.filter(p=>!allowed.includes(p))) {
    assert.equal(freeze.bytesMatch(
      freeze.readBaselineFile({root,baselineCommit:PREVIOUS,file}),
      freeze.readBaselineFile({root,baselineCommit:PRODUCT,file})
    ),true,file);
  }
  for(const file of protectedApi) {
    assert.equal(freeze.bytesMatch(
      freeze.readBaselineFile({root,baselineCommit:PREVIOUS,file}),
      freeze.readBaselineFile({root,baselineCommit:PRODUCT,file})
    ),true,file);
  }
  assert.deepEqual(Object.keys(historicReport.sha256).sort(),after);
  for(const file of after)assert.equal(historicReport.sha256[file],freeze.sha256Canonical(freeze.readBaselineFile({root,baselineCommit:PRODUCT,file})),file);
  assert.deepEqual(freeze.verifyFreeze({root}).drift,[]);
  assert.deepEqual(api.verifyFreeze({root}).drift,[]);
});
