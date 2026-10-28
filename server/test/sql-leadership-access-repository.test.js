'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createSqlLeadershipAccessRepository}=require('../src/data/sql-leadership-access-repository');
const OP='40000000-0000-4000-8000-000000000001';

test('SQL GUID receipt casing is canonical while Firebase identity casing is preserved',async()=>{
 const operationId='5d4e1c5a-b696-4cf2-8a1b-24a1548fc71e',previewId='bd44056f-2571-404b-99cb-a406c9e89c1f';
 const stored={operationId:operationId.toUpperCase(),previewId:previewId.toUpperCase(),actorUid:'OwnerMixedCase',targetUid:'FacultyMixedCase'};
 const repo=createSqlLeadershipAccessRepository({query:async()=>[{receiptJson:JSON.stringify(stored)}]});
 const saved=await repo.operation(operationId,stored.actorUid);
 assert.deepEqual(saved,{...stored,operationId,previewId});
});
test('leadership history retains original granted scope instead of current definitions and drops recovery signatures',async()=>{
 let call;const original={operationId:OP,changes:[{action:'grant',responsibilityId:'course505',kind:'hicc',courses:[{courseId:'canonical',courseCode:'505'}],groups:[],sourceSignature:'PRIVATE'}]};
 const repo=createSqlLeadershipAccessRepository({query:async(sql,params)=>{call={sql,params};return [{historyJson:JSON.stringify({total:1,operations:[{operationId:OP,actorName:'Alex Owner',targetName:'Tim Faculty',reason:'Approved revoke',createdAtUtc:'2026-10-27T18:00:00',receipt:{academicYear:'2026-27',changes:[{action:'revoke',assignmentId:OP,responsibilityId:'course505'}],before:[{assignmentId:OP,responsibilityId:'course505',startDate:'2026-05-01',endExclusive:'2027-05-01',grantOperationId:OP,approvedSourceSignature:'PRIVATE'}],after:[]}}],origins:[original]})}];}});
 const result=await repo.history({actorUid:'owner',targetUid:'teacher',academicYear:'2026-27',offset:0});
 assert.match(call.sql,/EXEC paws_api.GetTeachingLeadershipAccessHistory/);assert.deepEqual(call.params,{actorUid:'owner',targetUid:'teacher',academicYear:'2026-27',offset:0});
 assert.equal(result.rows[0].before[0].courses[0].courseCode,'505');assert.equal(result.rows[0].before[0].endDate,'2027-04-30');assert.deepEqual(result.rows[0].after,[]);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|grantOperationId|approvedSource|sourceSignature/);
});
test('Owner snapshot uses only the explicit parameterized SQL entry point and strips extra source/profile fields',async()=>{
 let call;const repo=createSqlLeadershipAccessRepository({query:async(sql,params)=>{call={sql,params};return [{snapshotJson:JSON.stringify({target:{firebaseUid:'teacher',baseRole:'faculty',version:'0000000000000001',email:'PRIVATE'},authorityVersion:'0000000000000010',catalog:[],sources:[{sourceRoleAssignmentId:OP,recordedScope:'505',email:'PRIVATE',doe:'PRIVATE'}],assignments:[],private:'PRIVATE'})}];}});
 const result=await repo.snapshot('teacher','2026-27','owner');assert.deepEqual(call.params,{actorUid:'owner',targetUid:'teacher',academicYear:'2026-27'});
 assert.match(call.sql,/EXEC paws_api.GetTeachingLeadershipAccessSnapshot/);assert.doesNotMatch(call.sql,/\bFROM\s+paws\./i);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|email|"doe"/);
});
test('invalid or excessive SQL snapshots never become an empty successful grant catalog',async()=>{
 for(const value of [null,{}, {target:null,authorityVersion:'0000000000000010',catalog:[],sources:[],assignments:[]},{target:{},authorityVersion:null,catalog:[],sources:[],assignments:[]},{target:{},authorityVersion:'0000000000000010',catalog:Array(1001).fill({}),sources:[],assignments:[] }]){
  const repo=createSqlLeadershipAccessRepository({query:async()=>[{snapshotJson:JSON.stringify(value)}]});await assert.rejects(repo.snapshot('teacher','2026-27','owner'));
 }
});
test('command binds the complete server intent without SQL interpolation and demands a persisted receipt',async()=>{
 let call;const saved={operationId:OP,actorUid:'owner',targetUid:'teacher',private:'PRIVATE'};
 const repo=createSqlLeadershipAccessRepository({query:async(sql,params)=>{call={sql,params};return [{receiptJson:JSON.stringify(saved)}];}});
 const intent={actorUid:'owner',actorVersion:'0000000000000001',targetUid:'teacher',targetVersion:'0000000000000002',academicYear:'2026-27',authorityVersion:'0000000000000010',changes:[{action:'revoke',assignmentId:OP,expectedVersion:'0000000000000012',responsibilityId:'canonical'}],reason:"Reason '; DROP secret --",intentHash:'a'.repeat(64),operationId:OP,previewId:OP};
 const result=await repo.commit(intent);assert.equal(result.operationId,OP);assert.doesNotMatch(JSON.stringify(result),/PRIVATE/);
 assert.match(call.sql,/EXEC paws_api.SetTeachingLeadershipAccess/);assert.doesNotMatch(call.sql,/DROP secret/);assert.equal(call.params.reason,intent.reason);assert.equal(call.params.changesJson,JSON.stringify(intent.changes));
 assert.equal(call.params.authorityVersion,intent.authorityVersion);assert.equal(call.params.targetVersion,intent.targetVersion);
 const empty=createSqlLeadershipAccessRepository({query:async()=>[]});await assert.rejects(empty.commit(intent));
});
test('durable operation reads remain Owner-bound and absent operations return null',async()=>{
 let calls=0;const repo=createSqlLeadershipAccessRepository({query:async(sql,params)=>{calls++;assert.match(sql,/GetTeachingLeadershipAccessOperation/);assert.deepEqual(params,{actorUid:'owner',operationId:OP});return [];}});
 assert.equal(await repo.operation(OP,'owner'),null);
 await assert.rejects(repo.snapshot('teacher','2026-28','owner'));await assert.rejects(repo.snapshot('teacher','2026-27',null));assert.equal(calls,1);
});
