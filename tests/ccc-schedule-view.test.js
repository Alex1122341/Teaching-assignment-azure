'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {escape,validDate,filterEntries,groupEntries}=require('../ccc-schedule');
const read=p=>fs.readFileSync(p,'utf8');
test('CCC schedule is available beside Faculty Dashboard with isolated modal',()=>{
 const html=read('index.html');assert.match(html,/faculty-dashboard-btn[^]*ccc-schedule-btn/);
 assert.match(html,/ccc-schedule-overlay/);assert.match(html,/ccc-schedule\.css/);assert.match(html,/ccc-schedule\.js/);
 assert.match(read('timetable.js'),/ccc-schedule-btn'\)\.classList\.toggle\('hidden', !currentUser\)/);
});
test('client and API route remain independent of Calendar activity self-only endpoint',()=>{
 const client=read('paws-data-client.js'),runtime=read('server/src/runtime/swa-sql-runtime.js');
 assert.match(client,/cccSchedule\(academicYear\)/);
 assert.match(runtime,/createCccScheduleFunctions/);
 assert.match(runtime,/pathname==='\/api\/v1\/ccc-schedule'/);
 assert.doesNotMatch(read('ccc-schedule.js'),/listCalendarActivities|firestore|doe|\.collection\(/i);
});
test('search, stable sorting, and markup escape',()=>{
 const rows=[{date:'2026-10-22',facultyName:'Zoe',blockLabel:'Block 6'},{date:'2026-10-21',facultyName:'<Alex>',blockLabel:'Block 5'}];
 assert.equal(filterEntries(rows,'block 5')[0].facultyName,'<Alex>');
 assert.deepEqual(filterEntries(rows,'').map(x=>x.date),['2026-10-21','2026-10-22']);
 assert.equal(escape('<script>"&'), '&lt;script&gt;&quot;&amp;');
 assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2026-10-21'),true);
});
test('schedule rows with matching start date but different end dates stay separate',()=>{
 const rows=[
  {date:'2026-10-21',endDate:'2026-10-21',blockLabel:'Stoney | Block 5',courseCode:'CCC',facultyName:'A'},
  {date:'2026-10-21',endDate:'2026-10-22',blockLabel:'Stoney | Block 5',courseCode:'CCC',facultyName:'B'},
  {date:'2026-10-21',endDate:'2026-10-21',blockLabel:'Stoney | Block 5',courseCode:'CCC',facultyName:'C'}
 ];
 const groups=[...groupEntries(filterEntries(rows,'')).values()];
 assert.equal(groups.length,2);
 assert.deepEqual(groups.map(group=>[group.endDate,group.staff.map(person=>person.facultyName)]),[
  ['2026-10-21',['A','C']],['2026-10-22',['B']]
 ]);
});
test('viewer does not create availability records, write CCC or calculate DOE',()=>{
 const js=read('ccc-schedule.js');
 assert.match(js,/cccSchedule\(selected\)/);
 assert.doesNotMatch(js,/stageCcc|commitCcc|resolveCalendarActivity|facultyAvailability\(|INSERT|UPDATE|DELETE/);
});
