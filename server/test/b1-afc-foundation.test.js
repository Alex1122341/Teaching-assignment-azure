'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createDashboardApi } = require('../src/data/dashboard-api');
const { createDashboardFunctions } = require('../src/runtime/swa-dashboard-functions');

const root = path.join(__dirname, '..', '..');
const FACULTY_ID = '11111111-1111-4111-8111-111111111111';
const CREATED_ID = '22222222-2222-4222-8222-222222222222';

function request(url, { method = 'GET', body, token = 'token' } = {}) {
  return {
    method,
    url: `https://local${url}`,
    headers: { get: name => name.toLowerCase() === 'authorization' ? `Bearer ${token}` : null },
    async json() {
      if (body instanceof Error) throw body;
      return body;
    }
  };
}

function harness({ role = 'administrator', repository = {} } = {}) {
  const calls = [];
  const profile = { active: true, mustChangePassword: false, baseRole: role, displayName: 'Trusted Admin', facultyId: null };
  const api = createDashboardApi({
    verifyToken: async () => ({ uid: 'firebase-uid' }),
    findUser: async () => profile,
    repository: {
      summary: async () => ({}),
      faculty: async () => [],
      facultyById: async () => null,
      listAfcRecords: async args => { calls.push(['list', args]); return []; },
      createAfcRecord: async args => { calls.push(['create', args]); return { ...args, afcRecordId: CREATED_ID, facultyName: 'Ada One', reason: 'Vacation', sourceKind: 'manual', active: true }; },
      ...repository
    }
  });
  return { app: createDashboardFunctions({ api }), calls };
}

