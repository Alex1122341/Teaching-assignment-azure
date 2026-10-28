'use strict';

// Small synthetic bootstrap fixture for the unpublished read slices. It does
// not create Auth accounts, reset data, or provide full Beta parity.
function testingFixtures() {
  const first = 'a1111111-1111-4111-8111-111111111111';
  const second = 'b2222222-2222-4222-8222-222222222222';
  const user = (id, role, facultyId, firstName, lastName) => ({
    collection: 'paws_testing_users', id,
    data: { synthetic: true, role, facultyId, firstName, lastName, email: `${id}@example.test`, active: false, mustChangePassword: true }
  });
  const session = (id, date, course, facultyIds, assignments) => ({
    collection: 'paws_testing_sessions', id,
    data: { synthetic: true, academicYear: '2026-27', year: 2, course, courseName: 'Synthetic teaching', topic: 'Synthetic session', type: 'LAB', date, start: '09:00', end: '10:00', timeUnknown: false, room: 'TEST ROOM', facultyIds, instructorNames: assignments.map(x => x.name), assignments }
  });
  const a = { facultyId: first, name: 'Testwell, Avery', role: 'Lead', ucid: 'SYN100001' };
  const b = { facultyId: second, name: 'Sampleton, Blair', role: 'Instructor', ucid: 'SYN100002' };
  return [
    user('paws-synthetic-owner', 'owner', null, 'Synthetic', 'Owner'),
    user('paws-synthetic-faculty-a', 'faculty', first, 'Avery', 'Testwell'),
    user('paws-synthetic-faculty-b', 'faculty', second, 'Blair', 'Sampleton'),
    session('c1111111-1111-4111-8111-111111111111', '2027-01-12', 'VTMD 206', [first], [a]),
    session('c2222222-2222-4222-8222-222222222222', '2027-01-13', 'VTMD 213', [first, second], [a, b]),
    session('c3333333-3333-4333-8333-333333333333', '2027-01-14', 'VTMD 304', [second], [b]),
    { collection: 'paws_testing_leadership', id: 'synthetic-hicc', data: { synthetic: true, academicYear: '2026-27', roleType: 'HICC', courseCode: 'VTMD 206', facultyFirstName: 'Avery', facultyLastName: 'Testwell', facultyKey: first, hasSchedule: false, effectiveDate: '2026-05-01', expirationDate: '2027-04-30' } },
    { collection: 'paws_testing_leadership', id: 'synthetic-visc', data: { synthetic: true, academicYear: '2026-27', roleType: 'VISC', recordedScope: 'Synthetic clinical skills', facultyFirstName: 'Blair', facultyLastName: 'Sampleton', facultyKey: second, hasSchedule: false, effectiveDate: '2026-05-01', expirationDate: '2027-04-30' } },
    { collection: 'paws_testing_ccc', id: 'synthetic-ccc', data: { synthetic: true, academicYear: '2026-27', date: '2027-01-15', endDate: '2027-01-15', facultyName: 'Testwell, Avery', courseCode: 'VTMD 206', blockLabel: 'Synthetic CCC', halfDay: false } },
    { collection: 'paws_testing_activity_keys', id: 'synthetic-faculty-a', data: { synthetic: true, facultyId: first, facultyKey: 'd1111111-1111-4111-8111-111111111111', active: true } },
    { collection: 'paws_testing_activity_keys', id: 'synthetic-faculty-b', data: { synthetic: true, facultyId: second, facultyKey: 'd2222222-2222-4222-8222-222222222222', active: true } },
    { collection: 'paws_testing_calendar_activities', id: 'synthetic-activity-a', data: { synthetic: true, activityId: 'e1111111-1111-4111-8111-111111111111', facultyId: first, facultyDisplayName: 'Avery Testwell', category: 'clinical_day', label: 'Synthetic clinical day', startDate: '2027-01-12', endDate: '2027-01-12', timeStatus: 'not_provided', version: '0000000000000001' } },
    { collection: 'paws_testing_calendar_activities', id: 'synthetic-activity-b', data: { synthetic: true, activityId: 'e2222222-2222-4222-8222-222222222222', facultyId: second, facultyDisplayName: 'Blair Sampleton', category: 'rotation_participant', label: 'Synthetic rotation', startDate: '2027-01-13', endDate: '2027-01-14', timeStatus: 'not_provided', version: '0000000000000001' } }
  ];
}

function createTestingSeed({ db } = {}) {
  if (!db || db.projectId !== 'vista-teaching-lab' || db.databaseId !== '(default)' || typeof db.collection !== 'function' || typeof db.runTransaction !== 'function') {
    throw new Error('Testing Firestore project rejected');
  }
  return async function seed() {
    const entries = testingFixtures().map(entry => ({ ...entry, ref: db.collection(entry.collection).doc(entry.id) }));
    await db.runTransaction(async transaction => {
      const existing = await transaction.getAll(...entries.map(entry => entry.ref));
      if (existing.some(snapshot => snapshot.exists)) throw new Error('Testing seed document already exists');
      for (const entry of entries) transaction.create(entry.ref, entry.data);
    });
    return { created: entries.length };
  };
}

module.exports = { testingFixtures, createTestingSeed };
