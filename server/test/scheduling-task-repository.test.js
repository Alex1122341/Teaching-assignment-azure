'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {createSqlSchedulingTaskRepository}=require('../src/data/sql-scheduling-task-repository');
const KEY='A'.repeat(64),EVIDENCE='B'.repeat(64);
test('review adapter binds all command parameters and removes private fields recursively',async()=>{
 const repository=createSqlSchedulingTaskRepository({query:async(sql,params)=>{
  assert.equal(sql,'EXEC paws_api.ReviewSchedulingTask @ActorFirebaseUid=@ActorFirebaseUid,@IssueKey=@IssueKey,@AcademicYear=@AcademicYear,@ExpectedEvidenceVersion=@ExpectedEvidenceVersion,@ExpectedReviewVersion=@ExpectedReviewVersion,@ReviewStatus=@ReviewStatus');
  assert.deepEqual(params,{ActorFirebaseUid:'verified',IssueKey:KEY,AcademicYear:'2026-27',ExpectedEvidenceVersion:EVIDENCE,ExpectedReviewVersion:'0000000000000000',ReviewStatus:'Reviewed'});
  return [{responseJson:JSON.stringify({issueKey:KEY,evidenceVersion:EVIDENCE,reviewVersion:'0000000000000001',type:'afc_unavailable',severity:'Conflict',reviewStatus:'Reviewed',canReview:true,email:'PRIVATE',displayName:{email:'PRIVATE'},relatedSessions:[{id:'session',email:'PRIVATE',courseCode:{ucid:'PRIVATE'}}]})}];
 }});
 const value=await repository.review({actorFirebaseUid:'verified',issueKey:KEY,academicYear:'2026-27',expectedEvidenceVersion:EVIDENCE,expectedReviewVersion:'0000000000000000',reviewStatus:'Reviewed'});
 assert.equal(value.reviewStatus,'Reviewed');assert.equal(value.displayName,null);assert.equal(value.relatedSessions[0].courseCode,null);assert.doesNotMatch(JSON.stringify(value),/PRIVATE|email|ucid/);
});
test('invalid database payload never becomes a successful conflict-free queue',async()=>{
 for(const responseJson of ['broken','{}','{"tasks":[],"total":0}',JSON.stringify({tasks:[],total:0,snapshotVersion:{private:'secret'}})]){
  const repository=createSqlSchedulingTaskRepository({query:async()=>[{responseJson}]});
  await assert.rejects(repository.list({actorFirebaseUid:'verified',query:{academicYear:'2026-27'}}),{code:'INVALID_SCHEDULING_RESPONSE'});
 }
});

test('SQL list adapter accepts only an authoritative zero-row envelope with omitted tasks',async()=>{
 const envelope={total:0,snapshotVersion:KEY,academicYears:[{academicYear:'2026-27'}],filters:{},capabilities:{canReview:true}};
 const list=async value=>createSqlSchedulingTaskRepository({query:async()=>[{responseJson:JSON.stringify(value)}]}).list({actorFirebaseUid:'verified',query:{academicYear:'2026-27'}});
 const result=await list(envelope);
 assert.deepEqual(result.tasks,[]);assert.equal(result.total,0);assert.equal(result.snapshotVersion,KEY);
 assert.deepEqual(result.filters,{faculty:[],courses:[]});assert.equal(result.capabilities.canReview,true);
 assert.deepEqual(await list({...envelope,tasks:[]}),result);
 for(const bad of [
  {...envelope,total:1},{...envelope,total:1,tasks:[]},{...envelope,tasks:null},
  {...envelope,tasks:'[]'},{...envelope,tasks:{}},{...envelope,snapshotVersion:'bad'},
  {...envelope,nextCursor:KEY+':1'},{...envelope,capabilities:undefined},
  {...envelope,capabilities:{canReview:'true'}},{...envelope,filters:[]},
  {...envelope,academicYears:{}}
 ])await assert.rejects(list(bad),{code:'INVALID_SCHEDULING_RESPONSE'});
 // The SQL-specific compatibility rule must not loosen publicQueue for
 // arbitrary upstream callers or bypass per-task public field validation.
 const {publicQueue}=require('../src/data/sql-scheduling-task-repository');
 assert.throws(()=>publicQueue(envelope),{code:'INVALID_SCHEDULING_RESPONSE'});
 const task={issueKey:KEY,evidenceVersion:EVIDENCE,reviewVersion:'0000000000000000',type:'instructor_overlap',severity:'Conflict',reviewStatus:'Unreviewed',canReview:true,sessionId:'synthetic',relatedSessions:[],email:'PRIVATE'};
 const populated=await list({...envelope,tasks:[task],total:1});
 assert.equal(populated.tasks.length,1);assert.equal(populated.tasks[0].sessionId,'synthetic');
 assert.doesNotMatch(JSON.stringify(populated),/PRIVATE|email/);
 await assert.rejects(list({...envelope,tasks:[{...task,issueKey:'bad'}],total:1}),{code:'INVALID_SCHEDULING_RESPONSE'});
});
