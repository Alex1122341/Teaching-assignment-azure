'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createDataApi}=require('../src/data/data-api');
const {createSqlSessionRepository,sessionEditToken}=require('../src/data/sql-session-repository');
const {createSwaFunctions}=require('../src/runtime/swa-functions');
const {createWriteGates}=require('../src/data/write-gates');
const id='11111111-2222-4333-8444-555555555555',id2='22222222-3333-4444-8555-666666666666',fid='33333333-4444-4555-8666-777777777777';
const token='A'.repeat(64);
const payload={edits:[{sessionId:id,expectedToken:token,patch:{topic:'Edited'}}]};
function harness({role='owner',gates={sessionEdit:true,sessionBatchEdit:true},write,profile}={}){
 const calls=[],api=createDataApi({verifyToken:async()=>({uid:'verified-actor'}),findUser:async()=>profile||{active:true,baseRole:role,facultyId:fid,displayName:'Admin'},listSessions:async input=>{calls.push({read:input});return[]},updateSessionBatch:write|| (async input=>{calls.push(input);return input.edits.map(e=>({id:e.sessionId}))}),recalculateSessionDoe:async({sessionId})=>({sessionId,status:'calculated'}),writeGates:gates});
 return {api,calls};
}
test('batch edit requires explicit independent gate and verified administrator',async()=>{
 assert.equal(createWriteGates({PAWS_SESSION_EDIT_WRITE_ENABLED:'true'}).sessionBatchEdit,false);
 assert.equal(createWriteGates({PAWS_SESSION_BATCH_EDIT_ENABLED:'true'}).sessionBatchEdit,true);
 for(const [role,gates,status] of [['faculty',{sessionEdit:true,sessionBatchEdit:true},403],['owner',{sessionEdit:true},503],['owner',{sessionBatchEdit:true},503]]){
  const h=harness({role,gates});assert.equal((await h.api.updateExistingSessionBatch('valid',payload)).status,status);assert.equal(h.calls.length,0);
 }
 const h=harness();const r=await h.api.updateExistingSessionBatch('valid',payload);
 assert.equal(r.status,200);assert.equal(h.calls[0].actorFirebaseUid,'verified-actor');assert.equal(r.body.doe.length,1);
});
test('batch rejects all malformed or duplicate rows before any write',async()=>{
 const h=harness();
 for(const edits of [[{...payload.edits[0],expectedToken:'bad'}],[payload.edits[0],payload.edits[0]],[{...payload.edits[0],patch:{year:2}}],[{sessionId:id,expectedToken:token,assignments:[{facultyId:'not-a-guid'}]}],Array.from({length:21},()=>payload.edits[0]),[{sessionId:id,expectedToken:token}]]){
  assert.ok([400,409].includes((await h.api.updateExistingSessionBatch('valid',{edits})).status));
 }
 assert.equal(h.calls.length,0);
});
test('route is distinct from single-session patch and sends valid authenticated payload',async()=>{
 const h=harness(),route=createSwaFunctions({api:h.api});
 const request={method:'POST',url:'https://local/api/v1/sessions/batch-edit',headers:{get:()=> 'Bearer valid'},json:async()=>payload};
 assert.equal((await route(request)).status,200);
 assert.equal((await route({...request,method:'PATCH'})).status,405);
});
test('list emits edit token only for gated administrator scope',async()=>{
 const admin=harness();await admin.api.sessions('valid',{});assert.equal(admin.calls[0].read.includeBatchEditToken,true);
 const faculty=harness({role:'faculty'});await faculty.api.sessions('valid',{});assert.notEqual(faculty.calls[0].read.includeBatchEditToken,true);
});
const row=(id,topic='Original')=>({id,academicYear:'2026-27',curriculumYear:2,courseCode:'315',courseName:'Course',date:'2026-11-25',startTime:'09:00:00',endTime:'10:00:00',topic,sessionType:'LEC',room:'Room',assignmentsJson:JSON.stringify([{facultyId:fid,teachingRole:'Lecture',displayName:'PRIVATE NAME',active:1}]),unresolvedAssignmentCount:0,sessionalContributorsJson:'[]'});
function mockDb({failId,staleId}={}){
 const state=new Map([[id,row(id)],[id2,row(id2)]]),calls=[];let active=false;
 const db={async transaction(callback){assert.equal(active,false);active=true;const before=new Map([...state].map(([k,v])=>[k,{...v}]));try{const result=await callback();calls.push('commit');return result}catch(e){state.clear();for(const [k,v] of before)state.set(k,v);calls.push('rollback');throw e}finally{active=false}},async query(sql,p){
  assert.equal(active,true);
  if(/SELECT\s+c\.SessionId/i.test(sql)){calls.push('read:'+p.sessionId);return [{...state.get(p.sessionId),...(p.sessionId===staleId?{topic:'Concurrent edit'}:{})}]}
  if(/UpdateCalendarSession/.test(sql)){calls.push('write:'+p.sessionId);if(p.sessionId===failId)throw Object.assign(Error('private sql error'),{number:51246});const next={...state.get(p.sessionId),...JSON.parse(p.patchJson)};state.set(p.sessionId,next);return[next]}
  if(/ReplaceCalendarSessionAssignments/.test(sql)){calls.push('assign:'+p.sessionId);return[state.get(p.sessionId)]}
  throw Error('unexpected SQL');
 }};
 return {db,state,calls};
}
test('repository preflights every snapshot before any write and commits atomically',async()=>{
 const m=mockDb(),repo=createSqlSessionRepository(m.db);
 const edits=[id2,id].map(sessionId=>({sessionId,expectedToken:sessionEditToken(row(sessionId)),patch:{topic:'Changed'}}));
 await repo.updateBatch({edits,actorFirebaseUid:'verified'});
 assert.deepEqual(m.calls,['read:'+id,'read:'+id2,'write:'+id,'write:'+id2,'commit']);
 assert.equal(m.state.get(id).topic,'Changed');
});
test('stale snapshot prevents every write; later SQL failure rolls back earlier rows',async()=>{
 const edits=[id,id2].map(sessionId=>({sessionId,expectedToken:sessionEditToken(row(sessionId)),patch:{topic:'Changed'}}));
 for(const option of [{staleId:id2},{failId:id2}]){
  const m=mockDb(option);await assert.rejects(createSqlSessionRepository(m.db).updateBatch({edits,actorFirebaseUid:'verified'}));
  assert.equal(m.state.get(id).topic,'Original');assert.equal(m.calls.at(-1),'rollback');
  if(option.staleId)assert.equal(m.calls.some(c=>c.startsWith('write:')),false);
 }
});
test('snapshot token uses canonical facts, assignment ids and roles rather than display name',()=>{
 const a=row(id);const b={...a,assignmentsJson:JSON.stringify([{facultyId:fid,teachingRole:'Lecture',displayName:'Changed name',active:1}])};
 assert.equal(sessionEditToken(a),sessionEditToken(b));
 assert.notEqual(sessionEditToken(a),sessionEditToken({...a,topic:'Concurrent'}));
 assert.notEqual(sessionEditToken(a),sessionEditToken({...a,unresolvedAssignmentCount:1}));
});


