'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze');
const root=path.resolve(__dirname,'..'),BASE='87a7f943f40bc5bf87b54b1b0059a2593ebc3b7d',PRODUCT='2d896b82fcfc914ecabab152f3d4ad8e96d72aeb';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
test('DVM intake governance pins its independently reviewed product and all 91 static assets',()=>{
 assert.equal(freeze.BASELINE_COMMIT,PRODUCT);assert.equal(api.BASELINE_COMMIT,PRODUCT);
 assert.equal(require('../tools/beta-baseline.json').sourceCommit,PRODUCT);
 git('merge-base','--is-ancestor',BASE,PRODUCT);git('merge-base','--is-ancestor',PRODUCT,'HEAD');
 assert.equal(git('diff','--name-only',BASE,PRODUCT,'--','frontend'),'frontend/scripts/swap-workflow-sql.js\nfrontend/styles/swap-workflow-sql.css');
 const before=freeze.readBaselineManifest({root,baselineCommit:BASE}),after=freeze.readBaselineManifest({root,baselineCommit:PRODUCT});
 assert.deepEqual(after,before);assert.equal(after.length,91);assert.equal(freeze.protectedPaths({root,readManifest:()=>['index.html']}).length,91);
 assert.equal(freeze.verifyFreeze({root}).ok,true);
});
test('DVM intake does not alter any API SQL role rule dependency or build input',()=>{
 assert.equal(git('diff','--name-only',BASE,PRODUCT,'--','server','swa-api','database','firestore.rules','firestore.indexes.json','package.json','package-lock.json','tools/static-assets.json'),'');
 const before=api.baselineRuntimeFiles({root,baselineCommit:BASE}),after=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});assert.deepEqual(after,before);assert.equal(after.length,115);
 for(const file of [...after,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES])assert.ok(api.bytesMatch(api.readBaselineFile({root,baselineCommit:BASE,file}),api.readBaselineFile({root,baselineCommit:PRODUCT,file})),file);
 assert.equal(api.verifyFreeze({root}).ok,true);
});
