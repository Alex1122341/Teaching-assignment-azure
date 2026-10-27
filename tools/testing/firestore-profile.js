'use strict';
// Testing-only profile adapter. The caller must verify the Firebase ID token
// before supplying its UID; this reader is not an authentication mechanism.
const names = require('../../server/src/domain/person-name');
const LAB_PROJECT = 'vista-teaching-lab';

function createLabProfileReader({ db } = {}) {
  if (!db || db.projectId !== LAB_PROJECT || typeof db.collection !== 'function') {
    throw new Error('Testing Firestore project rejected');
  }
  return async function findByUid(uid) {
    if (typeof uid !== 'string' || !uid || uid === '.' || uid === '..' || uid.length > 128 || /[\/\x00-\x1f]/.test(uid) || /^__.*__$/.test(uid)) {
      throw new Error('Invalid Firebase UID');
    }
    const snapshot = await db.collection('users').doc(uid).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data();
    if (!data || typeof data !== 'object') return null;
    return {
      firebaseUid: uid,
      displayName: names.format({
        preferredFirstName: typeof data.preferredFirstName === 'string' ? data.preferredFirstName : '',
        preferredLastName: typeof data.preferredLastName === 'string' ? data.preferredLastName : '',
        firstName: typeof data.firstName === 'string' ? data.firstName : '',
        lastName: typeof data.lastName === 'string' ? data.lastName : '',
        name: typeof data.name === 'string' ? data.name : ''
      }),
      email: typeof data.email === 'string' ? data.email : null,
      baseRole: typeof data.role === 'string' ? data.role : '',
      facultyId: typeof data.facultyId === 'string' ? data.facultyId : null,
      active: data.active === true,
      mustChangePassword: data.mustChangePassword !== false
    };
  };
}
module.exports = { createLabProfileReader };
