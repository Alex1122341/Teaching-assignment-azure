'use strict';
// Teaching Schedule HICC–CC / VISC directory: page wiring, rendering rules and parity with the
// Faculty Dashboard effective-period rules (faculty-role-periods.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const lib = require('../leadership-directory');
const { classify } = require('../server/src/roles/role-effective-status');

test('Course List is replaced by exactly two buttons under the Teaching Schedule heading', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /course-list-btn"\s*>Course List|id="course-list-btn"|>Course List</);
  const block = /<div class="brand-block">([\s\S]*?)<\/div>\s*<\/div>|<div class="brand-block">([\s\S]*?<\/div>)/.exec(html)[0];
  assert.match(block, /Teaching Schedule<\/span>\s*<div class="leadership-list-actions"/);
  const buttons = [...block.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map(m => m[1]);
  assert.deepEqual(buttons, ['HICC–CC List', 'VISC List']);
  assert.match(block, /class="course-list-btn hidden" type="button" id="hicc-cc-list-btn"/, 'existing UCalgary red button treatment');
  assert.match(block, /class="course-list-btn hidden" type="button" id="visc-list-btn"/);
  assert.match(html, /<link rel="stylesheet" href="leadership-directory\.css">/);
  assert.ok(html.indexOf('leadership-directory.js') < html.indexOf('<script src="timetable.js">'), 'module loads before timetable.js');
});

test('the dialog is accessible: labelled modal, live status, close button, Show inactive / upcoming, Refresh', () => {
  const html = read('index.html');
  const overlay = /<section class="leadership-directory-overlay"[\s\S]*?<\/section>/.exec(html)[0];
  assert.match(overlay, /role="dialog" aria-modal="true" aria-labelledby="leadership-directory-heading" aria-describedby="leadership-directory-subtitle"/);
  assert.match(overlay, /aria-hidden="true" hidden/);
  assert.match(overlay, /id="leadership-directory-close" aria-label="Close list"/);
  assert.match(overlay, /role="status" aria-live="polite"/);
  assert.match(overlay, /Show inactive \/ upcoming/);
  assert.match(overlay, /id="leadership-directory-refresh">Refresh/);
  const source = read('leadership-directory.js');
  assert.match(source, /event\.key==='Escape'/);
  assert.match(source, /event\.key!=='Tab'/);
  assert.match(source, /previousFocus\?\.isConnected\)previousFocus\.focus\(\)/, 'focus restored on close');
  assert.match(source, /closeButton\.focus\(\);load\(\);/, 'fresh data on every open');
});

