'use strict';
// BETA-R4D-10B Stage 3C — zero-Firestore Dashboard proof + frontend acceptance.
//
// The controller is executed inside a vm sandbox where:
//   * `firebase` exposes ONLY { apps, initializeApp, auth } — there is no
//     `firestore` property at all, so any accidental dependency throws;
//   * the `UCVM` global does not exist, so any accidental dependency throws;
//   * the Firestore module scripts are not loaded.
// The whole accepted Stage 3A Azure API flow must still complete.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const ADMIN_SOURCE = read('faculty-admin.js');
const MANAGEMENT_SOURCE = read('faculty-admin-management.js');
const DOE_RENDERER_SOURCE = read('faculty-admin-doe-renderer.js');
const DOE_WORKSHEET_SOURCE = read('faculty-admin-doe-worksheet.js');
const AFC_BATCH_SOURCE = read('faculty-admin-afc-batch.js');
const ADMIN_HTML = read('faculty-admin.html');
const ACCESS_SOURCE = read('faculty-access.js');
const CLIENT_SOURCE = read('paws-data-client.js');
const CONTINUITY_SOURCE = read('paws-auth-continuity.js');
const GUARD_SOURCE = read('session-guard.js');

const KPI_IDS = ['kpi-total', 'kpi-sessions', 'kpi-assignments', 'kpi-courses', 'kpi-roles', 'kpi-hicc', 'kpi-visc', 'kpi-afc', 'kpi-grid', 'kpi-check'];

// Symbols that must no longer exist anywhere in the Dashboard controller.
const DELETED_SYMBOLS = [
  'writeDerivedIndexes', 'queueDerivedIndexWrite', 'indexedFaculty', 'loadFacultyDetail',
  'listenFacultySessions', 'ensureFullFaculty', 'ensureFullSessions', 'ensureAdminDataset',
  'reloadAdminDataset', 'subscribeFaculty', 'subscribeSessions', 'loadAuxOnce', 'setTab',
  'renderSessional', 'renderDatabase', 'renderProfile',
  'importAfcJson', 'syncCccPublicSchedule', 'saveEditor', 'deleteRecord', 'importWorkloadJson',
  'importSummaryJson', 'importJson', 'openEditor', 'closeEditor', 'exportJson', 'exportCsv',
  'updateLegacyStatus', 'updateLegacyKpis', 'stripLocal', 'exportSafe', 'download',
  'deactivateCampusFilter', 'rebuildLiveIndex', 'liveRows', 'liveAssignedDOE', 'summaryOf',
  'overrideBadge', 'workloadOf', 'afcRecordsOf', 'FORM_SECTIONS', 'UCVM_ADMIN_DATA'
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
  professionalProfile: { teachingArea: 'Anatomy', professionalCategory: 'Teaching-Focused', serviceDate: '2015-07-01', phdArea: 'Neuroscience', boardCertification: 'Board of Anatomy' },
  jointAppointments: [{ jointAppointmentId: 'j-1', homeFaculty: 'UCVM', jointFaculty: 'Cumming', fteUcvm: 0.8, fteOtherFaculty: 0.2, expiryDate: '2027-06-30', notes: 'Renewal pending' }],
  roles: [{ roleAssignmentId: 'r-1', roleType: 'Course Coordinator / HICC', courseOrSubjectOrRotation: 'VETM 300', courseName: 'Clinical Skills', details: 'Year 3', effectiveDate: '2026-09-01', expirationDate: '2027-08-31', doeMappedValue: 12.5, doeOverrideValue: 10, doeOverrideReason: 'Approved reduction', specialNotes: 'Note' }],
  afcRecords: [{ afcRecordId: 'a-1', startDate: '2026-10-01', endDate: '2026-10-05', purpose: AFC_PURPOSE, active: true }],
  teachingAssignments: [{ sessionAssignmentId: 'sa-1', sessionId: 's-1', academicYear: '2026-27', courseCode: 'VETM 101', courseName: 'Intro', topic: 'Cells', sessionType: 'Lecture', date: '2026-09-10', startTime: '08:30:00', endTime: '09:45:00', teachingRole: 'Instructor', labLead: 'No', creditedHours: 1.25, doeRate: 0.5, doeQuantity: 2.5, doeUnit: 'percent', doeCredit: 0.9, doeStatus: 'Confirmed' }],
  sessionCount: 1, checkNeededCount: 0
};
const ADMIN_PROFILE = { displayName: 'Admin User', role: 'adfa_general', facultyId: null, active: true, mustChangePassword: false };
const SELF_PROFILE = { displayName: 'Bo Two', role: 'faculty', facultyId: 'f-2', active: true, mustChangePassword: false };
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(r => setTimeout(r, 0)); };

