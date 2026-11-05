'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorksheetService } = require('../src/doe/doe-worksheet-service');

const reservePolicy = {
  splitThreshold: 35, splitRatio: 0.5, highTeachingTraineeCeiling: 15,
  teachingFocusedTraineeCeiling: 7.5, rollingAverageYears: 3
};

function source(overrides = {}) {
  return {
    facultyId: 'faculty-1', academicYear: '2026-27', displayName: 'Test Faculty', stream: 'clinical',
    policyStatus: 'consistent', target: { contractTeachingDoe: 40, effectiveTargetDoe: 40 }, reservePolicy,
    lines: [
      { lineId: 'teaching-1', category: 'teaching', resultDoe: 12, status: 'calculated', policyVersionId: 'policy-1' },
      { lineId: 'role-1', category: 'course_coordination', resultDoe: 3, status: 'calculated', policyVersionId: 'policy-1' },
      { lineId: 'supervision-1', category: 'supervision', resultDoe: 8, status: 'calculated', policyVersionId: 'policy-1' },
      { lineId: 'adjustment-1', category: 'adjustment', resultDoe: 2, status: 'calculated', policyVersionId: 'policy-1' }
    ],
    ...overrides
  };
}

test('worksheet groups authoritative lines and applies reserve once for Faculty Detail/List parity', async () => {
  const service = createWorksheetService({ repository: { getFacultyWorksheetSource: async () => source() } });
  const worksheet = await service.buildFacultyWorksheet({ facultyId: 'faculty-1', academicYear: '2026-27' });
  assert.equal(worksheet.status, 'calculated');
  assert.equal(worksheet.sections.scheduledTeaching.subtotal, 12);
  assert.equal(worksheet.sections.roles.subtotal, 3);
  assert.equal(worksheet.sections.supervision.rawSubtotal, 8);
  assert.equal(worksheet.sections.supervision.appliedSubtotal, 8);
  assert.equal(worksheet.totals.assignedTeachingDoe, 25);
  assert.equal(worksheet.totals.remainingDoe, 15);
});

test('worksheet surfaces unavailable lines and target as Needs Review without presenting a misleading total', async () => {
  const service = createWorksheetService({ repository: { getFacultyWorksheetSource: async () => source({ target: { effectiveTargetDoe: null }, lines: [
    { lineId: 'role-1', category: 'course_coordination', resultDoe: null, status: 'needs_review', errorCode: 'COURSE_MAPPING_REQUIRED' }
  ] }) } });
  const worksheet = await service.buildFacultyWorksheet({ facultyId: 'faculty-1', academicYear: '2026-27' });
  assert.equal(worksheet.status, 'needs_review');
  assert.equal(worksheet.totals.assignedTeachingDoe, null);
  assert.equal(worksheet.totals.effectiveTargetDoe, null);
  assert.ok(worksheet.errors.some(row => row.code === 'DOE_TARGET_UNAVAILABLE'));
  assert.ok(worksheet.errors.some(row => row.code === 'COURSE_MAPPING_REQUIRED'));
});

test('DOE List and Faculty Detail share the same worksheet totals and expose specific mapping gaps', async () => {
  const shared = source({ lines: [{
    lineId: 'role-1', sourceEntityType: 'doe_assignment', sourceEntityId: 'assignment-1', assignmentFactId: 'assignment-1',
    category: 'course_coordination', roleType: 'Course Coordinator', courseCode: 'MISSING', resultDoe: null,
    status: 'needs_review', errorCode: 'COURSE_MAPPING_REQUIRED'
  }] });
  const service = createWorksheetService({ repository: {
    getFacultyWorksheetSource: async () => shared,
    listFacultyWorksheetSources: async () => [shared]
  } });
  const detail = await service.buildFacultyWorksheet({ facultyId: 'faculty-1', academicYear: '2026-27' });
  const [listRow] = await service.listFacultyDoe({ academicYear: '2026-27' });
  assert.equal(listRow.status, detail.status);
  assert.equal(listRow.effectiveTargetDoe, detail.totals.effectiveTargetDoe);
  assert.equal(listRow.missingMappingCount, 1);
  assert.ok(listRow.issueCodes.includes('COURSE_MAPPING_REQUIRED'));
  assert.equal(listRow.roleAssignments[0].assignmentFactId, 'assignment-1');
});

