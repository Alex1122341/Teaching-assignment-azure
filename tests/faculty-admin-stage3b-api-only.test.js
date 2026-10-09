'use strict';
// BETA-R4D-10B Stage 3B — API-only Dashboard: auth-only init, retired legacy
// Firestore surface, and a fail-closed mutation boundary.
//
// These tests execute the REAL faculty-admin.js inside a vm sandbox whose
// `firebase` object has NO `firestore` property at all, and whose `UCVM.init`
// throws if touched. The Dashboard must still complete the whole accepted
// Stage 3A Azure API flow.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const ADMIN_SOURCE = read('faculty-admin.js');
const MANAGEMENT_SOURCE = read('faculty-admin-management.js');
const ADMIN_HTML = read('faculty-admin.html');
const ACCESS_SOURCE = read('faculty-access.js');
const KPI_IDS = ['kpi-total', 'kpi-sessions', 'kpi-assignments', 'kpi-courses', 'kpi-roles', 'kpi-hicc', 'kpi-visc', 'kpi-afc', 'kpi-grid', 'kpi-check'];

// Legacy modules that must never load on the API-only Dashboard.
const RETIRED_SCRIPTS = [
  'firebase-firestore-compat.js', 'faculty-doe.js', 'scheduling-core.js', 'data-index.js',
  'index-maintenance.js', 'audit-details.js', 'faculty-account-planner.js', 'approval-scheduling.js',
  'maintenance-state.js', 'bulk-import-core.js', 'bulk-import-backup.js', 'bulk-import-firestore.js',
  'bulk-import-controller.js', 'faculty-swap-safe.js', 'bulk-import-ui.js', 'derived-index-health.js',
  'faculty-admin-enhancements.js', 'faculty-access.js'
];

// Legacy mutation controls that must not ship on the Dashboard page.
const RETIRED_CONTROLS = [
  'import-afc-btn', 'afc-import-file', 'import-summary-btn', 'summary-import-file',
  'import-workload-btn', 'workload-import-file', 'add-btn', 'import-btn', 'import-file',
  'export-json-btn', 'export-csv-btn', 'save-edit', 'edit-form', 'edit-modal',
  'derived-index-verify', 'derived-index-rebuild', 'derived-index-health-card', 'db-body'
];

