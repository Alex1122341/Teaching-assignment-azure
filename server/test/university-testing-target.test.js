'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const targetPath = path.join(__dirname, '../src/runtime/sql-environment-target.js');
const targets = fs.existsSync(targetPath) ? require(targetPath) : {};
const { resolveEnvironment } = require('../src/runtime/environment');
const { createSqlConnection } = require('../src/data/sql-connection');

const UUID = '7e570000-0000-4000-8000-00000000c0de';
function universityEnv(extra = {}) {
  return {
    PAWS_ENVIRONMENT: 'testing', PAWS_TESTING_SQL_PROFILE: 'university-testing',
    PAWS_TESTING_SQL_SERVER: 'itappvetopsdb01', PAWS_TESTING_DATABASE: 'VetMed-Ops-Testing',
    PAWS_TESTING_ENVIRONMENT_ID: UUID, FIREBASE_PROJECT_ID: 'paws-testing',
    PAWS_SQL_DRIVER: 'msnodesqlv8',
    PAWS_SQL_CONNECTION_STRING: 'Server=tcp:ITAPPVETOPSDB01,1433;Database=VetMed-Ops-Testing;Encrypt=true;TrustServerCertificate=false',
    ...extra
  };
}
function api(name) {
  assert.equal(typeof targets[name], 'function', `${name} must implement the approved target boundary`);
  return targets[name];
}
const target = () => api('resolveSqlTarget')(universityEnv());

test('University Testing accepts only the exact host/database pair', () => {
  assert.deepEqual(api('parseSqlTarget')('Server=tcp:ITAPPVETOPSDB01,1433;Database=VetMed-Ops-Testing'),
    { host: 'itappvetopsdb01', database: 'VetMed-Ops-Testing' });
  assert.deepEqual(target(), {
    profile: 'university-testing', host: 'itappvetopsdb01', database: 'VetMed-Ops-Testing',
    physicalServer: 'ITAPPVETOPSDB01', environmentId: UUID
  });
  assert.equal(resolveEnvironment(universityEnv()).testing, true);
});

test('duplicate database/host aliases and ambiguous values are rejected even when identical', () => {
  const parse = api('parseSqlTarget');
  for (const extra of [';Database=VetMed-Ops-Testing', ';Initial Catalog=VetMed-Ops', ';Data Source=ITAPPVETOPSDB01']) {
    assert.throws(() => parse('Server=ITAPPVETOPSDB01;Database=VetMed-Ops-Testing' + extra), /exactly one|duplicate|ambiguous/i);
  }
  for (const input of ['Server=ITAPPVETOPSDB01', 'Database=VetMed-Ops-Testing',
    'Server={ITAPPVETOPSDB01};Database=VetMed-Ops-Testing',
    'Server=ITAPPVETOPSDB01;Database="VetMed-Ops-Testing"',
    'Server=ITAPPVETOPSDB01;Database=VetMed-Ops-Testing\u0000']) {
    assert.throws(() => parse(input), /explicit|exactly|ambiguous|invalid/i);
  }
});

for (const database of ['VetMed-Ops', 'master', 'model', 'msdb', 'tempdb', 'other-testing']) {
  test(`University Testing refuses database ${database} before driver construction`, () => {
    const resolve = api('resolveSqlTarget');
    const env = universityEnv({ PAWS_SQL_CONNECTION_STRING: `Server=ITAPPVETOPSDB01;Database=${database};Encrypt=true` });
    assert.throws(() => resolve(env), { code: 'ENVIRONMENT_MISCONFIGURED' });
    assert.throws(() => resolveEnvironment(env), { code: 'ENVIRONMENT_MISCONFIGURED' });
  });
}

