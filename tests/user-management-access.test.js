'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
let createUserManagement;
try{({createUserManagement}=require('../frontend/scripts/user-management'));}catch(error){if(!(error instanceof ReferenceError))throw error;}
const person={uid:'faculty',displayName:'de la Cruz, Mary Jane',role:'faculty',active:true,facultyId:'canonical',version:'0000000000000001',editable:true};

test('collaboration owner picker preserves an existing dual-role Faculty owner and never defaults to another person',()=>{
 const {collaborationOwnerModel}=require('../frontend/scripts/user-management');
 const candidates=[{facultyId:'hicc',displayName:'Gupta, Ashish',role:'hicc',available:true},{facultyId:'faculty',displayName:'Olchowy, Timothy',role:'faculty',available:true}];
 const own=collaborationOwnerModel(candidates,{id:'existing',ownerFacultyId:'faculty',ownerName:'Olchowy, Timothy'});
 assert.equal(own.selectedId,'faculty');assert.deepEqual(own.choices.map(row=>row.facultyId),['hicc','faculty']);
 const fresh=collaborationOwnerModel(candidates,{id:null,ownerFacultyId:null});
 assert.deepEqual(fresh.choices.map(row=>row.facultyId),['hicc']);assert.equal(fresh.selectedId,'');
 const unknown=collaborationOwnerModel(candidates,{id:'legacy',ownerFacultyId:null,ownerName:'Not provided'});
 assert.equal(unknown.selectedId,'');assert.match(unknown.placeholder,/review/i);
 const unavailable=collaborationOwnerModel(candidates,{id:'legacy',ownerFacultyId:'unavailable',ownerName:'Existing, Owner'});
 assert.equal(unavailable.selectedId,'unavailable');assert.equal(unavailable.choices.find(row=>row.facultyId==='unavailable').displayName,'Existing, Owner');
});
test('revoke preview retains its selected assignment dates and scope while grants show approved default provenance',()=>{
 const {leadershipPreviewRows}=require('../frontend/scripts/user-management');
 const catalog={definitions:[{responsibilityId:'course505',kind:'hicc',courses:[{courseCode:'505'}],groups:[]}],assignments:[{assignmentId:'assignment',responsibilityId:'course505',startDate:'2026-05-01',endExclusive:'2027-05-01',usesApprovedDefaultDates:true}]};
 const [row]=leadershipPreviewRows([{action:'revoke',assignmentId:'assignment',responsibilityId:'course505'}],catalog);
 assert.equal(row.startDate,'2026-05-01');assert.equal(row.courses[0].courseCode,'505');assert.equal(row.usesApprovedDefaultDates,true);
});
test('leadership editing binds the selected catalog epoch and retains uncertain operations separately from base-role changes',async()=>{
 let writes=0;const h=fixture({leadershipAccessCatalog:async input=>({target:{uid:input.targetUid,version:person.version},academicYear:input.academicYear,authorityVersion:'0000000000000009',writeEnabled:true,definitions:[],sources:[],assignments:[]}),previewLeadershipAccess:async input=>{h.calls.push(['leadership-preview',input]);return {previewId:'leadership-preview',changes:input.changes,academicYear:input.academicYear,reason:input.reason,writeEnabled:true};},commitLeadershipAccess:async input=>{h.calls.push(['leadership-commit',input]);if(++writes===1)throw Object.assign(Error('Unknown saved outcome'),{code:'LEADERSHIP_CONFIRMATION_REQUIRED'});return {operation:{operationId:input.operationId},replayed:true};}});
 await h.controller.load();h.controller.selectAccount('faculty');await h.controller.loadLeadership('2026-27');
 const changes=[{action:'grant',responsibilityId:'canonical-role',sourceRoleAssignmentId:'source',startDate:'2026-05-01',endDate:'2027-04-30',usesApprovedDefaultDates:true}];
 await h.controller.previewLeadership(changes,'Approved exact scope');
 assert.deepEqual(h.calls.find(row=>row[0]==='leadership-preview')[1],{targetUid:'faculty',academicYear:'2026-27',expectedVersion:person.version,expectedAuthorityVersion:'0000000000000009',changes,reason:'Approved exact scope'});
 await assert.rejects(h.controller.commitLeadership(),/Unknown saved/);assert.equal(h.states.at(-1).uncertain,true);
 assert.throws(()=>h.controller.selectAccount('faculty'),/Confirm/);await assert.rejects(h.controller.preview({active:false},'Other'),/Confirm/);
 await h.controller.commitLeadership();const commands=h.calls.filter(row=>row[0]==='leadership-commit');assert.deepEqual(commands[0][1],commands[1][1]);
 assert.equal(h.states.at(-1).uncertain,false);assert.equal(h.states.at(-1).leadership.saved.replayed,true);assert.equal(h.states.at(-1).selected.role,'faculty');
});
test('leadership catalog results from a prior account or cleared identity are discarded',async()=>{
 let done;const h=fixture({leadershipAccessCatalog:()=>new Promise(resolve=>done=resolve)});await h.controller.load();h.controller.selectAccount('faculty');
 const pending=h.controller.loadLeadership('2026-27');h.controller.clear();done({target:{uid:'faculty'},academicYear:'2026-27'});await pending;
 assert.equal(h.states.at(-1).leadership,null);assert.equal(h.states.at(-1).access,null);
});
test('changing the leadership year discards old choices and late history before a new preview',async()=>{
 let done;const h=fixture({leadershipAccessCatalog:async input=>({target:{uid:input.targetUid,version:person.version},academicYear:input.academicYear,authorityVersion:'0000000000000009',writeEnabled:true,definitions:[],sources:[],assignments:[]}),leadershipAccessHistory:()=>new Promise(resolve=>done=resolve)});
 await h.controller.load();h.controller.selectAccount('faculty');await h.controller.loadLeadership('2026-27');
 const pending=h.controller.leadershipHistory({academicYear:'2026-27',offset:0});h.controller.clearLeadership();
 done({academicYear:'2026-27',rows:[{reason:'Old year'}],total:1,offset:0});await pending;
 assert.equal(h.states.at(-1).leadership,null);assert.equal(h.states.at(-1).leadershipHistory,null);
 await assert.rejects(h.controller.previewLeadership([],'Wrong year'),/Load writable/);
});
function fixture(patch={}){
 assert.equal(typeof createUserManagement,'function');const states=[],calls=[];
 const api={effectiveAccess:async()=>({allowed:true,status:'ready',role:'adfa_general',canManageAccounts:true,canManageGroups:true}),accessCatalog:async()=>({roles:['adfa_general','faculty','hicc'],faculty:[{facultyId:'canonical',displayName:'de la Cruz, Mary Jane'}],writeEnabled:true}),accessAccounts:async query=>{calls.push(['accounts',query]);return {accounts:[person],total:1,offset:0,pageSize:50};},collaborationGroups:async()=>({groups:[],candidates:[],collaborationOnly:true,writeEnabled:true}),accountAccessHistory:async()=>({rows:[],total:0,offset:0}),legacyAccessHistory:async()=>({rows:[],nextCursor:null}),previewAccountAccess:async input=>{calls.push(['preview',input]);return {previewId:'private-preview',target:{uid:input.targetUid,displayName:person.displayName},before:{active:true,role:'faculty'},after:{active:false,role:'faculty'},reason:input.reason};},commitAccountAccess:async input=>{calls.push(['commit',input]);return {profile:{...person,active:false,version:'0000000000000002'},operation:{operationId:input.operationId,reason:'Reviewed'},replayed:false,superseded:false};},...patch};
 return {states,calls,api,controller:createUserManagement({api,onChange:state=>states.push(state),randomId:()=> 'stable-operation'})};
}
test('Owner workflow requires a selected versioned account, reason and server preview before persisted confirmation',async()=>{
 const h=fixture();await h.controller.load();assert.equal(h.states.at(-1).accounts.length,1);assert.equal(h.states.at(-1).catalog.writeEnabled,true);
 await assert.rejects(h.controller.commit(),/preview/i);h.controller.selectAccount('faculty');await assert.rejects(h.controller.preview({active:false},' '),/reason/i);
 await h.controller.preview({active:false},'Reviewed');assert.deepEqual(h.calls.find(c=>c[0]==='preview')[1],{targetUid:'faculty',expectedVersion:'0000000000000001',changes:{active:false},reason:'Reviewed'});assert.equal(h.states.at(-1).saved,null);
 await h.controller.commit();assert.equal(h.states.at(-1).saved.operation.operationId,'stable-operation');assert.equal(h.states.at(-1).selected.active,false);assert.equal(h.states.at(-1).preview,null);
});
test('ambiguous commit retains its exact operation and prevents replacing the intent until readback',async()=>{
 let writes=0;const h=fixture({commitAccountAccess:async input=>{h.calls.push(['commit',input]);if(++writes===1)throw Object.assign(Error('Confirm outcome'),{code:'ACCESS_CONFIRMATION_REQUIRED'});return {profile:{...person,active:false},operation:{operationId:input.operationId},replayed:true};}});
 await h.controller.load();h.controller.selectAccount('faculty');await h.controller.preview({active:false},'Reviewed');await assert.rejects(h.controller.commit(),/Confirm outcome/);
 assert.equal(h.states.at(-1).uncertain,true);assert.throws(()=>h.controller.selectAccount('faculty'),/confirm/i);await assert.rejects(h.controller.preview({active:true},'Other intent'),/confirm/i);
 await h.controller.commit();const commits=h.calls.filter(c=>c[0]==='commit');assert.deepEqual(commits[0][1],commits[1][1]);assert.equal(h.states.at(-1).saved.replayed,true);
});
test('non-Owners never load account or audit directories and stale identity results are discarded',async()=>{
 const h=fixture({effectiveAccess:async()=>({allowed:true,status:'ready',role:'faculty',canManageAccounts:false,canManageGroups:false})});await h.controller.load();assert.equal(h.calls.length,0);assert.deepEqual(h.states.at(-1).accounts,[]);assert.throws(()=>h.controller.selectAccount('faculty'),/Owner/i);
 let done;const old=fixture({accessAccounts:()=>new Promise(resolve=>done=resolve)});const pending=old.controller.load();await Promise.resolve();await Promise.resolve();old.controller.clear();done({accounts:[person],total:1,offset:0});await pending;assert.equal(old.states.at(-1).access,null);assert.deepEqual(old.states.at(-1).accounts,[]);
});
test('HICC receives only scoped collaboration data and an unavailable adapter does not hide Owner SQL access',async()=>{
 const hicc=fixture({effectiveAccess:async()=>({allowed:true,status:'ready',role:'hicc',canManageAccounts:false,canManageGroups:true}),collaborationGroups:async()=>({groups:[{id:'own'}],candidates:[],writeEnabled:true})});await hicc.controller.load();assert.equal(hicc.calls.length,0);assert.equal(hicc.states.at(-1).groups[0].id,'own');
 const owner=fixture({collaborationGroups:async()=>{throw Error('Collaboration unavailable');}});await owner.controller.load();assert.equal(owner.states.at(-1).accounts.length,1);assert.equal(owner.states.at(-1).groupError,'Collaboration unavailable');assert.equal(owner.states.at(-1).error,null);
});
test('account history is paginated across years and legacy activity keeps its separate source',async()=>{
 const h=fixture({accountAccessHistory:async input=>{h.calls.push(['history',input]);return {rows:[{reason:'Reviewed'}],total:51,offset:input.offset};},legacyAccessHistory:async input=>{h.calls.push(['legacy',input]);return {rows:[{source:'legacy_compatibility',action:'account_updated'}],nextCursor:'last'};}});await h.controller.load();await h.controller.history({offset:50});await h.controller.legacyHistory();assert.deepEqual(h.calls.find(c=>c[0]==='history')[1],{offset:50});assert.equal(h.states.at(-1).history.total,51);assert.equal(h.states.at(-1).legacy.rows[0].source,'legacy_compatibility');
});
