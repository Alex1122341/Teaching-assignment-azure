'use strict';
// UX-07: AFC date edit. ADFA office edits apply directly (history keeps old and
// new dates). Faculty change their own approved request through a new approval;
// the old dates stay approved until the change is approved. Pending requests
// are withdrawn instead of edited.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createDashboardApi } = require('../src/data/dashboard-api');
const { createDashboardFunctions } = require('../src/runtime/swa-dashboard-functions');
const { createAfcRequestApi } = require('../src/afc/afc-request-api');
const { createAfcRequestFunctions } = require('../src/runtime/swa-afc-request-functions');
const { createWriteGates } = require('../src/data/write-gates');
const { createSqlAfcWriteRepository } = require('../src/data/sql-afc-write-repository');
const { createSqlAfcRequestRepository, DATE_CHANGE_PROCEDURE, OFFICE_DATES_PROCEDURE } = require('../src/data/sql-afc-request-repository');
const { projectHistoryEvent } = require('../src/history/change-history-projection');

const root = path.resolve(__dirname, '..', '..');
const sql = name => fs.readFileSync(path.join(root, 'database', 'azure-sql', name), 'utf8');
const ID = '22222222-2222-4222-8222-222222222222';
const NEW_ID = '33333333-3333-4333-8333-333333333333';
const FACULTY = '11111111-1111-4111-8111-111111111111';
const VERSION = '00000000000000AB';

function dashboard({ role = 'administrator', gates = { afcEdit: true }, fail } = {}) {
  const calls = [];
  const api = createDashboardApi({
    verifyToken: async () => ({ uid: 'trusted-uid' }),
    findUser: async () => ({ active: true, baseRole: role, displayName: 'Trusted Admin', facultyId: FACULTY }),
    writeGates: gates, repository: {},
    writeRepository: { updateAfcDates: async input => { calls.push(input); if (fail) throw fail; return { afcRecordId: ID, facultyId: FACULTY, sourceKind: input.sourceKind, startDate: input.startDate, endDate: input.endDate, active: true, versionToken: '00000000000000AC' }; } }
  });
  const app = createDashboardFunctions({ api });
  const request = (body, method = 'POST', suffix = `${ID}/dates`) => app({ method, url: `https://local/api/v1/dashboard/afc-records/${suffix}`, headers: { get: () => 'Bearer token' }, json: async () => body });
  return { request, calls };
}
const officeBody = { sourceKind: 'manual', expectedVersion: VERSION, startDate: '2026-11-09', endDate: '2026-11-10' };

test('AFC edit has its own fail-closed gate', async () => {
  assert.equal(createWriteGates({}).afcEdit, false);
  assert.equal(createWriteGates({ PAWS_AFC_CANCEL_WRITE_ENABLED: 'true' }).afcEdit, false);
  assert.equal(createWriteGates({ PAWS_AFC_EDIT_WRITE_ENABLED: 'true' }).afcEdit, true);
  const h = dashboard({ gates: { afcCancel: true } });
  assert.equal((await h.request(officeBody)).jsonBody.error.code, 'WRITE_DISABLED');
  assert.equal(h.calls.length, 0);
});

test('only the ADFA office can change AFC record dates on the Dashboard', async () => {
  for (const role of ['faculty', 'hicc', 'visc', 'other_office']) {
    const h = dashboard({ role });
    assert.equal((await h.request(officeBody)).status, 403);
    assert.equal(h.calls.length, 0);
  }
});

test('office record edit validates source, version and dates before SQL', async () => {
  const h = dashboard();
  for (const input of [{}, { ...officeBody, sourceKind: 'request' }, { ...officeBody, expectedVersion: '' }, { ...officeBody, startDate: '2026-02-30' }, { ...officeBody, endDate: '2026-11-01' }]) {
    assert.equal((await h.request(input)).status, 400);
  }
  assert.equal((await h.request(officeBody, 'POST', 'bad/dates')).status, 400);
  assert.equal((await h.request(officeBody, 'GET')).status, 405);
  assert.equal(h.calls.length, 0);
});

