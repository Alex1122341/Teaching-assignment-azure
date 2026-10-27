'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createLeadershipAccessApi}=require('../src/access/leadership-access-api');
const F='10000000-0000-4000-8000-000000000001',C='20000000-0000-4000-8000-000000000505',S='30000000-0000-4000-8000-000000000001';
const OP='40000000-0000-4000-8000-000000000001';
function fixture(options={}){
 const owner={firebaseUid:'owner',baseRole:'owner',active:true,mustChangePassword:false,version:'0000000000000001'};
 const target={firebaseUid:'teacher',baseRole:'faculty',active:true,mustChangePassword:false,facultyId:F,facultyActive:true,version:'0000000000000002'};
 const state={now:Date.parse('2026-10-27T18:00:00Z'),serial:0,snapshots:0,commits:[],operations:new Map(),profiles:{owner,teacher:target,admin:{...owner,firebaseUid:'admin',baseRole:'administrator'}}};
 state.snapshot={target,authorityVersion:'0000000000000010',catalog:[{responsibilityId:'course-505',kind:'hicc',active:true,definitionVersion:'a'.repeat(64),courses:[{courseId:C,courseCode:'505'}],groups:[]}],
  sources:[{sourceRoleAssignmentId:S,facultyId:F,academicYear:'2026-27',roleType:'HICC',courseId:C,recordedScope:'VTMD 505',effectiveDate:null,expirationDate:null,hasSchedule:false,version:'0000000000000011',scheduleVersion:null,signature:'b'.repeat(64)}],assignments:[]};
 const repository={snapshot:async(uid,academicYear)=>{assert.equal(uid,'teacher');assert.equal(academicYear,'2026-27');state.snapshots++;return structuredClone(state.snapshot);},
  operation:async id=>state.operations.get(id)||null,
  commit:async intent=>{state.commits.push(structuredClone(intent));const receipt={operationId:intent.operationId,previewId:intent.previewId,actorUid:intent.actorUid,targetUid:intent.targetUid,academicYear:intent.academicYear,reason:intent.reason,changes:intent.changes,savedAuthorityVersion:'0000000000000012',createdAtUtc:'2026-10-27T18:00:00Z'};state.snapshot.authorityVersion=receipt.savedAuthorityVersion;state.operations.set(intent.operationId,receipt);return receipt;}};
 const api=createLeadershipAccessApi({verifyToken:async token=>token?{uid:token}:null,findUser:async uid=>state.profiles[uid]||null,repository,writeEnabled:true,clock:()=>state.now,randomId:()=>`50000000-0000-4000-8000-${String(++state.serial).padStart(12,'0')}`,...options});
 const request={targetUid:'teacher',academicYear:'2026-27',expectedVersion:target.version,changes:[{action:'grant',responsibilityId:'course-505',sourceRoleAssignmentId:S,startDate:'2026-05-01',endDate:'2027-04-30',usesApprovedDefaultDates:true}],reason:'Approved explicit course scope'};
 return {state,api,repository,request};
}
test('leadership preview is Owner-only and never loads private scope for other roles or anonymous callers',async()=>{
 const {api,state,request}=fixture();
 for(const [token,status] of [[null,401],['teacher',403],['admin',403],['missing',403]])assert.equal((await api.preview(token,request)).status,status);
 assert.equal(state.snapshots,0);assert.equal(state.commits.length,0);
});
test('preview binds a fresh target version and closed request fields without writing authority',async()=>{
 const {api,state,request}=fixture();
 assert.equal((await api.preview('owner',{...request,baseRole:'owner'})).status,400);
 assert.equal((await api.preview('owner',{...request,expectedVersion:'0000000000000009'})).status,409);
 const result=await api.preview('owner',request);assert.equal(result.status,200);assert.equal(result.body.changes[0].endExclusive,'2027-05-01');
 assert.equal(result.body.targetUid,'teacher');assert.equal(state.commits.length,0);assert.equal(result.body.writeEnabled,true);
});
test('commit uses the immutable server preview; client mutation cannot widen course or dates',async()=>{
 const {api,state,request}=fixture();const preview=await api.preview('owner',request);
 request.changes[0].responsibilityId='another-course';preview.body.changes[0].courses[0].courseId=F;
 const saved=await api.commit('owner',{previewId:preview.body.previewId,operationId:OP});
 assert.equal(saved.status,200);assert.equal(state.commits.length,1);assert.equal(state.commits[0].changes[0].responsibilityId,'course-505');
 assert.equal(state.commits[0].changes[0].courses[0].courseId,C);assert.equal(saved.body.replayed,false);assert.equal(saved.body.superseded,false);
});
test('disabled writes, expired preview and changed Owner identity never reach the command',async()=>{
 const disabled=fixture({writeEnabled:false});const view=await disabled.api.preview('owner',disabled.request);assert.equal(view.status,200);assert.equal(view.body.writeEnabled,false);
 assert.equal((await disabled.api.commit('owner',{previewId:view.body.previewId,operationId:OP})).status,503);assert.equal(disabled.state.commits.length,0);
 const expired=fixture(),p=await expired.api.preview('owner',expired.request);expired.state.now+=600001;
 assert.equal((await expired.api.commit('owner',{previewId:p.body.previewId,operationId:OP})).status,409);assert.equal(expired.state.commits.length,0);
 const changed=fixture(),q=await changed.api.preview('owner',changed.request);changed.state.profiles.owner.version='0000000000000003';
 assert.equal((await changed.api.commit('owner',{previewId:q.body.previewId,operationId:OP})).status,403);assert.equal(changed.state.commits.length,0);
});
test('persisted same-operation retry recovers a lost response without invoking a second command',async()=>{
 const {api,state,repository,request}=fixture(),commit=repository.commit;repository.commit=async value=>{await commit(value);throw Error('Connection lost after persistence');};
 const preview=await api.preview('owner',request),ids={previewId:preview.body.previewId,operationId:OP};
 const lost=await api.commit('owner',ids);assert.equal(lost.status,503);assert.equal(lost.body.operationId,OP);assert.equal(lost.body.error.code,'LEADERSHIP_CONFIRMATION_REQUIRED');
 state.now+=600001;const replay=await api.commit('owner',ids);assert.equal(replay.status,200);assert.equal(replay.body.replayed,true);assert.equal(state.commits.length,1);
 assert.equal((await api.commit('owner',{...ids,previewId:'50000000-0000-4000-8000-000000000099'})).status,409);
});
test('SQL stale/source/overlap/actor decisions are exposed as bounded failures, never raw SQL errors',async()=>{
 for(const [number,status,code] of [[54101,403,'OWNER_REQUIRED'],[54102,409,'TARGET_ACCESS_INELIGIBLE'],[54103,409,'LEADERSHIP_STALE'],[54104,409,'LEADERSHIP_SOURCE_CHANGED'],[54105,409,'LEADERSHIP_OVERLAP'],[54108,409,'LEADERSHIP_OPERATION_CONFLICT']]){
  const {api,repository,request}=fixture();repository.commit=async()=>{throw {number,message:'PRIVATE SQL DETAIL'};};const preview=await api.preview('owner',request);
  const reply=await api.commit('owner',{previewId:preview.body.previewId,operationId:OP});assert.equal(reply.status,status);assert.equal(reply.body.error.code,code);assert.doesNotMatch(JSON.stringify(reply),/PRIVATE/);
 }
});
test('Owner revocation during awaited preview or readback suppresses the private response',async()=>{
 for(const phase of ['preview','commit']){
  const {api,state,repository,request}=fixture();let preview;if(phase==='commit')preview=await api.preview('owner',request);
  const read=repository.snapshot;repository.snapshot=async(...args)=>{const result=await read(...args);state.profiles.owner.active=false;return result;};
  const result=phase==='preview'?await api.preview('owner',request):await api.commit('owner',{previewId:preview.body.previewId,operationId:OP});
  assert.equal(result.status,403);assert.equal(result.body.changes,undefined);assert.equal(result.body.operation,undefined);
 }
});
test('a later authority change is reported as superseded; receipts never expose storage-only extras',async()=>{
 const {api,state,request}=fixture(),preview=await api.preview('owner',request),ids={previewId:preview.body.previewId,operationId:OP};await api.commit('owner',ids);
 state.snapshot.authorityVersion='0000000000000013';Object.assign(state.operations.get(OP),{email:'PRIVATE',rawSql:'PRIVATE'});
 const current=await api.commit('owner',ids);assert.equal(current.status,200);assert.equal(current.body.superseded,true);assert.doesNotMatch(JSON.stringify(current),/PRIVATE|rawSql|email/);
});
test('unavailable trusted authority snapshot fails closed instead of offering an empty successful preview',async()=>{
 const {api,repository,request}=fixture();repository.snapshot=async()=>{throw Error('PRIVATE');};const reply=await api.preview('owner',request);
 assert.equal(reply.status,503);assert.doesNotMatch(JSON.stringify(reply),/PRIVATE/);
});
