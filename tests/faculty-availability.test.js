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