test('office record edit uses server identity and returns the saved dates', async () => {
  const h = dashboard();
  const response = await h.request({ ...officeBody, actorFirebaseUid: 'spoof' });
  assert.equal(response.status, 200);
  assert.equal(response.jsonBody.afcRecord.startDate, '2026-11-09');
  assert.equal(response.jsonBody.afcRecord.endDate, '2026-11-10');
  assert.equal(h.calls[0].actorFirebaseUid, 'trusted-uid');
  assert.equal(h.calls[0].workDays, null);
  assert.match(h.calls[0].requestId, /^[0-9a-f-]{36}$/);
});

test('office record edit reports SQL outcomes without false success', async () => {
  for (const [number, status, code] of [[56404, 409, 'AFC_RECORD_CHANGED'], [56403, 404, 'AFC_RECORD_NOT_FOUND'], [56406, 409, 'AFC_RECORD_INACTIVE'], [56408, 409, 'AFC_DATES_UNCHANGED'], [999, 503, 'SQL_UNAVAILABLE']]) {
    const response = await dashboard({ fail: { number } }).request(officeBody);
    assert.equal(response.status, status); assert.equal(response.jsonBody.error.code, code);
  }
});

const signature = { mode: 'typed', name: 'Faculty Example', uid: 'uid-faculty', signedAt: '2026-10-04T07:00:00.000Z', attested: true, fingerprint: 'a'.repeat(64), imageDataUrl: '' };
const changePayload = () => ({ startDate: '2026-11-16', endDate: '2026-11-17', reason: 'vacation', purposeDestination: '', coverage: 'Covered', contactAddress: '2500 University Drive NW', contactPhone: '403-555-1212', termsAccepted: true, termsVersion: 'ucvm-afc-terms-page2-v1', termsSource: 'absence-from-campus-app.pdf#page=2', applicantSignature: signature });

function requests({ role = 'faculty', uid = 'uid-faculty', gates = { afcRequest: true, afcEdit: true }, fail } = {}) {
  const calls = [];
  const repository = {
    submitDateChange: async input => { calls.push(['change', input]); if (fail) throw fail; return { afcRequestId: input.afcRequestId, facultyId: FACULTY, facultyName: 'Faculty Example', requesterFirebaseUid: uid, status: 'pending_admin', startDate: input.startDate, endDate: input.endDate, workDays: input.workDays, reason: input.reason }; },
    updateApprovedRequestDates: async input => { calls.push(['office', input]); if (fail) throw fail; return { afcRecordId: input.afcRequestId, facultyId: FACULTY, startDate: input.startDate, endDate: input.endDate, workDays: input.workDays, versionToken: '00000000000000AC' }; }
  };
  const api = createAfcRequestApi({ verifyToken: async () => ({ uid }), findUser: async () => ({ active: true, mustChangePassword: false, baseRole: role, facultyId: role === 'administrator' ? null : FACULTY, displayName: 'Faculty Example' }), repository, writeGates: gates, idFactory: () => NEW_ID });
  const app = createAfcRequestFunctions({ api });
  const post = (action, body, id = ID) => app({ method: 'POST', url: `https://local/api/v1/afc-requests/${id}/${action}`, headers: { get: name => String(name).toLowerCase() === 'authorization' ? 'Bearer token' : null }, json: async () => body });
  return { api, post, calls };
}

test('faculty date change is a new signed request linked to the approved one', async () => {
  for (const role of ['faculty', 'hicc', 'visc']) {
    const h = requests({ role });
    const response = await h.post('date-change', changePayload());
    assert.equal(response.status, 201);
    assert.equal(response.jsonBody.afcRequest.replacesAfcRequestId, ID);
    assert.equal(response.jsonBody.afcRequest.status, 'pending_admin');
    assert.equal(h.calls[0][1].replacesAfcRequestId, ID);
    assert.equal(h.calls[0][1].afcRequestId, NEW_ID);
    assert.equal(h.calls[0][1].actorFirebaseUid, 'uid-faculty');
    assert.equal(h.calls[0][1].workDays, 2);
  }
});

