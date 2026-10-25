'use strict';
// Cancellation correctness for the Calendar activity cache.
//
// These tests execute the real createCalendarActivityView() together with the
// real createActivityCache(): the view is the one shipped in
// frontend/scripts/calendar-activities.js and the cache is the one shipped in
// frontend/scripts/calendar-search.js. Only the HTTP client is a stub.
//
// Background: the view used to report a superseded request as an empty array.
// The cache must never treat that as an authoritative empty result.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {createCalendarActivityView}=require('../frontend/scripts/calendar-activities.js');
const search=require('../frontend/scripts/calendar-search.js');
const sourceFunction=require('../test-support/source-function');

const A={start:'2026-09-01',end:'2026-09-08'};
const B={start:'2026-10-01',end:'2026-10-08'};
const row=(label,date)=>({label,category:'ccc',startDate:date,endDate:date,facultyDisplayName:`Faculty, ${label}`,staffingKind:'assigned'});
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function apiStub(){
 const calls=[];
 const api={
  listCalendarActivities(options){
   let resolve,reject;
   const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});
   calls.push({options,resolve,reject});
   return promise;
  }
 };
 return {calls,api};
}

function harness({user='user-1'}={}){
 const {calls,api}=apiStub();
 const state={user:user?{uid:user}:null};
 const view=createCalendarActivityView({api,getUser:()=>state.user});
 const cache=search.createActivityCache({ttlMs:60000,now:()=>0});
 const scope=range=>({uid:state.user?.uid||'',supportContextId:'',start:range.start,end:range.end,facultyId:'',selfOnly:false});
 // Exactly the loader the page uses.
 const load=(range,options={})=>view.loadRange({start:range.start,end:range.end},{onCancel:'throw',...options});
 const read=(range,{refresh=false}={})=>cache.get(scope(range),{refresh,load:target=>load({start:target.start,end:target.end})});
 return {view,cache,state,calls,api,scope,load,read};
}

test('A -> B -> A returns accurate data after the abandoned A request resolves',async()=>{
 const h=harness();
 const firstA=h.read(A);
 const firstB=h.read(B);
 await tick();
 assert.equal(h.calls.length,2,'A then B were requested');
 h.calls[0].resolve({activities:[row('A activity','2026-09-02')],nextCursor:null});
 await assert.rejects(firstA,/superseded|abort/i,'the superseded A request must report cancellation, not empty rows');
 assert.equal(h.cache.peek(h.scope(A)),null,'a cancelled A response must not be cached');
 h.calls[1].resolve({activities:[row('B activity','2026-10-02')],nextCursor:null});
 assert.deepEqual(await firstB,[row('B activity','2026-10-02')]);
 const again=h.read(A);
 await tick();
 assert.equal(h.calls.length,3,'returning to A must re-request instead of serving the cancelled empty result');
 h.calls[2].resolve({activities:[row('A activity','2026-09-02')],nextCursor:null});
 const rows=await again;
 assert.equal(rows.length,1);
 assert.equal(rows[0].label,'A activity');
});

test('a late response from an abandoned request never reaches the cache',async()=>{
 const h=harness();
 const firstA=h.read(A);
 h.read(B);
 await tick();
 h.calls[0].resolve({activities:[row('A activity','2026-09-02')],nextCursor:null});
 await assert.rejects(firstA);
 assert.equal(h.cache.peek(h.scope(A)),null);
 assert.equal(h.cache.size,0,'nothing was cached for either range yet');
});

test('view.clear() invalidates an in-flight request without poisoning the cache',async()=>{
 const h=harness();
 const pending=h.read(A);
 await tick();
 assert.equal(h.calls.length,1);
 h.view.clear();
 h.calls[0].resolve({activities:[],nextCursor:null});
 await assert.rejects(pending,/superseded|abort/i);
 assert.equal(h.cache.peek(h.scope(A)),null,'an empty cancelled response is not a valid empty result');
 const retry=h.read(A);
 await tick();
 assert.equal(h.calls.length,2);
 h.calls[1].resolve({activities:[row('A activity','2026-09-02')],nextCursor:null});
 assert.equal((await retry).length,1);
});

test('a legitimate empty response stays cacheable',async()=>{
 const h=harness();
 const first=h.read(A);
 await tick();
 h.calls[0].resolve({activities:[],nextCursor:null});
 assert.deepEqual(await first,[]);
 assert.deepEqual(h.cache.peek(h.scope(A)),[],'a real empty range is authoritative data');
 const second=h.read(A);
 await tick();
 assert.equal(h.calls.length,1,'the empty result is served from cache');
 assert.deepEqual(await second,[]);
});

test('a cancelled empty response is not cacheable',async()=>{
 const h=harness();
 const pending=h.read(A);
 h.read(B);
 await tick();
 h.calls[0].resolve({activities:[],nextCursor:null});
 await assert.rejects(pending);
 assert.equal(h.cache.peek(h.scope(A)),null);
});