test('B1 migration 007 creates isolated manual AFC storage, unified view, and trusted procedure', () => {
  const source = fs.readFileSync(path.join(root, 'database', 'azure-sql', '007_afc_manual_write_foundation.sql'), 'utf8');
  assert.match(source, /CREATE TABLE\s+paws\.AfcManualRecord/i);
  assert.match(source, /CREATE(?: OR ALTER)? VIEW\s+paws\.vAfcRecordUnified/i);
  assert.match(source, /CREATE SCHEMA\s+paws_api/i);
  assert.match(source, /CREATE(?: OR ALTER)? PROCEDURE\s+paws_api\.CreateAfcRecord/i);
  assert.match(source, /SET XACT_ABORT ON/i);
  assert.match(source, /BEGIN TRY/i);
  assert.match(source, /BEGIN TRANSACTION/i);
  assert.match(source, /ROLLBACK/i);
  assert.match(source, /afc_record_created/i);
  const procedure = source.slice(source.indexOf('CREATE OR ALTER PROCEDURE'));
  assert.doesNotMatch(procedure, /sp_executesql|EXEC\s*\(@|EXEC\s+\(/i);
  assert.doesNotMatch(source, /TeachingResponsibility|TeachingAssignmentGroup|SessionAssignment|DoeRule|005_|006_/i);
});

test('B1 least-privilege proposal grants only unified read and exact procedure execute', () => {
  const source = fs.readFileSync(path.join(root, 'database', 'azure-sql', '007_afc_manual_write_permissions.sql'), 'utf8');
  const proof = fs.readFileSync(path.join(root, 'database', 'azure-sql', '007_afc_manual_write_least_privilege_proof.sql'), 'utf8');
  assert.match(source, /GRANT\s+SELECT\s+ON\s+OBJECT::paws\.vAfcRecordUnified/i);
  assert.match(source, /GRANT\s+EXECUTE\s+ON\s+OBJECT::paws_api\.CreateAfcRecord/i);
  assert.doesNotMatch(source, /GRANT\s+(?:INSERT|UPDATE|DELETE).*AfcManualRecord/i);
  assert.doesNotMatch(source, /GRANT\s+EXECUTE\s+ON\s+SCHEMA::paws_api/i);
  assert.match(proof, /LEAST_PRIVILEGE_WRITE_PROOF_OK/);
  assert.match(proof, /AfcManualRecord/i);
  assert.match(proof, /SCHEMA_ID\(N?'staging'\)/i);
  assert.match(proof, /paws schema mutation DENY/i);
  assert.match(proof, /paws_api schema ownership/i);
});

test('B1 AFC route allows GET and POST but keeps other methods at 405', async () => {
  const { app } = harness();
  const list = await app(request('/api/v1/dashboard/afc-records'));
  assert.equal(list.status, 200);
  const created = await app(request('/api/v1/dashboard/afc-records', {
    method: 'POST',
    body: { facultyId: FACULTY_ID, startDate: '2026-10-01', endDate: '2026-10-01', reasonCode: 'vacation', notes: '' }
  }));
  assert.equal(created.status, 201);
  for (const method of ['PUT', 'PATCH', 'DELETE', 'HEAD']) {
    const response = await app(request('/api/v1/dashboard/afc-records', { method }));
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.Allow, 'GET, POST');
  }
});

test('B1 POST validates dates, reason, notes, and ignores client identity fields', async () => {
  const { app, calls } = harness();
  const cases = [
    [{ facultyId: FACULTY_ID, startDate: '2026-02-30', endDate: '2026-03-01', reasonCode: 'vacation' }, 'INVALID_DATE'],
    [{ facultyId: FACULTY_ID, startDate: '2026-03-02', endDate: '2026-03-01', reasonCode: 'vacation' }, 'INVALID_DATE_RANGE'],
    [{ facultyId: FACULTY_ID, startDate: '2026-03-01', endDate: '2026-03-01', reasonCode: 'unknown' }, 'INVALID_REASON'],
    [{ facultyId: FACULTY_ID, startDate: '2026-03-01', endDate: '2026-03-01', reasonCode: 'special', notes: '  ' }, 'NOTES_REQUIRED'],
    [{ facultyId: FACULTY_ID, startDate: '2026-03-01', endDate: '2026-03-01', reasonCode: 'vacation', notes: 'x'.repeat(1001) }, 'NOTES_TOO_LONG']
  ];
  for (const [body, code] of cases) {
    const response = await app(request('/api/v1/dashboard/afc-records', { method: 'POST', body }));
    assert.equal(response.status, 400, code);
    assert.equal(response.jsonBody.error.code, code);
  }
  const response = await app(request('/api/v1/dashboard/afc-records', {
    method: 'POST',
    body: { facultyId: FACULTY_ID, startDate: '2026-03-01', endDate: '2026-03-01', reasonCode: 'vacation', notes: '', actorFirebaseUid: 'evil', actorName: 'Evil', requestId: 'evil', afcRecordId: 'evil' }
  }));
  assert.equal(response.status, 201);
  const [, args] = calls.find(call => call[0] === 'create');
  assert.equal(args.facultyId, FACULTY_ID);
  assert.equal(args.actorFirebaseUid, 'firebase-uid');
  assert.equal(args.actorName, 'Trusted Admin');
  assert.match(args.afcRecordId, /^[0-9a-f-]{36}$/i);
  assert.match(args.requestId, /^[0-9a-f-]{36}$/i);
});

test('B1 AFC list/create are administrator-only', async () => {
  for (const role of ['faculty', 'hicc', 'visc', 'viewer', 'other_office', 'unsupported']) {
    const { app } = harness({ role });
    assert.equal((await app(request('/api/v1/dashboard/afc-records'))).status, 403, role + ' list');
    assert.equal((await app(request('/api/v1/dashboard/afc-records', { method: 'POST', body: {} }))).status, 403, role + ' create');
  }
});

test('B1 write repository and dashboard read repository are separate and bounded', () => {
  const write = fs.readFileSync(path.join(root, 'server', 'src', 'data', 'sql-afc-write-repository.js'), 'utf8');
  const read = fs.readFileSync(path.join(root, 'server', 'src', 'data', 'sql-dashboard-repository.js'), 'utf8');
  assert.match(write, /paws_api\.CreateAfcRecord/);
  assert.doesNotMatch(write, /execute\s*\(\s*sql|INSERT\s+INTO\s+paws\.AfcManualRecord|UPDATE\s+paws|DELETE\s+FROM\s+paws|MERGE\s+/i);
  assert.match(read, /vAfcRecordUnified/);
  assert.match(read, /TOP \(@limit\)/i);
});