test('faculty date change needs both request and edit gates, a faculty role and a full signed form', async () => {
  assert.equal((await requests({ gates: { afcRequest: true } }).post('date-change', changePayload())).jsonBody.error.code, 'WRITE_DISABLED');
  assert.equal((await requests({ gates: { afcEdit: true } }).post('date-change', changePayload())).jsonBody.error.code, 'WRITE_DISABLED');
  assert.equal((await requests({ role: 'administrator', uid: 'uid-admin' }).post('date-change', changePayload())).status, 403);
  const h = requests();
  assert.equal((await h.post('date-change', { ...changePayload(), applicantSignature: null })).status, 422);
  assert.equal((await h.post('date-change', { ...changePayload(), facultyId: 'spoof' })).status, 400);
  assert.equal((await h.post('date-change', changePayload(), 'bad-id')).status, 400);
  assert.equal(h.calls.length, 0);
});

test('faculty date change maps pending, duplicate and unchanged outcomes', async () => {
  for (const [number, status, code] of [[51510, 409, 'DATE_CHANGE_NOT_ALLOWED'], [51511, 409, 'DATE_CHANGE_PENDING'], [51512, 422, 'AFC_DATES_UNCHANGED'], [51507, 404, 'REQUEST_NOT_FOUND']]) {
    const response = await requests({ fail: { number } }).post('date-change', changePayload());
    assert.equal(response.status, status); assert.equal(response.jsonBody.error.code, code);
  }
});

test('office can change approved request dates directly with server work days', async () => {
  const h = requests({ role: 'administrator', uid: 'uid-admin' });
  const response = await h.post('dates', { expectedVersion: VERSION, startDate: '2026-11-16', endDate: '2026-11-20' });
  assert.equal(response.status, 200);
  assert.equal(response.jsonBody.afcRequest.startDate, '2026-11-16');
  assert.equal(h.calls[0][1].workDays, 5);
  assert.equal(h.calls[0][1].actorFirebaseUid, 'uid-admin');
  assert.equal((await requests().post('dates', { expectedVersion: VERSION, startDate: '2026-11-16', endDate: '2026-11-20' })).status, 403);
  assert.equal((await requests({ role: 'administrator', uid: 'uid-admin', gates: { afcRequest: true } }).post('dates', { expectedVersion: VERSION, startDate: '2026-11-16', endDate: '2026-11-20' })).jsonBody.error.code, 'WRITE_DISABLED');
  assert.equal((await h.post('dates', { expectedVersion: '', startDate: '2026-11-16', endDate: '2026-11-20' })).status, 400);
  assert.equal((await h.post('dates', { expectedVersion: VERSION, startDate: '2026-11-21', endDate: '2026-11-22' })).jsonBody.error.code, 'NO_WORK_DAYS');
  const pending = await requests({ role: 'administrator', uid: 'uid-admin', fail: { number: 56407 } }).post('dates', { expectedVersion: VERSION, startDate: '2026-11-16', endDate: '2026-11-20' });
  assert.equal(pending.jsonBody.error.code, 'DATE_CHANGE_PENDING');
});

test('write capabilities expose the date change gate', async () => {
  const response = await requests().api.writeCapabilities('token');
  assert.equal(response.body.writeCapabilities.dateChange, true);
  assert.equal((await requests({ gates: { afcRequest: true } }).api.writeCapabilities('token')).body.writeCapabilities.dateChange, false);
});

