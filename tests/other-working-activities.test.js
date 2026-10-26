'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const lib=require('../frontend/scripts/calendar-activities');
const vm=require('node:vm'),sourceFunction=require('../test-support/source-function');
function harness(){
 const nodes=new Map(),host={innerHTML:'',querySelector:key=>{if(!nodes.has(key))nodes.set(key,{value:'',innerHTML:'',textContent:''});return nodes.get(key);}};
 const state={user:{uid:'faculty-a',role:'faculty'},academicYear:'2026-27'},calls=[];
 const api={listCalendarActivities:options=>new Promise((resolve,reject)=>calls.push({options,resolve,reject}))};
 assert.equal(typeof lib.createOtherWorkTab,'function');
 const view=lib.createOtherWorkTab({host,api,getUser:()=>state.user,getAcademicYear:()=>state.academicYear});
 return {host,state,calls,view,node:key=>host.querySelector(key)};
}
const row=(category,label)=>({activityId:category,label,category,startDate:'2026-10-01',endDate:'2026-10-02',facultyDisplayName:'Example, Alex',facultyKey:'opaque',timeEvidence:[]});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('a tab opened before own detail arrives picks up its authorized year when reopened',async()=>{
 const h=harness();h.state.academicYear='';await h.view.open();assert.equal(h.calls.length,0);
 h.state.academicYear='2026-27';h.view.clear();const reopened=h.view.open();await tick();assert.equal(h.node('[data-other-year]').value,'2026-27');assert.equal(h.calls.length,1);
 h.calls[0].resolve({activities:[],nextCursor:null});await reopened;
});
test('Dashboard other work uses the authorized own-detail year when no admin summary is loaded',()=>{
 const ctx={currentAcademicYear:()=>'',selectedDetail:{academicYear:'2026-27'},text:value=>String(value||'').trim()};
 let body='';try{body=sourceFunction('faculty-admin.js','otherWorkAcademicYear');}catch{}assert.ok(body,'missing own-detail year adapter');vm.createContext(ctx);vm.runInContext(body,ctx);
 assert.equal(ctx.otherWorkAcademicYear(),'2026-27');ctx.currentAcademicYear=()=> '2027-28';assert.equal(ctx.otherWorkAcademicYear(),'2027-28');ctx.currentAcademicYear=()=>'';ctx.selectedDetail=null;assert.equal(ctx.otherWorkAcademicYear(),'');
});
test('independent work tab excludes scheduled CCC/Rotation, labels default time, and filters locally',async()=>{
 const h=harness(),open=h.view.open();await tick();assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].options.includeFacultyKeys,undefined,'a Faculty view never requests administrator mappings');
 h.calls[0].resolve({activities:[row('ccc','Clinic'),row('rotation_participant','Rotation'),{...row('clinical_day','Community clinic'),facultyDisplayName:'Alex Example'},{...row('vetm581_rounds','Student rounds'),facultyDisplayName:'Alex Example'}],nextCursor:null});await open;
 const result=h.node('[data-other-results]');assert.match(result.innerHTML,/Community clinic|Student rounds/);assert.doesNotMatch(result.innerHTML,/>Rotation<|>Clinic<|>CCC</);assert.match(result.innerHTML,/08:30.*16:30/);assert.match(result.innerHTML,/default/i);
 h.node('[data-other-search]').value='Community';h.node('[data-other-search]').oninput();assert.match(result.innerHTML,/Community clinic/);assert.doesNotMatch(result.innerHTML,/Student rounds/);assert.equal(h.calls.length,1);
 h.node('[data-other-search]').value='Example, Alex';h.node('[data-other-search]').oninput();assert.match(result.innerHTML,/Community clinic/);assert.match(result.innerHTML,/Student rounds/);
 for(const query of ['Example Alex','Alex Community','Community Example']){
  h.node('[data-other-search]').value=query;h.node('[data-other-search]').oninput();assert.match(result.innerHTML,/Community clinic/);
 }
 h.node('[data-other-search]').value='Community nonexistent';h.node('[data-other-search]').oninput();assert.doesNotMatch(result.innerHTML,/Community clinic/);
});
test('late rows cannot reappear after identity change or leaving the tab',async()=>{
 const h=harness(),open=h.view.open();await tick();h.state.user={uid:'faculty-b',role:'faculty'};h.view.clear();h.calls[0].resolve({activities:[row('clinical_day','Previous identity')],nextCursor:null});await open;assert.equal(h.host.innerHTML,'');
});
test('large other-work results page locally and a keyword resets to the first matching page',async()=>{
 const h=harness(),open=h.view.open();await tick();h.calls[0].resolve({activities:Array.from({length:120},(_,i)=>({...row('clinical_day','Clinical '+i),activityId:'r'+i})),nextCursor:null});await open;
 const results=h.node('[data-other-results]');assert.match(results.innerHTML,/1–50 of 120/);assert.doesNotMatch(results.innerHTML,/>Clinical 80</);
 h.node('[data-other-next]').onclick();assert.match(results.innerHTML,/51–100 of 120/);assert.doesNotMatch(results.innerHTML,/>Clinical 0</);
 h.node('[data-other-search]').value='Clinical 119';h.node('[data-other-search]').oninput();assert.match(results.innerHTML,/>Clinical 119</);assert.match(results.innerHTML,/1 range/);assert.equal(h.calls.length,1);
});
test('year changes clear old rows, keep bounded authorized scope, and reject stale responses',async()=>{
 const h=harness(),first=h.view.open();await tick();h.node('[data-other-year]').value='2027-28';const next=h.node('[data-other-year]').onchange();await tick();
 assert.equal(h.calls[1].options.start,'2027-05-01');assert.equal(h.calls[1].options.end,'2028-05-01');
 h.calls[1].resolve({activities:[row('clinical_day','Current year')],nextCursor:null});await next;
 h.calls[0].resolve({activities:[row('clinical_day','Old year')],nextCursor:null});await first;assert.doesNotMatch(h.node('[data-other-results]').innerHTML,/Old year/);
});
test('errors show Retry, invalid years never issue reads, and empty results are truthful',async()=>{
 const h=harness(),open=h.view.open();await tick();h.calls[0].reject(Error('Synthetic outage'));await open;assert.match(h.node('[data-other-results]').innerHTML,/could not|unavailable/i);
 h.node('[data-other-year]').value='bad';await h.node('[data-other-year]').onchange();assert.equal(h.calls.length,1);assert.match(h.node('[data-other-results]').innerHTML,/academic year/i);
});
test('Faculty self mode can open the independent other-work tab and cancels it on auth reset',()=>{
 let opened=0,cleared=0;const ctx={selfMode:true,activeTab:'lookup',document:{querySelectorAll:()=>[]},$:()=>({classList:{toggle(){}},textContent:''}),otherWorkTab:{open:()=>{opened++;},clear:()=>{cleared++;}},traineesEntry:{clear(){}},renderLookup(){},authGeneration:0,lookupMetricsGeneration:0,aggregateCache:{},invalidateFacultyDetails(){}};
 vm.createContext(ctx);for(const name of ['selectTab','renderActiveTab','resetAuthData'])vm.runInContext(sourceFunction('faculty-admin.js',name),ctx);
 ctx.selectTab('other-work');assert.equal(opened,1);assert.equal(ctx.activeTab,'other-work');ctx.resetAuthData();assert.ok(cleared>0);
});
