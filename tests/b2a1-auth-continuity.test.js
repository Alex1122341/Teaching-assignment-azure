'use strict';
// BETA-R4D-12B2A1 — Timetable <-> Dashboard authentication continuity.
//
// Core rule: AUTHENTICATION SESSION != API AVAILABILITY, and
//            AUTHENTICATION SESSION != APPLICATION AUTHORIZATION RESULT.
//
// A valid Firebase login must survive transient API/dependency failures and
// authorization denials. Only explicit identity-policy failures (or explicit user
// sign-out) may destroy the Firebase session.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sourceFunction = require('../test-support/source-function.js');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const ORIGIN = 'https://itappvetopsdb01.uc.ucalgary.ca';

// A fake response shape matching what the data client expects.
function response({ status, body = {}, ok = null }) {
  return { ok: ok === null ? status >= 200 && status < 300 : ok, status, json: async () => body };
}

// ---------------------------------------------------------------------------
// A. Shared auth-continuity classification (pure: no credentials, no tokens,
//    no SQL, no Firestore).
// ---------------------------------------------------------------------------
const continuity = require('../paws-auth-continuity.js');

test('A1 auth-continuity helper performs no I/O and stores nothing', () => {
  const source = read('paws-auth-continuity.js');
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /getIdToken/);
  assert.doesNotMatch(source, /firestore/i);
});

test('A2 transient HTTP statuses and SQL_UNAVAILABLE classify as transient', () => {
  for (const status of [500, 502, 503, 504]) {
    const outcome = continuity.classifyAuthError({ status, code: 'HTTP_' + status, message: 'boom' });
    assert.equal(outcome.kind, 'transient', 'status ' + status);
  }
  const sql = continuity.classifyAuthError({ status: 503, code: 'SQL_UNAVAILABLE', message: 'SQL down' });
  assert.equal(sql.kind, 'transient');
  assert.equal(sql.recoverable, true);
});

test('A3 network/transport rejection classifies as transient', () => {
  const outcome = continuity.classifyAuthError(new TypeError('Failed to fetch'));
  assert.equal(outcome.kind, 'transient');
  assert.equal(outcome.recoverable, true);
});

test('A4 403 authorization denials classify as authorization-denied and are not recoverable by retry', () => {
  for (const code of ['ROLE_DENIED', 'PROFILE_REQUIRED', 'FACULTY_LINK_REQUIRED']) {
    const outcome = continuity.classifyAuthError({ status: 403, code, message: 'denied' });
    assert.equal(outcome.kind, 'authorization-denied', code);
    assert.equal(outcome.recoverable, false);
  }
  const inactive = continuity.classifyAuthError({ code: 'ACCOUNT_INACTIVE', message: 'inactive' });
  assert.equal(inactive.kind, 'authorization-denied');
  assert.equal(inactive.recoverable, false);
});

test('A5 401 / UNAUTHENTICATED classifies as reauth-required and never as transient', () => {
  for (const code of ['UNAUTHENTICATED', 'SESSION_REAUTH_REQUIRED', 'TOKEN_REFRESH_FAILED']) {
    const outcome = continuity.classifyAuthError({ status: 401, code, message: 'nope' });
    assert.equal(outcome.kind, 'reauth-required', code);
    assert.equal(outcome.recoverable, false);
  }
});

test('A6 PASSWORD_CHANGE_REQUIRED classifies separately', () => {
  const outcome = continuity.classifyAuthError({ status: 403, code: 'PASSWORD_CHANGE_REQUIRED', message: 'change' });
  assert.equal(outcome.kind, 'password-change-required');
});

test('A7 unknown failures classify as unexpected but still fail closed', () => {
  const outcome = continuity.classifyAuthError({ status: 418, code: 'TEAPOT', message: '?' });
  assert.equal(outcome.kind, 'unexpected');
  assert.equal(typeof outcome.message, 'string');
  assert.ok(outcome.message.length > 0);
});

test('A8 every classification carries a non-destructive message', () => {
  const source = read('paws-auth-continuity.js');
  assert.doesNotMatch(source, /signOut/i);
});

// ---------------------------------------------------------------------------
// B. Common API client: 401 -> forced token refresh -> exactly one retry.
// ---------------------------------------------------------------------------
const { createPawsAzureDataClient } = require('../paws-data-client.js');

