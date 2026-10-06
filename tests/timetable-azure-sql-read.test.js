'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('timetable.js','utf8');

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

test('all session mutation entrypoints fail closed before legacy Firestore write code',()=>{
  for(const name of ['openSwapModal','performFacultySwap','initializeLiveSchedule','startSessionSelection','saveSelectedChanges','saveBulkSessions','openBulkSessionForm','openSessionForm','deleteSession']){
    const marker=name==='openSessionForm'?`async function ${name}(existing = null) {`:`async function ${name}`;
    const start=src.indexOf(marker);
    assert.notEqual(start,-1,name);
    const first=src.slice(start,start+260);
    assert.ok(/requireSessionWrites\(\)|future PAWS University API|PAWS University API operation|PAWS University API supports|must be handled by the PAWS University API/.test(first),`${name} must fail closed or remain capability-gated`);
  }
  assert.match(src,/sessionWritesEnabled\(\)/);
});

test('existing-session edits use the server API and keep legacy Firestore mutations disabled',()=>{
 const detail=functionBody('function openSessionDetail','function openSqlSessionEditForm');
 const edit=functionBody('function openSqlSessionEditForm','function detailField');
 assert.match(detail,/sessionEditEnabled/);
 assert.match(detail,/openSqlSessionEditForm\(s\)/);
 assert.match(edit,/UCVM_PAWS_DATA\.patchSession\(session\.id,patch\)/);
 assert.doesNotMatch(edit,/db\.batch|collection\(SESSION_COLLECTION\)|firebase\.firestore/);
 assert.match(functionBody('async function openSessionForm','function input'),/requireSessionWrites\(\)/);
});
