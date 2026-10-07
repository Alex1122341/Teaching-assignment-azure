'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDashboardApi } = require('../src/data/dashboard-api');
const { createDashboardFunctions } = require('../src/runtime/swa-dashboard-functions');
const { createSqlDashboardRepository } = require('../src/data/sql-dashboard-repository');

const FACULTY_ID = '11111111-1111-1111-1111-111111111111';
const request = (url, { method = 'GET' } = {}) => ({
  method,
  url: 'https://local' + url,
  headers: { get: name => name.toLowerCase() === 'authorization' ? 'Bearer ok' : null }
});

function harness(profile, overrides = {}) {
  const calls = [];
  const repository = {
    teachingSummary: async args => { calls.push(['teachingSummary', args]); return [{ facultyId: FACULTY_ID, displayName: 'A', assignedTeachingDoe: 1, roleDoe: 2, recordedDoeTotal: 3, doeComplete: true }]; },
    roles: async args => { calls.push(['roles', args]); return [{ facultyId: FACULTY_ID, roleType: 'VISC', doeMappedValue: 1, doeOverrideValue: null }]; },
    doeOverview: async args => { calls.push(['doeOverview', args]); return { academicYear: '2026-27', recordedDoeTotal: 3, partial: false }; },
    ...overrides.repository
  };
  const api = createDashboardApi({
    verifyToken: async () => ({ uid: 'uid-1' }),
    findUser: async () => profile,
    repository
  });
  return { app: createDashboardFunctions({ api }), calls };
}

const admin = { active: true, mustChangePassword: false, baseRole: 'adfa_general', facultyId: null };
const self = { active: true, mustChangePassword: false, baseRole: 'faculty', facultyId: FACULTY_ID };

test('admin aggregate routes return read-only DTOs and bind academic year', async () => {
  const { app, calls } = harness(admin);
  const summary = await app(request('/api/v1/dashboard/teaching-summary?academicYear=2026-27'));
  const roles = await app(request('/api/v1/dashboard/roles?academicYear=2026-27'));
  const doe = await app(request('/api/v1/dashboard/doe-overview?academicYear=2026-27'));
  assert.equal(summary.status, 200);
  assert.equal(summary.jsonBody.teachingSummary[0].recordedDoeTotal, 3);
  assert.equal(roles.status, 200);
  assert.equal(roles.jsonBody.roles[0].roleType, 'VISC');
  assert.equal(doe.status, 200);
  assert.equal(doe.jsonBody.doeOverview.partial, false);
  assert.deepEqual(calls.map(([name, args]) => [name, args.academicYear]), [
    ['teachingSummary', '2026-27'],
    ['roles', '2026-27'],
    ['doeOverview', '2026-27']
  ]);
});

test('self-service and denied roles cannot read cross-faculty aggregate tabs', async () => {
  for (const profile of [self, { ...admin, baseRole: 'viewer' }, { ...admin, baseRole: 'other_office' }]) {
    const { app, calls } = harness(profile);
    for (const path of ['teaching-summary', 'roles', 'doe-overview']) {
      const response = await app(request('/api/v1/dashboard/' + path));
      assert.equal(response.status, 403, path);
      assert.equal(response.jsonBody.error.code, 'ROLE_DENIED', path);
    }
    assert.equal(calls.length, 0);
  }
});

test('non-GET aggregate requests are rejected with Allow GET', async () => {
  const { app } = harness(admin);
  for (const path of ['teaching-summary', 'roles', 'doe-overview']) {
    const response = await app(request('/api/v1/dashboard/' + path, { method: 'POST' }));
    assert.equal(response.status, 405, path);
    assert.equal(response.headers.Allow, 'GET');
  }
});

test('repository teaching summary uses server-side aggregation without detail fanout', async () => {
  const queries = [];
  const repository = createSqlDashboardRepository({ query: async (sql, params) => { queries.push({ sql, params }); return []; } });
  const rows = await repository.teachingSummary({ academicYear: '2026-27' });
  assert.deepEqual(rows, []);
  assert.equal(queries.length, 1);
  assert.equal(queries[0].params.academicYear, '2026-27');
  assert.equal(queries[0].params.doeNa0, 'Quiz/Midterm');
  assert.equal(queries[0].params.doeNa1, 'OSCE');
  assert.match(queries[0].sql, /SessionType[\s\S]*NOT IN \(@doeNa0, @doeNa1\)/i);
  assert.match(queries[0].sql, /GROUP BY/i);
  assert.match(queries[0].sql, /DoeCredit/i);
  assert.match(queries[0].sql, /RoleAssignment/i);
});