test('repositories call only the two reviewed procedures with named parameters', async () => {
  const queries = [];
  const db = { query: async (text, params) => { queries.push({ text, params }); return [{ afcRecordId: ID }]; } };
  await createSqlAfcWriteRepository(db).updateAfcDates({ afcRecordId: ID, sourceKind: 'manual', expectedVersion: VERSION, startDate: '2026-11-09', endDate: '2026-11-10', actorFirebaseUid: 'u', requestId: NEW_ID });
  const repo = createSqlAfcRequestRepository(db);
  await repo.submitDateChange({ replacesAfcRequestId: ID, afcRequestId: NEW_ID });
  await repo.updateApprovedRequestDates({ afcRequestId: ID, expectedVersion: VERSION, startDate: '2026-11-09', endDate: '2026-11-10', workDays: 2, actorFirebaseUid: 'u', requestId: NEW_ID });
  assert.match(queries[0].text, /^EXEC paws_api\.UpdateAfcDates/);
  assert.match(queries[1].text, new RegExp('EXEC ' + DATE_CHANGE_PROCEDURE.replace('.', '\\.')));
  assert.match(queries[2].text, new RegExp('EXEC ' + OFFICE_DATES_PROCEDURE.replace('.', '\\.') + "[\\s\\S]*@SourceKind = N'request'"));
  for (const q of queries) assert.doesNotMatch(q.text, /\$\{|UPDATE\s+paws|INSERT\s+paws/i);
});

test('migration 064 adds the edit commands, supersede rule and history without rewriting rows', () => {
  const migration = sql('064_afc_date_edit.sql');
  assert.match(migration, /CREATE PROCEDURE paws_api\.UpdateAfcDates/);
  assert.match(migration, /CREATE PROCEDURE paws_api\.SubmitAfcDateChange/);
  assert.match(migration, /CREATE OR ALTER PROCEDURE paws_api\.ApproveAfcRequest/);
  assert.match(migration, /N'withdrawn',N'superseded'\)\)/);
  assert.match(migration, /UX_AfcRequest_OpenDateChange[\s\S]*WHERE ReplacesAfcRequestId IS NOT NULL AND Status IN \(N'pending_report_to',N'pending_admin'\)/);
  assert.match(migration, /THROW 56407,'A faculty date change for this request is waiting for approval\.'/);
  assert.match(migration, /THROW 51510,'Only an approved AFC request can have its dates changed\. Withdraw a pending request and submit a new one\.'/);
  assert.match(migration, /SET Status = N'superseded',\s*SupersededByAfcRequestId = @AfcRequestId/);
  assert.equal((migration.match(/N'afc_dates_changed'/g) || []).length >= 5, true);
  assert.deepEqual([...migration.matchAll(/GRANT EXECUTE ON OBJECT::([\w.]+) TO paws_runtime_afc_edit_write/g)].map(m => m[1]), ['paws_api.UpdateAfcDates', 'paws_api.SubmitAfcDateChange']);
  assert.match(migration, /GRANT SELECT ON OBJECT::paws\.AfcRequest \(ReplacesAfcRequestId,SupersededByAfcRequestId,AfcVersion\) TO paws_runtime_read/);
  assert.doesNotMatch(migration, /ALTER\s+ROLE[^;]+ADD\s+MEMBER|GRANT\s+(?:UPDATE|INSERT|DELETE)\s+ON|GRANT\s+EXECUTE\s+ON\s+SCHEMA|DELETE\s+FROM\s+paws/i);
  const rollback = sql('rollback_064_afc_date_edit.sql');
  assert.match(rollback, /DROP PROCEDURE paws_api\.SubmitAfcDateChange/);
  assert.doesNotMatch(rollback, /DELETE|DROP\s+TABLE|DROP\s+COLUMN/i);
  assert.match(sql('064_afc_date_edit_acceptance.sql'), /ROLLBACK TRANSACTION;[\s\S]*AFC_DATE_EDIT_ROLLBACK_ACCEPTANCE_OK/);
});

test('Change History shows old and new AFC dates to admins and the affected faculty only', () => {
  const event = { source: 'audit', eventId: 'e1', eventType: 'afc_dates_changed', entityType: 'afc_request', entityId: ID, occurredAtUtc: '2026-10-29T18:00:00Z',
    beforeJson: JSON.stringify({ facultyId: FACULTY, startDate: '2026-11-02', endDate: '2026-11-03' }),
    afterJson: JSON.stringify({ facultyId: FACULTY, startDate: '2026-11-09', endDate: '2026-11-10' }),
    metadataJson: JSON.stringify({ facultyId: FACULTY, sourceKind: 'request', changedBy: 'office' }), actorName: 'ADFA Office' };
  const rows = projectHistoryEvent(event, { admin: true, scope: 'dashboard', facultyId: null });
  assert.deepEqual(rows.map(r => [r.field, r.previousValue, r.updatedValue]), [['Start date', '2026-11-02', '2026-11-09'], ['End date', '2026-11-03', '2026-11-10']]);
  assert.equal(rows[0].domain, 'AFC');
  assert.equal(projectHistoryEvent(event, { admin: false, scope: 'dashboard', facultyId: FACULTY }).length, 2);
  assert.equal(projectHistoryEvent(event, { admin: false, scope: 'dashboard', facultyId: NEW_ID }).length, 0);
  const requested = projectHistoryEvent({ ...event, eventType: 'afc_date_change_requested' }, { admin: true, scope: 'dashboard' });
  assert.equal(requested.length, 2);
});
