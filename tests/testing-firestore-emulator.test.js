'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const { createLabReadRuntime } = require('../tools/testing/firestore-read-runtime');
const { startTestingHttpServer } = require('../tools/testing/firestore-http');
const { testingFixtures, createTestingSeed } = require('../tools/testing/firestore-seed');
const { createLabCalendarReader } = require('../tools/testing/firestore-calendar');
const { createInactiveFacultyIdentity } = require('../tools/testing/firestore-identities');

test('lab read runtime verifies Testing emulator identity and scopes Firestore data', { skip: process.env.PAWS_LAB_EMULATOR_TEST !== '1' }, async () => {
  // Refuse every non-loopback target before creating the Admin SDK client.
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  const serverRequire = createRequire(path.resolve(__dirname, '../server/package.json'));
  const admin = serverRequire('firebase-admin');
  const authApp = admin.initializeApp({ projectId: 'paws-testing-ucvm-20261022' }, 'testing-auth-emulator');
  const dbApp = admin.initializeApp({ projectId: 'vista-teaching-lab' }, 'testing-data-emulator');
  try {
    const auth = authApp.auth();
    const db = dbApp.firestore();
    const email = 'paws-emulator-faculty@example.test';
    const password = 'Emulator-only-pass-2026';
    const uid = 'paws-emulator-faculty';
    await auth.createUser({ uid, email, password });
    await db.collection('paws_testing_users').doc(uid).set({ synthetic: true, name: 'Test Faculty', role: 'faculty', facultyId: 'synthetic-f1', active: true, mustChangePassword: false });
    await db.collection('paws_testing_sessions').doc('paws-emulator-1').set({ synthetic: true, date: '2027-01-12', course: 'VETM 301', year: 2, type: 'LAB', academicYear: '2026-27', facultyIds: ['synthetic-f1'], instructorNames: ['Test Faculty'], assignments: [{ facultyId: 'synthetic-f1', ucid: 'not-for-client', doeCredit: 123 }] });
    await db.collection('paws_testing_sessions').doc('paws-emulator-2').set({ synthetic: true, date: '2027-01-13', facultyIds: ['synthetic-f2'] });
    await db.collection('paws_testing_leadership').doc('paws-emulator-role').set({ synthetic: true, academicYear: '2026-27', roleType: 'HICC', courseCode: 'VETM 301', facultyFirstName: 'Test', facultyLastName: 'Faculty', facultyKey: 'synthetic-f1', effectiveDate: '2026-05-01', ucid: 'not-for-client', doe: 123 });
    await db.collection('paws_testing_ccc').doc('paws-emulator-ccc').set({ synthetic: true, academicYear: '2026-27', date: '2027-01-15', endDate: '2027-01-15', facultyName: 'Test Faculty', courseCode: 'VETM 301', blockLabel: 'Synthetic CCC', halfDay: false, purpose: 'not-for-client', ucid: 'not-for-client' });
    const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    assert.equal(response.status, 200);
    const { idToken } = await response.json();
    const runtime = createLabReadRuntime({ db, verifyIdToken: token => auth.verifyIdToken(token) });
    const result = await runtime(new Request('https://testing.invalid/api/v1/sessions?start=2027-01-01&end=2027-02-01', { headers: { authorization: 'Bearer ' + idToken } }));
    assert.equal(result.status, 200);
    assert.deepEqual(result.jsonBody.sessions.map(row => row.id), ['paws-emulator-1']);
    assert.doesNotMatch(JSON.stringify(result.jsonBody), /not-for-client|doeCredit|ucid/);
    const server = await startTestingHttpServer({ runtime, port: 0 });
    try {
      const url = `http://127.0.0.1:${server.address().port}/api/v1/sessions?start=2027-01-01&end=2027-02-01`;
      assert.equal((await fetch(url)).status, 401);
      assert.equal((await fetch(url, { headers: { origin: 'https://tester-teaching.web.app', authorization: 'Bearer ' + idToken } })).status, 403);
      const response = await fetch(url, {
        headers: { origin: 'https://paws-testing-ucvm-20261022.web.app', authorization: 'Bearer ' + idToken }
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(body.sessions.map(row => row.id), ['paws-emulator-1']);
      assert.doesNotMatch(JSON.stringify(body), /not-for-client|doeCredit|ucid/);
      const directory = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/dashboard/leadership-directory?academicYear=2026-27`, {
        headers: { origin: 'https://paws-testing-ucvm-20261022.web.app', authorization: 'Bearer ' + idToken }
      });
      assert.equal(directory.status, 200);
      const directoryBody = await directory.json();
      assert.equal(directoryBody.hiccCc[0].facultyName, 'Faculty, Test');
      assert.doesNotMatch(JSON.stringify(directoryBody), /not-for-client|"ucid"|"doe"|"facultyKey"/);
      const ccc = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/ccc-schedule?academicYear=2026-27`, {
        headers: { origin: 'https://paws-testing-ucvm-20261022.web.app', authorization: 'Bearer ' + idToken }
      });
      assert.equal(ccc.status, 200);
      const cccBody = await ccc.json();
      assert.equal(cccBody.entries[0].facultyName, 'Faculty, Test');
      assert.doesNotMatch(JSON.stringify(cccBody), /not-for-client|"ucid"|"purpose"/);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  } finally {
    await Promise.all([authApp.delete(), dbApp.delete()]);
  }
});

test('synthetic Testing seed is atomic, refuses collisions and supports scoped reads', { skip: process.env.PAWS_LAB_EMULATOR_TEST !== '1' }, async () => {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  const serverRequire = createRequire(path.resolve(__dirname, '../server/package.json'));
  const admin = serverRequire('firebase-admin');
  const app = admin.initializeApp({ projectId: 'vista-teaching-lab' }, 'testing-seed-emulator');
  const authApp = admin.initializeApp({ projectId: 'paws-testing-ucvm-20261022' }, 'testing-seed-auth-emulator');
  try {
    const db = app.firestore();
    const seed = createTestingSeed({ db });
    assert.equal((await seed()).created, testingFixtures().length);
    await assert.rejects(seed(), /already exists/i);
    const first = testingFixtures().find(row => row.id === 'paws-synthetic-faculty-a').data.facultyId;
    const sessions = await createLabCalendarReader({ db })({ facultyId: first, start: '2027-01-01', end: '2027-02-01' });
    assert.equal(sessions.length, 2);
    assert.doesNotMatch(JSON.stringify(sessions), /SYN10000|ucid/);
    const uid = 'paws-synthetic-faculty-a', password = 'synthetic-password-only';
    assert.deepEqual(await createInactiveFacultyIdentity({ db, auth: authApp.auth(), uid, password }), { uid, status: 'disabled' });
    assert.equal((await authApp.auth().getUser(uid)).disabled, true);
    await assert.rejects(createInactiveFacultyIdentity({ db, auth: authApp.auth(), uid, password }), /creation failed/i);
    const profile = await db.collection('paws_testing_users').doc(uid).get();
    assert.equal(profile.data().active, false);
    const login = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: profile.data().email, password, returnSecureToken: true })
    });
    assert.equal(login.status, 400);
  } finally {
    await Promise.all([app.delete(), authApp.delete()]);
  }
});
