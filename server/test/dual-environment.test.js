'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {
  resolveEnvironment, assertDatabaseIdentity, sqlServerHost, isProductionSqlServer
} = require('../src/runtime/environment');
const { createSupportService } = require('../src/support/support-service');

const TEST_ID = '3f0c9a52-7d1e-4b6a-9c2f-0a1b2c3d4e5f';
const testingEnv = (extra = {}) => ({
  PAWS_ENVIRONMENT: 'testing', PAWS_TESTING_ENVIRONMENT_ID: TEST_ID, FIREBASE_PROJECT_ID: 'paws-testing',
  PAWS_SQL_CONNECTION_STRING: 'Server=tcp:paws-testing-sql.database.windows.net,1433;Database=VetMed-Ops;Encrypt=true', ...extra
});

// ---------------------------------------------------------------- environment identity
test('environment is mandatory and exact (fails closed)', () => {
  for (const value of [undefined, '', 'prod', 'Production', 'TESTING', 'staging', ' production']) {
    assert.throws(() => resolveEnvironment({ PAWS_ENVIRONMENT: value }), /PAWS_ENVIRONMENT/);
  }
  assert.equal(resolveEnvironment({ PAWS_ENVIRONMENT: 'production' }).name, 'production');
  assert.equal(resolveEnvironment(testingEnv()).testing, true);
});

test('production refuses Testing-only switches', () => {
  assert.throws(() => resolveEnvironment({ PAWS_ENVIRONMENT: 'production', PAWS_TESTING_ENVIRONMENT_ID: TEST_ID }), /not valid in production/);
  assert.throws(() => resolveEnvironment({ PAWS_ENVIRONMENT: 'production', PAWS_API_ALLOW_NON_LOOPBACK: 'true' }), /not valid in production/);
});

test('testing requires its own identity anchors and rejects production SQL / Firebase', () => {
  assert.throws(() => resolveEnvironment(testingEnv({ PAWS_TESTING_ENVIRONMENT_ID: undefined })), /PAWS_TESTING_ENVIRONMENT_ID/);
  assert.throws(() => resolveEnvironment(testingEnv({ PAWS_TESTING_ENVIRONMENT_ID: 'not-a-uuid' })), /PAWS_TESTING_ENVIRONMENT_ID/);
  assert.throws(() => resolveEnvironment(testingEnv({ FIREBASE_PROJECT_ID: 'tester-teaching' })), /production Firebase/);
  assert.throws(() => resolveEnvironment(testingEnv({ PAWS_SQL_CONNECTION_STRING: undefined })), /explicit SQL server/);
  for (const server of ['ITAPPVETOPSDB01', 'itappvetopsdb01.ucalgary.ca', 'tcp:ITAPPVETOPSDB01,1433', 'ITAPPVETOPSDB01\\SQL2019',
    'ucvm-teaching-lab-xz-20260911.database.windows.net']) {
    assert.throws(() => resolveEnvironment(testingEnv({ PAWS_SQL_CONNECTION_STRING: `Data Source=${server};Initial Catalog=VetMed-Ops` })), /production SQL server/, server);
  }
});

test('SQL host parsing normalises protocol, port and instance', () => {
  assert.equal(sqlServerHost('Server=tcp:Example.database.windows.net,1433;Database=x'), 'example.database.windows.net');
  assert.equal(sqlServerHost('Address=HOST\\INST;Database=x'), 'host');
  assert.equal(isProductionSqlServer('itappvetopsdb01-test'), false);
});

const fakeDb = rows => ({ async query() { return rows; } });

test('production accepts an unmarked or production database and refuses a Testing database', async () => {
  const production = resolveEnvironment({ PAWS_ENVIRONMENT: 'production' });
  assert.equal(await assertDatabaseIdentity(fakeDb([]), production), true);
  assert.equal(await assertDatabaseIdentity(fakeDb([{ environment: 'production', environmentId: TEST_ID }]), production), true);
  await assert.rejects(assertDatabaseIdentity(fakeDb([{ environment: 'testing', environmentId: TEST_ID }]), production), /non-production database/);
});

