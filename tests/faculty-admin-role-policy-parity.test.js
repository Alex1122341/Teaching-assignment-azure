'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
// BETA-R4D-10B Stage 3C1 — retired role access policy alignment.
//
// The Dashboard controller must never authorize a role that the locked
// server Dashboard API denies. These tests read the REAL server policy from
// server/src/data/dashboard-api.js and compare it with the REAL frontend
// helpers executed in a vm sandbox.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const root = repositoryPath(__dirname, '..');
const read = file => fs.readFileSync(repositoryPath(root, file), 'utf8');
const ADMIN_SOURCE = read('faculty-admin.js');
const ACCESS_SOURCE = read('faculty-access.js');
const SERVER_SOURCE = read('server/src/data/dashboard-api.js');
const ROLE_POLICY = require('../server/src/auth/role-policy');

const ADMIN_PROFILE = { displayName: 'Admin User', role: 'adfa_general', facultyId: null, active: true, mustChangePassword: false };
const OTHER_OFFICE_PROFILE = { displayName: 'Office User', role: 'other_office', facultyId: null, active: true, mustChangePassword: false };
const GATE_DENIED = 'This account does not have Faculty Dashboard access.';

// ---------------------------------------------------------- backend policy
function backendRoleSet(name) {
  const set = name === 'ADMIN_ROLES' ? ROLE_POLICY.ADMINISTRATOR_ROLES : ROLE_POLICY.SELF_SERVICE_ROLES;
  assert.ok(set instanceof Set, `${name} must come from the shared server role policy`);
  return [...set];
}
const BACKEND_ADMIN = backendRoleSet('ADMIN_ROLES');
const BACKEND_SELF = backendRoleSet('SELF_SERVICE_ROLES');

// ---------------------------------------------------------- frontend policy
function frontendPolicy() {
  const names = ['dashboardRawRole', 'dashboardRole', 'dashboardAdmin', 'dashboardGeneral', 'dashboardRoleLabel', 'isSelfServiceProfile'];
  const src = names.map(name => {
    const idx = ADMIN_SOURCE.indexOf(`function ${name}(`);
    assert.ok(idx >= 0, `${name} must exist`);
    const brace = ADMIN_SOURCE.indexOf('{', idx);
    let depth = 0, end = -1;
    for (let i = brace; i < ADMIN_SOURCE.length; i++) {
      const c = ADMIN_SOURCE[i];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    return ADMIN_SOURCE.slice(idx, end + 1);
  }).join('\n');
  return vm.runInNewContext(`${src}\n({dashboardRole,dashboardAdmin,dashboardGeneral,dashboardRoleLabel,isSelfServiceProfile});`);
}
const FE = frontendPolicy();
const SHARED_ROLE_LABEL = (() => {
  const match = /const label=r=>([^\n]+);/.exec(ACCESS_SOURCE);
  assert.ok(match, 'the shared faculty access helper must expose its display-label mapping');
  return vm.runInNewContext(`(r=>{const rawRole=r=>String((r&&typeof r==='object'?r.role:r)||'').toLowerCase();return ${match[1]};})`);
})();

// ------------------------------------------------------------ vm harness
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(r => setTimeout(r, 0)); };

