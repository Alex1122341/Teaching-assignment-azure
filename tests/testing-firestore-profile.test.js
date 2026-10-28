'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLabProfileReader } = require('../tools/testing/firestore-profile');
const { createDataApi } = require('../server/src/data/data-api');

function database(projectId, users = {}, databaseId = '(default)') {
  const reads = [];
  return {
    projectId, databaseId, reads,
    collection(name) {
      assert.equal(name, 'paws_testing_users');
      return { doc(id) { return { async get() {
        reads.push(id);
        return { exists: Object.hasOwn(users, id), data: () => users[id] };
      } }; } };
    }
  };
}

test('lab profile reader refuses a production or unspecified Firestore project', () => {
  for (const id of ['tester-teaching', 'paws-testing-ucvm-20261022', undefined]) {
    assert.throws(() => createLabProfileReader({ db: database(id) }));
  }
  assert.throws(() => createLabProfileReader({ db: database('vista-teaching-lab', {}, 'other') }));
});

test('lab profile reader maps only the signed-in user profile and preserves security gates', async () => {
  const db = database('vista-teaching-lab', { u1: { synthetic: true, name: 'Example User', email: 'u@example.test', role: 'faculty', facultyId: 'fac-001', active: true, mustChangePassword: false, ucid: 'private', doe: 123 }, unmarked: { role: 'owner', active: true, mustChangePassword: false } });
  const read = createLabProfileReader({ db });
  const profile = await read('u1');
  assert.deepEqual(profile, { firebaseUid: 'u1', displayName: 'User, Example', email: 'u@example.test', baseRole: 'faculty', facultyId: 'fac-001', active: true, mustChangePassword: false });
  assert.deepEqual(db.reads, ['u1']);
  assert.equal(await read('missing'), null);
  assert.equal(await read('unmarked'), null);
  await assert.rejects(read('../other'));
  await assert.rejects(read('..'));
});

test('lab profile display uses the shared name formatter and respects structured names', async () => {
  const db = database('vista-teaching-lab', {
    structured: { synthetic: true, firstName: 'Mary Jane', lastName: 'de la Cruz', name: 'Mary Jane de la Cruz' },
    formatted: { synthetic: true, name: 'de la Cruz, Mary Jane' },
    placeholder: { synthetic: true, name: 'TBD' }
  });
  const read = createLabProfileReader({ db });
  assert.equal((await read('structured')).displayName, 'de la Cruz, Mary Jane');
  assert.equal((await read('formatted')).displayName, 'de la Cruz, Mary Jane');
  assert.equal((await read('placeholder')).displayName, 'TBD');
  const names = require('../server/src/domain/person-name');
  assert.equal(names.format((await read('structured')).displayName), 'de la Cruz, Mary Jane');
  assert.equal(names.formatList('de la Cruz, Mary Jane; TBD'), 'de la Cruz, Mary Jane; TBD');
});

test('existing API rejects inactive, incomplete, and unknown-role lab profiles', async () => {
  const db = database('vista-teaching-lab', {
    active: { synthetic: true, name: 'Example User', role: 'faculty', facultyId: 'fac-001', active: true, mustChangePassword: false },
    inactive: { synthetic: true, role: 'administrator', active: false, mustChangePassword: false },
    noFlag: { synthetic: true, role: 'administrator', active: true },
    unknown: { synthetic: true, role: 'unrecognized', active: true, mustChangePassword: false }
  });
  const read = createLabProfileReader({ db });
  for (const [uid, status] of [['active', 200], ['inactive', 403], ['noFlag', 403], ['unknown', 403]]) {
    const api = createDataApi({ verifyToken: async () => ({ uid }), findUser: read, listSessions: async () => [] });
    assert.equal((await api.currentUser('test-token')).status, status, uid);
  }
});
