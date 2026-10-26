'use strict';
// Behavioural tests for the Calendar search primitives. These execute the
// shipped module (no source-text matching): the debouncer, the scoped activity
// cache and the delegated session block controller.
const test=require('node:test');
const assert=require('node:assert/strict');
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
  get pending(){return timers.size;},
  get now(){return now;}
 };
 return clock;
}

function deferred(){
 let resolve,reject;
 const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});
 return {promise,resolve,reject};
}

test('a burst of ten keystrokes produces exactly one debounced render',()=>{
 const clock=fakeTimers(),renders=[];
 const debouncer=search.createDebouncer({delay:250,invoke:()=>renders.push(clock.now),setTimer:clock.setTimeout,clearTimer:clock.clearTimeout});
 for(let index=0;index<10;index+=1){debouncer.schedule();clock.advance(20);}
 assert.equal(renders.length,0,'nothing renders while the user is still typing');
 assert.equal(clock.pending,1,'a burst keeps a single pending timer');
 clock.advance(250);
 assert.equal(renders.length,1,'the burst collapses into one trailing render');
 assert.equal(renders[0],430,'the render runs 250 ms after the final keystroke (t=180)');
 assert.equal(clock.pending,0);
});

test('Enter flushes immediately and does not render twice',()=>{
 const clock=fakeTimers(),renders=[];
 const debouncer=search.createDebouncer({delay:250,invoke:()=>renders.push(clock.now),setTimer:clock.setTimeout,clearTimer:clock.clearTimeout});
 debouncer.schedule();
 clock.advance(100);
 assert.equal(debouncer.flush(),true);
 assert.equal(renders.length,1);
 clock.advance(1000);
 assert.equal(renders.length,1,'the scheduled render was consumed by the flush');
});

test('cancel drops a pending render and a rejected render never fires',()=>{
 const clock=fakeTimers(),renders=[];
 const debouncer=search.createDebouncer({delay:250,invoke:()=>renders.push(clock.now),setTimer:clock.setTimeout,clearTimer:clock.clearTimeout});
 debouncer.schedule();debouncer.cancel();clock.advance(1000);
 assert.equal(renders.length,0);
 assert.equal(debouncer.flush(),false,'flush with nothing pending is a no-op');
 assert.equal(renders.length,0);
});

test('the scope key separates users, support contexts, ranges and faculty scope',()=>{
 const base={uid:'user-a',start:'2026-09-01',end:'2026-09-08',facultyId:'',selfOnly:false};
 const key=search.activityScopeKey(base);
 assert.equal(new Set([
  key,
  search.activityScopeKey({...base,uid:'user-b'}),
  search.activityScopeKey({...base,supportContextId:'context-1'}),
  search.activityScopeKey({...base,start:'2026-09-02'}),
  search.activityScopeKey({...base,end:'2026-09-09'}),
  search.activityScopeKey({...base,facultyId:'faculty-1'}),
  search.activityScopeKey({...base,selfOnly:true})
 ]).size,7,'each isolation dimension addresses a different entry');
 assert.throws(()=>search.activityScopeKey({uid:'  '}),/authenticated user/);
});

test('an unauthenticated scope can never read cached calendar data',async()=>{
 let loads=0;
 const cache=search.createActivityCache({ttlMs:60000,now:()=>0});
 assert.throws(()=>cache.peek({uid:''}),/authenticated user/);
 assert.throws(()=>cache.has({uid:''}),/authenticated user/);
 await assert.rejects(cache.get({uid:''},{load:async()=>{loads+=1;return [];}}),/authenticated user/);
 assert.equal(loads,0);
});

