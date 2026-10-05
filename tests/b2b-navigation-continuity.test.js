'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sourceFunction=require('../test-support/source-function.js');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('timetable dashboard navigation stays direct and does not carry auth material',()=>{
  const source=read('timetable.js');
  const start=source.indexOf("$('faculty-dashboard-btn').addEventListener");
  const body=source.slice(start,start+700);
  assert.match(body,/faculty-admin\.html/);
  assert.doesNotMatch(body,/token|password|authorization|uid|email|facultyId/i);
  assert.doesNotMatch(body,/sessionStorage|localStorage/);
});

test('dashboard return prefers browser history for same-origin timetable navigation with index fallback',()=>{
  const source=read('faculty-admin.js');
  const came=sourceFunction('faculty-admin.js','cameFromTimetable');
  const back=sourceFunction('faculty-admin.js','returnToTimetable');
  assert.match(came,/document\.referrer/);
  assert.match(came,/location\.origin/);
  assert.match(back,/history\.back\(\)/);
  assert.match(back,/location\.href\s*=\s*['"]index\.html['"]/);
});

test('navigation continuity never authorizes dashboard access',()=>{
  const source=read('faculty-admin.js');
  const authStart=source.indexOf('auth.onAuthStateChanged');
  const authBody=source.slice(authStart,authStart+2600);
  assert.match(authBody,/UCVM_PAWS_DATA\.currentUser\(\)/);
  assert.match(authBody,/profile\.active/);
  assert.doesNotMatch(authBody,/cameFromTimetable[^\n]{0,80}unlock\(/i);
});

test('dashboard initial gate is transition-oriented rather than a login-looking screen',()=>{
  const html=read('faculty-admin.html');
  assert.match(html,/Opening Dashboard/);
  assert.doesNotMatch(html,/Checking Firebase sign-in and administrator role/);
});

test('timetable initial gate hides sign-in actions until Firebase proves there is no saved session',()=>{
  const html=read('index.html');
  assert.match(html,/<button[^>]*class="[^"]*hidden[^"]*"[^>]*id="gate-sign-in"/);
  assert.match(html,/<button[^>]*class="[^"]*hidden[^"]*"[^>]*id="gate-auth-setup"/);
  assert.match(html,/id="gate-copy"/);
  const source=read('timetable.js');
  const authStart=source.indexOf('auth.onAuthStateChanged');
  const noUser=source.slice(source.indexOf('if (!user) {',authStart),source.indexOf('ensureRestoredLoginPerformance',authStart));
  assert.match(noUser,/showSignedOutGate\(\)/);
});

test('authenticated timetable prefetches dashboard shell only after T7 unlock',()=>{
  const source=read('timetable.js');
  const helper=sourceFunction('timetable.js','prefetchDashboardShell');
  assert.match(helper,/faculty-admin\.html/);
  assert.match(helper,/faculty-admin\.css/);
  assert.match(helper,/faculty-admin\.js/);
  assert.doesNotMatch(helper,/token|authorization|currentUser/);
  const start=source.indexOf('async function bootstrapForUser');
  const end=source.indexOf('auth.onAuthStateChanged',start);
  const body=source.slice(start,end);
  const t7=body.indexOf("markLoginStage('T7')");
  const prefetch=body.indexOf('prefetchDashboardShell()',t7);
  assert.ok(t7>=0&&prefetch>t7);
  assert.doesNotMatch(body.slice(t7,prefetch),/await\s+prefetchDashboardShell/);
});

test('dashboard navigation continuity adds no browser persistence',()=>{
  const source=read('faculty-admin.js');
  const came=sourceFunction('faculty-admin.js','cameFromTimetable');
  const back=sourceFunction('faculty-admin.js','returnToTimetable');
  assert.doesNotMatch(came+back,/sessionStorage|localStorage|indexedDB|document\.cookie/);
  assert.doesNotMatch(came+back,/token|password|authorization|uid|email|facultyId/i);
});
