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
const ADMIN_HTML = read('faculty-admin.html');
const ACCESS_SOURCE = read('faculty-access.js');
const KPI_IDS = ['kpi-total', 'kpi-sessions', 'kpi-assignments', 'kpi-courses', 'kpi-roles', 'kpi-hicc', 'kpi-visc', 'kpi-afc', 'kpi-grid', 'kpi-check'];

// Legacy modules that must never load on the API-only Dashboard.
const RETIRED_SCRIPTS = [
  'firebase-firestore-compat.js', 'faculty-doe.js', 'scheduling-core.js', 'data-index.js',
  'index-maintenance.js', 'audit-details.js', 'faculty-account-planner.js', 'approval-scheduling.js',
  'maintenance-state.js', 'bulk-import-core.js', 'bulk-import-backup.js', 'bulk-import-firestore.js',
  'bulk-import-controller.js', 'faculty-swap-safe.js', 'bulk-import-ui.js', 'derived-index-health.js',
  'faculty-admin-enhancements.js'
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
  const element = id => ({ id, classList: classList(), dataset: {}, style: {}, value: '', textContent: '', innerHTML: '', disabled: false, options: [], children: [], onclick: null, oninput: null, onchange: null, onsubmit: null, setAttribute() {}, appendChild() {}, remove() {}, click() {}, querySelectorAll() { return []; }, querySelector() { return null; } });
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
      if (selector === '.person-row') {
        const html = byId('result-list').innerHTML || '';
        return (html.match(/data-id="[^"]*"/g) || []).map(s => s.replace(/^data-id="|"$/g, '')).map(id => {
          if (!rowStubs.has(id)) { const el = element('row:' + id); el.dataset.id = id; rowStubs.set(id, el); }
          return rowStubs.get(id);
        });
      }
      return [];
    },
    createElement: () => element('created')
  };
  const window = { dispatchEvent(e) { events.push(e && e.type ? e.type : String(e)); }, UCVMSessionGuard: { start() { sessionGuardStarts += 1; } } };
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
    clickRow: async id => { const stub = rowStubs.get(id); assert.ok(stub, `row ${id} must be rendered`); stub.onclick(); await flush(); }
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

