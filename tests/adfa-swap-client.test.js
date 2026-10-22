'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPawsDataClient}=require('../frontend/scripts/paws-data-client.js');
test('SWAP preview uses authenticated GET with opaque candidate and assignment keys only',async()=>{
 let observed;
 const client=createPawsDataClient({tokenProvider:async()=>'synthetic',fetchImpl:async(url,init)=>{observed={url,init};return{ok:true,json:async()=>({preview:{status:'calculated',sessionDoeCredit:2}})};}});
 assert.equal((await client.swapFacultyPreview({sessionId:'session',assignmentId:'assignment',candidateKey:'candidate',snapshotToken:'snapshot',resultDoe:100,facultyId:'private'})).sessionDoeCredit,2);
 assert.equal(observed.init.method||'GET','GET');
 assert.equal(observed.init.headers.Authorization,'Bearer synthetic');
 const query=new URL(observed.url).searchParams;
 assert.deepEqual(Object.fromEntries(query),{sessionId:'session',assignmentId:'assignment',snapshotToken:'snapshot',candidateKey:'candidate'});
 assert.equal(observed.init.body,undefined);
});
