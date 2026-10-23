'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function load(){const context={window:{},Date};for(const file of ['faculty-name.js','scheduling-core.js','timetable-selection.js'])vm.runInNewContext(fs.readFileSync(repositoryPath(__dirname,'..',file),'utf8'),context);return context.window.UCVM_TIMETABLE_SELECTION;}
const plain=value=>JSON.parse(JSON.stringify(value));
test('selected report contains only chosen authorized sessions in chronological order and public fields',()=>{
 const source=[{id:'late',course:'207',courseName:'Course Seven',date:'2026-11-06',start:'10:00',end:'11:00',topic:'Later',type:'LAB',instructor:'Faculty Beta',room:'Room B',ucid:'PRIVATE',email:'PRIVATE',doeCredit:99,assignments:[{facultyId:'PRIVATE'}]},
 {id:'early',course:'206',courseName:'Course Six',date:'2026-11-05',start:'09:00',end:'10:00',topic:'Earlier',type:'LEC',instructor:'Faculty Alpha',room:'Room A'},
 {id:'other',course:'208',date:'2026-11-04',topic:'Not selected'}];
 const model=load().createExport(source);model.selectCourses(['207','206']);
 assert.equal(model.size,2);
 assert.deepEqual(plain(model.preview()),[
  {courseCode:'206',courseName:'Course Six',date:'2026-11-05',startTime:'09:00',endTime:'10:00',topic:'Earlier',type:'LEC',faculty:'Alpha, Faculty',room:'Room A',visc:'Not provided'},
  {courseCode:'207',courseName:'Course Seven',date:'2026-11-06',startTime:'10:00',endTime:'11:00',topic:'Later',type:'LAB',faculty:'Beta, Faculty',room:'Room B',visc:'Not provided'}]);
 model.toggle('early');assert.equal(model.size,1);assert.equal(model.preview()[0].courseCode,'207');
 assert.doesNotMatch(JSON.stringify(model.preview()),/PRIVATE|assignments|doeCredit|ucid|email/);
 assert.throws(()=>model.toggle('not-authorized'),/authorized/i);
});
test('selected CSV uses the preview fields, quotes text and neutralizes spreadsheet formulas',()=>{
 const model=load().createExport([{id:'one',course:'206',courseName:'=CMD()',date:'2026-11-05',start:'09:00',end:'10:00',topic:'  +HYPERLINK("x")',type:'@LAB',instructor:'Alpha, Beta',room:'-Room',ucid:'SECRET',assignments:[{email:'SECRET'}]}]);
 model.selectCourses(['206']);
 assert.equal(model.csv(),'\uFEFF"Course Code","Course Name","Session Date","Start Time","End Time","Topic","Session Type","Faculty","Room","VISC"\r\n"206","\'=CMD()","2026-11-05","09:00","10:00","\'+HYPERLINK(""x"")","\'@LAB","Alpha, Beta","\'-Room","Not provided"');
 assert.doesNotMatch(model.csv(),/SECRET|Assignments JSON|UCID|Email|DOE/);
});
test('bulk selection refuses overflow atomically, clears and keeps unknown timing in the snapshot',()=>{
 const source=[{id:'one',course:'206',date:'2026-11-05',start:'09:00',end:'10:00'}, {id:'two',course:'206',date:null,start:'08:00',end:'09:00',timeUnknown:true}, {id:'three',course:'207',date:'2026-11-04'}, {id:'range',course:'CCC',isCcc:true}];
 const model=load().createExport(source,2);model.selectCourses(['207']);
 assert.throws(()=>model.selectAll(),/at most 2/);assert.equal(model.size,1);assert.equal(model.preview()[0].courseCode,'207');
 model.selectCourses(['206']);source[0].course='PRIVATE mutated';
 assert.equal(model.size,2);assert.equal(model.preview()[0].courseCode,'206');assert.equal(model.preview()[1].date,'');assert.equal(model.preview()[1].startTime,'');assert.equal(model.preview()[1].endTime,'');
 model.clear();assert.equal(model.size,0);assert.throws(()=>model.toggle('range'),/authorized/);
});
test('ambiguous duplicate session identities are rejected rather than silently dropped',()=>{
 assert.throws(()=>load().createExport([{id:'duplicate',course:'206',topic:'One'},{id:'duplicate',course:'207',topic:'Another'}]),/duplicate session/i);
});

test('same-slot sessions retain deterministic order after reselection and source order changes',()=>{
 const source=[{id:'b',course:'206',date:'2026-11-05',start:'09:00',topic:'Station B'},{id:'a',course:'206',date:'2026-11-05',start:'09:00',topic:'Station A'}];
 const model=load().createExport(source);model.selectAll();model.toggle('a');model.toggle('a');
 assert.deepEqual(plain(model.preview().map(row=>row.topic)),['Station A','Station B']);
 const fresh=load().createExport(source.slice().reverse());fresh.selectAll();
 assert.equal(model.csv(),fresh.csv());assert.doesNotMatch(JSON.stringify(model.preview()),/"id"/);
});
