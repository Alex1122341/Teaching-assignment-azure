'use strict';
// Local live acceptance for the dual-environment design (Windows + SQL Server LocalDB).
//
// Builds two physically separate SQL Server instances on the developer machine and runs the REAL
// University API twice, once per environment:
//   * (localdb)\PAWSProdSim  -> "production" stand-in: synthetic data, NO Testing marker
//   * (localdb)\MSSQLLocalDB -> Testing database created by reset-testing-db.js (marker + synthetic data)
// Then exercises acceptance scenarios B, C, D and F of the dual-environment spec plus the start-up guards.
// Firebase token verification is replaced by a local verifier ("syn-token:<uid>"); everything else
// (HTTP server, runtime, authorization, SQL procedures) is production code.
//
//   node tools/testing-db/local-acceptance.js            (needs server/node_modules with msnodesqlv8)
//
// Output: JSON results on stdout and in .azure-testing/local-acceptance.json. Nothing outside the
// two LocalDB instances is touched.
const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const sql = require(path.join(ROOT, 'server/node_modules/mssql/msnodesqlv8'));
const { createSwaSqlRuntime } = require(path.join(ROOT, 'server/src/runtime/swa-sql-runtime'));
const { createUniversityHttpServer } = require(path.join(ROOT, 'server/src/runtime/university-http-server'));
const resetTool = require('./reset-testing-db');

// Instance names can be overridden when a developer's default LocalDB already holds a VetMed-Ops
// database of their own (the script never drops a database it did not create).
const INSTANCE = /^[A-Za-z][A-Za-z0-9_]{0,30}$/;
const TESTING_INSTANCE = process.env.PAWS_LOCAL_ACCEPTANCE_TESTING_INSTANCE || 'MSSQLLocalDB';
const PROD_INSTANCE = process.env.PAWS_LOCAL_ACCEPTANCE_PRODUCTION_INSTANCE || 'PAWSProdSim';
if (!INSTANCE.test(TESTING_INSTANCE) || !INSTANCE.test(PROD_INSTANCE) || TESTING_INSTANCE === PROD_INSTANCE) throw new Error('Local acceptance needs two different, simple LocalDB instance names');
const TESTING_ID = '7e570000-0000-4000-8000-00000000c0de';
const results = [];
const log = (...a) => console.error(...a);

function localdb(args) { return execSync(`SqlLocalDB.exe ${args}`, { encoding: 'utf8' }); }
function pipeOf(instance) {
  if (!new RegExp(`^${instance}$`, 'mi').test(localdb('info'))) localdb(`create ${instance}`);
  if (!/State:\s+Running/i.test(localdb(`info ${instance}`))) localdb(`start ${instance}`);
  return /Instance pipe name:\s*(\S+)/i.exec(localdb(`info ${instance}`))[1];
}
function driverName() {
  const out = execSync('powershell -NoProfile -Command "(Get-OdbcDriver -Platform 64-bit).Name"', { encoding: 'utf8' }).split(/\r?\n/).map(s => s.trim());
  return ['ODBC Driver 18 for SQL Server', 'ODBC Driver 17 for SQL Server', 'SQL Server'].find(n => out.includes(n));
}
const odbc = (instance, database) => `Driver={${driverName()}};Server=${pipeOf(instance)};Database=${database};Trusted_Connection=Yes;`;

async function exec(instance, database, text) {
  const pool = await new sql.ConnectionPool({ connectionString: odbc(instance, database) }).connect();
  try { return (await pool.request().batch(text)).recordset || []; } finally { await pool.close(); }
}
// Each acceptance run creates fresh databases. Even a Testing/stand-in marker cannot prove this run
// owns an existing database, so refuse it without querying or dropping any of its objects.
async function createEmptyAcceptanceDatabase(instance) {
  const [existing] = await exec(instance, 'master', `SELECT DB_ID(N'VetMed-Ops') AS id`);
  if (existing && existing.id !== null) {
    throw new Error(`(localdb)\\${instance} already has a VetMed-Ops database; refusing to reuse it. Choose two fresh acceptance instance names.`);
  }
  // LocalDB instances share one default data folder, so each instance gets its own file names.
  await exec(instance, 'master', `DECLARE @dir nvarchar(400) = CONVERT(nvarchar(400), SERVERPROPERTY('InstanceDefaultDataPath'));
DECLARE @sql nvarchar(max) = N'CREATE DATABASE [VetMed-Ops] ON (NAME = N''VetMedOps_${instance}'', FILENAME = N''' + @dir + N'${instance}_VetMed-Ops.mdf'')
  LOG ON (NAME = N''VetMedOps_${instance}_log'', FILENAME = N''' + @dir + N'${instance}_VetMed-Ops_log.ldf'')';
EXEC (@sql);`);
}

