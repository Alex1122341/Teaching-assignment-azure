'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
let createEffectiveAccessGuard;
try{({createEffectiveAccessGuard}=require('../frontend/scripts/effective-access-guard'));}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
const access=(patch={})=>({allowed:true,status:'ready',role:'faculty',facultyId:'faculty-a',version:'0000000000000001',...patch});
test('teaching authority epoch and current academic year invalidate a page with unchanged base access',()=>{
 for(const patch of [{scopeVersion:'b'.repeat(64)},{academicYear:'2027-28'},{scopeVersion:null}]){
  const h=fixture(),initial=access({scopeVersion:'a'.repeat(64),academicYear:'2026-27'});
  h.guard.observe(initial);const pending=h.guard.capture();h.guard.observe({...initial,...patch});
  assert.equal(h.guard.current(pending),false);assert.deepEqual(h.changes,['changed']);
 }
 const malformed=fixture();malformed.guard.observe(access({scopeVersion:'untrusted'}));assert.deepEqual(malformed.changes,['unverified']);
});
function fixture(load=async()=>access()){
 assert.equal(typeof createEffectiveAccessGuard,'function');const changes=[];
 return {changes,guard:createEffectiveAccessGuard({load,onChange:reason=>changes.push(reason)})};
}
test('SQL scope or version changes invalidate pending private results without a token refresh',()=>{
 for(const patch of [{role:'hicc'},{facultyId:'faculty-b'},{version:'0000000000000002'},{allowed:false,status:'inactive'},{allowed:false,status:'password_required'}]){
  const h=fixture();h.guard.observe(access());const token=h.guard.capture();assert.equal(h.guard.current(token),true);
  h.guard.observe(access(patch));assert.equal(h.guard.current(token),false);assert.equal(h.changes.length,1);h.guard.observe(access(patch));assert.equal(h.changes.length,1);
 }
 const unchanged=fixture();unchanged.guard.observe(access());const generation=unchanged.guard.capture();unchanged.guard.observe(access({displayName:'Updated display'}));assert.equal(unchanged.guard.current(generation),true);assert.equal(unchanged.changes.length,0);
});
test('revoked or unverifiable access clears private state, while ordinary business denial does not sign out',async()=>{
 const h=fixture();h.guard.observe(access());h.guard.reject({status:403,code:'AFC_SCOPE_DENIED'});assert.equal(h.changes.length,0);
 h.guard.reject({status:403,code:'PROFILE_REQUIRED'});assert.equal(h.changes.length,1);
 const missing=fixture();missing.guard.observe(access({version:null}));assert.equal(missing.guard.current(missing.guard.capture()),false);
 const failed=fixture(async()=>{throw Error('Service unavailable');});failed.guard.observe(access());await failed.guard.check();assert.equal(failed.changes[0],'unverified');
});

test('an ordinary current-profile response detects changed scope before the next polling interval',()=>{
 const h=fixture();h.guard.observe(access());assert.equal(typeof h.guard.observeProfile,'function');h.guard.observeProfile({active:true,role:'hicc',facultyId:'faculty-a'});assert.equal(h.changes.length,1);
 const race=fixture();race.guard.observeProfile({active:true,role:'faculty',facultyId:'faculty-a'});race.guard.observe(access({facultyId:'faculty-b'}));assert.equal(race.changes.length,1);
});
test('focus and polling checks share one pending authoritative read and teardown stops listeners',async()=>{
 let done,reads=0;const h=fixture(()=>{reads++;return new Promise(resolve=>done=resolve);});h.guard.observe(access());
 const events=new Map(),timers=new Map();let serial=0;
 const surface={addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:(name,fn)=>{if(events.get(name)===fn)events.delete(name);},setInterval:fn=>{timers.set(++serial,fn);return serial;},clearInterval:id=>timers.delete(id)};
 const stop=h.guard.start(surface,()=>true);events.get('focus')();[...timers.values()][0]();await Promise.resolve();assert.equal(reads,1);done(access({version:'0000000000000002'}));await h.guard.check();assert.equal(h.changes.length,1);stop();assert.equal(events.size,0);assert.equal(timers.size,0);
});

