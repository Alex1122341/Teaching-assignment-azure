'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createCollaborationApi}=require('../src/access/collaboration-api');
const H='10000000-0000-4000-8000-000000000001',F='10000000-0000-4000-8000-000000000002',O='10000000-0000-4000-8000-000000000003';
function fixture(options={}){
 const profiles=new Map([
  ['owner',{firebaseUid:'owner',baseRole:'owner',active:true,displayName:'Alex Owner'}],
  ['hicc',{firebaseUid:'hicc',baseRole:'hicc',facultyId:H,active:true,displayName:'HICC Example'}],
  ['faculty',{firebaseUid:'faculty',baseRole:'faculty',facultyId:F,active:true,displayName:'Taylor Example'}],
  ['other',{firebaseUid:'other',baseRole:'hicc',facultyId:O,active:true,displayName:'Other HICC'}],
  ['admin',{firebaseUid:'admin',baseRole:'administrator',active:true,displayName:'Administrator'}]
 ]);
 const state={profiles,groupReads:0,writes:0,info:{version:'125.000000001',messages:[{id:'old',title:'Existing update',body:'Keep the original message.',authorName:'Taylor Example',authorUid:'PRIVATE-AUTHOR',email:'PRIVATE-EMAIL',createdAt:'2026-10-25T12:00:00.000Z'}]},groups:[{id:'g1',name:'Course collaboration',ownerUid:'hicc',courseIds:['301'],memberUids:['hicc','faculty','old-orphan'],version:'123.000000001',secret:'PRIVATE-GROUP-META'},{id:'g2',name:'Other group',ownerUid:'other',courseIds:['505'],memberUids:['other'],version:'123.000000002'}]};
 const repository={collaborators:async()=>[...profiles.values()].filter(row=>row.facultyId).map(row=>({...row,email:'PRIVATE-EMAIL',ucid:'PRIVATE-UCID',doe:99,facultyActive:true}))};
 const store={
  listGroups:async({ownerUid})=>{state.groupReads++;return state.groups.filter(row=>!ownerUid||row.ownerUid===ownerUid);},
  updateGroup:async({id,expectedVersion,buildPatch})=>{
   const index=state.groups.findIndex(row=>row.id===id);if(index<0)throw {code:'GROUP_NOT_FOUND'};
   const current=state.groups[index];if(current.version!==expectedVersion)throw {code:'GROUP_STALE'};
   const patch=await buildPatch({...current,memberUids:current.memberUids.slice()});
   const result={...current,...patch,version:'123.000000003'};state.groups[index]=result;state.writes++;return result;
  },
  createGroup:async({id,buildPatch})=>{if(state.groups.some(row=>row.id===id))throw {code:'GROUP_ALREADY_EXISTS'};const patch=await buildPatch(null),group={...patch,id,version:'124.000000001'};state.groups.push(group);state.writes++;return group;},
  readAnnouncements:async()=>state.info,
  updateAnnouncements:async({expectedVersion,buildPatch})=>{if(state.info.version!==expectedVersion)throw {code:'ANNOUNCEMENT_STALE'};const patch=await buildPatch(state.info);state.info={...patch,version:'125.000000002'};state.writes++;return state.info;},
  listLegacyAudit:async()=>[{id:'old-audit',action:'account_updated',changedByName:'Alex Owner',changedByEmail:'PRIVATE-EMAIL',targetName:'Taylor Example',beforeRole:'faculty',role:'hicc',active:true,changedAt:'2026-10-24T12:00:00.000Z',before:{email:'PRIVATE-EMAIL'}}]
 };
 const api=createCollaborationApi({verifyToken:async token=>token?{uid:token,role:'owner'}:null,findUser:async uid=>profiles.get(uid),repository,store,writeEnabled:true,...options});
 return {state,repository,store,api};
}

test('SQL HICC sees own collaboration group and sanitized people, never another group or login directory',async()=>{
 const {api,state}=fixture();assert.equal((await api.groups('')).status,401);assert.equal((await api.groups('faculty')).status,403);assert.equal((await api.groups('admin')).status,403);assert.equal(state.groupReads,0);
 const result=await api.groups('hicc');assert.equal(result.status,200);assert.equal(result.body.groups.length,1);assert.equal(result.body.groups[0].id,'g1');assert.equal(result.body.groups[0].canManageDetails,false);assert.equal(result.body.groups[0].unresolvedMemberships,1);
 assert.deepEqual(result.body.groups[0].members.map(row=>row.facultyId),[H,F]);assert.equal(result.body.candidates.find(row=>row.facultyId===F).displayName,'Example, Taylor');
 assert.equal(result.body.collaborationOnly,true);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|ownerUid|memberUids|email|ucid|"doe"|old-orphan/);
 const owner=await api.groups('owner');assert.equal(owner.body.groups.length,2);assert.equal(owner.body.groups[0].canManageDetails,true);
 assert.equal(owner.body.writeEnabled,true);
 assert.equal((await fixture({writeEnabled:false}).api.groups('hicc')).body.writeEnabled,false);
});

