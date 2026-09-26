'use strict';
// Focused Beta authorization-policy tests for the Azure SQL read runtime.
//
// These tests pin the single shared profile policy used by BOTH:
//   GET /api/v1/me
//   GET /api/v1/sessions
//
// Faculty-shaped compatibility set (exactly five roles): faculty, hicc, visc, editor, viewer.
// Every one of them must require FacultyId and must never trigger an unscoped global read.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDataApi, SUPPORTED_ROLES, FACULTY_SHAPED_ROLES, validateAuthorizedProfile } = require('../src/data/data-api');
const { createSwaFunctions } = require('../src/runtime/swa-functions');

const RANGE = { start: '2026-01-01', end: '2026-01-02' };
const FACULTY_SHAPED = ['faculty', 'hicc', 'visc', 'editor', 'viewer'];
const ADMINISTRATIVE = ['owner', 'administrator', 'adfa_general', 'adfa_regular', 'admin'];

// Records every listSessions call so scoping can be asserted precisely.
function harness({ profile, sessions = [] } = {}) {
  const calls = [];
  const api = createDataApi({
    verifyToken: async () => ({ uid: 'u1' }),
    findUser: async () => profile,
    listSessions: async (args) => { calls.push(args); return sessions; }
  });
  return { api, calls, http: createSwaFunctions({ api }) };
}

function request(url, token = 'ok') {
  return { method: 'GET', url: 'https://local' + url, headers: { get: n => (n.toLowerCase() === 'authorization' ? 'Bearer ' + token : null) } };
}

// ---------------------------------------------------------------- role sets

test('supported roles and the faculty-shaped compatibility set are exactly as specified', () => {
  for (const role of [...FACULTY_SHAPED, ...ADMINISTRATIVE]) assert.ok(SUPPORTED_ROLES.has(role), `${role} must be supported`);
  assert.equal(SUPPORTED_ROLES.has('other_office'), false, 'other_office must not be supported');
  assert.deepEqual([...FACULTY_SHAPED_ROLES].sort(), [...FACULTY_SHAPED].sort());
  assert.equal(FACULTY_SHAPED_ROLES.has('administrator'), false, 'administrator is not faculty-shaped');
  assert.equal(FACULTY_SHAPED_ROLES.has('adfa_regular'), false, 'adfa_regular is not faculty-shaped');
});

// ------------------------------------------------------- other_office denial

test('1. other_office is denied by GET /api/v1/me', async () => {
  const out = await harness({ profile: { active: true, baseRole: 'other_office', facultyId: 'f1' } }).http(request('/api/v1/me'));
  assert.equal(out.status, 403);
  assert.equal(out.jsonBody.error.code, 'ROLE_DENIED');
});

test('2. other_office is denied by GET /api/v1/sessions', async () => {
  const h = harness({ profile: { active: true, baseRole: 'other_office', facultyId: 'f1' } });
  const out = await h.http(request('/api/v1/sessions?start=2026-01-01&end=2026-01-02'));
  assert.equal(out.status, 403);
  assert.equal(h.calls.length, 0, 'a denied role must never reach the session repository');
});

test('other_office is denied even when it carries a FacultyId', async () => {
  for (const role of ['other_office', 'Other_Office', 'OTHER_OFFICE']) {
    const h = harness({ profile: { active: true, baseRole: role, facultyId: 'f1' } });
    assert.equal((await h.api.currentUser('ok')).status, 403, role);
    assert.equal((await h.api.sessions('ok', RANGE)).status, 403, role);
    assert.equal(h.calls.length, 0, role);
  }
});

// ------------------------------------------------- unsupported role denial

test('3. an arbitrary unsupported role is denied by GET /api/v1/me', async () => {
  for (const role of ['superuser', 'student', 'guest', 'root', '']) {
    const out = await harness({ profile: { active: true, baseRole: role, facultyId: 'f1' } }).http(request('/api/v1/me'));
    assert.equal(out.status, 403, `role ${JSON.stringify(role)} must be denied`);
  }
});

// ---------------------------------------- faculty-shaped roles require FacultyId

test('4-8. every faculty-shaped role without FacultyId is denied by GET /api/v1/me', async () => {
  for (const role of FACULTY_SHAPED) {
    const out = await harness({ profile: { active: true, baseRole: role, facultyId: null } }).http(request('/api/v1/me'));
    assert.equal(out.status, 403, `${role} without FacultyId must be denied`);
    assert.equal(out.jsonBody.error.code, 'FACULTY_LINK_REQUIRED', role);
  }
});

