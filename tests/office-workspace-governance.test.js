'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze');
const root=path.resolve(__dirname,'..'),MAIN='8bb40c60370bcce3d0135efd4327d42fba657903',PRODUCT='a6c5092020cfda4c87873591b3c8d5edbeba5e72';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
test('integrated office governance pins the exact accepted product and protects all 91 assets',()=>{
 assert.equal(freeze.BASELINE_COMMIT,PRODUCT);assert.equal(api.BASELINE_COMMIT,PRODUCT);
 git('merge-base','--is-ancestor',MAIN,PRODUCT);git('merge-base','--is-ancestor',PRODUCT,'HEAD');
 const before=freeze.readBaselineManifest({root,baselineCommit:MAIN}),after=freeze.readBaselineManifest({root,baselineCommit:PRODUCT});
 assert.equal(after.length,91);assert.deepEqual(before.filter(f=>!after.includes(f)),[]);
 assert.equal(freeze.protectedPaths({root}).length,91);assert.equal(freeze.verifyFreeze({root}).ok,true);
 assert.equal(freeze.protectedPaths({root,readManifest:()=>['index.html']}).length,91);
});
test('integrated office static promotion leaves every API dependency SQL and permission byte unchanged',()=>{
 const before=api.baselineRuntimeFiles({root,baselineCommit:MAIN}),after=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});
 assert.equal(after.length,115);assert.deepEqual(after,before);
 const files=[...after,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES];assert.equal(files.length,118);
 for(const file of files)assert.ok(api.bytesMatch(api.readBaselineFile({root,baselineCommit:MAIN,file}),api.readBaselineFile({root,baselineCommit:PRODUCT,file})),file);
 assert.equal(git('diff','--name-only',MAIN,PRODUCT,'--','server','swa-api','database','firestore.rules','firestore.indexes.json','package.json','package-lock.json'),'');
 assert.equal(api.verifyFreeze({root}).ok,true);
});
test('initial office product promotion remains an immutable historical receipt',()=>{
 const initial='5d324df870344345ddb7ab59ff7ae1b54e219e6f',accepted='2998f1a8e407658f035e60eeeebb7eb6d875538b';
 assert.ok(git('show',accepted+':tools/beta-freeze.js').includes("const BASELINE_COMMIT='"+initial+"'"));
 assert.equal(JSON.parse(git('show',accepted+':tools/beta-baseline.json')).sourceCommit,initial);
 assert.equal(git('diff','--name-only',initial,accepted,'--','frontend','server','swa-api','database','tools/static-assets.json'),'');
});
