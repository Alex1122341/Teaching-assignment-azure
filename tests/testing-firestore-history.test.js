'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createLabHistoryRepository}=require('../tools/testing/firestore-history');
const {createChangeHistoryApi}=require('../server/src/history/change-history-api');
const FACULTY='a1111111-1111-4111-8111-111111111111';
const OTHER='b2222222-2222-4222-8222-222222222222';
function dbWith(rows){
 return {projectId:'vista-teaching-lab',databaseId:'(default)',
  collection(name){
   assert.equal(name,'paws_testing_audit');
   return {orderBy(key,direction){
    assert.equal(key,'occurredAtUtc');assert.equal(direction,'desc');
    return {limit(cap){assert.equal(cap,10001);return {async get(){
     return {docs:rows.map(data=>({data:()=>data}))};}};}};
   }};
  }};
}
const event=(facultyId=FACULTY)=>({
 synthetic:true,eventId:'e1111111-1111-4111-8111-111111111111',
 source:'paws_testing',eventType:'session_updated',entityType:'session',
 entityId:'c1111111-1111-4111-8111-111111111111',actorFirebaseUid:'admin',
 actorName:'Synthetic Owner',occurredAtUtc:'2026-10-27T12:00:00.000Z',
 academicYear:'2026-27',
 beforeJson:JSON.stringify({academicYear:'2026-27',room:'OLD',facultyId}),
 afterJson:JSON.stringify({academicYear:'2026-27',room:'NEW',facultyId}),
 contextJson:JSON.stringify({academicYear:'2026-27',affectedFaculty:[{facultyId,facultyKey:facultyId}]})
});
const findUser=async uid=>({firebaseUid:uid,baseRole:uid==='admin'?'owner':'faculty',
 facultyId:uid==='admin'?null:FACULTY,active:true,mustChangePassword:false});
test('Testing audit reader is project-pinned, synthetic-only, time-bounded',async()=>{
 assert.throws(()=>createLabHistoryRepository({db:{...dbWith([]),projectId:'tester-teaching'}}),/project/);
 const repo=createLabHistoryRepository({db:dbWith([event()])});
 const rows=await repo.list({actorFirebaseUid:'admin',scope:'dashboard',
  startUtc:'2026-10-01T00:00:00.000Z',endUtc:'2026-11-01T00:00:00.000Z'});
 assert.equal(rows.length,1);assert.equal(rows[0].eventType,'session_updated');
 await assert.rejects(()=>createLabHistoryRepository({db:dbWith([{...event(),synthetic:false}])})
  .list({actorFirebaseUid:'admin',scope:'dashboard',startUtc:'2026-10-01T00:00:00.000Z',endUtc:'2026-11-01T00:00:00.000Z'}),/Non-synthetic/);
});
test('Canonical History scope hides unrelated Faculty events',async()=>{
 const api=createChangeHistoryApi({verifyToken:async token=>({uid:token}),
  findUser,repository:createLabHistoryRepository({db:dbWith([event(OTHER),event(FACULTY)])}),
  clock:()=>Date.parse('2026-10-28T12:00:00.000Z')});
 const result=await api.query('faculty',{scope:'mine',academicYear:'2026-27'});
 assert.equal(result.status,200);
 assert.ok(result.body.rows.length>=1);
 assert.ok(result.body.rows.every(row=>!String(row.affectedFaculty||'').includes(OTHER)));
 const denied=await api.query('',{scope:'mine',academicYear:'2026-27'});
 assert.equal(denied.status,401);
});
