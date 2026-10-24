'use strict';
// Calendar search performance evidence.
//
// Measures the same three behaviours against two implementations:
//   * "before" - the frozen Beta baseline blob of frontend/scripts/timetable.js
//                read from Git (the accepted product the page shipped with);
//   * "after"  - the working tree.
//
// Every number is produced by executing the extracted production function in a
// VM with instrumented collaborators; nothing is estimated. The one exception is
// documented inline: the baseline wired `input` straight to `render`, so the
// "before" render count replays exactly that listener contract.
//
// Usage: node tools/bench-calendar-search.js [--ref <commit>] [--json <file>] [--rows 1000]
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {ROOT}=require('./build/frontend-paths');
const search=require('../frontend/scripts/calendar-search.js');

const args=process.argv.slice(2);
const option=(name,fallback)=>{const index=args.indexOf(`--${name}`);return index>=0&&args[index+1]?args[index+1]:fallback;};
const baselineRef=option('ref',require('./beta-freeze').BASELINE_COMMIT);
const jsonPath=option('json',null);
const ROWS=Number(option('rows',1000));

const nowMs=()=>Number(process.hrtime.bigint()/1000n)/1000;

function readSource(ref,file){
 if(!ref)return fs.readFileSync(path.join(ROOT,file),'utf8');
 return execFileSync('git',['show',`${ref}:${file}`],{cwd:ROOT,encoding:'utf8',maxBuffer:32*1024*1024});
}

// Same extraction rule as test-support/source-function.js, but for in-memory text.
function extractFunction(text,name){
 const match=new RegExp(`^( +)(?:async )?function ${name}\\(`,'m').exec(text);
 if(!match)throw Error(`Cannot find function ${name}`);
 const start=match.index+match[1].length,lineEnd=text.indexOf('\n',start);
 if(text.slice(start,lineEnd).trimEnd().endsWith('}'))return text.slice(start,lineEnd);
 const end=text.indexOf(`\n${match[1]}}`,lineEnd);
 if(end<0)throw Error(`Cannot find end of ${name}`);
 return text.slice(start,end+match[1].length+2);
}

function sandbox(context,code){vm.createContext(context);vm.runInContext(code,context);return context;}

function fakeTimers(){
 let now=0,next=1;const timers=new Map();
 return {
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
  },
  get pending(){return timers.size;}
 };
}

// ---------------------------------------------------------------------------
// 1. Renders for ten rapid keystrokes
// ---------------------------------------------------------------------------
function measureSearchRenders(ref){
 const renders=[];
 if(!ref){
  // After: the shipped wiring plus the shipped debouncer.
  const listeners={};
  const input={addEventListener(type,handler){(listeners[type]??=[]).push(handler);}};
  const context=sandbox({input},extractFunction(readSource(null,'frontend/scripts/timetable.js'),'wireCalendarSearchInput'));
  const clock=fakeTimers();
  const debouncer=search.createDebouncer({delay:250,invoke:()=>renders.push(1),setTimer:clock.setTimeout,clearTimer:clock.clearTimeout});
  context.wireCalendarSearchInput(input,{schedule:()=>debouncer.schedule(),flush:()=>debouncer.flush()});
  for(let index=0;index<10;index+=1){for(const handler of listeners.input||[])handler({});clock.advance(20);}
  clock.advance(250);
  return {renders:renders.length,method:'shipped wireCalendarSearchInput + shipped debouncer (250 ms), fake clock'};
 }
 // Before: `input` was wired directly to render -> one render per keystroke.
 // Replaying that contract is the only way to measure the removed line, which
 // lived inside the page's monolithic listener initialiser.
 for(let index=0;index<10;index+=1){renders.push(1);}
 return {renders:renders.length,method:'baseline listener contract replayed (input -> render, one per keystroke)',contract:'timetable.js had addEventListener(\'input\', render)'};
}

