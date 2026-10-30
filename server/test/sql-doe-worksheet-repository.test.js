'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSqlDoeWorksheetRepository } = require('../src/data/sql-doe-worksheet-repository');

test('repository through Worksheet preserves CCC evidence warnings even with a matching annual exception',async()=>{
  const {createWorksheetService}=require('../src/doe/doe-worksheet-service');
  for(const withException of [false,true]) {
    const db={async query(sql){
      if(/FROM paws\.Faculty AS f/.test(sql))return [{facultyId:'faculty-1',stream:'clinical'}];
      if(/FROM paws\.DoeFacultyTarget/.test(sql))return [{facultyId:'faculty-1',contractTeachingDoe:20,effectiveTargetDoe:20}];
      if(/FROM paws\.DoeRuleParameter/.test(sql))return Object.entries({splitThreshold:35,splitRatio:.5,highTeachingTraineeCeiling:15,teachingFocusedTraineeCeiling:7.5,rollingAverageYears:3}).map(([name,valueNumber])=>({name,valueNumber}));
      if(/FROM paws\.DoeWorkloadSource/.test(sql))return [{facultyId:'faculty-1',snapshotId:'zero',rawDoe:0,evidenceJson:'{"ownerConfirmedZero":true}'}];
      if(/FROM paws\.RoleAssignment AS r/.test(sql))return [{roleAssignmentId:'ccc',facultyId:'faculty-1',roleType:'CCC',doeMappedValue:11.75,sourceFactsJson:'{"shifts":24,"halfDayDeduction":13}',annualExceptionsJson:JSON.stringify(withException?[{exceptionId:'accepted',category:'rotation',scopeType:'source_entity',scopeKey:'ccc',facultyId:'faculty-1',fixedDoe:11.75,enabled:true}]:[])}];
      return [];
    }};
    const worksheet=await createWorksheetService({repository:createSqlDoeWorksheetRepository(db)}).buildFacultyWorksheet({facultyId:'faculty-1',academicYear:'2026-27'});
    const error=worksheet.errors.find(e=>e.lineId==='ccc');
    assert.equal(worksheet.status,'needs_review');
    assert.equal(worksheet.totals.roleDoe,11.75);
    assert.equal(worksheet.totals.assignedTeachingDoe,11.75);
    assert.equal(error?.blocking,false);
    assert.match(error?.message||'',/ccc half day deduction invalid/);
  }
});

test('verified Master role quantities reach legacy calculations without replacing missing source allocations',async()=>{
  const db={async query(sql){
    if(/FROM paws\.Faculty AS f/.test(sql))return [{facultyId:'faculty-1'}];
    if(/FROM paws\.RoleAssignment AS r/.test(sql))return [
      {roleAssignmentId:'ccc',facultyId:'faculty-1',roleType:'CCC',doeMappedValue:11.75,sourceFactsJson:'{"shifts":24,"halfDayDeduction":0.25}'},
      {roleAssignmentId:'rotation',facultyId:'faculty-1',roleType:'Rotation Participant',doeMappedValue:2,sourceFactsJson:'{"weeks":0.8}'},
      {roleAssignmentId:'missing',facultyId:'faculty-1',roleType:'HICC',scopeText:'VTMD 304: Science of What Goes Wrong 1 (non-infectious dz)',sourceAllocationStatus:'source_missing',doeMappedValue:null,sourceFactsJson:'{"units":3}'}
    ];
    return [];
  }};
  const source=await createSqlDoeWorksheetRepository(db).getFacultyWorksheetSource('faculty-1','2026-27');
  const ccc=source.lines.find(l=>l.lineId==='ccc'),rotation=source.lines.find(l=>l.lineId==='rotation'),missing=source.lines.find(l=>l.lineId==='missing');
  assert.equal(ccc.calculatedDoe,11.75);assert.equal(ccc.resultDoe,11.75);assert.equal(ccc.requiresReview,false);
  assert.equal(rotation.calculatedDoe,2);assert.equal(rotation.resultDoe,2);assert.equal(rotation.requiresReview,false);
  assert.equal(missing.resultDoe,null);assert.equal(missing.reviewReason,'source-allocation-missing');
});

