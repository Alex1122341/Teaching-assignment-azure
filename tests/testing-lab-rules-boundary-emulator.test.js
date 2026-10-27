'use strict';

// Explicit opt-in: exercise a supplied lab ruleset against synthetic emulator
// data only. This is independent of the Admin SDK read-runtime test, which
// intentionally bypasses Firestore Security Rules.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const enabled = process.env.PAWS_LAB_RULES_TEST === '1';
const check = (name, fn) => test(name, { skip: !enabled }, fn);

check('lab rules deny other-project identities and other faculty private sessions', async t => {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  assert.ok(process.env.PAWS_LAB_RULES_FILE, 'Supply the rules file to audit');
  const rules = fs.readFileSync(process.env.PAWS_LAB_RULES_FILE, 'utf8');
  const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
  const { doc, setDoc, getDoc } = require('firebase/firestore');
  const admin = createRequire(path.resolve(__dirname, '../server/package.json'))('firebase-admin');
  const lab = await initializeTestEnvironment({ projectId: 'vista-teaching-lab', firestore: { rules } });
  const authApp = admin.initializeApp({ projectId: 'paws-testing-ucvm-20261022' }, 'rules-boundary-emulator');
  try {
    const uid = 'synthetic-boundary-faculty';
    const email = 'synthetic-boundary-faculty@example.test';
    const password = 'Emulator-only-pass-2026';
    await authApp.auth().createUser({ uid, email, password });
    await lab.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, `users/${uid}`), { active: true, role: 'faculty', facultyId: 'synthetic-f1', mustChangePassword: false });
      await setDoc(doc(db, 'users/synthetic-admin'), { active: true, role: 'administrator', mustChangePassword: false });
      for (const role of ['editor', 'viewer']) {
        await setDoc(doc(db, `users/synthetic-${role}`), { active: true, role, facultyId: 'synthetic-f1', mustChangePassword: false });
      }
      await setDoc(doc(db, 'sessions/synthetic-other'), { facultyIds: ['synthetic-f2'], assignments: [{ ucid: 'synthetic-private', doeCredit: 1 }] });
      await setDoc(doc(db, 'sessions/synthetic-shared'), { facultyIds: ['synthetic-f1', 'synthetic-f2'], assignments: [{ ucid: 'synthetic-f1', doeCredit: 1 }, { ucid: 'synthetic-private', doeCredit: 2 }] });
      await setDoc(doc(db, 'calendar_sessions/synthetic-other'), { sessionId: 'synthetic-other', course: 'VETM 301' });
      await setDoc(doc(db, `paws_testing_users/${uid}`), { active: true, role: 'faculty', facultyId: 'synthetic-f1' });
      await setDoc(doc(db, 'paws_testing_sessions/synthetic-one'), { facultyIds: ['synthetic-f1'], assignments: [{ ucid: 'synthetic-private' }] });
    });
    const login = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    assert.equal(login.status, 200);
    const { idToken } = await login.json();
    await t.test('a PAWS Testing token cannot reuse a matching lab UID', async () => {
      const response = await fetch('http://127.0.0.1:8080/v1/projects/vista-teaching-lab/databases/(default)/documents/sessions/synthetic-other', {
        headers: { authorization: `Bearer ${idToken}` }
      });
      assert.equal(response.status, 403, 'another Firebase project must not gain lab access');
    });
    await t.test('a lab faculty user can read the sanitized calendar', async () => {
      const db = lab.authenticatedContext(uid, { aud: 'vista-teaching-lab' }).firestore();
      assert.equal((await getDoc(doc(db, 'calendar_sessions/synthetic-other'))).exists(), true);
    });
    await t.test('an authorized lab administrator can read raw sessions', async () => {
      const db = lab.authenticatedContext('synthetic-admin', { aud: 'vista-teaching-lab' }).firestore();
      assert.equal((await getDoc(doc(db, 'sessions/synthetic-other'))).exists(), true);
    });
    await t.test('an unauthenticated user cannot read the calendar or a raw session', async () => {
      const db = lab.unauthenticatedContext().firestore();
      for (const name of ['calendar_sessions/synthetic-other', 'sessions/synthetic-other']) {
        await assert.rejects(getDoc(doc(db, name)), error => error.code === 'permission-denied');
      }
    });
    await t.test('Testing collections cannot be read directly by a browser identity', async () => {
      const db = lab.authenticatedContext(uid, { aud: 'vista-teaching-lab' }).firestore();
      for (const name of [`paws_testing_users/${uid}`, 'paws_testing_sessions/synthetic-one']) {
        await assert.rejects(getDoc(doc(db, name)), error => error.code === 'permission-denied');
        const response = await fetch(`http://127.0.0.1:8080/v1/projects/vista-teaching-lab/databases/(default)/documents/${name}`, {
          headers: { authorization: `Bearer ${idToken}` }
        });
        assert.equal(response.status, 403);
      }
    });
    await t.test('a lab faculty user cannot read another faculty private session', async () => {
      const db = lab.authenticatedContext(uid, { aud: 'vista-teaching-lab' }).firestore();
      await assert.rejects(getDoc(doc(db, 'sessions/synthetic-other')), error => error.code === 'permission-denied');
    });
    await t.test('a shared session does not expose another faculty assignment', async () => {
      const db = lab.authenticatedContext(uid, { aud: 'vista-teaching-lab' }).firestore();
      await assert.rejects(getDoc(doc(db, 'sessions/synthetic-shared')), error => error.code === 'permission-denied');
    });
    await t.test('legacy faculty-compatible roles cannot read other faculty private sessions', async t => {
      for (const role of ['editor', 'viewer']) {
        await t.test(role, async () => {
          const db = lab.authenticatedContext(`synthetic-${role}`, { aud: 'vista-teaching-lab' }).firestore();
          await assert.rejects(getDoc(doc(db, 'sessions/synthetic-other')), error => error.code === 'permission-denied');
        });
      }
    });
  } finally {
    await Promise.all([lab.cleanup(), authApp.delete()]);
  }
});