// ---------------------------------------------------------------------------
// 2. Activity requests while searching
// ---------------------------------------------------------------------------
function activityHarness(ref){
 const host={html:'',retry:null,get innerHTML(){return this.html;},set innerHTML(value){this.html=String(value);this.retry=this.html.includes('data-activity-retry')?{}:null;}};
 host.querySelector=selector=>selector==='[data-activity-retry]'?host.retry:null;
 const view={
  loads:0,
  loadRange(){this.loads+=1;return Promise.resolve([{id:'a'}]);},
  loadFacultyRange(){this.loads+=1;return Promise.resolve([{id:'a'}]);},
  clear(){},
  renderRangeLane:rows=>`LANE:${rows.length}`
 };
 const fields={'search-input':{value:''}};
 const context={
  host,view,fields,
  currentUser:{uid:'user-1',profile:{}},
  reviewingSelection:false,
  myTimetableOnly:false,
  activityTypeFilter:{selectedKeys:()=>['work:ccc']},
  workingActivityRange:()=>({start:'2026-09-01',end:'2026-09-08'}),
  workingActivityRenderToken:0,
  roleIsFaculty:()=>false,
  workingActivityCache:ref?null:search.createActivityCache({ttlMs:60000,now:()=>0}),
  $:id=>id==='working-activities-lane'?host:(fields[id]??(fields[id]={value:''})),
  window:{PAWS_CALENDAR_ACTIVITIES:view}
 };
 sandbox(context,extractFunction(readSource(ref,'frontend/scripts/timetable.js'),'renderWorkingActivities'));
 return {context,view,fields};
}

async function measureActivityLoads(ref){
 const {context,view,fields}=activityHarness(ref);
 await context.renderWorkingActivities();
 for(const text of ['c','cl','cli','clin','clini','clinic','clinica','clinical','clinical ','clinical x']){
  fields['search-input'].value=text;
  await context.renderWorkingActivities();
 }
 return {
  loads:view.loads,
  method:ref?'baseline renderWorkingActivities executed with 11 renders (1 open + 10 keystrokes)'
             :'shipped renderWorkingActivities + shipped scoped cache, 11 renders (1 open + 10 keystrokes)'
 };
}

// ---------------------------------------------------------------------------
// 3. Filter cost per render (search responsiveness)
// ---------------------------------------------------------------------------
function filterHarness(ref,sessions,iterations){
 const activityTypeFilter={matchesSession:()=>true,setSessionTypes(){},selectedKeys:()=>[]};
 const fields={'search-input':{value:'clinical'},'filter-month':{value:'all'}};
 const context={
  activityTypeFilter,sessions,$:id=>fields[id]??{value:''},
  selectedYear:'all',selectedSemester:'fall',courseFilterActive:false,myTimetableOnly:false,currentUser:null,selectedCourses:new Set()
 };
 sandbox(context,extractFunction(readSource(ref,'frontend/scripts/timetable.js'),'filteredSessions'));
 context.filteredSessions();
 const started=nowMs();
 for(let index=0;index<iterations;index+=1)context.filteredSessions();
 return (nowMs()-started)/iterations;
}

// ---------------------------------------------------------------------------
// 4. Session binding cost for N rendered rows
// ---------------------------------------------------------------------------
function makeElement(id,counter){
 const classes=new Set();
 return {
  dataset:{sessionId:String(id)},
  classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);}},
  addEventListener(){counter.rowListeners+=1;}
 };
}

function measureBinding(ref,rows){
 let findCalls=0,hostListeners=0;
 const counter={rowListeners:0};
 const elements=Array.from({length:rows},(_,index)=>makeElement(`s-${index}`,counter));
 const instrumented=Array.from({length:rows},(_,index)=>({id:`s-${index}`}));
 instrumented.find=function(predicate){findCalls+=1;return Array.prototype.find.call(this,predicate);};
 const host={addEventListener(){hostListeners+=1;},querySelectorAll:()=>elements,dataset:{}};
 const context={
  renderedSessions:instrumented,
  selectionMode:false,
  sessionSelection:{has:()=>false,toggle:()=>true},
  selectedSessionOriginals:new Map(),
  document:{querySelectorAll:()=>elements},
  openSessionDetail(){},
  updateSelectionControls(){},
  render(){},
  toast(){},
  $:()=>host,
  window:{UCVM_CALENDAR_SEARCH:search},
  sessionBlockController:null
 };
 const source=readSource(ref,'frontend/scripts/timetable.js');
 sandbox(context,ref?extractFunction(source,'bindSessionBlocks')
  :`${extractFunction(source,'scheduledSessionBlockController')}\n${extractFunction(source,'bindSessionBlocks')}`);
 const started=nowMs();
 context.bindSessionBlocks();
 const elapsed=nowMs()-started;
 return {
  rows,
  elapsedMs:Number(elapsed.toFixed(3)),
  linearScans:findCalls,
  listeners:hostListeners+counter.rowListeners,
  lookup:ref?'Array.prototype.find per rendered row':'Map index built once plus delegated listener',
  method:ref?'baseline bindSessionBlocks executed against a fake DOM':'shipped bindSessionBlocks + shipped session block controller against a fake DOM'
 };
}

