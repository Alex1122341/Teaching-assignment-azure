'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze');
const root=path.resolve(__dirname,'..'),PREVIOUS='2d896b82fcfc914ecabab152f3d4ad8e96d72aeb',PRODUCT='50e7e5c4241debe078080adda7a7dcbd383a2ba1';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
test('integrated SWAP approval governance pins its reviewed product with all91 static assets',()=>{
 assert.equal(freeze.BASELINE_COMMIT,PRODUCT);assert.equal(api.BASELINE_COMMIT,PRODUCT);assert.equal(require('../tools/beta-baseline.json').sourceCommit,PRODUCT);
 git('merge-base','--is-ancestor',PREVIOUS,PRODUCT);git('merge-base','--is-ancestor',PRODUCT,'HEAD');
 const before=freeze.readBaselineManifest({root,baselineCommit:PREVIOUS}),after=freeze.readBaselineManifest({root,baselineCommit:PRODUCT});assert.deepEqual(after,before);assert.equal(after.length,91);assert.equal(freeze.protectedPaths({root,readManifest:()=>['index.html']}).length,91);
 assert.deepEqual(git('diff','--name-only',PREVIOUS,PRODUCT,'--','frontend').split('\n'),['frontend/pages/index.html','frontend/scripts/adfa-swap-panel.js','frontend/scripts/swap-workflow-sql.js','frontend/styles/swap-workflow-sql.css']);
 assert.equal(freeze.verifyFreeze({root}).ok,true);
});
test('approval API adds one protected view module and leaves all SQL write authority and package inputs intact',()=>{
 const before=api.baselineRuntimeFiles({root,baselineCommit:PREVIOUS}),after=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});assert.equal(before.length,115);assert.equal(after.length,116);assert.deepEqual(after.filter(file=>!before.includes(file)),['server/src/swap/swap-view.js']);
 for(const file of [...before,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES])if(file!=='server/src/swap/swap-api.js')assert.ok(api.bytesMatch(api.readBaselineFile({root,baselineCommit:PREVIOUS,file}),api.readBaselineFile({root,baselineCommit:PRODUCT,file})),file);
 assert.equal(git('diff','--name-only',PREVIOUS,PRODUCT,'--','database').split('\n').join(','),'database/azure-sql/059_swap_approval_read.sql,database/azure-sql/059_swap_approval_read_acceptance.sql,database/azure-sql/rollback_059_swap_approval_read.sql');
 assert.equal(git('diff','--name-only',PREVIOUS,PRODUCT,'--','firestore.rules','firestore.indexes.json','package.json','package-lock.json','tools/static-assets.json'),'');
 assert.equal(api.verifyFreeze({root}).ok,true);
});
