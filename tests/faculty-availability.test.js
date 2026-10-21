'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('Dashboard has dedicated availability tab, view, module and stylesheet',()=>{
 const html=read('faculty-admin.html'),admin=read('faculty-admin.js'),client=read('paws-data-client.js');
 assert.match(html,/data-tab="availability"/);
 assert.match(html,/id="availability-view"/);
 assert.match(html,/faculty-availability\.js/);
 assert.match(html,/faculty-availability\.css/);
 assert.match(admin,/if\(activeTab==='availability'\)return/);
 assert.match(admin,/lookup','trainees','availability/);
 assert.match(client,/facultyAvailability\(/);
});
test('Calendar availability is SQL-backed and never uses browser Firestore',()=>{
 const js=read('faculty-availability.js');
 assert.match(js,/facultyAvailability\(/);
 assert.doesNotMatch(js,/\.collection\(|firestore|db\.doc/);
 assert.match(js,/value="upcoming"/);
 assert.match(js,/value="from"/);
 assert.match(js,/value="range"/);
 assert.match(js,/No PAWS commitments found/);
 assert.match(js,/does not include external calendar meetings/);
});
test('Unified list distinguishes workloads, AFC, tentative and ongoing',()=>{
 const js=read('faculty-availability.js');
 for(const label of ['Teaching','Work beyond teaching','AFC / Leave','Pending absence','Roles / Appointments','Time unconfirmed'])
  assert.ok(js.includes(label),label);
});

test('date controls honor hidden mode wrappers even with display flex styling',()=>{
 assert.match(read('faculty-availability.css'),/\.availability-controls\s+\[hidden\]\s*\{\s*display\s*:\s*none/);
});

test('availability rollback requires exact installed definition and refuses unrelated grants',()=>{
 const sql=read('database/azure-sql/rollback_056_faculty_availability_read.sql');
 assert.match(sql,/PAWS_AVAILABILITY_DEFINITION_SHA256/);assert.match(sql,/OBJECT_DEFINITION/);assert.match(sql,/sys\.database_permissions/);assert.match(sql,/55608/);
});

test('malformed appointment entries are guarded before extracting dates',()=>{
 const sql=read('database/azure-sql/056_faculty_availability_read.sql');
 assert.match(sql,/CASE WHEN j\.type=5 THEN j\.value ELSE N'\{\}' END/);
 assert.doesNotMatch(sql,/JSON_VALUE\(j\.value/);
});
