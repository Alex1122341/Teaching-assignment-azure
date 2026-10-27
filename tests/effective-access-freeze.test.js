'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze');
const api=require('../tools/beta-api-freeze');
const root=path.resolve(__dirname,'..');
const previous='19d5042473917bc96434b141ab1f9a41f8e8eb1e';
const product='179fa70ebce42e252a29826d76057799d6af43a7';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const changed=(paths)=>paths.filter(file=>{
 try{return !freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:previous,file}),freeze.readBaselineFile({root,baselineCommit:product,file}));}
 catch{return true;}
}).sort();
test('effective access promotion covers all96 static files and preserves the historical manifest union',()=>{
 const receipt=git('show','c17f3515f8200abe1c39a541ea4fe98c6da671eb:tools/beta-freeze.js');
 assert.ok(receipt.includes(`const BASELINE_COMMIT='${product}'`));
 assert.equal(api.BASELINE_COMMIT,freeze.BASELINE_COMMIT);
 git('merge-base','--is-ancestor',product,freeze.BASELINE_COMMIT);
 git('merge-base','--is-ancestor',previous,product);
 git('merge-base','--is-ancestor',product,'HEAD');
 const before=freeze.readBaselineManifest({root,baselineCommit:previous});
 const after=freeze.readBaselineManifest({root,baselineCommit:product});
 assert.equal(before.length,95);assert.equal(after.length,96);
 assert.deepEqual(after.filter(file=>!before.includes(file)),['effective-access-guard.js']);
 assert.deepEqual(before.filter(file=>!after.includes(file)),[]);
 assert.deepEqual(changed(after),['availability-lookup.js','effective-access-guard.js','faculty-access.js','faculty-admin.html','faculty-admin.js','index.html','information-center.js','paws-data-client.js','teaching-assignments.html','teaching-assignments.js','timetable.js','user-management.css','user-management.html','user-management.js']);
 assert.equal(freeze.protectedPaths({root,readManifest:()=>['index.html']}).length,96);
 assert.equal(freeze.verifyFreeze({root}).ok,true);
});
test('effective access promotion covers127 API runtime files plus the unchanged three package/build inputs',()=>{
 const before=api.baselineRuntimeFiles({root,baselineCommit:previous});
 const after=api.baselineRuntimeFiles({root,baselineCommit:product});
 assert.equal(before.length,121);assert.equal(after.length,127);
 assert.deepEqual(before.filter(file=>!after.includes(file)),[]);
 assert.deepEqual(changed(after),['server/src/access/account-access-api.js','server/src/access/account-access-policy.js','server/src/access/collaboration-api.js','server/src/access/legacy-access-store.js','server/src/data/sql-account-access-repository.js','server/src/data/write-gates.js','server/src/runtime/swa-account-access-functions.js','server/src/runtime/swa-report-functions.js','server/src/runtime/swa-sql-runtime.js','swa-api/index.js']);
 assert.deepEqual(changed([...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES]),[]);
 const result=api.verifyFreeze({root});
 assert.equal(result.protected,130);
 assert.equal(result.ok,true);
 const existing=git('ls-tree','-r','--name-only',previous,'database/azure-sql').split('\n');
 assert.deepEqual(changed(existing),[]);
 assert.equal(git('diff','--name-only',previous,product,'--','firestore.indexes.json','package.json','package-lock.json'),'');
});
