'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createEffectiveTeachingIdentity}=require('../src/access/effective-teaching-identity');
const F='10000000-0000-4000-8000-000000000001';
const profile={firebaseUid:'teacher',baseRole:'faculty',facultyId:F,facultyActive:true,active:true,mustChangePassword:false,version:'0000000000000001'};
const hicc={assignmentId:'30000000-0000-4000-8000-000000000001',responsibilityId:'hicc505',kind:'hicc',facultyId:F,academicYear:'2026-27',active:true,startDate:'2026-05-01',endExclusive:'2027-05-01',version:'0000000000000010',definitionVersion:'a'.repeat(64),courses:[{courseId:'20000000-0000-4000-8000-000000000505',courseCode:'505'}],groups:[]};
const visc={...hicc,assignmentId:'30000000-0000-4000-8000-000000000002',responsibilityId:'viscbovine',kind:'visc',courses:[],groups:[{groupId:'bovine',name:'Bovine'}]};
test('normal identity adds only trusted effective responsibilities and preserves its original Faculty base role',async()=>{
 const reads=[];const read=createEffectiveTeachingIdentity({readProfile:async(uid,timing)=>{assert.equal(uid,'teacher');assert.equal(timing,'metric-context');return {...profile,teachingAccess:{effectiveRoles:['owner']}};},repository:{snapshot:async(uid,context)=>{reads.push([uid,context]);return {authorityVersion:'0000000000000100',assignments:[hicc,visc]};}},clock:()=>Date.parse('2026-10-27T18:00:00Z')});
 const user=await read('teacher','metric-context');assert.equal(user.baseRole,'faculty');assert.deepEqual(user.teachingAccess.effectiveRoles,['faculty','hicc','visc']);
 assert.deepEqual(reads,[['teacher',{academicYear:'2026-27',asOfDate:'2026-10-27'}]]);assert.equal(profile.teachingAccess,undefined);
});
test('Calgary May1 and a refreshed epoch revoke prior-year roles without a new Auth token',async()=>{
 let now=Date.parse('2027-05-01T05:59:59Z'),epoch='0000000000000100';const calls=[];
 const read=createEffectiveTeachingIdentity({readProfile:async()=>profile,repository:{snapshot:async(uid,context)=>{calls.push(context);return {authorityVersion:epoch,assignments:[hicc,visc]};}},clock:()=>now});
 const before=await read('teacher');assert.deepEqual(before.teachingAccess.effectiveRoles,['faculty','hicc','visc']);
 now+=1000;epoch='0000000000000101';const after=await read('teacher');assert.deepEqual(after.teachingAccess.effectiveRoles,['faculty']);
 assert.deepEqual(calls.map(row=>[row.academicYear,row.asOfDate]),[['2026-27','2027-04-30'],['2027-28','2027-05-01']]);assert.notEqual(before.teachingAccess.scopeVersion,after.teachingAccess.scopeVersion);
});
test('unprovisioned and global/office accounts do not acquire teaching authority or query other faculty mappings',async()=>{
 let calls=0;for(const value of [null,{...profile,baseRole:'owner'},{...profile,baseRole:'developer'},{...profile,baseRole:'administrator'},{...profile,baseRole:'adc'}]){
  const read=createEffectiveTeachingIdentity({readProfile:async()=>value,repository:{snapshot:async()=>{calls++;throw Error('Should not query');}}});
  const user=await read('teacher');if(!value)assert.equal(user,null);else{assert.equal(user.baseRole,value.baseRole);assert.equal(user.teachingAccess.responsibilities.length,0);assert.equal(user.teachingAccess.effectiveRoles.includes('hicc'),false);}
 }assert.equal(calls,0);
});
test('missing SQL authority never falls back to a cached base-profile success; revoked profiles cannot inherit roles',async()=>{
 const unavailable=createEffectiveTeachingIdentity({readProfile:async()=>profile,repository:{snapshot:async()=>{throw Error('Missing SQL061');}}});await assert.rejects(unavailable('teacher'),/Missing SQL061/);
 for(const patch of [{active:false},{facultyActive:false},{mustChangePassword:true},{version:null}]){
  const read=createEffectiveTeachingIdentity({readProfile:async()=>({...profile,...patch}),repository:{snapshot:async()=>({authorityVersion:'0000000000000100',assignments:[hicc,visc]})},clock:()=>Date.parse('2026-10-27T18:00:00Z')});
  assert.equal((await read('teacher')).teachingAccess.responsibilities.length,0);
 }
});
