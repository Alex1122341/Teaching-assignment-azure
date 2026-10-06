'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

const SQL_CANONICAL_PATHS=[
 'sessions',
 'session_change_log',
 'faculty',
 'faculty_change_log',
 'afc_requests',
 'afc_requests/{id}/pdf_chunks',
 'afc_audit',
 'audit_events',
 'settings/faculty_index',
 'settings/schedule_stats',
 'settings/faculty_swap_index',
 'settings/faculty_swap_map',
 'settings/faculty_summary_2026_27'
];

test('W1D publishes an explicit and reviewable SQL-canonical Firestore path set',()=>{
 const source=fs.readFileSync(path.join(__dirname,'w1d-firestore-authority-emulator.test.js'),'utf8');
 for(const collection of SQL_CANONICAL_PATHS)assert.ok(source.includes(`'${collection}'`),`missing protected path ${collection}`);
});

test('Beta entry points do not load legacy Firestore approval/AFC/import writers',()=>{
 const html=read('index.html'),management=read('user-management.html'),loader=read('asset-loader.js'),afc=read('afc-workflow.js'),admin=read('faculty-admin.js'),access=read('faculty-access.js');
 assert.doesNotMatch(html,/src=["']afc-actions\.js["']/);
 assert.match(loader,/function ensureApprovalWorkflow\(\)\{[\s\S]*?return false/);
 assert.doesNotMatch(afc,/db\.collection\(['"]afc_requests['"]\)\.doc\(\)/);
 assert.doesNotMatch(admin,/bulk-import-firestore\.js/);
 assert.doesNotMatch(html,/src=["'](?:index-maintenance|faculty-admin-enhancements|bulk-import-firestore)\.js["']/);
 assert.doesNotMatch(management,/src=["']index-maintenance\.js["']/,'User Management has no derived-index repair action and must not ship its writer');
 assert.doesNotMatch(access,/load\(['"](?:approval-workflow|faculty-admin-enhancements)\.js['"]/,'shared page loader must not dynamically reintroduce obsolete browser writers');
});

test('named canonical writers contain no direct Firestore session, AFC, or Faculty commit paths',()=>{
 const checks=[
  ['timetable.js',/commitPlan\(plan,\{batch:\(\)=>db\.batch\(\)/],
  ['timetable.js',/batch\.set\(ref,\{\.\.\.firestoreSafeSession\(next\)/],
  ['timetable.js',/batch\.delete\(db\.collection\(SESSION_COLLECTION\)/],
  ['timetable.js',/\.batch\(\)/],
  ['approval-workflow.js',/batch\.set\(ref,\{\.\.\.patch/],
  ['afc-workflow.js',/db\.collection\(['"]afc_requests['"]\)\.doc\(\)/],
  ['afc-actions.js',/batch\.(?:set|update|delete)\(/],
  ['user-management.js',/batch\.(?:set|update|delete)\(db\.doc\(`faculty\//],
  ['user-management.js',/db\.collection\(['"]faculty_change_log['"]\)\.doc\(\)/]
 ];
 for(const [file,pattern] of checks){const source=read(file);assert.ok(!pattern.test(source),`${file} retains a direct SQL-canonical Firestore mutation: ${pattern}`)}
 assert.match(read('timetable.js'),/\$\('session-form'\)\.onsubmit\s*=\s*event\s*=>/,'the fail-closed editor handler must bind through the DOM helper so the browser script remains parseable');
});

test('public schedule remains read-only in the browser and public information retains its documented Firestore function',()=>{
 const timetable=read('timetable.js'),info=read('information-center.js'),rules=read('firestore.rules');
 assert.match(timetable,/db\.collection\(['"]public_schedule['"]\)\.doc\(['"]ccc_events['"]\)\.get\(\)/);
 assert.doesNotMatch(timetable,/db\.collection\(['"]public_schedule['"]\)\.doc\(['"]ccc_events['"]\)\.(?:set|update|delete)\(/);
 assert.match(info,/db\.doc\(['"]public_info\/information_center['"]\)\.set\(/);
 assert.match(rules,/match \/public_info\/\{id\}/);
});

test('W1C remains default-disabled and the SQL data client has no Firestore fallback',()=>{
 const data=read('paws-data-client.js'),gates=read('server/src/data/write-gates.js');
 assert.match(data,/sessionWritesEnabled:\(\)=>\s*false/);
 assert.match(data,/afcSingleWriteEnabled:\(\)=>\s*false/);
 assert.match(data,/afcBatchWriteEnabled:\(\)=>\s*false/);
 assert.match(gates,/===\s*'true'/);
 assert.doesNotMatch(data,/fallback.*firestore|firestore.*fallback/i);
});

module.exports={SQL_CANONICAL_PATHS};
