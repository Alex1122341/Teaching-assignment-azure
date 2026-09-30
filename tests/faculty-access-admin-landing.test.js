'use strict';
// BETA-R4D-9H — administrator timetable access / forced Dashboard redirect regression.
//
// The defect: on index.html an authorized admin (adfa_general / adfa_regular) had
// UCVM.ready() return false in order to schedule an automatic redirect to
// faculty-admin.html. timetable.js treats a false return as "abort login", so the gate
// stayed on "Checking your timetable access..." and the user was bounced to the Dashboard.
//
// These tests execute the REAL production ready() in isolation (via the shared
// source-function harness) with stubbed collaborators, so they fail against the pre-fix
// source and pass after it.

const test = require('node:test');
const assert = require('node:assert/strict');
const sourceFunction = require('../test-support/source-function.js');

const FILE = 'faculty-access.js';

// ---------------------------------------------------------------------------
// Harness: run the production `ready()` with a controlled environment.
// ---------------------------------------------------------------------------
function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: key => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    has: key => values.has(key),
    dump: () => Object.fromEntries(values),
  };
}

function runReady({ profile, user, sessionGuard, storage, pathname } = {}) {
  const src = sourceFunction(FILE, 'ready');
  const replaced = [];
  const sandbox = {
    window: { __ucvmSessionGuard: sessionGuard, __ucvmAdminLandingScheduled: undefined },
    location: {
      pathname: pathname || '/index.html',
      replace: target => replaced.push(target),
    },
    sessionStorage: storage,
    // ready() collaborators, stubbed — none of them should redirect.
    installLandingReset: () => {},
    clearLegacyAdminLanding: () => {
      try { sandbox.sessionStorage.removeItem('ucvm-admin-default-landing'); } catch (_) {}
      sandbox.window.__ucvmAdminLandingScheduled = false;
    },
    linkFacultyIdentity: async () => {},
    Error,
  };
  sandbox.globalThis = sandbox;

  const vm = require('node:vm');
  const context = vm.createContext(sandbox);
  vm.runInContext(src, context);
  return {
    replaced,
    window: sandbox.window,
    storage,
    invoke: () => context.ready(user || { uid: 'uid-A' }, profile),
  };
}

const ADFA_GENERAL = { role: 'adfa_general', active: true, mustChangePassword: false };
const ADFA_REGULAR = { role: 'adfa_regular', active: true, mustChangePassword: false };

// ---------------------------------------------------------------------------
// A–F: every authorized role stays on the timetable, ready() === true, no redirect.
// ---------------------------------------------------------------------------
const AUTHORIZED = [
  ['A. ADFA General', ADFA_GENERAL],
  ['B. ADFA Regular', ADFA_REGULAR],
  ['C. legacy owner', { role: 'owner', active: true, mustChangePassword: false }],
  ['C. legacy administrator', { role: 'administrator', active: true, mustChangePassword: false }],
  ['C. legacy admin', { role: 'admin', active: true, mustChangePassword: false }],
  ['D. Faculty', { role: 'faculty', active: true, mustChangePassword: false }],
  ['E. HICC', { role: 'hicc', active: true, mustChangePassword: false }],
  ['F. VISC', { role: 'visc', active: true, mustChangePassword: false }],
  ['G. editor', { role: 'editor', active: true, mustChangePassword: false }],
  ['G. viewer', { role: 'viewer', active: true, mustChangePassword: false }],
];

for (const [name, profile] of AUTHORIZED) {
  test(`${name} on index.html: ready() is true and no forced redirect is scheduled`, async () => {
    const h = runReady({ profile, storage: memoryStorage() });
    assert.equal(await h.invoke(), true, 'ready() must return true so timetable.js continues');
    assert.deepEqual(h.replaced, [], 'no location.replace may be scheduled');
  });
}

test('A. ADFA General on index.html: no faculty-admin redirect even after the legacy 900ms window', async () => {
  const h = runReady({ profile: ADFA_GENERAL, storage: memoryStorage() });
  assert.equal(await h.invoke(), true);
  // The old defect used a 900ms setTimeout. Real timers would fire here if still present.
  await new Promise(resolve => setTimeout(resolve, 950));
  assert.deepEqual(h.replaced, [], 'nothing may redirect to the Dashboard asynchronously');
  assert.notEqual(String(h.window.__ucvmAdminLandingScheduled), 'true');
});

// ---------------------------------------------------------------------------
// G: inactive account is still rejected.
// ---------------------------------------------------------------------------
test('G. inactive account still throws and does not unlock', async () => {
  const h = runReady({ profile: { role: 'adfa_general', active: false }, storage: memoryStorage() });
  await assert.rejects(h.invoke(), /inactive/i);
  assert.deepEqual(h.replaced, []);
});

// ---------------------------------------------------------------------------
// H: mustChangePassword still redirects to password.html and returns false.
// ---------------------------------------------------------------------------
test('H. mustChangePassword still redirects to password.html and ready() is false', async () => {
  const h = runReady({ profile: { role: 'adfa_general', active: true, mustChangePassword: true }, storage: memoryStorage() });
  assert.equal(await h.invoke(), false);
  assert.deepEqual(h.replaced, ['password.html']);
  assert.ok(!h.replaced.includes('faculty-admin.html'));
});