test('testing refuses any database without its exact marker (no production fallback)', async () => {
  const testing = resolveEnvironment(testingEnv());
  assert.equal(await assertDatabaseIdentity(fakeDb([{ environment: 'testing', environmentId: TEST_ID.toUpperCase() }]), testing), true);
  for (const rows of [[], [{ environment: 'production', environmentId: TEST_ID }],
    [{ environment: 'testing', environmentId: '00000000-0000-4000-8000-000000000000' }],
    [{ environment: 'testing', environmentId: TEST_ID }, { environment: 'testing', environmentId: TEST_ID }]]) {
    await assert.rejects(assertDatabaseIdentity(fakeDb(rows), testing), /declared Testing database/);
  }
});

// ---------------------------------------------------------------- runtime wiring
function poolReturning(markerRows, log) {
  return class FakePool {
    async connect() { return this; }
    request() {
      return { input() { return this; }, async query(text) { log.push(text); return { recordset: /paws_env\.EnvironmentIdentity/.test(text) ? markerRows : [] }; } };
    }
    async close() {}
  };
}

async function callRuntime(runtime, path) {
  return runtime(new Request('http://127.0.0.1' + path, { method: 'GET' }));
}

test('createSwaSqlRuntime refuses to construct without an environment', () => {
  const { createSwaSqlRuntime } = require('../src/runtime/swa-sql-runtime');
  assert.throws(() => createSwaSqlRuntime({ env: { FIREBASE_PROJECT_ID: 'x', PAWS_SQL_CONNECTION_STRING: 'Server=a;Database=b' }, admin: {}, sql: {} }), /PAWS_ENVIRONMENT/);
});

test('a Testing runtime connected to an unmarked database serves nothing', async () => {
  const { createSwaSqlRuntime } = require('../src/runtime/swa-sql-runtime');
  const log = [];
  const runtime = createSwaSqlRuntime({ env: testingEnv(), admin: {}, sql: { ConnectionPool: poolReturning([], log) } });
  const result = await callRuntime(runtime, '/api/v1/me');
  assert.equal(result.status, 503);
  assert.equal(result.jsonBody.error.code, 'ENVIRONMENT_MISCONFIGURED');
  await assert.rejects(runtime.assertEnvironment(), /declared Testing database/);
  assert.equal(runtime.environment, 'testing');
  await runtime.close();
});

test('a Testing runtime with its marker proceeds to normal authorization', async () => {
  const { createSwaSqlRuntime } = require('../src/runtime/swa-sql-runtime');
  const log = [];
  const runtime = createSwaSqlRuntime({ env: testingEnv(), admin: {}, sql: { ConnectionPool: poolReturning([{ environment: 'testing', environmentId: TEST_ID }], log) } });
  const result = await callRuntime(runtime, '/api/v1/me');
  assert.equal(result.status, 401);
  await runtime.close();
});

test('a Production runtime rejects a Testing-marked database at start-up', async () => {
  const { createSwaSqlRuntime } = require('../src/runtime/swa-sql-runtime');
  const log = [];
  const runtime = createSwaSqlRuntime({
    env: { PAWS_ENVIRONMENT: 'production', FIREBASE_PROJECT_ID: 'tester-teaching', PAWS_SQL_CONNECTION_STRING: 'Server=localhost;Database=VetMed-Ops;Encrypt=true' },
    admin: {}, sql: { ConnectionPool: poolReturning([{ environment: 'testing', environmentId: TEST_ID }], log) }
  });
  await assert.rejects(runtime.assertEnvironment(), /non-production database/);
  await runtime.close();
});

// ---------------------------------------------------------------- HTTP server
const identity = { PAWS_RELEASE_SHA: 'a'.repeat(40), PAWS_RUNTIME_TRUST_ANCHOR: 'b'.repeat(40) };

