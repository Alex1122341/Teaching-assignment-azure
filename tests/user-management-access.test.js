'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
let createUserManagement;
try{({createUserManagement}=require('../frontend/scripts/user-management'));}catch(error){if(!(error instanceof ReferenceError))throw error;}
const person={uid:'faculty',displayName:'de la Cruz, Mary Jane',role:'faculty',active:true,facultyId:'canonical',version:'0000000000000001',editable:true};
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
