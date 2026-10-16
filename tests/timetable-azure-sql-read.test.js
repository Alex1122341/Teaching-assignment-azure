'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('timetable.js','utf8');

test('working activity ranges use SQL outside the timed session grid and clear on logout',()=>{
  assert.doesNotMatch(src,/ccc_events|expandCccEvents|loadCccEvents|sessionsWithCcc/);
  const body=functionBody('async function renderWorkingActivities','function layoutDaySessions');
  assert.match(body,/loadRange/);assert.match(body,/renderRangeLane/);
  assert.match(body,/Working activities could not be loaded/);
  assert.match(src,/PAWS_CALENDAR_ACTIVITIES\?\.clear/);
  const html=fs.readFileSync('index.html','utf8');
  assert.match(html,/id="working-activities-lane"/);assert.match(html,/id="activity-type-filter"/);
  assert.doesNotMatch(html,/id="(?:show-working-activities|show-ccc|activity-category-filter|filter-type)"/);
  assert.ok(html.indexOf('calendar-activities.js')<html.indexOf('src="timetable.js"'));
});

test('faculty schedule uses self scope or the authorized administrator mapping and import is admin only',()=>{
  const dashboard=fs.readFileSync('faculty-admin.js','utf8');
  assert.match(dashboard,/createFacultySchedule/);
  assert.match(fs.readFileSync('calendar-activities.js','utf8'),/loadFacultyRange\(facultyId,range,\{self:isSelf\(\)\}\)/);
  assert.match(dashboard,/PAWS_ACTIVITY_IMPORT\?\.createAdminEntry/);
  assert.match(dashboard,/workImport\?\.clear/);
  assert.match(dashboard,/!selfMode && dashboardAdmin\(currentUser\)/);
});

function functionBody(name,nextName){
  const start=src.indexOf(name);
  assert.notEqual(start,-1,name);
  const end=nextName?src.indexOf(nextName,start+name.length):Math.min(src.length,start+2200);
  return src.slice(start,end<0?Math.min(src.length,start+2200):end);
}

test('login profile comes from /api/v1/me through the shared Azure data client',()=>{
  const body=functionBody('async function getRoleProfile','function isAdmin');
  assert.match(body,/UCVM_PAWS_DATA\.currentUser\(\)/);
  assert.doesNotMatch(body,/profileSnapshot|collection\(['"]users['"]\)/);
});

test('visible, range, date and all-session read helpers use Azure API only',()=>{
  const start=src.indexOf('function azureSessionRow');
  const end=src.indexOf('function invalidateAllSessions',start);
  const body=src.slice(start,end);
  assert.match(body,/UCVM_PAWS_DATA\.listSessions/);
  assert.doesNotMatch(body,/collection\(SESSION_COLLECTION\).*\.(?:get|onSnapshot)/s);
  assert.doesNotMatch(body,/sessionQueryForRange/);
});

test('timetable subscription has no Firestore fallback',()=>{
  const body=functionBody('async function subscribeSessions','function refreshSessionScope');
  assert.match(body,/fetchAzureSessions/);
  assert.match(body,/scheduleSource = sessions\.length \? 'azure-sql' : 'azure-sql-empty'/);
  assert.doesNotMatch(body,/onSnapshot|collection\(SESSION_COLLECTION\)/);
});

test('legacy viewer accounts are not treated as Faculty identities',()=>{
  assert.match(src,/function roleIsFaculty\(profile\)\{ return \['faculty','hicc','visc'\]\.includes\(String\(profile\?\.role/);
});

test('timetable creation uses gated University API routes and legacy mutation paths stay closed',()=>{
  for(const name of ['openSwapModal','performFacultySwap','initializeLiveSchedule','startSessionSelection','saveSelectedChanges','deleteSession']){
    const marker=name==='openSessionForm'?`async function ${name}(existing = null) {`:`async function ${name}`;
    const start=src.indexOf(marker);
    assert.notEqual(start,-1,name);
    const first=src.slice(start,start+260);
    assert.ok(/requireSessionWrites\(\)|future PAWS University API|PAWS University API operation|PAWS University API supports|must be handled by the PAWS University API/.test(first),`${name} must fail closed or remain capability-gated`);
  }
  assert.match(src,/sessionCreateEnabled\?\.\(\)/);
  assert.match(functionBody('async function openSessionForm','function input'),/openSqlSessionCreateForm/);
  assert.match(functionBody('async function openBulkSessionForm','function switchCalendarView'),/sessionCreateEnabled/);
  assert.match(functionBody('async function saveBulkSessions','function switchCalendarView'),/UCVM_PAWS_DATA\.createSessionBatch/);
  assert.doesNotMatch(src,/firebase\.firestore\(\)[\s\S]{0,400}SESSION_COLLECTION/);
  assert.match(src,/sessionWritesEnabled\(\)/);
});

test('existing-session edits use the server API and keep legacy Firestore mutations disabled',()=>{
 const detail=functionBody('function openSessionDetail','function openSqlSessionEditForm');
 const edit=functionBody('function openSqlSessionEditForm','function detailField');
 assert.match(detail,/sessionEditEnabled/);
 assert.match(detail,/openSqlSessionEditForm\(s\)/);
 assert.match(edit,/UCVM_PAWS_DATA\.patchSession\(session\.id,patch\)/);
 assert.doesNotMatch(edit,/db\.batch|collection\(SESSION_COLLECTION\)|firebase\.firestore/);
 assert.match(functionBody('async function openSessionForm','function input'),/sessionCreateEnabled\?\.\(\)/);
 assert.match(functionBody('async function openSessionForm','function input'),/openSqlSessionCreateForm/);
});