function testingEnv(extra = {}) {
  return { PAWS_ENVIRONMENT: 'testing', PAWS_TESTING_ENVIRONMENT_ID: TESTING_ID, FIREBASE_PROJECT_ID: 'paws-testing-local',
    PAWS_SQL_CONNECTION_STRING: `Server=(localdb)\\${TESTING_INSTANCE};Database=VetMed-Ops`, PAWS_TESTING_SQL_SERVER: '(localdb)', ...extra };
}
function runtimeEnv(base, gatesOn) {
  const env = { ...base, PAWS_SQL_DRIVER: 'msnodesqlv8', PAWS_SQL_CONNECTION_STRING: base.PAWS_SQL_CONNECTION_STRING + ';Encrypt=true',
    PAWS_RELEASE_SHA: '0'.repeat(40), PAWS_RUNTIME_TRUST_ANCHOR: '0'.repeat(40), PAWS_API_HOST: '127.0.0.1' };
  if (gatesOn) for (const g of ['SESSION_EDIT', 'SESSION_CREATE', 'AFC_SINGLE', 'AFC_BATCH', 'AFC_CANCEL', 'AFC_REQUEST', 'AFC_DECISION', 'AFC_ARTIFACT',
    'SWAP_REQUEST', 'SWAP_DECISION', 'SWAP_APPLY', 'TA_DRAFT', 'TA_REVIEW', 'TA_FINAL', 'TA_PUBLISH', 'FACULTY_ADMIN', 'DOE_ADMIN', 'DOE_MANUAL_ASSIGNMENT']) env[`PAWS_${g}_WRITE_ENABLED`] = 'true';
  return env;
}
function sqlFor(instance) {
  // Test-only: route the runtime's connection to the given LocalDB instance through the installed ODBC driver.
  const connectionString = odbc(instance, 'VetMed-Ops');
  class LocalPool extends sql.ConnectionPool { constructor(config) { super({ ...config, connectionString, options: { ...(config.options || {}), encrypt: false } }); } }
  return Object.assign(Object.create(sql), { ConnectionPool: LocalPool });
}
function admin(projectId) {
  return { credential: { cert: () => ({}) }, initializeApp: () => ({}), auth: () => ({ async verifyIdToken(token) {
    if (!String(token).startsWith('syn-token:')) throw new Error('invalid token');
    return { uid: token.slice(10), aud: projectId, iss: `https://securetoken.google.com/${projectId}` };
  } }) };
}
async function startApi(env, instance) {
  const runtime = createSwaSqlRuntime({ env, admin: admin(env.FIREBASE_PROJECT_ID), sql: sqlFor(instance) });
  await runtime.assertEnvironment();
  const server = createUniversityHttpServer({ runtime, env, logger: { log() {}, error() {}, warn() {} } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: async () => { await new Promise(r => server.close(r)); await runtime.close(); } };
}
async function call(api, uid, method, url, body, headers = {}) {
  const h = { ...headers };
  if (uid) h.authorization = `Bearer syn-token:${uid}`;
  if (body !== undefined) h['content-type'] = 'application/json';
  const res = await fetch(api.base + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => null) };
}
function check(scenario, name, pass, detail) { results.push({ scenario, name, pass: Boolean(pass), detail }); log(`${pass ? 'PASS' : 'FAIL'} [${scenario}] ${name}${detail ? ' :: ' + detail : ''}`); }
async function expectReject(scenario, name, fn) {
  try { await fn(); check(scenario, name, false, 'was accepted'); } catch (e) { check(scenario, name, e.code === 'ENVIRONMENT_MISCONFIGURED', e.message); }
}
const fingerprint = () => require('node:crypto').randomBytes(32).toString('hex');

