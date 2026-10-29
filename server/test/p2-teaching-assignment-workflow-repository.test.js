'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createSqlTeachingAssignmentWorkflowRepository}=require('../src/data/sql-teaching-assignment-workflow-repository');

function harness(responses=[]) { const seen=[];return {seen,repo:createSqlTeachingAssignmentWorkflowRepository({query:async(sql,params)=>{seen.push({sql,params});return responses.shift()||[];}})}; }

test('work queue query enforces active temporal authority and SQL server package scope',async()=>{
  const {repo,seen}=harness();
  await repo.listWorkQueue({actorFirebaseUid:'uid',facultyId:'faculty',role:'hicc',academicYear:'2026-27'});
  assert.match(seen[0].sql,/CanActOnTeachingAssignmentPackage\(p\.TeachingAssignmentPackageId,@actorFirebaseUid,N'hicc'\)=1/i);
  assert.match(seen[0].sql,/CanActOnTeachingAssignmentPackage\(p\.TeachingAssignmentPackageId,@actorFirebaseUid,N'visc'\)=1/i);
  assert.match(seen[0].sql,/ExpirationDate\s+IS\s+NULL/i);
  assert.match(seen[0].sql,/Mountain Standard Time/);
  assert.equal(seen[0].params.actorFirebaseUid,'uid');
  assert.equal(seen[0].params.actionKind,undefined);
  assert.equal(seen[0].params.isAdmin,undefined);
});
test('multi-role work queue uses one scoped union query, never a browser selected action role',async()=>{
 const {repo,seen}=harness([[{packageId:'package',canActAsHicc:true,canActAsVisc:true,canDraft:true,canSubmit:true,canReview:false,canFinalSubmit:false}]]);
 const result=await repo.listWorkQueue({actorFirebaseUid:'uid',facultyId:'faculty',role:'faculty',roles:['hicc','visc'],academicYear:'2026-27'});
 assert.equal(seen.length,1);assert.match(seen[0].sql,/CanActOnTeachingAssignmentPackage\([^)]*,N'hicc'\)/);assert.match(seen[0].sql,/CanActOnTeachingAssignmentPackage\([^)]*,N'visc'\)/);
 assert.equal(result.length,1);assert.deepEqual(result[0].capabilities,{canActAsHicc:true,canActAsVisc:true,canDraft:true,canSubmit:true,canReview:false,canFinalSubmit:false});assert.equal(result[0].canDraft,undefined);
});
test('package data is withheld if its SQL ownership changes while nested private records are read',async()=>{
 const p={packageId:'package',groupId:'first',responsibleHiccResponsibilityId:'course505',workingRevision:1,status:'draft',updatedAtUtc:'2026-10-27T18:00:00Z'};
 const lost=harness([[p],[],[],[],[],[]]);assert.equal(await lost.repo.getPackage({packageId:'package',actorFirebaseUid:'uid',role:'hicc'}),null);
 const changed=harness([[p],[],[],[],[],[{...p,groupId:'another',updatedAtUtc:'2026-10-27T18:01:00Z'}]]);
 await assert.rejects(changed.repo.getPackage({packageId:'package',actorFirebaseUid:'uid',role:'hicc'}),error=>error.number===52113);
});
test('history also rechecks the package after its additional audit query',async()=>{
 const p={packageId:'package',groupId:'first',responsibleHiccResponsibilityId:'course505',workingRevision:1,status:'draft',updatedAtUtc:'2026-10-27T18:00:00Z'};
 const {repo}=harness([[p],[],[],[],[],[p],[{eventType:'PRIVATE'}],[]]);
 assert.equal(await repo.getHistory({packageId:'package',actorFirebaseUid:'uid',role:'hicc'}),null);
});

test('ADC/LAB contribution target query exposes only open current-revision session metadata',async()=>{
  const {repo,seen}=harness();
  await repo.listContributionTargets({academicYear:'2026-27'});
  assert.match(seen[0].sql,/p\.Status IN\s*\(N'draft',N'changes_requested'\)/);
  assert.match(seen[0].sql,/rev\.RevisionNumber=p\.WorkingRevision/);
  assert.match(seen[0].sql,/JOIN paws\.TeachingAssignmentRevisionSession/);
  assert.doesNotMatch(seen[0].sql,/paws\.TeachingAssignmentReview|paws\.TeachingAssignmentFinalizationLine|FacultyDisplayName/);
  assert.deepEqual(seen[0].params,{academicYear:'2026-27'});
});

test('workflow writes call only named procedures with server-owned actor parameters',async()=>{
  const {repo,seen}=harness();
  await repo.review({packageId:'pkg',revisionNumber:4,decision:'push_back',comment:'Revise',actorFirebaseUid:'verified-uid'});
  assert.match(seen[0].sql,/EXEC paws_api\.RecordTeachingAssignmentReview/);
  assert.doesNotMatch(seen[0].sql,/INSERT\s+INTO|UPDATE\s+paws\./i);
  assert.equal(seen[0].params.ActorFirebaseUid,'verified-uid');
  assert.equal(seen[0].params.RevisionNumber,4);
});

test('published Faculty query scopes output by canonical FacultyId and immutable release id',async()=>{
  const {repo,seen}=harness([[{releaseId:'release',academicYear:'2026-27',versionNumber:2}],[]]);
  await repo.getPublishedRelease({academicYear:'2026-27',role:'faculty',facultyId:'canonical-faculty'});
  assert.match(seen[1].sql,/ps\.ReleaseId=@releaseId/);
  assert.match(seen[1].sql,/pi\.FacultyId=@facultyId/);
  assert.equal(seen[1].params.releaseId,'release');
  assert.equal(seen[1].params.facultyId,'canonical-faculty');
});
