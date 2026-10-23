'use strict';
// Testing persona route coverage (PR #125 inspection I1–I3).
//
// Developer Support (Production) keeps its original route list. Testing personas additionally reach the
// newer workflows, with these rules:
//   * reads are allowed;
//   * writes that run on the audited request transaction are allowed, recorded under the real operator,
//     and marked non-undoable (their tables are not captured by migrations 033-035);
//   * import writes (separate SQL pool) are refused: run them as yourself.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSupportService, routeAccess, TESTING_PERSONA_ROUTES } = require('../src/support/support-service');

const USERS = {
  dev: { firebaseUid: 'dev', displayName: 'Dev', baseRole: 'developer', active: true, mustChangePassword: false },
  admin: { firebaseUid: 'admin', displayName: 'Admin', baseRole: 'administrator', active: true, mustChangePassword: false },
  fac: { firebaseUid: 'fac', displayName: 'Faculty', baseRole: 'faculty', active: true, mustChangePassword: false, facultyId: 'f1' },
  hicc: { firebaseUid: 'hicc', displayName: 'HICC', baseRole: 'hicc', active: true, mustChangePassword: false, facultyId: 'f2' },
  visc: { firebaseUid: 'visc', displayName: 'VISC', baseRole: 'visc', active: true, mustChangePassword: false, facultyId: 'f3' }
};
const CONTEXT_ID = '6a1f3e2d-1c4b-4a5e-8f7d-9e0a1b2c3d4e';
const OP_ID = '0b9c8d7e-6f5a-4b3c-9d2e-1f0a9b8c7d6e';
const PROD = { name: 'production', testing: false };
const TEST = { name: 'testing', testing: true };