test('initial transport failure preserves existing sign-in recovery when no private scope was verified',async()=>{
 const h=fixture(async()=>{throw Object.assign(Error('Temporary API outage'),{code:'SERVICE_UNAVAILABLE',status:503});});
 await assert.rejects(h.guard.check(),error=>error.code==='SERVICE_UNAVAILABLE');assert.equal(h.changes.length,0);assert.equal(h.guard.current(h.guard.capture()),true);
});

test('all API entry pages load the SQL revocation guard and shared helper starts it without a legacy privilege listener',()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 for(const name of ['index','faculty-admin','teaching-assignments']){
  const html=fs.readFileSync('frontend/pages/'+name+'.html','utf8');assert.ok(html.includes('src="effective-access-guard.js"'),name);
 }
 let starts=0,legacy=0;const auth={},db={enablePersistence:()=>Promise.resolve(),doc:()=>{legacy++;throw Error('Legacy listener');}};
 const window={UCVM_EFFECTIVE_ACCESS:{guard:{},start:value=>{assert.equal(value,auth);starts++;}}};
 const context={window,document:{getElementById:()=>null},firebase:{apps:[{}],firestore:()=>db,auth:()=>auth},console};
 vm.runInNewContext(fs.readFileSync('frontend/scripts/faculty-access.js','utf8'),context);
 window.UCVM.init();const stop=window.UCVM.watch({uid:'person'},{});assert.equal(typeof stop,'function');assert.equal(starts,1);assert.equal(legacy,0);
});


function browserFixture(load=async()=>access()){
 const fs=require('node:fs'),vm=require('node:vm');
 const listeners=new Map(),callbacks=[],events=[],navigations=[],storage=new Map([['paws-support-context-v1','synthetic-old-context'],['ucvm_session_notice_v1','synthetic-notice']]);
 const node=tag=>({tag,children:[],textContent:'',append(...children){this.children.push(...children);},setAttribute(){},focus(){}});
 const privateRow=node('article');privateRow.textContent='synthetic-private-record';
 const body=node('body');body.children=[privateRow];body.replaceChildren=function(...children){this.children=children;};
 const auth={currentUser:null,onAuthStateChanged(fn){callbacks.push(fn);return()=>{};},signOut(){this.currentUser=null;for(const fn of callbacks)fn(null);return Promise.resolve();}};
 const root={
  document:{body,createElement:node},
  location:{replace:destination=>navigations.push(destination),reload:()=>navigations.push('reload')},
  sessionStorage:{removeItem:key=>storage.delete(key)},
  UCVM_PAWS_DATA:{effectiveAccess:load},
  CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},
  dispatchEvent(event){events.push({reason:event.detail.reason,privateStillPresent:body.children.includes(privateRow)});for(const fn of listeners.get(event.type)||[])fn(event);},
  addEventListener(type,fn){listeners.set(type,[...(listeners.get(type)||[]),fn]);},
  removeEventListener(){},setInterval(){return 1;},clearInterval(){}
 };
 vm.runInNewContext(fs.readFileSync('frontend/scripts/effective-access-guard.js','utf8'),{window:root});
 const controller=root.UCVM_EFFECTIVE_ACCESS.start(auth),guard=controller.guard;
 const state=user=>{auth.currentUser=user;for(const fn of callbacks)fn(user);};
 return {root,auth,guard,state,body,events,navigations,storage,privateRow};
}

test('initial anonymous state does not redirect; logout blocks old generation, clears private DOM and replaces the document',async()=>{
 const h=browserFixture();
 h.state(null);assert.equal(h.navigations.length,0);assert.equal(h.guard.current(h.guard.capture()),true);
 h.state({uid:'synthetic-a'});await h.guard.check();
 const oldGeneration=h.guard.capture();assert.equal(h.guard.current(oldGeneration),true);
 h.state(null);
 assert.deepEqual(h.events.map(event=>event.reason),['signed_out']);
 assert.equal(h.events[0].privateStillPresent,true,'clear events are dispatched before DOM replacement');
 assert.equal(h.guard.current(oldGeneration),false);assert.equal(h.guard.current(h.guard.capture()),false);
 assert.equal(h.body.children.includes(h.privateRow),false);
 assert.equal(h.body.children[0].children[0].textContent,'Signed out');
 assert.deepEqual(h.navigations,['index.html']);
 assert.equal(h.storage.has('paws-support-context-v1'),false);assert.equal(h.storage.has('ucvm_session_notice_v1'),true);
 h.state(null);assert.deepEqual(h.navigations,['index.html']);
 // A late user callback must not revive the already invalidated guard.
 h.state({uid:'synthetic-a'});assert.equal(h.guard.current(h.guard.capture()),false);
});

