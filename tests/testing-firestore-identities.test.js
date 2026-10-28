'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { testingFixtures } = require('../tools/testing/firestore-seed');
const { createInactiveFacultyIdentity } = require('../tools/testing/firestore-identities');

function setup({ authProject = 'paws-testing-ucvm-20261022', dbProject = 'vista-teaching-lab', databaseId = '(default)', data } = {}) {
  const calls = [];
  const fixture = testingFixtures().find(x => x.id === 'paws-synthetic-faculty-a');
  const db = { projectId: dbProject, databaseId, collection(name) {
    assert.equal(name, 'paws_testing_users');
    return { doc(id) { return { async get() { return { exists: id === fixture.id, data: () => data ?? fixture.data }; } }; } };
  } };
  const auth = { app: { options: { projectId: authProject } }, async createUser(input) { calls.push(input); return { uid: input.uid, email: input.email, disabled: input.disabled }; } };
  return { db, auth, calls, fixture };
}

test('only verified synthetic faculty profiles receive disabled Testing Auth identities', async () => {
  const x = setup();
  const result = await createInactiveFacultyIdentity({ db: x.db, auth: x.auth, uid: x.fixture.id, password: 'synthetic-password-only' });
  assert.deepEqual(result, { uid: x.fixture.id, status: 'disabled' });
  assert.equal(x.calls.length, 1);
  assert.equal(x.calls[0].disabled, true);
  assert.equal(x.calls[0].email, x.fixture.data.email);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-password-only/);
});

test('identity provisioning fails closed for wrong targets, privileged roles and changed profiles', async () => {
  for (const changes of [{ authProject: 'tester-teaching' }, { dbProject: 'tester-teaching' }, { databaseId: 'other' }, { data: { synthetic: true, active: true, role: 'owner' } }]) {
    const x = setup(changes);
    await assert.rejects(createInactiveFacultyIdentity({ db: x.db, auth: x.auth, uid: x.fixture.id, password: 'synthetic-password-only' }));
    assert.equal(x.calls.length, 0);
  }
  const x = setup();
  await assert.rejects(createInactiveFacultyIdentity({ db: x.db, auth: x.auth, uid: 'paws-synthetic-owner', password: 'synthetic-password-only' }));
  await assert.rejects(createInactiveFacultyIdentity({ db: x.db, auth: x.auth, uid: x.fixture.id, password: 'short' }));
  assert.equal(x.calls.length, 0);
});

test('an existing Firebase UID is never updated or reused', async () => {
  const x = setup();
  x.auth.createUser = async () => { throw Object.assign(Error('private provider details'), { code: 'auth/uid-already-exists' }); };
  await assert.rejects(createInactiveFacultyIdentity({ db: x.db, auth: x.auth, uid: x.fixture.id, password: 'synthetic-password-only' }), error => !error.message.includes('private provider details'));
});

test('all 31 synthetic Faculty identities are eligible for disabled-only provisioning; no privileged UID is', () => {
  const users = testingFixtures().filter(row => row.collection === 'paws_testing_users');
  assert.equal(users.filter(row => row.data.role === 'faculty').length, 31);
  assert.ok(users.every(row => row.data.active === false));
  assert.ok(users.every(row => row.data.email.endsWith('@example.test')));
  assert.ok(!users.some(row => row.data.role === 'faculty' && row.id === 'paws-synthetic-owner'));
});
