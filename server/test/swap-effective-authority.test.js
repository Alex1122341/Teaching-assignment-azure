'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createSwapApi}=require('../src/swap/swap-api');
const SESSION='10000000-0000-4000-8000-000000000001',ASSIGNMENT='20000000-0000-4000-8000-000000000001';
function fixture(){
 const state={profile:{firebaseUid:'teacher',baseRole:'faculty',facultyId:'30000000-0000-4000-8000-000000000001',active:true,mustChangePassword:false,version:'0000000000000001',teachingAccess:{effectiveRoles:['faculty','hicc','visc'],scopeVersion:'a'.repeat(64)}}};
 const repository={context:async()=>({session:{sessionId:SESSION},candidates:[]})};
 const dependencies={verifyToken:async uid=>({uid}),findUser:async()=>structuredClone(state.profile),repository};
 return {state,repository,dependencies};
}
test('a same-token scope change during the SWAP context read suppresses a formerly authorized response',async()=>{
 const {state,repository,dependencies}=fixture();let calls=0;repository.context=async()=>{calls++;state.profile.teachingAccess.scopeVersion='b'.repeat(64);return {session:{topic:'PRIVATE'}};};
 const result=await createSwapApi(dependencies).context('teacher',{sessionId:SESSION});assert.equal(calls,1);assert.equal(result.status,403);assert.doesNotMatch(JSON.stringify(result),/PRIVATE/);
});
test('account version ABA and disabling the account also invalidate awaited SWAP results',async()=>{
 for(const change of [value=>value.profile.version='0000000000000002',value=>value.profile.active=false]){
  const {state,repository,dependencies}=fixture();repository.context=async()=>{change(state);return {session:{topic:'PRIVATE'}};};
  const result=await createSwapApi(dependencies).context('teacher',{sessionId:SESSION});assert.equal(result.status,403);assert.doesNotMatch(JSON.stringify(result),/PRIVATE/);
 }
});
test('unavailable effective SQL identity produces a bounded503 rather than a private or cached success',async()=>{
 const {dependencies}=fixture();dependencies.findUser=async()=>{throw Error('PRIVATE SQL details');};
 const result=await createSwapApi(dependencies).context('teacher',{sessionId:SESSION});assert.equal(result.status,503);assert.doesNotMatch(JSON.stringify(result),/PRIVATE/);
});
test('ADFA DOE preview rechecks the current account after calculation before returning any totals',async()=>{
 const {state,repository,dependencies}=fixture();state.profile.baseRole='owner';state.profile.teachingAccess={effectiveRoles:['adfa_general'],scopeVersion:null};
 repository.facultyPreviewContext=async()=>({outgoingFacultyId:state.profile.facultyId,incomingFacultyId:null,academicYear:'2026-27',outgoingDisplayName:'Example, Alex',teachingRole:'Primary',persistedDoeCredit:0.4});
 const worksheetService={buildFacultyWorksheet:async()=>{state.profile.active=false;return {status:'calculated',target:{contractTeachingDoe:35},totals:{assignedTeachingDoe:24,effectiveTargetDoe:35,remainingDoe:11}};}};
 const result=await createSwapApi({...dependencies,worksheetService}).facultyPreview('teacher',{sessionId:SESSION,assignmentId:ASSIGNMENT,snapshotToken:'a'.repeat(64)});
 assert.equal(result.status,403);assert.equal(result.body.preview,undefined);
});
