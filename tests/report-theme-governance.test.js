'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze'),root=path.resolve(__dirname,'..');
const MAIN='25720f98be54b81bab9dd6680b87e64b21e21d0b',PRODUCT='ef2d053ff9963aad972c22ec6c3fa8fc53bcb149',git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
test('report theme promotion anchors the reviewed CSS-only runtime change and preserves the95-file static union',()=>{
 assert.equal(freeze.BASELINE_COMMIT,PRODUCT);assert.equal(api.BASELINE_COMMIT,PRODUCT);assert.equal(require('../tools/beta-baseline.json').sourceCommit,PRODUCT);git('merge-base','--is-ancestor',MAIN,PRODUCT);git('merge-base','--is-ancestor',PRODUCT,'HEAD');
 const before=freeze.readBaselineManifest({root,baselineCommit:MAIN}),after=freeze.readBaselineManifest({root,baselineCommit:PRODUCT});assert.equal(after.length,95);assert.deepEqual(after,before);assert.equal(freeze.protectedPaths({root,readManifest:()=>['index.html']}).length,95);assert.equal(git('diff','--name-only',MAIN,PRODUCT,'--','frontend'),'frontend/styles/faculty-reports.css');
 for(const file of after.filter(file=>file!=='faculty-reports.css'))assert.ok(freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:MAIN,file}),freeze.readBaselineFile({root,baselineCommit:PRODUCT,file})),file);assert.equal(freeze.verifyFreeze({root}).ok,true);
});
test('theme correction leaves every124 API input and all data/security contracts byte identical',()=>{
 const before=api.baselineRuntimeFiles({root,baselineCommit:MAIN}),after=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});assert.deepEqual(after,before);assert.equal(after.length,121);const paths=[...after,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES];assert.equal(paths.length,124);for(const file of paths)assert.ok(api.bytesMatch(api.readBaselineFile({root,baselineCommit:MAIN,file}),api.readBaselineFile({root,baselineCommit:PRODUCT,file})),file);
 assert.equal(git('diff','--name-only',MAIN,PRODUCT,'--','server','swa-api','database','firestore.rules','firestore.indexes.json','package.json','package-lock.json'),'');assert.equal(api.verifyFreeze({root}).ok,true);
});
