'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  groupTeachingAssignments,
  teachingDoeEvidence,
  effectiveRoleDoe,
  summarizeDoe,
  formatDoe
} = require('../dashboard-view-model');

test('groups assignments by curriculum year then course and sorts sessions deterministically', () => {
  const groups = groupTeachingAssignments([
    { curriculumYear: 'Year 2', courseCode: 'VTMD 204', courseName: 'Clinical Skills', date: '2026-05-02', startTime: '09:00:00', sessionId: 'b', doeCredit: 0.2, creditedHours: 1 },
    { curriculumYear: 'Year 2', courseCode: 'VTMD 204', courseName: 'Clinical Skills', date: '2026-05-01', startTime: '10:00:00', sessionId: 'a', doeCredit: 0.3, creditedHours: 2 },
    { curriculumYear: 1, courseCode: 'VTMD 101', courseName: 'Foundations', date: '2026-05-01', startTime: '08:00:00', sessionId: 'c', doeCredit: null, creditedHours: null },
    { curriculumYear: '1', courseCode: 'VTMD 101', courseName: 'Foundations', date: '2026-05-02', startTime: '08:00:00', sessionId: 'd', doeCredit: null, creditedHours: null }
  ]);
  assert.deepEqual(groups.map(year => year.curriculumYear), ['Year 1', 'Year 2']);
  assert.equal(groups[1].courses[0].courseCode, 'VTMD 204');
  assert.deepEqual(groups[1].courses[0].assignments.map(row => row.sessionId), ['a', 'b']);
  assert.equal(groups[1].courses[0].assignmentCount, 2);
  assert.equal(groups[1].courses[0].creditedHours, 3);
  assert.equal(groups[1].courses[0].doeTotal, 0.5);
  assert.equal(groups[1].courses[0].recordedDoeCount, 2);
  assert.equal(groups[1].courses[0].resolvedDoeCount, 2);
  assert.equal(groups[1].courses[0].missingDoeCount, 0);
  assert.equal(groups[0].courses[0].doeStatus, 'needs-review');
  assert.equal(groups[0].courses[0].doeTotal, null);
});

test('not-applicable teaching lines do not become false review gaps', () => {
  const evidence = teachingDoeEvidence({ sessionType: 'OSCE', doeApplicable: false, doeCredit: null, doeCalculationStatus: 'not-applicable' });
  assert.equal(evidence.applicable, false);
  const groups = groupTeachingAssignments([
    { curriculumYear: 'Year 4', courseCode: 'VTMD 505', sessionType: 'OSCE', doeApplicable: false, doeCredit: null, effectiveDoeCredit: null, doeCalculationStatus: 'not-applicable', creditedHours: 1.5 }
  ]);
  const course = groups[0].courses[0];
  assert.equal(course.notApplicableDoeCount, 1);
  assert.equal(course.missingDoeCount, 0);
  assert.equal(course.doeTotal, 0);
  assert.equal(course.doeStatus, 'not-applicable');
});

test('calculated teaching DOE is resolved while stored count remains auditable', () => {
  const summary = summarizeDoe({
    teachingAssignments: [
      { doeCredit: 0.3, effectiveDoeCredit: 0.3 },
      { doeCredit: null, calculatedDoeCredit: 0.6, effectiveDoeCredit: 0.6, doeApplicable: true, doeCalculationStatus: 'calculated' },
      { doeCredit: null, effectiveDoeCredit: null, doeApplicable: false, doeCalculationStatus: 'not-applicable' }
    ]
  });
  assert.ok(Math.abs(summary.teachingDoe - 0.9) < 1e-9);
  assert.equal(summary.teachingRecordedCount, 1);
  assert.equal(summary.teachingResolvedCount, 2);
  assert.equal(summary.teachingNotApplicableCount, 1);
  assert.equal(summary.teachingMissingCount, 0);
  assert.equal(summary.partial, false);
});

test('effective role DOE preserves zero and negative overrides and accepts calculator fallback', () => {
  assert.equal(effectiveRoleDoe({ doeMappedValue: 1.5, doeOverrideValue: 0 }).effective, 0);
  assert.equal(effectiveRoleDoe({ doeMappedValue: 1.5, doeOverrideValue: -0.5 }).effective, -0.5);
  assert.equal(effectiveRoleDoe({ doeMappedValue: 1.5, doeOverrideValue: null }).effective, 1.5);
  const calculated = effectiveRoleDoe({ doeMappedValue: null, doeOverrideValue: null, calculatedDoe: 2, effectiveDoe: 2, doeCalculationStatus: 'calculated', doeSource: 'calculator' });
  assert.equal(calculated.effective, 2);
  assert.equal(calculated.source, 'calculator');
});