test('stale announcements and legacy cursors return an actionable conflict without retrying a write',async()=>{
 const h=fixture();
 const stale=await h.api.publishAnnouncement('owner',{expectedVersion:'125.000000009',title:'Update',body:'Message'});
 assert.equal(stale.status,409);assert.equal(stale.body.error.code,'ANNOUNCEMENT_STALE');assert.equal(h.state.writes,0);
 h.store.listLegacyAudit=async()=>{throw {code:'LEGACY_CURSOR_STALE'};};
 const cursor=await h.api.legacyAudit('owner',{cursor:'deleted-cursor'});
 assert.equal(cursor.status,409);assert.equal(cursor.body.error.code,'LEGACY_CURSOR_STALE');
});

test('HICC updates only own collaboration members and retains unresolved historical membership',async()=>{
 const {api,state}=fixture();
 const response=await api.updateMembers('hicc','g1',{expectedVersion:'123.000000001',memberFacultyIds:[H]});
 assert.equal(response.status,200);assert.deepEqual(response.body.group.members.map(row=>row.facultyId),[H]);assert.equal(response.body.group.unresolvedMemberships,1);
 assert.deepEqual(state.groups[0].memberUids,['hicc','old-orphan']);assert.deepEqual(state.groups[0].courseIds,['301']);assert.equal(state.groups[0].ownerUid,'hicc');assert.equal(state.writes,1);
 assert.deepEqual(state.groups[1].memberUids,['other']);assert.equal(state.profiles.get('faculty').baseRole,'faculty');assert.doesNotMatch(JSON.stringify(response),/old-orphan|memberUids|ownerUid|PRIVATE/);
 assert.equal((await api.updateMembers('hicc','g2',{expectedVersion:'123.000000002',memberFacultyIds:[O,H]})).status,403);assert.equal(state.writes,1);
});

test('group updates reject stale/expanded scope and cannot emit private readback after asynchronous revocation',async()=>{
 const h=fixture(),input={expectedVersion:'123.000000001',memberFacultyIds:[H]};
 assert.equal((await h.api.updateMembers('hicc','g1',{...input,expectedVersion:'123.000000009'})).status,409);
 for(const bad of [{...input,ownerUid:'other'},{...input,courseIds:['999']},{...input,memberFacultyIds:[F]},{...input,memberFacultyIds:[H,H]},{...input,memberFacultyIds:['fake']}])assert.equal((await h.api.updateMembers('hicc','g1',bad)).status,400);
 assert.equal(h.state.writes,0);
 const load=h.repository.collaborators;let loads=0;h.repository.collaborators=async()=>{const rows=await load();if(++loads===2)h.state.profiles.get('hicc').active=false;return rows;};
 const denied=await h.api.updateMembers('hicc','g1',input);assert.equal(denied.status,403);assert.equal(denied.body.group,undefined);
});

test('only Owner creates collaboration details with an active HICC and no business grants',async()=>{
 const h=fixture(),input={creationId:'10000000-0000-4000-8000-000000000099',name:'  New teaching collaboration  ',ownerFacultyId:H,courseIds:['206'],memberFacultyIds:[H,F]};
 assert.equal((await h.api.saveGroup('hicc',null,input)).status,403);
 const saved=await h.api.saveGroup('owner',null,input);assert.equal(saved.status,200);assert.equal(saved.body.group.name,'New teaching collaboration');assert.equal(saved.body.group.ownerFacultyId,H);assert.equal(saved.body.group.canManageDetails,true);assert.deepEqual(saved.body.group.courseIds,['206']);assert.equal(h.state.writes,1);
 assert.equal((await h.api.saveGroup('owner',null,input)).status,409);assert.equal(h.state.writes,1);
 assert.equal(h.state.profiles.get('faculty').baseRole,'faculty');
 assert.equal((await h.api.saveGroup('owner',null,{...input,creationId:'10000000-0000-4000-8000-000000000098',ownerFacultyId:F})).status,400);
 assert.equal((await h.api.saveGroup('owner',null,{...input,role:'owner'})).status,400);
 const {creationId,...update}=input;assert.equal((await h.api.saveGroup('owner','g1',{...update,expectedVersion:'123.000000009'})).status,409);
});