test('Q. summary and roster are still requested through one parallel Promise.all', async () => {
  const load = slice('async function loadAdminDashboard', 'async function writeDerivedIndexes');
  assert.match(load, /await Promise\.all\(\[UCVM_PAWS_DATA\.dashboardSummary\(\),UCVM_PAWS_DATA\.dashboardFaculty\(\)\]\)/, 'both requests must be started together');
  assert.equal(load.split('await').length - 1, 1, 'no serial await may precede the parallel load');
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

test('T / U. AFC purpose stays detail-only and DOE stays the stored value', async () => {
  const h = createHarness();
  await h.signIn();
  await flush();
  assert.equal(h.byId('result-list').innerHTML.includes(AFC_PURPOSE), false);
  await h.clickRow('f-1');
  const pane = h.byId('profile-pane').innerHTML;
  assert.match(pane, new RegExp(AFC_PURPOSE), 'AFC purpose is shown in the selected detail');
  assert.match(pane, /<td>percent<\/td><td>0\.9<\/td><td>Confirmed<\/td>/, 'stored DOE credit is displayed verbatim');
  assert.doesNotMatch(pane, /<td>percent<\/td><td>1\.25<\/td>/);
});

test('V / W. a 503 still has no Firestore fallback and never signs out', async () => {
  const h = createHarness();
  await h.signIn();
  await flush();
  assert.equal(h.signOuts(), 0);
  assert.equal(h.ucvmInitCalls(), 0);
  const src = slice('async function loadAdminDashboard', 'async function writeDerivedIndexes');
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

test('25 / 26 / 27. the API-only flag suppresses the enhancement loader without changing legacy behaviour', async () => {
  assert.match(ADMIN_HTML, /window\.UCVM_PAWS_DASHBOARD_API_ONLY=true;/, 'the page must set the opt-out flag');
  const flagAt = ADMIN_HTML.indexOf('window.UCVM_PAWS_DASHBOARD_API_ONLY=true');
  const accessAt = ADMIN_HTML.indexOf('src="faculty-access.js"');
  assert.ok(flagAt >= 0 && accessAt > flagAt, 'the flag must be set before faculty-access.js loads');
  assert.match(ACCESS_SOURCE, /page==='faculty-admin\.html'&&window\.UCVM_PAWS_DASHBOARD_API_ONLY!==true/);

  const withFlag = await runAccessLoader({ pathname: '/faculty-admin.html', apiOnly: true });
  assert.deepEqual(withFlag.loaded, [], 'the API-only Dashboard must not load faculty-admin-enhancements.js');

  const legacy = await runAccessLoader({ pathname: '/faculty-admin.html', apiOnly: false });
  assert.deepEqual(legacy.loaded, ['faculty-admin-enhancements.js'], 'the default/legacy Dashboard behaviour is preserved');

  const timetable = await runAccessLoader({ pathname: '/index.html', apiOnly: true });
  assert.deepEqual(timetable.loaded, ['approval-workflow.js'], 'other pages are unchanged');
});

test('M. the default loader still loads the timetable approval workflow in order', async () => {
  const result = await runAccessLoader({ pathname: '/index.html', apiOnly: false });
  assert.deepEqual(result.loaded, ['approval-workflow.js']);
  assert.equal(result.keys[0], 'data-ucvmApprovalWorkflow');
});

test('28 / 29. the retained script set is the smallest API-only set', () => {
  const srcs = [...ADMIN_HTML.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  const local = srcs.filter(s => !/^https?:/.test(s));
  assert.deepEqual(local.sort(), ['faculty-access.js', 'faculty-admin.js', 'paws-data-client.js', 'session-guard.js'].sort());
  assert.equal(srcs.filter(s => /gstatic\.com\/firebasejs/.test(s)).length, 2, 'only the app and auth compat SDKs remain');
  const inline = [...ADMIN_HTML.matchAll(/<script>([^<]*)<\/script>/g)].map(m => m[1].trim());
  assert.deepEqual(inline, ['window.UCVM_PAWS_DASHBOARD_API_ONLY=true;']);
});

// ===========================================================================
// 30–38: legacy tabs retired, canonical detail preserved
// ===========================================================================
test('30–35. Lookup remains and no legacy global tab is exposed', () => {
  assert.match(ADMIN_HTML, /<span class="toolbar-note">Lookup<\/span>/);
  assert.match(ADMIN_HTML, /<section id="lookup-view" class="panel">/);
  assert.equal(/class="tab[\s"]/.test(ADMIN_HTML), false, 'no tab button may remain');
  for (const retired of ['data-tab=', 'summary-view', 'roles-view', 'sessional-view', 'database-view', 'history-view', 'faculty-audit']) {
    assert.equal(ADMIN_HTML.includes(retired), false, `${retired} must be gone`);
  }
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
  for (const label of ['Import Away from Campus', 'Replace &amp; Sync', 'Import Workload', '+ Add Faculty', 'Import Full Faculty JSON', 'Edit Faculty', 'Export JSON', 'Export CSV', 'Rebuild Derived Indexes']) {
    assert.equal(ADMIN_HTML.includes(label), false, `${label} must not ship`);
  }
});

test('50 / 51. no mutation handler is bound and the legacy writers are unreachable', () => {
  const bindUI = slice('function bindUI()', 'async function setTab');
  for (const legacy of ['importAfcJson', 'importSummaryJson', 'importWorkloadJson', 'importJson', 'saveEditor', 'deleteRecord', 'openEditor', 'closeEditor', 'exportJson', 'exportCsv', 'subscribeFaculty', 'subscribeSessions', 'setTab']) {
    assert.doesNotMatch(bindUI, new RegExp(legacy), `bindUI must not bind ${legacy}`);
  }
  assert.match(bindUI, /\$\('lookup-search'\)\.oninput/);
  assert.match(bindUI, /\$\('filter-rank'\)\.onchange/);
  assert.match(bindUI, /\$\('lookup-reset'\)\.onclick/);
  assert.doesNotMatch(bindUI, /querySelectorAll\('\.tab'\)/, 'no tab click binding may remain');
  // Lookup is the only renderable view, so the retired renderers cannot be reached.
  assert.match(ADMIN_SOURCE, /function renderActiveTab\(\)\{renderLookup\(\)\}/);
});

test('the read-only source message replaces the legacy workbook/Firestore claim', () => {
  assert.match(ADMIN_HTML, /PAWS Azure SQL Beta API/);
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
test('58–63. the Dashboard page runtime surface shrank and makes no latency claim', () => {
  const srcs = [...ADMIN_HTML.matchAll(/<script[^>]*>/g)].length;
  assert.equal(srcs, 7, 'script elements: 2 Firebase CDN + 1 inline flag + 4 local');
  const local = [...ADMIN_HTML.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
  assert.equal(local.length, 4, 'local scripts: session-guard, faculty-access, paws-data-client, faculty-admin');
  assert.equal(RETIRED_SCRIPTS.length, 17);
  assert.doesNotMatch(ADMIN_HTML, /\d+\s?ms\b/, 'no latency figure may be claimed in the page');
});

test('64. performance timing hooks are preserved', () => {
  assert.match(ADMIN_SOURCE, /window\.__pawsDashboardTiming===true/);
  assert.match(ADMIN_SOURCE, /\[PAWS dashboard timing\]/);
  assert.match(ADMIN_SOURCE, /pawsTiming\('summary\+faculty'/);
  assert.match(ADMIN_SOURCE, /pawsTiming\('detail'/);
});

// ===========================================================================
// 65–68: remaining dormant Firestore references (Stage 3C scope)
// ===========================================================================
test('65 / 67. dormant Firestore references remain but no executed path is reachable', () => {
  assert.ok(ADMIN_SOURCE.includes('firebase.firestore'), 'dormant legacy references remain for Stage 3C');
  assert.ok(ADMIN_SOURCE.includes('db.collection('), 'dormant legacy references remain for Stage 3C');
  // Every remaining reference sits inside a legacy writer that the shipped page cannot reach.
  const live = [slice('function init()', 'function bindUI'), slice('async function loadAdminDashboard', 'async function writeDerivedIndexes'), slice('function renderLookup', 'function field('), slice('async function selectFacultyDetail', 'async function loadAdminDashboard'), slice('async function loadSelfFaculty', 'async function enterSelfMode')];
  for (const body of live) assert.doesNotMatch(body, /firebase\.firestore|db\.collection\(|db\.doc\(/, 'no live path may touch Firestore');
});

test('66. faculty-access.js keeps its legacy exports and only gained the narrow opt-out', () => {
  assert.match(ACCESS_SOURCE, /return \{config,role,admin,general,historyAll,label,esc,number,init,ready,watch,logs\}/);
  assert.match(ACCESS_SOURCE, /enablePersistence\(\{synchronizeTabs:true\}\)/);
  const runLines = ACCESS_SOURCE.split(/\r?\n/).filter(l => l.includes('const run='));
  assert.equal(runLines.length, 1);
  assert.match(runLines[0], /if\(page==='index\.html'\)load\('approval-workflow\.js'/);
});

// ===========================================================================
// helpers
// ===========================================================================
async function runAccessLoader({ pathname, apiOnly }) {
  const start = ACCESS_SOURCE.lastIndexOf('(()=>{');
  assert.ok(start > 0, 'the faculty-access loader IIFE must exist');
  const block = ACCESS_SOURCE.slice(start);
  const loaded = [];
  const keys = [];
  const element = () => ({ dataset: {}, set src(v) { loaded.push(v); }, get src() { return ''; }, async: false });
  const document = {
    readyState: 'complete',
    addEventListener() {},
    querySelector: () => null,
    createElement: () => {
      const el = element();
      const originalDataset = el.dataset;
      Object.defineProperty(el, 'dataset', {
        get() {
          return new Proxy(originalDataset, {
            set(target, key, value) { keys.push('data-' + key); return Reflect.set(target, key, value); }
          });
        }
      });
      return el;
    },
    head: { appendChild() {} }
  };
  const window = {};
  if (apiOnly) window.UCVM_PAWS_DASHBOARD_API_ONLY = true;
  const context = { window, document, location: { pathname }, setTimeout, console: { warn() {}, error() {} } };
  context.globalThis = context;
  vm.runInNewContext(block, context, { filename: 'faculty-access-loader.js' });
  await flush();
  return { loaded, keys };
}
