'use strict';
const { isDeepStrictEqual } = require('node:util');
const { testingFixtures } = require('./firestore-seed');
const FACULTY_UIDS = new Set(testingFixtures().filter(row => row.collection === 'paws_testing_users' && row.data.role === 'faculty').map(row => row.id));

// Provision only disabled synthetic Faculty accounts. Enabling accounts and
// profiles requires a separate trusted workflow; this function never modifies
// an existing identity or grants an administrator role.
async function createInactiveFacultyIdentity({ db, auth, uid, password } = {}) {
  if (!db || db.projectId !== 'vista-teaching-lab' || db.databaseId !== '(default)' || typeof db.collection !== 'function' ||
      auth?.app?.options?.projectId !== 'paws-testing-ucvm-20261022' || typeof auth.createUser !== 'function') {
    throw new Error('Testing identity target rejected');
  }
  if (!FACULTY_UIDS.has(uid) || typeof password !== 'string' || password.length < 16 || password.length > 128) {
    throw new Error('Testing identity input rejected');
  }
  const fixture = testingFixtures().find(row => row.collection === 'paws_testing_users' && row.id === uid);
  const snapshot = await db.collection('paws_testing_users').doc(uid).get();
  if (!snapshot.exists || !isDeepStrictEqual(snapshot.data(), fixture.data)) throw new Error('Testing identity profile rejected');
  try {
    const result = await auth.createUser({ uid, email: fixture.data.email, password, displayName: `${fixture.data.lastName}, ${fixture.data.firstName}`, disabled: true });
    if (result.uid !== uid || result.email !== fixture.data.email || result.disabled !== true) throw new Error('Identity result mismatch');
    return { uid, status: 'disabled' };
  } catch (_) {
    throw new Error('Testing identity creation failed');
  }
}

// Preparing a disabled synthetic Owner is not account activation. Creation
// requires an exact inactive fixture in the isolated Testing collection.
async function createInactiveOwnerIdentity({ db, auth, password } = {}) {
  const uid = 'paws-synthetic-owner';
  const fixture = testingFixtures().find(row => row.collection === 'paws_testing_users' && row.id === uid);
  if (!db || db.projectId !== 'vista-teaching-lab' || db.databaseId !== '(default)' || typeof db.collection !== 'function' ||
      auth?.app?.options?.projectId !== 'paws-testing-ucvm-20261022' || typeof auth.createUser !== 'function' ||
      typeof password !== 'string' || password.length < 20 || password.length > 128 ||
      fixture?.data.role !== 'owner' || fixture.data.active !== false) throw Error('Testing Owner identity target rejected');
  const snapshot = await db.collection('paws_testing_users').doc(uid).get();
  if (!snapshot.exists || !isDeepStrictEqual(snapshot.data(), fixture.data)) throw Error('Testing Owner profile rejected');
  try {
    const result = await auth.createUser({ uid, email:fixture.data.email, password,
      displayName:'Owner, Synthetic', disabled:true });
    if (result.uid !== uid || result.email !== fixture.data.email || result.disabled !== true) throw Error('Testing Owner identity result rejected');
    return { uid, status:'disabled' };
  } catch (_) { throw Error('Testing Owner identity creation failed'); }
}

module.exports = { createInactiveFacultyIdentity, createInactiveOwnerIdentity };