test('4-8b. every faculty-shaped role without FacultyId is denied by GET /api/v1/sessions', async () => {
  for (const role of FACULTY_SHAPED) {
    const h = harness({ profile: { active: true, baseRole: role, facultyId: null } });
    const out = await h.http(request('/api/v1/sessions?start=2026-01-01&end=2026-01-02'));
    assert.equal(out.status, 403, role);
    assert.equal(h.calls.length, 0, `${role} must never reach the repository without FacultyId`);
  }
});

test('blank, whitespace and undefined FacultyId all count as missing', async () => {
  for (const facultyId of [null, undefined, '', '   ']) {
    const out = await harness({ profile: { active: true, baseRole: 'editor', facultyId } }).http(request('/api/v1/me'));
    assert.equal(out.status, 403, `FacultyId ${JSON.stringify(facultyId)} must be treated as missing`);
  }
});

// -------------------------------------------- editor / viewer with FacultyId

test('9-10. editor and viewer with FacultyId are authorized by GET /api/v1/me', async () => {
  for (const role of ['editor', 'viewer']) {
    const out = await harness({ profile: { active: true, baseRole: role, facultyId: 'f9' } }).http(request('/api/v1/me'));
    assert.equal(out.status, 200, role);
    assert.equal(out.jsonBody.profile.facultyId, 'f9', role);
  }
});

// ------------------------------------- editor / viewer scoping proof (11-13)

test('11-12. editor and viewer with FacultyId pass that FacultyId to listSessions', async () => {
  for (const role of ['editor', 'viewer']) {
    const h = harness({ profile: { active: true, baseRole: role, facultyId: 'f7' }, sessions: [{ id: 's1' }] });
    const out = await h.http(request('/api/v1/sessions?start=2026-01-01&end=2026-01-02'));
    assert.equal(out.status, 200, role);
    assert.equal(h.calls.length, 1, role);
    assert.equal(h.calls[0].facultyId, 'f7', `${role} must be scoped by FacultyId`);
    assert.deepEqual(out.jsonBody.sessions, [{ id: 's1' }]);
  }
});

test('13. editor and viewer can never reach listSessions with a null or undefined facultyId', async () => {
  for (const role of ['editor', 'viewer']) {
    // Missing FacultyId: denied before the repository is touched.
    const denied = harness({ profile: { active: true, baseRole: role, facultyId: null } });
    assert.equal((await denied.api.sessions('ok', RANGE)).status, 403, role);
    assert.equal(denied.calls.length, 0, role);

    // Present FacultyId: scoped, and provably never null/undefined.
    const allowed = harness({ profile: { active: true, baseRole: role, facultyId: 'f3' } });
    assert.equal((await allowed.api.sessions('ok', RANGE)).status, 200, role);
    assert.equal(allowed.calls.length, 1, role);
    assert.notEqual(allowed.calls[0].facultyId, null, role);
    assert.notEqual(allowed.calls[0].facultyId, undefined, role);
    assert.equal(allowed.calls[0].facultyId, 'f3', role);
  }
});

test('no faculty-shaped role can ever produce an unscoped repository call', async () => {
  for (const role of FACULTY_SHAPED) {
    const h = harness({ profile: { active: true, baseRole: role, facultyId: 'f5' } });
    await h.api.sessions('ok', RANGE);
    assert.equal(h.calls.length, 1, role);
    assert.ok(h.calls[0].facultyId, `${role} must always send a truthy FacultyId`);
  }
});

// --------------------------------- faculty / hicc / visc still require FacultyId

test('14. faculty, hicc and visc continue to require FacultyId', async () => {
  for (const role of ['faculty', 'hicc', 'visc']) {
    assert.equal((await harness({ profile: { active: true, baseRole: role, facultyId: null } }).api.sessions('ok', RANGE)).status, 403, role);
    assert.equal((await harness({ profile: { active: true, baseRole: role, facultyId: null } }).api.currentUser('ok')).status, 403, role);

    const scoped = harness({ profile: { active: true, baseRole: role, facultyId: 'f2' } });
    assert.equal((await scoped.api.sessions('ok', RANGE)).status, 200, role);
    assert.equal(scoped.calls[0].facultyId, 'f2', role);
  }
});

// --------------------------------- administrative roles keep global behavior

test('15. supported administrative roles retain global session-read behavior', async () => {
  for (const role of ADMINISTRATIVE) {
    const h = harness({ profile: { active: true, baseRole: role, facultyId: null } });
    assert.equal((await h.api.currentUser('ok')).status, 200, role);
    assert.equal((await h.api.sessions('ok', RANGE)).status, 200, role);
    assert.equal(h.calls.length, 1, role);
    assert.equal(h.calls[0].facultyId, null, `${role} must keep its unscoped global read`);
  }
});

