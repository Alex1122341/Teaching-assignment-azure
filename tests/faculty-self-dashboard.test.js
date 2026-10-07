const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('faculty, HICC, and VISC can open Faculty Dashboard from the timetable',()=>{
 const src=read('asset-loader.js');
 assert.match(src,/function enableFacultyDashboardLink\(\)/);
 assert.match(src,/\['faculty','hicc','visc'\]\.includes\(UCVM\.role\(profile\?\.role\)\)/);
 assert.match(src,/button\.classList\.remove\('hidden'\)/);
 assert.match(src,/window\.location\.href='faculty-admin\.html'/);
 assert.match(src,/ucvm:sessions-updated/);
});

test('faculty dashboard has a linked self-profile mode that does not subscribe to the faculty index',()=>{
 const src=read('faculty-admin.js');
  assert.match(src,/function isSelfServiceProfile\(p\)/);
  assert.match(src,/\['faculty','hicc','visc'\]\.includes\(String\(p\?\.role\|\|''\)\.toLowerCase\(\)\)/);
 assert.match(src,/async function loadSelfFaculty\(facultyId\)/);
 assert.doesNotMatch(src,/db\.collection\(COLLECTION\)\.doc\(String\(facultyId\)\)\.get\(\)/,'self-service must not read the Firestore faculty document');
 const selfStart=src.indexOf('async function loadSelfFaculty(facultyId)');
 const selfEnd=src.indexOf('async function enterSelfMode',selfStart);
 assert.ok(selfStart>=0&&selfEnd>selfStart,'loadSelfFaculty must exist');
 const selfBody=src.slice(selfStart,selfEnd);
 assert.match(selfBody,/UCVM_PAWS_DATA\.dashboardFaculty\(\)/);
 assert.match(selfBody,/UCVM_PAWS_DATA\.dashboardFacultyById\(facultyId\)/);
 assert.doesNotMatch(selfBody,/listenFacultySessions\(|db\.collection\(/,'self-service must not start a Firestore listener or read Firestore');
  assert.match(src,/if\s*\(isSelfServiceProfile\(profile\)\)\s*\{\s*window\.UCVMSessionGuard\?\.clearNotice\?\.\(\);\s*await enterSelfMode\(user, profile\);\s*return;\s*\}/);
  assert.match(src,/if\s*\(dashboardAdmin\(profile\)\)\s*\{\s*window\.UCVMSessionGuard\?\.clearNotice\?\.\(\);\s*enterAdminMode\(user, profile\);\s*return;\s*\}/);
  const start=src.indexOf('async function enterSelfMode(user, profile)');
 const end=src.indexOf('\n  function enterAdminMode',start);
 assert.ok(start>=0&&end>start,'enterSelfMode must exist');
 const body=src.slice(start,end);
 assert.doesNotMatch(body,/subscribeFaculty\(/);
 assert.doesNotMatch(body,/subscribeSessions\(/);
 assert.doesNotMatch(body,/faculty_index/);
});

test('faculty self mode is full-width and removes admin navigation and editing',()=>{
 const src=read('faculty-admin.js');
 assert.match(src,/document\.body\.classList\.add\('faculty-self-mode'\)/);
 assert.equal(src.includes('editButton'),false,'the edit control is retired from the read-only Dashboard');
 assert.match(src,/body\.faculty-self-mode \.tabs/);
 assert.match(src,/body\.faculty-self-mode \.kpis/);
 assert.match(src,/body\.faculty-self-mode #lookup-view > \.toolbar/);
 assert.match(src,/body\.faculty-self-mode \.result-pane/);
 assert.match(src,/body\.faculty-self-mode \.lookup-grid\{display:block/);
});

test('faculty record rules use the linked facultyId for get and keep list admin-only',()=>{
 const rules=read('firestore.rules');
 assert.match(rules,/function ownFacultyId\(id\)\{return facultyMember\(\) && profile\(\)\.facultyId is string && profile\(\)\.facultyId == id;\}/);
 assert.match(rules,/match \/faculty\/\{id\} \{\s*allow get: if admin\(\) \|\| ownFacultyId\(id\);\s*allow list: if admin\(\);/s);
});

test('legacy Dashboard enhancement exposes only the API-backed P4 DOE editor bridge',()=>{
 const src=read('faculty-admin-enhancements.js');
 assert.match(src,/window\.UCVM_FACULTY_DOE_EDIT/);
 assert.match(src,/editor\.create/);
 assert.doesNotMatch(src,/firestore|collection\(|onSnapshot|doeCredit|doeRate\s*\*/i);
});
