'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const lab=require('../frontend/scripts/lab-session-detail.js');
const seed={id:'lab-1',date:'2026-10-16',course:'206',courseName:'Healthy Animals I',year:1,academicYear:'2026-27',type:'LAB',topic:'Station One',room:'Room A',instructor:'Instructor One',start:'08:30',end:'12:30'};
test('LAB detail gathers only authorized same-course same-date same-year LAB and SRL rows',()=>{
  const rows=[seed,{...seed,id:'lab-2',topic:'Station Two',start:'09:15',end:'16:15'}, {...seed,id:'srl',type:'SRL',topic:'Research'}, {...seed,id:'wrong-date',date:'2026-10-17'}, {...seed,id:'wrong-year',year:2}, {...seed,id:'wrong-course',course:'207'}, {...seed,id:'ccc',isCcc:true}, {...seed,id:'lecture',type:'LEC'},seed];
  const model=lab.buildModel(seed,rows);
  assert.deepEqual(model.stations.map(x=>x.id),['lab-1','lab-2']);
  assert.deepEqual(model.srl.map(x=>x.id),['srl']);
  assert.deepEqual(model.slots,['08:30–12:30','09:15–16:15']);
});
test('LAB layout preserves total source intervals without fabricating rotation groups or rooms',()=>{
  const model=lab.buildModel(seed,[seed]); const html=lab.render(model);
  assert.match(html,/08:30–12:30/); assert.match(html,/Not provided/);
  assert.doesNotMatch(html,/09:00|12:45|class="lab-group">[FDE]</);
  const unknown=lab.render(lab.buildModel({...seed,room:'',start:'',end:'',timeUnknown:true},[]));
  assert.match(unknown,/Time not provided/);assert.match(unknown,/Room not provided/);
});
test('LAB table escapes source text and keeps per-session actions attached to the correct row',()=>{
  const row={...seed,topic:'<script>bad</script>',instructor:'A & B',room:'<room>'};
  const html=lab.render(lab.buildModel(row,[row]),{actions:s=>`<button data-edit="${s.id}">Edit</button>`});
  assert.match(html,/&lt;script&gt;bad&lt;\/script&gt;/); assert.match(html,/A &amp; B/);assert.match(html,/&lt;room&gt;/);
  assert.match(html,/data-edit="lab-1"/);assert.doesNotMatch(html,/<script>/);
});