test('DOE summary uses effective values, excludes not-applicable lines, and reports unresolved reasons', () => {
  const summary = summarizeDoe({
    teachingAssignments: [
      { doeCredit: 0.5, effectiveDoeCredit: 0.5 },
      { doeCredit: null, effectiveDoeCredit: 0.3, calculatedDoeCredit: 0.3, doeApplicable: true },
      { doeCredit: null, effectiveDoeCredit: null, doeApplicable: false }
    ],
    roles: [
      { doeMappedValue: 1, doeOverrideValue: 0 },
      { doeMappedValue: null, doeOverrideValue: null, calculatedDoe: 2, effectiveDoe: 2, doeCalculationStatus: 'calculated' },
      { doeMappedValue: null, doeOverrideValue: null, effectiveDoe: null, doeReviewReason: 'ccc-shift-count-required' }
    ]
  });
  assert.equal(summary.teachingDoe, 0.8);
  assert.equal(summary.roleDoe, 2);
  assert.equal(summary.recordedDoeTotal, 2.8);
  assert.equal(summary.partial, true);
  assert.equal(summary.teachingMissingCount, 0);
  assert.equal(summary.roleMissingCount, 1);
  assert.deepEqual(summary.reviewReasons, ['ccc-shift-count-required']);
});

test('DOE summary preserves unavailable versus legitimate zero', () => {
  const empty = summarizeDoe({});
  assert.equal(empty.teachingDoe, 0);
  assert.equal(empty.roleDoe, 0);
  assert.equal(empty.recordedDoeTotal, 0);
  assert.equal(empty.partial, false);
  const missing = summarizeDoe({ teachingAssignments: [{ doeCredit: null, doeApplicable: true }], roles: [{ doeMappedValue: null, doeOverrideValue: null }] });
  assert.equal(missing.teachingDoe, null);
  assert.equal(missing.roleDoe, null);
  assert.equal(missing.recordedDoeTotal, null);
  assert.equal(missing.partial, true);
});

test('DOE formatting makes missing values explicit and keeps zero visible', () => {
  assert.equal(formatDoe(null), 'DOE unavailable');
  assert.equal(formatDoe(0), '0.00%');
  assert.equal(formatDoe(-0.5), '-0.50%');
  assert.equal(formatDoe(1.25), '1.25%');
});


test('Lookup uses the Calgary date (including the UTC day boundary)', () => {
  const { campusToday } = require('../dashboard-view-model');
  assert.equal(campusToday(new Date('2026-10-19T05:30:00Z')), '2026-10-18');
  assert.equal(campusToday(new Date('2026-10-19T07:30:00Z')), '2026-10-19');
});

test('Lookup counts only active future AFC and shows end of an ongoing leave', () => {
  const { lookupUpcomingAfc } = require('../dashboard-view-model');
  const result = lookupUpcomingAfc([
    { startDate: '2026-10-16', endDate: '2026-10-18', purpose: 'Vacation', active: true },
    { startDate: '2026-10-20', endDate: '2026-10-21', purpose: 'Vacation', active: true },
    { startDate: '2026-11-02', endDate: '2026-11-04', legacyPurpose: 'University Travel', active: true },
    { startDate: '2026-10-10', endDate: '2026-10-30', legacyPurpose: 'RSL', active: true },
    { startDate: '2026-10-01', endDate: '2026-10-26', reasonCode: 'mat', active: false },
    { startDate: '2026-11-09', endDate: '2026-12-01', purpose: 'Study Leave', active: true },
    { startDate: '2026-10-27', endDate: '2026-10-29', purpose: 'Vacation/Other', active: false },
    { startDate: '', endDate: '2026-11-01', purpose: 'Vacation', active: true },
    { startDate: '2026-11-05', endDate: '2026-11-04', purpose: 'Vacation', active: true }
  ], '2026-10-19');
  assert.deepEqual(result, {
    upcomingCount: 3, currentLeaveEnd: '2026-10-30', nextLeaveStart: '2026-11-09'
  });
});

test('Lookup shows the next leave start only when not currently on leave', () => {
  const { lookupUpcomingAfc } = require('../dashboard-view-model');
  const rows = [
    { startDate: '2026-10-10', endDate: '2026-10-18', reasonCode: 'rsl', active: true },
    { startDate: '2026-11-10', endDate: '2026-11-20', legacyPurpose: 'Maternity Leave', active: true },
    { startDate: '2026-10-28', endDate: '2026-10-30', reasonCode: 'medical', active: true },
    { startDate: '2026-10-25', endDate: '2026-10-27', legacyPurpose: 'Vacation/University Travel', active: true }
  ];
  assert.deepEqual(lookupUpcomingAfc(rows, '2026-10-19'), {
    upcomingCount: 3, currentLeaveEnd: null, nextLeaveStart: '2026-10-28'
  });
  assert.deepEqual(lookupUpcomingAfc([], '2026-10-19'), {
    upcomingCount: 0, currentLeaveEnd: null, nextLeaveStart: null
  });
});

test('Lookup DOE uses only authoritative calculated Worksheet remaining, including zero and overage', () => {
  const { lookupRemainingDoe } = require('../dashboard-view-model');
  assert.equal(lookupRemainingDoe({ status: 'calculated', remainingDoe: 0 }), '0.00%');
  assert.equal(lookupRemainingDoe({ status: 'calculated', remainingDoe: 4.5 }), '4.50%');
  assert.equal(lookupRemainingDoe({ status: 'calculated', remainingDoe: -3 }), '-3.00% (over)');
  assert.equal(lookupRemainingDoe({ status: 'needs_review', remainingDoe: 4.5 }), 'Needs Review');
  assert.equal(lookupRemainingDoe({ status: 'calculated', remainingDoe: null }), 'Needs Review');
  assert.equal(lookupRemainingDoe(), 'Needs Review');
});
