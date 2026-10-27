'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const { createLabReadRuntime } = require('../tools/testing/firestore-read-runtime');
const { startTestingHttpServer } = require('../tools/testing/firestore-http');

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
    await db.collection('paws_testing_users').doc(uid).set({ name: 'Test Faculty', role: 'faculty', facultyId: 'synthetic-f1', active: true, mustChangePassword: false });
    await db.collection('paws_testing_sessions').doc('paws-emulator-1').set({ date: '2027-01-12', course: 'VETM 301', year: 2, type: 'LAB', academicYear: '2026-27', facultyIds: ['synthetic-f1'], instructorNames: ['Test Faculty'], assignments: [{ facultyId: 'synthetic-f1', ucid: 'not-for-client', doeCredit: 123 }] });
    await db.collection('paws_testing_sessions').doc('paws-emulator-2').set({ date: '2027-01-13', facultyIds: ['synthetic-f2'] });
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
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  } finally {
    await Promise.all([authApp.delete(), dbApp.delete()]);
  }
});