test('announcements use effective SQL access, Owner-only publication and sanitized existing messages',async()=>{
 const h=fixture();
 const current=await h.api.announcements('faculty');assert.equal(current.status,200);assert.equal(current.body.messages[0].title,'Existing update');assert.equal(current.body.messages[0].authorName,'Example, Taylor');assert.equal(current.body.canPublish,false);assert.doesNotMatch(JSON.stringify(current),/PRIVATE|authorUid|email/);
 assert.equal((await h.api.publishAnnouncement('hicc',{expectedVersion:'125.000000001',title:'Not allowed',body:'Not allowed'})).status,403);
 const saved=await h.api.publishAnnouncement('owner',{expectedVersion:'125.000000001',title:'New update',body:'New message'});assert.equal(saved.status,200);assert.equal(saved.body.messages.length,2);assert.equal(saved.body.messages[0].title,'New update');assert.equal(saved.body.messages[0].authorName,'Owner, Alex');assert.equal(saved.body.messages[1].body,'Keep the original message.');assert.equal(h.state.writes,1);
 assert.equal((await h.api.publishAnnouncement('owner',{expectedVersion:'125.000000001',title:'Retry',body:'Old preview'})).status,409);assert.equal(h.state.writes,1);
 h.state.profiles.get('faculty').active=false;assert.equal((await h.api.announcements('faculty')).status,403);
});

test('collaboration names never fall back to another persons email and ambiguous identities stay retained',async()=>{
 const h=fixture();h.state.profiles.get('faculty').displayName='private-person@example.test';
 const labels=await h.api.groups('hicc');assert.doesNotMatch(JSON.stringify(labels),/private-person@example\.test/);assert.equal(labels.body.candidates.find(row=>row.facultyId===F).displayName,'Name unavailable');
 h.state.profiles.set('duplicate',{...h.state.profiles.get('faculty'),firebaseUid:'duplicate'});
 const ambiguous=await h.api.groups('hicc');assert.equal(ambiguous.body.candidates.some(row=>row.facultyId===F),false);assert.equal(ambiguous.body.groups[0].unresolvedMemberships,2);
 const saved=await h.api.updateMembers('hicc','g1',{expectedVersion:'123.000000001',memberFacultyIds:[H]});assert.equal(saved.status,200);assert.ok(h.state.groups[0].memberUids.includes('faculty'));assert.ok(h.state.groups[0].memberUids.includes('old-orphan'));
});

test('saving available group choices retains existing inactive members instead of silently deleting them',async()=>{
 const h=fixture();h.state.profiles.get('faculty').active=false;
 const saved=await h.api.updateMembers('hicc','g1',{expectedVersion:'123.000000001',memberFacultyIds:[H]});
 assert.equal(saved.status,200);assert.ok(h.state.groups[0].memberUids.includes('faculty'));assert.equal(saved.body.group.members.find(row=>row.facultyId===F).available,false);
});

test('SQL revocation during the directory await prevents the group transaction from writing',async()=>{
 for(const details of [false,true]){
  const h=fixture(),load=h.repository.collaborators,uid=details?'owner':'hicc';
  h.repository.collaborators=async()=>{const rows=await load();h.state.profiles.get(uid).active=false;return rows;};
  const response=details?await h.api.saveGroup('owner','g1',{expectedVersion:'123.000000001',name:'Reviewed group',ownerFacultyId:H,courseIds:['301'],memberFacultyIds:[H]}):await h.api.updateMembers('hicc','g1',{expectedVersion:'123.000000001',memberFacultyIds:[H]});
  assert.equal(response.status,403);assert.equal(h.state.writes,0);assert.deepEqual(h.state.groups[0].memberUids,['hicc','faculty','old-orphan']);
 }
});

test('Owner can read preserved legacy activity without falsely labelling it as effective SQL grants',async()=>{
 const h=fixture();assert.equal((await h.api.legacyAudit('hicc',{})).status,403);
 const result=await h.api.legacyAudit('owner',{});assert.equal(result.status,200);assert.equal(result.body.rows[0].source,'legacy_compatibility');assert.equal(result.body.rows[0].actorName,'Owner, Alex');assert.equal(result.body.rows[0].beforeRole,'faculty');assert.equal(result.body.rows[0].role,'hicc');assert.equal(result.body.rows[0].changedAt,'2026-10-24T12:00:00.000Z');assert.equal(result.body.nextCursor,null);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|changedByEmail/);
});
