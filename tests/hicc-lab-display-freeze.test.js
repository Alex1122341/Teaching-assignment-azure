'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const freeze=require('../tools/beta-freeze');
const api=require('../tools/beta-api-freeze');
const root=path.resolve(__dirname,'..');
const previous='ef2d053ff9963aad972c22ec6c3fa8fc53bcb149';
const product='19d5042473917bc96434b141ab1f9a41f8e8eb1e';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
test('HICC/LAB display promotion retains all 95 shipped files and changes only three protected assets',()=>{
 assert.equal(freeze.BASELINE_COMMIT,product);
 assert.equal(api.BASELINE_COMMIT,product);
 git('merge-base','--is-ancestor',previous,product);
 git('merge-base','--is-ancestor',product,'HEAD');
 const before=freeze.readBaselineManifest({root,baselineCommit:previous});
 const after=freeze.readBaselineManifest({root,baselineCommit:product});
 assert.deepEqual(after,before);
 assert.equal(after.length,95);
 const changed=after.filter(file=>!freeze.bytesMatch(
  freeze.readBaselineFile({root,baselineCommit:previous,file}),
  freeze.readBaselineFile({root,baselineCommit:product,file}))).sort();
 assert.deepEqual(changed,['lab-session-detail.js','leadership-directory.js','timetable.js']);
 assert.equal(freeze.verifyFreeze({root}).ok,true);
});
test('HICC/LAB display promotion changes zero protected API/SQL/auth/write-gate bytes',()=>{
 const oldApi=api.baselineRuntimeFiles({root,baselineCommit:previous});
 const newApi=api.baselineRuntimeFiles({root,baselineCommit:product});
 assert.deepEqual(newApi,oldApi);
 const protectedApi=[...new Set([...oldApi,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES])];
 for(const file of protectedApi)assert.equal(api.bytesMatch(
  api.readBaselineFile({root,baselineCommit:previous,file}),
  api.readBaselineFile({root,baselineCommit:product,file})),true,file);
 const touched=git('diff','--name-only',previous,product,'--','server','swa-api','database','firestore.rules','firestore.indexes.json','package.json','package-lock.json');
 assert.equal(touched,'');
 assert.equal(api.verifyFreeze({root}).ok,true);
});
