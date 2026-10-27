'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze');
const api=require('../tools/beta-api-freeze');
const root=path.resolve(__dirname,'..');
const previous='179fa70ebce42e252a29826d76057799d6af43a7';
const product='cb4298c734e7162c86a71b729c797ff548111db7';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const changed=files=>files.filter(file=>!freeze.bytesMatch(
 freeze.readBaselineFile({root,baselineCommit:previous,file}),
 freeze.readBaselineFile({root,baselineCommit:product,file})
)).sort();
test('Calendar default promotion retains the effective-access receipt and changes only two static assets',()=>{
 assert.equal(freeze.BASELINE_COMMIT,product);
 assert.equal(api.BASELINE_COMMIT,product);
 git('merge-base','--is-ancestor',previous,product);
 git('merge-base','--is-ancestor',product,'HEAD');
 const receipt=git('show','c17f3515f8200abe1c39a541ea4fe98c6da671eb:tools/beta-freeze.js');
 assert.ok(receipt.includes(`const BASELINE_COMMIT='${previous}'`));
 const before=freeze.readBaselineManifest({root,baselineCommit:previous});
 const after=freeze.readBaselineManifest({root,baselineCommit:product});
 assert.deepEqual(after,before);
 assert.equal(after.length,96);
 assert.deepEqual(changed(after),['calendar-activities.js','timetable.js']);
 assert.equal(freeze.protectedPaths({root,readManifest:()=>['index.html']}).length,96);
 assert.equal(freeze.verifyFreeze({root}).ok,true);
});
test('Calendar default promotion preserves all127 API files and three package/build inputs byte-for-byte',()=>{
 const before=api.baselineRuntimeFiles({root,baselineCommit:previous});
 const after=api.baselineRuntimeFiles({root,baselineCommit:product});
 assert.deepEqual(after,before);
 assert.equal(after.length,127);
 assert.deepEqual(changed([...after,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES]),[]);
 assert.equal(api.verifyFreeze({root}).protected,130);
 assert.equal(api.verifyFreeze({root}).ok,true);
 assert.equal(git('diff','--name-only',previous,product,'--','database','firestore.rules','firestore.indexes.json','package.json','package-lock.json','tools/static-assets.json'), '');
});