test('linked sessional evidence participates in the reviewed snapshot and prohibits assignment replacement',async()=>{
 const m=mockDb(),repo=createSqlSessionRepository(m.db);
 const original=m.state.get(id2);
 const protectedRow={...original,sessionalContributorsJson:JSON.stringify([{name:'Synthetic contributor',label:'Sessional',assignmentId:'linked-assignment'}])};
 assert.notEqual(sessionEditToken(original),sessionEditToken(protectedRow));
 m.state.set(id2,protectedRow);
 const first={sessionId:id,expectedToken:sessionEditToken(row(id)),patch:{topic:'Must not save'}};
 const stale={sessionId:id2,expectedToken:sessionEditToken(original),patch:{topic:'Stale'}};
 await assert.rejects(repo.updateBatch({edits:[first,stale],actorFirebaseUid:'verified'}),e=>e.batchCode==='SESSION_BATCH_STALE');
 const change={sessionId:id2,expectedToken:sessionEditToken(protectedRow),assignments:[]};
 await assert.rejects(repo.updateBatch({edits:[first,change],actorFirebaseUid:'verified'}),e=>e.batchCode==='SESSION_ASSIGNMENTS_READ_ONLY');
 assert.equal(m.calls.some(c=>c.startsWith('write:')||c.startsWith('assign:')),false);
 assert.equal(m.state.get(id).topic,'Original');
 await repo.updateBatch({edits:[{sessionId:id2,expectedToken:sessionEditToken(protectedRow),patch:{topic:'Scalar change'}}],actorFirebaseUid:'verified'});
 assert.equal(m.state.get(id2).topic,'Scalar change');
});
test('multiple roles for the same canonical Faculty cannot be collapsed by the batch picker',async()=>{
 const m=mockDb(),repo=createSqlSessionRepository(m.db);
 const complex={...row(id),assignmentsJson:JSON.stringify([{facultyId:fid,teachingRole:'Lecture',active:1},{facultyId:fid.toUpperCase(),teachingRole:'Lead',active:1}])};
 m.state.set(id,complex);
 await assert.rejects(repo.updateBatch({edits:[{sessionId:id,expectedToken:sessionEditToken(complex),assignments:[{facultyId:fid,teachingRole:'Lecture'}]}],actorFirebaseUid:'verified'}),e=>e.batchCode==='SESSION_ASSIGNMENTS_READ_ONLY');
 assert.equal(m.calls.some(c=>c.startsWith('assign:')),false);
});
