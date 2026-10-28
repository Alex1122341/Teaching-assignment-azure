'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { testingFixtures, createTestingSeed } = require('../tools/testing/firestore-seed');

function fakeDb({ projectId = 'vista-teaching-lab', databaseId = '(default)', existing = [] } = {}) {
  const writes = [];
  const db = {
    projectId, databaseId, writes,
    collection(name) { return { doc(id) { return { path: `${name}/${id}` }; } }; },
    async runTransaction(fn) {
      const pending = [];
      const result = await fn({
        async getAll(...refs) { return refs.map(ref => ({ exists: existing.includes(ref.path) })); },
        create(ref, data) { pending.push({ path: ref.path, data }); }
      });
      writes.push(...pending);
      return result;
    }
  };
  return db;
}

test('Testing seed contains only marked synthetic accounts and sessions', () => {
  const fixtures = testingFixtures();
  assert.ok(fixtures.length >= 5);
  assert.equal(new Set(fixtures.map(x => `${x.collection}/${x.id}`)).size, fixtures.length);
  for (const row of fixtures) {
    assert.ok(['paws_testing_users', 'paws_testing_sessions', 'paws_testing_leadership', 'paws_testing_ccc', 'paws_testing_activity_keys', 'paws_testing_calendar_activities'].includes(row.collection));
    assert.equal(row.data.synthetic, true);
    if (row.collection === 'paws_testing_users') {
      assert.match(row.data.email, /@example\.test$/);
      assert.equal(row.data.active, false, 'profiles must remain inactive until Testing Auth identities are verified');
    }
  }
  assert.ok(fixtures.some(x => x.collection === 'paws_testing_sessions' && x.data.facultyIds.length > 1));
  assert.deepEqual(fixtures.filter(x => x.collection === 'paws_testing_leadership').map(x => x.data.roleType).sort(), ['HICC', 'VISC']);
  assert.ok(fixtures.some(x => x.collection === 'paws_testing_ccc'));
  assert.equal(fixtures.filter(x => x.collection === 'paws_testing_activity_keys').length, 2);
  assert.equal(fixtures.filter(x => x.collection === 'paws_testing_calendar_activities').length, 2);
});

test('Testing seed pins the lab project and creates its fixture atomically', async () => {
  assert.throws(() => createTestingSeed({ db: fakeDb({ projectId: 'tester-teaching' }) }), /project/i);
  assert.throws(() => createTestingSeed({ db: fakeDb({ databaseId: 'another-database' }) }), /project/i);
  const db = fakeDb();
  const result = await createTestingSeed({ db })();
  assert.equal(db.writes.length, testingFixtures().length);
  assert.equal(result.created, db.writes.length);
});

test('a collision prevents every seed write without changing existing data', async () => {
  const fixture = testingFixtures()[0];
  const db = fakeDb({ existing: [`${fixture.collection}/${fixture.id}`] });
  await assert.rejects(createTestingSeed({ db })(), /already exists/i);
  assert.equal(db.writes.length, 0);
});
