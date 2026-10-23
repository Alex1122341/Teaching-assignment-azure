'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze');
const BASE='a6eaaca81d02fa9185517b442aae067dac4abc13',PRODUCT='8570198ebf5db7676072e9dc4c3d97f5885ae5d2';
const git=(...args)=>execFileSync('git',args,{cwd:root});
test('integrated leadership release adds two public and four API files without SQL or dependency drift',()=>{
  const before=JSON.parse(git('show',BASE+':tools/static-assets.json')),after=JSON.parse(git('show',PRODUCT+':tools/static-assets.json'));
  assert.equal(before.length,85);assert.equal(after.length,87);
  assert.deepEqual(before.filter(file=>!after.includes(file)),[]);
  assert.deepEqual(after.filter(file=>!before.includes(file)).sort(),['leadership-directory.css','leadership-directory.js']);
  assert.deepEqual(before.filter(file=>!freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:BASE,file}),freeze.readBaselineFile({root,baselineCommit:PRODUCT,file}))).sort(),['index.html','paws-data-client.js','timetable.js']);
  const priorApi=api.baselineRuntimeFiles({root,baselineCommit:BASE}),nextApi=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});
  assert.equal(nextApi.length,114);assert.deepEqual(priorApi.filter(file=>!nextApi.includes(file)),[]);
  assert.deepEqual(nextApi.filter(file=>!priorApi.includes(file)).sort(),['server/src/data/sql-leadership-directory-repository.js','server/src/roles/leadership-directory-api.js','server/src/roles/role-effective-status.js','server/src/runtime/swa-leadership-directory-functions.js']);
  const changed=git('diff','--name-only',BASE,PRODUCT).toString().trim().split(/\r?\n/);
  assert.deepEqual(changed.filter(file=>priorApi.includes(file)),['server/src/runtime/swa-sql-runtime.js']);
  assert.deepEqual(changed.filter(file=>file.startsWith('database/')||api.REPOSITORY_INPUT_FILES.includes(file)||api.BUILD_DEFINITION_FILES.includes(file)),[]);
});
test('integrated leadership governance shares its immutable product anchor with no shipped-byte edits',()=>{
  assert.equal(freeze.BASELINE_COMMIT,PRODUCT);assert.equal(api.BASELINE_COMMIT,PRODUCT);
  assert.equal(require('../tools/beta-baseline.json').sourceCommit,PRODUCT);
  assert.equal(freeze.verifyFreeze({root}).ok,true);assert.equal(api.verifyFreeze({root}).ok,true);
  const protectedApi=[...api.baselineRuntimeFiles({root,baselineCommit:PRODUCT}),...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES];
  assert.deepEqual(git('diff','--name-only',PRODUCT,'HEAD').toString().trim().split(/\r?\n/).filter(file=>file.startsWith('frontend/')||protectedApi.includes(file)),[]);
});