// ---------------------------------------------------------------------------
// I: a blocked SessionGuard still returns false.
// ---------------------------------------------------------------------------
test('I. blocked SessionGuard still yields ready() === false', async () => {
  const h = runReady({ profile: ADFA_GENERAL, sessionGuard: { blocked: true }, storage: memoryStorage() });
  assert.equal(await h.invoke(), false);
  assert.deepEqual(h.replaced, []);
});

// ---------------------------------------------------------------------------
// J: stale landing storage must not prevent timetable access.
// ---------------------------------------------------------------------------
test('J. stale ucvm-admin-default-landing=<uid> does not block the timetable', async () => {
  const storage = memoryStorage({ 'ucvm-admin-default-landing': 'uid-A' });
  const h = runReady({ profile: ADFA_GENERAL, storage, user: { uid: 'uid-A' } });
  assert.equal(await h.invoke(), true, 'a stale key must not gate access');
  assert.deepEqual(h.replaced, []);
  assert.equal(storage.getItem('ucvm-admin-default-landing'), null, 'the stale key must be cleared');
});

test('J. stale key belonging to a DIFFERENT uid is also harmless', async () => {
  const storage = memoryStorage({ 'ucvm-admin-default-landing': 'someone-else' });
  const h = runReady({ profile: ADFA_GENERAL, storage, user: { uid: 'uid-A' } });
  assert.equal(await h.invoke(), true);
  assert.deepEqual(h.replaced, []);
});

test('J. a pre-set __ucvmAdminLandingScheduled flag cannot arm a redirect', async () => {
  const h = runReady({ profile: ADFA_GENERAL, storage: memoryStorage() });
  h.window.__ucvmAdminLandingScheduled = true;
  assert.equal(await h.invoke(), true);
  await new Promise(resolve => setTimeout(resolve, 950));
  assert.deepEqual(h.replaced, []);
});

// ---------------------------------------------------------------------------
// Section 11 — end-to-end source contract: auth → profile → ready → unlock reachable.
// ---------------------------------------------------------------------------
test('the timetable login path proceeds past UCVM.ready to unlock and render', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'timetable.js'), 'utf8');
  const lockAt = src.indexOf("setAppLocked(true, 'Checking your timetable access...')");
  assert.ok(lockAt > 0, 'the gate must be set to the timetable-access message while checking');
  const start = src.indexOf('const profile = await getRoleProfile(user)');
  assert.ok(start > lockAt, 'the SQL role profile must be fetched while the gate is up');
  const body = src.slice(start, start + 1400);
  // ready() must NOT abort the flow for an authorized admin.
  assert.match(body, /if \(!await UCVM\.ready\(user, profile\)\) return;/);
  // ...and the flow must continue all the way to unlock + Azure SQL session load + render.
  assert.match(body, /currentUser = \{/);
  assert.match(body, /subscribeSessions\(\)/);
  assert.match(body, /render\(\)/);
  assert.match(body, /setAppLocked\(false\)/);
  assert.ok(
    body.indexOf('subscribeSessions()') < body.indexOf('setAppLocked(false)'),
    'sessions must be subscribed before the gate is released'
  );
});

test('no automatic admin landing remains anywhere in the login path', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const access = fs.readFileSync(path.resolve(__dirname, '..', 'faculty-access.js'), 'utf8');
  assert.doesNotMatch(access, /if\(scheduleAdminLanding\(user,p\)\)return false/);
  assert.doesNotMatch(access, /location\.replace\('faculty-admin\.html'\)/);
  assert.doesNotMatch(access, /setTimeout\(\(\)=>\{[^}]*faculty-admin\.html/s);
  // The retired marker may only ever be CLEARED, never written.
  assert.doesNotMatch(access, /sessionStorage\.setItem\('ucvm-admin-default-landing'/);
});

// ---------------------------------------------------------------------------
// K / L: explicit Dashboard navigation is preserved, and gated by the B2A Dashboard capability.
// ---------------------------------------------------------------------------
test('K. the explicit Faculty Dashboard button still navigates through the shared B2A capability', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'timetable.js'), 'utf8');
  assert.match(src, /\$\('faculty-dashboard-btn'\)\.addEventListener\('click',[\s\S]{0,180}UCVM\.canOpenFacultyDashboard\(currentUser\)[\s\S]{0,100}faculty-admin\.html/);
});

test('L. unauthorized users still cannot reach Dashboard', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'faculty-access.js'), 'utf8');
  // UCVM.admin() must still be the gate, and must exclude faculty/plain users.
  const adminLine = src.split('\n').find(l => l.includes('const admin='));
  assert.ok(adminLine, 'UCVM.admin must exist');
  assert.match(adminLine, /adfa_general/);
  assert.match(adminLine, /adfa_regular/);
  assert.doesNotMatch(adminLine, /'faculty'/);
  assert.doesNotMatch(adminLine, /'hicc'/);
  assert.doesNotMatch(adminLine, /'visc'/);
});

test('K. the Dashboard button visibility uses the shared B2A capability', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'timetable.js'), 'utf8');
  assert.match(src, /\$\('faculty-dashboard-btn'\)\.classList\.toggle\('hidden',\s*!UCVM\.canOpenFacultyDashboard\(currentUser\)\)/);
});
