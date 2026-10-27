'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLabCalendarReader } = require('../tools/testing/firestore-calendar');
const { createLabReadRuntime } = require('../tools/testing/firestore-read-runtime');

test('Testing calendar index specification matches the scoped date query', async () => {
  const spec = require('../deploy/testing/firestore-calendar-index.json');
  assert.equal(spec.project, 'vista-teaching-lab');
  assert.equal(spec.database, '(default)');
  assert.equal(spec.collectionGroup, 'paws_testing_sessions');
  assert.equal(spec.queryScope, 'COLLECTION');
  assert.deepEqual(spec.fields, [{ fieldPath: 'facultyIds', arrayConfig: 'CONTAINS' }, { fieldPath: 'date', order: 'ASCENDING' }]);
  const db = fakeDb([]);
  await createLabCalendarReader({ db })({ facultyId: 'synthetic-f1', start: '2027-01-01', end: '2027-02-01' });
  assert.deepEqual(db.trace.filters, [['facultyIds', 'array-contains', 'synthetic-f1'], ['date', '>=', '2027-01-01'], ['date', '<', '2027-02-01']]);
});

function fakeDb(rows, projectId = 'vista-teaching-lab', databaseId = '(default)') {
  const trace = { filters: [], selected: [], limit: 0 };
  const q = {
    where(field, op, value) { trace.filters.push([field, op, value]); return q; },
    select(...fields) { trace.selected = fields; return q; },
    limit(n) { trace.limit = n; return q; },
    async get() {
      const filtered = rows.filter(row => trace.filters.every(([f, op, v]) => op === 'array-contains' ? row.data[f]?.includes(v) : op === '>=' ? row.data[f] >= v : row.data[f] < v));
      return { docs: filtered.slice(0, trace.limit).map(row => ({ id: row.id, data: () => Object.fromEntries(trace.selected.filter(k => Object.hasOwn(row.data, k)).map(k => [k, row.data[k]])) })) };
    }
  };
  return { projectId, databaseId, trace, collection(name) { assert.equal(name, 'paws_testing_sessions'); return q; } };
}

const rows = [
  { id: 'one', data: { synthetic: true, academicYear: '2026-27', year: 2, date: '2027-01-12', start: '09:00', end: '10:00', course: 'VETM 301', type: 'LAB', instructorNames: ['Mary Jane de la Cruz'], facultyIds: ['f1'], assignments: [{ facultyId: 'f1', name: 'de la Cruz, Mary Jane', role: 'Lead', ucid: 'private', doeCredit: 3 }], secret: 'private' } },
  { id: 'two', data: { synthetic: true, academicYear: '2026-27', year: 2, date: '2027-01-13', facultyIds: ['f2'], assignments: [] } }
];

test('calendar reader rejects unmarked documents instead of returning them', async () => {
  const db = fakeDb([{ id: 'unmarked', data: { date: '2027-01-12', facultyIds: ['f1'] } }]);
  await assert.rejects(createLabCalendarReader({ db })({ facultyId: 'f1' }), /synthetic/i);
});

test('calendar reader rejects non-lab database targets', () => {
  assert.throws(() => createLabCalendarReader({ db: fakeDb(rows, 'tester-teaching') }));
  assert.throws(() => createLabCalendarReader({ db: fakeDb(rows, 'vista-teaching-lab', 'other') }));
});

test('faculty calendar query is faculty-scoped and excludes private assignment fields', async () => {
  const db = fakeDb(rows);
  const list = createLabCalendarReader({ db });
  const result = await list({ facultyId: 'f1', start: '2027-01-01', end: '2027-02-01' });
  assert.deepEqual(result.map(row => row.id), ['one']);
  assert.ok(db.trace.filters.some(([field, op, val]) => field === 'facultyIds' && op === 'array-contains' && val === 'f1'));
  assert.ok(!db.trace.selected.includes('assignments'));
  assert.equal(result[0].assignmentsJson, '[]');
  assert.doesNotMatch(JSON.stringify(result), /private|doeCredit|ucid/);
});

test('authorized admin assignments contain only the permitted projection', async () => {
  const db = fakeDb(rows);
  const [row] = await createLabCalendarReader({ db })({ includeAssignmentTargets: true });
  assert.deepEqual(JSON.parse(row.assignmentsJson), [{ facultyId: 'f1', teachingRole: 'Lead', displayName: 'de la Cruz, Mary Jane', active: null }]);
  assert.doesNotMatch(JSON.stringify(row), /private|doeCredit|ucid/);
  assert.equal(row.courseCode, 'VETM 301');
  assert.equal(row.startTime, '09:00');
});

test('calendar reads fail closed instead of silently truncating large results', async () => {
  const db = fakeDb(Array.from({length: 10001}, (_, i) => ({ id: String(i), data: { date: '2027-01-01' } })));
  await assert.rejects(createLabCalendarReader({ db })({}), /limit/i);
  assert.equal(db.trace.limit, 10001);
});

test('calendar reader rejects ambiguous scope and incomplete date ranges', async () => {
  const db = fakeDb(rows);
  const list = createLabCalendarReader({ db });
  await assert.rejects(list({ facultyId: '' }));
  await assert.rejects(list({ facultyId: 'f1', includeAssignmentTargets: true }));
  await assert.rejects(list({ start: '2027-01-01' }));
  assert.equal(db.trace.limit, 0);
});

test('read runtime verifies the Testing token and scopes faculty requests before querying', async () => {
  const db = fakeDb(rows);
  const sessionsCollection = db.collection;
  db.collection = name => name === 'paws_testing_users' ? { doc: id => ({ get: async () => ({ exists: id === 'user', data: () => ({ synthetic: true, name: 'Test Person', role: 'faculty', facultyId: 'f1', active: true, mustChangePassword: false }) }) }) } : sessionsCollection(name);
  const verifyIdToken = async token => ({ uid: 'user', aud: token === 'lab' ? 'paws-testing-ucvm-20261022' : 'tester-teaching', iss: `https://securetoken.google.com/${token === 'lab' ? 'paws-testing-ucvm-20261022' : 'tester-teaching'}` });
  const runtime = createLabReadRuntime({ db, verifyIdToken });
  const request = (path, token = 'lab', method = 'GET') => new Request('https://testing.invalid' + path, { method, headers: { authorization: 'Bearer ' + token } });
  const unauthorized = await runtime(request('/api/v1/sessions', 'production'));
  assert.equal(unauthorized.status, 401);
  assert.equal(db.trace.filters.length, 0);
  const me = await runtime(request('/api/v1/me'));
  assert.equal(me.status, 200);
  assert.deepEqual(me.jsonBody.environment, { name: 'testing', testing: true });
  const sessions = await runtime(request('/api/v1/sessions?start=2027-01-01&end=2027-02-01'));
  assert.equal(sessions.status, 200);
  assert.deepEqual(sessions.jsonBody.sessions.map(row => row.id), ['one']);
  assert.doesNotMatch(JSON.stringify(sessions.jsonBody), /private|doeCredit|ucid/);
  assert.equal((await runtime(request('/api/v1/sessions', 'lab', 'POST'))).status, 405);
  assert.equal((await runtime(request('/api/health/sql'))).status, 404);
});