test('DOE worksheet repository joins only current immutable calculation evidence for active assignments', async () => {
  const calls = [];
  const db = { async query(sql, params) {
    calls.push({ sql, params });
    if (/FROM paws\.Faculty AS f/i.test(sql)) return [{ facultyId: 'faculty-1', displayName: 'Test Faculty', stream: 'clinical' }];
    if (/FROM paws\.DoeFacultyTarget/i.test(sql)) return [{ facultyId: 'faculty-1', contractTeachingDoe: 40, overrideDoe: null, effectiveTargetDoe: 40 }];
    if (/FROM paws\.DoePolicyVersion/i.test(sql)) return [{ policyVersionId: 'policy-1', status: 'active', revision: 2 }];
    if (/FROM paws\.DoeRuleParameter/i.test(sql)) return [
      { name: 'splitThreshold', valueNumber: 35 }, { name: 'splitRatio', valueNumber: 0.5 },
      { name: 'highTeachingTraineeCeiling', valueNumber: 15 }, { name: 'teachingFocusedTraineeCeiling', valueNumber: 7.5 },
      { name: 'rollingAverageYears', valueNumber: 3 }
    ];
    if (/FROM paws\.SessionAssignment/i.test(sql)) return [{ sessionAssignmentId: 'session-assignment-1', facultyId: 'faculty-1', doeCredit: 4 }];
    if (/FROM paws\.DoeAssignmentFact AS a/i.test(sql)) return [{
      assignmentFactId: 'assignment-1', facultyId: 'faculty-1', academicYear: '2026-27', category: 'role', roleType: 'Course Coordinator',
      courseCode: 'VTMD 204', sourceEntityType: 'doe_assignment', sourceEntityId: 'assignment-1', active: true,
      resultDoe: 12, calculationStatus: 'calculated', policyVersionId: 'policy-1', ruleId: 'rule-1', ruleKey: 'course-coord',
      referenceSnapshotJson: '{"title":"UCVM Workload Guidelines"}', calculatedAt: '2026-10-07T00:00:00.000Z'
    }];
    return [];
  } };
  const repository = createSqlDoeWorksheetRepository(db);
  const worksheetSource = await repository.getFacultyWorksheetSource('faculty-1', '2026-27');
  assert.equal(worksheetSource.lines[0].assignmentFactId, 'assignment-1');
  assert.equal(worksheetSource.lines[0].resultDoe, 12);
  assert.equal(worksheetSource.lines[0].reference.title, 'UCVM Workload Guidelines');
  assert.equal(worksheetSource.lines[1].status, 'stored');
  assert.equal(worksheetSource.lines[1].legacyResultDoe, 4);
  assert.equal(worksheetSource.lines[1].resultDoe, 4);
  assert.equal(worksheetSource.policyStatus, 'consistent');
  assert.ok(calls.every(call => call.params.academicYear === '2026-27'));
  assert.ok(calls.some(call => /LEFT JOIN paws\.DoeCalculationRecord[\s\S]*a\.Active=1/i.test(call.sql)));
  assert.ok(calls.some(call => /FROM paws\.DoeRuleParameter AS p[\s\S]*r\.Enabled=1 AND r\.ReviewStatus=N'approved'/i.test(call.sql)));
});

test('DOE worksheet list uses one bounded SQL read per source category and includes inactive fixture records', async () => {
  const calls = [];
  const db = { async query(sql, params) {
    calls.push({ sql, params });
    if (/FROM paws\.Faculty AS f/i.test(sql)) return [
      { facultyId: 'active-1', displayName: 'Active', stream: 'clinical' },
      { facultyId: 'inactive-1', displayName: 'Fixture', stream: 'clinical' }
    ];
    return [];
  } };
  const repository = createSqlDoeWorksheetRepository(db);
  const sources = await repository.listFacultyWorksheetSources('2026-27');
  assert.deepEqual(sources.map(row => row.facultyId), ['active-1', 'inactive-1']);
  assert.equal(calls.length, 9);
  assert.ok(calls.some(call => /TOP \(@limit\)/i.test(call.sql)));
  assert.ok(calls.every(call => call.params.academicYear === '2026-27'));
});

test('annual contract reserve parameter reaches the worksheet without accepting unrelated numeric parameters', async () => {
  const db = { async query(sql, params) {
    assert.equal(params.academicYear, '2026-27');
    if (/FROM paws\.Faculty AS f/i.test(sql)) return [{ facultyId: 'faculty-1', displayName: 'Test Faculty', stream: 'clinical' }];
    if (/FROM paws\.DoeRuleParameter/i.test(sql)) return [
      { name: 'contractReserveCap', valueNumber: 1 }, { name: 'rate', valueNumber: 999 }
    ];
    return [];
  } };
  const source = await createSqlDoeWorksheetRepository(db).getFacultyWorksheetSource('faculty-1', '2026-27');
  assert.equal(source.reservePolicy.contractReserveCap, 1);
  assert.equal(source.reservePolicy.rate, undefined);
});

test('historical workload-source fallback preserves absent mode and explicit annual zero end to end', async () => {
  const { createWorksheetService } = require('../src/doe/doe-worksheet-service');
  const legacyPolicy = { splitThreshold: 35, splitRatio: 0.5, highTeachingTraineeCeiling: 15,
    teachingFocusedTraineeCeiling: 7.5, rollingAverageYears: 3 };
  for (const mode of [undefined, 0]) {
    const repository = createSqlDoeWorksheetRepository({ async query(sql) {
      if (/FROM paws\.Faculty AS f/.test(sql)) return [{ facultyId: 'faculty-1', stream: 'clinical' }];
      if (/FROM paws\.DoeFacultyTarget/.test(sql)) return [{ facultyId: 'faculty-1', contractTeachingDoe: 10, effectiveTargetDoe: 10 }];
      if (/FROM paws\.DoeRuleParameter/.test(sql)) return mode === undefined ? [] : [{ name: 'contractReserveCap', valueNumber: 0 }];
      if (/FROM paws\.DoeWorkloadSource/.test(sql)) return [{ parametersJson: JSON.stringify(legacyPolicy),
        facultyId: 'faculty-1', snapshotId: 'snapshot-1', rawDoe: 25 }];
      return [];
    } });
    const source = await repository.getFacultyWorksheetSource('faculty-1', '2025-26');
    assert.equal(Object.hasOwn(source.reservePolicy, 'contractReserveCap'), mode !== undefined);
    const worksheet = await createWorksheetService({ repository }).buildFacultyWorksheet({ facultyId: 'faculty-1', academicYear: '2025-26' });
    assert.equal(worksheet.status, 'calculated');
    assert.equal(worksheet.totals.appliedSupervisionDoe, 10);
    assert.equal(worksheet.totals.remainingDoe, 0);
  }
});

