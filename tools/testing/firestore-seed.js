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
  const entries = [
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

  // A deterministic, self-contained 2026-27 teaching timetable. These are
  // wholly fictional people, identities, appointments, rooms and session
  // subjects; the actual VTMD course codes are not confidential.
  // Keep this fixture below Firestore's 500-write transaction limit.
  const courses = ['VTMD 213', 'VTMD 215', 'VTMD 304', 'VTMD 306',
    'VTMD 319', 'VTMD 422', 'VTMD 505', 'CPIII 501'];
  for (const code of courses) entries.push({
    collection: 'paws_testing_courses', id: code.replaceAll(' ', '-').toLowerCase(),
    data: { synthetic: true, code, name: 'Synthetic course ' + code, academicYear: '2026-27', active: true }
  });
  const facultyIds = [];
  for (let i = 0; i < 31; i++) {
    const suffix = String(i + 1).padStart(2, '0');
    const facultyId = i === 0 ? first : i === 1 ? second
      : 'f' + String(i + 1).padStart(7, '0') + '-0000-4000-8000-' + String(i + 1).padStart(12, '0');
    facultyIds.push(facultyId);
    const firstName = i === 0 ? 'Avery' : i === 1 ? 'Blair' : 'Sample' + suffix;
    const lastName = i === 0 ? 'Testwell' : i === 1 ? 'Sampleton' : 'Faculty' + suffix;
    const active = i < 29;
    entries.push({
      collection: 'paws_testing_faculty', id: facultyId,
      data: { synthetic: true, facultyId, firstName, lastName, displayName: lastName + ', ' + firstName,
        email: 'paws-faculty-' + suffix + '@example.test', rank: ['Professor', 'Associate Professor', 'Assistant Professor', 'Instructor'][i % 4],
        stream: ['Teaching', 'Clinical', 'Research'][i % 3], fte: i % 7 === 0 ? 0.5 : 1, active, academicYear: '2026-27' }
    });
    if (i >= 2) entries.push(user('paws-synthetic-faculty-' + suffix, 'faculty', facultyId, firstName, lastName));
  }
  for (let i = 0; i < 300; i++) {
    const block = Math.floor(i / 3);
    const sessionDate = new Date(Date.UTC(2026, 8, 1) + block * 86400000).toISOString().slice(0, 10);
    const hour = 8 + i % 3;
    const course = courses[block % courses.length];
    const teacherIndex = block % 29;
    const instructor = teacherIndex === 0 ? 'Testwell, Avery' : teacherIndex === 1 ? 'Sampleton, Blair'
      : 'Faculty' + String(teacherIndex + 1).padStart(2, '0') + ', Sample' + String(teacherIndex + 1).padStart(2, '0');
    const sessionId = 'c' + String(i + 10).padStart(7, '0') + '-0000-4000-8000-' + String(i + 10).padStart(12, '0');
    const row = session(sessionId, sessionDate, course, [facultyIds[teacherIndex]],
      [{ facultyId: facultyIds[teacherIndex], name: instructor, role: 'Instructor' }]);
    row.data.start = String(hour).padStart(2, '0') + ':00';
    row.data.end = String(hour + 1).padStart(2, '0') + ':00';
    row.data.topic = 'Synthetic LAB group ' + String(block + 1).padStart(3, '0');
    row.data.room = 'SYNTHETIC LAB ' + String(block % 8 + 1);
    row.data.year = block % 4 + 1;
    entries.push(row);
  }
  // One deliberate overlap for Calendar conflict detection.
  for (const [id, code] of [['c9000001-0000-4000-8000-000000000001', 'VTMD 304'],
    ['c9000002-0000-4000-8000-000000000002', 'VTMD 306']]) {
    const row = session(id, '2026-11-24', code, [first], [a]);
    row.data.topic = 'Synthetic double-booked instructor';
    row.data.start = '10:00'; row.data.end = '11:00';
    entries.push(row);
  }
  if (entries.length > 500) throw Error('Testing seed exceeds Firestore transaction write limit');
  return entries;
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
