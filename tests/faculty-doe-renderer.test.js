'use strict';

const { repositoryPath } = require('../tools/build/frontend-paths');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(repositoryPath(__dirname, '..', 'faculty-admin-doe-renderer.js'), 'utf8');

function makeRenderer() {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.UCVM_FACULTY_DOE_RENDERER.create({
    esc: value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch]),
    number: value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value),
    formatDoe: value => value === null || value === undefined ? 'DOE unavailable' : `${Number(value).toFixed(2)}%`,
    display: value => value === null || value === undefined || value === '' ? '—' : String(value),
    effectiveRoleDoe: role => ({ mapped: role.doeMappedValue ?? null, override: role.doeOverrideValue ?? null, calculated: role.calculatedDoe ?? null, effective: role.effectiveDoe ?? role.doeOverrideValue ?? role.doeMappedValue ?? role.calculatedDoe ?? null, source: role.doeSource || null, reviewReason: role.doeReviewReason || null }),
    groupTeachingAssignments: assignments => assignments.length ? [{ curriculumYear: 'Year 1', sessionCount: assignments.length, courses: [{ courseCode: 'VETM 100', courseName: 'Foundations', assignmentCount: assignments.length, creditedHours: 1, doeTotal: 0, doeStatus: assignments.every(item => item.doeApplicable === false) ? 'not-applicable' : 'complete', assignments }] }] : []
  });
}

test('DOE profile renderer keeps FTE separate from exact contract allocation values', () => {
  const renderer = makeRenderer();
  const html = renderer.renderContractDoe({ academicYear: '2026-27', teachingDoe: 0, allocations: [{ categoryCode: 'research', allocationDoe: 2.5 }], source: 'Faculty Master List' }, { fte: 0, fteSourceReference: 'FTE snapshot' });
  assert.match(html, /FTE:<\/strong> 0\.00/);
  assert.match(html, />Teaching<\/th><td>0\.00%/);
  assert.match(html, />Research<\/th><td>2\.50%/);
  assert.match(html, />Total Contract DOE<\/th><td>2\.50%/);
});

test('DOE rule renderer displays policy provenance and preserves year-stage values', () => {
  const renderer = makeRenderer();
  const html = renderer.renderDoeRuleBook({ academicYear: '2026-27', policyVersionLabel: 'UCVM 2026-27 v1', sourceReference: 'UCVM Workload Guidelines', rules: [{ category: 'VISC', ruleLabel: 'Subject development', academicYearOrStage: '2026-27', rateOrTierPct: '5%', basis: 'per subject', requiredInput: 'confirmed VISC subject', calculationOrNote: 'stage-bound' }] });
  assert.match(html, /Policy: UCVM 2026-27 v1 · Source: UCVM Workload Guidelines/);
  assert.match(html, /2026-27/);
  assert.match(html, />5%<\/td>/);
  assert.match(html, /stage-bound/);
});

test('DOE summary separates assigned teaching from unresolved role inputs and shows calculator evidence', () => {
  const renderer = makeRenderer();
  const html = renderer.renderDoeSummary({ teachingDoe: 1.5, roleDoe: null, teachingLineCount: 1, teachingApplicableCount: 1, teachingRecordedCount: 1, teachingMissingCount: 0, teachingNotApplicableCount: 0, roleLineCount: 1, roleRecordedCount: 0, roleMissingCount: 1, partial: true }, '2026-27', [{ courseCode: 'VETM 100', topic: 'Lab', date: '2026-09-01', sessionType: 'LAB', teachingRole: 'Lab Primary', doeCredit: 1.5, calculatedDoeCredit: 1.5, effectiveDoeCredit: 1.5, doeRuleCode: 'lab_primary', doeSource: 'stored', doeCalculationStatus: 'stored' }], [{ roleType: 'CCC', doeMappedValue: null, calculatedDoe: null, effectiveDoe: null, doeReviewReason: 'ccc-shift-count-required', doeSource: 'missing' }], { teachingDoe: 2, source: 'Faculty snapshot' });
  assert.match(html, /Assigned Teaching DOE/);
  assert.match(html, /Role \/ Service DOE/);
  assert.match(html, /1\.50%/);
  assert.match(html, /Contract \/ Teaching Target DOE/);
  assert.match(html, /Teaching Target Remaining \/ Difference/);
  assert.match(html, /0\.50%/);
  assert.match(html, /Total Effective DOE/);
  assert.match(html, /Role Review/);
  assert.match(html, /DOE unavailable/);
  assert.match(html, /Role evidence/);
  assert.match(html, /CCC shift count required/);
  assert.match(html, /Calculated DOE/);
  assert.match(html, /Effective DOE/);
});

test('DOE summary withholds target differences when the authoritative target is absent', () => {
  const renderer = makeRenderer();
  const html = renderer.renderDoeSummary({ teachingDoe: 1.5, roleDoe: 0.25, teachingLineCount: 1, teachingApplicableCount: 1, teachingRecordedCount: 1, teachingMissingCount: 0, teachingNotApplicableCount: 0, roleLineCount: 1, roleRecordedCount: 1, roleMissingCount: 0, partial: false }, '2026-27', [], [], {});
  assert.match(html, /Contract \/ Teaching Target DOE/);
  assert.match(html, /Target unavailable/);
  assert.match(html, /Total Effective DOE/);
  assert.match(html, /1\.75%/);
  assert.match(html, /Requires an authoritative teaching target/);
});

test('teaching course renderer marks non-calculator session types as not applicable instead of review', () => {
  const renderer = makeRenderer();
  const html = renderer.renderTeachingCourses([{ sessionId: 's-1', courseCode: 'VETM 100', courseName: 'Foundations', topic: 'OSCE', date: '2026-09-01', sessionType: 'OSCE', teachingRole: null, doeCredit: null, calculatedDoeCredit: null, effectiveDoeCredit: null, doeApplicable: false, doeCalculationStatus: 'not-applicable', creditedHours: 1 }]);
  assert.match(html, /Teaching \/ Courses/);
  assert.match(html, /OSCE/);
  assert.match(html, /Not applicable/);
  assert.match(html, /DOE not applicable/);
  assert.doesNotMatch(html, /Needs Review/);
});

test('legacy role candidates are visible without selecting Course Coordinator or HICC', () => {
  const renderer = makeRenderer();
  const html = renderer.renderDoeSummary(
    { teachingDoe: 0, roleDoe: null, teachingLineCount: 0, teachingApplicableCount: 0, teachingRecordedCount: 0, teachingMissingCount: 0, teachingNotApplicableCount: 0, roleLineCount: 1, roleRecordedCount: 0, roleMissingCount: 1, partial: true },
    '2026-27',
    [],
    [{
      roleType: 'Course Coordinator / HICC (legacy ambiguous)',
      courseOrSubjectOrRotation: 'VTMD 420: Sick Animals-Integument, MSK',
      doeMappedValue: null,
      doeOverrideValue: null,
      calculatedDoe: null,
      effectiveDoe: null,
      doeCandidates: { courseCoordinatorDoe: 3.5, hiccDoe: 6 },
      doeCandidateBasis: 'full-year-reference-before-proration',
      doeReviewReason: 'legacy-course-coordinator-hicc-role-must-be-resolved',
      doeSource: 'missing'
    }],
    {}
  );
  assert.match(html, /CC 3\.50% \/ HICC 6\.00%/);
  assert.match(html, /full-year before proration/);
  assert.match(html, /Resolve Course Coordinator vs HICC/);
  assert.doesNotMatch(html, /Effective DOE<\/th><td>3\.50%/);
});
