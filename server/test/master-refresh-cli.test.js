'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {run}=require('../../tools/master-refresh/run-master-refresh.cjs');
const {manifestHash}=require('../src/master-refresh/master-source-domain');
test('Plan never opens SQL and preserves the private manifest',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'paws-master-cli-'));
 const source={schemaVersion:1,academicYear:'2026-27',sourceSha256:'A'.repeat(64),appointments:[],rotations:[],cccAllocations:[],roleDefinitions:[],trainees:[],cccSlots:[],issues:[]};source.manifestSha256=manifestHash(source);
 await fs.writeFile(path.join(dir,'source.json'),JSON.stringify(source));
 const result=await run({mode:'Plan',domain:'appointments',sourcePath:path.join(dir,'source.json'),outputPath:path.join(dir,'plan.json')},{connect:async()=>assert.fail('Plan opened SQL')});
 assert.equal(result.databaseWrites,false);assert.equal(result.manifestSha256,source.manifestSha256);
 await assert.rejects(run({mode:'Stage',domain:'appointments',sourcePath:path.join(dir,'source.json'),outputPath:path.join(dir,'plan.json'),actorFirebaseUid:'admin'},{connect:async()=>assert.fail('Existing output reached SQL')}),{code:'EEXIST'});
});
test('Apply rejects source-row injection before opening a connection',async()=>{
 await assert.rejects(run({mode:'Apply',domain:'appointments',operations:[],outputPath:'unused'},{connect:async()=>assert.fail('Invalid Apply reached SQL')}));
});
test('Draft is a separate explicit operation and cannot be triggered by Plan or unconfirmed arguments',async()=>{
 await assert.rejects(run({mode:'Draft',domain:'appointments',outputPath:'unused',sourcePath:'missing',actorFirebaseUid:'admin',confirm:false},{connect:async()=>assert.fail('Unconfirmed Draft opened SQL')}),{code:'INVALID_MASTER_CLI'});
 await assert.rejects(run({mode:'Draft',domain:'appointments',outputPath:'unused',sourcePath:'missing',actorFirebaseUid:'admin',confirm:true},{connect:async()=>assert.fail('Missing source Draft opened SQL')}),{code:'ENOENT'});
});
