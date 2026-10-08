'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSqlDoeWorksheetRepository } = require('../src/data/sql-doe-worksheet-repository');
const { createWorksheetService } = require('../src/doe/doe-worksheet-service');
const { applyTeachingReserve } = require('../src/doe/doe-reserve-service');
const policy = { splitThreshold:35, splitRatio:.5, highTeachingTraineeCeiling:15, teachingFocusedTraineeCeiling:7.5, rollingAverageYears:3 };
function repo({ sessions=[], roles=[] }={}) {
  return createSqlDoeWorksheetRepository({ async query(sql) {
    if (/FROM paws\.Faculty AS f/.test(sql)) return [{facultyId:'f1',displayName:'Example',stream:'clinical'}];
    if (/FROM paws\.SessionAssignment AS sa/.test(sql)) return sessions.map(row=>({facultyId:'f1',...row}));
    if (/FROM paws\.RoleAssignment AS r/.test(sql)) return roles.map(row=>({facultyId:'f1',...row}));
    return [];
  }});
}
test('worksheet legacy teaching uses the same credited-role calculator as Dashboard without overwriting stored values', async()=>{
  const source=await repo({sessions:[
    {sessionAssignmentId:'s1',sessionType:'LEC',teachingRole:'Lecture',creditedHours:2,doeCredit:null},
    {sessionAssignmentId:'s2',sessionType:'LEC',teachingRole:'Lecture',creditedHours:2,doeCredit:0},
    {sessionAssignmentId:'s3',sessionType:'LEC',teachingRole:'Lecture',creditedHours:null,doeCredit:null}
  ]}).getFacultyWorksheetSource('f1','2026-27');
  assert.equal(source.lines[0].resultDoe,.6);
  assert.equal(source.lines[0].calculatedDoe,.6);
  assert.equal(source.lines[1].resultDoe,0);
  assert.equal(source.lines[1].requiresReview,true);
  assert.equal(source.lines[2].resultDoe,null);
  assert.equal(source.lines[2].errorCode,'CREDITED_HOURS_REQUIRED');
});
test('worksheet preserves approved zero and negative role overrides and dated unresolved proration',async()=>{
  const source=await repo({roles:[
    {roleAssignmentId:'r1',roleType:'VISC',academicYear:'2026-27',doeOverrideValue:0,doeMappedValue:5,doeOverrideReason:'Approved'},
    {roleAssignmentId:'r2',roleType:'Special activity',doeOverrideValue:-2,doeOverrideReason:'Approved adjustment'},
    {roleAssignmentId:'r3',roleType:'VISC',academicYear:'2026-27',scopeText:'Confirmed subject',effectiveDate:'2026-08-01',doeMappedValue:null}
  ]}).getFacultyWorksheetSource('f1','2026-27');
  assert.equal(source.lines[0].resultDoe,0);
  assert.equal(source.lines[0].doeSource,'override');
  assert.equal(source.lines[1].resultDoe,-2);
  assert.equal(source.lines[2].resultDoe,null);
  assert.equal(source.lines[2].errorCode,'ROLE_DATE_PRORATION_REVIEW_REQUIRED');
});
test('worksheet review keeps a specific missing-input reason and known unaffected subtotals',async()=>{
  const service=createWorksheetService({repository:{getFacultyWorksheetSource:async()=>({facultyId:'f1',stream:'clinical',target:{effectiveTargetDoe:15},reservePolicy:policy,lines:[
    {lineId:'good',category:'teaching',resultDoe:3,status:'stored'},
    {lineId:'bad',category:'role',resultDoe:null,status:'needs_review',errorCode:'COURSE_UNITS_REQUIRED',reviewReason:'course-units-required'}
  ]})}});
  const result=await service.buildFacultyWorksheet({facultyId:'f1',academicYear:'2026-27'});
  assert.ok(result.errors.some(row=>row.code==='COURSE_UNITS_REQUIRED'));
  assert.equal(result.totals.scheduledTeachingDoe,3);
  assert.equal(result.totals.assignedTeachingDoe,null);
});
test('Guidelines Appendix A reserve golden examples and assigned overage remain exact',()=>{
  for(const [teachingTarget,assignedTeaching,rawSupervision,applied,total,unapplied] of [[15,3,12,12,15,0],[15,4,20,11,15,9],[30,10,17,17,27,0],[30,15,10,10,25,0],[15,20,12,0,20,12]]) {
    const r=applyTeachingReserve({teachingTarget,assignedTeaching,rawSupervision,stream:'clinical',policy});
    assert.equal(r.appliedSupervision,applied); assert.equal(r.totalAppliedTeaching,total); assert.equal(r.unappliedSupervision,unapplied);
  }
});
test('reserve does not assume a stream when it is missing',()=>{
  assert.throws(()=>applyTeachingReserve({teachingTarget:15,assignedTeaching:3,rawSupervision:12,stream:null,policy}),{code:'RESERVE_STREAM_REQUIRED'});
  assert.throws(()=>applyTeachingReserve({teachingTarget:15,assignedTeaching:3,rawSupervision:12,stream:'unknown',policy}),{code:'RESERVE_STREAM_UNRESOLVED'});
});
test('reserve boundary at 35 differs from above 35 and recognizes explicit teaching stream',()=>{
  assert.equal(applyTeachingReserve({teachingTarget:35,assignedTeaching:0,rawSupervision:30,stream:'clinical',policy}).appliedSupervision,30);
  assert.equal(applyTeachingReserve({teachingTarget:35.01,assignedTeaching:0,rawSupervision:30,stream:'clinical',policy}).appliedSupervision,15);
  assert.equal(applyTeachingReserve({teachingTarget:80,assignedTeaching:0,rawSupervision:20,stream:'Teaching-Focused',policy}).appliedSupervision,7.5);
});
