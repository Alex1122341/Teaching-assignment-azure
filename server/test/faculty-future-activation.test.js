'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createDashboardApi } = require('../src/data/dashboard-api');
const { createDashboardFunctions } = require('../src/runtime/swa-dashboard-functions');

const FACULTY_ID = '11111111-1111-4111-8111-111111111111';
const UPDATED = '2026-10-31T12:00:00.000Z';
const profile = {
  teachingArea: 'Anatomy', professionalCategory: null, serviceDate: null,
  priorYearsExperience: null, dvmEarnedDate: null, dvmType: null,
  mastersEarnedDate: null, mastersArea: null, phdEarnedDate: null,
  phdArea: null, boardCertifiedDate: null, boardCertification: null,
  boardCertificationCount: null, abvmaLicenseNumber: null, abvmaMemberType: null
};
const record = (activationDate = '2027-06-01') => ({
  expectedUpdatedAtUtc: UPDATED, expectedProfileVersion: null,
  preferredFirstName: 'Future', preferredLastName: 'Hire', displayName: 'Future Hire',
  ucid: 'future-uc-1', email: 'future@example.edu', recordType: 'faculty',
  stream: 'Clinical', rank: 'Assistant Professor', fte: 1,
  reportsToFacultyId: null, activationDate, professionalProfile: { ...profile }
});
const req = (path, method = 'GET', body) => ({
  url: 'https://example.test' + path, method,
  headers: { get: name => name.toLowerCase() === 'authorization' ? 'Bearer verified' : null },
  json: async () => body
});
function harness(role = 'adfa_regular', writeEnabled = true) {
  const calls = [], row = { facultyId: FACULTY_ID, displayName: 'Future Hire', activationDate: '2027-06-01', administrativeActive: true, active: false, updatedAtUtc: UPDATED };
  const source = {
    faculty: async () => [],
    facultyById: async () => ({ faculty: row }),
    createFaculty: async input => { calls.push(['create', input]); return row; },
    updateFaculty: async input => { calls.push(['update', input]); return row; }
  };
  const api = createDashboardApi({
    verifyToken: async () => ({ uid: 'verified-uid' }),
    findUser: async () => ({ active: true, mustChangePassword: false, baseRole: role, displayName: 'Admin' }),
    repository: source, writeRepository: source, writeGates: { facultyAdmin: writeEnabled }
  });
  return { api, app: createDashboardFunctions({ api }), calls };
}

test('admin may create a pre-hire faculty record with a future activation date', async () => {
  const { app, calls } = harness();
  const { expectedUpdatedAtUtc, expectedProfileVersion, ...body } = record();
  const response = await app(req('/api/v1/dashboard/faculty', 'POST', body));
  assert.equal(response.status, 201);
  assert.equal(response.jsonBody.faculty.facultyId, FACULTY_ID);
  assert.equal(calls[0][0], 'create');
  assert.equal(calls[0][1].activationDate, '2027-06-01');
  assert.equal(calls[0][1].actorFirebaseUid, 'verified-uid');
});

test('faculty create is denied without admin permission or an enabled write gate', async () => {
  const { expectedUpdatedAtUtc, expectedProfileVersion, ...body } = record();
  for (const role of ['faculty', 'hicc', 'visc', 'viewer']) {
    const { app, calls } = harness(role);
    assert.equal((await app(req('/api/v1/dashboard/faculty', 'POST', body))).status, 403);
    assert.equal(calls.length, 0);
  }
  const { app, calls } = harness('owner', false);
  assert.equal((await app(req('/api/v1/dashboard/faculty', 'POST', body))).status, 503);
  assert.equal(calls.length, 0);
});

test('invalid activation dates are rejected without touching SQL', async () => {
  const { expectedUpdatedAtUtc, expectedProfileVersion, ...payload } = record();
  for (const bad of ['2027-02-30', '01/06/2027', '2027-13-01', 'soon']) {
    const { app, calls } = harness();
    const response = await app(req('/api/v1/dashboard/faculty', 'POST', { ...payload, activationDate: bad }));
    assert.equal(response.status, 400, bad);
    assert.equal(calls.length, 0);
  }
});

test('existing faculty may update activation date with the same optimistic concurrency token', async () => {
  const { app, calls } = harness();
  const result = await app(req('/api/v1/dashboard/faculty/' + FACULTY_ID, 'PATCH', record('2027-06-01')));
  assert.equal(result.status, 200);
  assert.equal(calls[0][0], 'update');
  assert.equal(calls[0][1].activationDate, '2027-06-01');
});

test('duplicate identity SQL errors are surfaced as 409 rather than creating a second faculty', async () => {
  const api = createDashboardApi({
    verifyToken: async () => ({ uid: 'verified' }),
    findUser: async () => ({ baseRole: 'admin', active: true, mustChangePassword: false }),
    repository: {}, writeRepository: { createFaculty: async () => { const error = new Error('duplicate'); error.number = 52304; throw error; } },
    writeGates: { facultyAdmin: true }
  });
  const { expectedUpdatedAtUtc, expectedProfileVersion, ...body } = record();
  const response = await createDashboardFunctions({ api })(req('/api/v1/dashboard/faculty', 'POST', body));
  assert.equal(response.status, 409);
  assert.equal(response.jsonBody.error.code, 'FACULTY_IDENTITY_CONFLICT');
});

test('SQL migration protects every canonical course assignment write path', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../database/azure-sql/065_faculty_future_activation.sql'), 'utf8');
  assert.match(sql, /ALTER TABLE\s+paws\.Faculty\s+ADD\s+ActivationDate/i);
  for (const name of [
    'SessionAssignment', 'Session', 'TeachingAssignmentRevisionInstructor',
    'TeachingAssignmentFinalizationLine', 'TeachingAssignmentPublishedInstructor'
  ]) assert.match(sql, new RegExp('ON\\s+paws\\.' + name + '\\s+', 'i'), name);
  assert.match(sql, /CREATE OR ALTER PROCEDURE paws_api\.CreateFaculty/i);
  assert.match(sql, /CREATE OR ALTER PROCEDURE paws_api\.SetFacultyActivation/i);
  assert.match(sql, /GRANT EXECUTE ON OBJECT::paws_api\.CreateFaculty/i);
  assert.match(sql, /GRANT EXECUTE ON OBJECT::paws_api\.SetFacultyActivation/i);
});

test('Lookup contains an admin-gated new faculty entry point, date editor and status', () => {
  const root = path.resolve(__dirname, '../..');
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(read('frontend/pages/faculty-admin.html'), /id="faculty-create-btn"/);
  assert.match(read('frontend/scripts/faculty-admin-management.js'), /createDashboardFaculty/);
  assert.match(read('frontend/scripts/faculty-admin-management.js'), /activationDate/);
  assert.match(read('frontend/scripts/paws-data-client.js'), /createDashboardFaculty/);
  assert.match(read('server/src/data/sql-dashboard-repository.js'), /ActivationDate/);
});