const invalidProfiles = [
  ['missing profile', { PAWS_TESTING_SQL_PROFILE: undefined }],
  ['unknown profile', { PAWS_TESTING_SQL_PROFILE: 'anything' }],
  ['missing database declaration', { PAWS_TESTING_DATABASE: undefined }],
  ['wrong database declaration', { PAWS_TESTING_DATABASE: 'VetMed-Ops' }],
  ['missing UUID', { PAWS_TESTING_ENVIRONMENT_ID: undefined }],
  ['invalid UUID', { PAWS_TESTING_ENVIRONMENT_ID: 'not-a-uuid' }],
  ['Production Firebase', { FIREBASE_PROJECT_ID: 'tester-teaching' }],
  ['missing Firebase', { FIREBASE_PROJECT_ID: undefined }],
  ['non-Windows driver', { PAWS_SQL_DRIVER: 'tedious' }],
  ['managed identity', { PAWS_SQL_MI_CLIENT_ID: UUID }],
  ['self-signed override', { PAWS_SQL_ALLOW_SELF_SIGNED: 'true' }],
  ['local ODBC override', { PAWS_TESTING_LOCAL_ODBC: 'Driver={SQL Server};Server=(localdb)\\Other' }],
  ['loopback SQL', { PAWS_SQL_CONNECTION_STRING: 'Server=localhost;Database=VetMed-Ops-Testing;Encrypt=true' }],
  ['unreviewed host', { PAWS_SQL_CONNECTION_STRING: 'Server=ITAPPVETOPSDB01.attacker.example;Database=VetMed-Ops-Testing;Encrypt=true' }],
  ['host mismatch', { PAWS_TESTING_SQL_SERVER: 'other-server' }],
  ['certificate bypass', { PAWS_SQL_CONNECTION_STRING: 'Server=ITAPPVETOPSDB01;Database=VetMed-Ops-Testing;Encrypt=true;TrustServerCertificate=true' }],
  ['encryption disabled', { PAWS_SQL_CONNECTION_STRING: 'Server=ITAPPVETOPSDB01;Database=VetMed-Ops-Testing;Encrypt=false' }],
  ['nonloopback API', { PAWS_API_HOST: '0.0.0.0', PAWS_API_ALLOW_NON_LOOPBACK: 'true' }]
];
for (const [name, extra] of invalidProfiles) {
  test(`University profile rejects ${name}`, () => {
    const resolve = api('resolveSqlTarget');
    assert.throws(() => resolve(universityEnv(extra)), { code: 'ENVIRONMENT_MISCONFIGURED' });
  });
}

test('Production cannot accept new Testing selectors or select the Testing database', () => {
  const resolve = api('resolveSqlTarget');
  for (const extra of [{ PAWS_TESTING_SQL_PROFILE: 'university-testing' }, { PAWS_TESTING_DATABASE: 'VetMed-Ops-Testing' }]) {
    assert.throws(() => resolveEnvironment({ PAWS_ENVIRONMENT: 'production', ...extra }), { code: 'ENVIRONMENT_MISCONFIGURED' });
  }
  assert.throws(() => resolve({ PAWS_ENVIRONMENT: 'production', PAWS_SQL_CONNECTION_STRING: 'Server=ITAPPVETOPSDB01;Database=VetMed-Ops-Testing' }),
    { code: 'ENVIRONMENT_MISCONFIGURED' });
});

test('target guard binds trusted values and checks database, physical server and exact marker', () => {
  const guard = api('compileTargetGuard')(target());
  assert.match(guard.text, /PAWS_SQL_TARGET_GUARD_V1/);
  assert.match(guard.text, /DB_NAME\(\)/);
  assert.match(guard.text, /SERVERPROPERTY\(N?'ServerName'\)/i);
  assert.match(guard.text, /\[paws_env\]\.\[EnvironmentIdentity\]/);
  assert.match(guard.text, /COUNT(?:_BIG)?\(\*\)/);
  assert.equal(guard.params.pawsTargetDatabase, 'VetMed-Ops-Testing');
  assert.equal(guard.params.pawsTargetServer, 'ITAPPVETOPSDB01');
  assert.equal(guard.params.pawsTargetEnvironmentId, UUID);
  assert.ok(!guard.text.includes(UUID));
  assert.ok(!guard.text.includes('VetMed-Ops-Testing'));
});

test('unknown physical server metadata cannot bypass the guard through SQL NULL semantics', () => {
  const guard = api('compileTargetGuard')(target());
  assert.match(guard.text, /COALESCE\(UPPER\(CONVERT\(nvarchar\(128\),SERVERPROPERTY\(N'ServerName'\)\)\),N''\)/);
});

function guardedSql() {
  const calls = [], business = [];
  const state = { reject: false, created: 0, closed: 0 };
  function request() {
    const params = {};
    return {
      input(key, value) { params[key] = value; return this; },
      async query(text) {
        calls.push({ text, params: { ...params } });
        if (text.includes('PAWS_SQL_TARGET_GUARD_V1') && state.reject) {
          const error = new Error('SQL target rejected'); error.number = 55880; throw error;
        }
        business.push(text);
        return { recordset: [] };
      }
    };
  }
  class Transaction extends EventEmitter { async begin() {} async commit() {} async rollback() {} }
  return { calls, business, state, sql: {
    ConnectionPool: class { constructor() { state.created++; } async connect() {
      if (state.failConnectOnce) { state.failConnectOnce = false; throw Error('Transient SQL connect failure'); }
      return this;
    }
      request() { return request(); } async close() { state.closed++; } },
    Request: class { constructor() { return request(); } }, Transaction, ISOLATION_LEVEL: { SERIALIZABLE: 4 }
  } };
}

