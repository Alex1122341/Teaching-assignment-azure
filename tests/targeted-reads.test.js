const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('Faculty Admin is an API-only reader with no Firestore surface',()=>{
 const source=read('faculty-admin.js');
 for(const pattern of ['faculty_index','schedule_stats','db.collection','onSnapshot','loadFacultyDetail','subscribeFaculty','subscribeSessions'])assert.equal(source.includes(pattern),false,pattern);
 assert.match(source,/function loadAdminDashboard\(\)/);
 assert.match(source,/function selectFacultyDetail\(facultyId\)/);
});

test('the Dashboard no longer loads full Firestore datasets',()=>{
 const source=read('faculty-admin.js');
 for(const pattern of ['ensureFullFaculty','ensureFullSessions','ensureAdminDataset','reloadAdminDataset','setTab','renderSummary','renderRoles','renderDatabase'])assert.equal(source.includes(pattern),false,pattern);
});

test('approval workflow fetches only sessions referenced by requests',()=>{
 const source=read('approval-workflow.js');
 assert.match(source,/function ensureRequestSessions\(requestRows\)/);
 assert.match(source,/db\.doc\(`\$\{SESSIONS\}\/\$\{id\}`\)\.get\(\)/);
 assert.match(source,/where\('date','==',date\)\.get\(force\?\{source:'server'\}:undefined\)/);
 assert.doesNotMatch(source,/where\('facultyIds','array-contains',id\)\.get\(\)/);
 assert.match(source,/approvalSessionDatesLoaded=new Set\(\)/);
 assert.doesNotMatch(source,/approvalSessionFacultyLoaded/);
 assert.doesNotMatch(source,/db\.collection\(SESSIONS\)\.get\(\)/);
 assert.doesNotMatch(source,/UCVM_PAGE_DATA\?\.allSessions/);
 assert.doesNotMatch(source,/db\.collection\(SESSIONS\)\.onSnapshot/);
});

test('replacement accounts and change-history pages load only when requested',()=>{
 const workflow=read('approval-workflow.js'),access=read('faculty-access.js');
 assert.match(workflow,/function ensureReplacementPeople/);
 assert.match(workflow,/where\('role','in',\['faculty','hicc','visc'\]\)\.get\(\)/);
 assert.doesNotMatch(workflow,/listenPeople\(\)/);
 assert.match(access,/const PAGE_SIZE=20/);
 assert.match(access,/\.limit\(PAGE_SIZE\)/);
});

test('User Management uses the lightweight faculty index until an Owner requests bulk provisioning',()=>{
 const source=read('user-management.js');
 assert.match(source,/doc\('faculty_index'\)\.get\(\)/);
 const initialLoad=source.match(/async function load\(\)\{[\s\S]*?\n \}/)?.[0]||'';
 assert.doesNotMatch(initialLoad,/db\.collection\('faculty'\)\.get\(\)/);
 assert.match(source,/async function fullFaculty\(\)\{const snapshot=await db\.collection\('faculty'\)\.get\(\)/);
 assert.match(source,/async function previewProvision\(\)[\s\S]*await fullFaculty\(\)/);
});

test('Timetable faculty self-service delegates exact assignment scoping to the authenticated SQL API',()=>{
 const source=read('timetable.js');
 assert.match(source,/UCVM_PAWS_DATA\.listSessions/);
 assert.match(source,/ensureSessionsForRange/);
 assert.match(source,/function roleIsFaculty\(profile\).*faculty.*hicc.*visc/);
 const start=source.indexOf('async function subscribeSessions');
 const end=source.indexOf('function refreshSessionScope',start);
 assert.doesNotMatch(source.slice(start,end),/db\.collection\('sessions'\)|onSnapshot/);
});

test('Timetable editing helpers request only affected Azure date ranges and scoped exports avoid full reads',()=>{
 const source=read('timetable.js');
 assert.match(source,/function ensureSessionsForDates/);
 assert.match(source,/ensureSessionsForRange\(dates\[0\],dates\[dates\.length-1\]\)/);
 assert.match(source,/fetchAzureSessions\(\{start:range\.start,end:/);
 for(const name of ['openSwapModal','startSessionSelection','openBulkSessionForm','openSessionForm']){
  const start=source.indexOf(`function ${name}`);
  const next=source.indexOf('\n  function ',start+1);
  const body=source.slice(start,next<0?source.length:next);
  assert.doesNotMatch(body,/ensureAllSessions/,`${name} should not load every session`);
 }
 const submit=source.match(/\$\('export-form'\)\.onsubmit=[\s\S]*?\n\s*};/)?.[0]||'';
 assert.match(submit,/scope==='all'.*ensureAllSessions/s);
 assert.match(submit,/scope==='date'.*ensureSessionsForRange/s);
});