async function main() {
  // 1. Two independent databases.
  await createEmptyAcceptanceDatabase(TESTING_INSTANCE);
  await resetTool.main(['--confirm-reset', '--initialise-empty'], { ...testingEnv(), PAWS_TESTING_LOCAL_ODBC: odbc(TESTING_INSTANCE, 'VetMed-Ops') }, () => {});
  check('setup', 'Testing database initialised with marker + synthetic data', true);
  await expectReject('setup', 'reset refuses a database without the Testing marker', async () => {
    const e = new Error('x');
    try { await resetTool.main(['--confirm-reset'], { ...testingEnv({ PAWS_TESTING_ENVIRONMENT_ID: '7e570000-0000-4000-8000-0000000000aa' }), PAWS_TESTING_LOCAL_ODBC: odbc(TESTING_INSTANCE, 'VetMed-Ops') }, () => {}); }
    catch (err) { if (/different environment/.test(err.message)) { e.code = 'ENVIRONMENT_MISCONFIGURED'; e.message = err.message; throw e; } throw err; }
  });
  await createEmptyAcceptanceDatabase(PROD_INSTANCE);
  await resetTool.main(['--confirm-reset', '--initialise-empty'], { ...testingEnv({ PAWS_TESTING_ENVIRONMENT_ID: '7e570000-0000-4000-8000-00000000beef', PAWS_SQL_CONNECTION_STRING: `Server=(localdb)\\${PROD_INSTANCE};Database=VetMed-Ops` }),
    PAWS_TESTING_LOCAL_ODBC: odbc(PROD_INSTANCE, 'VetMed-Ops') }, () => {});
  await exec(PROD_INSTANCE, 'VetMed-Ops', `DROP TABLE paws_env.EnvironmentIdentity; DROP SCHEMA paws_env;
EXEC(N'CREATE SCHEMA paws_acceptance'); CREATE TABLE paws_acceptance.StandIn (Note nvarchar(100) NOT NULL DEFAULT N'local acceptance production stand-in');`);
  check('setup', 'production stand-in built on a separate SQL instance without a Testing marker', true);
  const prodFingerprint = async () => (await exec(PROD_INSTANCE, 'VetMed-Ops', `SELECT
    (SELECT CHECKSUM_AGG(CHECKSUM(*)) FROM paws.Faculty) AS faculty, (SELECT CHECKSUM_AGG(CHECKSUM(*)) FROM paws.Session) AS sessions,
    (SELECT CHECKSUM_AGG(CHECKSUM(*)) FROM paws.SessionAssignment) AS assignments, (SELECT COUNT(*) FROM paws.AuditEvent) AS audit,
    (SELECT COUNT(*) FROM paws.SupportOperation) AS supportOps`))[0];
  const prodBefore = await prodFingerprint();

  // 2. Start-up guards (scenario F).
  const prodEnv = runtimeEnv({ PAWS_ENVIRONMENT: 'production', FIREBASE_PROJECT_ID: 'paws-prod-sim', PAWS_SQL_CONNECTION_STRING: `Server=(localdb)\\${PROD_INSTANCE};Database=VetMed-Ops` }, false);
  await expectReject('F', 'production runtime refuses the Testing database', async () => { const r = createSwaSqlRuntime({ env: prodEnv, admin: admin('paws-prod-sim'), sql: sqlFor(TESTING_INSTANCE) }); try { await r.assertEnvironment(); } finally { await r.close(); } });
  await expectReject('F', 'testing runtime refuses the production database (no marker)', async () => { const r = createSwaSqlRuntime({ env: runtimeEnv(testingEnv(), true), admin: admin('paws-testing-local'), sql: sqlFor(PROD_INSTANCE) }); try { await r.assertEnvironment(); } finally { await r.close(); } });
  await expectReject('F', 'testing runtime refuses a Testing DB with another environment id', async () => { const r = createSwaSqlRuntime({ env: runtimeEnv(testingEnv({ PAWS_TESTING_ENVIRONMENT_ID: '7e570000-0000-4000-8000-0000000000aa' }), true), admin: admin('paws-testing-local'), sql: sqlFor(TESTING_INSTANCE) }); try { await r.assertEnvironment(); } finally { await r.close(); } });
  await expectReject('F', 'testing runtime refuses the production SQL server name', async () => createSwaSqlRuntime({ env: runtimeEnv(testingEnv({ PAWS_SQL_CONNECTION_STRING: 'Server=ITAPPVETOPSDB01;Database=VetMed-Ops' }), true), admin: admin('x'), sql }));
  await expectReject('F', 'testing runtime refuses the production Firebase project', async () => createSwaSqlRuntime({ env: runtimeEnv(testingEnv({ FIREBASE_PROJECT_ID: 'tester-teaching' }), true), admin: admin('x'), sql }));
  await expectReject('F', 'missing PAWS_ENVIRONMENT refuses to start', async () => createSwaSqlRuntime({ env: { ...runtimeEnv(testingEnv(), true), PAWS_ENVIRONMENT: undefined }, admin: admin('x'), sql }));

  const prod = await startApi(prodEnv, PROD_INSTANCE);
  const test = await startApi(runtimeEnv(testingEnv(), true), TESTING_INSTANCE);
  try {
    const hp = await fetch(prod.base + '/api/health/runtime').then(r => r.json());
    const ht = await fetch(test.base + '/api/health/runtime').then(r => r.json());
    check('A', 'each API reports its own environment', hp.environment === 'production' && ht.environment === 'testing', `${hp.environment} / ${ht.environment}`);
    const meT = await call(test, 'syn-admin', 'GET', '/api/v1/me');
    check('A', 'Testing /me identifies the testing environment', meT.status === 200 && meT.data.environment.testing === true);

    // Scenario B: modify test data.
    const sessions = (await call(test, 'syn-admin', 'GET', '/api/v1/sessions?start=2026-09-01&end=2027-04-30')).data.sessions;
    const target = sessions.find(s => s.sessionType === 'LEC');
    const edit = await call(test, 'syn-admin', 'PATCH', `/api/v1/sessions/${target.id}`, { topic: 'Edited in Testing only' });
    check('B', 'administrator edits a Testing session', edit.status === 200, `status ${edit.status}`);
    const prodSession = (await call(prod, 'syn-admin', 'GET', '/api/v1/sessions?start=2026-09-01&end=2027-04-30')).data.sessions.find(s => s.id === target.id);
    check('B', 'the edit is not visible in Production', prodSession && prodSession.topic !== 'Edited in Testing only', prodSession && prodSession.topic);
    const prodWrite = await call(prod, 'syn-admin', 'PATCH', `/api/v1/sessions/${target.id}`, { topic: 'should be gated' });
    check('B', 'Production keeps its own (disabled) write gates', prodWrite.status === 503 && prodWrite.data.error.code === 'WRITE_DISABLED');

    // Scenario C: identity switching inside Testing.
    const list = await call(test, 'syn-admin', 'GET', '/api/v1/support');
    const accounts = (list.data && list.data.accounts) || [];
    check('C', 'administrator sees persona list in Testing', list.status === 200 && list.data.mode === 'testing_persona', `${accounts.length} personas`);
    check('C', 'persona list excludes higher-privileged accounts', !accounts.some(a => ['owner', 'adfa_general', 'developer'].includes(a.role)), accounts.map(a => a.role).join(','));
    const esc = await call(test, 'syn-admin', 'POST', '/api/v1/support/start', { targetUid: 'syn-owner', reason: 'escalation attempt' });
    check('C', 'escalation to a higher persona is rejected', esc.status === 403 && esc.data.error.code === 'SUPPORT_ESCALATION_DENIED', `${esc.status}`);
    const facStart = await call(test, 'syn-admin', 'POST', '/api/v1/support/start', { targetUid: 'syn-faculty-a', reason: 'acceptance: faculty persona' });
    const ctxF = facStart.data && facStart.data.contextId;
    const H = id => ({ 'x-paws-support-context': id });
    const meF = await call(test, 'syn-admin', 'GET', '/api/v1/me', undefined, H(ctxF));
    check('C', 'faculty persona: effective role faculty, real actor retained', meF.status === 200 && meF.data.profile.role === 'faculty' && meF.data.support.actorName && meF.data.support.mode === 'testing_persona', meF.data && JSON.stringify(meF.data.support));
    const fSessions = (await call(test, 'syn-admin', 'GET', '/api/v1/sessions?start=2026-09-01&end=2027-04-30', undefined, H(ctxF))).data.sessions;
    check('C', 'faculty persona sees only own scoped timetable', fSessions.length > 0 && fSessions.length < sessions.length, `${fSessions.length}/${sessions.length}`);
    const fSummary = await call(test, 'syn-admin', 'GET', '/api/v1/dashboard/summary?academicYear=2026-27', undefined, H(ctxF));
    check('C', 'faculty persona is denied administrator data', fSummary.status === 403);
    const fEdit = await call(test, 'syn-admin', 'PATCH', `/api/v1/sessions/${target.id}`, { topic: 'faculty cannot edit' }, H(ctxF));
    check('C', 'faculty persona cannot use administrator writes', fEdit.status === 403);
    const meA = (await call(test, 'syn-faculty-a', 'GET', '/api/v1/me')).data.profile;
    // Current-main read panels: use the real HTTP/runtime/SQL path under a Testing persona.
    const meB = (await call(test, 'syn-faculty-b', 'GET', '/api/v1/me')).data.profile;
    const work = [], seenCursors = new Set();
    let workCursor = '0', workTotal = null, workOk = true;
    while (workCursor !== null) {
      if (seenCursors.has(workCursor) || seenCursors.size > 20) { workOk = false; break; }
      seenCursors.add(workCursor);
      const page = await call(test, 'syn-admin', 'GET', `/api/v1/faculty/${meA.facultyId}/availability?mode=range&startDate=2026-05-01&endDate=2027-05-31&kind=work&limit=1&cursor=${workCursor}`, undefined, H(ctxF));
      if (page.status !== 200 || !Array.isArray(page.data.items) || (workTotal !== null && workTotal !== page.data.total)) { workOk = false; break; }
      workTotal = page.data.total; work.push(...page.data.items); workCursor = page.data.nextCursor;
    }
    check('C', 'Availability pagination returns all work rows', workOk && workTotal === 4 && work.length === 4 && new Set(work.map(x => x.eventKey)).size === 4, `${work.length}/${workTotal}; ${seenCursors.size} pages`);
    check('C', 'Availability retains cross-year ranges and unconfirmed clocks', work.some(x => x.startDate === '2027-04-29' && x.endDate === '2027-05-03' && x.availability === 'time_unconfirmed'));
    const crossAvailability = await call(test, 'syn-admin', 'GET', `/api/v1/faculty/${meB.facultyId}/availability`, undefined, H(ctxF));
    check('C', 'Availability denies another faculty', crossAvailability.status === 403);
    const cccSchedule = await call(test, 'syn-admin', 'GET', '/api/v1/ccc-schedule?academicYear=2026-27', undefined, H(ctxF));
    const cccEntries = cccSchedule.data?.entries || [];
    check('C', 'CCC Schedule includes assigned and Locum', cccSchedule.status === 200 && cccEntries.length === 3 && cccEntries.some(x => x.facultyName === 'Locum') && cccEntries.some(x => x.facultyName === meA.displayName));
    check('C', 'CCC Schedule excludes the next academic year', cccEntries.length > 0 && cccEntries.every(x => x.date >= '2026-05-01' && x.endDate <= '2027-04-30'));
    check('C', 'CCC Schedule exposes only public schedule fields', cccEntries.length > 0 && cccEntries.every(x => Object.keys(x).sort().join(',') === 'blockLabel,courseCode,date,endDate,facultyName,halfDay'));
    const afc = await call(test, 'syn-admin', 'POST', '/api/v1/afc-requests', { startDate: '2027-03-08', endDate: '2027-03-09', reason: 'vacation', coverage: 'Colleague covers', contactAddress: '1 Test Way', contactPhone: '403-555-0100',
      termsAccepted: true, termsVersion: 'ucvm-afc-terms-page2-v1', termsSource: 'absence-from-campus-app.pdf#page=2',
      applicantSignature: { mode: 'typed', name: meA.displayName, uid: 'syn-faculty-a', signedAt: new Date().toISOString(), fingerprint: fingerprint(), attested: true } }, H(ctxF));
    check('C', 'faculty persona can use faculty self-service writes', [200, 201].includes(afc.status), `status ${afc.status} ${afc.data && afc.data.error ? afc.data.error.code : ''}`);
    const ops = await exec(TESTING_INSTANCE, 'VetMed-Ops', `SELECT TOP 1 ActorUid, TargetUid FROM paws.SupportOperation ORDER BY CreatedAtUtc DESC`);
    check('C', 'audit keeps the real administrator as actor', ops[0] && ops[0].ActorUid === 'syn-admin' && ops[0].TargetUid === 'syn-faculty-a', JSON.stringify(ops[0]));
    await call(test, 'syn-admin', 'POST', '/api/v1/support/end', { contextId: ctxF });
    const ended = await call(test, 'syn-admin', 'GET', '/api/v1/me', undefined, H(ctxF));
    check('C', 'ended persona context is rejected', ended.status === 403);
    const hStart = await call(test, 'syn-admin', 'POST', '/api/v1/support/start', { targetUid: 'syn-hicc', reason: 'acceptance: HICC persona' });
    const ctxH = hStart.data && hStart.data.contextId;
    const queue = await call(test, 'syn-admin', 'GET', '/api/v1/teaching-assignments/work-queue?academicYear=2026-27', undefined, H(ctxH));
    check('C', 'HICC persona sees only its own packages', queue.status === 200 && queue.data.workQueue.length > 0, `${queue.data && queue.data.workQueue && queue.data.workQueue.length} packages`);
    const hFaculty = await call(test, 'syn-admin', 'GET', '/api/v1/dashboard/faculty?academicYear=2026-27&status=all', undefined, H(ctxH));
    check('C', 'HICC persona cannot read the full faculty roster', hFaculty.status === 403);
    await exec(TESTING_INSTANCE, 'VetMed-Ops', `UPDATE paws.SupportContext SET ExpiresAtUtc = DATEADD(minute, -1, SYSUTCDATETIME()) WHERE ContextId = '${ctxH}'`);
    const expired = await call(test, 'syn-admin', 'GET', '/api/v1/me', undefined, H(ctxH));
    check('C', 'expired persona context is rejected', expired.status === 403 && expired.data.error.code === 'SUPPORT_CONTEXT_EXPIRED');
    const self = await call(test, 'syn-admin', 'GET', '/api/v1/me');
    check('C', 'returning to self restores the administrator', self.status === 200 && self.data.profile.role === 'adfa_regular' && !self.data.support);

    // Scenario F: frontend-state manipulation.
    const forged = await call(test, 'syn-faculty-a', 'GET', '/api/v1/me', undefined, H(ctxF));
    check('F', 'a non-operator cannot use a persona context header', forged.status === 403);
    const fSupport = await call(test, 'syn-faculty-a', 'POST', '/api/v1/support/start', { targetUid: 'syn-admin', reason: 'x' });
    check('F', 'a faculty user cannot start identity switching', fSupport.status === 403);
    const prodSupport = await call(prod, 'syn-admin', 'GET', '/api/v1/support');
    check('F', 'Production identity switching is unchanged (developer only)', prodSupport.status === 403 && prodSupport.data.error.code === 'DEVELOPER_REQUIRED');
    const prodDev = await call(prod, 'syn-developer', 'GET', '/api/v1/support');
    check('F', 'Production developer support still works and reports production mode', prodDev.status === 200 && prodDev.data.mode === 'developer_support');

    // Scenario P: performance smoke on the synthetic data set (documented thresholds; LocalDB on a laptop,
    // not a Production-scale measurement).
    const timed = async fn => { const t = process.hrtime.bigint(); const r = await fn(); return { r, ms: Number(process.hrtime.bigint() - t) / 1e6 }; };
    const p95 = values => values.slice().sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
    const reads = [];
    for (let i = 0; i < 20; i += 1) reads.push(await timed(() => call(test, 'syn-admin', 'GET', '/api/v1/sessions?start=2026-09-01&end=2027-04-30')));
    const readP95 = p95(reads.map(x => x.ms));
    check('P', 'full-year timetable read p95 under 3000 ms (20 sequential)', reads.every(x => x.r.status === 200) && readP95 < 3000, `p95 ${readP95.toFixed(0)} ms`);
    const parallel = await Promise.all(Array.from({ length: 10 }, () => timed(() => call(test, 'syn-admin', 'GET', '/api/v1/dashboard/summary?academicYear=2026-27'))));
    check('P', '10 concurrent Dashboard summaries all succeed, p95 under 5000 ms', parallel.every(x => x.r.status === 200) && p95(parallel.map(x => x.ms)) < 5000, `statuses ${[...new Set(parallel.map(x => x.r.status))]} p95 ${p95(parallel.map(x => x.ms)).toFixed(0)} ms`);
    const editTargets = sessions.filter(x => x.sessionType === 'LEC' && x.id !== target.id).slice(0, 5);
    const edits = await Promise.all(editTargets.map((x, i) => timed(() => call(test, 'syn-admin', 'PATCH', `/api/v1/sessions/${x.id}`, { topic: `Concurrent edit ${i}` }))));
    const persisted = (await call(test, 'syn-admin', 'GET', '/api/v1/sessions?start=2026-09-01&end=2027-04-30')).data.sessions.filter(x => /^Concurrent edit \d$/.test(x.topic)).length;
    // Safety, not throughput: every concurrent edit either commits and persists, or fails cleanly with no
    // partial write. How many fail is reported (SERIALIZABLE request transactions can refuse concurrent writers).
    const committed = edits.filter(x => x.r.status === 200).length;
    const failures = edits.filter(x => x.r.status !== 200).map(x => `${x.r.status}:${x.r.data && x.r.data.error ? x.r.data.error.code : '?'}`);
    check('P', '5 concurrent edits of different sessions commit or fail cleanly (no partial writes)', persisted === committed && failures.every(f => /^(409|503):/.test(f)), `committed ${committed}/5, persisted ${persisted}, failures ${failures.join(',') || 'none'}`);
    results.push({ scenario: 'P', name: 'concurrent session edit success rate (informational)', pass: true, informational: true, detail: `${committed}/5 committed` });

    // Scenario C2: Testing personas on the newer workflows (PR #125 I1-I3).
    const c2 = await call(test, 'syn-admin', 'POST', '/api/v1/support/start', { targetUid: 'syn-faculty-a', reason: 'acceptance: newer workflows' });
    const ctx2 = c2.data && c2.data.contextId;
    const cal = await call(test, 'syn-admin', 'GET', '/api/v1/calendar-activities?start=2026-09-01&end=2026-12-31', undefined, H(ctx2));
    check('C', 'faculty persona can open Calendar Activities in Testing', cal.status === 200, `status ${cal.status} ${cal.data && cal.data.error ? cal.data.error.code : ''}`);
    const forms = await call(test, 'syn-admin', 'GET', '/api/v1/afc-forms/capabilities', undefined, H(ctx2));
    check('C', 'faculty persona can open AFC Forms in Testing', forms.status === 200, `status ${forms.status}`);
    const ccc = await call(test, 'syn-admin', 'POST', '/api/v1/ccc-replacements', {}, H(ctx2));
    check('C', 'persona import writes are refused (run imports as yourself)', ccc.status === 403 && ccc.data.error.code === 'SUPPORT_ROUTE_DENIED', `${ccc.status}`);
    await call(test, 'syn-admin', 'POST', '/api/v1/support/end', { contextId: ctx2 });
    const fixtures = await exec(TESTING_INSTANCE, 'VetMed-Ops', `SELECT Status AS status, COUNT(*) AS n FROM paws.AfcRequest GROUP BY Status`);
    check('G', 'seeded AFC requests cover every lifecycle state', ['pending_report_to', 'pending_admin', 'approved', 'rejected', 'withdrawn'].every(st => fixtures.some(f => f.status === st)), JSON.stringify(fixtures));

    // Scenario D: Production unchanged.
    const prodAfter = await prodFingerprint();
    check('D', 'Production database unchanged after all Testing activity', JSON.stringify(prodBefore) === JSON.stringify(prodAfter), JSON.stringify(prodAfter));
    // After the Production fingerprint: this check itself starts a (Production stand-in) support context.
    const prodCal = await call(prod, 'syn-developer', 'POST', '/api/v1/support/start', { targetUid: 'syn-faculty-a', reason: 'acceptance: production list unchanged' });
    const prodCtx = prodCal.data && prodCal.data.contextId;
    const prodCalRead = await call(prod, 'syn-developer', 'GET', '/api/v1/calendar-activities?start=2026-09-01&end=2026-12-31', undefined, H(prodCtx));
    check('F', 'Production Developer Support still refuses the newer workflows', prodCalRead.status === 403 && prodCalRead.data.error.code === 'SUPPORT_ROUTE_DENIED', `${prodCalRead.status}`);
    await call(prod, 'syn-developer', 'POST', '/api/v1/support/end', { contextId: prodCtx });
  } finally {
    await prod.close(); await test.close();
  }

  // Scenario H: reset restores the baseline after UAT changes.
  const before = await exec(TESTING_INSTANCE, 'VetMed-Ops', `SELECT COUNT(*) AS n FROM paws.Session WHERE Topic = N'Edited in Testing only'`);
  await resetTool.main(['--confirm-reset'], { ...testingEnv(), PAWS_TESTING_LOCAL_ODBC: odbc(TESTING_INSTANCE, 'VetMed-Ops') }, () => {});
  const after = await exec(TESTING_INSTANCE, 'VetMed-Ops', `SELECT (SELECT COUNT(*) FROM paws.Session WHERE Topic = N'Edited in Testing only') AS edited,
    (SELECT COUNT(*) FROM paws.SupportOperation) AS supportOps, (SELECT COUNT(*) FROM paws.AfcRequest) AS afcRequests,
    (SELECT COUNT(*) FROM paws.UserProfile WHERE FirebaseUid LIKE N'syn-%' AND Active = 1) AS personas,
    (SELECT COUNT(*) FROM paws_env.EnvironmentIdentity) AS marker`);
  check('H', 'reset discards UAT edits and support operations', before[0].n === 1 && after[0].edited === 0 && after[0].supportOps === 0, JSON.stringify({ before: before[0], after: after[0] }));
  check('H', 'reset restores the workflow fixtures and test personas', after[0].afcRequests === 5 && after[0].personas >= 11 && after[0].marker === 1, JSON.stringify(after[0]));
  const readerCounts = await exec(TESTING_INSTANCE, 'VetMed-Ops', `SELECT COUNT(*) AS n FROM paws.CalendarActivity WHERE SourceSheet=N'Synthetic readers'`);
  check('H', 'reset restores the current-main reader fixtures', readerCounts[0].n === 6, `${readerCounts[0].n} activities`);

  const out = { ok: results.every(r => r.pass), total: results.length, passed: results.filter(r => r.pass).length, odbcDriver: driverName(), results };
  fs.mkdirSync(path.join(ROOT, '.azure-testing'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, '.azure-testing', 'local-acceptance.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ok: out.ok, total: out.total, passed: out.passed }));
  process.exitCode = out.ok ? 0 : 1;
}

if (require.main === module) main().catch(error => { console.error('LOCAL_ACCEPTANCE_FAILED', error.stack); process.exit(1); });
