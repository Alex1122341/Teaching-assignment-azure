'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {deriveEffectiveTeachingAccess,canUseTeachingResponsibility}=require('../src/access/effective-teaching-access');
const faculty='10000000-0000-4000-8000-000000000001';
const other='10000000-0000-4000-8000-000000000002';
const course='20000000-0000-4000-8000-000000000505';
const profile={firebaseUid:'provided-faculty',baseRole:'faculty',facultyId:faculty,facultyActive:true,active:true,mustChangePassword:false,version:'0000000000000001'};
const hicc={assignmentId:'30000000-0000-4000-8000-000000000001',responsibilityId:'hicc-course-505',kind:'hicc',facultyId:faculty,academicYear:'2026-27',active:true,startDate:'2026-05-01',endExclusive:'2027-05-01',version:'0000000000000010',definitionVersion:'a'.repeat(64),courses:[{courseId:course,courseCode:'505'}],groups:[]};
const visc={...hicc,assignmentId:'30000000-0000-4000-8000-000000000002',responsibilityId:'visc-bovine',kind:'visc',version:'0000000000000020',courses:[],groups:[{groupId:'bovine',name:'Bovine'}]};
const derive=(assignments=[hicc,visc],extra={})=>deriveEffectiveTeachingAccess({profile,assignments,academicYear:'2026-27',asOfDate:'2026-10-27',authorityVersion:'0000000000000100',...extra});

test('one Faculty identity simultaneously retains explicit course HICC and area VISC authority',()=>{
 const result=derive();
 assert.equal(result.baseRole,'faculty');
 assert.equal(profile.baseRole,'faculty');
 assert.deepEqual(result.effectiveRoles,['faculty','hicc','visc']);
 assert.equal(result.responsibilities.length,2);
 assert.equal(canUseTeachingResponsibility(result,{kind:'hicc',academicYear:'2026-27',responsibilityId:'hicc-course-505',courseId:course}),true);
 assert.equal(canUseTeachingResponsibility(result,{kind:'visc',academicYear:'2026-27',responsibilityId:'visc-bovine',groupId:'bovine'}),true);
});
test('course and area boundaries cannot be replaced with a role label or another canonical scope',()=>{
 const result=derive();
 assert.equal(canUseTeachingResponsibility(result,{kind:'hicc',academicYear:'2026-27',responsibilityId:'hicc-course-505',courseId:other}),false);
 assert.equal(canUseTeachingResponsibility(result,{kind:'visc',academicYear:'2026-27',responsibilityId:'visc-bovine',groupId:'equine'}),false);
 assert.equal(canUseTeachingResponsibility(result,{kind:'visc',academicYear:'2026-27',responsibilityId:'visc-other',groupId:'bovine'}),false);
 assert.equal(canUseTeachingResponsibility(result,{kind:'hicc',academicYear:'2026-27',responsibilityId:'hicc-course-505'}),false);
 assert.equal(canUseTeachingResponsibility(result,{kind:'visc',academicYear:'2025-26',responsibilityId:'visc-bovine',groupId:'bovine'}),false);
});
test('exclusive stored end date is presented inclusively and current authority ends on May1',()=>{
 const last=derive(undefined,{asOfDate:'2027-04-30'});
 assert.equal(last.responsibilities.find(r=>r.kind==='visc').endDate,'2027-04-30');
 assert.deepEqual(derive(undefined,{asOfDate:'2027-05-01'}).effectiveRoles,['faculty']);
 assert.deepEqual(derive(undefined,{asOfDate:'2026-04-30'}).effectiveRoles,['faculty']);
 assert.deepEqual(derive(undefined,{academicYear:'2025-26'}).effectiveRoles,['faculty']);
});
test('missing dates, absent canonical scope, another Faculty and inactive definitions never add authority',()=>{
 for(const row of [{...hicc,startDate:null},{...hicc,endExclusive:null},{...hicc,courses:[]},{...visc,groups:[]},{...hicc,facultyId:other},{...hicc,active:false},{...hicc,version:null},{...hicc,definitionVersion:null}]){
  assert.deepEqual(derive([row]).effectiveRoles,['faculty']);
 }
});
test('inactive/password-required/invalid Faculty binding cannot inherit teaching responsibilities',()=>{
 for(const change of [{active:false},{mustChangePassword:true},{mustChangePassword:undefined},{facultyId:null},{facultyActive:false},{version:null}]){
  assert.equal(derive(undefined,{profile:{...profile,...change}}).responsibilities.length,0);
 }
});
test('global/office roles retain their own boundary and cannot acquire self-service leadership from rows',()=>{
 for(const [baseRole,normalized] of [['owner','adfa_general'],['administrator','adfa_regular'],['developer','developer'],['adc','adc'],['lab','lab']]){
  const result=derive(undefined,{profile:{...profile,baseRole}});
  assert.deepEqual(result.effectiveRoles,[normalized]);assert.equal(result.responsibilities.length,0);
 }
});
test('assignment order does not change scope version; reassignment, definition ABA and expiry do',()=>{
 const first=derive();assert.match(first.scopeVersion,/^[a-f0-9]{64}$/);
 assert.equal(derive([visc,hicc]).scopeVersion,first.scopeVersion);
 assert.notEqual(derive([{...hicc,version:'0000000000000030'},visc]).scopeVersion,first.scopeVersion);
 assert.notEqual(derive([{...hicc,definitionVersion:'b'.repeat(64)},visc]).scopeVersion,first.scopeVersion);
 assert.notEqual(derive([hicc]).scopeVersion,first.scopeVersion);
 assert.notEqual(derive(undefined,{asOfDate:'2027-05-01'}).scopeVersion,first.scopeVersion);
});
test('public effective descriptors exclude private contacts, DOE and source payload fields',()=>{
 const result=derive([{...hicc,email:'PRIVATE',ucid:'PRIVATE',doe:123,notes:'PRIVATE',source:{private:'PRIVATE'}}]);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE|email|ucid|"doe"|notes|"source"/);
 assert.deepEqual(result.responsibilities[0].courses,[{courseId:course,courseCode:'505'}]);
});
test('a grant followed by removal never restores an earlier empty-scope context',()=>{
 assert.notEqual(derive([]).scopeVersion,derive([],{authorityVersion:'0000000000000102'}).scopeVersion);
 assert.throws(()=>derive([],{authorityVersion:null}));
});
test('malformed input, impossible dates and excessive authority input fail closed',()=>{
 for(const override of [{academicYear:'2026-28'},{asOfDate:'2026-02-30'},{assignments:{}},{assignments:Array(1001).fill(hicc)}]){
  assert.throws(()=>derive(undefined,override));
 }
 assert.deepEqual(derive([{...hicc,startDate:'2026-02-30'}]).effectiveRoles,['faculty']);
});
