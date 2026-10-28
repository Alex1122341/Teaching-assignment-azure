'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLabCccReader } = require('../tools/testing/firestore-ccc');
const { createLabReadRuntime } = require('../tools/testing/firestore-read-runtime');

function database(rows, projectId = 'vista-teaching-lab', databaseId = '(default)') {
  const trace = { filters: [], fields: [], limit: 0 };
  const query = {
    where(field, op, value) { trace.filters.push([field, op, value]); return query; },
    select(...fields) { trace.fields = fields; return query; },
    limit(value) { trace.limit = value; return query; },
    async get() { return { docs: rows.filter(row => trace.filters.every(([k, op, v]) => op === '==' && row[k] === v)).slice(0, trace.limit)
      .map(row => ({ data: () => Object.fromEntries(trace.fields.filter(k => Object.hasOwn(row, k)).map(k => [k, row[k]])) })) }; }
  };
  return { projectId, databaseId, trace, collection(name) {
    if (name === 'paws_testing_ccc') return query;
    if (name === 'paws_testing_users') return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ synthetic: true, name: 'Test Faculty', role: 'faculty', facultyId: 'f1', active: true, mustChangePassword: false }) }) }) };
    throw Error('Unexpected collection');
  } };
}
const rows = [{ synthetic: true, academicYear: '2026-27', date: '2027-01-12', endDate: '2027-01-12', facultyName: 'Avery Testwell', courseCode: 'VTMD 206', blockLabel: 'Synthetic CCC', halfDay: false, ucid: 'private-ucid', email: 'private@example.test', purpose: 'private-purpose', doe: 88 }];

test('Testing CCC reader pins the lab default database', () => {
  assert.throws(() => createLabCccReader({ db: database(rows, 'tester-teaching') }));
  assert.throws(() => createLabCccReader({ db: database(rows, 'vista-teaching-lab', 'other') }));
});

test('Testing CCC reader selects only public fields and refuses unmarked or excessive data', async () => {
  const db = database(rows);
  const result = await createLabCccReader({ db })({ academicYear: '2026-27' });
  assert.deepEqual(db.trace.filters, [['academicYear', '==', '2026-27']]);
  assert.equal(result.entries[0].facultyName, 'Testwell, Avery');
  assert.ok(!db.trace.fields.includes('ucid') && !db.trace.fields.includes('email') && !db.trace.fields.includes('purpose') && !db.trace.fields.includes('doe'));
  assert.doesNotMatch(JSON.stringify(result), /private-ucid|private@example|private-purpose|"doe"/);
  await assert.rejects(createLabCccReader({ db: database([{ academicYear: '2026-27' }]) })({ academicYear: '2026-27' }), /synthetic/i);
  await assert.rejects(createLabCccReader({ db: database(Array.from({ length: 2501 }, () => rows[0])) })({ academicYear: '2026-27' }), /limit/i);
});

test('Testing CCC route requires a verified identity and returns only the approved schedule projection', async () => {
  const db = database(rows);
  const runtime = createLabReadRuntime({ db, verifyIdToken: async () => ({ uid: 'test', aud: 'paws-testing-ucvm-20261022', iss: 'https://securetoken.google.com/paws-testing-ucvm-20261022' }) });
  const request = token => new Request('https://testing.invalid/api/v1/ccc-schedule?academicYear=2026-27', { headers: token ? { authorization: 'Bearer ' + token } : {} });
  assert.equal((await runtime(request())).status, 401);
  const response = await runtime(request('synthetic'));
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.jsonBody.entries[0]).sort(), ['blockLabel', 'courseCode', 'date', 'endDate', 'facultyName', 'halfDay']);
  assert.doesNotMatch(JSON.stringify(response.jsonBody), /private-ucid|private@example|private-purpose|"doe"/);
});