test('timetable.js opens the right list for the schedule academic year, only for signed-in users, and closes on sign-out', () => {
  const source = read('timetable.js');
  assert.doesNotMatch(source, /openCourseList|course-list-btn/);
  assert.match(source, /\$\('hicc-cc-list-btn'\)\.addEventListener\('click', \(\) => \{ if\(currentUser\) window\.PAWS_LEADERSHIP_DIRECTORY\?\.open\('hicc-cc', window\.UCVM_PAGE_DATA\.academicYear\(\) \|\| sqlAcademicYearForDate\(ymd\(new Date\(\)\)\)\); \}\);/);
  assert.match(source, /\$\('visc-list-btn'\)\.addEventListener\('click', \(\) => \{ if\(currentUser\) window\.PAWS_LEADERSHIP_DIRECTORY\?\.open\('visc', /);
  assert.match(source, /\$\('hicc-cc-list-btn'\)\.classList\.toggle\('hidden', !currentUser\);/);
  assert.match(source, /\$\('visc-list-btn'\)\.classList\.toggle\('hidden', !currentUser\);/);
  assert.match(source, /window\.PAWS_CCC_SCHEDULE\?\.close\(\);\s*window\.PAWS_LEADERSHIP_DIRECTORY\?\.close\(\);/);
  // Timetable navigation and filters are untouched: the resolver the page already exposes is reused.
  assert.match(source, /academicYear:\(\)=>viewMode==='list'\?listAcademicYear:sqlAcademicYearForDate\(ymd\(weekStart\(selectedWeek,selectedSemester\)\)\)/);
});

test('client calls only the read-only directory route; the module never touches DOE, Firestore or admin data', () => {
  assert.match(read('paws-data-client.js'), /leadershipDirectory\(academicYear\)\{return request\('\/api\/v1\/dashboard\/leadership-directory\?academicYear='\+encodeURIComponent\(String\(academicYear\)\)\);\}/);
  const source = read('leadership-directory.js');
  assert.doesNotMatch(source, /doe|firestore|\.collection\(|dashboardRoles|innerHTML=[^;]*row\.(?!status)/i);
  assert.ok(require('../tools/static-assets.json').includes('leadership-directory.js'));
  assert.ok(require('../tools/static-assets.json').includes('leadership-directory.css'));
});

test('status lines: Active with current end, open-ended, Inactive, gap, Upcoming, Dates needed', () => {
  const t = lib.statusText;
  assert.equal(t({ status: 'active', endDate: '2027-06-30' }), 'Active · Ends 2027-06-30');
  assert.equal(t({ status: 'active', endDate: null }), 'Active · No end date');
  assert.equal(t({ status: 'inactive', endDate: '2026-10-01' }), 'Inactive · Ended 2026-10-01');
  assert.equal(t({ status: 'inactive', endDate: '2026-09-30', nextStartDate: '2027-01-05' }), 'Inactive · Ended 2026-09-30 · Resumes 2027-01-05');
  assert.equal(t({ status: 'inactive', endDate: null }), 'Inactive · No effective period recorded');
  assert.equal(t({ status: 'upcoming', startDate: '2027-01-05', endDate: '2027-06-30' }), 'Upcoming · Starts 2027-01-05 · Ends 2027-06-30');
  assert.equal(t({ status: 'upcoming', startDate: '2027-07-01', endDate: null }), 'Upcoming · Starts 2027-07-01 · No end date');
  assert.equal(t({ status: 'dates-needed', endDate: null }), 'Dates needed · End date not recorded');
  assert.equal(t({ status: 'dates-needed', endDate: '2027-06-30' }), 'Dates needed · Start date not recorded · Ends 2027-06-30');
});

const sample = () => ({
  academicYear: '2026-27', asOfDate: '2026-10-22',
  hiccCc: [
    { roleType: 'HICC', scope: 'VTMD 300', facultyName: 'Avery <Testwell>', status: 'active', startDate: '2026-07-01', endDate: '2027-06-30' },
    { roleType: 'Course Coordinator', scope: 'VTMD 300', facultyName: 'Casey Mockford', status: 'dates-needed', startDate: null, endDate: null },
    { roleType: 'HICC', scope: null, facultyName: 'Devon Fakeley', status: 'inactive', startDate: null, endDate: '2026-10-01' },
    { roleType: 'Course Coordinator', scope: 'VTMD 401', facultyName: 'Emerson Dummer', status: 'upcoming', startDate: '2027-01-05', endDate: null }
  ],
  visc: [{ roleType: 'VISC', scope: 'Anatomy', facultyName: 'Blair Sampleton', status: 'active', startDate: '2026-07-01', endDate: null }]
});

test('default view shows Active and Dates needed; the toggle adds Inactive and Upcoming; counts say so', () => {
  const rows = sample().hiccCc;
  assert.deepEqual(lib.visibleRows(rows, false).map(r => r.status), ['active', 'dates-needed']);
  assert.equal(lib.visibleRows(rows, true).length, 4);
  assert.equal(lib.countText(2, 4, false), '2 of 4 appointments · Active and Dates needed shown');
  assert.equal(lib.countText(1, 1, true), '1 of 1 appointment');
});

test('two-column table: role distinguished (HICC vs CC), scope or Not recorded, name, status text; escaped', () => {
  const html = lib.renderTable('hicc-cc', sample().hiccCc);
  assert.equal((html.match(/<th scope="col">/g) || []).length, 2);
  assert.match(html, /<th scope="col">Course \/ Subject<\/th><th scope="col">Faculty<\/th>/);
  assert.equal((html.match(/<tr><td>/g) || []).length, 4);
  for (const tr of html.match(/<tr><td>[\s\S]*?<\/tr>/g)) assert.equal((tr.match(/<td>/g) || []).length, 2);
  assert.match(html, /leadership-role-hicc">HICC<\/span> · <span class="leadership-scope">VTMD 300/);
  assert.match(html, /leadership-role-cc">CC<\/span> · <span class="leadership-scope">VTMD 300/);
  assert.match(html, /<span class="leadership-missing">Not recorded<\/span>/);
  assert.match(html, /Avery &lt;Testwell&gt;/);
  assert.doesNotMatch(html, /<Testwell>/);
  assert.match(html, /leadership-status-dates-needed">Dates needed · End date not recorded/);
  const visc = lib.renderTable('visc', sample().visc);
  assert.match(visc, /<th scope="col">Subject<\/th><th scope="col">Faculty<\/th>/);
  assert.match(visc, /VISC<\/span> · <span class="leadership-scope">Anatomy/);
  assert.equal(lib.renderTable('visc', []), '<p class="leadership-directory-empty">No VISC appointments are recorded for this academic year.</p>');
  assert.match(lib.renderTable('visc', [], 2), /No Active or Dates needed appointments\. 2 inactive or upcoming records are hidden/);
});

test('responses are validated: wrong year, foreign role types, bad dates or statuses are rejected', () => {
  assert.equal(lib.validateResponse(sample(), '2026-27').hiccCc.length, 4);
  const bad = [
    { ...sample(), academicYear: '2027-28' },
    { ...sample(), asOfDate: '2026-13-01' },
    { ...sample(), visc: [{ ...sample().visc[0], roleType: 'HICC' }] },
    { ...sample(), hiccCc: [{ ...sample().hiccCc[0], roleType: 'VISC' }] },
    { ...sample(), hiccCc: [{ ...sample().hiccCc[0], status: 'maybe' }] },
    { ...sample(), hiccCc: [{ ...sample().hiccCc[0], endDate: '2027-02-30' }] },
    { ...sample(), hiccCc: [{ ...sample().hiccCc[0], facultyName: '' }] },
    null
  ];
  for (const value of bad) assert.throws(() => lib.validateResponse(value, '2026-27'));
});

test('academic year: valid YYYY-YY only; Calgary fallback starts on May 1', () => {
  assert.equal(lib.validYear('2026-27'), true);
  assert.equal(lib.validYear('2026-2027'), false);
  assert.equal(lib.validYear('2026-28'), false);
  assert.equal(lib.calgaryAcademicYear(new Date('2026-05-01T06:00:00Z')), '2026-27');
  assert.equal(lib.calgaryAcademicYear(new Date('2026-05-01T05:59:00Z')), '2025-26', 'still April 30 in Calgary');
  assert.equal(lib.calgaryAcademicYear(new Date('2027-01-15T12:00:00Z')), '2026-27');
});

test('server status rules match the Faculty Dashboard rules in faculty-role-periods.js', () => {
  const context = { window: {}, document: undefined, Intl, Date };
  vm.createContext(context);
  vm.runInContext(read('faculty-role-periods.js'), context);
  const dashboard = context.window.PAWS_ROLE_PERIODS;
  const expectFrom = label => label === 'Active' ? 'active' : label === 'Dates needed' ? 'dates-needed' : label === 'Inactive · not started' ? 'upcoming' : 'inactive';
  const asOf = '2026-10-22';
  const cases = [
    [{ effectiveDate: null, expirationDate: null }],
    [{ effectiveDate: '2026-07-01', expirationDate: null }],
    [{ effectiveDate: '2026-07-01', expirationDate: '2026-10-22' }],
    [{ effectiveDate: '2026-07-01', expirationDate: '2026-10-21' }],
    [{ effectiveDate: '2026-10-23', expirationDate: '2027-06-30' }],
    [{ effectiveDate: null, expirationDate: '2027-06-30' }],
    [{ effectiveDate: null, expirationDate: '2026-06-30' }],
    [null, []],
    [null, [{ startDate: '2026-07-01', endDate: '2026-09-30' }, { startDate: '2027-01-01', endDate: null }]],
    [null, [{ startDate: '2025-07-01', endDate: '2026-06-30' }]],
    [null, [{ startDate: '2027-01-01', endDate: '2027-06-30' }, { startDate: '2027-07-01', endDate: null }]],
    [null, [{ startDate: '2026-07-01', endDate: '2026-12-31' }, { startDate: '2027-01-15', endDate: '2027-06-30' }]],
    [{ effectiveDate: '2020-01-01', expirationDate: '2030-01-01' }, [{ startDate: '2025-01-01', endDate: '2025-12-31' }]]
  ];
  for (const [legacyDates, periods] of cases) {
    const dashboardRow = { ...(legacyDates || {}), ...(periods ? { validityPeriods: periods } : {}) };
    const serverRow = { hasSchedule: Boolean(periods), periodsJson: periods ? JSON.stringify(periods) : null, ...(legacyDates || {}) };
    assert.equal(classify(serverRow, asOf).status, expectFrom(dashboard.status(dashboardRow, asOf).label), JSON.stringify(dashboardRow));
  }
});
