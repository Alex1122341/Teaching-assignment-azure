'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sourceFunction = require('../test-support/source-function.js');

const root = repositoryPath(__dirname, '..');
const read = file => fs.readFileSync(repositoryPath(root, file), 'utf8');

function retryDecision(outcome, attempt, sameUser) {
  const src = sourceFunction('timetable.js', 'shouldAutoRetryAccess');
  const context = vm.createContext({ outcome, attempt, sameUser, Boolean });
  return vm.runInContext(`(()=>{${src}\nreturn shouldAutoRetryAccess(outcome, attempt, sameUser)})()`, context);
}

test('mobile recovery retries exactly the first recoverable access failure', () => {
  assert.equal(retryDecision({ recoverable: true }, 0, true), true);
  assert.equal(retryDecision({ recoverable: true }, 1, true), false);
  assert.equal(retryDecision({ recoverable: true }, 2, true), false);
});

test('authorization and reauth failures never auto-retry', () => {
  assert.equal(retryDecision({ recoverable: false }, 0, true), false);
  assert.equal(retryDecision({ recoverable: false }, 1, true), false);
});

test('auto-retry is cancelled if the Firebase user is no longer current', () => {
  assert.equal(retryDecision({ recoverable: true }, 0, false), false);
});
test('bootstrap auto-retry stays inside the existing Firebase session and never reloads the page', () => {
  const source = read('timetable.js');
  const start = source.indexOf('async function bootstrapForUser');
  assert.notEqual(start, -1);
  const end = source.indexOf('\n      auth.onAuthStateChanged', start);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /classifyAuthError/);
  assert.match(body, /shouldAutoRetryAccess/);
  assert.match(body, /bootstrapForUser\(user,[\s\S]*recoveryAttempt\s*\+\s*1/);
  assert.doesNotMatch(body, /location\.reload|location\.replace|window\.location/);
  assert.doesNotMatch(body, /signOut\(/);
});

test('second transient failure falls through to the existing bounded Retry access UI', () => {
  const source = read('timetable.js');
  const start = source.indexOf('async function bootstrapForUser');
  const end = source.indexOf('\n      auth.onAuthStateChanged', start);
  const body = source.slice(start, end);
  const autoRetry = body.indexOf('shouldAutoRetryAccess');
  const terminal = body.indexOf('applyAccessFailure', autoRetry);
  assert.ok(autoRetry >= 0 && terminal > autoRetry);
  assert.match(body.slice(terminal), /setRecovery:\s*setAccessRecovery/);
  assert.match(body.slice(terminal), /retryAccess:/);
});

test('data client still has no generic 5xx or POST retry loop', () => {
  const source = read('paws-data-client.js');
  assert.doesNotMatch(source, /setInterval/);
  assert.doesNotMatch(source, /while\s*\(\s*true\s*\)/);
});
test('automatic retry uses one bounded delay and rechecks the signed-in user', () => {
  const source = read('timetable.js');
  const start = source.indexOf('async function bootstrapForUser');
  const end = source.indexOf('\n      auth.onAuthStateChanged', start);
  const body = source.slice(start, end);
  assert.match(source, /function waitForAccessRetry/);
  assert.match(body, /await waitForAccessRetry\(\)/);
  assert.match(body, /auth\?\.currentUser[\s\S]*auth\.currentUser\.uid===user\.uid/);
  assert.doesNotMatch(body, /setInterval|while\s*\(/);
});