test('MASTER worksheet uses contract reserve and applies its signed manual adjustment once afterward', async () => {
  const shared = source({ target: { contractTeachingDoe: 15, effectiveTargetDoe: 7.5 },
    reservePolicy: { ...reservePolicy, contractReserveCap: 1 }, lines: [
      { lineId: 'role', category: 'role', resultDoe: 2.5, status: 'stored' },
      { lineId: 'supervision', category: 'supervision', resultDoe: 24.5, status: 'source_snapshot' },
      { lineId: 'adjustment', sourceEntityType: 'manual_doe_assignment', category: 'adjustment', resultDoe: -3.75, status: 'manual' }
    ] });
  const service = createWorksheetService({ repository: { getFacultyWorksheetSource: async () => shared,
    listFacultyWorksheetSources: async () => [shared] } });
  const detail = await service.buildFacultyWorksheet({ facultyId: 'faculty-1', academicYear: '2026-27' });
  assert.equal(detail.status, 'calculated');
  assert.equal(detail.totals.rawSupervisionDoe, 24.5);
  assert.equal(detail.totals.appliedSupervisionDoe, 7.5);
  assert.equal(detail.totals.assignedTeachingDoe, 6.25);
  assert.equal(detail.totals.remainingDoe, 1.25);
  const [list] = await service.listFacultyDoe({ academicYear: '2026-27' });
  assert.equal(list.assignedTeachingDoe, detail.totals.assignedTeachingDoe);
});

test('2026-27 caps Applied Trainee DOE at the displayed reserve and leaves historical policy behavior intact', async () => {
  const lines = [
    { category: 'teaching', resultDoe: 6.45, status: 'recorded' },
    { category: 'supervision', resultDoe: 17.5, status: 'recorded' }
  ];
  const service = createWorksheetService({ repository: {
    getFacultyWorksheetSource: async (_facultyId, academicYear) => source({
      academicYear, lines, target: { contractTeachingDoe: 15, effectiveTargetDoe: 15 }
    })
  } });
  const request = { facultyId: 'faculty-1', academicYear: '2026-27' };
  const current = await service.buildFacultyWorksheet(request);
  assert.equal(current.reserve.initialTraineeReserve, 7.5);
  assert.equal(current.totals.appliedSupervisionDoe, 7.5);
  assert.equal(current.totals.assignedTeachingDoe, 13.95);
  assert.equal(current.reserve.assignedTeachingReserveWithBalance, null);
  const historical = await service.buildFacultyWorksheet({ ...request, academicYear: '2025-26' });
  assert.equal(historical.totals.appliedSupervisionDoe, 8.55);
});

test('2026-27 applies actual supervision below the reserve even when scheduled teaching exceeds the target', async () => {
  const service = createWorksheetService({ repository: { getFacultyWorksheetSource: async () => source({
    target: { contractTeachingDoe: 30, effectiveTargetDoe: 15 },
    lines: [
      { category: 'teaching', resultDoe: 16, status: 'recorded' },
      { category: 'supervision', resultDoe: 4, status: 'recorded' },
      { category: 'adjustment', sourceEntityType: 'manual_doe_assignment', resultDoe: -1.25, status: 'manual' }
    ]
  }) } });
  const detail = await service.buildFacultyWorksheet({ facultyId: 'faculty-1', academicYear: '2026-27' });
  assert.equal(detail.reserve.initialTraineeReserve, 7.5);
  assert.equal(detail.reserve.initialAssignedTeachingReserve, 7.5);
  assert.equal(detail.reserve.assignedTeachingReserveWithBalance, 11);
  assert.equal(detail.totals.appliedSupervisionDoe, 4);
  assert.equal(detail.totals.assignedTeachingDoe, 18.75);
});
