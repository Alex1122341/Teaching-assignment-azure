'use strict';
// BETA-R4D-10B Stage 3A — Dashboard core Azure SQL read cutover.
//
// These tests execute the REAL production faculty-admin.js inside a vm sandbox
// with a Firestore stub that records every collection/document touch and a
// UCVM_PAWS_DATA stub that records every API call. They therefore prove the
// behavioural contract of the cutover rather than only its source shape.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const ADMIN_SOURCE = read('faculty-admin.js');

const KPI_IDS = ['kpi-total', 'kpi-sessions', 'kpi-assignments', 'kpi-courses', 'kpi-roles', 'kpi-hicc', 'kpi-visc', 'kpi-afc', 'kpi-grid', 'kpi-check'];

// ---------------------------------------------------------------- fixtures
const SUMMARY = {
  academicYear: '2026-27',
  activeFacultyCount: 120,
  sessionCount: 1937,
  assignmentCount: 4970,
  courseCount: 214,
  roleAssignmentCount: 162,
  hiccCount: 64,
  viscCount: 35,
  afcRecordCount: 791,
  gridPositionableCount: 1902,
  checkNeededCount: 35
};

const AFC_PURPOSE = 'ZZ-AFC-PURPOSE-ONLY';

const ROSTER = [
  {
    facultyId: 'f-1', preferredFirstName: 'Ada', preferredLastName: 'One', displayName: 'Ada One',
    ucid: '10000001', email: 'ada@example.test', recordType: 'faculty', stream: 'Teaching',
    rank: 'Professor', fte: 1, reportsToFacultyId: '', reportsToName: 'Dean', active: true,
    teachingArea: 'Anatomy', professionalCategory: 'Teaching-Focused',
    sessionCount: 12, roleCount: 0, afcCount: 0, jointAppointmentCount: 0
  },
  {
    facultyId: 'f-2', preferredFirstName: 'Bo', preferredLastName: 'Two', displayName: 'Bo Two',
    ucid: '10000002', email: 'bo@example.test', recordType: 'faculty', stream: 'Research',
    rank: 'Associate Professor', fte: 0.8, reportsToFacultyId: '', reportsToName: 'Dean', active: true,
    teachingArea: 'Cardiology', professionalCategory: 'Teaching & Research',
    sessionCount: 4, roleCount: 0, afcCount: 0, jointAppointmentCount: 0
  },
  {
    facultyId: 'f-3', preferredFirstName: 'Cy', preferredLastName: 'Three', displayName: 'Cy Three',
    ucid: '10000003', email: 'cy@example.test', recordType: 'faculty', stream: 'Teaching',
    rank: 'Professor', fte: 1, reportsToFacultyId: '', reportsToName: 'Dean', active: true,
    teachingArea: 'Surgery', professionalCategory: 'Teaching-Focused',
    sessionCount: 7, roleCount: 0, afcCount: 0, jointAppointmentCount: 0
  }
];