function client({ responses, refreshFails = false }) {
  const attempts = [];
  const tokenCalls = [];
  let index = 0;
  return {
    attempts,
    tokenCalls,
    client: createPawsAzureDataClient({
      tokenProvider: async options => {
        tokenCalls.push(options);
        if (options && options.forceRefresh === true) {
          if (refreshFails) throw new Error('token refresh failed');
        }
        return options && options.forceRefresh === true ? 'refreshed-token' : 'normal-token';
      },
      fetchImpl: async (url, init) => {
        attempts.push({ url, auth: init.headers.Authorization, method: init.method, body: init.body });
        const next = responses[Math.min(index, responses.length - 1)];
        index += 1;
        if (next instanceof Error) throw next;
        return next;
      }
    })
  };
}

test('B1 normal request uses the normal token and performs exactly one fetch with no forced refresh', async () => {
  const harness = client({ responses: [response({ status: 200, body: { profile: { role: 'faculty' } } })] });
  const profile = await harness.client.currentUser();
  assert.equal(profile.role, 'faculty');
  assert.equal(harness.attempts.length, 1);
  assert.equal(harness.attempts[0].auth, 'Bearer normal-token');
  assert.equal(harness.tokenCalls.filter(c => c && c.forceRefresh === true).length, 0);
});

test('B2 first 401 forces one token refresh and retries the same request exactly once', async () => {
  const harness = client({
    responses: [
      response({ status: 401, body: { error: { code: 'UNAUTHENTICATED', message: 'stale' } } }),
      response({ status: 200, body: { profile: { role: 'adfa_general' } } })
    ]
  });
  const profile = await harness.client.currentUser();
  assert.equal(profile.role, 'adfa_general');
  assert.equal(harness.attempts.length, 2, 'exactly one retry');
  assert.equal(harness.attempts[0].auth, 'Bearer normal-token');
  assert.equal(harness.attempts[1].auth, 'Bearer refreshed-token');
  assert.equal(harness.attempts[1].url, harness.attempts[0].url, 'same request replayed');
  assert.equal(harness.attempts[1].method, harness.attempts[0].method);
  assert.equal(harness.tokenCalls.filter(c => c && c.forceRefresh === true).length, 1, 'exactly one forced refresh');
});

test('B3 second 401 stops after two attempts with one forced refresh and no third request', async () => {
  const harness = client({
    responses: [
      response({ status: 401, body: { error: { code: 'UNAUTHENTICATED', message: 'stale' } } }),
      response({ status: 401, body: { error: { code: 'UNAUTHENTICATED', message: 'still stale' } } }),
      response({ status: 200, body: { profile: { role: 'faculty' } } })
    ]
  });
  await assert.rejects(
    harness.client.currentUser(),
    error => error.code === 'SESSION_REAUTH_REQUIRED' || error.code === 'UNAUTHENTICATED'
  );
  assert.equal(harness.attempts.length, 2, 'no third request');
  assert.equal(harness.tokenCalls.filter(c => c && c.forceRefresh === true).length, 1, 'no repeated forced refresh');
});

test('B4 403 does not refresh the token and preserves status, code and message', async () => {
  const harness = client({ responses: [response({ status: 403, body: { error: { code: 'ROLE_DENIED', message: 'no' } } })] });
  await assert.rejects(harness.client.currentUser(), error => {
    assert.equal(error.status, 403);
    assert.equal(error.code, 'ROLE_DENIED');
    assert.equal(error.message, 'no');
    return true;
  });
  assert.equal(harness.attempts.length, 1);
  assert.equal(harness.tokenCalls.filter(c => c && c.forceRefresh === true).length, 0);
});

test('B5 503 does not refresh the token and preserves SQL_UNAVAILABLE', async () => {
  const harness = client({ responses: [response({ status: 503, body: { error: { code: 'SQL_UNAVAILABLE', message: 'down' } } })] });
  await assert.rejects(harness.client.currentUser(), error => {
    assert.equal(error.status, 503);
    assert.equal(error.code, 'SQL_UNAVAILABLE');
    return true;
  });
  assert.equal(harness.attempts.length, 1);
  assert.equal(harness.tokenCalls.filter(c => c && c.forceRefresh === true).length, 0);
});