test('two same-scope callers share one request and the same outcome',async()=>{
 const h=harness();
 const one=h.read(A),two=h.read(A);
 await tick();
 assert.equal(h.calls.length,1,'the second caller joins the first request');
 h.calls[0].resolve({activities:[row('A activity','2026-09-02')],nextCursor:null});
 assert.deepEqual(await one,await two);
});

test('joined callers are both cancelled rather than handed an empty result',async()=>{
 const h=harness();
 const one=h.read(A),two=h.read(A);
 await tick();
 h.read(B);
 await tick();
 h.calls[0].resolve({activities:[],nextCursor:null});
 await assert.rejects(one,/superseded|abort/i);
 await assert.rejects(two,/superseded|abort/i);
 assert.equal(h.cache.peek(h.scope(A)),null);
});

test('a refresh cannot let the older response replace the newer rows',async()=>{
 const h=harness();
 const first=h.read(A);
 const refreshed=h.read(A,{refresh:true});
 await tick();
 assert.equal(h.calls.length,2);
 h.calls[1].resolve({activities:[row('newer','2026-09-04')],nextCursor:null});
 assert.deepEqual(await refreshed,[row('newer','2026-09-04')]);
 h.calls[0].resolve({activities:[row('older','2026-09-02')],nextCursor:null});
 await assert.rejects(first);
 const rows=h.cache.peek(h.scope(A));
 assert.equal(rows.length,1);
 assert.equal(rows[0].label,'newer','the superseded response cannot overwrite newer rows');
});

test('a different authenticated user never reuses the previous rows',async()=>{
 const h=harness({user:'user-1'});
 const one=h.read(A);
 await tick();
 h.calls[0].resolve({activities:[row('user one','2026-09-02')],nextCursor:null});
 assert.equal((await one)[0].label,'user one');
 h.state.user={uid:'user-2'};
 const two=h.read(A);
 await tick();
 assert.equal(h.calls.length,2,'the second user pays for its own authorized read');
 h.calls[1].resolve({activities:[row('user two','2026-09-03')],nextCursor:null});
 assert.equal((await two)[0].label,'user two');
 const cached=h.read(A);
 await tick();
 assert.equal((await cached)[0].label,'user two');
 h.state.user={uid:'user-1'};
 const back=h.read(A);
 await tick();
 assert.equal(h.calls.length,2,'the first user still owns its cached entry');
 assert.equal((await back)[0].label,'user one','each identity only ever sees its own entry');
});

test('a signed-out caller cannot start an authenticated read',async()=>{
 const h=harness();
 const pending=h.read(A);
 await tick();
 h.calls[0].resolve({activities:[row('A activity','2026-09-02')],nextCursor:null});
 await pending;
 h.state.user=null;
 await assert.rejects(h.load(A),/superseded|abort|authentication/i);
 assert.equal(h.cache.peek({uid:'user-1',supportContextId:'',start:A.start,end:A.end,facultyId:'',selfOnly:false}).length,1);
});

test('cancellation between pages never caches a partial or empty result',async()=>{
 const h=harness();
 const pending=h.read(A);
 await tick();
 h.calls[0].resolve({activities:[row('page one','2026-09-02')],nextCursor:'cursor-2'});
 await tick();
 assert.equal(h.calls.length,2,'the second page was requested');
 assert.equal(h.calls[1].options.cursor,'cursor-2');
 h.read(B);
 await tick();
 h.calls[1].resolve({activities:[row('page two','2026-09-03')],nextCursor:null});
 await assert.rejects(pending,/superseded|abort/i);
 assert.equal(h.cache.peek(h.scope(A)),null,'neither the partial page nor an empty array is cached');
 const retry=h.read(A);
 await tick();
 assert.equal(h.calls.length,4,'the retry starts a fresh first page');
 h.calls[3].resolve({activities:[row('page one','2026-09-02')],nextCursor:null});
 assert.equal((await retry).length,1);
});

// ---------------------------------------------------------------------------
// The same cancellation rules, driven through the shipped page function.
// ---------------------------------------------------------------------------
function pageHarness(){
 const {calls,api}=apiStub();
 const state={user:{uid:'user-1',profile:{}},range:{...A}};
 const view=createCalendarActivityView({api,getUser:()=>state.user});
 const host={
  html:'',
  retry:null,
  get innerHTML(){return this.html;},
  set innerHTML(value){this.html=String(value);this.retry=this.html.includes('data-activity-retry')?{}:null;},
  querySelector(selector){return selector==='[data-activity-retry]'?this.retry:null;}
 };
 const fields={'search-input':{value:''}};
 const context={
  host,view,fields,
  currentUser:state.user,
  reviewingSelection:false,
  myTimetableOnly:false,
  activityTypeFilter:{selectedKeys:()=>['work:ccc']},
  workingActivityRange:()=>state.range,
  workingActivityRenderToken:0,
  roleIsFaculty:()=>false,
  workingActivityCache:search.createActivityCache({ttlMs:60000,now:()=>0}),
  $:id=>id==='working-activities-lane'?host:(fields[id]??(fields[id]={value:''})),
  window:{PAWS_CALENDAR_ACTIVITIES:view}
 };
 vm.createContext(context);
 vm.runInContext(sourceFunction('timetable.js','renderWorkingActivities'),context);
 return {context,host,state,calls,api};
}