test('administrative roles are never treated as faculty-scoped even when a FacultyId is present', async () => {
  for (const role of ADMINISTRATIVE) {
    const h = harness({ profile: { active: true, baseRole: role, facultyId: 'f1' } });
    assert.equal((await h.api.sessions('ok', RANGE)).status, 200, role);
    assert.equal(h.calls[0].facultyId, null, `${role} must not become Faculty-scoped`);
  }
});

// ------------------------------------------------------ shared policy parity

test('validateAuthorizedProfile is the one shared policy for both endpoints', () => {
  assert.equal(typeof validateAuthorizedProfile, 'function');
  assert.equal(validateAuthorizedProfile(null).status, 403);
  assert.equal(validateAuthorizedProfile({ active: false, baseRole: 'administrator' }).status, 403);
  assert.equal(validateAuthorizedProfile({ active: true, baseRole: 'other_office' }).status, 403);
  assert.equal(validateAuthorizedProfile({ active: true, baseRole: 'nonsense' }).status, 403);
  assert.equal(validateAuthorizedProfile({ active: true, baseRole: 'editor', facultyId: null }).status, 403);
  const ok = validateAuthorizedProfile({ active: true, baseRole: 'editor', facultyId: 'f1' });
  assert.equal(ok.status, undefined);
  assert.equal(ok.role, 'editor');
  assert.equal(ok.facultyId, 'f1');
  const admin = validateAuthorizedProfile({ active: true, baseRole: 'administrator', facultyId: null });
  assert.equal(admin.facultyId, null);
});

test('role matching is case-insensitive and whitespace tolerant', async () => {
  for (const role of ['EDITOR', ' Editor ', 'Viewer']) {
    assert.equal((await harness({ profile: { active: true, baseRole: role, facultyId: 'f1' } }).api.currentUser('ok')).status, 200, role);
  }
  assert.equal((await harness({ profile: { active: true, baseRole: ' OTHER_OFFICE ', facultyId: 'f1' } }).api.currentUser('ok')).status, 403);
});

test('inactive and missing profiles fail closed before any role decision', async () => {
  for (const profile of [null, undefined, { active: false, baseRole: 'administrator' }, { baseRole: 'administrator' }]) {
    const h = harness({ profile });
    assert.equal((await h.api.currentUser('ok')).status, 403);
    assert.equal((await h.api.sessions('ok', RANGE)).status, 403);
    assert.equal(h.calls.length, 0);
  }
});

test('an invalid token is still rejected with 401 before profile lookup', async () => {
  const api = createDataApi({
    verifyToken: async () => { throw new Error('bad token'); },
    findUser: async () => { throw new Error('must not be reached'); },
    listSessions: async () => []
  });
  assert.equal((await api.currentUser('bad')).status, 401);
  assert.equal((await api.sessions('bad', RANGE)).status, 401);
});

test('range validation still precedes authorization on the sessions route', async () => {
  const h = harness({ profile: { active: true, baseRole: 'other_office', facultyId: 'f1' } });
  assert.equal((await h.api.sessions('ok', { start: 'x', end: 'y' })).status, 400);
  assert.equal((await h.api.sessions('ok', { start: '2026-01-01', end: '2026-06-01' })).status, 400, 'range over 93 days');
  assert.equal((await h.api.sessions('ok', { start: '2026-01-02', end: '2026-01-01' })).status, 400, 'reversed range');
});

test('repository failures stay a controlled 503 for an authorized profile', async () => {
  const api = createDataApi({
    verifyToken: async () => ({ uid: 'u1' }),
    findUser: async () => ({ active: true, baseRole: 'editor', facultyId: 'f1' }),
    listSessions: async () => { throw new Error('SQL down'); }
  });
  const out = await api.sessions('ok', RANGE);
  assert.equal(out.status, 503);
  assert.equal(out.body.error.code, 'SQL_UNAVAILABLE');
});

test('the profile projection still omits email and internal fields', async () => {
  const out = await harness({ profile: { firebaseUid: 'u', displayName: 'A', baseRole: 'editor', facultyId: 'f1', active: true, email: 'secret@x', mustChangePassword: true } }).api.currentUser('ok');
  assert.deepEqual(out.body.profile, { displayName: 'A', role: 'editor', facultyId: 'f1' });
});