function createHarness(currentUser) {
  const calls = [], errors = [];
  let authCallback = null, signOuts = 0;
  const classList = () => {
    const set = new Set();
    return { add(c) { set.add(c); }, remove(c) { set.delete(c); }, toggle(c, v) { if (v === undefined) { set.has(c) ? set.delete(c) : set.add(c); } else if (v) set.add(c); else set.delete(c); }, contains(c) { return set.has(c); } };
  };
  const element = id => ({ id, classList: classList(), dataset: {}, style: {}, value: '', textContent: '', innerHTML: '', disabled: false, options: [], children: [], onclick: null, oninput: null, onchange: null, onsubmit: null, setAttribute() {}, addEventListener(event, handler) { this[`on${event}`] = handler; }, appendChild() {}, remove() {}, click() {}, querySelectorAll() { return []; }, querySelector() { return null; } });
  const nodes = new Map();
  const byId = id => { if (!nodes.has(id)) nodes.set(id, element(id)); return nodes.get(id); };
  const auth = { setPersistence: async () => {}, onAuthStateChanged(cb) { authCallback = cb; }, async signOut() { signOuts += 1; } };
  const firebaseAuth = Object.assign(function () { return auth; }, { Auth: { Persistence: { LOCAL: 'local' } } });
  const pawsData = {
    currentUser: async () => { calls.push('currentUser'); return currentUser; },
    dashboardSummary: async () => { calls.push('dashboardSummary'); return {}; },
    dashboardFaculty: async () => { calls.push('dashboardFaculty'); return currentUser && currentUser.facultyId ? [{ facultyId: currentUser.facultyId, displayName: 'Bo Two', sessionCount: 0, roleCount: 0, afcCount: 0 }] : []; },
    dashboardFacultyById: async id => { calls.push('dashboardFacultyById:' + id); return {}; },
    listSessions: async () => []
  };
  const document = {
    title: '', documentElement: { dataset: {} }, body: element('body'), head: { appendChild() {} },
    getElementById: byId,
    querySelector: selector => byId('query:' + selector),
    querySelectorAll: () => [],
    createElement: () => element('created')
  };
  const window = { UCVMSessionGuard: { start() {} } };
  const context = {
    window, document,
    location: { href: '', pathname: '/faculty-admin.html', replace() {} },
    firebase: { apps: [], initializeApp() {}, auth: firebaseAuth },
    UCVM_PAWS_DATA: pawsData,
    Event: class { constructor(type) { this.type = type; } },
    console: { error(...a) { errors.push(a.map(v => (v && v.stack) || String(v)).join(' ')); }, warn() {}, info() {}, log() {} },
    performance: { now: () => Date.now() },
    setTimeout, clearTimeout, Map, Set, Date, JSON, String, Number, Boolean, Array, Object, Math, Promise, RegExp, Error, TypeError, isNaN, parseInt, parseFloat
  };
  context.globalThis = context;
  vm.runInNewContext(read('faculty-name.js'), context, { filename: 'faculty-name.js' });
  vm.runInNewContext(read('dashboard-view-model.js'), context, { filename: 'dashboard-view-model.js' });
  vm.runInNewContext(read('faculty-admin-doe-renderer.js'), context, { filename: 'faculty-admin-doe-renderer.js' });
  vm.runInNewContext(read('faculty-admin-doe-worksheet.js'), context, { filename: 'faculty-admin-doe-worksheet.js' });
  vm.runInNewContext(read('faculty-admin-management.js'), context, { filename: 'faculty-admin-management.js' });
  vm.runInNewContext(read('faculty-role-periods.js'), context);
  vm.runInNewContext(read('faculty-admin-afc-records.js'), context, { filename: 'faculty-admin-afc-records.js' });
  vm.runInNewContext(ADMIN_SOURCE, context, { filename: 'faculty-admin.js' });
  return {
    calls, errors, byId,
    signOuts: () => signOuts,
    signIn: async () => { await authCallback({ uid: 'u-1', email: 'user@example.test' }); }
  };
}

// ===========================================================================
// A / H / 14: frontend policy never exceeds the locked server policy
// ===========================================================================
test('H. the frontend ADMIN set matches the shared backend ADMIN set exactly', () => {
  const candidates = ['developer', 'owner', 'administrator', 'adfa_general', 'adfa_regular', 'admin', 'faculty', 'hicc', 'visc', 'other_office', 'editor', 'viewer', 'unknown_role', 'OTHER_OFFICE', 'Owner'];
  const frontendAdmins = candidates.filter(role => FE.dashboardAdmin({ role }));
  const backendAdmins = candidates.filter(role => BACKEND_ADMIN.includes(role.toLowerCase()));
  assert.deepEqual(frontendAdmins.slice().sort(), backendAdmins.slice().sort(),
    'the frontend must authorize exactly the roles the Dashboard API authorizes');
  assert.deepEqual(BACKEND_ADMIN.slice().sort(), ['developer', 'adfa_general', 'adfa_regular', 'administrator', 'admin', 'owner'].sort());
});

