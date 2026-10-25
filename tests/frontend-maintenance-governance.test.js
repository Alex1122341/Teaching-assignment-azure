'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze');
const root=path.resolve(__dirname,'..'),MAIN='c7ca3d978437918ee503d2b64e84f5512c195971',PRODUCT='90b8c2f263ce49ba97eaa48db5fad749f64b436f';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();

test('current maintenance promotion pins its reviewed integrated product and retains every PR ancestry',()=>{
 assert.equal(freeze.BASELINE_COMMIT,PRODUCT);assert.equal(api.BASELINE_COMMIT,PRODUCT);assert.equal(require('../tools/beta-baseline.json').sourceCommit,PRODUCT);
 for(const sha of [MAIN,'31aaa3debb88d652ba95421c83d89266476193f8','78a7fcf89108250471d51d5a87d9892978c3789e','3d91f48f30cf4decc37915b506f3b148cda19c53'])git('merge-base','--is-ancestor',sha,PRODUCT);
 git('merge-base','--is-ancestor',PRODUCT,'HEAD');
 const before=freeze.readBaselineManifest({root,baselineCommit:MAIN}),after=freeze.readBaselineManifest({root,baselineCommit:PRODUCT});
 assert.equal(before.length,91);assert.equal(after.length,92);assert.deepEqual(before.filter(file=>!after.includes(file)),[]);assert.deepEqual(after.filter(file=>!before.includes(file)),['calendar-search.js']);
 assert.equal(freeze.protectedPaths({root,readManifest:()=>['index.html']}).length,92);
});

test('maintenance changes only five static sources while preserving SWAP approval and every other served asset',()=>{
 const changed=['frontend/pages/index.html','frontend/scripts/calendar-activities.js','frontend/scripts/calendar-search.js','frontend/scripts/change-history.js','frontend/scripts/timetable.js'];
 assert.deepEqual(git('diff','--name-only',MAIN,PRODUCT,'--','frontend').split('\n'),changed);
 for(const file of freeze.readBaselineManifest({root,baselineCommit:MAIN}).filter(file=>!['index.html','calendar-activities.js','change-history.js','timetable.js'].includes(file)))assert.ok(freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:MAIN,file}),freeze.readBaselineFile({root,baselineCommit:PRODUCT,file})),file);
 assert.ok(freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:'8fb1bc80c988a337f7ecb59fc56a72deeaeeed5d',file:'change-history.js'}),freeze.readBaselineFile({root,baselineCommit:PRODUCT,file:'change-history.js'})));
 assert.equal(freeze.verifyFreeze({root}).ok,true);
});

test('frontend-only maintenance preserves all 119 API inputs and all SQL permissions rules dependencies',()=>{
 const before=api.baselineRuntimeFiles({root,baselineCommit:MAIN}),after=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});assert.deepEqual(after,before);assert.equal(after.length,116);
 const files=[...after,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES];assert.equal(files.length,119);
 for(const file of files)assert.ok(api.bytesMatch(api.readBaselineFile({root,baselineCommit:MAIN,file}),api.readBaselineFile({root,baselineCommit:PRODUCT,file})),file);
 assert.equal(git('diff','--name-only',MAIN,PRODUCT,'--','server','swa-api','database','firestore.rules','firestore.indexes.json','package.json','package-lock.json'),'');
 assert.equal(api.verifyFreeze({root}).ok,true);
});
