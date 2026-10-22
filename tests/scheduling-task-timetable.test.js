'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const sourceFunction=require('../test-support/source-function');
const source=fs.readFileSync(repositoryPath(__dirname,'../timetable.js'),'utf8');
// Run the shipped adapter and cache implementation, stubbing only external fetch/UI boundaries.
function harness(){
 const state={rows:[{id:'existing',academicYear:'2026-27',topic:'old'}],fetches:0,notifications:0,opened:[],errors:[]};
 const context={state,console,Map,Promise,Boolean,String,Number,Math,Date,
  window:{PAWS_TASKS:{configure:adapter=>{state.adapter=adapter;}}},
  fetchPawsSessions:async()=>{state.fetches++;return state.rows.map(row=>({...row}));},
  publishPageData:()=>{state.notifications++;},calendarTimingDisposition:()=>({}),unpositionedReason:()=>'',
  openSessionDetail:(id,session)=>state.opened.push({id,topic:session?.topic}),toast:message=>state.errors.push(message),
  parseYmd:value=>new Date(value),academicPositionForDate:()=>({semester:'fall',week:1}),WEEK_COUNT:52,
  $:()=>({value:''}),selectedCourses:new Set(),populateCourseFilter:()=>{},document:{querySelectorAll:()=>[]},
  renderWeekControls:()=>{},syncWeekUI:()=>{},refreshSessionScope:async()=>true
 };
 vm.createContext(context);
 vm.runInContext(`let currentUser={uid:'synthetic-a'},listAcademicYear='2026-27';let allSessionsCache=null,allSessionsOwnerUid='',allSessionsLoading=null,allSessionsLoadingUid='',allSessionsLoadGeneration=0;const sessionCache=new Map();${sourceFunction('timetable.js','fullSessionCacheForUser')}\n${sourceFunction('timetable.js','ensureAllSessions')}\n${source.slice(source.indexOf('window.PAWS_TASKS?.configure('),source.indexOf('pageDataSubscribers.add(()=>{window.PAWS_TASKS?.refresh();'))}`,context);
 return {state,context};
}
test('real Tasks timetable adapter refreshes cached scope and opens current or newly created sessions',async()=>{
 const {state}=harness();
 await state.adapter.allSessions();
 state.rows=[{id:'existing',academicYear:'2026-27',topic:'edited'},{id:'new-session',academicYear:'2027-28',topic:'created'}];
 const rows=await state.adapter.allSessions();
 assert.equal(rows.length,2,'Tasks refresh reused an obsolete permanent cache');
 assert.equal(state.notifications,0,'Tasks refresh must not recursively notify its own subscriber');
 await state.adapter.openSession('new-session');
 await state.adapter.openSession('existing');
 assert.deepEqual(state.opened,[{id:'new-session',topic:'created'},{id:'existing',topic:'edited'}]);
 // It must also revalidate a session modified after the queue refresh.
 state.rows[0].topic='changed after queue refresh';
 await state.adapter.openSession('existing');assert.equal(state.opened.at(-1).topic,'changed after queue refresh');
 state.rows=[];await state.adapter.openSession('new-session');
 assert.equal(state.opened.length,3);assert.match(state.errors.at(-1),/no longer available/i);
});
test('real Tasks navigation ignores results from a previous account and reports a failed refresh',async()=>{
 const {state,context}=harness();
 context.fetchPawsSessions=()=>new Promise(resolve=>{state.resolve=resolve;});
 const pending=state.adapter.openSession('new-session');
 await Promise.resolve();vm.runInContext("currentUser={uid:'synthetic-b'};",context);
 state.resolve([{id:'new-session',topic:'other-account'}]);await pending;
 assert.equal(state.opened.length,0);
 context.fetchPawsSessions=async()=>{throw Error('PRIVATE backend');};
 await state.adapter.openSession('existing');
 assert.equal(state.opened.length,0);assert.match(state.errors.at(-1),/could not be refreshed/i);assert.doesNotMatch(state.errors.join(' '),/PRIVATE/);
});
