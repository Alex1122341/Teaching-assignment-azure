'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createAccountAccessApi}=require('../src/access/account-access-api');
const {createDataApi}=require('../src/data/data-api');
const FID='10000000-0000-4000-8000-000000000001';
function fixture(options={}){
 const state={now:Date.parse('2026-10-26T18:00:00Z'),reads:0,serial:0,profiles:new Map(),operations:new Map()};
 for(const [uid,baseRole] of [['owner','adfa_general'],['admin','adfa_regular'],['developer','developer'],['faculty','faculty'],['hicc','hicc']])state.profiles.set(uid,{firebaseUid:uid,baseRole,active:true,mustChangePassword:false,facultyId:['faculty','hicc'].includes(baseRole)?FID:null,displayName:uid==='owner'?'Alex Owner':'Taylor Example',email:uid+'@example.test',version:'0000000000000001'});
 state.profiles.set('inactive',{...state.profiles.get('faculty'),firebaseUid:'inactive',active:false});
 const repository={
  read:async uid=>state.profiles.get(uid),
  list:async()=>{state.reads++;return [...state.profiles.values()];},
  eligibleFaculty:async()=>[{facultyId:FID,active:true,displayName:'Taylor Example'}],
  operation:async id=>state.operations.get(id)||null,
  history:async({targetUid,offset})=>({total:[...state.operations.values()].filter(row=>!targetUid||row.targetUid===targetUid).length,rows:[...state.operations.values()].filter(row=>!targetUid||row.targetUid===targetUid).slice(offset,offset+50)}),
  commit:async change=>{
   const target=state.profiles.get(change.targetUid),actor=state.profiles.get(change.actorUid);
   if(!actor?.active||actor.baseRole!=='adfa_general'||actor.version!==change.actorVersion)throw {number:54001};
   if(target.version!==change.expectedVersion)throw {number:54003};
   const saved={...target,active:change.after.active,baseRole:change.after.role,facultyId:change.after.facultyId,version:(BigInt('0x'+target.version)+1n).toString(16).padStart(16,'0')};
   state.profiles.set(saved.firebaseUid,saved);
   const operation={...change,profile:saved,createdAtUtc:new Date(state.now).toISOString()};state.operations.set(change.operationId,operation);return operation;
  }
 };
 const api=createAccountAccessApi({verifyToken:async token=>token?{uid:token,role:'owner'}:null,findUser:async uid=>state.profiles.get(uid),repository,writeEnabled:true,clock:()=>state.now,randomId:()=> '00000000-0000-4000-8000-'+String(++state.serial).padStart(12,'0'),...options});
 return {state,repository,api};
}

test('only an active SQL Owner reads the account directory; self status does not grant access',async()=>{
 const {api,state}=fixture();
 assert.equal((await api.list('',{})).status,401);
 for(const uid of ['faculty','hicc','admin','developer','inactive'])assert.equal((await api.list(uid,{})).status,403,uid);
 assert.equal(state.reads,0);
 const result=await api.list('owner',{});assert.equal(result.status,200);assert.equal(result.body.total,6);
 assert.equal(result.body.accounts.find(row=>row.uid==='owner').displayName,'Owner, Alex');
 assert.equal(result.body.accounts.find(row=>row.uid==='developer').editable,false);
 const own=await api.self('faculty');assert.equal(own.status,200);assert.equal(own.body.access.role,'faculty');assert.equal(own.body.access.canManageAccounts,false);
 const inactive=await api.self('inactive');assert.equal(inactive.status,200);assert.equal(inactive.body.access.allowed,false);assert.equal(inactive.body.access.status,'inactive');
 assert.doesNotMatch(JSON.stringify(own),/owner@example|developer@example/);
});