function detailFor(facultyId) {
  return {
    faculty: {
      facultyId, recordType: 'faculty', preferredFirstName: 'Ada', preferredLastName: 'One',
      displayName: 'Ada One', ucid: '10000001', email: 'ada@example.test', stream: 'Teaching',
      rank: 'Professor', fte: 1, reportsToFacultyId: '', reportsToName: 'Dean', active: true
    },
    academicYear: '2026-27',
    professionalProfile: {
      teachingArea: 'Anatomy', professionalCategory: 'Teaching-Focused', serviceDate: '2015-07-01',
      priorYearsExperience: 6, dvmEarnedDate: '2009-05-01', dvmType: 'DVM', mastersEarnedDate: '',
      mastersArea: '', phdEarnedDate: '2014-06-01', phdArea: 'Neuroscience', boardCertifiedDate: '',
      boardCertification: 'Board of Anatomy', boardCertificationCount: 1,
      abvmaLicenseNumber: 'ABVMA-1', abvmaMemberType: 'General'
    },
    jointAppointments: [
      { jointAppointmentId: 'j-1', homeFaculty: 'UCVM', jointFaculty: 'Cumming', fteUcvm: 0.8, fteOtherFaculty: 0.2, expiryDate: '2027-06-30', notes: 'Renewal pending' }
    ],
    roles: [
      {
        roleAssignmentId: 'r-1', facultyResolutionStatus: 'resolved', academicYear: '2026-27',
        roleCategory: '', roleType: 'Course Coordinator / HICC', courseOrSubjectOrRotation: 'VETM 300',
        courseName: 'Clinical Skills', details: 'Year 3 coordination', effectiveDate: '2026-09-01',
        expirationDate: '2027-08-31', doeMappedValue: 12.5, doeOverrideValue: 10,
        doeOverrideReason: 'Approved reduction', specialNotes: 'Note text'
      }
    ],
    afcRecords: [
      { afcRecordId: 'a-1', startDate: '2026-10-01', endDate: '2026-10-05', purpose: AFC_PURPOSE, active: true }
    ],
    teachingAssignments: [
      {
        sessionAssignmentId: 'sa-1', sessionId: 's-1', academicYear: '2026-27', curriculumYear: '3',
        courseCode: 'VETM 101', courseName: 'Intro to Clinical Practice', topic: 'Cells',
        sessionType: 'Lecture', date: '2026-09-10', startTime: '08:30:00', endTime: '09:45:00',
        room: 'HSC 1', teachingRole: 'Instructor', labLead: 'No', creditedHours: 1.25,
        // doeRate * doeQuantity = 1.25, but the authoritative stored credit is 0.9.
        // Any client-side recomputation would therefore surface 1.25 instead of 0.9.
        doeRate: 0.5, doeQuantity: 2.5, doeUnit: 'percent', doeCredit: 0.9, doeStatus: 'Confirmed'
      }
    ],
    sessionCount: 1,
    checkNeededCount: 0
  };
}

const ADMIN_PROFILE = { displayName: 'Admin User', role: 'adfa_general', facultyId: null, active: true, mustChangePassword: false };
const SELF_PROFILE = { displayName: 'Bo Two', role: 'faculty', facultyId: 'f-2', active: true, mustChangePassword: false };
const ADMIN_ROLES = ['owner', 'administrator', 'adfa_general', 'adfa_regular', 'admin'];

const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
const slice = (from, to) => ADMIN_SOURCE.slice(ADMIN_SOURCE.indexOf(from), ADMIN_SOURCE.indexOf(to));