test('runtime health reports the environment; HTTP server requires one', async t => {
  const { createUniversityHttpServer } = require('../src/runtime/university-http-server');
  assert.throws(() => createUniversityHttpServer({ runtime: async () => ({ status: 200 }), env: identity }), /PAWS_ENVIRONMENT/);
  const server = createUniversityHttpServer({ runtime: async () => ({ status: 200 }), env: { ...identity, ...testingEnv() } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const body = await new Promise((resolve, reject) => http.get({ host: '127.0.0.1', port: server.address().port, path: '/api/health/runtime' }, res => {
    let data = ''; res.on('data', c => { data += c; }); res.on('end', () => resolve(JSON.parse(data)));
  }).on('error', reject));
  assert.equal(body.environment, 'testing');
});

test('runtime and HTTP server must agree on the environment', () => {
  const { createUniversityHttpServer } = require('../src/runtime/university-http-server');
  const runtime = async () => ({ status: 200 });
  runtime.environment = 'testing';
  assert.throws(() => createUniversityHttpServer({ runtime, env: { ...identity, PAWS_ENVIRONMENT: 'production' } }), /environments differ/);
});

test('non-loopback binding is a Testing-only explicit opt-in', () => {
  const { createUniversityHttpServer } = require('../src/runtime/university-http-server');
  const runtime = async () => ({ status: 200 });
  assert.throws(() => createUniversityHttpServer({ runtime, host: '0.0.0.0', env: { ...identity, PAWS_ENVIRONMENT: 'production' } }), /loopback/);
  assert.throws(() => createUniversityHttpServer({ runtime, host: '0.0.0.0', env: { ...identity, ...testingEnv() } }), /loopback/);
  assert.doesNotThrow(() => createUniversityHttpServer({ runtime, host: '0.0.0.0', env: { ...identity, ...testingEnv({ PAWS_API_ALLOW_NON_LOOPBACK: 'true' }) } }));
  assert.throws(() => createUniversityHttpServer({ runtime, host: '10.0.0.4', env: { ...identity, ...testingEnv({ PAWS_API_ALLOW_NON_LOOPBACK: 'true' }) } }), /loopback/);
});

// ---------------------------------------------------------------- personas (Developer Support adapter)
const USERS = {
  dev: { firebaseUid: 'dev', displayName: 'Dev', baseRole: 'developer', active: true, mustChangePassword: false },
  owner: { firebaseUid: 'owner', displayName: 'Owner', baseRole: 'owner', active: true, mustChangePassword: false },
  admin: { firebaseUid: 'admin', displayName: 'Admin', baseRole: 'administrator', active: true, mustChangePassword: false },
  fac: { firebaseUid: 'fac', displayName: 'Faculty', baseRole: 'faculty', active: true, mustChangePassword: false, facultyId: 'f1' },
  hicc: { firebaseUid: 'hicc', displayName: 'HICC', baseRole: 'hicc', active: true, mustChangePassword: false, facultyId: 'f2' }
};
const CONTEXT_ID = '6a1f3e2d-1c4b-4a5e-8f7d-9e0a1b2c3d4e';

function supportHarness(environment, contexts = {}) {
  const queries = [];
  const db = {
    async query(text, params = {}) {
      queries.push({ text, params });
      if (/FROM paws\.UserProfile WHERE Active=1/.test(text)) return Object.values(USERS).map(u => ({ uid: u.firebaseUid, name: u.displayName, role: u.baseRole }));
      if (/FROM paws\.SupportOperation o/.test(text)) return [];
      if (/FROM paws\.SupportContext c WHERE/.test(text)) return contexts[params.id] && contexts[params.id].actor === params.uid ? [{ id: params.id, targetUid: contexts[params.id].target, reason: 'r', expiresAtUtc: 'later' }] : [];
      return [];
    },
    async transaction(callback) { return callback(); }
  };
  const support = createSupportService({
    db, environment, verifyToken: async token => ({ uid: token }), findUser: async uid => USERS[uid] || null
  });
  const req = (uid, path, { method = 'GET', body, context } = {}) => new Request('http://x' + path, {
    method, headers: { authorization: 'Bearer ' + uid, 'content-type': 'application/json', ...(context ? { 'x-paws-support-context': context } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const next = async request => ({ status: 200, jsonBody: { profile: { role: 'echo' }, path: new URL(request.url).pathname } });
  return { support, req, next, queries };
}
const PROD = { name: 'production', testing: false };
const TEST = { name: 'testing', testing: true };

test('production identity switching is unchanged: developer only', async () => {
  const { support, req, next } = supportHarness(PROD);
  assert.equal((await support.handle(req('admin', '/api/v1/support'), next)).status, 403);
  assert.equal((await support.handle(req('owner', '/api/v1/support'), next)).status, 403);
  const listing = await support.handle(req('dev', '/api/v1/support'), next);
  assert.equal(listing.status, 200);
  assert.equal(listing.jsonBody.mode, 'developer_support');
  assert.equal(listing.jsonBody.accounts.length, 5);
});

test('testing personas: administrators may switch, but never upward', async () => {
  const { support, req, next, queries } = supportHarness(TEST);
  const adminList = await support.handle(req('admin', '/api/v1/support'), next);
  assert.equal(adminList.status, 200);
  assert.equal(adminList.jsonBody.mode, 'testing_persona');
  assert.deepEqual(adminList.jsonBody.accounts.map(a => a.role).sort(), ['administrator', 'faculty', 'hicc']);
  assert.equal((await support.handle(req('admin', '/api/v1/support/start', { method: 'POST', body: { targetUid: 'owner', reason: 'test' } }), next)).status, 403);
  assert.equal((await support.handle(req('admin', '/api/v1/support/start', { method: 'POST', body: { targetUid: 'dev', reason: 'test' } }), next)).jsonBody.error.code, 'SUPPORT_ESCALATION_DENIED');
  const started = await support.handle(req('admin', '/api/v1/support/start', { method: 'POST', body: { targetUid: 'fac', reason: 'test faculty persona' } }), next);
  assert.equal(started.status, 201);
  const insert = queries.find(q => /INSERT paws\.SupportContext/.test(q.text));
  assert.equal(insert.params.actor, 'admin', 'real actor recorded');
  assert.equal(insert.params.eventType, 'testing_persona_start');
  assert.ok(JSON.parse(insert.params.operatorRoles).includes('administrator'));
  // faculty / HICC / VISC accounts can never operate personas
  assert.equal((await support.handle(req('hicc', '/api/v1/support'), next)).status, 403);
  // owners may use admin personas; developers may use any
  assert.deepEqual((await support.handle(req('owner', '/api/v1/support'), next)).jsonBody.accounts.map(a => a.role).sort(), ['administrator', 'faculty', 'hicc', 'owner']);
  assert.equal((await support.handle(req('dev', '/api/v1/support'), next)).jsonBody.accounts.length, 5);
});

test('persona context resolves server-side and re-checks escalation on every use', async () => {
  const { support, req, next } = supportHarness(TEST, { [CONTEXT_ID]: { actor: 'admin', target: 'fac' } });
  const me = await support.handle(req('admin', '/api/v1/me', { context: CONTEXT_ID }), next);
  assert.equal(me.status, 200);
  assert.equal(me.jsonBody.support.targetRole, 'faculty');
  assert.equal(me.jsonBody.support.actorRole, 'administrator');
  assert.equal(me.jsonBody.support.mode, 'testing_persona');
  // another user cannot reuse someone else's context
  assert.equal((await support.handle(req('owner', '/api/v1/me', { context: CONTEXT_ID }), next)).status, 403);
  // a faculty user cannot use a context at all
  assert.equal((await support.handle(req('fac', '/api/v1/me', { context: CONTEXT_ID }), next)).status, 403);
  // expired / unknown contexts are rejected
  assert.equal((await support.handle(req('admin', '/api/v1/me', { context: '7a1f3e2d-1c4b-4a5e-8f7d-9e0a1b2c3d4e' }), next)).status, 403);
});

test('a context targeting a higher-ranked persona is refused even if it exists', async () => {
  const { support, req, next } = supportHarness(TEST, { [CONTEXT_ID]: { actor: 'admin', target: 'owner' } });
  const me = await support.handle(req('admin', '/api/v1/me', { context: CONTEXT_ID }), next);
  assert.equal(me.status, 403);
  assert.equal(me.jsonBody.error.code, 'SUPPORT_ESCALATION_DENIED');
});

test('persona writes keep the real actor on the operation and audit rows', async () => {
  const { support, req, next, queries } = supportHarness(TEST, { [CONTEXT_ID]: { actor: 'admin', target: 'fac' } });
  const result = await support.handle(req('admin', '/api/v1/afc-requests', { method: 'POST', body: { a: 1 }, context: CONTEXT_ID }), next);
  assert.equal(result.status, 200);
  const op = queries.find(q => /INSERT paws\.SupportOperation/.test(q.text));
  assert.equal(op.params.actor, 'admin');
  assert.equal(op.params.target, 'fac');
  const audit = queries.find(q => /developer_support_operation/.test(q.text));
  assert.equal(audit.params.actor, 'admin');
});
