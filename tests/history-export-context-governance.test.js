'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze'),report=require('../tools/beta-baseline.json');
const root=path.resolve(__dirname,'..'),MAIN='87a7f943f40bc5bf87b54b1b0059a2593ebc3b7d',PRODUCT='8fb1bc80c988a337f7ecb59fc56a72deeaeeed5d';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
test('history context governance pins the reviewed product without reducing static or API protection',()=>{
 assert.equal(freeze.BASELINE_COMMIT,PRODUCT);assert.equal(api.BASELINE_COMMIT,PRODUCT);assert.equal(report.sourceCommit,PRODUCT);
 git('merge-base','--is-ancestor',MAIN,PRODUCT);git('merge-base','--is-ancestor',PRODUCT,'HEAD');
 const before=freeze.readBaselineManifest({root,baselineCommit:MAIN}),after=freeze.readBaselineManifest({root,baselineCommit:PRODUCT});
 assert.deepEqual(after,before);assert.equal(after.length,91);
 assert.equal(freeze.protectedPaths({root}).length,91);
 assert.equal(freeze.protectedPaths({root,readManifest:()=>['index.html']}).length,91);
 assert.equal(freeze.verifyFreeze({root}).ok,true);
 assert.equal(git('diff','--name-only',MAIN,PRODUCT,'--','frontend'),'frontend/scripts/change-history.js');
 for(const file of after.filter(file=>file!=='change-history.js'))assert.ok(freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:MAIN,file}),freeze.readBaselineFile({root,baselineCommit:PRODUCT,file})),file);
});
test('history context product and governance preserve API SQL rules dependencies and prior release identity',()=>{
 const before=api.baselineRuntimeFiles({root,baselineCommit:MAIN}),after=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});
 assert.deepEqual(after,before);assert.equal(after.length,115);
 const files=[...after,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES];assert.equal(files.length,118);
 for(const file of files)assert.ok(api.bytesMatch(api.readBaselineFile({root,baselineCommit:MAIN,file}),api.readBaselineFile({root,baselineCommit:PRODUCT,file})),file);
 assert.equal(git('diff','--name-only',MAIN,PRODUCT,'--','server','swa-api','database','firestore.rules','firestore.indexes.json','package.json','package-lock.json'),'');
 assert.equal(api.verifyFreeze({root}).ok,true);
});