test('B6 network rejection does not refresh the token and does not retry', async () => {
  const harness = client({ responses: [new TypeError('Failed to fetch')] });
  await assert.rejects(harness.client.currentUser(), error => error instanceof TypeError);
  assert.equal(harness.attempts.length, 1);
  assert.equal(harness.tokenCalls.filter(c => c && c.forceRefresh === true).length, 0);
});

test('B7 forced token refresh failure is bounded and issues no request loop', async () => {
  const harness = client({
    responses: [response({ status: 401, body: { error: { code: 'UNAUTHENTICATED', message: 'stale' } } })],
    refreshFails: true
  });
  await assert.rejects(harness.client.currentUser(), error => {
    assert.match(String(error.code || ''), /REAUTH|REFRESH|UNAUTHENTICATED/);
    return true;
  });
  assert.equal(harness.attempts.length, 1, 'no retry after a failed refresh');
});

test('B8 POST with a first 401 may retry exactly once because the server rejected it as unauthenticated', async () => {
  const harness = client({
    responses: [
      response({ status: 401, body: { error: { code: 'UNAUTHENTICATED', message: 'stale' } } }),
      response({ status: 200, body: { afcRecord: { afcRecordId: 'new-1' } } })
    ]
  });
  const result = await harness.client.createDashboardAfcRecord({ facultyId: 'F1' });
  assert.equal(result.afcRecordId, 'new-1');
  assert.equal(harness.attempts.length, 2);
  assert.equal(harness.attempts[1].body, harness.attempts[0].body, 'same body replayed');
});

test('B9 POST is never replayed on network failure or 5xx', async () => {
  const network = client({ responses: [new TypeError('Failed to fetch')] });
  await assert.rejects(network.client.createDashboardAfcRecord({ facultyId: 'F1' }));
  assert.equal(network.attempts.length, 1, 'no POST replay after network failure');

  for (const status of [500, 502, 503, 504]) {
    const five = client({ responses: [response({ status, body: { error: { code: 'HTTP_' + status } } })] });
    await assert.rejects(five.client.createDashboardAfcRecord({ facultyId: 'F1' }));
    assert.equal(five.attempts.length, 1, 'no POST replay after ' + status);
  }
});

test('B10 data client introduces no background retry loop', () => {
  const source = read('paws-data-client.js');
  assert.doesNotMatch(source, /setInterval/);
  assert.doesNotMatch(source, /while\s*\(\s*true\s*\)/);
});

// ---------------------------------------------------------------------------
// C. Timetable bootstrap must not destroy the Firebase login.
// ---------------------------------------------------------------------------
function runApplyAccessFailure(error) {
  const src = sourceFunction('timetable.js', 'applyAccessFailure');
  const calls = { signOut: 0, locked: [], recovery: [], toasts: [], status: [] };
  const sandbox = {
    window: { UCVM_AUTH_CONTINUITY: continuity },
    console,
    hooks: {
      setLocked: (locked, message) => calls.locked.push({ locked, message }),
      setRecovery: action => calls.recovery.push(action),
      toast: (message, isError) => calls.toasts.push({ message, isError }),
      setStatus: value => calls.status.push(value),
      signOut: async () => { calls.signOut += 1; },
      retryAccess: 'retry'
    },
    Error,
    String,
    Number,
    Boolean,
    Object,
    Array
  };
  sandbox.globalThis = sandbox;
  const vm = require('node:vm');
  const context = vm.createContext(sandbox);
  const fn = vm.runInContext(`(async (error, hooks) => { ${src}\n return applyAccessFailure(error, hooks); })`, context);
  return fn(error, sandbox.hooks).then(outcome => ({ outcome, calls }));
}

test('C1 transient bootstrap failure does NOT sign out and stays locked with a recoverable message', async () => {
  const { outcome, calls } = await runApplyAccessFailure({ status: 503, code: 'SQL_UNAVAILABLE', message: 'SQL down' });
  assert.equal(calls.signOut, 0);
  assert.equal(outcome.kind, 'transient');
  assert.deepEqual(calls.locked, [{ locked: true, message: outcome.message }]);
  assert.deepEqual(calls.recovery, ['retry'], 'offers exactly the bounded Retry access action');
});

test('C2 503 / SQL_UNAVAILABLE does NOT sign out', async () => {
  const { calls } = await runApplyAccessFailure({ status: 503, code: 'SQL_UNAVAILABLE', message: 'down' });
  assert.equal(calls.signOut, 0);
});

