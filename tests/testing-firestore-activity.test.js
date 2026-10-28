'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLabActivityReader } = require('../tools/testing/firestore-activity');
const { createLabReadRuntime } = require('../tools/testing/firestore-read-runtime');

const a = 'a1111111-1111-4111-8111-111111111111';
const b = 'b2222222-2222-4222-8222-222222222222';
const ka = 'a3333333-3333-4333-8333-333333333333';
const kb = 'b4444444-4444-4444-8444-444444444444';
const id = 'c1111111-1111-4111-8111-111111111111';
const profiles = {
  a: { baseRole: 'faculty', facultyId: a, active: true, mustChangePassword: false },
  admin: { baseRole: 'administrator', active: true, mustChangePassword: false }
};
const mappings = [
  { synthetic: true, facultyId: a, facultyKey: ka, active: true },
  { synthetic: true, facultyId: b, facultyKey: kb, active: true }
];
const activities = [
  { synthetic: true, activityId: id, facultyId: a, facultyDisplayName: 'Avery Testwell', category: 'clinical_day', label: 'Synthetic day', startDate: '2027-01-12', endDate: '2027-01-12', timeStatus: 'not_provided', version: '0000000000000001', ucid: 'private', email: 'private@example.test', purpose: 'private' },
  { synthetic: true, activityId: 'c2222222-2222-4222-8222-222222222222', facultyId: b, facultyDisplayName: 'Blair Sampleton', category: 'clinical_day', label: 'Other', startDate: '2027-01-13', endDate: '2027-01-13', timeStatus: 'not_provided', version: '0000000000000001', purpose: 'private' }
];
function database({ rows = activities, keys = mappings, projectId = 'vista-teaching-lab', databaseId = '(default)' } = {}) {
  return { projectId, databaseId, collection(name) {
    if (name === 'paws_testing_users') return { doc(uid) { return { async get() { const p = profiles[uid]; return { exists: Boolean(p), data: () => ({ ...p, synthetic: true, role: p.baseRole }) }; } }; } };
    let data = name === 'paws_testing_calendar_activities' ? rows : name === 'paws_testing_activity_keys' ? keys : null;
    if (!data) throw Error('Unexpected collection');
    let fields, cap = Infinity;
    const q = { where(field, op, value) { assert.equal(op, '=='); data = data.filter(row => row[field] === value); return q; },
      select(...value) { fields = value; return q; }, limit(value) { cap = value; return q; },
      async get() { return { docs: data.slice(0, cap).map(row => ({ data: () => Object.fromEntries(fields.filter(field => Object.hasOwn(row, field)).map(field => [field, row[field]])) })) }; } };
    return q;
  } };
}
const findUser = async uid => profiles[uid] || null;
const args = { start: '2027-01-01', end: '2027-02-01', facultyKey: null, category: null, cursor: null, limit: 100, includeFacultyKeys: false };

