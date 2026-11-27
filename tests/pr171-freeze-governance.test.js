'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze');
const previous='54a8e23cc88b628eb5cf3234c29388b7f800dfb9';
const previousReceipt='a0d21690f443a5b4520a2b9c989c932fb7f1fbde';
const product='343f04b06f7360d0b5ee3b1ab0c9d8bda4a6ded8';
const productReceipt='5d90e1ffffafa4ba3b482abd010355d6abfa6e4e';
const candidate='75191cd454064a70293d34c549338469aa34fbb8';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const blob=(ref,file)=>execFileSync('git',['cat-file','blob',ref+':'+file],{cwd:root,maxBuffer:256*1024*1024});
const manifest=ref=>freeze.readBaselineManifest({root,baselineCommit:ref}).slice().sort();
const hashes=ref=>Object.fromEntries(manifest(ref).map(file=>[file,freeze.sha256Canonical(freeze.readBaselineFile({root,baselineCommit:ref,file}))]));

test('PR171 retains the independently accepted Availability freeze and all 96 historical asset hashes',()=>{
 const receipt=JSON.parse(blob(previousReceipt,'tools/beta-baseline.json').toString('utf8'));
 assert.equal(receipt.sourceCommit,previous);
 assert.ok(blob(previousReceipt,'tools/beta-freeze.js').toString('utf8').includes("const BASELINE_COMMIT='"+previous+"'"));
 assert.equal(manifest(previous).length,96);
 assert.deepEqual(receipt.sha256,hashes(previous));
 git('merge-base','--is-ancestor',previous,previousReceipt);
 git('merge-base','--is-ancestor',previousReceipt,product);
 git('merge-base','--is-ancestor',product,'HEAD');
});

test('PR171 approved immutable product changes exactly six static and seven API files without reducing protection',()=>{
 const before=manifest(previous),after=manifest(product);
 assert.equal(before.length,96);assert.equal(after.length,97);
 assert.equal(new Set(after).size,97);
 assert.deepEqual(before.filter(file=>!after.includes(file)),[]);
 assert.deepEqual(after.filter(file=>!before.includes(file)),['calendar-tested-features.js']);
 const changedStatic=before.filter(file=>!freeze.bytesMatch(
  freeze.readBaselineFile({root,baselineCommit:previous,file}),
  freeze.readBaselineFile({root,baselineCommit:product,file})
 ));
 assert.deepEqual(changedStatic,['calendar-search.js','index.html','paws-data-client.js','timetable.css','timetable.js']);
 const oldApi=api.baselineRuntimeFiles({root,baselineCommit:previous});
 const newApi=api.baselineRuntimeFiles({root,baselineCommit:product});
 assert.equal(oldApi.length,137);assert.deepEqual(newApi,oldApi);
 assert.deepEqual(newApi.filter(file=>!api.bytesMatch(
  api.readBaselineFile({root,baselineCommit:previous,file}),
  api.readBaselineFile({root,baselineCommit:product,file})
 )),[
  'server/src/afc/afc-request-api.js','server/src/data/data-api.js',
  'server/src/data/sql-session-repository.js','server/src/data/write-gates.js',
  'server/src/runtime/swa-functions.js','server/src/runtime/swa-sql-runtime.js',
  'server/src/runtime/university-http-server.js'
 ]);
 for(const file of [...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES]){
  assert.ok(api.bytesMatch(api.readBaselineFile({root,baselineCommit:previous,file}),api.readBaselineFile({root,baselineCommit:product,file})),file);
 }
 assert.equal(git('diff','--name-only',previous,product,'--','database','package.json','package-lock.json','server/package.json','server/package-lock.json','deploy/aca/Dockerfile','firestore.rules','firestore.indexes.json'),'');
});

test('PR171 governance pins the reviewed follow-up and preserves both immutable product receipts',()=>{
 const originalReport=JSON.parse(blob(productReceipt,'tools/beta-baseline.json').toString('utf8'));
 const original=blob(productReceipt,'tools/beta-freeze.js').toString('utf8');
 const oldAnchor="const BASELINE_COMMIT='"+product+"';",newAnchor="const BASELINE_COMMIT='"+candidate+"';";
 assert.equal(originalReport.sourceCommit,product);
 assert.equal(original.split(oldAnchor).length,2);
 git('merge-base','--is-ancestor',product,productReceipt);
 git('merge-base','--is-ancestor',productReceipt,candidate);
 git('merge-base','--is-ancestor',candidate,'HEAD');

 const report=JSON.parse(fs.readFileSync(path.join(root,'tools/beta-baseline.json'),'utf8'));
 assert.equal(freeze.BASELINE_COMMIT,candidate);assert.equal(api.BASELINE_COMMIT,candidate);
 assert.equal(report.sourceCommit,candidate);assert.equal(report.siteUrl,'https://tester-teaching.web.app');
 const candidateHashes=hashes(candidate);
 assert.deepEqual(report.sha256,candidateHashes);
 const priorAssets=manifest(product),current=manifest(candidate);
 assert.deepEqual(current,priorAssets);
 assert.deepEqual(current.filter(file=>candidateHashes[file]!==originalReport.sha256[file]),[
  'calendar-tested-features.js','effective-access-guard.js','timetable.js'
 ]);
 const runtimeFiles=api.baselineRuntimeFiles({root,baselineCommit:candidate});
 assert.deepEqual(runtimeFiles,api.baselineRuntimeFiles({root,baselineCommit:product}));
 assert.deepEqual(git('diff','--name-only',product,candidate,'--','server/src','swa-api','database','package.json','package-lock.json','server/package.json','server/package-lock.json','deploy/aca/Dockerfile','firestore.rules','firestore.indexes.json').split('\n'),[
  'database/azure-sql/073_owner_account_directory_read.sql',
  'database/azure-sql/rollback_073_owner_account_directory_read.sql',
  'server/src/access/account-access-api.js',
  'server/src/afc/afc-request-api.js',
  'server/src/data/sql-account-access-repository.js',
  'server/src/data/sql-scheduling-task-repository.js',
  'server/src/data/sql-user-repository.js'
 ]);
 assert.ok(freeze.bytesMatch(Buffer.from(original.replace(oldAnchor,newAnchor)),fs.readFileSync(path.join(root,'tools/beta-freeze.js'))),'Only the reviewed anchor may change.');
 assert.ok(api.bytesMatch(blob(productReceipt,'tools/beta-api-freeze.js'),fs.readFileSync(path.join(root,'tools/beta-api-freeze.js'))),'API verifier must not change.');
 assert.deepEqual(freeze.protectedPaths({root}),current);
 assert.deepEqual(freeze.protectedPaths({root,readManifest:()=>['index.html']}),current);
 const stat=freeze.verifyFreeze({root}),runtime=api.verifyFreeze({root});
 assert.equal(stat.protected,97);assert.deepEqual(stat.drift,[]);assert.equal(stat.ok,true);
 assert.equal(runtime.runtimeFiles.length,137);assert.equal(runtime.protected,140);assert.deepEqual(runtime.drift,[]);assert.equal(runtime.ok,true);
});