test('C3 403 authorization denial does NOT sign out and offers no Retry access', async () => {
  const { outcome, calls } = await runApplyAccessFailure({ status: 403, code: 'ROLE_DENIED', message: 'denied' });
  assert.equal(calls.signOut, 0);
  assert.equal(outcome.kind, 'authorization-denied');
  assert.equal(outcome.recoverable, false);
  assert.equal(calls.locked[0].locked, true, 'fails closed');
  assert.deepEqual(calls.recovery, [null], 'authorization denial must not offer Retry access');
});

test('C4 reauth-required does NOT automatically sign out or offer Retry access', async () => {
  const { outcome, calls } = await runApplyAccessFailure({ status: 401, code: 'SESSION_REAUTH_REQUIRED', message: 'verify' });
  assert.equal(calls.signOut, 0);
  assert.equal(outcome.kind, 'reauth-required');
  assert.equal(outcome.recoverable, false);
  assert.deepEqual(calls.recovery, [null], 'reauth-required must not offer Retry access');
});

test('C4a inactive account is a structured authorization denial, stays locked, never signs out and offers no Retry access', async () => {
  const src = sourceFunction('faculty-access.js', 'ready');
  const vm = require('node:vm');
  const sandbox = {
    window: { __ucvmSessionGuard: { blocked: false } },
    location: { replace() { throw new Error('inactive account must not redirect to password flow'); } },
    installLandingReset() {},
    linkFacultyIdentity: async () => {},
    clearLegacyAdminLanding() {},
    Error
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  const fn = vm.runInContext(`(async profile => { ${src}\n return ready({ uid: 'u1' }, profile); })`, context);
  let failure;
  try { await fn({ active: false, mustChangePassword: false }); } catch (error) { failure = error; }
  assert.ok(failure, 'inactive profile must fail closed');
  assert.equal(failure.code, 'ACCOUNT_INACTIVE');
  const { outcome, calls } = await runApplyAccessFailure(failure);
  assert.equal(outcome.kind, 'authorization-denied');
  assert.equal(outcome.recoverable, false);
  assert.equal(calls.signOut, 0);
  assert.deepEqual(calls.recovery, [null]);
  assert.deepEqual(calls.locked, [{ locked: true, message: outcome.message }]);
});

test('C4b active profile behavior remains unchanged while optional faculty enrichment is no longer blocking', async () => {
  const src = sourceFunction('faculty-access.js', 'ready');
  const vm = require('node:vm');
  const calls = { landing: 0, enrich: 0, clear: 0 };
  const sandbox = {
    window: { __ucvmSessionGuard: { blocked: false } },
    location: { replace() { throw new Error('active profile must not redirect'); } },
    installLandingReset() { calls.landing += 1; },
    async enrichFacultyIdentity() { calls.enrich += 1; },
    clearLegacyAdminLanding() { calls.clear += 1; },
    Error
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  const fn = vm.runInContext(`(async profile => { ${src}\n return ready({ uid: 'u1' }, profile); })`, context);
  assert.equal(await fn({ active: true, mustChangePassword: false }), true);
  assert.deepEqual(calls, { landing: 1, enrich: 0, clear: 1 });
});

test('C4c password-change-required does not offer Retry access or sign out', async () => {
  const { outcome, calls } = await runApplyAccessFailure({ status: 403, code: 'PASSWORD_CHANGE_REQUIRED', message: 'change' });
  assert.equal(outcome.kind, 'password-change-required');
  assert.equal(outcome.recoverable, false);
  assert.equal(calls.signOut, 0);
  assert.deepEqual(calls.recovery, [null]);
});

test('C5 timetable bootstrap catch contains no automatic signOut', () => {
  const source = read('timetable.js');
  const start = source.indexOf('async function applyAccessFailure');
  assert.notEqual(start, -1, 'applyAccessFailure must exist');
  const end = source.indexOf('\n  }', start);
  const body = source.slice(start, end);
  assert.doesNotMatch(body, /signOut/i);
});

test('C6 explicit identity-policy sign-outs remain in the timetable auth path', () => {
  const source = read('timetable.js');
  assert.match(source, /isAllowedEmail[\s\S]{0,400}signOut/, 'disallowed email domain still signs out');
  assert.match(source, /isAllowedPhone[\s\S]{0,400}signOut/, 'disallowed phone still signs out');
  assert.match(source, /neither an email nor a phone number[\s\S]{0,200}signOut|signOut[\s\S]{0,200}neither an email nor a phone number/, 'identity without email/phone still signs out');
});

test('C7 Firebase LOCAL persistence is retained', () => {
  const source = read('timetable.js');
  assert.match(source, /setPersistence\(\s*firebase\.auth\.Auth\.Persistence\.LOCAL\s*\)/);
  assert.doesNotMatch(source, /Persistence\.SESSION\b/);
  assert.doesNotMatch(source, /Persistence\.NONE\b/);
});

test('C8 no token is persisted or exposed by PAWS code', () => {
  for (const file of ['timetable.js', 'paws-data-client.js', 'paws-auth-continuity.js']) {
    const source = read(file);
    assert.doesNotMatch(source, /localStorage\.setItem\(\s*['"][^'"]*token/i, file);
    assert.doesNotMatch(source, /sessionStorage\.setItem\(\s*['"][^'"]*token/i, file);
  }
});

// ---------------------------------------------------------------------------
// D. Faculty Dashboard navigation capability.
// ---------------------------------------------------------------------------
function runCanOpenFacultyDashboard(roleValue) {
  const src = sourceFunction('faculty-access.js', 'canOpenFacultyDashboard');
  // Replicate the role-normalization logic faithfully so the extracted function runs.
  const sandbox = {
    String, Object, Array, Boolean,
    DASHBOARD_ROLES: ['adfa_general', 'adfa_regular', 'faculty', 'hicc', 'visc'],
    role: (r) => {
      const raw = String((r && typeof r === 'object' ? r.role : r) || '').toLowerCase();
      return ({ owner: 'adfa_general', administrator: 'adfa_regular', other_office: 'other_office', adfa_general: 'adfa_general', adfa_regular: 'adfa_regular', admin: 'adfa_regular', editor: 'faculty', viewer: 'faculty' }[raw] || raw);
    }
  };
  sandbox.globalThis = sandbox;
  const vm = require('node:vm');
  const context = vm.createContext(sandbox);
  const fn = vm.runInContext(`(profile => { ${src}\n return canOpenFacultyDashboard(profile); })`, context);
  return fn({ role: roleValue });
}

test('D1 administrators may open the Faculty Dashboard', () => {
  assert.equal(runCanOpenFacultyDashboard('adfa_general'), true);
  assert.equal(runCanOpenFacultyDashboard('adfa_regular'), true);
});

test('D2 self-service roles may open the Faculty Dashboard in self-service mode', () => {
  assert.equal(runCanOpenFacultyDashboard('faculty'), true);
  assert.equal(runCanOpenFacultyDashboard('hicc'), true);
  assert.equal(runCanOpenFacultyDashboard('visc'), true);
});

test('D3 legacy role aliases still resolve', () => {
  assert.equal(runCanOpenFacultyDashboard('owner'), true);
  assert.equal(runCanOpenFacultyDashboard('administrator'), true);
  assert.equal(runCanOpenFacultyDashboard('editor'), true);
  assert.equal(runCanOpenFacultyDashboard('viewer'), true);
});

test('D4 unauthorized and retired roles may not open the Faculty Dashboard', () => {
  assert.equal(runCanOpenFacultyDashboard('other_office'), false);
  assert.equal(runCanOpenFacultyDashboard('student'), false);
  assert.equal(runCanOpenFacultyDashboard('guest'), false);
  assert.equal(runCanOpenFacultyDashboard(''), false);
  assert.equal(runCanOpenFacultyDashboard(null), false);
  assert.equal(runCanOpenFacultyDashboard(undefined), false);
});

test('D4a production Dashboard role allowlist excludes retired other_office and preserves current roles', () => {
  const source = read('faculty-access.js');
  const match = source.match(/const DASHBOARD_ROLES=\[([^\]]+)\]/);
  assert.ok(match, 'Dashboard role allowlist must be explicit');
  const body = match[1];
  for (const role of ['adfa_general', 'adfa_regular', 'faculty', 'hicc', 'visc']) assert.match(body, new RegExp(`['\"]${role}['\"]`), role);
  assert.doesNotMatch(body, /['\"]other_office['\"]/);
});

test('D5 Dashboard navigation capability is no longer driven by UCVM.admin() alone', () => {
  const source = read('timetable.js');
  assert.match(source, /canOpenFacultyDashboard/);
});

test('D6 button visibility and click behaviour share one capability helper', () => {
  const source = read('timetable.js');
  const visibility = source.slice(source.indexOf('faculty-dashboard-btn'), source.indexOf('faculty-dashboard-btn') + 4000);
  assert.match(visibility, /canOpenFacultyDashboard/);
});

test('D7 static script order keeps Firebase Auth and data/auth helpers ahead of timetable bootstrap', () => {
  const html = read('index.html');
  const auth = html.indexOf('firebase-auth-compat.js');
  const data = html.indexOf('paws-data-client.js');
  const continuity = html.indexOf('paws-auth-continuity.js');
  const timetable = html.indexOf('timetable.js');
  for (const [name, index] of [['firebase auth', auth], ['data client', data], ['continuity helper', continuity], ['timetable', timetable]]) assert.notEqual(index, -1, name);
  assert.ok(auth < data, 'Firebase Auth must load before data-client auth usage');
  assert.ok(data < timetable, 'data client must load before timetable bootstrap');
  assert.ok(continuity < timetable, 'auth-continuity helper must load before timetable bootstrap');
});

test('D8 Faculty Dashboard loads shared auth/data helpers before its controller', () => {
  const html = read('faculty-admin.html');
  const auth = html.indexOf('firebase-auth-compat.js');
  const data = html.indexOf('paws-data-client.js');
  const continuity = html.indexOf('paws-auth-continuity.js');
  const controller = html.indexOf('faculty-admin.js');
  for (const [name, index] of [['firebase auth', auth], ['data client', data], ['continuity helper', continuity], ['faculty-admin controller', controller]]) assert.notEqual(index, -1, name);
  assert.ok(auth < data, 'Firebase Auth must load before data client');
  assert.ok(data < controller, 'data client must load before Faculty Dashboard controller');
  assert.ok(continuity < controller, 'auth-continuity helper must load before Faculty Dashboard controller');
});

// ---------------------------------------------------------------------------
// E. Session guard must not treat normal navigation as reload abuse.
// ---------------------------------------------------------------------------
const guard = require('../session-guard.js');

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: key => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

test('E1 five actual reloads remain allowed and the sixth is blocked', () => {
  const storage = memoryStorage();
  for (let i = 1; i <= 5; i += 1) {
    assert.equal(guard.recordReload(storage, Date.now(), true).allowed, true, 'reload ' + i);
  }
  const sixth = guard.recordReload(storage, Date.now(), true);
  assert.equal(sixth.allowed, false, 'sixth reload blocked');
  assert.ok(sixth.retryAfterMs > 0);
});

test('E2 normal cross-page navigation is not counted as a reload', () => {
  const storage = memoryStorage();
  for (let i = 0; i < 20; i += 1) {
    const result = guard.recordReload(storage, Date.now(), false);
    assert.equal(result.allowed, true, 'navigation ' + i);
    assert.equal(result.count, 0, 'navigation must not increment the reload count');
  }
});

test('E3 a navigate-type performance entry is not a reload navigation', () => {
  assert.equal(guard.isReloadNavigation({ getEntriesByType: () => [{ type: 'navigate' }] }), false);
  assert.equal(guard.isReloadNavigation({ getEntriesByType: () => [{ type: 'reload' }] }), true);
  assert.equal(guard.isReloadNavigation({ navigation: { type: 1 } }), true);
  assert.equal(guard.isReloadNavigation({ navigation: { type: 0 } }), false);
});

test('E4 one-hour idle policy is preserved', () => {
  const now = Date.now();
  assert.equal(guard.isIdle(now - (59 * 60 * 1000), now), false);
  assert.equal(guard.isIdle(now - (61 * 60 * 1000), now), true);
  assert.equal(guard.isIdle(NaN, now), false);
});

test('E5 session guard constants remain unchanged', () => {
  assert.equal(guard.constants.MAX_RELOADS, 5);
  assert.equal(guard.constants.RELOAD_WINDOW_MS, 60000);
  assert.equal(guard.constants.IDLE_TIMEOUT_MS, 3600000);
});