test('Testing activity reader pins the lab default database', () => {
  assert.throws(() => createLabActivityReader({ db: database({ projectId: 'tester-teaching' }), findUser }));
  assert.throws(() => createLabActivityReader({ db: database({ databaseId: 'other' }), findUser }));
});
test('Faculty activity is limited to their own linked identity and strips private fields', async () => {
  const list = createLabActivityReader({ db: database(), findUser });
  const result = await list({ ...args, actorFirebaseUid: 'a' });
  assert.equal(result.activities.length, 1);
  assert.equal(result.activities[0].facultyKey, ka);
  assert.equal(result.activities[0].facultyDisplayName, 'Testwell, Avery');
  assert.doesNotMatch(JSON.stringify(result), /private|example\.test|b2222222/);
  await assert.rejects(list({ ...args, actorFirebaseUid: 'a', facultyKey: kb }), /scope/i);
  await assert.rejects(list({ ...args, actorFirebaseUid: 'a', includeFacultyKeys: true }), /scope/i);
});
test('admin can map keys, paginate deterministically, and never receives unselected private fields', async () => {
  const list = createLabActivityReader({ db: database(), findUser });
  const first = await list({ ...args, actorFirebaseUid: 'admin', includeFacultyKeys: true, limit: 1 });
  assert.equal(first.activities.length, 1);
  assert.equal(first.nextCursor, '2027-01-12|' + id);
  assert.deepEqual(first.facultyKeys, [{ facultyId: a, facultyKey: ka }, { facultyId: b, facultyKey: kb }]);
  const second = await list({ ...args, actorFirebaseUid: 'admin', cursor: first.nextCursor, limit: 1 });
  assert.equal(second.activities[0].facultyKey, kb);
  assert.equal(second.nextCursor, null);
  assert.doesNotMatch(JSON.stringify(first), /private|example\.test/);
});
test('activity names use the shared formatter and evidence is limited to time fields', async () => {
  const sample = { ...activities[0], facultyDisplayName: 'de la Cruz, Mary Jane', timeEvidence: [{ date: '2027-01-12', startTime: '09:00', endTime: '10:00', evidenceNote: 'private-evidence' }] };
  const list = createLabActivityReader({ db: database({ rows: [sample] }), findUser });
  const result = await list({ ...args, actorFirebaseUid: 'admin' });
  assert.equal(result.activities[0].facultyDisplayName, 'de la Cruz, Mary Jane');
  assert.deepEqual(result.activities[0].timeEvidence, [{ date: '2027-01-12', startTime: '09:00', endTime: '10:00' }]);
  assert.doesNotMatch(JSON.stringify(result), /private-evidence/);
});
test('unmarked data, duplicate mappings, excessive rows and inactive profiles fail closed', async () => {
  await assert.rejects(createLabActivityReader({ db: database({ rows: [{ ...activities[0], synthetic: false }] }), findUser })({ ...args, actorFirebaseUid: 'admin' }), /synthetic/i);
  await assert.rejects(createLabActivityReader({ db: database({ keys: [...mappings, mappings[0]] }), findUser })({ ...args, actorFirebaseUid: 'admin' }), /mapping/i);
  await assert.rejects(createLabActivityReader({ db: database({ rows: Array(10001).fill(activities[0]) }), findUser })({ ...args, actorFirebaseUid: 'admin' }), /limit/i);
  await assert.rejects(createLabActivityReader({ db: database(), findUser: async () => ({ ...profiles.a, active: false }) })({ ...args, actorFirebaseUid: 'a' }), /scope/i);
  await assert.rejects(createLabActivityReader({ db: database({ keys: [{ ...mappings[0], facultyKey: b }, mappings[1]] }), findUser })({ ...args, actorFirebaseUid: 'admin' }), /mapping/i);
  let reads = 0;
  await assert.rejects(createLabActivityReader({ db: database(), findUser: async () => ++reads === 1 ? profiles.a : { ...profiles.a, active: false } })({ ...args, actorFirebaseUid: 'a' }), /scope/i);
});
test('authenticated Testing route enforces Faculty scope and rejects duplicates and writes', async () => {
  const runtime = createLabReadRuntime({ db: database(), verifyIdToken: async () => ({ uid: 'a', aud: 'paws-testing-ucvm-20261022', iss: 'https://securetoken.google.com/paws-testing-ucvm-20261022' }) });
  const request = (suffix, method = 'GET', token = true) => new Request('https://testing.invalid/api/v1/calendar-activities' + suffix, { method, headers: token ? { authorization: 'Bearer token' } : {} });
  assert.equal((await runtime(request('?start=2027-01-01&end=2027-02-01', 'GET', false))).status, 401);
  const result = await runtime(request('?start=2027-01-01&end=2027-02-01'));
  assert.equal(result.status, 200);
  assert.equal(result.jsonBody.activities.length, 1);
  assert.doesNotMatch(JSON.stringify(result.jsonBody), /private|example\.test|b2222222/);
  assert.equal((await runtime(request('?start=2027-01-01&start=2027-01-02&end=2027-02-01'))).status, 400);
  assert.equal((await runtime(request('?start=2027-01-01&end=2027-02-01', 'POST'))).status, 405);
});
