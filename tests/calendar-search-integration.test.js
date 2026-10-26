'use strict';
// Integration tests for the shipped Calendar search wiring. These execute the
// real functions extracted from frontend/scripts/timetable.js inside a VM with
// stubbed collaborators, so the assertions observe behaviour (renders, network
// loads, DOM writes, click routing) rather than source text.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const sourceFunction=require('../test-support/source-function');
const search=require('../frontend/scripts/calendar-search.js');

function fakeTimers(){
 let now=0,next=1;
 const timers=new Map();
 const clock={
  setTimeout(callback,delay){const id=next++;timers.set(id,{at:now+Number(delay||0),callback});return id;},
  clearTimeout(id){timers.delete(id);},
  advance(ms){
   const target=now+Number(ms||0);
   for(let guard=0;guard<1000;guard+=1){
    let due=null;
    for(const [id,timer] of timers){if(timer.at<=target&&(!due||timer.at<due.at))due={id,...timer};}
    if(!due)break;
    timers.delete(due.id);now=due.at;due.callback();
   }
   now=target;
   return clock;
  },
  get pending(){return timers.size;}
 };
 return clock;
}

function fakeInput(){
 const listeners={};
 return {
  value:'',
  listeners,
  addEventListener(type,handler){(listeners[type]??=[]).push(handler);},
  fire(type,event={}){for(const handler of listeners[type]||[])handler(event);}
 };
}

function deferred(){
 let resolve,reject;
 const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});
 return {promise,resolve,reject};
}

// ---------------------------------------------------------------------------
// A. Search input wiring
// ---------------------------------------------------------------------------
function searchWiringHarness(){
 const clock=fakeTimers(),renders=[],input=fakeInput(),context={input};
 vm.createContext(context);
 vm.runInContext(sourceFunction('timetable.js','wireCalendarSearchInput'),context);
 return {clock,renders,input,context};
}

test('ten rapid keystrokes in the shipped search wiring produce one render',()=>{
 const {clock,renders,input,context}=searchWiringHarness();
 const debouncer=search.createDebouncer({delay:250,invoke:()=>renders.push(1),setTimer:clock.setTimeout,clearTimer:clock.clearTimeout});
 assert.equal(context.wireCalendarSearchInput(input,{schedule:()=>debouncer.schedule(),flush:()=>debouncer.flush()}),input);
 for(let index=0;index<10;index+=1){input.value+=String(index);input.fire('input');clock.advance(20);}
 assert.equal(renders.length,0,'typing does not render synchronously');
 assert.equal(clock.pending,1,'one pending render for the whole burst');
 clock.advance(250);
 assert.equal(renders.length,1,'the burst resolves to exactly one render');
});

test('Enter in the shipped search wiring applies the filter immediately',()=>{
 const {clock,renders,input,context}=searchWiringHarness();
 const debouncer=search.createDebouncer({delay:250,invoke:()=>renders.push(1),setTimer:clock.setTimeout,clearTimer:clock.clearTimeout});
 context.wireCalendarSearchInput(input,{schedule:()=>debouncer.schedule(),flush:()=>debouncer.flush()});
 input.fire('input');
 clock.advance(50);
 input.fire('keydown',{key:'Enter'});
 assert.equal(renders.length,1,'Enter flushes without waiting for the trailing edge');
 clock.advance(1000);
 assert.equal(renders.length,1,'the flushed render is not repeated');
});

test('non-Enter keys do not flush and a missing schedule callback is tolerated',()=>{
 const {clock,renders,input,context}=searchWiringHarness();
 const debouncer=search.createDebouncer({delay:250,invoke:()=>renders.push(1),setTimer:clock.setTimeout,clearTimer:clock.clearTimeout});
 context.wireCalendarSearchInput(input,{schedule:()=>debouncer.schedule(),flush:()=>debouncer.flush()});
 input.fire('input');
 input.fire('keydown',{key:'a'});
 input.fire('keydown',{key:'Enter',isComposing:true});
 assert.equal(renders.length,0);
 assert.equal(context.wireCalendarSearchInput(fakeInput(),{}),null,'a degenerate wiring request is refused, not thrown');
 clock.advance(250);
 assert.equal(renders.length,1);
});