test('non-null identity change, SQL revocation and unverifiable authority stay blocked and clear the old surface',async()=>{
 const cases=[
  {action:h=>h.state({uid:'synthetic-b'}),reason:'changed'},
  {action:h=>h.guard.reject({code:'PROFILE_REQUIRED',status:403}),reason:'changed'},
  {action:h=>h.guard.observe(access({version:'0000000000000002'})),reason:'changed'},
  {action:h=>h.guard.observe(access({scopeVersion:'not-a-valid-version'})),reason:'unverified'}
 ];
 for(const {action,reason} of cases){
  const h=browserFixture();h.state({uid:'synthetic-a'});await h.guard.check();const token=h.guard.capture();
  action(h);assert.equal(h.guard.current(token),false);assert.deepEqual(h.events.map(e=>e.reason),[reason]);
  assert.equal(h.body.children.includes(h.privateRow),false);assert.deepEqual(h.navigations,[]);
  assert.equal(h.body.children[0].children[0].textContent,reason==='unverified'?'Access could not be checked':'Your access has changed');
  h.state(null);assert.deepEqual(h.navigations,['index.html'],'a blocked page can still sign out');
  assert.equal(h.guard.current(h.guard.capture()),false);
 }
});

test('failed authority recheck still invalidates and late successful reads cannot revive a signed-out generation',async()=>{
 let next=()=>Promise.resolve(access());
 const h=browserFixture(()=>next());h.state({uid:'synthetic-a'});await h.guard.check();
 next=()=>Promise.reject(Error('synthetic unavailable'));await h.guard.check();
 assert.deepEqual(h.events.map(e=>e.reason),['unverified']);assert.equal(h.body.children.includes(h.privateRow),false);
 assert.equal(h.navigations.length,0);
 let resolve;
 const r=browserFixture(()=>new Promise(done=>{resolve=done;}));r.state({uid:'synthetic-a'});const pending=r.guard.check();
 await Promise.resolve();const old=r.guard.capture();r.state(null);resolve(access());await pending;
 assert.equal(r.guard.current(old),false);assert.deepEqual(r.events.map(e=>e.reason),['signed_out']);
});

test('timetable stops its auth callback before touching replaced controls and clears private caches on terminal events',()=>{
 const source=require('node:fs').readFileSync('frontend/scripts/timetable.js','utf8');
 const listener=source.slice(source.indexOf("window.addEventListener('paws-access-invalidated'"),source.indexOf('auth.onAuthStateChanged(async user =>'));
 for(const fragment of ['currentUser=null','sessions=[]','renderedSessions=[]','sessionSelection.clear()','sessionCache.clear()','invalidateAllSessions()','unsubscribeFacultyDirectory()','currentFacultyRecord=null','workingActivityCache?.invalidate()'])assert.ok(listener.includes(fragment),fragment);
 const callback=source.slice(source.indexOf('auth.onAuthStateChanged(async user =>'),source.indexOf('if (!user) {',source.indexOf('auth.onAuthStateChanged(async user =>')));
 assert.match(callback,/if\(effectiveAccessBlocked\(\)\)return;/);
 const bootstrap=source.slice(source.indexOf('async function bootstrapForUser'),source.indexOf("window.addEventListener('paws-access-invalidated'"));
 assert.match(bootstrap,/await getRoleProfile\(user\);\s*if\(!bootstrapStillCurrent\(user\)\)return;/);
 assert.match(bootstrap,/await window\.UCVM_PAWS_DATA\.refreshWriteCapabilities\(\);[\s\S]*?if\(!bootstrapStillCurrent\(user\)\)return;/);
});
