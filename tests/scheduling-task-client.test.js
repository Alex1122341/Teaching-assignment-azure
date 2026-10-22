'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {createPawsDataClient}=require('../paws-data-client');
test('Tasks client uses authenticated scoped routes and excludes caller identity fields',async()=>{
 const calls=[];const client=createPawsDataClient({tokenProvider:async()=> 'synthetic',fetchImpl:async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>({tasks:[],total:0})};}});
 await client.schedulingTasks({academicYear:'2026-27',undated:'only',limit:50,actorFirebaseUid:'SPOOF',facultyId:'PRIVATE'});
 await client.reviewSchedulingTask('key/id',{academicYear:'2026-27',expectedEvidenceVersion:'e',expectedReviewVersion:'v',reviewStatus:'Reviewed',actorFirebaseUid:'SPOOF'});
 assert.match(calls[0].url,/\/scheduling-tasks\?.*academicYear=2026-27/);assert.match(calls[1].url,/\/scheduling-tasks\/key%2Fid\/review$/);
 for(const call of calls){assert.equal(call.init.headers.Authorization,'Bearer synthetic');assert.equal(call.init.credentials,'omit');assert.doesNotMatch(call.url+(call.init.body||''),/SPOOF|PRIVATE|actorFirebaseUid|facultyId/);}
 assert.equal(calls[1].init.method,'POST');
});