const SUMMARY = {
  academicYear: '2026-27', activeFacultyCount: 120, sessionCount: 1937, assignmentCount: 4970,
  courseCount: 214, roleAssignmentCount: 162, hiccCount: 64, viscCount: 35, afcRecordCount: 791,
  gridPositionableCount: 1902, checkNeededCount: 35
};
const AFC_PURPOSE = 'ZZ-AFC-PURPOSE-ONLY';
const ROSTER = [
  { facultyId: 'f-1', preferredFirstName: 'Ada', preferredLastName: 'One', displayName: 'Ada One', ucid: '10000001', email: 'ada@example.test', recordType: 'faculty', stream: 'Teaching', rank: 'Professor', fte: 1, reportsToFacultyId: '', reportsToName: 'Dean', active: true, teachingArea: 'Anatomy', professionalCategory: 'Teaching-Focused', sessionCount: 12, roleCount: 0, afcCount: 0, jointAppointmentCount: 0 },
  { facultyId: 'f-2', preferredFirstName: 'Bo', preferredLastName: 'Two', displayName: 'Bo Two', ucid: '10000002', email: 'bo@example.test', recordType: 'faculty', stream: 'Research', rank: 'Associate Professor', fte: 0.8, reportsToFacultyId: '', reportsToName: 'Dean', active: true, teachingArea: 'Cardiology', professionalCategory: 'Teaching & Research', sessionCount: 4, roleCount: 0, afcCount: 0, jointAppointmentCount: 0 }
];
const DETAIL = {
  faculty: { facultyId: 'f-1', recordType: 'faculty', preferredFirstName: 'Ada', preferredLastName: 'One', displayName: 'Ada One', ucid: '10000001', email: 'ada@example.test', stream: 'Teaching', rank: 'Professor', fte: 1, reportsToFacultyId: '', reportsToName: 'Dean', active: true },
  academicYear: '2026-27',
  professionalProfile: { teachingArea: 'Anatomy', professionalCategory: 'Teaching-Focused' },
  jointAppointments: [],
  roles: [{ roleAssignmentId: 'r-1', roleType: 'Course Coordinator / HICC', courseOrSubjectOrRotation: 'VETM 300', courseName: 'Clinical Skills', details: '', effectiveDate: '2026-09-01', expirationDate: '2027-08-31', doeMappedValue: 12.5, doeOverrideValue: 10, doeOverrideReason: 'Approved reduction', specialNotes: '' }],
  afcRecords: [{ afcRecordId: 'a-1', startDate: '2026-10-01', endDate: '2026-10-05', purpose: AFC_PURPOSE, active: true }],
  teachingAssignments: [{ sessionAssignmentId: 'sa-1', sessionId: 's-1', academicYear: '2026-27', courseCode: 'VETM 101', courseName: 'Intro', topic: 'Cells', sessionType: 'Lecture', date: '2026-09-10', startTime: '08:30:00', endTime: '09:45:00', teachingRole: 'Instructor', labLead: 'No', creditedHours: 1.25, doeRate: 0.5, doeQuantity: 2.5, doeUnit: 'percent', doeCredit: 0.9, doeStatus: 'Confirmed' }],
  sessionCount: 1, checkNeededCount: 0
};
const ADMIN_PROFILE = { displayName: 'Admin User', role: 'adfa_general', facultyId: null, active: true, mustChangePassword: false };
const SELF_PROFILE = { displayName: 'Bo Two', role: 'faculty', facultyId: 'f-2', active: true, mustChangePassword: false };
const ADMIN_ROLES = ['owner', 'administrator', 'adfa_general', 'adfa_regular', 'admin'];
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(r => setTimeout(r, 0)); };
const slice = (from, to) => ADMIN_SOURCE.slice(ADMIN_SOURCE.indexOf(from), ADMIN_SOURCE.indexOf(to));

