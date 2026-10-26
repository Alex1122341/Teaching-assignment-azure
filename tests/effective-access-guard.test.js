'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
let createEffectiveAccessGuard;
try{({createEffectiveAccessGuard}=require('../frontend/scripts/effective-access-guard'));}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
const access=(patch={})=>({allowed:true,status:'ready',role:'faculty',facultyId:'faculty-a',version:'0000000000000001',...patch});
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
test('focus and polling checks share one pending authoritative read and teardown stops listeners',async()=>{
 let done,reads=0;const h=fixture(()=>{reads++;return new Promise(resolve=>done=resolve);});h.guard.observe(access());
 const events=new Map(),timers=new Map();let serial=0;
 const surface={addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:(name,fn)=>{if(events.get(name)===fn)events.delete(name);},setInterval:fn=>{timers.set(++serial,fn);return serial;},clearInterval:id=>timers.delete(id)};
 const stop=h.guard.start(surface,()=>true);events.get('focus')();[...timers.values()][0]();await Promise.resolve();assert.equal(reads,1);done(access({version:'0000000000000002'}));await h.guard.check();assert.equal(h.changes.length,1);stop();assert.equal(events.size,0);assert.equal(timers.size,0);
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