// ---------------------------------------------------------------------------
// B. Working Activity rendering and caching
// ---------------------------------------------------------------------------
function activityHarness({cache=true,rows=[{id:'a'}]}={}){
 const host={
  _html:'',
  retry:null,
  get innerHTML(){return this._html;},
  set innerHTML(value){this._html=String(value);this.retry=this._html.includes('data-activity-retry')?{onclick:null}:null;},
  querySelector(selector){return selector==='[data-activity-retry]'?this.retry:null;}
 };
 const view={
  loads:[],
  paints:[],
  clears:0,
  responses:[],
  loadRange(range){this.loads.push({kind:'range',range});const next=this.responses.shift();return next?next():Promise.resolve(rows.slice());},
  loadFacultyRange(facultyId,range,options){this.loads.push({kind:'faculty',facultyId,range,options});const next=this.responses.shift();return next?next():Promise.resolve(rows.slice());},
  clear(){this.clears+=1;},
  renderRangeLane(painted,options){this.paints.push({painted,options});return `LANE:${painted.length}:${options.filters.search}`;}
 };
 const fields={'search-input':{value:''}};
 const context={
  host,view,fields,
  currentUser:{uid:'user-1',profile:{facultyId:'',role:'administrator'}},
  reviewingSelection:false,
  myTimetableOnly:false,
  activityTypeFilter:{selectedKeys:()=>['work:ccc']},
  workingActivityRange:()=>({start:'2026-09-01',end:'2026-09-08'}),
  workingActivityRenderToken:0,
  roleIsFaculty:()=>false,
  workingActivityCache:cache?search.createActivityCache({ttlMs:60000,now:()=>0}):null,
  $:id=>id==='working-activities-lane'?host:(fields[id]??(fields[id]={value:''})),
  window:{PAWS_CALENDAR_ACTIVITIES:view}
 };
 vm.createContext(context);
 vm.runInContext(sourceFunction('timetable.js','workingActivityScope'),context);
 context.setCalendarActivityRows=(rows,options)=>{host.innerHTML=view.renderRangeLane(rows,{...options.range,filters:options.filters});};
 vm.runInContext(sourceFunction('timetable.js','renderWorkingActivities'),context);
 return {context,host,view,fields};
}

test('a search over an already loaded range adds no activity request',async()=>{
 const {context,view,fields}=activityHarness();
 await context.renderWorkingActivities();
 assert.equal(view.loads.length,1);
 assert.equal(view.paints.length,1);
 for(const text of ['c','cl','cli','clin','clini']){
  fields['search-input'].value=text;
  await context.renderWorkingActivities();
 }
 assert.equal(view.loads.length,1,'searching a loaded period must not refetch');
 assert.equal(view.paints.length,6,'every search still repaints the filtered rows');
 assert.equal(view.paints.at(-1).options.filters.search,'clini');
});

test('changing the visible range fetches the new range exactly once',async()=>{
 const {context,view}=activityHarness();
 await context.renderWorkingActivities();
 context.workingActivityRange=()=>({start:'2026-10-01',end:'2026-10-08'});
 await context.renderWorkingActivities();
 assert.equal(view.loads.length,2);
 assert.deepEqual({...view.loads[1].range},{start:'2026-10-01',end:'2026-10-08'});
});

test('a different authenticated user never reads the previous cache',async()=>{
 const {context,view}=activityHarness();
 await context.renderWorkingActivities();
 context.currentUser={uid:'user-2',profile:{facultyId:'',role:'administrator'}};
 await context.renderWorkingActivities();
 assert.equal(view.loads.length,2,'the second user pays for its own scoped read');
 context.currentUser={uid:'user-1',profile:{facultyId:'',role:'administrator'}};
 await context.renderWorkingActivities();
 assert.equal(view.loads.length,2,'returning to the first user reuses only its own entry');
});

test('a support context is part of the cache scope',async()=>{
 const {context,view}=activityHarness();
 const support={contextId:()=>''};
 context.window.PAWS_SUPPORT=support;
 await context.renderWorkingActivities();
 support.contextId=()=>'support-context-1';
 await context.renderWorkingActivities();
 assert.equal(view.loads.length,2,'rows read under one support context are not reused under another');
});