// ---------------------------------------------------------------- harness
function createHarness(overrides = {}) {
  const calls = [], errors = [];
  let authCallback = null, signOuts = 0, sessionGuardStarts = 0;
  const classList = () => {
    const set = new Set();
    return { add(c) { set.add(c); }, remove(c) { set.delete(c); }, toggle(c, v) { if (v === undefined) { set.has(c) ? set.delete(c) : set.add(c); } else if (v) set.add(c); else set.delete(c); }, contains(c) { return set.has(c); } };
  };
  const element = id => ({ id, classList: classList(), dataset: {}, style: {}, value: '', textContent: '', innerHTML: '', disabled: false, options: [], children: [], onclick: null, oninput: null, onchange: null, onsubmit: null, setAttribute() {}, addEventListener(event, handler) { this[`on${event}`] = handler; }, appendChild() {}, remove() {}, click() {}, querySelectorAll() { return []; }, querySelector() { return null; } });
  const nodes = new Map(), rowStubs = new Map();
  const byId = id => { if (!nodes.has(id)) nodes.set(id, element(id)); return nodes.get(id); };
  const auth = { setPersistence: async () => {}, onAuthStateChanged(cb) { authCallback = cb; }, async signOut() { signOuts += 1; } };
  const firebaseAuth = Object.assign(function () { return auth; }, { Auth: { Persistence: { LOCAL: 'local' } } });
  const pawsData = {
    currentUser: async () => { calls.push('currentUser'); return overrides.currentUser ? overrides.currentUser() : ADMIN_PROFILE; },
    dashboardSummary: async () => { calls.push('dashboardSummary'); return overrides.summary ? overrides.summary() : SUMMARY; },
    dashboardFaculty: async () => { calls.push('dashboardFaculty'); return overrides.faculty ? overrides.faculty() : ROSTER; },
    dashboardFacultyById: async id => { calls.push('dashboardFacultyById:' + id); return overrides.facultyById ? overrides.facultyById(id) : DETAIL; },
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
  const window = { confirm: () => true, UCVMSessionGuard: { start() { sessionGuardStarts += 1; } } };
  const context = {
    window, document,
    location: { href: '', pathname: '/faculty-admin.html', replace() {} },
    // ONLY apps / initializeApp / auth — no firestore anywhere.
    firebase: { apps: [], initializeApp() {}, auth: firebaseAuth },
    UCVM_PAWS_DATA: pawsData,
    Event: class { constructor(type) { this.type = type; } },
    console: { error(...a) { errors.push(a.map(v => (v && v.stack) || String(v)).join(' ')); }, warn() {}, info() {}, log() {} },
    performance: { now: () => Date.now() },
    setTimeout, clearTimeout, Map, Set, Date, JSON, String, Number, Boolean, Array, Object, Math, Promise, RegExp, Error, TypeError, isNaN, parseInt, parseFloat
  };
  context.globalThis = context;
  // NOTE: context.UCVM is deliberately absent.
  vm.runInNewContext(read('faculty-name.js'), context, { filename: 'faculty-name.js' });
  vm.runInNewContext(read('dashboard-view-model.js'), context, { filename: 'dashboard-view-model.js' });
  vm.runInNewContext(DOE_RENDERER_SOURCE, context, { filename: 'faculty-admin-doe-renderer.js' });
  vm.runInNewContext(DOE_WORKSHEET_SOURCE, context, { filename: 'faculty-admin-doe-worksheet.js' });
  vm.runInNewContext(MANAGEMENT_SOURCE, context, { filename: 'faculty-admin-management.js' });
  vm.runInNewContext(ADMIN_SOURCE, context, { filename: 'faculty-admin.js' });
  return {
    calls, errors, byId,
    signOuts: () => signOuts,
    sessionGuardStarts: () => sessionGuardStarts,
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
async function drive(overrides) { const h = createHarness(overrides); await h.signIn(); await flush(); return h; }

// ===========================================================================
// A–D: final page runtime graph
// ===========================================================================
test('A / D. the page loads only the Firebase app+auth CDN and bounded local scripts', () => {
  const srcs = [...ADMIN_HTML.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  const cdn = srcs.filter(s => /^https?:/.test(s));
  const local = srcs.filter(s => !/^https?:/.test(s));
  assert.deepEqual(cdn, [
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js'
  ]);
  assert.deepEqual(local, ['session-guard.js', 'paws-api-origin.js', 'paws-data-client.js', 'paws-auth-continuity.js', 'faculty-name.js', 'dashboard-view-model.js', 'faculty-admin-doe-renderer.js', 'faculty-admin-doe-manual.js', 'faculty-admin-doe-edit.js', 'faculty-admin-doe-worksheet.js', 'faculty-admin-doe-rulebook.js', 'faculty-admin-doe-policy.js', 'faculty-admin-afc-batch.js', 'faculty-admin-management.js', 'faculty-admin.js']);
  assert.equal([...ADMIN_HTML.matchAll(/<script[^>]*>/g)].length, 17, '17 script elements total');
  assert.equal([...ADMIN_HTML.matchAll(/<script>([^<]*)<\/script>/g)].length, 0, 'no inline script remains');
});

test('A. the page loads no Firestore SDK and no legacy module', () => {
  for (const banned of ['firestore', 'firebase-firestore', 'faculty-access.js', 'maintenance-state.js', 'faculty-swap-safe.js', 'bulk-import', 'derived-index-health.js', 'index-maintenance.js', 'faculty-admin-enhancements.js', 'faculty-doe.js', 'scheduling-core.js', 'data-index.js', 'audit-details.js', 'faculty-account-planner.js', 'approval-scheduling.js']) {
    assert.equal(ADMIN_HTML.includes(banned), false, `${banned} must not appear on the Dashboard page`);
  }
});

test('B. faculty-admin.html does not load faculty-access.js', () => {
  assert.equal(ADMIN_HTML.includes('faculty-access.js'), false);
  assert.equal(ACCESS_SOURCE.includes('window.UCVM='), true, 'the shared file still exists for other pages');
});

test('C. the Stage 3B inline API-only flag is gone', () => {
  assert.equal(ADMIN_HTML.includes('UCVM_PAWS_DASHBOARD_API_ONLY'), false);
  assert.equal(ADMIN_HTML.includes('<script>'), false);
});

// ===========================================================================
// E–J: zero Firestore and zero UCVM in the controller
// ===========================================================================
test('E–I. the controller contains no Firestore implementation at all', () => {
  for (const pattern of ['firebase.firestore', 'db.collection', 'db.doc', 'FieldValue', 'enablePersistence', 'onSnapshot', 'COLLECTION', 'faculty_change_log', 'session_change_log', 'faculty_index', 'schedule_stats', 'public_schedule', 'AUX_DOC', 'setTimeout(()=>writeDerivedIndexes']) {
    assert.equal(ADMIN_SOURCE.includes(pattern), false, `${pattern} must be absent`);
  }
  assert.equal(/\bfirestore\b/i.test(ADMIN_SOURCE), false, 'no firestore reference of any kind');
});

test('J. the controller has no UCVM dependency', () => {
  assert.equal(/UCVM\./.test(ADMIN_SOURCE), false);
  assert.equal(ADMIN_SOURCE.includes('window.UCVM.'), false, 'no UCVM helper is reached through the global');
});

test('39. every retired symbol is gone from the controller', () => {
  for (const symbol of DELETED_SYMBOLS) {
    assert.equal(ADMIN_SOURCE.includes(symbol), false, `${symbol} must be absent`);
  }
});

test('AA / AB / AC / AD. no mutation, import, subscription or global renderer remains', () => {
  for (const pattern of ['db.batch', 'batch.commit', 'batch.set', 'batch.update', 'batch.delete', 'FileReader', 'afc-import', 'import-summary', 'import-workload', 'derived-index', 'JSON.stringify({exportedAt']) {
    assert.equal(ADMIN_SOURCE.includes(pattern), false, `${pattern} must be absent`);
  }
  assert.match(ADMIN_SOURCE, /function renderTeachingSummary\(/);
  assert.match(ADMIN_SOURCE, /function renderRoles\(/);
  assert.match(ADMIN_SOURCE, /function renderDoeOverview\(/);
  assert.match(ADMIN_SOURCE, /function renderActiveTab\(/);
});

// ===========================================================================
// K / L / M / N: the whole accepted flow runs with no Firestore and no UCVM
// ===========================================================================
test('K / L / M. the admin flow completes with no firebase.firestore and no UCVM global', async () => {
  const h = createHarness();
  assert.equal(h.hasAuthCallback(), true, 'init() must register an auth callback :: ' + h.errors.join(' | '));
  await h.signIn();
  await flush();
  assert.deepEqual(h.errors, [], 'no initialization error may be swallowed');
  assert.deepEqual(h.calls, ['currentUser', 'dashboardSummary', 'dashboardFaculty']);
  assert.equal(h.sessionGuardStarts(), 1, 'SessionGuard is started with auth');
  assert.equal(h.byId('result-count').textContent, ROSTER.length);
  assert.equal(h.byId('kpi-total').textContent, '120');
});

test('N. the self-service flow completes with no firebase.firestore and no UCVM global', async () => {
  const h = await drive({ currentUser: () => SELF_PROFILE });
  assert.deepEqual(h.errors, []);
  assert.deepEqual(h.calls, ['currentUser', 'dashboardFaculty', 'dashboardFacultyById:f-2']);
  assert.match(h.byId('profile-pane').innerHTML, /Teaching-Focused/);
});

// ===========================================================================
// O–S: request-count acceptance
// ===========================================================================
test('O / P / Q / R / S. request counts are exactly as accepted, with no N+1', async () => {
  const h = await drive();
  assert.equal(h.calls.filter(c => c === 'dashboardSummary').length, 1);
  assert.equal(h.calls.filter(c => c === 'dashboardFaculty').length, 1);
  assert.deepEqual(h.calls.filter(c => c.startsWith('dashboardFacultyById')), [], 'P: initial detail = 0');
  await h.clickRow('f-1');
  assert.deepEqual(h.calls.filter(c => c.startsWith('dashboardFacultyById')), ['dashboardFacultyById:f-1'], 'Q: one selection = one detail call');
  await h.clickRow('f-1');
  assert.equal(h.calls.filter(c => c.startsWith('dashboardFacultyById')).length, 1, 'R: cached selection does not refetch');
  await h.clickRow('f-2');
  assert.deepEqual(h.calls.filter(c => c.startsWith('dashboardFacultyById')), ['dashboardFacultyById:f-1', 'dashboardFacultyById:f-2'], 'S: one per distinct faculty, never a fanout');

  const load = ADMIN_SOURCE.slice(ADMIN_SOURCE.indexOf('async function loadAdminDashboard'), ADMIN_SOURCE.indexOf('function dashboardRawRole'));
  assert.match(load, /await Promise\.all\(\[\s*UCVM_PAWS_DATA\.dashboardSummary\(\),\s*UCVM_PAWS_DATA\.dashboardFaculty\(\{\s*status:\s*facultyStatus\s*\}\),/, 'summary + status-filtered roster stay parallel');
  assert.equal(load.split('await').length - 1, 1, 'no serial await precedes the parallel load');
});

test('60 / 61. self-service calls neither summary nor email lookup', async () => {
  const h = await drive({ currentUser: () => SELF_PROFILE });
  assert.equal(h.calls.includes('dashboardSummary'), false);
  const self = ADMIN_SOURCE.slice(ADMIN_SOURCE.indexOf('async function loadSelfFaculty'), ADMIN_SOURCE.indexOf('async function enterSelfMode'));
  assert.doesNotMatch(self, /email|firestore|collection\(/i);
});

// ===========================================================================
// T / U / V / W: KPI and Lookup are API-only with no legacy fallback
// ===========================================================================
test('T / U. KPIs are driven exclusively by the API summary with no legacy fallback', async () => {
  const h = await drive();
  const expected = { 'kpi-total': '120', 'kpi-sessions': '1937', 'kpi-assignments': '4970', 'kpi-courses': '214', 'kpi-roles': '162', 'kpi-hicc': '64', 'kpi-visc': '35', 'kpi-afc': '791', 'kpi-grid': '1902', 'kpi-check': '35' };
  for (const [id, value] of Object.entries(expected)) assert.equal(h.byId(id).textContent, value, id);
  const kpis = ADMIN_SOURCE.slice(ADMIN_SOURCE.indexOf('function updateKpis'), ADMIN_SOURCE.indexOf('function renderLookup'));
  assert.doesNotMatch(kpis, /facultySummary2026_27|workloadPolicy2026_27|__index|sessionsLoaded|scheduleStats/, 'no legacy KPI computation');
  assert.doesNotMatch(kpis, /updateLegacyKpis/);
});

test('V / W. Lookup is API-only with no legacy fallback', async () => {
  const h = await drive();
  assert.equal(h.byId('result-count').textContent, ROSTER.length);
  assert.match(h.byId('result-list').innerHTML, /Ada One/);
  assert.match(h.byId('result-list').innerHTML, /12 sessions · 0 roles · 0 AFC/);
  assert.equal(/__api/.test(ADMIN_SOURCE), false, 'no API/legacy row discrimination remains');
  const lookup = ADMIN_SOURCE.slice(ADMIN_SOURCE.indexOf('function renderLookup'), ADMIN_SOURCE.indexOf('function teachingSummaryDoeStatus'));
  assert.ok(lookup.length > 0, 'Lookup source boundary must resolve');
  assert.doesNotMatch(lookup, /__index|liveRows|liveAssignedDOE|summaryOf|renderProfile|overrideBadge/, 'no legacy lookup fallback');
});

test('X. the campus filter is absent from the page and the controller', () => {
  assert.equal(ADMIN_HTML.includes('filter-campus'), false);
  assert.equal(ADMIN_SOURCE.includes('filter-campus'), false);
  assert.equal(ADMIN_HTML.includes('Campus'), false, 'no campus wording remains');
  assert.match(ADMIN_HTML, /id="filter-rank"/, 'the rank filter remains');
});

test('Y. AFC purpose is detail-only', async () => {
  const h = await drive();
  assert.equal(h.byId('result-list').innerHTML.includes(AFC_PURPOSE), false, 'never in the roster');
  assert.equal(ADMIN_HTML.includes(AFC_PURPOSE), false);
  const lookup = ADMIN_SOURCE.slice(ADMIN_SOURCE.indexOf('function renderLookup'), ADMIN_SOURCE.indexOf('function teachingSummaryDoeStatus'));
  assert.ok(lookup.length > 0, 'Lookup privacy source boundary must resolve');
  assert.doesNotMatch(lookup, /purpose/i);
  const blob = ADMIN_SOURCE.slice(ADMIN_SOURCE.indexOf('function searchBlob'), ADMIN_SOURCE.indexOf('function filteredLookup'));
  assert.doesNotMatch(blob, /purpose/i, 'never in the Lookup search index');
  await h.clickRow('f-1');
  assert.match(h.byId('profile-pane').innerHTML, new RegExp(AFC_PURPOSE), 'shown in the selected detail');
});

test('Z. stored DOE remains authoritative and the browser never recomputes DOE', async () => {
  const h = await drive();
  await h.clickRow('f-1');
  const pane = h.byId('profile-pane').innerHTML;
  assert.match(pane, /Stored DOE/);
  assert.match(pane, /Calculated DOE/);
  assert.match(pane, /Effective DOE/);
  assert.match(pane, /<td>0\.90%<\/td><td>DOE unavailable<\/td><td>0\.90%<\/td>/, 'stored teaching DOE remains effective when no server calculator result is supplied');
  assert.doesNotMatch(pane, /1\.25%/, 'browser must not derive DOE from legacy rate and quantity');
  assert.match(pane, /<td>12\.50%<\/td><td>10\.00%<\/td>/, 'roles preserve stored mapped and override DOE');
  assert.doesNotMatch(ADMIN_SOURCE, /doeRate\s*\*|\*\s*doeQuantity/, 'no browser DOE recomputation');
});

// ===========================================================================
// 77–83: canonical detail rendering
// ===========================================================================
test('77–83. the canonical API detail renders profile, joint appointments, roles, AFC and teaching', async () => {
  const h = await drive();
  await h.clickRow('f-1');
  const pane = h.byId('profile-pane').innerHTML;
  assert.match(pane, /Specialty (?:&|&amp;) education/i, '77');
  assert.match(pane, /Renewal pending/, '78');
  assert.match(pane, /VETM 300/, '79');
  assert.match(pane, new RegExp(AFC_PURPOSE), '80');
  assert.match(pane, /VETM 101/, '82');
  assert.match(pane, /Assignments needing time review/, '83 counts');
});

// ===========================================================================
// AE / AF: local access helpers and User Management visibility
// ===========================================================================
function loadHelpers() {
  const names = ['dashboardRawRole', 'dashboardRole', 'dashboardAdmin', 'dashboardGeneral', 'dashboardRoleLabel'];
  const src = names.map(n => {
    const idx = ADMIN_SOURCE.indexOf(`function ${n}(`);
    const brace = ADMIN_SOURCE.indexOf('{', idx);
    let depth = 0, end = -1;
    for (let i = brace; i < ADMIN_SOURCE.length; i++) {
      const c = ADMIN_SOURCE[i];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    return ADMIN_SOURCE.slice(idx, end + 1);
  }).join('\n');
  return vm.runInNewContext(`${src}\n({dashboardRole,dashboardAdmin,dashboardGeneral,dashboardRoleLabel});`);
}

test('AE. the local access helpers match the locked server role policy', () => {
  const h = loadHelpers();
  const cases = [
    ['owner', 'adfa_general', true, true, 'ADFAD Owner'],
    ['adfa_general', 'adfa_general', true, true, 'ADFAD Owner'],
    ['administrator', 'adfa_regular', true, false, 'ADFAD Admin'],
    ['adfa_regular', 'adfa_regular', true, false, 'ADFAD Admin'],
    ['admin', 'adfa_regular', true, false, 'ADFAD Admin'],
    ['other_office', 'other_office', false, false, 'Other Office'],
    ['faculty', 'faculty', false, false, 'Faculty'],
    ['hicc', 'hicc', false, false, 'HICC'],
    ['visc', 'visc', false, false, 'VISC'],
    ['editor', 'faculty', false, false, 'Faculty'],
    ['viewer', 'faculty', false, false, 'Faculty']
  ];
  for (const [role, normalized, isAdmin, isGeneral, label] of cases) {
    const profile = { role };
    assert.equal(h.dashboardRole(role), normalized, `${role} normalizes`);
    assert.equal(h.dashboardAdmin(profile), isAdmin, `${role} admin`);
    assert.equal(h.dashboardGeneral(profile), isGeneral, `${role} general`);
    assert.equal(h.dashboardRoleLabel(role), label, `${role} label`);
  }
  assert.equal(h.dashboardAdmin({ role: 'unknown_role' }), false, 'unknown roles gain nothing');
  assert.equal(h.dashboardGeneral({ role: 'unknown_role' }), false);
  assert.equal(h.dashboardAdmin({ role: 'OWNER' }), true, 'role casing is normalized');
});

test('AF. User Management visibility stays restricted to the high-trust UI role', () => {
   assert.match(ADMIN_SOURCE, /\$\('user-management-link'\)\??\.classList\.toggle\('hidden',\s*!dashboardGeneral\(profile\)\)/);
  assert.equal(ADMIN_SOURCE.includes('dashboardAdmin(p));unlock'), false, 'admin roles must not reveal User Management');
  const h = loadHelpers();
  assert.equal(h.dashboardGeneral({ role: 'adfa_regular' }), false, 'a plain administrator does not see it');
});

// ===========================================================================
// AG–AM: error behaviour
// ===========================================================================
test('AG / AH / AI / AL / AM. 401, 403 and 503 fail closed with no signout and no fallback', async () => {
  const cases = [
    [401, 'UNAUTHENTICATED', /session could not be verified/i],
    [403, 'ROLE_DENIED', /Role denied by SQL profile/],
    [503, 'SQL_UNAVAILABLE', /temporarily unavailable/i]
  ];
  for (const [status, code, message] of cases) {
    const failure = Object.assign(new Error(status === 403 ? 'Role denied by SQL profile' : 'The SQL read service is unavailable.'), { status, code });
    const h = await drive({ currentUser: () => { throw failure; } });
    assert.equal(h.signOuts(), 0, `${status} must not sign out`);
    assert.equal(h.errors.length >= 1, true);
  }
  const transient = Object.assign(new Error('The SQL read service is unavailable.'), { status: 503, code: 'SQL_UNAVAILABLE' });
  const h2 = await drive({ summary: async () => { throw transient; } });
  assert.equal(h2.signOuts(), 0);
  assert.match(h2.byId('sync-status').textContent, /temporarily unavailable/i);
  assert.equal(h2.byId('kpi-total').textContent, '—');
  assert.doesNotMatch(ADMIN_SOURCE, /firestore|collection\(/i, 'no Firestore fallback exists');
});

test('AJ / AK. detail 404 and 503 keep the roster and report truthfully', async () => {
  const notFound = Object.assign(new Error('Faculty record not found.'), { status: 404, code: 'FACULTY_NOT_FOUND' });
  const h404 = createHarness({ facultyById: async () => { throw notFound; } });
  await h404.signIn();
  await flush();
  await h404.clickRow('f-1');
  assert.equal(h404.byId('result-count').textContent, ROSTER.length, 'roster preserved on 404');
  assert.deepEqual(h404.rowIds(), ['f-1', 'f-2']);
  assert.match(h404.byId('profile-pane').innerHTML, /not found/i);

  const unavailable = Object.assign(new Error('The SQL read service is unavailable.'), { status: 503, code: 'SQL_UNAVAILABLE' });
  const h503 = createHarness({ facultyById: async () => { throw unavailable; } });
  await h503.signIn();
  await flush();
  await h503.clickRow('f-1');
  assert.equal(h503.byId('result-count').textContent, ROSTER.length, 'roster preserved on 503');
  assert.match(h503.byId('profile-pane').innerHTML, /temporarily unavailable/i);
  assert.equal(h503.signOuts(), 0);

  const src = ADMIN_SOURCE.slice(ADMIN_SOURCE.indexOf('function detailFailureMessage'), ADMIN_SOURCE.indexOf('function setDashboardLoading'));
  assert.match(src, /404|FACULTY_NOT_FOUND/);
  assert.match(src, /503|SQL_UNAVAILABLE/);
  assert.match(src, /401|UNAUTHENTICATED/);
  assert.doesNotMatch(src, /signOut|collection\(/i);
});

// ===========================================================================
// AN: timing hooks
// ===========================================================================
test('AN. the opt-in timing hooks are preserved', () => {
  assert.match(ADMIN_SOURCE, /window\.__pawsDashboardTiming\s*===\s*true/);
  assert.match(ADMIN_SOURCE, /\[PAWS dashboard timing\]/);
   assert.match(ADMIN_SOURCE, /pawsTimingLog\('me'/);
   assert.match(ADMIN_SOURCE, /pawsTimingLog\('summary\+faculty'/);
  assert.match(ADMIN_SOURCE, /pawsTimingLog\('detail'/);
  assert.doesNotMatch(ADMIN_SOURCE, /sendBeacon|localStorage|sessionStorage|XMLHttpRequest|fetch\(/, 'no telemetry and no persistence');
});

// ===========================================================================
// 33: static page acceptance
// ===========================================================================
test('33. the page exposes the read-only Lookup experience and nothing retired', () => {
  for (const present of ['Faculty Dashboard', 'PAWS University API', 'VetMed-Ops teaching data', 'read-only', 'id="kpi-total"', 'id="lookup-search"', 'id="filter-rank"', 'id="profile-pane"', 'index.html#approvals', 'user-management.html', 'password.html', 'id="signout-btn"']) {
    assert.equal(ADMIN_HTML.includes(present), true, `${present} must be present`);
  }
  for (const absent of ['firestore', 'xlsx', 'V9.7', 'data-general-only', 'edit-modal', 'derived-index', 'history-view', 'database-view', 'sessional-view']) {
    assert.equal(ADMIN_HTML.includes(absent), false, `${absent} must be absent`);
  }
});

// ===========================================================================
// 98–101: dependency-closure proof
// ===========================================================================
test('98–101. no local Dashboard runtime script carries a Firestore dependency', () => {
  assert.equal(/\bfirestore\b/i.test(GUARD_SOURCE), false, 'session-guard.js: no Firestore dependency');
  assert.equal(/\bfirestore\b/i.test(CLIENT_SOURCE), false, 'paws-data-client.js: no Firestore dependency');
  assert.equal(/\bfirestore\b/i.test(CONTINUITY_SOURCE), false, 'paws-auth-continuity.js: no Firestore dependency');
  assert.equal(/\bfirestore\b/i.test(ADMIN_SOURCE), false, 'faculty-admin.js: no Firestore dependency');
  assert.equal(/\bfirestore\b/i.test(DOE_RENDERER_SOURCE), false, 'faculty-admin-doe-renderer.js: no Firestore dependency');
  const doeWorksheetSource = read('faculty-admin-doe-worksheet.js');
  assert.equal(/\bfirestore\b/i.test(doeWorksheetSource), false, 'faculty-admin-doe-worksheet.js: no Firestore dependency');
  assert.equal(/\bfirestore\b/i.test(AFC_BATCH_SOURCE), false, 'faculty-admin-afc-batch.js: no Firestore dependency');
  const local = [...ADMIN_HTML.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
  assert.deepEqual(local, ['session-guard.js', 'paws-api-origin.js', 'paws-data-client.js', 'paws-auth-continuity.js', 'faculty-name.js', 'dashboard-view-model.js', 'faculty-admin-doe-renderer.js', 'faculty-admin-doe-manual.js', 'faculty-admin-doe-edit.js', 'faculty-admin-doe-worksheet.js', 'faculty-admin-doe-rulebook.js', 'faculty-admin-doe-policy.js', 'faculty-admin-afc-batch.js', 'faculty-admin-management.js', 'faculty-admin.js']);
});

test('92 / 94 / 96. the controller stays bounded with contract DOE detail and overview', () => {
  const bytes = fs.statSync(path.join(root, 'faculty-admin.js')).size;
  const named = [...ADMIN_SOURCE.matchAll(/function ([A-Za-z0-9_$]+)\(/g)].length;
  // Accepted DOE Calculator/P4 wiring plus sectioned reference profile, AFC
  // archive and detail-generation guards keep the controller under 60 KB.
  assert.ok(bytes < 60000, `controller must remain bounded after Faculty reference parity integration (actual ${bytes})`);
  assert.match(ADMIN_SOURCE, /function renderTeachingSummary\(/);
  assert.match(ADMIN_SOURCE, /function renderRoles\(/);
  assert.match(ADMIN_SOURCE, /function renderDoeOverview\(/);
  assert.match(ADMIN_SOURCE, /function renderActiveTab\(/);
});
