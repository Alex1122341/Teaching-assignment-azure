'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  groupTeachingAssignments,
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
  assert.equal(groups[1].courses[0].missingDoeCount, 0);
  assert.equal(groups[1].sessionCount, 2);
  assert.equal(groups[1].assignmentCount, 2);
  assert.equal(groups[1].creditedHours, 3);
  assert.equal(groups[0].courses[0].doeStatus, 'needs-review');
  assert.equal(groups[0].courses[0].doeTotal, null);
  assert.equal(groups[0].courses[0].assignmentCount, 2);
  assert.equal(groups[0].sessionCount, 2);
  assert.equal(groups[0].creditedHours, 0);
});

test('normalizes numeric and text curriculum years into one canonical group', () => {
  const groups = groupTeachingAssignments([
    { curriculumYear: 1, courseCode: 'A', doeCredit: 0 },
    { curriculumYear: '1', courseCode: 'B', doeCredit: 0 },
    { curriculumYear: 'Year 1', courseCode: 'C', doeCredit: 0 },
    { curriculumYear: 'Year 4', courseCode: 'D', doeCredit: 0 },
    { curriculumYear: 4, courseCode: 'E', doeCredit: 0 },
    { curriculumYear: 'Special', courseCode: 'F', doeCredit: 0 }
  ]);
  assert.equal(groups.filter(group => group.curriculumYear === 'Year 1').length, 1);
  assert.equal(groups.find(group => group.curriculumYear === 'Year 1').courses.length, 3);
  assert.equal(groups.find(group => group.curriculumYear === 'Year 4').courses.length, 2);
  assert.ok(groups.some(group => group.curriculumYear === 'Special'));
});

test('effective role DOE preserves zero and negative overrides and falls back only on null', () => {
  assert.deepEqual(effectiveRoleDoe({ doeMappedValue: 1.5, doeOverrideValue: 0 }), { mapped: 1.5, override: 0, effective: 0, status: 'stored' });
  assert.deepEqual(effectiveRoleDoe({ doeMappedValue: 1.5, doeOverrideValue: -0.5 }), { mapped: 1.5, override: -0.5, effective: -0.5, status: 'stored' });
  assert.deepEqual(effectiveRoleDoe({ doeMappedValue: 1.5, doeOverrideValue: null }), { mapped: 1.5, override: null, effective: 1.5, status: 'stored' });
});

test('DOE summary sums only authoritative non-null values and reports partial evidence', () => {
  const summary = summarizeDoe({
    teachingAssignments: [{ doeCredit: 0.5 }, { doeCredit: null }, { doeCredit: 0 }],
    roles: [
      { doeMappedValue: 1, doeOverrideValue: 0 },
      { doeMappedValue: 2, doeOverrideValue: null },
      { doeMappedValue: null, doeOverrideValue: null }
    ]
  });
  assert.equal(summary.teachingDoe, 0.5);
  assert.equal(summary.roleDoe, 2);
  assert.equal(summary.recordedDoeTotal, 2.5);
  assert.equal(summary.partial, true);
  assert.equal(summary.teachingMissingCount, 1);
  assert.equal(summary.roleMissingCount, 1);
  assert.equal(summary.teachingLineCount, 3);
  assert.equal(summary.teachingRecordedCount, 2);
  assert.equal(summary.roleLineCount, 3);
  assert.equal(summary.roleRecordedCount, 2);
});

test('DOE summary preserves unavailable versus legitimate zero', () => {
  assert.deepEqual(summarizeDoe({}), {
    teachingDoe: 0, roleDoe: 0, recordedDoeTotal: 0,
    teachingLineCount: 0, teachingRecordedCount: 0, teachingMissingCount: 0,
    roleLineCount: 0, roleRecordedCount: 0, roleMissingCount: 0,
    partial: false
  });
  const missing = summarizeDoe({ teachingAssignments: [{ doeCredit: null }], roles: [{ doeMappedValue: null, doeOverrideValue: null }] });
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