test('connection executes a supplied target guard before business SQL without a cached bypass', async () => {
  const h = guardedSql();
  const guard = { text: '/* PAWS_SQL_TARGET_GUARD_V1 */ SELECT @pawsTargetDatabase AS checked;',
    params: { pawsTargetDatabase: 'VetMed-Ops-Testing' } };
  const db = createSqlConnection({ config: {}, sql: h.sql, targetGuard: guard });
  h.state.reject = true;
  await assert.rejects(db.query('SELECT 1 AS business'), /target|environment/i);
  assert.equal(h.business.length, 0);
  await db.close();
});

test('connection rejects reserved target parameters before any business SQL', async () => {
  const h = guardedSql();
  const db = createSqlConnection({ config: {}, sql: h.sql,
    targetGuard: { text: '/* PAWS_SQL_TARGET_GUARD_V1 */', params: { pawsTargetDatabase: 'VetMed-Ops-Testing' } } });
  await assert.rejects(db.query('SELECT 1 AS business', { pawsTargetDatabase: 'VetMed-Ops' }), /reserved/i);
  assert.equal(h.business.length, 0);
  await db.close();
});

test('concurrent cold requests share one owned pool instead of leaking unchecked connections', async () => {
  const h = guardedSql();
  const db = createSqlConnection({ config: {}, sql: h.sql,
    targetGuard: { text: '/* PAWS_SQL_TARGET_GUARD_V1 */', params: { pawsTargetDatabase: 'VetMed-Ops-Testing' } } });
  await Promise.all(Array.from({ length: 5 }, () => db.query('SELECT 1 AS business')));
  assert.equal(h.state.created, 1);
  await db.close();
  assert.equal(h.state.closed, 1);
});

test('failed connection is closed and retried without a permanently rejected pool promise', async () => {
  const h = guardedSql(); h.state.failConnectOnce = true;
  const db = createSqlConnection({ config: {}, sql: h.sql });
  await assert.rejects(db.query('SELECT 1'), /Transient SQL connect failure/);
  assert.equal(h.state.closed, 1);
  await db.query('SELECT 2');
  assert.equal(h.state.created, 2);
  await db.close();
  assert.equal(h.state.closed, 2);
});

test('every SQL request guards its actual connection, including concurrency and reopen', async () => {
  const h = guardedSql(), guard = api('compileTargetGuard')(target());
  const db = createSqlConnection({ config: {}, sql: h.sql, targetGuard: guard });
  await Promise.all(Array.from({ length: 5 }, (_, i) => db.query(`SELECT ${i} AS business`)));
  await db.close();
  await db.query('SELECT 6 AS business');
  assert.equal(h.calls.length, 6);
  for (const call of h.calls) {
    assert.ok(call.text.indexOf('PAWS_SQL_TARGET_GUARD_V1') >= 0);
    assert.ok(call.text.indexOf('PAWS_SQL_TARGET_GUARD_V1') < call.text.indexOf(' AS business'));
    assert.equal(call.params.pawsTargetEnvironmentId, UUID);
  }
  h.state.reject = true;
  await assert.rejects(db.query('SELECT 7 AS business'), /target|environment/i);
  assert.equal(h.business.length, 6, 'a cached successful identity cannot bypass a later SQL guard rejection');
  await db.close();
});

test('target params cannot be forged and an active transaction retains its request guard', async () => {
  const h = guardedSql(), guard = api('compileTargetGuard')(target());
  const db = createSqlConnection({ config: {}, sql: h.sql, targetGuard: guard });
  await assert.rejects(db.query('SELECT 1', { pawsTargetDatabase: 'VetMed-Ops' }), /reserved/i);
  assert.equal(h.business.length, 0);
  await db.transaction(() => db.query('SELECT 1 AS business'));
  assert.ok(h.calls.every(call => call.text.includes('PAWS_SQL_TARGET_GUARD_V1')));
  await db.close();
});

test('new University profile is wired through the real runtime before business reads', async () => {
  api('resolveSqlTarget');
  const { createSwaSqlRuntime } = require('../src/runtime/swa-sql-runtime');
  const h = guardedSql();
  const Original = h.sql.ConnectionPool;
  h.sql.ConnectionPool = class extends Original {
    request() {
      const r = super.request(), original = r.query;
      r.query = async function(text) {
        const result = await original.call(this, text);
        return /SELECT Environment AS environment/.test(text)
          ? { recordset: [{ environment: 'testing', environmentId: UUID }] } : result;
      };
      return r;
    }
  };
  const runtime = createSwaSqlRuntime({ env: universityEnv(), admin: {}, sql: h.sql });
  await runtime.assertEnvironment();
  assert.equal(runtime.environment, 'testing');
  assert.ok(h.calls.length > 0 && h.calls.every(call => call.text.includes('PAWS_SQL_TARGET_GUARD_V1')));
  await runtime.close();
});
