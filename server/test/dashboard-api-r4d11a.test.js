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

test('repository DOE overview returns empty-safe values for null DOE lines', async () => {
  const repository = createSqlDashboardRepository({ query: async () => [{
    teachingLineCount: 2, teachingMissingCount: 1, teachingDoe: 0,
    roleLineCount: 1, roleMissingCount: 1, roleDoe: 0,
    overrideCount: 1, overrideZeroCount: 1, overrideNegativeCount: 0
  }] });
  const overview = await repository.doeOverview({ academicYear: '2026-27' });
  assert.equal(overview.partial, true);
  assert.equal(overview.teachingDoe, 0);
  assert.equal(overview.roleDoe, 0);
  assert.equal(overview.overrideZeroCount, 1);
});