test('A / 14. the frontend never authorizes a role the Dashboard API denies', () => {
  const candidates = ['developer', 'owner', 'administrator', 'adfa_general', 'adfa_regular', 'admin', 'faculty', 'hicc', 'visc', 'other_office', 'editor', 'viewer', 'unknown_role'];
  for (const role of candidates) {
    const backendAdmin = BACKEND_ADMIN.includes(role);
    const backendSelf = BACKEND_SELF.includes(role);
    const backendAllowed = backendAdmin || backendSelf;
    const frontendAdmin = FE.dashboardAdmin({ role });
    const frontendSelf = FE.isSelfServiceProfile({ role });
    assert.equal(frontendAdmin && !backendAdmin, false, `${role}: frontend admin but backend denies`);
    assert.equal(frontendSelf && !backendSelf, false, `${role}: frontend self-service but backend denies`);
    assert.equal((frontendAdmin || frontendSelf) && !backendAllowed, false, `${role}: frontend allows what the backend denies`);
  }
});

test('A. dashboardAdmin(other_office) is false and other_office is denied by both sides', () => {
  assert.equal(FE.dashboardAdmin({ role: 'other_office' }), false);
  assert.equal(FE.dashboardAdmin({ role: 'OTHER_OFFICE' }), false);
  assert.equal(BACKEND_ADMIN.includes('other_office'), false, 'the Dashboard API does not authorize other_office');
  assert.equal(BACKEND_SELF.includes('other_office'), false);
  assert.match(SERVER_SOURCE, /other_office \(retired\)/, 'the server documents other_office as retired');
  assert.equal(/other_office/.test(ADMIN_SOURCE.match(/function dashboardAdmin\([^}]*\}/)[0]), false, 'other_office must not appear in the admin allow-list');
});