test('Owner previews an exact versioned change with reason without changing access',async()=>{
 const {api,state}=fixture();
 const changes={active:false};
 const response=await api.preview('owner',{targetUid:'faculty',expectedVersion:'0000000000000001',changes,reason:'  Temporary absence  '});
 assert.equal(response.status,200);assert.match(response.body.previewId,/^[a-f0-9-]{36}$/);
 assert.deepEqual(response.body.before,{role:'faculty',active:true,facultyId:FID});
 assert.deepEqual(response.body.after,{role:'faculty',active:false,facultyId:FID});
 assert.equal(response.body.reason,'Temporary absence');assert.equal(response.body.expiresAt,'2026-10-26T18:10:00.000Z');
 assert.equal(state.profiles.get('faculty').active,true);assert.equal(state.operations.size,0);
 assert.equal((await api.preview('admin',{targetUid:'faculty',expectedVersion:'0000000000000001',changes,reason:'Not permitted'})).status,403);
});

test('preview rejects ambiguous input, unsupported grants, protected targets and self lockout',async()=>{
 const {api,state}=fixture(),valid={targetUid:'faculty',expectedVersion:'0000000000000001',changes:{active:false},reason:'Requested review'};
 for(const patch of [{reason:''},{reason:'  '},{reason:'x'.repeat(1001)},{reason:1},{changes:{}},{changes:{active:'false'}},{changes:{role:'other_office'}},{changes:{role:'developer'}},{changes:{facultyId:null}},{changes:{facultyId:'UCID-123'}},{changes:{active:false,sql:'UPDATE profiles'}},{changes:{mustChangePassword:false}},{expectedVersion:'bad'},{extra:true},{targetUid:'x/y'}]){
  const result=await api.preview('owner',{...valid,...patch});assert.equal(result.status,400,JSON.stringify(patch));
 }
 assert.equal((await api.preview('owner',{...valid,targetUid:'developer'})).status,403);
 assert.equal((await api.preview('owner',{...valid,targetUid:'owner'})).status,409);
 assert.equal((await api.preview('owner',{...valid,targetUid:'owner',changes:{role:'faculty',facultyId:FID}})).status,409);
 assert.equal((await api.preview('owner',{...valid,changes:{active:true}})).status,409);
 state.profiles.get('faculty').version='0000000000000002';assert.equal((await api.preview('owner',valid)).status,409);
 assert.equal(state.operations.size,0);
});

test('commit persists previewed access once, returns audit/readback and denies the next old-token request',async()=>{
 const {api,state}=fixture(),p=await api.preview('owner',{targetUid:'faculty',expectedVersion:'0000000000000001',changes:{active:false},reason:'Temporary access removal'});
 const command={previewId:p.body.previewId,operationId:'00000000-0000-4000-8000-000000000099'};
 const saved=await api.commit('owner',command);assert.equal(saved.status,200);assert.equal(saved.body.profile.active,false);assert.equal(saved.body.profile.version,'0000000000000002');
 assert.equal(saved.body.operation.operationId,command.operationId);assert.equal(saved.body.operation.reason,'Temporary access removal');assert.equal(saved.body.operation.actorUid,'owner');assert.equal(saved.body.operation.before.active,true);assert.equal(saved.body.operation.after.active,false);
 const retry=await api.commit('owner',command);assert.equal(retry.status,200);assert.equal(retry.body.replayed,true);assert.equal(state.operations.size,1);
 const ordinary=createDataApi({verifyToken:async()=>({uid:'faculty',role:'owner'}),findUser:async uid=>state.profiles.get(uid),listSessions:async()=>{throw Error('Revoked reader reached');}});
 assert.equal((await ordinary.sessions('existing-firebase-token',{})).status,403);
});

test('private previews are bounded, expire and cannot cross Owners or changed SQL versions',async()=>{
 const h=fixture(),input={targetUid:'faculty',expectedVersion:'0000000000000001',changes:{active:false},reason:'Approved removal'};
 const a=await h.api.preview('owner',input),b=await h.api.preview('owner',input),c=await h.api.preview('owner',input);
 const cmd=preview=>({previewId:preview.body.previewId,operationId:'00000000-0000-4000-8000-000000000099'});
 assert.equal((await h.api.commit('owner',cmd(a))).status,409);
 h.state.profiles.set('second',{...h.state.profiles.get('owner'),firebaseUid:'second'});
 assert.equal((await h.api.commit('second',cmd(b))).status,403);
 h.state.profiles.get('faculty').version='0000000000000003';assert.equal((await h.api.commit('owner',cmd(b))).status,409);
 h.state.now+=600000;assert.equal((await h.api.commit('owner',cmd(c))).status,409);
 assert.equal(h.state.operations.size,0);
 const gated=fixture({writeEnabled:false}),p=await gated.api.preview('owner',input);assert.equal((await gated.api.commit('owner',cmd(p))).body.error.code,'WRITE_DISABLED');
});

