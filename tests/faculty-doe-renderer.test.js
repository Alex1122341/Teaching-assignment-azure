'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'faculty-admin-doe-renderer.js'), 'utf8');

function makeRenderer() {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.UCVM_FACULTY_DOE_RENDERER.create({
    esc: value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch]),
    number: value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value),
    formatDoe: value => value === null || value === undefined ? 'DOE unavailable' : `${Number(value).toFixed(2)}%`,
    display: value => value === null || value === undefined || value === '' ? '—' : String(value),
    effectiveRoleDoe: role => ({ mapped: role.doeMappedValue ?? null, override: role.doeOverrideValue ?? null, effective: role.effectiveDoe ?? role.doeOverrideValue ?? role.doeMappedValue ?? null }),
    groupTeachingAssignments: assignments => assignments.length ? [{ curriculumYear: 'Year 1', courses: [{ courseCode: 'VETM 100', courseName: 'Foundations', assignmentCount: assignments.length, creditedHours: 1, doeTotal: 0, doeStatus: 'complete', assignments }] }] : []
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

test('DOE summary separates assigned teaching from role evidence and does not infer a missing rule value', () => {
  const renderer = makeRenderer();
  const html = renderer.renderDoeSummary({ teachingDoe: 1.5, roleDoe: null, teachingLineCount: 1, teachingRecordedCount: 1, roleLineCount: 1, roleRecordedCount: 0, partial: true }, '2026-27', [{ courseCode: 'VETM 100', topic: 'Lab', date: '2026-09-01', sessionType: 'LAB', teachingRole: 'Primary', doeCredit: 1.5, doeRate: 0.21, doeQuantity: 1, doeUnit: 'hour' }], [{ roleType: 'CCC', doeMappedValue: null }]);
  assert.match(html, /Assigned Teaching DOE/);
  assert.match(html, /Recorded Role \/ Service DOE/);
  assert.match(html, /1\.50%/);
  assert.match(html, /DOE unavailable/);
  assert.match(html, /Role evidence/);
});

test('teaching course renderer labels the source section and never invents an assignment DOE rate', () => {
  const renderer = makeRenderer();
  const html = renderer.renderTeachingCourses([{ sessionId: 's-1', courseCode: 'VETM 100', courseName: 'Foundations', topic: 'OSCE', date: '2026-09-01', sessionType: 'OSCE', teachingRole: null, doeCredit: null, doeRate: null, doeQuantity: null, doeUnit: null, doeStatus: 'Needs Review', creditedHours: 1 }]);
  assert.match(html, /Teaching \/ Courses/);
  assert.match(html, /OSCE/);
  assert.match(html, /DOE unavailable/);
  assert.match(html, /Needs Review/);
});
