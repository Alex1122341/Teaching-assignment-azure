'use strict';
const MAX_ROWS = 10000;
const FIELDS = ['synthetic', 'roleType', 'courseCode', 'recordedScope', 'facultyFirstName', 'facultyLastName', 'facultyName', 'facultyKey', 'hasSchedule', 'periodsJson', 'effectiveDate', 'expirationDate'];

function createLabLeadershipReader({ db } = {}) {
  if (!db || db.projectId !== 'vista-teaching-lab' || db.databaseId !== '(default)' || typeof db.collection !== 'function') {
    throw new Error('Testing Firestore project rejected');
  }
  return async function list({ academicYear } = {}) {
    if (typeof academicYear !== 'string' || !/^\d{4}-\d{2}$/.test(academicYear)) throw new Error('Invalid academic year');
    const snapshot = await db.collection('paws_testing_leadership').where('academicYear', '==', academicYear).select(...FIELDS).limit(MAX_ROWS + 1).get();
    if (snapshot.docs.length > MAX_ROWS) throw new Error('Testing leadership limit exceeded');
    return snapshot.docs.map(doc => {
      const data = doc.data();
      if (data.synthetic !== true) throw new Error('Non-synthetic Testing leadership rejected');
      const { synthetic, ...row } = data;
      return row;
    });
  };
}
module.exports = { createLabLeadershipReader };