test('a late response cannot replace a newer range result',async()=>{
 const {context,view,host}=activityHarness();
 const slow=deferred();
 view.responses.push(()=>slow.promise);
 const firstRender=context.renderWorkingActivities();
 context.workingActivityRange=()=>({start:'2026-10-01',end:'2026-10-08'});
 await context.renderWorkingActivities();
 const newer=host.innerHTML;
 assert.equal(newer,'LANE:1:');
 slow.resolve([{id:'old'},{id:'older'}]);
 await firstRender;
 assert.equal(host.innerHTML,newer,'the stale response never reaches the DOM');
 assert.equal(view.paints.length,1,'only the newer render painted');
});

test('empty results render the empty lane instead of an error',async()=>{
 const {context,view,host}=activityHarness({rows:[]});
 await context.renderWorkingActivities();
 assert.equal(view.paints.length,1);
 assert.equal(host.innerHTML,'LANE:0:');
});

test('a failed load offers a retry that bypasses the cache and succeeds',async()=>{
 const {context,view,host}=activityHarness();
 view.responses.push(()=>Promise.reject(Error('network down')));
 await context.renderWorkingActivities();
 assert.equal(view.paints.length,0);
 assert.match(host.innerHTML,/Working activities could not be loaded/);
 assert.ok(host.retry,'the retry control is offered');
 view.responses.push(()=>Promise.resolve([{id:'recovered'},{id:'second'}]));
 await host.retry.onclick();
 assert.equal(view.loads.length,2,'the retry really re-requests');
 assert.equal(view.paints.length,1);
 assert.equal(host.innerHTML,'LANE:2:');
});

test('a faculty-scoped view without a linked faculty id renders no rows and makes no request',async()=>{
 const {context,view,host}=activityHarness();
 context.myTimetableOnly=true;
 context.currentUser={uid:'user-1',profile:{facultyId:'',role:'faculty'}};
 await context.renderWorkingActivities();
 assert.equal(view.loads.length,0);
 assert.equal(view.paints.length,1);
 assert.equal(host.innerHTML,'LANE:0:');
});

test('the faculty scope is part of the cache key and passes the self flag through',async()=>{
 const {context,view}=activityHarness();
 context.myTimetableOnly=true;
 context.currentUser={uid:'user-1',profile:{facultyId:'faculty-1',role:'faculty'}};
 context.roleIsFaculty=()=>true;
 await context.renderWorkingActivities();
 await context.renderWorkingActivities();
 assert.equal(view.loads.length,1,'repeated renders reuse the faculty-scoped entry');
 assert.equal(view.loads[0].kind,'faculty');
 assert.equal(view.loads[0].facultyId,'faculty-1');
 assert.equal(view.loads[0].options.self,true);
 assert.equal(view.loads[0].options.onCancel,'throw','the page asks the view to report cancellation explicitly');
 context.currentUser={uid:'user-1',profile:{facultyId:'faculty-2',role:'faculty'}};
 await context.renderWorkingActivities();
 assert.equal(view.loads.length,2,'a different faculty scope is a different read');
});

test('Day, Week, Month and List views each request their own window and keep cached results',async()=>{
 const windows={
  day:{start:'2026-09-02',end:'2026-09-03'},
  week:{start:'2026-09-01',end:'2026-09-08'},
  month:{start:'2026-09-01',end:'2026-10-01'},
  list:{start:'2026-05-01',end:'2027-05-01'}
 };
 const {context,view}=activityHarness();
 for(const [mode,range] of Object.entries(windows)){
  context.workingActivityRange=()=>range;
  await context.renderWorkingActivities();
  const load=view.loads.at(-1);
  assert.deepEqual({...load.range},range,`${mode} requests its own window`);
 }
 assert.equal(view.loads.length,4);
 assert.equal(new Set(view.loads.map(load=>`${load.range.start}:${load.range.end}`)).size,4);
 for(const range of Object.values(windows)){context.workingActivityRange=()=>range;await context.renderWorkingActivities();}
 assert.equal(view.loads.length,4,'revisiting any view is served from memory');
 assert.equal(view.paints.length,8,'and still repaints the correct rows');
});