test('concurrent and repeated reads of one scope load once and reuse the rows',async()=>{
 const pending=deferred();
 let loads=0;
 const cache=search.createActivityCache({ttlMs:60000,now:()=>0});
 const scope={uid:'user-a',start:'2026-09-01',end:'2026-09-08'};
 const first=cache.get(scope,{load:()=>{loads+=1;return pending.promise;}});
 const second=cache.get(scope,{load:()=>{loads+=1;return Promise.resolve(['duplicate']);}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(loads,1,'an in-flight read is joined, not repeated');
 pending.resolve([{id:'row-1'}]);
 assert.deepEqual(await first,[{id:'row-1'}]);
 assert.deepEqual(await second,[{id:'row-1'}],'both callers see the joined response');
 assert.deepEqual(await cache.get(scope,{load:()=>{loads+=1;return Promise.resolve([]);}}),[{id:'row-1'}]);
 assert.equal(loads,1,'a warm entry is served without another load');
 assert.deepEqual(cache.peek(scope),[{id:'row-1'}]);
});

test('changing the search text never invalidates the cached range',async()=>{
 // The page applies search inside renderRangeLane, so the cache key must not
 // contain the query: typing has to be served from memory.
 let loads=0;
 const cache=search.createActivityCache({ttlMs:60000,now:()=>0});
 for(const searchText of ['a','ab','abc']){
  await cache.get({uid:'user-a',start:'2026-09-01',end:'2026-09-08',text:searchText},{load:async()=>{loads+=1;return [];}});
 }
 assert.equal(loads,1);
});

test('a second user, range or faculty scope uses its own entry',async()=>{
 const cache=search.createActivityCache({ttlMs:60000,now:()=>0});
 const loads=[];
 const load=scope=>{loads.push(`${scope.uid}:${scope.start}:${scope.facultyId}`);return Promise.resolve([{owner:`${scope.uid}:${scope.facultyId}`}]);};
 const base={uid:'user-a',start:'2026-09-01',end:'2026-09-08',facultyId:''};
 assert.deepEqual(await cache.get(base,{load}),[{owner:'user-a:'}]);
 assert.deepEqual(await cache.get({...base,uid:'user-b'},{load}),[{owner:'user-b:'}]);
 assert.deepEqual(await cache.get({...base,start:'2026-10-01'},{load}),[{owner:'user-a:'}]);
 assert.deepEqual(await cache.get({...base,facultyId:'faculty-1',selfOnly:true},{load}),[{owner:'user-a:faculty-1'}]);
 assert.equal(loads.length,4);
 assert.equal(cache.size,4);
});

test('entries expire after the TTL and reload',async()=>{
 let now=0,loads=0;
 const cache=search.createActivityCache({ttlMs:1000,now:()=>now});
 const scope={uid:'user-a',start:'2026-09-01',end:'2026-09-08'};
 const load=async()=>{loads+=1;return [{load:loads}];};
 await cache.get(scope,{load});
 now=999;assert.equal(cache.peek(scope).length,1);assert.equal(cache.has(scope),true);
 now=1001;assert.equal(cache.peek(scope),null,'an expired entry is not painted');
 assert.deepEqual(await cache.get(scope,{load}),[{load:2}]);
 assert.equal(loads,2);
});

test('invalidation drops entries and discards responses already in flight',async()=>{
 const first=deferred();
 let loads=0;
 const cache=search.createActivityCache({ttlMs:60000,now:()=>0});
 const scope={uid:'user-a',start:'2026-09-01',end:'2026-09-08'};
 const inflight=cache.get(scope,{load:()=>{loads+=1;return first.promise;}});
 cache.invalidate();
 first.resolve([{id:'stale'}]);
 assert.deepEqual(await inflight,[{id:'stale'}],'the caller still receives its own response');
 assert.equal(cache.peek(scope),null,'but an invalidated response never repopulates the cache');
 assert.deepEqual(await cache.get(scope,{load:async()=>{loads+=1;return [{id:'fresh'}];}}),[{id:'fresh'}]);
 assert.equal(loads,2);
});

test('the newest response wins when an older request resolves last',async()=>{
 const older=deferred(),newer=deferred();
 const cache=search.createActivityCache({ttlMs:60000,now:()=>0});
 const scope={uid:'user-a',start:'2026-09-01',end:'2026-09-08'};
 const first=cache.get(scope,{load:()=>older.promise});
 const second=cache.get(scope,{refresh:true,load:()=>newer.promise});
 newer.resolve([{id:'newer'}]);
 assert.deepEqual(await second,[{id:'newer'}]);
 older.resolve([{id:'older'}]);
 await first;
 assert.deepEqual(cache.peek(scope),[{id:'newer'}],'the late older response cannot overwrite newer data');
});

test('a failed load is not cached so the retry really retries',async()=>{
 let loads=0;
 const cache=search.createActivityCache({ttlMs:60000,now:()=>0});
 const scope={uid:'user-a',start:'2026-09-01',end:'2026-09-08'};
 await assert.rejects(cache.get(scope,{load:async()=>{loads+=1;throw Error('offline');}}),/offline/);
 assert.equal(cache.peek(scope),null);
 assert.deepEqual(await cache.get(scope,{load:async()=>{loads+=1;return [{id:'recovered'}];}}),[{id:'recovered'}]);
 assert.equal(loads,2);
});

test('explicit refresh bypasses and replaces a warm entry',async()=>{
 let loads=0;
 const cache=search.createActivityCache({ttlMs:60000,now:()=>0});
 const scope={uid:'user-a',start:'2026-09-01',end:'2026-09-08'};
 await cache.get(scope,{load:async()=>{loads+=1;return [{id:`load-${loads}`}];}});
 assert.deepEqual(await cache.get(scope,{refresh:true,load:async()=>{loads+=1;return [{id:`load-${loads}`}];}}),[{id:'load-2'}]);
 assert.equal(loads,2);
 assert.deepEqual(cache.peek(scope),[{id:'load-2'}],'the refreshed rows replace the old entry');
});

function fakeHost(rows){
 const elements=rows.map(row=>{
  const classes=new Set();
  return {
   dataset:{sessionId:String(row.id)},
   row,
   classList:{
    toggle(name,on){if(on)classes.add(name);else classes.delete(name);},
    has:name=>classes.has(name)
   },
   classes
  };
 });
 const listeners=[];
 const host={
  elements,
  listeners,
  addEventListener(type,handler){if(type==='click')listeners.push(handler);},
  querySelectorAll:()=>elements.slice()
 };
 return host;
}

test('one delegated listener serves every row regardless of render count',()=>{
 let binds=0,opens=[];
 const rows=Array.from({length:200},(_,index)=>({id:`s-${index}`}));
 const host=fakeHost(rows);
 const originalAdd=host.addEventListener;
 host.addEventListener=(type,handler)=>{if(type==='click')binds+=1;originalAdd(type,handler);};
 const controller=search.createSessionBlockController({
  host,getRows:()=>rows,getSelectionMode:()=>false,isSelected:()=>false,
  onOpen:id=>opens.push(id),onToggle:()=>{},onRejected:()=>{}
 });
 for(let render=0;render<5;render+=1)controller.refresh();
 assert.equal(binds,1,'the container is bound once, not once per row or per render');
 assert.equal(controller.binds,1);
 assert.equal(controller.bound,true);
 assert.equal(host.listeners.length,1);
 assert.equal(controller.activeCount,200);
 assert.equal(controller.indexSize,200);
 for(const handler of host.listeners){
  handler({target:{closest:()=>host.elements[199]}});
  handler({target:{closest:()=>host.elements[0]}});
 }
 assert.deepEqual(opens,['s-199','s-0'],'a click resolves through the id index');
});

test('selection classes follow selection mode and CCC read-only state',()=>{
 const rows=[{id:'a'},{id:'b'},{id:'ccc',isCcc:true}];
 const host=fakeHost(rows);
 let selectionMode=false;
 const controller=search.createSessionBlockController({
  host,getRows:()=>rows,getSelectionMode:()=>selectionMode,isSelected:id=>id==='b',
  onOpen:()=>{},onToggle:()=>{},onRejected:()=>{}
 });
 controller.refresh();
 assert.equal(host.elements[0].classes.has('selection-candidate'),false,'no candidate classes outside selection mode');
 assert.equal(host.elements[1].classes.has('selection-selected'),true,'stored selection is reflected');
 selectionMode=true;
 controller.refresh();
 assert.equal(host.elements[0].classes.has('selection-candidate'),true);
 assert.equal(host.elements[2].classes.has('selection-candidate'),false,'CCC rows are never selectable');
 assert.equal(host.elements[1].classes.has('selection-selected'),true);
});

test('clicking a session opens the detail, toggles selection, and rejects CCC rows',()=>{
 const rows=[{id:'a'},{id:'ccc',isCcc:true}];
 const host=fakeHost(rows);
 const events={opens:[],toggles:[],rejections:[]};
 let selectionMode=false;
 const controller=search.createSessionBlockController({
  host,getRows:()=>rows,getSelectionMode:()=>selectionMode,isSelected:()=>false,
  onOpen:id=>events.opens.push(id),
  onToggle:(id,row)=>events.toggles.push([id,row?.id]),
  onRejected:message=>events.rejections.push(message)
 });
 controller.refresh();
 host.listeners[0]({target:{closest:()=>host.elements[0]}});
 assert.deepEqual(events.opens,['a'],'normal mode opens the detail view');
 selectionMode=true;controller.refresh();
 host.listeners[0]({target:{closest:()=>host.elements[0]}});
 assert.deepEqual(events.toggles,[['a','a']],'selection mode toggles the row');
 host.listeners[0]({target:{closest:()=>host.elements[1]}});
 assert.deepEqual(events.rejections,['CCC records are read-only and cannot be selected.']);
 assert.equal(events.toggles.length,1,'the blocked row was never toggled');
});

test('a selection limit error is reported instead of escaping the click handler',()=>{
 const rows=[{id:'a'}],host=fakeHost(rows),rejections=[];
 const controller=search.createSessionBlockController({
  host,getRows:()=>rows,getSelectionMode:()=>true,isSelected:()=>false,
  onOpen:()=>{},onToggle:()=>{throw Error('Select at most 200 sessions.');},onRejected:message=>rejections.push(message)
 });
 controller.refresh();
 host.listeners[0]({target:{closest:()=>host.elements[0]}});
 assert.deepEqual(rejections,['Select at most 200 sessions.']);
});

test('clicks outside a session block are ignored',()=>{
 const rows=[{id:'a'}],host=fakeHost(rows);
 let opened=0;
 const controller=search.createSessionBlockController({
  host,getRows:()=>rows,getSelectionMode:()=>false,isSelected:()=>false,onOpen:()=>{opened+=1;},onToggle:()=>{},onRejected:()=>{}
 });
 controller.refresh();
 assert.equal(controller.handleClick({target:{closest:()=>null}}),false);
 assert.equal(controller.handleClick({}),false);
 assert.equal(controller.handleClick(undefined),false);
 assert.equal(opened,0);
});