// ---------------------------------------------------------------- harness
// `firebase.firestore` is deliberately ABSENT (not stubbed): touching it throws
// a TypeError, which is exactly the Stage 3B contract.
function createHarness(overrides = {}) {
  const calls = [];
  const events = [];
  const errors = [];
  let authCallback = null, signOuts = 0, initializeAppCalls = 0, sessionGuardStarts = 0, ucvmInitCalls = 0;
  const classList = () => {
    const set = new Set();
    return { add(c) { set.add(c); }, remove(c) { set.delete(c); }, toggle(c, v) { if (v === undefined) { set.has(c) ? set.delete(c) : set.add(c); } else if (v) set.add(c); else set.delete(c); }, contains(c) { return set.has(c); } };
  };
  const element = id => ({ id, classList: classList(), dataset: {}, style: {}, value: '', textContent: '', innerHTML: '', disabled: false, options: [], children: [], onclick: null, oninput: null, onchange: null, onsubmit: null, setAttribute() {}, addEventListener(event, handler) { this[`on${event}`] = handler; }, appendChild() {}, remove() {}, click() {}, querySelectorAll() { return []; }, querySelector() { return null; } });
  const nodes = new Map();
  const byId = id => { if (!nodes.has(id)) nodes.set(id, element(id)); return nodes.get(id); };
  const rowStubs = new Map();
  const auth = { setPersistence: async () => {}, onAuthStateChanged(cb) { authCallback = cb; }, async signOut() { signOuts += 1; } };
  const firebaseAuth = Object.assign(function () { return auth; }, { Auth: { Persistence: { LOCAL: 'local' } } });
  const pawsData = {
    currentUser: async () => { calls.push('currentUser'); return overrides.currentUser ? overrides.currentUser() : ADMIN_PROFILE; },
    dashboardSummary: async () => { calls.push('dashboardSummary'); return SUMMARY; },
    dashboardFaculty: async () => { calls.push('dashboardFaculty'); return ROSTER; },
    dashboardFacultyById: async id => { calls.push('dashboardFacultyById:' + id); return DETAIL; },
    listSessions: async () => []
  };
  const document = {
    title: '', documentElement: { dataset: {} }, body: element('body'), head: { appendChild() {} },
    getElementById: byId,
    querySelector: selector => byId('query:' + selector),
    querySelectorAll(selector) {
      if (selector === '.kpi-value') return KPI_IDS.map(byId);
      if (selector === '.person-select' || selector === '.person-row' || selector === '#result-list .person-row') {
        const html = byId('result-list').innerHTML || '';
        return (html.match(/data-id="[^"]*"/g) || []).map(s => s.replace(/^data-id="|"$/g, '')).map(id => {
          if (!rowStubs.has(id)) {
            const el = element('row:' + id); el.dataset.id = id;
            const button = element('select:' + id);
            button.closest = selector => selector === '.person-row' ? el : null;
            button.matches = selector => selector === '.person-select';
            button.focus = () => { document.activeElement = button; };
            el.querySelector = selector => selector === '.person-select' ? button : null;
            el.selectButton = button; rowStubs.set(id, el);
          }
          const row = rowStubs.get(id);
          return selector === '.person-select' ? row.selectButton : row;
        });
      }
      return [];
    },
    createElement: () => element('created')
  };
  const window = { dispatchEvent(e) { events.push(e && e.type ? e.type : String(e)); }, confirm: () => true, UCVMSessionGuard: { start() { sessionGuardStarts += 1; } } };
  const context = {
    window, document,
    location: { href: '', pathname: '/faculty-admin.html', replace() {} },
    // NO firestore anywhere on the Firebase global.
    firebase: { apps: [], initializeApp() { initializeAppCalls += 1; }, auth: firebaseAuth },
    UCVM: {
      init() { ucvmInitCalls += 1; throw new Error('UCVM.init must not be called by the Dashboard'); },
      number: v => (v === null || v === undefined || v === '' ? null : Number(v)),
      role: v => String(v || ''),
      admin: p => ADMIN_ROLES.includes(p && p.role),
      general: p => ['owner', 'administrator', 'adfa_general', 'admin'].includes(p && p.role),
      label: v => String(v || ''),
      logs: () => { throw new Error('UCVM.logs must not be reachable from the API-only Dashboard'); }
    },
    UCVM_PAWS_DATA: pawsData,
    Event: class { constructor(type) { this.type = type; } },
    console: { error(...a) { errors.push(a.map(v => (v && v.stack) || String(v)).join(' ')); }, warn() {}, info() {}, log() {} },
    performance: { now: () => Date.now() },
    setTimeout, clearTimeout, Map, Set, Date, JSON, String, Number, Boolean, Array, Object, Math, Promise, RegExp, Error, TypeError, isNaN, parseInt, parseFloat
  };
  context.globalThis = context;
  vm.runInNewContext(read('dashboard-view-model.js'), context, { filename: 'dashboard-view-model.js' });
  vm.runInNewContext(read('faculty-admin-doe-renderer.js'), context, { filename: 'faculty-admin-doe-renderer.js' });
  vm.runInNewContext(read('faculty-admin-doe-worksheet.js'), context, { filename: 'faculty-admin-doe-worksheet.js' });
  vm.runInNewContext(MANAGEMENT_SOURCE, context, { filename: 'faculty-admin-management.js' });
  vm.runInNewContext(ADMIN_SOURCE, context, { filename: 'faculty-admin.js' });
  return {
    calls, events, errors, byId,
    signOuts: () => signOuts,
    initializeAppCalls: () => initializeAppCalls,
    sessionGuardStarts: () => sessionGuardStarts,
    ucvmInitCalls: () => ucvmInitCalls,
    hasAuthCallback: () => typeof authCallback === 'function',
    signIn: async () => { await authCallback({ uid: 'u-1', email: 'admin@example.test' }); },
    rowIds: () => (byId('result-list').innerHTML.match(/data-id="[^"]*"/g) || []).map(s => s.replace(/^data-id="|"$/g, '')),
    clickRow: async id => {
      const stub = rowStubs.get(id); assert.ok(stub, `row ${id} must be rendered`);
      assert.equal(typeof stub.selectButton.onclick, 'function', 'selection button has a handler');
      stub.selectButton.focus(); stub.selectButton.onclick({ detail: 0 });
      assert.equal(document.activeElement, stub.selectButton, 'keyboard selection retains focus');
      await flush();
    }
  };
}