test('repository effective role DOE preserves zero and negative overrides', async () => {
  const repository = createSqlDashboardRepository({ query: async () => [
    { roleAssignmentId: 1, facultyId: FACULTY_ID, displayName: 'A', roleType: 'VISC', doeMappedValue: 1.5, doeOverrideValue: 0 },
    { roleAssignmentId: 2, facultyId: FACULTY_ID, displayName: 'A', roleType: 'CCC', doeMappedValue: 1.5, doeOverrideValue: -0.5 }
  ] });
  const roles = await repository.roles({ academicYear: '2026-27' });
  assert.equal(roles[0].effectiveDoe, 0);
  assert.equal(roles[1].effectiveDoe, -0.5);
});

test('repository role calculator fills deterministic VISC gaps but leaves CCC without shifts unresolved', async () => {
  const repository = createSqlDashboardRepository({ query: async () => [
    { roleAssignmentId: 1, facultyId: FACULTY_ID, displayName: 'A', academicYear: '2026-27', roleType: 'VISC', courseOrSubjectOrRotation: 'Subject A', doeMappedValue: null, doeOverrideValue: null },
    { roleAssignmentId: 2, facultyId: FACULTY_ID, displayName: 'A', academicYear: '2026-27', roleType: 'CCC', courseOrSubjectOrRotation: 'CCC shifts', doeMappedValue: null, doeOverrideValue: null }
  ] });
  const roles = await repository.roles({ academicYear: '2026-27' });
  assert.equal(roles[0].effectiveDoe, 5);
  assert.equal(roles[0].doeSource, 'calculator');
  assert.equal(roles[0].doeRuleCode, 'visc_2026_27');
  assert.equal(roles[1].effectiveDoe, null);
  assert.equal(roles[1].doeReviewReason, 'ccc-shift-count-required');
});

test('repository DOE overview returns empty-safe values for null DOE lines', async () => {
  const repository = createSqlDashboardRepository({ query: async () => [{
    teachingLineCount: 2, teachingMissingCount: 1, teachingDoe: 0,
    teachingRecordedCount: 1,
    roleLineCount: 1, roleMissingCount: 1, roleDoe: null, roleRecordedCount: 0,
    overrideCount: 1, overrideZeroCount: 1, overrideNegativeCount: 0
  }] });
  const overview = await repository.doeOverview({ academicYear: '2026-27' });
  assert.equal(overview.partial, true);
  assert.equal(overview.teachingDoe, 0);
  assert.equal(overview.roleDoe, null);
  assert.equal(overview.recordedDoeTotal, 0);
  assert.equal(overview.overrideZeroCount, 1);
});

test('repository DOE overview preserves legitimate zero when no lines exist', async () => {
  const repository = createSqlDashboardRepository({ query: async () => [{
    teachingLineCount: 0, teachingRecordedCount: 0, teachingMissingCount: 0, teachingDoe: null,
    roleLineCount: 0, roleRecordedCount: 0, roleMissingCount: 0, roleDoe: null,
    overrideCount: 0, overrideZeroCount: 0, overrideNegativeCount: 0
  }] });
  const overview = await repository.doeOverview({ academicYear: '2026-27' });
  assert.equal(overview.teachingDoe, 0);
  assert.equal(overview.roleDoe, 0);
  assert.equal(overview.recordedDoeTotal, 0);
  assert.equal(overview.doeStatus, 'none');
});

test('DOE overview keeps contract target coverage separate from assigned teaching and role DOE', async () => {
  const repository = createSqlDashboardRepository({ query: async sql => {
    if (/AS teachingLineCount/.test(sql)) return [{
      teachingLineCount: 4879, teachingMissingCount: 0, teachingNotApplicableCount: 91, teachingDoe: 0, teachingRecordedCount: 4879,
      roleLineCount: 162, roleMissingCount: 78, roleDoe: 12, roleRecordedCount: 84,
      overrideCount: 0, overrideZeroCount: 0, overrideNegativeCount: 0
    }];
    if (/AS activeFacultyCount/.test(sql)) return [{ activeFacultyCount: 120, teachingTargetCount: 112 }];
    if (/FROM paws\.DoeFacultyAllocation/.test(sql)) return [
      { categoryCode: 'research', allocationRowCount: 76, facultyCount: 76 },
      { categoryCode: 'service_admin', allocationRowCount: 111, facultyCount: 111 }
    ];
    return [];
  } });
  const result = await repository.doeOverview({ academicYear: '2026-27' });
  assert.deepEqual(result.contractTargetCoverage, {
    activeFacultyCount: 120,
    teachingTargetCount: 112,
    missingTeachingTargetCount: 8,
    coveragePercent: 93.33333333333333,
    allocationCategories: [
      { categoryCode: 'research', allocationRowCount: 76, facultyCount: 76 },
      { categoryCode: 'service_admin', allocationRowCount: 111, facultyCount: 111 }
    ]
  });
  assert.equal(result.teachingMissingCount, 0);
  assert.equal(result.teachingNotApplicableCount, 91);
  assert.equal(result.roleMissingCount, 78);
  assert.equal(result.recordedDoeTotal, 12);
});