test('G. the server policy still denies other_office without any change', () => {
  assert.deepEqual(BACKEND_ADMIN.slice().sort(), ['developer', 'adfa_general', 'adfa_regular', 'administrator', 'admin', 'owner'].sort());
  assert.deepEqual(BACKEND_SELF.slice().sort(), ['faculty', 'hicc', 'visc'].sort());
  const resolveScope = SERVER_SOURCE.slice(SERVER_SOURCE.indexOf('function resolveScope'), SERVER_SOURCE.indexOf('function resolveYear'));
  assert.match(resolveScope, /DASHBOARD_ROLES\.has\(role\)/);
  assert.match(resolveScope, /error\(403, 'ROLE_DENIED'/);
});

// ===========================================================================
// I–P: full role parity table
// ===========================================================================
test('I–P. the full role parity table is preserved', () => {
  const table = [
    ['developer', 'developer', true, true, false],
    ['owner', 'adfa_general', true, true, false],
    ['adfa_general', 'adfa_general', true, true, false],
    ['administrator', 'adfa_regular', true, false, false],
    ['adfa_regular', 'adfa_regular', true, false, false],
    ['admin', 'adfa_regular', true, false, false],
    ['other_office', 'other_office', false, false, false],
    ['faculty', 'faculty', false, false, true],
    ['hicc', 'hicc', false, false, true],
    ['visc', 'visc', false, false, true],
    ['editor', 'faculty', false, false, false],
    ['viewer', 'faculty', false, false, false],
    ['unknown_role', 'unknown_role', false, false, false]
  ];
  for (const [role, normalized, isAdmin, isGeneral, isSelf] of table) {
    assert.equal(FE.dashboardRole(role), normalized, `${role} normalizes`);
    assert.equal(FE.dashboardAdmin({ role }), isAdmin, `${role} admin`);
    assert.equal(FE.dashboardGeneral({ role }), isGeneral, `${role} general`);
    assert.equal(FE.isSelfServiceProfile({ role }), isSelf, `${role} self-service`);
  }
});

test('display helpers still normalize and label the retired role harmlessly', () => {
  assert.equal(FE.dashboardRoleLabel('adfa_general'), 'ADFAD Owner');
  assert.equal(FE.dashboardRoleLabel('adfa_regular'), 'ADFAD Admin');
  assert.equal(FE.dashboardRoleLabel('owner'), 'ADFAD Owner');
  assert.equal(FE.dashboardRoleLabel('developer'), 'Developer');
  assert.equal(FE.dashboardRoleLabel('administrator'), 'ADFAD Admin');
  assert.equal(SHARED_ROLE_LABEL('adfa_general'), 'ADFAD Owner');
  assert.equal(SHARED_ROLE_LABEL('adfa_regular'), 'ADFAD Admin');
  assert.equal(SHARED_ROLE_LABEL('owner'), 'ADFAD Owner');
  assert.equal(SHARED_ROLE_LABEL('administrator'), 'ADFAD Admin');
  assert.equal(FE.dashboardRole('other_office'), 'other_office');
  assert.equal(FE.dashboardRoleLabel('other_office'), 'Other Office');
  assert.equal(FE.dashboardGeneral({ role: 'other_office' }), false);
  assert.equal(FE.dashboardGeneral({ role: 'developer' }), true);
});

// ===========================================================================
// B / C / D / E / F: other_office behaviour on the Dashboard
// ===========================================================================
test('B / C / D / E / F. an other_office profile stays behind the access gate with zero business-data requests', async () => {
  const h = createHarness(OTHER_OFFICE_PROFILE);
  await h.signIn();
  await flush();
  assert.deepEqual(h.calls, ['currentUser'], 'only /me may be called');
  assert.equal(h.calls.includes('dashboardSummary'), false, 'B/D: no summary call');
  assert.equal(h.calls.includes('dashboardFaculty'), false, 'B/C: no roster call, so no admin or self-service mode');
  assert.equal(h.calls.filter(c => c.startsWith('dashboardFacultyById')).length, 0, 'D: no detail call');
  assert.equal(h.signOuts(), 0, 'E: the user remains signed in');
  assert.equal(h.byId('gate-status').textContent, GATE_DENIED, 'F: the access-denied gate is shown');
  assert.equal(h.byId('auth-gate').classList.contains('hidden'), false, 'the gate stays up');
  assert.deepEqual(h.errors, [], 'no error is swallowed');
});

test('a supported admin profile still enters admin mode', async () => {
  const h = createHarness(ADMIN_PROFILE);
  await h.signIn();
  await flush();
  assert.deepEqual(h.calls, ['currentUser', 'dashboardSummary', 'dashboardFaculty']);
  assert.equal(h.byId('auth-gate').classList.contains('hidden'), true, 'the gate is released for an authorized admin');
});

test('a self-service profile still enters self-service mode', async () => {
  const h = createHarness({ role: 'faculty', facultyId: 'f-2', active: true, mustChangePassword: false });
  await h.signIn();
  await flush();
  assert.deepEqual(h.calls, ['currentUser', 'dashboardFaculty', 'dashboardFacultyById:f-2']);
});

test('a viewer profile is denied on both sides', async () => {
  const h = createHarness({ role: 'viewer', active: true, mustChangePassword: false });
  await h.signIn();
  await flush();
  assert.deepEqual(h.calls, ['currentUser']);
  assert.equal(h.byId('gate-status').textContent, GATE_DENIED);
  assert.equal(BACKEND_ADMIN.includes('viewer'), false);
  assert.equal(BACKEND_SELF.includes('viewer'), false);
});

// ===========================================================================
// 11: the Stage 3C zero-Firestore contract is untouched
// ===========================================================================
test('the Stage 3C zero-Firestore contract is untouched by this fix', () => {
  const html = read('faculty-admin.html');
  const local = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
  assert.deepEqual(local, ['faculty-name.js', 'change-history.js', 'session-guard.js', 'paws-api-origin.js', 'paws-data-client.js', 'developer-support.js', 'paws-auth-continuity.js', 'dashboard-view-model.js', 'faculty-admin-doe-renderer.js', 'faculty-admin-doe-manual.js', 'faculty-admin-doe-edit.js', 'faculty-admin-doe-worksheet.js', 'faculty-admin-doe-rulebook.js', 'faculty-admin-doe-policy.js', 'faculty-admin-afc-batch.js', 'faculty-admin-afc-records.js', 'faculty-admin-afc-forms.js', 'faculty-admin-ccc-replacement.js', 'faculty-admin-management.js', 'faculty-role-periods.js', 'calendar-activities.js', 'faculty-admin-activity-import.js', 'asset-loader.js', 'faculty-admin.js', 'faculty-availability.js']);
  assert.equal([...html.matchAll(/<script[^>]*>/g)].length, 27);
  for (const banned of ['firestore', 'faculty-access.js', 'UCVM_PAWS_DASHBOARD_API_ONLY']) {
    assert.equal(html.includes(banned), false, `${banned} must stay absent`);
  }
  for (const pattern of ['firebase.firestore', 'db.collection', 'db.doc', 'FieldValue', 'enablePersistence', 'onSnapshot']) {
    assert.equal(ADMIN_SOURCE.includes(pattern), false, `${pattern} must stay 0`);
  }
  assert.equal(/UCVM\./.test(ADMIN_SOURCE), false);
});