test('navigating A -> B -> A in the page repaints A instead of an empty lane',async()=>{
 const h=pageHarness();
 const firstA=h.context.renderWorkingActivities();
 await tick();
 h.state.range={...B};
 const bRender=h.context.renderWorkingActivities();
 await tick();
 assert.equal(h.calls.length,2);
 h.calls[1].resolve({activities:[row('B activity','2026-10-02')],nextCursor:null});
 await bRender;
 h.calls[0].resolve({activities:[row('A activity','2026-09-02')],nextCursor:null});
 await firstA;
 assert.doesNotMatch(h.host.innerHTML,/activity-empty/,'the abandoned A request must not paint an empty lane');
 h.state.range={...A};
 const back=h.context.renderWorkingActivities();
 await tick();
 assert.equal(h.calls.length,3,'returning to A requests again');
 h.calls[2].resolve({activities:[row('A activity','2026-09-02')],nextCursor:null});
 await back;
 assert.match(h.host.innerHTML,/A activity/);
 assert.doesNotMatch(h.host.innerHTML,/activity-empty/);
});

test('a cancelled page render shows no error and no retry control',async()=>{
 const h=pageHarness();
 const firstA=h.context.renderWorkingActivities();
 await tick();
 h.state.range={...B};
 const bRender=h.context.renderWorkingActivities();
 await tick();
 h.calls[0].resolve({activities:[],nextCursor:null});
 await firstA;
 assert.doesNotMatch(h.host.innerHTML,/activity-error/,'cancellation is not a failure');
 assert.equal(h.host.retry,null);
 h.calls[1].resolve({activities:[row('B activity','2026-10-02')],nextCursor:null});
 await bRender;
});

test('returning to A before its abandoned request settles reloads the visible range',async()=>{
 const h=pageHarness();
 const first=h.context.renderWorkingActivities();await tick();
 h.state.range={...B};const second=h.context.renderWorkingActivities();await tick();
 h.state.range={...A};const back=h.context.renderWorkingActivities();await tick();
 assert.equal(h.calls.length,2,'same-scope inflight requests are initially joined');
 h.calls[0].resolve({activities:[row('abandoned','2026-09-02')],nextCursor:null});
 h.calls[1].resolve({activities:[row('B activity','2026-10-02')],nextCursor:null});
 await tick();
 assert.equal(h.calls.length,3,'only the visible cancelled render starts a fresh A request');
 h.calls[2].resolve({activities:[row('Fresh A','2026-09-03')],nextCursor:null});
 await Promise.all([first,second,back]);
 assert.match(h.host.innerHTML,/Fresh A/);
 assert.doesNotMatch(h.host.innerHTML,/Loading|abandoned|B activity/);
});

test('working types off then on recovers a still-pending cancelled load',async()=>{
 const h=pageHarness();let enabled=true;
 h.context.activityTypeFilter.selectedKeys=()=>enabled?['work:ccc']:[];
 const first=h.context.renderWorkingActivities();await tick();
 enabled=false;await h.context.renderWorkingActivities();
 enabled=true;const back=h.context.renderWorkingActivities();await tick();
 h.calls[0].resolve({activities:[],nextCursor:null});await tick();
 assert.equal(h.calls.length,2);
 h.calls[1].resolve({activities:[row('Restored','2026-09-02')],nextCursor:null});
 await Promise.all([first,back]);
 assert.match(h.host.innerHTML,/Restored/);
});

test('repeated current cancellation stops automatic retry and offers manual recovery',async()=>{
 const h=pageHarness();
 const first=h.context.renderWorkingActivities();await tick();
 h.context.view.clear();h.calls[0].resolve({activities:[],nextCursor:null});await tick();
 assert.equal(h.calls.length,2,'one automatic retry is allowed');
 h.context.view.clear();h.calls[1].resolve({activities:[],nextCursor:null});await first;
 assert.equal(h.calls.length,2,'cancellation cannot create an automatic request loop');
 assert.match(h.host.innerHTML,/activity-error/);assert.equal(typeof h.host.retry.onclick,'function');
 const manual=h.host.retry.onclick();await tick();
 h.calls[2].resolve({activities:[row('Recovered','2026-09-02')],nextCursor:null});await manual;
 assert.match(h.host.innerHTML,/Recovered/);
});