test('closing the activity scope clears the lane without touching the cache',async()=>{
 const {context,view,host}=activityHarness();
 await context.renderWorkingActivities();
 context.reviewingSelection=true;
 await context.renderWorkingActivities();
 assert.equal(host.innerHTML,'');
 assert.equal(view.clears,1);
 context.reviewingSelection=false;
 await context.renderWorkingActivities();
 assert.equal(view.loads.length,1,'the cached read survives a selection-mode detour');
});

// ---------------------------------------------------------------------------
// C. Delegated session binding
// ---------------------------------------------------------------------------
function element(id){
 const classes=new Set();
 return {
  dataset:{sessionId:String(id)},
  classes,
  classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);},has:name=>classes.has(name)}
 };
}

function sessionHarness(rows,{factory}={}){
 const elements=rows.map(row=>element(row.id));
 const host={
  elements,
  listeners:[],
  addEventListener(type,handler){if(type==='click')this.listeners.push(handler);},
  querySelectorAll:()=>elements.slice()
 };
 const opened=[],renders=[],controls=[],toasts=[];
 const context={
  sessionBlockController:null,
  renderedSessions:rows.map(row=>({...row})),
  selectionMode:false,
  sessionSelection:{selected:new Set(),has(id){return this.selected.has(id);},toggle(id){if(this.selected.has(id)){this.selected.delete(id);return false;}this.selected.add(id);return true;}},
  selectedSessionOriginals:new Map(),
  opened,
  renders,
  controls,
  toasts,
  document:{querySelectorAll(){throw Error('legacy per-element session binding was used');}},
  openSessionDetail(id){opened.push(id);},
  updateSelectionControls(){controls.push(1);},
  render(){renders.push(1);},
  toast(message){toasts.push(message);},
  $:id=>id==='calendar-body'?host:null,
  window:{UCVM_CALENDAR_SEARCH:factory===undefined?search:factory}
 };
 vm.createContext(context);
 vm.runInContext(sourceFunction('timetable.js','createInlineSessionBlockController'),context);
 vm.runInContext(sourceFunction('timetable.js','scheduledSessionBlockController'),context);
 vm.runInContext(sourceFunction('timetable.js','bindSessionBlocks'),context);
 return {context,host};
}

test('the shipped binding attaches one delegated listener and opens a session',()=>{
 const {context,host}=sessionHarness([{id:'s-a'},{id:'s-b'},{id:'s-c',isCcc:true}]);
 context.bindSessionBlocks();
 context.bindSessionBlocks();
 context.bindSessionBlocks();
 assert.equal(host.listeners.length,1,'one listener for the container, not one per row');
 assert.equal(context.sessionBlockController.binds,1);
 assert.equal(context.sessionBlockController.indexSize,3);
 host.listeners[0]({target:{closest:()=>host.elements[1]}});
 assert.deepEqual(context.opened,['s-b']);
});

test('selection mode toggles the clicked row and repaints once',()=>{
 const rows=[{id:'s-a'},{id:'s-b'},{id:'s-c',isCcc:true}];
 const {context,host}=sessionHarness(rows);
 context.selectionMode=true;
 context.bindSessionBlocks();
 assert.equal(host.elements[0].classes.has('selection-candidate'),true);
 host.listeners[0]({target:{closest:()=>host.elements[0]}});
 assert.deepEqual([...context.sessionSelection.selected],['s-a']);
 assert.equal(context.selectedSessionOriginals.has('s-a'),true,'the pre-edit original is captured');
 assert.equal(context.renders.length,1,'the grid repaints after a selection change');
 assert.equal(context.controls.length,1);
 assert.equal(host.elements[0].classes.has('selection-selected'),false,'classes refresh on the next render');
 context.bindSessionBlocks();
 assert.equal(host.elements[0].classes.has('selection-selected'),true);
});

test('a CCC row is still read-only through the delegated handler',()=>{
 const {context,host}=sessionHarness([{id:'s-ccc',isCcc:true}]);
 context.selectionMode=true;
 context.bindSessionBlocks();
 host.listeners[0]({target:{closest:()=>host.elements[0]}});
 assert.deepEqual(context.toasts,['CCC records are read-only and cannot be selected.']);
 assert.equal(context.sessionSelection.selected.size,0);
 assert.equal(context.renders.length,0);
});

