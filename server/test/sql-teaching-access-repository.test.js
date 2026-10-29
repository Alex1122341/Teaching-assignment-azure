'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSqlTeachingAccessRepository}=require('../src/data/sql-teaching-access-repository');
const row={assignmentId:'30000000-0000-4000-8000-000000000001',responsibilityId:'hicc-course-505',kind:'hicc',facultyId:'10000000-0000-4000-8000-000000000001',academicYear:'2026-27',active:true,startDate:'2026-05-01',endExclusive:'2027-05-01',version:'0000000000000010',definitionVersion:'a'.repeat(64),coursesJson:'[{"courseId":"20000000-0000-4000-8000-000000000505","courseCode":"505"}]',groupsJson:'[]'};
const context={academicYear:'2026-27',asOfDate:'2026-10-27'};
test('teaching authority uses bounded parameterized canonical SQL mappings, not business labels',async()=>{
 let call;const repo=createSqlTeachingAccessRepository({query:async(sql,params)=>{call={sql,params};return [row];}});
 const data=await repo.listAssignments("x'; DELETE secret--",context);
 assert.deepEqual(call.params,{uid:"x'; DELETE secret--",...context});assert.doesNotMatch(call.sql,/DELETE secret/);
 assert.match(call.sql,/TOP\s*\(1001\)/i);assert.match(call.sql,/paws_api\.EffectiveTeachingAssignments/);
 assert.doesNotMatch(call.sql,/\b(?:INSERT|UPDATE|DELETE|MERGE|EXEC|Email|Ucid|Fte|Rank|Doe|CourseOrSubjectOrRotation)\b|SELECT\s+\*/i);
 assert.deepEqual(data[0].courses,JSON.parse(row.coursesJson));assert.deepEqual(data[0].groups,[]);
});
test('own authority rows exclude unrelated fields even if a driver supplies extras',async()=>{
 const repo=createSqlTeachingAccessRepository({query:async()=>[{...row,email:'PRIVATE',ucid:'PRIVATE',notes:'PRIVATE',sourceJson:'PRIVATE',coursesJson:'[{"courseId":"20000000-0000-4000-8000-000000000505","courseCode":"505","email":"PRIVATE"}]'}]});
 const data=await repo.listAssignments('account',context);
 assert.doesNotMatch(JSON.stringify(data),/PRIVATE|email|ucid|notes|sourceJson/);
 assert.equal(data[0].definitionVersion,row.definitionVersion);
});
test('malformed, excessive or unavailable authority data never silently becomes a successful empty list',async()=>{
 for(const result of [null,Array(1001).fill(row),[{...row,coursesJson:'invalid'}],[{...row,groupsJson:'{}'}]]){
  const repo=createSqlTeachingAccessRepository({query:async()=>result});
  await assert.rejects(repo.listAssignments('account',context));
 }
 const missing=createSqlTeachingAccessRepository({query:async()=>{throw Error('missing versioned SQL function');}});
 await assert.rejects(missing.listAssignments('account',context));
});
test('noncanonical year or impossible as-of date is rejected before SQL',async()=>{
 let calls=0;const repo=createSqlTeachingAccessRepository({query:async()=>{calls++;return [];}});
 for(const invalid of [{academicYear:'2026-28',asOfDate:'2026-10-27'},{academicYear:'2026-27',asOfDate:'2026-02-30'}])await assert.rejects(repo.listAssignments('account',invalid));
 assert.equal(calls,0);
});
test('an empty authority snapshot still carries a retained epoch and exposes no null assignee',async()=>{
 const repo=createSqlTeachingAccessRepository({query:async(sql,params)=>{
  assert.match(sql,/TeachingAuthorityState/);assert.match(sql,/OUTER APPLY/);assert.equal(params.uid,'account');
  return [{authorityVersion:'0000000000000100',assignmentId:null,email:'PRIVATE'}];
 }});
 assert.deepEqual(await repo.snapshot('account',context),{authorityVersion:'0000000000000100',assignments:[]});
});
test('a nonempty snapshot validates a single epoch and strips its redundant raw copies',async()=>{
 const repo=createSqlTeachingAccessRepository({query:async()=>[{...row,authorityVersion:'0000000000000100'}]});
 const snapshot=await repo.snapshot('account',context);
 assert.equal(snapshot.assignments.length,1);assert.equal(snapshot.authorityVersion,'0000000000000100');
 assert.equal(snapshot.assignments[0].authorityVersion,undefined);
 for(const rows of [[],[{...row,authorityVersion:null}],[{...row,authorityVersion:'0000000000000100'},{...row,authorityVersion:'0000000000000102'}],[{assignmentId:null,authorityVersion:'0000000000000100'}, {...row,authorityVersion:'0000000000000100'}]]){
  const invalid=createSqlTeachingAccessRepository({query:async()=>rows});await assert.rejects(invalid.snapshot('account',context));
 }
});