test('an uncertain response is recovered with the same operation after restart without reapplying a grant',async()=>{
 const h=fixture(),input={targetUid:'faculty',expectedVersion:'0000000000000001',changes:{active:false},reason:'Approved removal'};
 const p=await h.api.preview('owner',input),command={previewId:p.body.previewId,operationId:'00000000-0000-4000-8000-000000000099'},read=h.repository.read;
 h.repository.read=async uid=>{if(h.state.operations.size&&uid==='faculty')throw Error('PRIVATE SQL DETAILS');return read(uid);};
 const uncertain=await h.api.commit('owner',command);assert.equal(uncertain.status,503);assert.equal(uncertain.body.error.code,'ACCESS_CONFIRMATION_REQUIRED');assert.doesNotMatch(JSON.stringify(uncertain),/PRIVATE/);assert.equal(h.state.operations.size,1);
 h.repository.read=read;
 const restarted=createAccountAccessApi({verifyToken:async()=>({uid:'owner'}),findUser:read,repository:h.repository,writeEnabled:true});
 const recovered=await restarted.commit('same-token',command);assert.equal(recovered.status,200);assert.equal(recovered.body.replayed,true);assert.equal(recovered.body.profile.version,'0000000000000002');assert.equal(h.state.operations.size,1);
 assert.equal((await restarted.commit('same-token',{...command,previewId:'00000000-0000-4000-8000-000000000098'})).status,409);
});

test('Owner history reports immutable changes and no private account directory to other roles',async()=>{
 const h=fixture(),p=await h.api.preview('owner',{targetUid:'faculty',expectedVersion:'0000000000000001',changes:{active:false},reason:'Recorded reason'});
 await h.api.commit('owner',{previewId:p.body.previewId,operationId:'00000000-0000-4000-8000-000000000099'});
 const result=await h.api.history('owner',{targetUid:'faculty',offset:0});assert.equal(result.status,200);assert.equal(result.body.total,1);assert.equal(result.body.rows[0].reason,'Recorded reason');assert.equal(result.body.rows[0].before.active,true);assert.equal(result.body.rows[0].after.active,false);assert.doesNotMatch(JSON.stringify(result),/intentHash|example.test|actorVersion|previewId/);
 assert.equal((await h.api.history('hicc',{})).status,403);assert.equal((await h.api.history('owner',{offset:3})).status,400);
});

test('an Owner can link their own faculty identity without mistaking the saved version for revoked access',async()=>{
 const h=fixture(),p=await h.api.preview('owner',{targetUid:'owner',expectedVersion:'0000000000000001',changes:{facultyId:FID},reason:'Link my canonical faculty profile'});
 assert.equal(p.status,200);const saved=await h.api.commit('owner',{previewId:p.body.previewId,operationId:'00000000-0000-4000-8000-000000000099'});
 assert.equal(saved.status,200);assert.equal(saved.body.profile.facultyId,FID);assert.equal(saved.body.profile.role,'adfa_general');
});

test('source limits and asynchronous Owner revocation do not expose partial directories or previews',async()=>{
 const h=fixture();h.repository.eligibleFaculty=async()=>Array.from({length:5001},()=>({facultyId:FID,active:true}));
 const p=await h.api.preview('owner',{targetUid:'faculty',expectedVersion:'0000000000000001',changes:{role:'hicc'},reason:'Review link'});assert.equal(p.status,413);
 h.repository.list=async()=>{h.state.profiles.get('owner').active=false;return [...h.state.profiles.values()];};
 const denied=await h.api.list('owner',{});assert.equal(denied.status,403);assert.equal(denied.body.accounts,undefined);
});
