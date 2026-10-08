'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const batch = require('../faculty-admin-afc-batch');
const id = '11111111-1111-4111-8111-111111111111';
function dashboard(client = {}) {
  const nodes = new Map();
  const document = { getElementById(key) { if (!nodes.has(key)) nodes.set(key, { value: '', innerHTML: '', textContent: '', addEventListener() {}, classList: { toggle() {}, add() {}, remove() {} } }); return nodes.get(key); }, querySelectorAll() { return []; } };
  const source = fs.readFileSync('faculty-admin.js', 'utf8').replace(/  init\(\);\s*\}\)\(\);\s*$/, `  globalThis.fixture = { populateAfcFacultyOptions, renderAfcRecords, afcFacultyLabel, resolveAfcFaculty, submitAfcRecord, validateAfcForm, setFaculty(rows) { faculty = rows; activeFaculty = rows; }, setRecords(rows) { afcRecords = rows; } };\n})();`);
  const context = { window: { UCVM_AFC_BATCH: batch }, UCVM_AFC_BATCH: batch, UCVM_PAWS_DATA: client, document, performance: { now: () => 0 }, console };
  for (const file of ['faculty-admin-doe-renderer.js', 'faculty-admin-management.js', 'faculty-admin-doe-worksheet.js']) vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
  vm.runInNewContext(source, context);
  return { ...context.fixture, nodes, document };
}
const visible = html => html.replace(/<[^>]*>/g, '');
test('AFC selector and records keep IDs in attributes while visible text contains names only', () => {
  const ui = dashboard();
  ui.setFaculty([{ facultyId: id, displayName: 'Example Faculty', active: true }]);
  ui.populateAfcFacultyOptions();
  const options = ui.nodes.get('afc-faculty').innerHTML;
  assert.match(options, new RegExp(id));
  assert.doesNotMatch(visible(options), new RegExp(id));
  ui.setRecords([{ facultyId: id, facultyName: 'Example Faculty' }]);
  ui.renderAfcRecords();
  assert.match(ui.nodes.get('afc-records-body').innerHTML, /data-afc-person=/);
  assert.doesNotMatch(visible(ui.nodes.get('afc-records-body').innerHTML), new RegExp(id));
  assert.equal(ui.afcFacultyLabel({ facultyId: id, displayName: 'Example Faculty' }), 'Example Faculty');
});
test('AFC missing names never fall back to technical identity and ambiguous names do not bind', () => {
  const ui = dashboard();
  assert.doesNotMatch(ui.afcFacultyLabel({ facultyId: id }), new RegExp(id));
  ui.setFaculty([{ facultyId: id, displayName: 'Same Name' }, { facultyId: 'second-id', displayName: 'Same Name' }]);
  assert.equal(ui.resolveAfcFaculty('Same Name'), null);
});
test('AFC single form rejects impossible Gregorian calendar dates', () => {
  const ui = dashboard();
  assert.ok(ui.validateAfcForm({ facultyId: id, startDate: '2027-02-30', endDate: '2027-03-01', reasonCode: 'vacation', notes: '' }));
});
test('AFC single form does not claim success for an empty accepted response', async () => {
  const ui = dashboard({ createDashboardAfcRecord: async () => ({}) });
  for (const [key, value] of Object.entries({ 'afc-faculty': id, 'afc-start-date': '2027-02-01', 'afc-end-date': '2027-02-02', 'afc-reason': 'vacation', 'afc-notes': '' })) ui.document.getElementById(key).value = value;
  await ui.submitAfcRecord();
  assert.doesNotMatch(ui.nodes.get('afc-form-status').textContent, /record created/i);
  assert.equal(ui.nodes.get('afc-submit').disabled, true, 'uncertain write requires readback before retry');
});
test('AFC closed write gate is a definite rejection and does not create an uncertain lock', async () => {
  let calls = 0;
  const ui = dashboard({ createDashboardAfcRecord: async () => { calls++; throw Object.assign(new Error('Writing is disabled.'), { status: 503, code: 'WRITE_DISABLED' }); } });
  for (const [key, value] of Object.entries({ 'afc-faculty': id, 'afc-start-date': '2027-02-01', 'afc-end-date': '2027-02-02', 'afc-reason': 'vacation' })) ui.document.getElementById(key).value = value;
  await ui.submitAfcRecord();
  assert.equal(calls, 1);
  assert.equal(ui.nodes.get('afc-submit').disabled, false);
  assert.match(ui.nodes.get('afc-form-status').textContent, /disabled/);
});
test('AFC ambiguous SQL failure never replays a non-idempotent single create', async () => {
  let calls = 0;
  const ui = dashboard({ createDashboardAfcRecord: async () => { calls++; throw Object.assign(new Error('SQL unavailable'), { status: 503, code: 'SQL_UNAVAILABLE' }); } });
  for (const [key, value] of Object.entries({ 'afc-faculty': id, 'afc-start-date': '2027-02-01', 'afc-end-date': '2027-02-02', 'afc-reason': 'vacation' })) ui.document.getElementById(key).value = value;
  await ui.submitAfcRecord();
  await ui.submitAfcRecord();
  assert.equal(calls, 1);
  assert.equal(ui.nodes.get('afc-submit').disabled, true);
});
for (const confirmed of [true, false]) test(`AFC accepted create requires matching list readback: ${confirmed}`, async () => {
  let posts = 0, reads = 0, resets = 0;
  const ui = dashboard({
    createDashboardAfcRecord: async () => { posts++; return { afcRecordId: 'record-1' }; },
    dashboardAfcRecords: async () => { reads++; return [{ afcRecordId: confirmed ? 'record-1' : 'other-record', facultyId: id, facultyName: 'Example Faculty' }]; },
    dashboardSummary: async () => ({}), dashboardFaculty: async () => []
  });
  for (const [key, value] of Object.entries({ 'afc-faculty': id, 'afc-start-date': '2027-02-01', 'afc-end-date': '2027-02-02', 'afc-reason': 'vacation' })) ui.document.getElementById(key).value = value;
  ui.document.getElementById('afc-record-form').reset = () => { resets++; };
  await ui.submitAfcRecord();
  assert.equal(posts, 1); assert.equal(reads, confirmed ? 1 : 2);
  assert.equal(resets, confirmed ? 1 : 0);
  assert.equal(ui.nodes.get('afc-submit').disabled, !confirmed);
  assert.equal(/created and confirmed/.test(ui.nodes.get('afc-form-status').textContent), confirmed);
});
for (const status of [404, 503]) test(`AFC readback retries GET only after transient ${status}`, async () => {
  let posts = 0, reads = 0;
  const ui = dashboard({
    createDashboardAfcRecord: async () => { posts++; return { afcRecordId: 'record-1' }; },
    dashboardAfcRecords: async () => { reads++; if (reads === 1) throw Object.assign(new Error('Read unavailable'), { status }); return [{ afcRecordId: 'record-1' }]; },
    dashboardSummary: async () => ({}), dashboardFaculty: async () => []
  });
  for (const [key, value] of Object.entries({ 'afc-faculty': id, 'afc-start-date': '2027-02-01', 'afc-end-date': '2027-02-02', 'afc-reason': 'vacation' })) ui.document.getElementById(key).value = value;
  await ui.submitAfcRecord();
  assert.equal(posts, 1); assert.equal(reads, 2);
  assert.match(ui.nodes.get('afc-form-status').textContent, /created and confirmed/);
});