test('a click on a row that is not in the current result still opens its detail',()=>{
 const {context,host}=sessionHarness([{id:'s-a'}]);
 context.renderedSessions=[];
 context.bindSessionBlocks();
 host.listeners[0]({target:{closest:()=>host.elements[0]}});
 assert.deepEqual(context.opened,['s-a'],'unknown rows keep the previous open behaviour');
});

// ---------------------------------------------------------------------------
// D. Degraded mode: calendar-search.js did not load.
// ---------------------------------------------------------------------------
test('the shipped module is preferred when it is available',()=>{
 let created=0;
 const factory={createSessionBlockController(options){created+=1;return search.createSessionBlockController(options);}};
 const {context,host}=sessionHarness([{id:'s-a'}],{factory});
 context.bindSessionBlocks();
 assert.equal(created,1,'the module controller is constructed once');
 assert.equal(host.listeners.length,1);
 host.listeners[0]({target:{closest:()=>host.elements[0]}});
 assert.deepEqual(context.opened,['s-a']);
});

test('without the module the fallback still opens a session, once per click',()=>{
 const {context,host}=sessionHarness([{id:'s-a'},{id:'s-b'}],{factory:null});
 context.bindSessionBlocks();
 context.bindSessionBlocks();
 context.bindSessionBlocks();
 assert.equal(host.listeners.length,1,'one delegated listener, not one per row or per bind');
 host.listeners[0]({target:{closest:()=>host.elements[1]}});
 assert.deepEqual(context.opened,['s-b'],'the click was handled exactly once');
});

test('the fallback preserves selection mode, CCC read-only and the limit error',()=>{
 const rows=[{id:'s-a'},{id:'s-ccc',isCcc:true}];
 const {context,host}=sessionHarness(rows,{factory:null});
 context.bindSessionBlocks();
 context.selectionMode=true;
 context.bindSessionBlocks();
 assert.equal(host.elements[0].classes.has('selection-candidate'),true);
 assert.equal(host.elements[1].classes.has('selection-candidate'),false,'CCC rows are never selectable');
 host.listeners[0]({target:{closest:()=>host.elements[0]}});
 assert.deepEqual([...context.sessionSelection.selected],['s-a']);
 assert.equal(context.selectedSessionOriginals.has('s-a'),true);
 assert.equal(context.renders.length,1);
 assert.equal(context.controls.length,1);
 host.listeners[0]({target:{closest:()=>host.elements[1]}});
 assert.deepEqual(context.toasts,['CCC records are read-only and cannot be selected.']);
 context.sessionSelection.toggle=()=>{throw Error('Select at most 200 sessions.');};
 host.listeners[0]({target:{closest:()=>host.elements[0]}});
 assert.deepEqual(context.toasts.at(-1),'Select at most 200 sessions.');
});

test('the fallback ignores clicks that are not on a session block',()=>{
 const {context,host}=sessionHarness([{id:'s-a'}],{factory:null});
 context.bindSessionBlocks();
 assert.equal(host.listeners.length,1);
 host.listeners[0]({target:{closest:()=>null}});
 host.listeners[0]({});
 assert.deepEqual(context.opened,[]);
});

// ---------------------------------------------------------------------------
// E. Degraded mode: the search module did not load.
// ---------------------------------------------------------------------------
test('without the search module the field keeps an immediate render listener',()=>{
 const listeners={};
 const input={value:'',addEventListener(type,handler){(listeners[type]??=[]).push(handler);}};
 const rendered=[];
 const context={
  'search-input':input,
  $:id=>id==='search-input'?input:null,
  searchDebouncer:null,
  wireCalendarSearchInput(){throw Error('the debounce cannot be used without its module');},
  render(){rendered.push(1);}
 };
 vm.createContext(context);
 vm.runInContext(sourceFunction('timetable.js','bindCalendarSearchInput'),context);
 assert.equal(context.bindCalendarSearchInput(),input);
 assert.equal((listeners.input||[]).length,1);
 for(let index=0;index<3;index+=1){input.value+=String(index);for(const handler of listeners.input)handler({});}
 assert.equal(rendered.length,3,'each keystroke renders immediately when the module is absent');
});