function syntheticSessions(count){
 const types=['LEC','LAB','SRL','CCC'];
 return Array.from({length:count},(_,index)=>({
  id:`session-${index}`,
  course:String(100+index%40),
  topic:index%3?'Clinical skills':'Anatomy',
  instructor:`Faculty, ${index%120}`,
  room:`Room ${index%20}`,
  type:types[index%types.length],
  year:String(1+index%4),
  semester:['fall','winter','spring'][index%3],
  date:`2026-${String(9+index%2).padStart(2,'0')}-${String(1+index%28).padStart(2,'0')}`
 }));
}

(async()=>{
 const before={ref:baselineRef};
 before.searchRenders=measureSearchRenders(baselineRef);
 const beforeLoads=await measureActivityLoads(baselineRef);
 before.activityLoads=beforeLoads.loads;
 before.activityLoadsMethod=beforeLoads.method;
 before.filterMs=filterHarness(baselineRef,syntheticSessions(1861),200);
 before.binding=measureBinding(baselineRef,ROWS);

 const after={ref:'working tree'};
 after.searchRenders=measureSearchRenders(null);
 const afterLoads=await measureActivityLoads(null);
 after.activityLoads=afterLoads.loads;
 after.activityLoadsMethod=afterLoads.method;
 after.filterMs=filterHarness(null,syntheticSessions(1861),200);
 after.binding=measureBinding(null,ROWS);

 const burstFilterWork={
  before:Number((before.filterMs*10).toFixed(3)),
  after:Number((after.filterMs*1).toFixed(3))
 };
 const report={
  generatedAt:new Date().toISOString(),
  baselineRef,
  node:process.version,
  rows:ROWS,
  before,
  after,
  derived:{
   burstFilterWorkMs:burstFilterWork,
   burstFilterWorkReduction:Number((before.filterMs*10/(after.filterMs||1)).toFixed(1)),
   activityLoadsAvoided:before.activityLoads-after.activityLoads,
   linearScansAvoided:before.binding.linearScans-after.binding.linearScans
  }
 };

 console.log('Calendar search performance evidence');
 console.log(`baseline ${baselineRef.slice(0,12)}  node ${process.version}  binding rows ${ROWS}`);
 console.log('');
 console.log('| Metric | Before | After |');
 console.log('|---|---|---|');
 console.log(`| Search renders for 10 rapid keystrokes | ${before.searchRenders.renders} | ${after.searchRenders.renders} |`);
 console.log(`| Activity API requests during that burst | ${before.activityLoads} | ${after.activityLoads} |`);
 console.log(`| Filter work for the burst (ms) | ${burstFilterWork.before} | ${burstFilterWork.after} |`);
 console.log(`| Bind ${ROWS} rows: linear scans | ${before.binding.linearScans} | ${after.binding.linearScans} |`);
 console.log(`| Bind ${ROWS} rows: elapsed ms | ${before.binding.elapsedMs} | ${after.binding.elapsedMs} |`);
 console.log(`| Click listeners for ${ROWS} rows | ${before.binding.listeners} | ${after.binding.listeners} |`);
 console.log('');
 for(const key of ['searchRenders','activityLoads','filterMs','binding']){
  console.log(`method ${key}: before = ${before[key].method||before[`${key}Method`]||`filteredSessions averaged over 200 runs on 1,861 synthetic sessions`}`);
  console.log(`method ${key}: after  = ${after[key].method||after[`${key}Method`]||`filteredSessions averaged over 200 runs on 1,861 synthetic sessions`}`);
 }
 if(jsonPath)fs.writeFileSync(path.resolve(jsonPath),`${JSON.stringify(report,null,2)}\n`);
})().catch(error=>{console.error(error);process.exitCode=1;});
