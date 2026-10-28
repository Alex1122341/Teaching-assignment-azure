'use strict';
const names = require('../../server/src/domain/person-name');
const { validYear } = require('../../server/src/ccc/ccc-schedule-api');
const MAX_ROWS = 2500;
const FIELDS = ['synthetic', 'date', 'endDate', 'facultyName', 'courseCode', 'blockLabel', 'halfDay'];

function createLabCccReader({ db } = {}) {
  if (!db || db.projectId !== 'vista-teaching-lab' || db.databaseId !== '(default)' || typeof db.collection !== 'function') throw new Error('Testing Firestore project rejected');
  return async function list({ academicYear } = {}) {
    if (!validYear(academicYear)) throw new Error('Invalid academic year');
    const snapshot = await db.collection('paws_testing_ccc').where('academicYear', '==', academicYear).select(...FIELDS).limit(MAX_ROWS + 1).get();
    if (snapshot.docs.length > MAX_ROWS) throw new Error('Testing CCC limit exceeded');
    return { entries: snapshot.docs.map(doc => {
      const data = doc.data();
      if (data.synthetic !== true) throw new Error('Non-synthetic Testing CCC rejected');
      const { synthetic, ...row } = data;
      return { ...row, facultyName: names.format(row.facultyName) };
    }) };
  };
}
module.exports = { createLabCccReader };