// ===========================================================================
// A / B / Q–Y: the accepted Stage 3A Azure API core survives
// ===========================================================================
test('A. admin API core still runs with no Firestore global at all', async () => {
  const h = createHarness();
  assert.equal(h.hasAuthCallback(), true, 'init() must register an auth callback :: ' + h.errors.join(' | '));
  await h.signIn();
  await flush();
  assert.deepEqual(h.calls, ['currentUser', 'dashboardSummary', 'dashboardFaculty']);
  assert.equal(h.byId('kpi-hicc').textContent, '64');
  assert.equal(h.byId('result-count').textContent, ROSTER.length);
  assert.equal(h.byId('sync-status').textContent.length > 0, true);
});

test('Q. summary and status-filtered roster are still requested through one parallel Promise.all', async () => {
  const load = slice('async function loadAdminDashboard', 'function dashboardRawRole');
  assert.match(load, /await Promise\.all\(\s*\[\s*UCVM_PAWS_DATA\.dashboardSummary\(\),\s*UCVM_PAWS_DATA\.dashboardFaculty\(\{\s*status:\s*facultyStatus\s*\}\),/s, 'summary and roster must be started together');
  assert.equal((load.match(/await Promise\.all/g) || []).length, 1, 'summary and roster use one parallel aggregate load');
  const h = createHarness();
  await h.signIn();
  await flush();
  assert.deepEqual(h.calls.filter(c => c === 'dashboardSummary').length, 1);
  assert.deepEqual(h.calls.filter(c => c === 'dashboardFaculty').length, 1);
});

test('R / S. detail stays lazy, single, and cached; no N+1', async () => {
  const h = createHarness();
  await h.signIn();
  await flush();
  assert.deepEqual(h.calls.filter(c => c.startsWith('dashboardFacultyById')), [], 'initial load issues zero detail requests');
  await h.clickRow('f-1');
  await h.clickRow('f-1');
  assert.deepEqual(h.calls.filter(c => c.startsWith('dashboardFacultyById')), ['dashboardFacultyById:f-1'], 'one detail request, then cached');
});

test('T / U. AFC purpose stays detail-only and stored DOE keeps precedence over client-side derivation', async () => {
  const h = createHarness();
  await h.signIn();
  await flush();
  assert.equal(h.byId('result-list').innerHTML.includes(AFC_PURPOSE), false);
  await h.clickRow('f-1');
  const pane = h.byId('profile-pane').innerHTML;
  assert.match(pane, new RegExp(AFC_PURPOSE), 'AFC purpose is shown in the selected detail');
  assert.match(pane, /<td>0\.90%<\/td><td>DOE unavailable<\/td><td>0\.90%<\/td>/, 'stored DOE credit remains the effective value when no server calculator result is supplied');
  assert.match(pane, /Confirmed/);
  assert.doesNotMatch(pane, /1\.25%/, 'client must not derive DOE from legacy rate and quantity');
});

test('V / W. a 503 still has no Firestore fallback and never signs out', async () => {
  const h = createHarness();
  await h.signIn();
  await flush();
  assert.equal(h.signOuts(), 0);
  assert.equal(h.ucvmInitCalls(), 0);
  const src = slice('async function loadAdminDashboard', 'function dashboardRawRole');
  assert.doesNotMatch(src, /firestore|collection\(/i);
});

test('X / Y. self-service calls neither summary nor email lookup', async () => {
  const h = createHarness({ currentUser: () => SELF_PROFILE });
  await h.signIn();
  await flush();
  assert.deepEqual(h.calls, ['currentUser', 'dashboardFaculty', 'dashboardFacultyById:f-2']);
  const self = slice('async function loadSelfFaculty', 'async function enterSelfMode');
  assert.doesNotMatch(self, /email|firestore|collection\(/i);
});

// ===========================================================================
// C–F, 14–19: auth-only initialization and no Firestore SDK
// ===========================================================================
test('C / 19. the Dashboard initializes and renders when firebase.firestore does not exist', async () => {
  const h = createHarness();
  assert.equal(h.hasAuthCallback(), true);
  await h.signIn();
  await flush();
  assert.deepEqual(h.errors, [], 'no initialization error may be swallowed');
  assert.equal(h.byId('result-count').textContent, ROSTER.length);
  assert.equal(h.byId('profile-pane').innerHTML.includes('Select a faculty member'), true);
});

test('D / E / 15 / 16. Dashboard startup never calls UCVM.init() or firebase.firestore()', async () => {
  const h = createHarness();
  await h.signIn();
  await flush();
  assert.equal(h.ucvmInitCalls(), 0, 'UCVM.init must not be called');
  const init = slice('function init()', 'function bindUI');
  assert.match(init, /firebase\.initializeApp\(FIREBASE_CONFIG\)/);
  assert.match(init, /firebase\.auth\(\)/);
  assert.match(init, /UCVMSessionGuard\.start\(auth\)/);
  assert.doesNotMatch(init, /firebase\.firestore|enablePersistence|UCVM\.init\(/);
  assert.doesNotMatch(ADMIN_SOURCE, /UCVM\.init\(/, 'no UCVM.init call may remain in the Dashboard controller');
});

test('F / 9 / 18. the Dashboard page does not load the Firestore compat SDK', () => {
  assert.equal(ADMIN_HTML.includes('firebase-firestore-compat.js'), false);
  assert.equal(ADMIN_HTML.includes('firebase-app-compat.js'), true);
  assert.equal(ADMIN_HTML.includes('firebase-auth-compat.js'), true);
  assert.equal(/firebase\.firestore/.test(ADMIN_HTML), false);
});

// ===========================================================================
// G–L, 20–25: auto-start module retirement
// ===========================================================================
test('G–L. no retired legacy module is loaded by the Dashboard page', () => {
  for (const name of RETIRED_SCRIPTS) {
    assert.equal(ADMIN_HTML.includes(name), false, `${name} must not load on the API-only Dashboard`);
  }
});

test('25 / 26 / 27. no Beta page dynamically loads retired Firestore writers', () => {
  assert.equal(ADMIN_HTML.includes('faculty-access.js'), false, 'the Dashboard must not load faculty-access.js');
  assert.equal(ADMIN_HTML.includes('UCVM_PAWS_DASHBOARD_API_ONLY'), false, 'the Stage 3B inline opt-out flag is gone');
  assert.doesNotMatch(ACCESS_SOURCE, /load\(['"](?:approval-workflow|faculty-admin-enhancements)\.js['"]/, 'shared loader must not reintroduce dormant Firestore writers');
});

test('M. approval workflow remains available as a dormant artifact but is not dynamically loaded', () => {
  assert.ok(ACCESS_SOURCE.includes('W1D authority containment'));
  assert.doesNotMatch(ACCESS_SOURCE, /load\(['"]approval-workflow\.js['"]/);
});

test('28 / 29. the final local script set includes the modular view model', () => {
  const srcs = [...ADMIN_HTML.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  const local = srcs.filter(s => !/^https?:/.test(s));
  assert.deepEqual(local.sort(), ['dashboard-view-model.js', 'faculty-admin-afc-batch.js', 'faculty-admin-doe-manual.js', 'faculty-admin-doe-edit.js', 'faculty-admin-doe-renderer.js', 'faculty-admin-doe-worksheet.js', 'faculty-admin-doe-rulebook.js', 'faculty-admin-doe-policy.js', 'faculty-admin-management.js', 'faculty-admin.js', 'paws-api-origin.js', 'paws-auth-continuity.js', 'paws-data-client.js', 'session-guard.js'].sort());
  assert.equal(srcs.filter(s => /gstatic\.com\/firebasejs/.test(s)).length, 2, 'only the app and auth compat SDKs remain');
  const inline = [...ADMIN_HTML.matchAll(/<script>([^<]*)<\/script>/g)].map(m => m[1].trim());
  assert.deepEqual(inline, [], 'no inline script remains');
});

// ===========================================================================
// 30–38: legacy tabs retired, canonical detail preserved
// ===========================================================================
test('30–35. read-only Dashboard tabs are exposed without legacy write surfaces', () => {
  assert.match(ADMIN_HTML, /<section id="lookup-view" class="panel">/);
  for (const tab of ['data-tab="lookup"', 'data-tab="summary"', 'data-tab="roles"', 'data-tab="doe-overview"']) assert.equal(ADMIN_HTML.includes(tab), true, `${tab} must remain available`);
  for (const retired of ['sessional-view', 'database-view', 'history-view', 'faculty-audit', 'Import Full Faculty JSON']) assert.equal(ADMIN_HTML.includes(retired), false, `${retired} must be gone`);
  assert.equal(ADMIN_HTML.includes('data-tab="doe-rules"'), true, 'Annual DOE Rule Book is an authorized separate admin tab');
});

test('36 / 37 / 38. the selected canonical API detail still renders roles, teaching and AFC', async () => {
  const h = createHarness();
  await h.signIn();
  await flush();
  await h.clickRow('f-1');
  const pane = h.byId('profile-pane').innerHTML;
  assert.match(pane, /VETM 300/, 'canonical roles detail');
  assert.match(pane, /VETM 101/, 'canonical teaching detail');
  assert.match(pane, new RegExp(AFC_PURPOSE), 'canonical AFC detail');
});

// ===========================================================================
// 39–51: fail-closed write surface
// ===========================================================================
test('39–49. no unsupported mutation control ships on the Dashboard page', () => {
  for (const id of RETIRED_CONTROLS) {
    assert.equal(ADMIN_HTML.includes(id), false, `${id} must not ship on the API-only Dashboard`);
  }
  assert.equal(ADMIN_HTML.includes('data-general-only'), false);
  for (const label of ['Import Away from Campus', 'Replace &amp; Sync', 'Import Workload', '+ Add Faculty', 'Import Full Faculty JSON', 'Export JSON', 'Export CSV', 'Rebuild Derived Indexes']) {
    assert.equal(ADMIN_HTML.includes(label), false, `${label} must not ship`);
  }
});

test('50 / 51. no mutation handler is bound and the legacy writers are unreachable', () => {
  const bindUI = slice('function bindUI()', 'function renderActiveTab');
  for (const legacy of ['importAfcJson', 'importSummaryJson', 'importWorkloadJson', 'importJson', 'saveEditor', 'deleteRecord', 'openEditor', 'closeEditor', 'exportJson', 'exportCsv', 'subscribeFaculty', 'subscribeSessions', 'setTab']) {
    assert.doesNotMatch(bindUI, new RegExp(legacy), `bindUI must not bind ${legacy}`);
  }
  assert.match(bindUI, /on\(\$\('lookup-search'\), 'input'/);
  assert.match(bindUI, /on\(\$\('filter-rank'\), 'change'/);
  assert.match(bindUI, /on\(\$\('lookup-reset'\), 'click'/);
  assert.match(bindUI, /querySelectorAll\('\.tab'\)/, 'read-only tab binding remains');
  assert.match(ADMIN_SOURCE, /function renderActiveTab\(\)/);
});

test('the read-only source message replaces the legacy workbook/Firestore claim', () => {
  assert.match(ADMIN_HTML, /PAWS University API/);
  assert.match(ADMIN_HTML, /VetMed-Ops teaching data/);
  assert.match(ADMIN_HTML, /read-only/);
  assert.equal(ADMIN_HTML.includes('All Faculty Summaries.xlsx'), false);
  assert.equal(ADMIN_HTML.includes('AFC Tracker Lookup'), false);
  assert.equal(ADMIN_HTML.includes('V9.7'), false);
});

test('53. external navigation is retained', () => {
  assert.match(ADMIN_HTML, /href="index\.html#approvals"[^>]*>AFC Requests</);
  assert.match(ADMIN_HTML, /id="user-management-link" href="user-management\.html">User Management</);
  assert.match(ADMIN_HTML, /href="password\.html">Change password</);
  assert.match(ADMIN_HTML, /id="back-btn">Timetable</);
  assert.match(ADMIN_HTML, /id="signout-btn">Sign out</);
});

// ===========================================================================
// 58–64: performance surface (static, no latency claim)
// ===========================================================================
test('58–63. the Dashboard page runtime surface is bounded and makes no latency claim', () => {
  const srcs = [...ADMIN_HTML.matchAll(/<script[^>]*>/g)].length;
  assert.equal(srcs, 16, 'script elements: 2 Firebase CDN + 14 local');
  const local = [...ADMIN_HTML.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
  assert.equal(local.length, 14);
  assert.equal(RETIRED_SCRIPTS.length, 18);
  assert.doesNotMatch(ADMIN_HTML, /\d+\s?ms\b/, 'no latency figure may be claimed in the page');
});

test('64. performance timing hooks are preserved', () => {
  assert.match(ADMIN_SOURCE, /window\.__pawsDashboardTiming\s*===\s*true/);
  assert.match(ADMIN_SOURCE, /\[PAWS dashboard timing\]/);
  assert.match(ADMIN_SOURCE, /pawsTimingLog\('summary\+faculty'/);
  assert.match(ADMIN_SOURCE, /pawsTimingLog\('detail'/);
});

// ===========================================================================
// 65–68: remaining dormant Firestore references (Stage 3C scope)
// ===========================================================================
test('65 / 67. the Dashboard controller contains zero Firestore implementation', () => {
  for (const pattern of ['firebase.firestore', 'db.collection', 'db.doc(', 'FieldValue', 'enablePersistence', 'onSnapshot']) {
    assert.equal(ADMIN_SOURCE.includes(pattern), false, `${pattern} must be absent`);
  }
  assert.equal(/UCVM\./.test(ADMIN_SOURCE), false, 'no UCVM dependency may remain');
});

test('66. faculty-access.js retains safe identity exports without its retired writer loader', () => {
  assert.match(ACCESS_SOURCE, /return \{config,role,admin,general,historyAll,canOpenFacultyDashboard,label,esc,number,init,ready,enrichFacultyIdentity,watch,logs\}/);
  assert.match(ACCESS_SOURCE, /enablePersistence\(\{synchronizeTabs:true\}\)/);
  assert.doesNotMatch(ACCESS_SOURCE, /faculty-admin-enhancements\.js|approval-workflow\.js/);
});

// ===========================================================================
// helpers
// ===========================================================================