// ---------------------------------------------------------------- harness
function createHarness(overrides = {}) {
  const reads = [];
  const calls = [];
  const events = [];
  const logs = [];
  const errors = [];
  const redirects = [];
  const rowStubs = new Map();
  let authCallback = null;
  let signOuts = 0;

  const classList = () => {
    const set = new Set();
    return {
      add(c) { set.add(c); },
      remove(c) { set.delete(c); },
      toggle(c, v) { if (v === undefined) { set.has(c) ? set.delete(c) : set.add(c); } else if (v) set.add(c); else set.delete(c); },
      contains(c) { return set.has(c); }
    };
  };
  const element = id => ({
    id, classList: classList(), dataset: {}, style: {}, value: '', textContent: '', innerHTML: '',
    disabled: false, options: [], children: [], onclick: null, oninput: null, onchange: null, onsubmit: null,
    setAttribute() {}, appendChild() {}, remove() {}, click() {}, querySelectorAll() { return []; }, querySelector() { return null; }
  });
  const nodes = new Map();
  const byId = id => { if (!nodes.has(id)) nodes.set(id, element(id)); return nodes.get(id); };

  const firestore = {
    collection(name) {
      reads.push(name);
      return {
        doc(id) {
          reads.push(name + '/' + id);
          return { get: async () => ({ exists: false, data: () => ({}), id: String(id) }), set: async () => {}, update: async () => {}, onSnapshot: () => () => {}, id: String(id) };
        },
        where() { return { get: async () => ({ docs: [] }), onSnapshot: () => () => {} }; },
        get: async () => ({ docs: [] }),
        onSnapshot: () => () => {},
        add: async () => ({ id: 'generated' })
      };
    },
    batch() { return { set() {}, update() {}, delete() {}, commit: async () => {} }; },
    doc(p) {
      reads.push(String(p));
      return { get: async () => ({ exists: false, data: () => ({}) }), set: async () => {}, update: async () => {}, onSnapshot: () => () => {} };
    }
  };

  const pawsData = {
    sessionBackend: () => 'azure-sql',
    sessionWritesEnabled: () => false,
    currentUser: async () => { calls.push('currentUser'); return overrides.currentUser ? overrides.currentUser() : ADMIN_PROFILE; },
    dashboardSummary: async () => { calls.push('dashboardSummary'); return overrides.summary ? overrides.summary() : SUMMARY; },
    dashboardFaculty: async () => { calls.push('dashboardFaculty'); return overrides.faculty ? overrides.faculty() : ROSTER; },
    dashboardFacultyById: async id => {
      calls.push('dashboardFacultyById:' + id);
      if (overrides.facultyById) return overrides.facultyById(id);
      return detailFor(id);
    },
    listSessions: async () => []
  };

  const auth = {
    setPersistence: async () => {},
    onAuthStateChanged(callback) { authCallback = callback; },
    async signOut() { signOuts += 1; }
  };

  // BETA-R4D-10B Stage 3B: the Dashboard is auth-only. Any touch of
  // firebase.firestore or UCVM.init() is a contract violation and fails loudly.
  let firestoreTouches = 0, ucvmInitCalls = 0;
  const firebaseAuth = Object.assign(function () { return auth; }, { Auth: { Persistence: { LOCAL: 'local' } } });
  const firebaseStub = { apps: [], initializeApp() {}, auth: firebaseAuth };
  Object.defineProperty(firebaseStub, 'firestore', {
    get() { firestoreTouches += 1; throw new Error('firebase.firestore must not be touched by the Dashboard'); }
  });

  const document = {
    title: '',
    documentElement: { dataset: {} },
    body: element('body'),
    head: { appendChild() {} },
    getElementById: byId,
    querySelector(selector) { return byId('query:' + selector); },
    querySelectorAll(selector) {
      if (selector === '.kpi-value') return KPI_IDS.map(byId);
      if (selector === '.person-row') {
        const html = byId('result-list').innerHTML || '';
        const ids = (html.match(/data-id="[^"]*"/g) || []).map(s => s.replace(/^data-id="|"$/g, ''));
        return ids.map(id => {
          if (!rowStubs.has(id)) { const el = element('row:' + id); el.dataset.id = id; rowStubs.set(id, el); }
          return rowStubs.get(id);
        });
      }
      return [];
    },
    createElement: () => element('created')
  };

  const window = {
    dispatchEvent(event) { events.push(event && event.type ? event.type : String(event)); },
    __pawsDashboardTiming: overrides.timing === true
  };

  const context = {
    window,
    document,
    location: { href: '', pathname: '/faculty-admin.html', replace(target) { redirects.push(target); } },
    firebase: firebaseStub,
    UCVM: {
      init() { ucvmInitCalls += 1; throw new Error('UCVM.init must not be called by the Dashboard'); },
      number: value => (value === null || value === undefined || value === '' ? null : Number(value)),
      role: value => String(value || ''),
      admin: profile => ADMIN_ROLES.includes(profile && profile.role),
      general: profile => ['owner', 'administrator', 'adfa_general', 'admin'].includes(profile && profile.role),
      label: value => String(value || ''),
      logs: () => {}
    },
    UCVMSessionGuard: { start() {} },
    UCVM_PAWS_DATA: pawsData,
    Event: class { constructor(type) { this.type = type; } },
    console: { error(...a) { errors.push(a.map(v => (v && v.stack) || String(v)).join(' ')); }, warn() {}, info() {}, log(...args) { logs.push(args.join(' ')); } },
    performance: { now: () => Date.now() },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Map, Set, Date, JSON, String, Number, Boolean, Array, Object, Math, Promise, RegExp, Error, TypeError, isNaN, parseInt, parseFloat
  };
  context.globalThis = context;

  vm.runInNewContext(read('faculty-admin-doe-renderer.js'), context, { filename: 'faculty-admin-doe-renderer.js' });
  vm.runInNewContext(ADMIN_SOURCE, context, { filename: 'faculty-admin.js' });
  assert.equal(typeof authCallback, 'function', 'faculty-admin.js must register an auth callback :: ' + errors.join(' | '));

  return {
    reads, calls, events, logs, redirects, byId,
    signOuts: () => signOuts,
    firestoreTouches: () => firestoreTouches,
    errors,
    ucvmInitCalls: () => ucvmInitCalls,
    signIn: async (user) => { await authCallback(user || { uid: 'u-1', email: 'admin@example.test' }); },
    rowIds: () => (byId('result-list').innerHTML.match(/data-id="[^"]*"/g) || []).map(s => s.replace(/^data-id="|"$/g, '')),
    // Simulates the user clicking a rendered roster row.
    clickRow: async id => {
      const stub = rowStubs.get(id);
      assert.ok(stub, `row ${id} must have been rendered`);
      assert.equal(typeof stub.onclick, 'function', `row ${id} must have a click handler`);
      stub.onclick();
      await flush();
    }
  };
}

async function driveAdmin(overrides) {
  const harness = createHarness(overrides);
  await harness.signIn();
  await flush();
  return harness;
}

// ===========================================================================
// 1–3, 6–9: admin startup uses the API, in parallel, with no Firestore reads
// ===========================================================================
test('admin startup issues exactly one summary and one roster request and no Firestore business read', async () => {
  const h = await driveAdmin();
  assert.equal(h.calls.filter(c => c === 'dashboardSummary').length, 1, 'one dashboardSummary()');
  assert.equal(h.calls.filter(c => c === 'dashboardFaculty').length, 1, 'one dashboardFaculty()');
  assert.deepEqual(h.calls.filter(c => c.startsWith('dashboardFacultyById')), [], 'no detail fanout');
  assert.deepEqual(h.reads, [], 'the core flow must not touch Firestore at all');
  assert.equal(h.firestoreTouches(), 0, 'firebase.firestore must never be touched');
  assert.equal(h.ucvmInitCalls(), 0, 'UCVM.init must never be called by the Dashboard');
});

test('admin startup begins summary and roster in parallel rather than serially', async () => {
  const started = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const h = createHarness({
    summary: async () => { started.push('summary'); await gate; return SUMMARY; },
    faculty: async () => { started.push('faculty'); await gate; return ROSTER; }
  });
  await h.signIn();
  await flush();
  assert.deepEqual(started.slice().sort(), ['faculty', 'summary'], 'both requests must be in flight before either resolves');
  release();
  await flush();
  assert.equal(h.byId('result-count').textContent, ROSTER.length);
});

test('admin startup never reads the legacy Firestore collections', async () => {
  const h = await driveAdmin();
  for (const name of ['settings', 'settings/faculty_index', 'settings/schedule_stats', 'settings/system_state', 'faculty', 'sessions']) {
    assert.ok(!h.reads.includes(name), `the core flow must not read ${name}`);
  }
  assert.ok(!h.reads.some(r => /faculty_change_log|session_change_log|change_requests|faculty_swap/.test(r)), 'no audit/history/swap read');
  assert.doesNotMatch(slice('function enterAdminMode', 'function dashboardAuthFailureMessage'), /subscribeFaculty\(|subscribeSessions\(/);
});

// ===========================================================================
// 10–13: KPIs come straight from the summary DTO
// ===========================================================================
test('KPI tiles render the summary DTO values verbatim', async () => {
  const h = await driveAdmin();
  const expected = {
    'kpi-total': '120', 'kpi-sessions': '1937', 'kpi-assignments': '4970', 'kpi-courses': '214',
    'kpi-roles': '162', 'kpi-hicc': '64', 'kpi-visc': '35', 'kpi-afc': '791', 'kpi-grid': '1902', 'kpi-check': '35'
  };
  for (const [id, value] of Object.entries(expected)) {
    assert.equal(h.byId(id).textContent, value, `${id} must render the DTO value`);
  }
});

test('HICC and VISC KPIs are DTO role counts, never a faculty headcount', async () => {
  const h = await driveAdmin();
  // Every roster row carries roleCount 0, so any client-side recalculation
  // would yield 0 instead of the authoritative role-assignment counts.
  assert.equal(h.byId('kpi-hicc').textContent, '64');
  assert.equal(h.byId('kpi-visc').textContent, '35');
  assert.equal(h.byId('kpi-roles').textContent, '162');
});

test('KPI labels describe HICC/VISC as roles and drop the retired Firestore metrics', () => {
  const html = read('faculty-admin.html');
  assert.match(html, /<div class="kpi-label">HICC roles<\/div>/);
  assert.match(html, /<div class="kpi-label">VISC roles<\/div>/);
  assert.doesNotMatch(html, /Source Summaries|Assigned DOE Records|Live Timetable Sessions/);
});

// ===========================================================================
// 14–16, 22: Lookup roster, filters and search scope
// ===========================================================================
test('Lookup renders the API roster and searches only the permitted fields', async () => {
  const h = await driveAdmin();
  assert.equal(h.byId('result-count').textContent, ROSTER.length);
  assert.match(h.byId('result-list').innerHTML, /Ada One/);
  assert.match(h.byId('result-list').innerHTML, /12 sessions · 0 roles · 0 AFC/);

  const blob = slice('function searchBlob', 'function filteredLookup');
  for (const allowed of ['displayName', 'preferredFirstName', 'preferredLastName', 'ucid', 'email', 'rank', 'stream', 'teachingArea', 'professionalCategory', 'reportsToName']) {
    assert.match(blob, new RegExp(allowed), `searchBlob must include ${allowed}`);
  }
  for (const forbidden of ['purpose', 'campus', 'topic', 'hrFullName', 'workloadPolicy', 'boardSpecialties', 'notes']) {
    assert.doesNotMatch(blob, new RegExp(forbidden), `searchBlob must not include ${forbidden}`);
  }
});

test('the campus filter is gone entirely because the roster DTO has no campus field', () => {
  assert.equal(read('faculty-admin.html').includes('filter-campus'), false, 'no campus filter may ship');
  assert.equal(ADMIN_SOURCE.includes('filter-campus'), false, 'no campus filter code may remain');
  assert.equal(ADMIN_SOURCE.includes('deactivateCampusFilter'), false);
  const lookup = slice('function filteredLookup', 'function installSelfModeStyles');
  assert.doesNotMatch(lookup, /campus/i);
  assert.match(lookup, /filter-rank/, 'the rank filter stays supported');
});

test('Lookup search cannot match AFC purpose, and the roster never exposes it', async () => {
  const h = await driveAdmin();
  assert.doesNotMatch(h.byId('result-list').innerHTML, new RegExp(AFC_PURPOSE));
  h.byId('lookup-search').value = AFC_PURPOSE.toLowerCase();
  h.byId('lookup-search').oninput();
  await new Promise(resolve => setTimeout(resolve, 260));
  assert.equal(h.byId('result-count').textContent, 0, 'searching an AFC purpose must not match the roster');
});

// ===========================================================================
// 17–25: lazy detail loading, caching, API detail rendering
// ===========================================================================
test('the initial admin load performs zero detail requests', async () => {
  const h = await driveAdmin();
  assert.deepEqual(h.calls.filter(c => c.startsWith('dashboardFacultyById')), []);
  assert.equal(h.byId('profile-pane').innerHTML, '<div class="empty">Select a faculty member to view their profile.</div>');
});

test('selecting one faculty issues exactly one detail request and renders the API detail', async () => {
  const h = await driveAdmin();
  assert.deepEqual(h.rowIds(), ['f-1', 'f-2', 'f-3']);
  await h.clickRow('f-2');
  assert.deepEqual(h.calls.filter(c => c.startsWith('dashboardFacultyById')), ['dashboardFacultyById:f-2'], 'exactly one detail request');

  const pane = h.byId('profile-pane').innerHTML;
  assert.match(pane, /Ada One/, 'faculty identity comes from the API detail');
  assert.match(pane, /Teaching-Focused/, 'professionalProfile renders');
  assert.match(pane, /Renewal pending/, 'jointAppointments render');
  assert.match(pane, /VETM 300/, 'roles render');
  assert.match(pane, /Board of Anatomy/, 'professional profile fields render');
  assert.match(pane, new RegExp(AFC_PURPOSE), 'AFC purpose renders in detail');
  assert.match(pane, /VETM 101/, 'teachingAssignments render');
  assert.deepEqual(h.reads, [], 'detail loading must not touch Firestore');
});

test('re-selecting a cached faculty member does not refetch', async () => {
  const h = await driveAdmin();
  await h.clickRow('f-2');
  await h.clickRow('f-2');
  await h.clickRow('f-2');
  assert.equal(h.calls.filter(c => c.startsWith('dashboardFacultyById')).length, 1, 'the detail cache must serve repeat selections');

  // A different faculty member is still fetched once, then cached.
  await h.clickRow('f-1');
  await h.clickRow('f-1');
  assert.deepEqual(h.calls.filter(c => c.startsWith('dashboardFacultyById')), ['dashboardFacultyById:f-2', 'dashboardFacultyById:f-1']);
});

test('the core flow never invokes the legacy Firestore loaders', () => {
  const bodies = [
    ['loadAdminDashboard', slice('async function loadAdminDashboard', 'function indexedFaculty')],
    ['selectFacultyDetail', slice('async function selectFacultyDetail', 'async function loadAdminDashboard')],
    ['renderLookup', slice('function renderLookup', 'function field(')],
    ['loadSelfFaculty', slice('async function loadSelfFaculty', 'async function enterSelfMode')],
    ['enterAdminMode', slice('function enterAdminMode', 'function dashboardAuthFailureMessage')]
  ];
  for (const [name, body] of bodies) {
    assert.doesNotMatch(body, /subscribeFaculty\(|subscribeSessions\(|loadFacultyDetail\(|listenFacultySessions\(|ensureFullFaculty\(|ensureFullSessions\(/, `${name} must not invoke legacy loaders`);
    assert.doesNotMatch(body, /db\.collection\(/, `${name} must not read Firestore`);
  }
});

test('AFC purpose appears only in the selected detail', () => {
  assert.match(slice('function renderApiDetail', 'function renderDetailPending'), /Purpose/, 'AFC purpose is rendered in detail');
  assert.doesNotMatch(slice('function renderLookup', 'function pawsTimingEnabled'), /purpose/i, 'the roster must not expose AFC purpose');
  assert.doesNotMatch(read('faculty-admin.html'), /away purpose/);
  assert.doesNotMatch(slice('function updateKpis', 'function renderLookup'), /purpose/i, 'no global KPI exposes AFC purpose');
});

test('DOE values are displayed exactly as stored, with no client-side recomputation', async () => {
  const h = await driveAdmin();
  await h.clickRow('f-1');
  const pane = h.byId('profile-pane').innerHTML;
  // doeRate 0.5 * doeQuantity 2.5 = 1.25, but the authoritative stored credit is
  // 0.9, so the DOE unit/credit/status cells prove the stored value is displayed.
  assert.match(pane, /<td>percent<\/td><td>0\.90%<\/td><td>Confirmed<\/td>/, 'the stored DOE unit, credit and status render verbatim');
  assert.doesNotMatch(pane, /<td>percent<\/td><td>1\.25%<\/td>/, 'the DOE credit must not be recomputed from rate x quantity');

  const detail = `${ADMIN_SOURCE}\n${read('faculty-admin-doe-renderer.js')}`;
  for (const field of ['doeRate', 'doeQuantity', 'doeUnit', 'doeCredit', 'doeStatus', 'doeMappedValue', 'doeOverrideValue']) {
    assert.match(detail, new RegExp(field), `DOE field ${field} must be rendered`);
  }
  assert.doesNotMatch(detail, /doeRate\s*\*|\*\s*doeQuantity|doeCredit\s*=/, 'DOE must not be recomputed');
  assert.doesNotMatch(slice('function rosterRecord', 'async function loadAdminDashboard'), /doe[A-Z(]|doeRate|doeCredit|doeOverride/, 'the roster adapter must not invent DOE values');
});

// ===========================================================================
// 26–30: self-service cutover
// ===========================================================================
test('self-service resolves its own roster row and detail from the API only', async () => {
  const h = createHarness({ currentUser: () => SELF_PROFILE });
  await h.signIn();
  await flush();
  assert.ok(h.calls.includes('dashboardFaculty'), 'self-service must call dashboardFaculty()');
  assert.ok(h.calls.includes('dashboardFacultyById:f-2'), 'self-service must load its own facultyId');
  assert.ok(!h.calls.includes('dashboardSummary'), 'self-service must not call dashboardSummary()');
  assert.deepEqual(h.reads, [], 'self-service must not read Firestore');
  assert.deepEqual(h.calls.filter(c => c.startsWith('dashboardFacultyById')), ['dashboardFacultyById:f-2'], 'only its own record');
  assert.match(h.byId('profile-pane').innerHTML, /Teaching-Focused/, 'own detail renders from the API');
});

test('self-service does not resolve identity by email or read the Firestore faculty document', () => {
  const self = slice('async function loadSelfFaculty', 'async function enterSelfMode');
  assert.doesNotMatch(self, /email/i, 'no email-based identity lookup');
  assert.doesNotMatch(self, /db\.collection\(|linkFacultyIdentity\(|listenFacultySessions\(/);
  assert.match(self, /dashboardFaculty\(\)/);
  assert.match(self, /dashboardFacultyById\(facultyId\)/);
  assert.match(self, /String\(r\.facultyId\)\.toLowerCase\(\)===String\(facultyId\)\.toLowerCase\(\)/);
});

// ===========================================================================
// 31–33: failure behaviour
// ===========================================================================
test('a 503 or network failure keeps the sign-in, shows a truthful state, and never falls back to Firestore', async () => {
  const failure = Object.assign(new Error('The SQL read service is unavailable.'), { status: 503, code: 'SQL_UNAVAILABLE' });
  const h = await driveAdmin({ summary: async () => { throw failure; } });
  assert.deepEqual(h.reads, [], 'no Firestore fallback');
  assert.equal(h.signOuts(), 0, 'a transient error must not sign the user out');
  assert.deepEqual(h.redirects, [], 'a transient error must not redirect');
  assert.match(h.byId('sync-status').textContent, /temporarily unavailable/i);
  assert.equal(h.byId('kpi-total').textContent, '—');
  assert.match(h.byId('result-list').innerHTML, /temporarily unavailable/i);
});

test('a 401 during the admin load reports a session problem without signing out', async () => {
  const failure = Object.assign(new Error('Authentication required.'), { status: 401, code: 'UNAUTHENTICATED' });
  const h = await driveAdmin({ faculty: async () => { throw failure; } });
  assert.equal(h.signOuts(), 0);
  assert.deepEqual(h.reads, []);
  assert.match(h.byId('sync-status').textContent, /session could not be verified/i);
});

test('a 403 during the admin load denies access, preserves the session and reads nothing', async () => {
  const failure = Object.assign(new Error('Role denied by SQL profile'), { status: 403, code: 'ROLE_DENIED' });
  const h = await driveAdmin({ summary: async () => { throw failure; } });
  assert.equal(h.signOuts(), 0);
  assert.deepEqual(h.reads, []);
  assert.match(h.byId('sync-status').textContent, /Role denied by SQL profile/);
});

test('a detail 404 preserves the roster and reports not found', async () => {
  const notFound = Object.assign(new Error('Faculty record not found.'), { status: 404, code: 'FACULTY_NOT_FOUND' });
  const h = await driveAdmin({ facultyById: async () => { throw notFound; } });
  await h.clickRow('f-2');
  const roster = h.byId('result-list').innerHTML;
  assert.match(roster, /Ada One/);
  assert.match(roster, /Bo Two/);
  assert.match(roster, /Cy Three/);
  assert.equal(h.byId('result-count').textContent, ROSTER.length, 'the roster must survive a failed detail load');
  assert.deepEqual(h.rowIds(), ['f-1', 'f-2', 'f-3']);
  assert.match(h.byId('profile-pane').innerHTML, /not found/i);
  assert.deepEqual(h.reads, []);
});

test('a detail 503 shows an unavailable message without a Firestore fallback', async () => {
  const failure = Object.assign(new Error('The SQL read service is unavailable.'), { status: 503, code: 'SQL_UNAVAILABLE' });
  const h = await driveAdmin({ facultyById: async () => { throw failure; } });
  await h.clickRow('f-2');
  assert.match(h.byId('profile-pane').innerHTML, /temporarily unavailable/i);
  assert.equal(h.byId('result-count').textContent, ROSTER.length, 'roster preserved');
  assert.equal(h.signOuts(), 0);
  assert.deepEqual(h.reads, []);

  const src = slice('function detailFailureMessage', 'function setDashboardLoading');
  assert.match(src, /404|FACULTY_NOT_FOUND/);
  assert.match(src, /401|UNAUTHENTICATED/);
  assert.match(src, /503|SQL_UNAVAILABLE/);
  assert.doesNotMatch(src, /signOut|collection\(/i);
});

// ===========================================================================
// 34: performance timing hooks
// ===========================================================================
test('timing hooks are opt-in and do not change business behaviour', async () => {
  const quiet = await driveAdmin();
  assert.deepEqual(quiet.logs.filter(l => l.includes('[PAWS dashboard timing]')), [], 'no timing noise by default');

  const timed = await driveAdmin({ timing: true });
  const lines = timed.logs.filter(l => l.includes('[PAWS dashboard timing]'));
  assert.ok(lines.some(l => /\[PAWS dashboard timing\] me=/.test(l)), 'me timing boundary');
  assert.ok(lines.some(l => /\[PAWS dashboard timing\] summary\+faculty=/.test(l)), 'combined admin load boundary');

  assert.deepEqual(timed.calls, quiet.calls, 'timing must not alter API calls');
  assert.deepEqual(timed.reads, quiet.reads, 'timing must not add Firestore reads');
  assert.equal(timed.byId('kpi-hicc').textContent, quiet.byId('kpi-hicc').textContent);

  await timed.clickRow('f-2');
  assert.ok(timed.logs.some(l => /\[PAWS dashboard timing\] detail=/.test(l)), 'detail timing boundary');
  assert.deepEqual(timed.calls, quiet.calls.concat(['dashboardFacultyById:f-2']), 'detail timing must not change behaviour');
});

test('timing instrumentation introduces no external telemetry and no persistence', () => {
  const src = slice('function pawsTimingEnabled', 'function detailFailureMessage');
  assert.match(src, /performance\.now\(\)/);
  assert.match(src, /console\.log/);
  assert.doesNotMatch(src, /fetch\(|sendBeacon|localStorage|sessionStorage|indexedDB|XMLHttpRequest/);
});

// ===========================================================================
// Boundary safety
// ===========================================================================
test('the cutover keeps paws-data-client.js and the server untouched', () => {
  const client = read('paws-data-client.js');
  assert.match(client, /dashboardSummary/);
  assert.match(client, /dashboardFacultyById/);
  assert.doesNotMatch(client, /firestore/i);
  assert.doesNotMatch(ADMIN_SOURCE, /api\/v1\/dashboard\/bootstrap/, 'no bootstrap endpoint');
  assert.doesNotMatch(ADMIN_SOURCE, /fetch\(\s*['"]https/, 'no direct fetch calls in the page controller');
});

test('the Dashboard page keeps the SQL data client load order', () => {
  const html = read('faculty-admin.html');
  const client = html.indexOf('<script src="paws-data-client.js"></script>');
  const admin = html.indexOf('<script src="faculty-admin.js"></script>');
  assert.ok(client >= 0 && admin > client, 'paws-data-client.js must load before faculty-admin.js');
});