function harness(environment, { target = 'fac', actor = 'admin', operationRoute = 'POST /api/v1/sessions/x' } = {}) {
  const queries = [];
  const db = {
    async query(text, params = {}) {
      queries.push({ text, params });
      if (/FROM paws\.UserProfile WHERE Active=1/.test(text)) return Object.values(USERS).map(u => ({ uid: u.firebaseUid, name: u.displayName, role: u.baseRole }));
      if (/FROM paws\.SupportOperation o/.test(text)) return [{ id: OP_ID, route: operationRoute, createdAtUtc: 'now', undoneAtUtc: null, reason: 'r', targetName: 'Faculty', targetRole: 'faculty', changeCount: 1 }];
      if (/SELECT Route AS route FROM paws\.SupportOperation/.test(text)) return params.id === OP_ID ? [{ route: operationRoute }] : [];
      if (/FROM paws\.SupportContext c WHERE/.test(text)) return params.id === CONTEXT_ID && params.uid === actor ? [{ id: CONTEXT_ID, targetUid: target, reason: 'r', expiresAtUtc: '2026-10-20T21:00:00Z' }] : [];
      return [];
    },
    async transaction(callback) { return callback(); }
  };
  const support = createSupportService({ db, environment, verifyToken: async token => ({ uid: token }), findUser: async uid => USERS[uid] || null });
  // The downstream API resolves identity only through support.verify, exactly like the runtime.
  const seen = [];
  const next = async request => {
    const decoded = await support.verify(String(request.headers.get('authorization')).slice(7));
    seen.push({ uid: decoded.uid, path: new URL(request.url).pathname, method: request.method });
    return { status: 200, jsonBody: { ok: true } };
  };
  const req = (uid, path, { method = 'GET', body, context = CONTEXT_ID } = {}) => new Request('http://x' + path, {
    method, headers: { authorization: 'Bearer ' + uid, 'content-type': 'application/json', ...(context ? { 'x-paws-support-context': context } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { support, req, next, queries, seen };
}

const NEW_READS = [
  '/api/v1/faculty/11111111-1111-4111-8111-111111111111/availability', '/api/v1/ccc-schedule',
  '/api/v1/calendar-activities', '/api/v1/calendar-activities/capabilities',
  '/api/v1/calendar-activity-imports/4b0e9f1c-2d3a-4c5b-8e6f-7a8b9c0d1e2f',
  '/api/v1/afc-forms', '/api/v1/afc-forms/capabilities', '/api/v1/afc-forms/4b0e9f1c-2d3a-4c5b-8e6f-7a8b9c0d1e2f/document',
  '/api/v1/ccc-replacements/capabilities', '/api/v1/ccc-replacements/template', '/api/v1/ccc-replacements/4b0e9f1c-2d3a-4c5b-8e6f-7a8b9c0d1e2f',
  '/api/v1/change-history', '/api/v1/change-history/page', '/api/v1/change-history/export',
  '/api/v1/scheduling-tasks'
];

test('latest read panels retain real persona scope and stay GET-only in Testing', async () => {
  const { createFacultyAvailabilityApi } = require('../src/availability/faculty-availability-api');
  const { createCccScheduleApi } = require('../src/ccc/ccc-schedule-api');
  const ids = { fac: '11111111-1111-4111-8111-111111111111', hicc: '22222222-2222-4222-8222-222222222222', visc: '33333333-3333-4333-8333-333333333333' };
  for (const target of ['fac', 'hicc', 'visc', 'admin', 'dev']) {
    const { support, req } = harness(TEST, { target, actor: target === 'dev' ? 'dev' : 'admin' });
    const actor = target === 'dev' ? 'dev' : 'admin', queried = [];
    const dependencies = { verifyToken: support.verify, findUser: async uid => ({ ...USERS[uid], facultyId: ids[uid] }) };
    const availability = createFacultyAvailabilityApi({ ...dependencies, repository: { async list(params) {
      queried.push(params.actorFirebaseUid);
      return { items: [], total: 0, nextCursor: null, today: '2026-10-22', coverage: { undatedSessions: 0, undatedRoles: 0 } };
    } } });
    const ccc = createCccScheduleApi({ ...dependencies, repository: { async list(params) { queried.push(params.actorFirebaseUid); return { entries: [] }; } } });
    const next = async request => {
      const pathname = new URL(request.url).pathname;
      const value = pathname === '/api/v1/ccc-schedule'
        ? await ccc.list(actor, { academicYear: '2026-27' })
        : await availability.list(actor, pathname.split('/')[4]);
      return { status: value.status, jsonBody: value.body };
    };
    assert.equal((await support.handle(req(actor, '/api/v1/faculty/' + (ids[target] || ids.fac) + '/availability'), next)).status, 200, target + ' own availability');
    const cross = await support.handle(req(actor, '/api/v1/faculty/ffffffff-ffff-4fff-8fff-ffffffffffff/availability'), next);
    assert.equal(cross.status, ids[target] ? 403 : 200, target + ' must keep original Faculty scope');
    assert.equal((await support.handle(req(actor, '/api/v1/ccc-schedule'), next)).status, 200, target + ' CCC schedule');
    assert.ok(queried.every(uid => uid === target), 'domain repositories receive the persona, never the operator');
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      for (const pathname of ['/api/v1/ccc-schedule', '/api/v1/faculty/' + ids.fac + '/availability']) {
        assert.equal((await support.handle(req(actor, pathname, { method }), () => { throw Error('write reached domain'); })).jsonBody.error.code, 'SUPPORT_ROUTE_DENIED');
      }
    }
    for (const pathname of ['/api/v1/ccc-schedule/export', '/api/v1/faculty/' + ids.fac + '/availability/write']) {
      assert.equal((await support.handle(req(actor, pathname), next)).jsonBody.error.code, 'SUPPORT_ROUTE_DENIED');
    }
  }
});
const NEW_RECORDED_WRITES = [
  '/api/v1/calendar-activities/4b0e9f1c-2d3a-4c5b-8e6f-7a8b9c0d1e2f/time-evidence',
  '/api/v1/afc-forms',
  '/api/v1/scheduling-tasks/4b0e9f1c-2d3a-4c5b-8e6f-7a8b9c0d1e2f/review'
];
const IMPORT_WRITES = [
  '/api/v1/calendar-activity-imports',
  '/api/v1/calendar-activity-imports/4b0e9f1c-2d3a-4c5b-8e6f-7a8b9c0d1e2f/preview',
  '/api/v1/calendar-activity-imports/4b0e9f1c-2d3a-4c5b-8e6f-7a8b9c0d1e2f/commit',
  '/api/v1/ccc-replacements',
  '/api/v1/ccc-replacements/4b0e9f1c-2d3a-4c5b-8e6f-7a8b9c0d1e2f/preview',
  '/api/v1/ccc-replacements/4b0e9f1c-2d3a-4c5b-8e6f-7a8b9c0d1e2f/commit'
];

test('Production Developer Support route list is unchanged: newer workflows stay denied', async () => {
  const { support, req, next, seen } = harness(PROD, { actor: 'dev' });
  for (const path of NEW_READS) {
    const result = await support.handle(req('dev', path), next);
    assert.equal(result.status, 403, path);
    assert.equal(result.jsonBody.error.code, 'SUPPORT_ROUTE_DENIED', path);
  }
  for (const path of [...NEW_RECORDED_WRITES, ...IMPORT_WRITES]) {
    const result = await support.handle(req('dev', path, { method: 'POST', body: {} }), next);
    assert.equal(result.jsonBody.error.code, 'SUPPORT_ROUTE_DENIED', path);
  }
  assert.equal(seen.length, 0);
  // the original Developer Support routes still work in Production
  assert.equal((await support.handle(req('dev', '/api/v1/sessions'), next)).status, 200);
  assert.equal(seen[0].uid, 'fac');
  for (const [method, path] of [['GET', '/api/v1/me'], ['GET', '/api/v1/sessions'], ['POST', '/api/v1/afc-requests'], ['GET', '/api/v1/calendar-activities'], ['POST', '/api/v1/afc-forms']]) {
    assert.equal(routeAccess({ testing: false, method, path }), path.match(/calendar|afc-forms/) ? null : 'reversible', path);
  }
});

test('Testing personas read the newer workflows as the persona, not as the operator', async () => {
  const { support, req, next, seen } = harness(TEST);
  for (const path of NEW_READS) {
    const result = await support.handle(req('admin', path), next);
    assert.equal(result.status, 200, path);
  }
  assert.equal(seen.length, NEW_READS.length);
  assert.ok(seen.every(entry => entry.uid === 'fac'), 'every downstream request ran as the persona');
});

test('Testing persona writes on the request transaction are recorded under the real operator', async () => {
  for (const path of NEW_RECORDED_WRITES) {
    const { support, req, next, queries, seen } = harness(TEST);
    const result = await support.handle(req('admin', path, { method: 'POST', body: { a: 1 } }), next);
    assert.equal(result.status, 200, path);
    assert.equal(seen[0].uid, 'fac', path);
    const op = queries.find(q => /INSERT paws\.SupportOperation/.test(q.text));
    assert.equal(op.params.actor, 'admin', path);
    assert.equal(op.params.target, 'fac', path);
    assert.equal(op.params.route, 'POST ' + path);
    assert.ok(queries.some(q => /developer_support_operation/.test(q.text) && q.params.actor === 'admin'), path);
    assert.equal(routeAccess({ testing: true, method: 'POST', path }), 'recorded', path);
  }
});

test('Testing persona import writes are refused before any downstream call or operation record', async () => {
  for (const path of IMPORT_WRITES) {
    const { support, req, next, queries, seen } = harness(TEST);
    const result = await support.handle(req('admin', path, { method: 'POST', body: { a: 1 } }), next);
    assert.equal(result.status, 403, path);
    assert.equal(result.jsonBody.error.code, 'SUPPORT_ROUTE_DENIED', path);
    assert.match(result.jsonBody.error.message, /yourself/);
    assert.equal(seen.length, 0, path);
    assert.ok(!queries.some(q => /INSERT paws\.SupportOperation/.test(q.text)), path);
  }
});

test('unknown, artifact and support-management routes stay denied for personas in every environment', async () => {
  for (const environment of [PROD, TEST]) {
    const { support, req, next, seen } = harness(environment);
    for (const [method, path] of [
      ['GET', '/api/v1/afc-requests/4b0e9f1c-2d3a-4c5b-8e6f-7a8b9c0d1e2f/approved-artifact'],
      ['POST', '/api/v1/afc-requests/4b0e9f1c-2d3a-4c5b-8e6f-7a8b9c0d1e2f/approved-artifact'],
      ['GET', '/api/v1/unknown-workflow'],
      ['POST', '/api/v1/change-history/export'],
      ['POST', '/api/v1/calendar-activities'],
      ['GET', '/api/v1/afc-formsx'],
      ['GET', '/api/v1/scheduling-tasks-admin']
    ]) {
      const result = await support.handle(req('admin', path, method === 'POST' ? { method, body: {} } : {}), next);
      assert.equal(result.status, 403, `${environment.name} ${method} ${path}`);
    }
    assert.equal(seen.length, 0);
  }
});

test('a forged context header never reaches the newer workflows', async () => {
  const { support, req, next, seen } = harness(TEST);
  for (const context of ['not-a-uuid', '7a1f3e2d-1c4b-4a5e-8f7d-9e0a1b2c3d4e']) {
    const result = await support.handle(req('admin', '/api/v1/calendar-activities', { context }), next);
    assert.equal(result.status, 403);
  }
  // a faculty user presenting the operator's real context is refused (context belongs to admin)
  assert.equal((await support.handle(req('fac', '/api/v1/afc-forms'), next)).status, 403);
  assert.equal(seen.length, 0);
});

test('operations on non-reversible routes are reported as non-undoable and the server refuses to undo them', async () => {
  const { support, req, next, queries } = harness(TEST, { operationRoute: 'POST /api/v1/afc-forms' });
  const listing = await support.handle(req('dev', '/api/v1/support', { context: null }), next);
  assert.equal(listing.status, 200);
  assert.equal(listing.jsonBody.operations[0].undoable, false);
  const undo = await support.handle(req('dev', '/api/v1/support/undo', { method: 'POST', body: { operationId: OP_ID }, context: null }), next);
  assert.equal(undo.status, 409);
  assert.equal(undo.jsonBody.error.code, 'SUPPORT_UNDO_UNSUPPORTED');
  assert.ok(!queries.some(q => /UndoSupportOperation/.test(q.text)));
});

test('operations on reversible routes keep the existing undo path', async () => {
  const { support, req, next, queries } = harness(TEST, { operationRoute: 'POST /api/v1/sessions/batch' });
  const listing = await support.handle(req('dev', '/api/v1/support', { context: null }), next);
  assert.equal(listing.jsonBody.operations[0].undoable, true);
  const undo = await support.handle(req('dev', '/api/v1/support/undo', { method: 'POST', body: { operationId: OP_ID }, context: null }), next);
  assert.equal(undo.status, 200);
  assert.ok(queries.some(q => /UndoSupportOperation/.test(q.text)));
});

test('Production operation listing and undo are unchanged', async () => {
  const { support, req, next, queries } = harness(PROD, { operationRoute: 'PATCH /api/v1/sessions/x' });
  const listing = await support.handle(req('dev', '/api/v1/support', { context: null }), next);
  assert.equal(listing.jsonBody.operations[0].undoable, true);
  const undo = await support.handle(req('dev', '/api/v1/support/undo', { method: 'POST', body: { operationId: OP_ID }, context: null }), next);
  assert.equal(undo.status, 200);
  assert.ok(queries.some(q => /UndoSupportOperation/.test(q.text)));
});

test('the Testing persona route table is explicit and covers every newer API family', () => {
  const families = TESTING_PERSONA_ROUTES.map(route => route.family).sort();
  assert.deepEqual(families, ['afc-forms', 'calendar-activities', 'calendar-activity-imports', 'ccc-replacements', 'ccc-schedule', 'change-history', 'faculty-availability', 'scheduling-tasks']);
  for (const route of TESTING_PERSONA_ROUTES) assert.match(route.why, /\w/);
});
