'use strict';
// UX-07 UI: ADFA office "Edit dates" on AFC Records and approved requests;
// faculty "Change dates" (new approval) on their own approved request; pending
// requests are withdrawn instead of edited.
const test = require('node:test');
const assert = require('node:assert/strict');
const records = require('../frontend/scripts/faculty-admin-afc-records.js');
const { createSqlAfcWorkflow, requestActions } = require('../frontend/scripts/afc-workflow-sql.js');

const KEY = 'manual:11111111-1111-4111-8111-111111111111';
const row = { afcRecordId: '11111111-1111-4111-8111-111111111111', facultyId: '22222222-2222-4222-8222-222222222222', facultyName: 'One, Ada', startDate: '2026-11-02', endDate: '2026-11-03', sourceKind: 'manual', active: true, versionToken: '00000000000000AB' };
const name = r => r.facultyName;

test('AFC Records shows Edit dates only for the office edit capability and active rows', () => {
  assert.match(records.renderRows([row], { facultyName: name, canEdit: true }), /data-afc-edit="manual:/);
  assert.doesNotMatch(records.renderRows([row], { facultyName: name, canEdit: false }), /data-afc-edit=/);
  assert.doesNotMatch(records.renderRows([{ ...row, active: false }], { facultyName: name, canEdit: true }), /data-afc-edit=/);
  const editing = records.renderRows([row], { facultyName: name, canEdit: true, editingKey: KEY });
  assert.match(editing, /data-afc-edit-start value="2026-11-02"/);
  assert.match(editing, /data-afc-edit-save="manual:/);
  assert.match(editing, /Was 2026-11-02 to 2026-11-03\. The change is recorded in Change History\./);
});

test('office save sends the exact version and reports old and new dates', async () => {
  const calls = [], notes = [];
  let records_ = [row];
  const actions = records.createActions({
    api: { updateDashboardAfcRecordDates: async (id, payload) => { calls.push({ id, ...payload }); records_ = [{ ...row, ...payload, versionToken: '00000000000000AC' }]; } },
    facultyName: name, canCancel: () => true, canEdit: () => true, getRecords: () => records_,
    render() {}, refresh: async () => {}, refreshRecords: async () => {}, notify: (m, e) => notes.push([m, !!e]), confirm: () => true
  });
  actions.startEdit(KEY);
  assert.equal(actions.editingKey(), KEY);
  assert.equal(await actions.saveDates(KEY, '2026-11-09', '2026-11-03'), false);
  assert.equal(await actions.saveDates(KEY, '2026-11-02', '2026-11-03'), false);
  assert.equal(calls.length, 0);
  assert.equal(await actions.saveDates(KEY, '2026-11-09', '2026-11-10'), true);
  assert.deepEqual(calls[0], { id: row.afcRecordId, sourceKind: 'manual', expectedVersion: '00000000000000AB', startDate: '2026-11-09', endDate: '2026-11-10' });
  assert.equal(actions.editingKey(), '');
  assert.deepEqual(notes.at(-1), ['AFC dates changed from 2026-11-02 – 2026-11-03 to 2026-11-09 – 2026-11-10. The change is in Change History.', false]);
});

test('approved requests allow faculty change and office edit; pending requests do not', () => {
  const approved = { status: 'approved', requesterFirebaseUid: 'me' };
  assert.equal(requestActions(approved, { uid: 'me', role: 'faculty' }).canChangeDates, true);
  assert.equal(requestActions(approved, { uid: 'other', role: 'faculty' }).canChangeDates, false);
  assert.equal(requestActions(approved, { uid: 'admin', role: 'administrator' }).canOfficeChangeDates, true);
  assert.equal(requestActions({ ...approved, supersededByAfcRequestId: 'x' }, { uid: 'me', role: 'faculty' }).canChangeDates, false);
  for (const status of ['pending_report_to', 'pending_admin', 'rejected', 'withdrawn', 'superseded']) {
    const a = requestActions({ status, requesterFirebaseUid: 'me' }, { uid: 'me', role: 'faculty' });
    assert.equal(a.canChangeDates, false, status);
    assert.equal(requestActions({ status }, { uid: 'admin', role: 'administrator' }).canOfficeChangeDates, false, status);
  }
});

function panelFor({ role = 'faculty', uid = 'me', list, caps = { requestLifecycle: true, decisions: true, approvedArtifactCreation: true, dateChange: true } }) {
  const nodes = new Map();
  const panel = { innerHTML: '', querySelectorAll: () => [] };
  const doc = { getElementById: id => id === 'afc-panel' ? panel : nodes.get(id) || null, createElement: () => ({}) };
  const calls = [];
  const dataClient = {
    listAfcRequests: async () => list,
    afcWriteCapabilities: async () => caps,
    submitAfcDateChange: async (id, payload) => { calls.push(['change', id, payload]); return { afcRequestId: 'new' }; },
    changeApprovedAfcDates: async (id, payload) => { calls.push(['office', id, payload]); return { afcRequestId: id }; }
  };
  const workflow = createSqlAfcWorkflow({ root: {}, document: doc, dataClient, auth: { currentUser: { uid } }, profile: () => ({ role, displayName: 'Ada One' }), roleResolver: value => value });
  return { workflow, panel, calls };
}

test('faculty see Change dates on approved, a withdraw hint on pending, and status for replaced dates', async () => {
  const list = [
    { afcRequestId: 'a1', status: 'approved', requesterFirebaseUid: 'me', facultyName: 'One, Ada', startDate: '2026-11-02', endDate: '2026-11-03', reason: 'vacation', versionToken: '00000000000000AB' },
    { afcRequestId: 'p1', status: 'pending_admin', requesterFirebaseUid: 'me', facultyName: 'One, Ada', startDate: '2026-12-01', endDate: '2026-12-02', reason: 'vacation' },
    { afcRequestId: 's1', status: 'superseded', supersededByAfcRequestId: 'a1', requesterFirebaseUid: 'me', facultyName: 'One, Ada', startDate: '2026-10-01', endDate: '2026-10-02', reason: 'vacation' }
  ];
  const { workflow, panel } = panelFor({ list });
  await workflow.load(true);
  assert.match(panel.innerHTML, /data-afc-change-dates="a1"/);
  assert.doesNotMatch(panel.innerHTML, /data-afc-change-dates="p1"|data-afc-change-dates="s1"/);
  assert.match(panel.innerHTML, /To change the dates of a pending request, withdraw it and submit a new request\./);
  assert.match(panel.innerHTML, /Replaced by new dates/);
  workflow.startDateChange('a1');
  assert.match(panel.innerHTML, /Changing the dates of your approved request \(2026-11-02 – 2026-11-03\)/);
  assert.match(panel.innerHTML, /your current approved dates stay in effect until the new dates are approved/);
  assert.match(panel.innerHTML, /Submit date change for approval/);
});

test('an open date change hides Change dates and explains the old dates stay in effect', async () => {
  const list = [
    { afcRequestId: 'a1', status: 'approved', requesterFirebaseUid: 'me', facultyName: 'One, Ada', startDate: '2026-11-02', endDate: '2026-11-03', reason: 'vacation', versionToken: '00000000000000AB' },
    { afcRequestId: 'c1', status: 'pending_admin', replacesAfcRequestId: 'a1', requesterFirebaseUid: 'me', facultyName: 'One, Ada', startDate: '2026-11-09', endDate: '2026-11-10', reason: 'vacation' }
  ];
  const { workflow, panel } = panelFor({ list });
  await workflow.load(true);
  assert.doesNotMatch(panel.innerHTML, /data-afc-change-dates="a1"/);
  assert.match(panel.innerHTML, /A date change to 2026-11-09 – 2026-11-10 is waiting for approval\. These dates stay in effect until it is approved\./);
  assert.match(panel.innerHTML, /Date change for an earlier approved request/);
  await assert.rejects(workflow.changeDates('a1', { startDate: '2026-11-16', endDate: '2026-11-17' }), /already waiting for approval/);
});

test('faculty date change and office edit call the matching API with the exact version', async () => {
  const approved = { afcRequestId: 'a1', status: 'approved', requesterFirebaseUid: 'me', facultyName: 'One, Ada', startDate: '2026-11-02', endDate: '2026-11-03', reason: 'vacation', versionToken: '00000000000000AB' };
  const faculty = panelFor({ list: [approved] });
  await faculty.workflow.load(true);
  await assert.rejects(faculty.workflow.changeDates('a1', { startDate: '2026-11-02', endDate: '2026-11-03' }), /same as the approved dates/);
  await faculty.workflow.changeDates('a1', { startDate: '2026-11-09', endDate: '2026-11-10' });
  assert.deepEqual(faculty.calls[0].slice(0, 2), ['change', 'a1']);
  const office = panelFor({ role: 'administrator', uid: 'admin', list: [approved] });
  await office.workflow.load(true);
  assert.match(office.panel.innerHTML, /data-afc-office-dates="a1"/);
  await office.workflow.officeChangeDates('a1', '2026-11-16', '2026-11-20');
  assert.deepEqual(office.calls[0], ['office', 'a1', { expectedVersion: '00000000000000AB', startDate: '2026-11-16', endDate: '2026-11-20' }]);
  const off = panelFor({ role: 'administrator', uid: 'admin', list: [approved], caps: { requestLifecycle: true, decisions: true, approvedArtifactCreation: true, dateChange: false } });
  await off.workflow.load(true);
  assert.doesNotMatch(off.panel.innerHTML, /data-afc-office-dates/);
});
