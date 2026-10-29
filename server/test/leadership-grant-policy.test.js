'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildLeadershipGrantIntent}=require('../src/access/leadership-grant-policy');
const F='10000000-0000-4000-8000-000000000001',C='20000000-0000-4000-8000-000000000505';
const SOURCE='30000000-0000-4000-8000-000000000001',VSOURCE='30000000-0000-4000-8000-000000000002',A='40000000-0000-4000-8000-000000000001';
function input(){return {
 actor:{firebaseUid:'owner',baseRole:'owner',active:true,mustChangePassword:false,version:'0000000000000001'},
 target:{firebaseUid:'teacher',baseRole:'faculty',facultyId:F,facultyActive:true,active:true,mustChangePassword:false,version:'0000000000000002'},
 academicYear:'2026-27',authorityVersion:'0000000000000003',reason:' Approved scoped appointments ',assignments:[],
 catalog:[{responsibilityId:'course-505',kind:'hicc',active:true,definitionVersion:'a'.repeat(64),courses:[{courseId:C,courseCode:'505'}],groups:[]},
  {responsibilityId:'bovine-lead',kind:'visc',active:true,definitionVersion:'b'.repeat(64),courses:[],groups:[{groupId:'bovine',name:'Bovine'}]}],
 sources:[{sourceRoleAssignmentId:SOURCE,facultyId:F,academicYear:'2026-27',roleType:'Course Coordinator',courseId:C,recordedScope:'VTMD 505',effectiveDate:null,expirationDate:null,hasSchedule:false,periodsJson:null,version:'0000000000000010',scheduleVersion:null,signature:'c'.repeat(64)},
  {sourceRoleAssignmentId:VSOURCE,facultyId:F,academicYear:'2026-27',roleType:'VISC',courseId:null,recordedScope:'Production Animals - Bovine only',hasSchedule:true,periodsJson:'[{"startDate":"2026-05-01","endDate":"2027-04-30"}]',version:'0000000000000011',scheduleVersion:'0000000000000012',signature:'d'.repeat(64)}],
 changes:[{action:'grant',responsibilityId:'course-505',sourceRoleAssignmentId:SOURCE,startDate:'2026-05-01',endDate:'2027-04-30',usesApprovedDefaultDates:true},
  {action:'grant',responsibilityId:'bovine-lead',sourceRoleAssignmentId:VSOURCE,startDate:'2026-05-01',endDate:'2027-04-30',usesApprovedDefaultDates:false}]
};}
const rejects=(value,code='INVALID_LEADERSHIP_CHANGE')=>assert.throws(()=>buildLeadershipGrantIntent(value),error=>error.code===code);
test('two explicit scoped grants preserve Faculty and convert only the assignee inclusive end to exclusive storage',()=>{
 const original=input(),before=JSON.stringify(original),intent=buildLeadershipGrantIntent(original);
 assert.equal(JSON.stringify(original),before);assert.equal(original.target.baseRole,'faculty');
 assert.equal(intent.targetUid,'teacher');assert.equal(intent.changes.length,2);assert.equal(intent.reason,'Approved scoped appointments');
 assert.deepEqual(intent.changes.map(x=>[x.responsibilityId,x.startDate,x.endExclusive,x.usesApprovedDefaultDates]),[
  ['bovine-lead','2026-05-01','2027-05-01',false],['course-505','2026-05-01','2027-05-01',true]]);
 assert.deepEqual(intent.changes.find(x=>x.kind==='hicc').courses,[{courseId:C,courseCode:'505'}]);
 assert.deepEqual(intent.changes.find(x=>x.kind==='visc').groups,[{groupId:'bovine',name:'Bovine'}]);
 assert.equal(intent.changes.find(x=>x.kind==='hicc').recordedScope,'VTMD 505');assert.match(intent.intentHash,/^[a-f0-9]{64}$/);
});
test('only a ready Owner can prepare leadership grants; protected and unlinked targets stay closed',()=>{
 for(const patch of [{baseRole:'administrator'},{baseRole:'developer'},{active:false},{mustChangePassword:true},{version:null}]){const value=input();Object.assign(value.actor,patch);rejects(value,'OWNER_REQUIRED');}
 for(const patch of [{baseRole:'developer'},{baseRole:'owner'},{active:false},{mustChangePassword:true},{facultyActive:false},{facultyId:null},{version:null}]){const value=input();Object.assign(value.target,patch);rejects(value,'TARGET_ACCESS_INELIGIBLE');}
});
test('scope is a canonical definition, never a role label or client supplied course/area override',()=>{
 for(const patch of [{responsibilityId:'unknown'},{courses:[{courseId:C}]},{kind:'visc'},{baseRole:'owner'},{usesApprovedDefaultDates:'true'}]){const value=input();Object.assign(value.changes[0],patch);rejects(value);}
 for(const patch of [{active:false},{courses:[]},{courses:[{courseId:'not-a-course-id',courseCode:'505'}]},{definitionVersion:null},{kind:'visc'}]){const value=input();Object.assign(value.catalog[0],patch);rejects(value);}
 const missingArea=input();missingArea.catalog[1].groups=[];rejects(missingArea);
});
test('business appointment must resolve to the same person, year, role kind and known course',()=>{
 for(const patch of [{facultyId:'10000000-0000-4000-8000-000000000002'},{academicYear:'2025-26'},{roleType:'Other'},{roleType:'VISC'},{courseId:'20000000-0000-4000-8000-000000000999'},{signature:null},{version:null}]){const value=input();Object.assign(value.sources[0],patch);rejects(value);}
});
test('defaults require wholly missing legacy dates and the explicitly approved full-year window',()=>{
 for(const patch of [{usesApprovedDefaultDates:false},{startDate:'2026-06-01'},{endDate:'2027-03-31'}]){const value=input();Object.assign(value.changes[0],patch);rejects(value);}
 for(const patch of [{effectiveDate:'2026-05-01'},{expirationDate:'2027-04-30'},{hasSchedule:true,periodsJson:'[]',scheduleVersion:'0000000000000012'}]){const value=input();Object.assign(value.sources[0],patch);rejects(value);}
 const recorded=input();recorded.changes[1].usesApprovedDefaultDates=true;rejects(recorded);
});
test('recorded inclusive dates allow bounded subperiods but never invalid dates, an uncovered gap or another academic year',()=>{
 const valid=input();Object.assign(valid.changes[1],{startDate:'2026-06-01',endDate:'2026-06-30'});assert.equal(buildLeadershipGrantIntent(valid).changes[0].endExclusive,'2026-07-01');
 for(const patch of [{startDate:'2026-02-30'},{startDate:'2026-04-30'},{endDate:'2027-05-01'},{startDate:'2027-04-30',endDate:'2027-04-29'}]){const value=input();Object.assign(value.changes[1],patch);rejects(value);}
 for(const periods of ['invalid','[]','[{"startDate":null,"endDate":null}]','[{"startDate":"2026-05-01","endDate":"2026-08-31"},{"startDate":"2026-10-01","endDate":"2027-04-30"}]','[{"startDate":"2026-05-01","endDate":"2026-12-31"},{"startDate":"2026-10-01","endDate":"2027-04-30"}]']){const value=input();value.sources[1].periodsJson=periods;rejects(value);}
 const missingVersion=input();missingVersion.sources[1].scheduleVersion=null;rejects(missingVersion);
});
test('source periods that touch on consecutive days cover a contiguous requested window',()=>{
 const value=input();value.sources[1].periodsJson='[{"startDate":"2026-05-01","endDate":"2026-08-31"},{"startDate":"2026-09-01","endDate":"2027-04-30"}]';
 assert.equal(buildLeadershipGrantIntent(value).changes[0].endExclusive,'2027-05-01');
});
test('a corrupt legacy end date cannot silently turn a bounded appointment into an open-ended grant',()=>{
 const value=input();Object.assign(value.sources[1],{hasSchedule:false,scheduleVersion:null,effectiveDate:'2026-05-01',expirationDate:'2026-02-30'});rejects(value);
});
test('overlapping assignees are rejected; touching exclusive windows and unrelated responsibilities are preserved',()=>{
 const value=input();value.assignments=[{assignmentId:A,responsibilityId:'course-505',facultyId:F,academicYear:'2026-27',startDate:'2026-05-01',endExclusive:'2027-05-01',version:'0000000000000020',managed:true}];
 rejects(value,'LEADERSHIP_OVERLAP');value.assignments[0].facultyId='10000000-0000-4000-8000-000000000002';rejects(value,'LEADERSHIP_OVERLAP');
 value.assignments[0].endExclusive='2026-05-01';value.assignments[0].startDate='2026-04-01';assert.equal(buildLeadershipGrantIntent(value).changes.length,2);
 value.assignments[0].responsibilityId='another-course';value.assignments[0].startDate='2026-05-01';value.assignments[0].endExclusive='2027-05-01';assert.equal(buildLeadershipGrantIntent(value).changes.length,2);
});
test('a revoke targets only an exact managed assignee belonging to this person and year; replacement is atomic intent',()=>{
 const value=input();value.assignments=[{assignmentId:A,responsibilityId:'course-505',facultyId:F,academicYear:'2026-27',startDate:'2026-05-01',endExclusive:'2027-05-01',version:'0000000000000020',managed:true}];
 value.changes.push({action:'revoke',assignmentId:A,expectedVersion:'0000000000000020'});
 assert.equal(buildLeadershipGrantIntent(value).changes[0].action,'revoke');
 for(const patch of [{facultyId:'10000000-0000-4000-8000-000000000002'},{academicYear:'2025-26'},{version:'0000000000000021'},{managed:false}]){const invalid=structuredClone(value);Object.assign(invalid.assignments[0],patch);rejects(invalid);}
});
test('duplicate requests and ambiguous catalogs/sources cannot be silently collapsed',()=>{
 const duplicate=input();duplicate.changes.push({...duplicate.changes[0]});rejects(duplicate);
 for(const key of ['catalog','sources']){const value=input();value[key].push({...value[key][0]});rejects(value);}
 for(const patch of [{changes:[]},{changes:Array(21).fill(input().changes[0])},{academicYear:'2026-28'},{authorityVersion:null},{reason:' '}])rejects({...input(),...patch});
});
test('intent hash binds source versions, definitions, authority epoch, actor/target versions and reason, but order is irrelevant',()=>{
 const value=input(),hash=buildLeadershipGrantIntent(value).intentHash;
 const reversed=input();for(const key of ['changes','catalog','sources'])reversed[key].reverse();assert.equal(buildLeadershipGrantIntent(reversed).intentHash,hash);
 for(const mutate of [v=>v.authorityVersion='0000000000000004',v=>v.actor.version='0000000000000004',v=>v.target.version='0000000000000004',v=>v.catalog[0].definitionVersion='e'.repeat(64),v=>v.sources[0].version='0000000000000015',v=>v.sources[1].scheduleVersion='0000000000000015',v=>v.reason='Different justification']){const other=input();mutate(other);assert.notEqual(buildLeadershipGrantIntent(other).intentHash,hash);}
});
test('preview includes only required authority evidence, excluding raw contacts, HR and credit fields',()=>{
 const value=input();value.target.email='PRIVATE';value.catalog[0].notes='PRIVATE';value.sources[0].doeMappedValue='PRIVATE';value.sources[0].email='PRIVATE';
 assert.doesNotMatch(JSON.stringify(buildLeadershipGrantIntent(value)),/PRIVATE|email|doeMappedValue|notes/);
});
