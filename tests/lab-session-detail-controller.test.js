'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const lab=require('../frontend/scripts/lab-session-detail.js');
const source=fs.readFileSync(repositoryPath(process.cwd(), 'timetable.js'),'utf8');
const handler=source.slice(source.indexOf('  function openLabSessionDetail(seed)'),source.indexOf('  async function openSqlSessionAssignmentForm'));
const seed={id:'one',type:'LAB',date:'2026-10-16',course:'206',courseName:'Healthy Animals I',academicYear:'2026-27',year:1,start:'08:30',end:'12:30',assignmentManagementAvailable:true};
function harness(editEnabled=true){
  const calls=[],buttons=[],close={};let html;
  const modal={querySelector:()=>({classList:{add:x=>calls.push(['class',x])}}),querySelectorAll:()=>buttons};
  const second={...seed,id:'two',topic:'Bovine Distant',start:'09:15',end:'16:15'};
  const context={window:{UCVM_LAB_DETAIL:lab,UCVM_PAWS_DATA:{sessionEditEnabled:()=>editEnabled},PAWS_SWAP:{openSession:id=>calls.push(['swap',id]),isPending:id=>id==='two'}},renderedSessions:[seed,second],sessions:[seed],sessionCache:new Map(),instructorDisplayText:r=>r.id==='two'?'Instructor Two':'Instructor One',escapeHtml:s=>s,currentUser:{uid:'u'},scheduleSource:'vetmed-ops',canEditExistingSqlSession:()=>true,parseYmd:d=>d,formatLongDate:d=>d,showModal:s=>{html=s;for(const m of s.matchAll(/data-lab-action="([^"]+)" data-lab-id="([^"]+)"/g))buttons.push({dataset:{labAction:m[1],labId:m[2]}})},$:id=>id==='modal'?modal:close,closeModal:()=>calls.push(['close']),openSqlSessionEditForm:r=>calls.push(['edit',r.id]),openSqlSessionAssignmentForm:r=>calls.push(['instructors',r.id])};
  vm.runInNewContext(handler+'\nopenLabSessionDetail(seed);',{...context,seed});
  return{calls,buttons,html};
}
test('grouped LAB row actions call the existing flows with that exact session id',()=>{
 const h=harness();
 for(const action of ['edit','instructors','swap'])h.buttons.find(b=>b.dataset.labId==='two'&&b.dataset.labAction===action).onclick();
 assert.deepEqual(h.calls.filter(x=>x[0]!=='class'),[['edit','two'],['instructors','two'],['close'],['swap','two']]);
 assert.match(h.html,/Instructor Two/);
});
test('grouped LAB does not expose edit buttons with the API edit gate closed',()=>{
 const h=harness(false);assert.equal(h.buttons.some(b=>['edit','instructors'].includes(b.dataset.labAction)),false);
 assert.equal(h.buttons.filter(b=>b.dataset.labAction==='swap').length,2);
});
test('grouped LAB preserves the pending SWAP status on its original row',()=>{
 const h=harness();assert.match(h.html,/SWAP PENDING/);
});
