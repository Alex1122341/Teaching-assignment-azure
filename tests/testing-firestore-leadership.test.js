'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLabLeadershipReader } = require('../tools/testing/firestore-leadership');
const { createLabReadRuntime } = require('../tools/testing/firestore-read-runtime');

function database(rows, projectId = 'vista-teaching-lab', databaseId = '(default)') {
  const trace = { filters: [], selected: [], limit: 0 };
  const query = {
    where(field, op, value) { trace.filters.push([field, op, value]); return query; },
    select(...fields) { trace.selected = fields; return query; },
    limit(value) { trace.limit = value; return query; },
    async get() {
      return { docs: rows.filter(row => trace.filters.every(([key, op, value]) => op === '==' && row[key] === value)).slice(0, trace.limit)
        .map(row => ({ data: () => Object.fromEntries(trace.selected.filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]])) })) };
    }
  };
  return { projectId, databaseId, trace, collection(name) {
    if (name === 'paws_testing_leadership') return query;
    if (name === 'paws_testing_users') return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ synthetic: true, name: 'Test Faculty', role: 'faculty', facultyId: 'f1', active: true, mustChangePassword: false }) }) }) };
    if (name === 'paws_testing_sessions') return query;
    throw Error('Unexpected collection');
  } };
}
const rows = [{ synthetic: true, academicYear: '2026-27', roleType: 'HICC', courseCode: 'VTMD 206', facultyFirstName: 'Avery', facultyLastName: 'Testwell', facultyKey: 'f1', effectiveDate: '2026-05-01', ucid: 'private-ucid', email: 'private@example.test', doe: 88 }];

test('Testing leadership reader pins the project and default database', () => {
  assert.throws(() => createLabLeadershipReader({ db: database(rows, 'tester-teaching') }));
  assert.throws(() => createLabLeadershipReader({ db: database(rows, 'vista-teaching-lab', 'other') }));
});

test('Testing leadership reader rejects non-synthetic rows and never selects private fields', async () => {
  const db = database(rows), list = createLabLeadershipReader({ db });
  const result = await list({ academicYear: '2026-27' });
  assert.equal(result.length, 1);
  assert.deepEqual(db.trace.filters, [['academicYear', '==', '2026-27']]);
  assert.ok(!db.trace.selected.includes('ucid') && !db.trace.selected.includes('email') && !db.trace.selected.includes('doe'));
  assert.doesNotMatch(JSON.stringify(result), /private-ucid|private@example|"doe"/);
  await assert.rejects(createLabLeadershipReader({ db: database([{ academicYear: '2026-27', roleType: 'HICC' }]) })({ academicYear: '2026-27' }), /synthetic/i);
});

test('Testing leadership reads fail closed rather than truncating a large roster', async () => {
  const db = database(Array.from({ length: 10001 }, () => rows[0]));
  await assert.rejects(createLabLeadershipReader({ db })({ academicYear: '2026-27' }), /limit/i);
  assert.equal(db.trace.limit, 10001);
});

test('Testing leadership route authenticates and returns only the shared directory allow-list', async () => {
  const db = database(rows);
  const runtime = createLabReadRuntime({ db, verifyIdToken: async () => ({ uid: 'test', aud: 'paws-testing-ucvm-20261022', iss: 'https://securetoken.google.com/paws-testing-ucvm-20261022' }) });
  const request = token => new Request('https://testing.invalid/api/v1/dashboard/leadership-directory?academicYear=2026-27', { headers: token ? { authorization: 'Bearer ' + token } : {} });
  assert.equal((await runtime(request())).status, 401);
  const response = await runtime(request('synthetic'));
  assert.equal(response.status, 200);
  assert.equal(response.jsonBody.hiccCc[0].facultyName, 'Testwell, Avery');
  assert.doesNotMatch(JSON.stringify(response.jsonBody), /private-ucid|private@example|"doe"|"facultyKey"/);
  const invalidYear = new Request('https://testing.invalid/api/v1/dashboard/leadership-directory?academicYear=2026-28', { headers: { authorization: 'Bearer synthetic' } });
  assert.equal((await runtime(invalidYear)).status, 400);
});
