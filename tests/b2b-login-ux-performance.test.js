'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sourceFunction=require('../test-support/source-function.js');

const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const timetable=()=>read('timetable.js');
const access=()=>read('faculty-access.js');

function perfModule(){
  const file=path.join(root,'paws-login-performance.js');
  delete require.cache[require.resolve(file)];
  return require(file);
}
function fakeClock(values){
  let i=0;
  return ()=>values[Math.min(i++,values.length-1)];
}

// Performance tracker: locked T0-T7 semantics.
test('14. login performance runtime exists and exports createTracker',()=>{
  assert.equal(fs.existsSync(path.join(root,'paws-login-performance.js')),true);
  assert.equal(typeof perfModule().createTracker,'function');
});
test('15. interactive begin records T0 with injected monotonic clock',()=>{
  const t=perfModule().createTracker({now:fakeClock([10])});
  t.begin({method:'email',flow:'interactive'});
  assert.equal(t.snapshot().stages.T0,10);
});
test('16. T0-T7 stage marks remain monotonic',()=>{
  const t=perfModule().createTracker({now:fakeClock([0,1,2,3,4,5,6,7])});
  t.begin({method:'email',flow:'interactive'});
  for(const s of ['T1','T2','T3','T4','T5','T6','T7'])t.mark(s);
  const s=t.snapshot();
  assert.deepEqual(Object.values(s.stages),[0,1,2,3,4,5,6,7]);
});
test('17. out-of-order stage mark is rejected',()=>{
  const t=perfModule().createTracker({now:fakeClock([0,2,1])});
  t.begin({method:'email',flow:'interactive'});
  t.mark('T1');
  assert.throws(()=>t.mark('T3'),/stage order/i);
});
test('18. duplicate mark cannot corrupt an attempt',()=>{
  const t=perfModule().createTracker({now:fakeClock([0,1,99])});
  t.begin({method:'email',flow:'interactive'});
  t.mark('T1');
  t.mark('T1');
  assert.equal(t.snapshot().stages.T1,1);
});
test('19. required duration intervals are computed correctly',()=>{
  const t=perfModule().createTracker({now:fakeClock([0,10,30,40,70,80,100,125])});
  t.begin({method:'email',flow:'interactive'});
  for(const s of ['T1','T2','T3','T4','T5','T6','T7'])t.mark(s);
  const d=t.complete().durations;
  assert.deepEqual(d,{firebaseAuth:30,pawsAuthorization:40,profileAccess:10,clientBootstrapRender:45,totalInteractive:125});
});
test('20. completed snapshot is sanitized and bounded',()=>{
  const t=perfModule().createTracker({now:fakeClock([0,1,2,3,4,5,6,7])});
  t.begin({method:'email',flow:'interactive',email:'secret@example.com',uid:'uid'});
  for(const s of ['T1','T2','T3','T4','T5','T6','T7'])t.mark(s);
  const s=t.complete();
  assert.equal(s.method,'email'); assert.equal(s.flow,'interactive'); assert.equal(s.status,'complete');
  const raw=JSON.stringify(s);
  assert.doesNotMatch(raw,/secret@example|uid|token|password|facultyId|ucid/i);
});
test('21. failed attempt exposes only sanitized failure classification',()=>{
  const t=perfModule().createTracker({now:fakeClock([0,1])});
  t.begin({method:'email',flow:'interactive'});
  t.mark('T1');
  const s=t.fail({kind:'transient',message:'contains email x@y.com',token:'secret'});
  assert.equal(s.status,'failed'); assert.equal(s.failureKind,'transient');
  assert.doesNotMatch(JSON.stringify(s),/x@y\.com|secret|message|token/i);
  t.begin({method:'email',flow:'interactive'});
  const unknown=t.fail({kind:'person@ucalgary.ca'});
  assert.equal(unknown.failureKind,'unexpected');
  assert.doesNotMatch(JSON.stringify(unknown),/person@ucalgary\.ca/i);
});
test('22. new attempt safely replaces prior active attempt',()=>{
  const t=perfModule().createTracker({now:fakeClock([0,5])});
  t.begin({method:'email',flow:'interactive'}); t.mark('T1');
  t.begin({method:'phone',flow:'interactive'});
  const s=t.snapshot();
  assert.equal(s.method,'phone'); assert.equal(s.stages.T0,5); assert.equal(s.stages.T1,undefined);
});
test('23. restored-session never fabricates interactive T0 or T1',()=>{
  const t=perfModule().createTracker({now:fakeClock([11,12])});
  t.begin({method:'firebase',flow:'restored-session'});
  t.mark('T2');
  const s=t.snapshot();
  assert.equal(s.flow,'restored-session'); assert.equal(s.stages.T0,undefined); assert.equal(s.stages.T1,undefined); assert.equal(s.stages.T2,11);
});
test('24. diagnostics source has no persistent browser storage or telemetry backend',()=>{
  const src=read('paws-login-performance.js');
  assert.doesNotMatch(src,/localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|XMLHttpRequest|sendBeacon|firebase\.|firestore\s*\(/i);
});

// Email UX / single flight.
test('1. Email login has an explicit single-flight guard',()=>{
  assert.match(timetable(),/let emailLoginInFlight\s*=\s*false/);
});
test('2. Email form exposes a named submit control and accessible live status',()=>{
  const s=timetable();
  assert.match(s,/id="email-login-submit"/);
  assert.match(s,/id="email-login-status"[^>]*role="status"[^>]*aria-live="polite"/);
});
test('3. Email active attempt disables submit and shows Signing in',()=>{
  const s=timetable();
  assert.match(s,/emailLoginInFlight\s*=\s*true/);
  assert.match(s,/email-login-submit[\s\S]{0,800}disabled\s*=\s*true|disabled\s*=\s*true[\s\S]{0,800}Signing in\.\.\./);
  assert.match(s,/Signing in\.\.\./);
});
test('4. rapid duplicate Email submit returns before another Firebase call',()=>{
  const s=timetable();
  const start=s.indexOf("'email-login-form').onsubmit");
  const body=s.slice(start,start+2600);
  assert.match(body,/if\s*\(emailLoginInFlight\)\s*return/);
  assert.equal((body.match(/signInWithEmailAndPassword/g)||[]).length,1);
});
test('5. Firebase Email failure restores submit control and permits retry',()=>{
  const s=timetable();
  const start=s.indexOf("'email-login-form').onsubmit");
  const body=s.slice(start,start+3200);
  assert.match(body,/catch[\s\S]*emailLoginInFlight\s*=\s*false/);
  assert.match(body,/catch[\s\S]*disabled\s*=\s*false/);
});
test('6. Email failure cannot leave permanent Signing in state',()=>{
  const s=timetable();
  const start=s.indexOf("'email-login-form').onsubmit");
  const body=s.slice(start,start+3400);
  assert.match(body,/catch[\s\S]*setLoginProgress[\s\S]*false/);
});

test('6a. rapid duplicate Email submits execute exactly one Firebase sign-in and failure allows a new attempt',async()=>{
  const src=sourceFunction('timetable.js','openEmailLoginModal');
  const elements={
    'email-back':{disabled:false},
    'email-login-form':{},
    'login-email':{value:'person@ucalgary.ca'},
    'login-password':{value:'not-recorded'},
    'email-login-submit':{disabled:false},
    'email-login-status':{textContent:'',dataset:{}}
  };
  let calls=0;
  const deferred=[];
  const auth={signInWithEmailAndPassword(){
    calls+=1;
    let resolve,reject;
    const promise=new Promise((res,rej)=>{resolve=res;reject=rej});
    deferred.push({resolve,reject});
    return promise;
  }};
  const sandbox={
    clearRecaptcha(){},showModal(){},$:id=>elements[id],openLoginModal(){},
    setLoginProgress(message,active){elements['email-login-status'].textContent=message;elements['email-login-status'].dataset.active=String(active)},
    beginInteractiveLogin(){},failLoginPerformance(){},toast(){},auth,console:{error(){},warn(){},log(){}}
  };
  sandbox.globalThis=sandbox;
  const context=vm.createContext(sandbox);
  const open=vm.runInContext(`(()=>{let emailLoginInFlight=false;${src};return openEmailLoginModal})()`,context);
  open();
  const event={preventDefault(){}};
  const first=elements['email-login-form'].onsubmit(event);
  const duplicate=elements['email-login-form'].onsubmit(event);
  await Promise.resolve();
  assert.equal(calls,1);
  assert.equal(elements['email-login-submit'].disabled,true);
  assert.equal(elements['email-login-status'].textContent,'Signing in...');
  const error=Object.assign(new Error('bad credentials'),{code:'auth/invalid-credential'});
  deferred[0].reject(error);
  await Promise.allSettled([first,duplicate]);
  assert.equal(elements['email-login-submit'].disabled,false);
  const retry=elements['email-login-form'].onsubmit(event);
  await Promise.resolve();
  assert.equal(calls,2,'a settled failure permits exactly one new attempt');
  deferred[1].resolve({});
  await retry;
});
test('7. Firebase success advances UX to PAWS verification',()=>{
  assert.match(timetable(),/Verifying PAWS access\.\.\./);
});
test('8. authorization/bootstrap advances UX to timetable loading state',()=>{
  assert.match(timetable(),/Loading your timetable\.\.\./);
});
test('9. successful interactive login settles the in-flight state after T7',()=>{
  const s=timetable();
  assert.match(s,/markLoginStage\(['"]T7['"]\)/);
  assert.match(s,/settleInteractiveLogin\(true\)/);
});
test('10. login modal stays open until protected UI reaches T7',()=>{
  const s=timetable();
  const start=s.indexOf('async function bootstrapForUser');
  const body=s.slice(start,start+3300);
  const unlock=body.indexOf('setAppLocked(false)');
  const close=body.indexOf('closeModal()');
  assert.ok(unlock>=0&&close>unlock,'modal closes only after unlock');
});
test('11. restored session shows saved-login checking rather than Signing in',()=>{
  const s=timetable();
  assert.match(s,/Checking saved login\.\.\./);
  assert.match(s,/restored-session/);
});
test('12. a non-ready access route settles the interactive login UI instead of spinning forever',()=>{
  const s=timetable();
  const start=s.indexOf('const accessReady=await UCVM.ready');
  const body=s.slice(start,start+650);
  assert.match(body,/if \(!accessReady\)/);
  assert.match(body,/settleInteractiveLogin\(false\)/);
  assert.match(body,/setLoginProgress\('', false\)/);
});

// Phone guards.
test('30. Phone Send SMS has a single-flight guard and sending status',()=>{
  const s=timetable();
  assert.match(s,/let phoneSendInFlight\s*=\s*false/);
  assert.match(s,/if\s*\(phoneSendInFlight\)\s*return/);
  assert.match(s,/Sending SMS code\.\.\./);
});
test('31. Phone Send SMS failure restores its control',()=>{
  const s=timetable();
  const start=s.indexOf("'phone-login-form').onsubmit");
  const body=s.slice(start,start+3200);
  assert.match(body,/catch[\s\S]*phoneSendInFlight\s*=\s*false/);
  assert.match(body,/catch[\s\S]*disabled\s*=\s*false/);
});

test('31a. duplicate Send SMS executes exactly one Firebase request and failure restores retry',async()=>{
  const src=sourceFunction('timetable.js','openPhoneLoginModal');
  const elements={
    'phone-back':{disabled:false},
    'phone-login-form':{},
    'login-phone':{value:'+14035551234'},
    'phone-send-submit':{disabled:false},
    'phone-login-status':{textContent:'',dataset:{}}
  };
  let calls=0;
  const deferred=[];
  const auth={signInWithPhoneNumber(){
    calls+=1;
    let resolve,reject;
    const promise=new Promise((res,rej)=>{resolve=res;reject=rej});
    deferred.push({resolve,reject});
    return promise;
  }};
  class RecaptchaVerifier{
    render(){return Promise.resolve(1)}
    clear(){}
  }
  const sandbox={
    clearRecaptcha(){sandbox.recaptchaVerifier=null},
    showModal(){},
    $:id=>elements[id],
    openLoginModal(){},
    openPhoneCodeModal(){},
    normalizePhoneForFirebase:v=>v,
    setLoginProgress(message,active){elements['phone-login-status'].textContent=message;elements['phone-login-status'].dataset.active=String(active)},
    toast(){},
    setTimeout(){},
    auth,
    firebase:{auth:{RecaptchaVerifier}},
    console:{error(){},warn(){},log(){}}
  };
  sandbox.globalThis=sandbox;
  const context=vm.createContext(sandbox);
  const open=vm.runInContext(`(()=>{let phoneSendInFlight=false;let phoneConfirmation=null;let recaptchaVerifier=null;const auth=globalThis.auth;const firebase=globalThis.firebase;const $=globalThis.$;const clearRecaptcha=()=>{if(recaptchaVerifier){try{recaptchaVerifier.clear()}catch(_){}recaptchaVerifier=null}};const showModal=globalThis.showModal,openLoginModal=globalThis.openLoginModal,openPhoneCodeModal=globalThis.openPhoneCodeModal,normalizePhoneForFirebase=globalThis.normalizePhoneForFirebase,setLoginProgress=globalThis.setLoginProgress,toast=globalThis.toast,setTimeout=globalThis.setTimeout;${src};return {open:openPhoneLoginModal,state:()=>({phoneSendInFlight,phoneConfirmation,recaptchaVerifier})}})()`,context);
  open.open();
  const event={preventDefault(){}};
  const first=elements['phone-login-form'].onsubmit(event);
  const duplicate=elements['phone-login-form'].onsubmit(event);
  await Promise.resolve();
  assert.equal(calls,1);
  assert.equal(elements['phone-send-submit'].disabled,true);
  assert.equal(elements['phone-login-status'].textContent,'Sending SMS code...');
  deferred[0].reject(Object.assign(new Error('captcha failed'),{code:'auth/captcha-check-failed'}));
  await Promise.allSettled([first,duplicate]);
  assert.equal(elements['phone-send-submit'].disabled,false);
  assert.equal(elements['phone-back'].disabled,false);
  open.open();
  const retry=elements['phone-login-form'].onsubmit(event);
  await Promise.resolve();
  assert.equal(calls,2,'a settled Send SMS failure permits one new request');
  deferred[1].resolve({confirm(){}});
  await retry;
});
test('32. Phone verification is single-flight and shows verifying status',()=>{
  const s=timetable();
  assert.match(s,/let phoneVerifyInFlight\s*=\s*false/);
  const start=s.indexOf("'phone-code-form').onsubmit");
  const body=s.slice(start,start+2400);
  assert.match(body,/if\s*\(phoneVerifyInFlight\)\s*return/);
  assert.match(body,/Verifying code\.\.\./);
});
test('33. Phone verification failure restores its control',()=>{
  const s=timetable();
  const start=s.indexOf("'phone-code-form').onsubmit");
  const body=s.slice(start,start+2600);
  assert.match(body,/catch[\s\S]*phoneVerifyInFlight\s*=\s*false/);
  assert.match(body,/catch[\s\S]*disabled\s*=\s*false/);
});

test('33a. duplicate verification submits execute one confirm and failure restores retry',async()=>{
  const src=sourceFunction('timetable.js','openPhoneCodeModal');
  const elements={
    'code-back':{disabled:false},
    'phone-code-form':{},
    'phone-code':{value:'123456'},
    'phone-verify-submit':{disabled:false},
    'phone-code-status':{textContent:'',dataset:{}}
  };
  let calls=0;
  const deferred=[];
  const confirmation={confirm(){
    calls+=1;
    let resolve,reject;
    const promise=new Promise((res,rej)=>{resolve=res;reject=rej});
    deferred.push({resolve,reject});
    return promise;
  }};
  const sandbox={
    showModal(){},
    $:id=>elements[id],
    openPhoneLoginModal(){},
    escapeHtml:v=>String(v),
    setLoginProgress(message,active){elements['phone-code-status'].textContent=message;elements['phone-code-status'].dataset.active=String(active)},
    beginInteractiveLogin(){},
    failLoginPerformance(){},
    toast(){},
    console:{error(){},warn(){},log(){}}
  };
  const verifySandbox={...sandbox,confirmation};
  verifySandbox.globalThis=verifySandbox;
  const open=vm.runInContext(`(()=>{let phoneVerifyInFlight=false;let phoneConfirmation=globalThis.confirmation;const $=globalThis.$,showModal=globalThis.showModal,openPhoneLoginModal=globalThis.openPhoneLoginModal,escapeHtml=globalThis.escapeHtml,setLoginProgress=globalThis.setLoginProgress,beginInteractiveLogin=globalThis.beginInteractiveLogin,failLoginPerformance=globalThis.failLoginPerformance,toast=globalThis.toast;${src};return openPhoneCodeModal})()`,vm.createContext(verifySandbox));
  open('+14035551234');
  const event={preventDefault(){}};
  const first=elements['phone-code-form'].onsubmit(event);
  const duplicate=elements['phone-code-form'].onsubmit(event);
  await Promise.resolve();
  assert.equal(calls,1);
  assert.equal(elements['phone-verify-submit'].disabled,true);
  assert.equal(elements['phone-code-status'].textContent,'Verifying code...');
  deferred[0].reject(Object.assign(new Error('bad code'),{code:'auth/invalid-verification-code'}));
  await Promise.allSettled([first,duplicate]);
  assert.equal(elements['phone-verify-submit'].disabled,false);
  assert.equal(elements['code-back'].disabled,false);
  const retry=elements['phone-code-form'].onsubmit(event);
  await Promise.resolve();
  assert.equal(calls,2,'a settled verification failure permits one new confirm');
  deferred[1].resolve({});
  await retry;
});

// Critical path / authority.
test('25. /me remains the blocking SQL authorization source',()=>{
  const s=timetable();
  const start=s.indexOf('async function getRoleProfile');
  const body=s.slice(start,start+900);
  assert.match(body,/UCVM_PAWS_DATA\.currentUser\(\)/);
  assert.doesNotMatch(body,/firestore|collection\(['"]users['"]\)/i);
});
test('26. ready validates account policy without awaiting optional Firestore enrichment',()=>{
  const s=access();
  const start=s.indexOf('async function ready');
  const body=s.slice(start,start+700);
  assert.match(body,/ACCOUNT_INACTIVE/);
  assert.match(body,/mustChangePassword/);
  assert.doesNotMatch(body,/await\s+linkFacultyIdentity|await\s+enrichFacultyIdentity/);
});
test('27. optional faculty enrichment is deferred until after T7',()=>{
  const s=timetable();
  const start=s.indexOf('async function bootstrapForUser');
  const body=s.slice(start,start+3800);
  const t7=body.indexOf("markLoginStage('T7')");
  const defer=body.indexOf('scheduleOptionalFacultyEnrichment');
  assert.ok(t7>=0&&defer>t7,'optional enrichment starts after T7');
  assert.doesNotMatch(body.slice(0,t7),/await\s+ensureCurrentFaculty\(/);
});
test('28. SQL FacultyId is authoritative and Firestore lookup cannot redefine it',()=>{
  const s=access();
  const start=s.indexOf('async function enrichFacultyIdentity');
  const body=s.slice(start,start+1500);
  assert.match(body,/const facultyId=String\(p\?\.facultyId/);
  assert.match(body,/\.doc\(facultyId\)\.get\(\)/);
  assert.doesNotMatch(body,/where\(['"]email['"]/);
  assert.doesNotMatch(body,/p\.facultyId\s*=/);
});
test('29. optional Firestore enrichment failure cannot block or revoke login',()=>{
  const s=timetable();
  const start=s.indexOf('function scheduleOptionalFacultyEnrichment');
  const body=s.slice(start,start+1500);
  assert.match(body,/\.catch\(/);
  assert.doesNotMatch(body,/signOut\(|setAppLocked\(true/);
});

// Stage wiring and B2A semantics.
test('34. interactive stage wiring marks T1-T7 around the documented boundaries',()=>{
  const s=timetable();
  for(const stage of ['T1','T2','T3','T4','T5','T6','T7'])assert.match(s,new RegExp("markLoginStage\\(['\"]"+stage+"['\"]\\)"),stage);
  assert.ok(s.indexOf("markLoginStage('T3')")<s.indexOf('const profile = await getRoleProfile'));
  assert.ok(s.indexOf("markLoginStage('T4')")>s.indexOf('const profile = await getRoleProfile'));
});
test('35. B2A classified PAWS failures never sign out the Firebase session',()=>{
  const s=timetable();
  assert.match(s,/UCVM_AUTH_CONTINUITY\.classifyAuthError/);
  const start=s.indexOf('async function applyAccessFailure');
  const end=s.indexOf('function canEdit',start);
  const body=s.slice(start,end);
  assert.match(body,/classifyAuthError/);
  assert.doesNotMatch(body,/signOut\(/);
});
test('36. Firebase persistence remains LOCAL',()=>{
  assert.match(timetable(),/setPersistence\(firebase\.auth\.Auth\.Persistence\.LOCAL\)/);
});
test('37. auth copy identifies Firebase authentication and PAWS API + Azure SQL authorization',()=>{
  const s=timetable();
  assert.match(s,/Authentication:<\/strong>\s*Firebase/i);
  assert.match(s,/Authorization:<\/strong>\s*PAWS API \+ Azure SQL/i);
  assert.doesNotMatch(s,/Authorization:<\/strong>\s*Firestore/i);
});
test('38. new performance asset is loaded before timetable bootstrap and protected by static manifest',()=>{
  const html=read('index.html'),manifest=JSON.parse(read('tools/static-assets.json'));
  const perf=html.indexOf('paws-login-performance.js'),tt=html.indexOf('timetable.js');
  assert.ok(perf>=0&&tt>perf);
  assert.ok(manifest.includes('paws-login-performance.js'));
});


function flushReviewAsync(){
  return new Promise(resolve=>setImmediate(resolve));
}
function reviewFacultyEnrichmentHarness({sessionsLoaded=true,deferredEnrichment=false}={}){
  const scheduleSrc=sourceFunction('timetable.js','scheduleOptionalFacultyEnrichment');
  const belongsSrc=sourceFunction('timetable.js','sessionBelongsToCurrentFaculty');
  const profileA={facultyId:'F-A',instructor:'Fallback Alias'};
  const userA={uid:'A',name:'Faculty A',email:'a@example.invalid',instructorName:'Fallback Alias',profile:profileA};
  const metrics={render:0,publish:0,ensure:0,warn:0};
  let releaseEnrichment=null;
  const enrichmentGate=deferredEnrichment?new Promise(resolve=>{releaseEnrichment=resolve}):Promise.resolve();
  const sandbox={
    initialUser:userA,
    sessions:sessionsLoaded?[{id:'s1'}]:[],
    sessionCache:new Map(sessionsLoaded?[['s1',{id:'s1'}]]:[]),
    metrics,
    UCVM:{async enrichFacultyIdentity(_user,profile){await enrichmentGate;profile.instructor='Correct Alias';}},
    authSettings:{instructorAlias:'Faculty 001'},
    console:{warn(){metrics.warn+=1},error(){},log(){}},
    swapNameKey(value){return String(value||'').trim().toLowerCase()},
    splitInstructorNames(value){return String(value||'').split(';').map(x=>x.trim()).filter(Boolean)}
  };
  sandbox.globalThis=sandbox;
  const code=`(()=>{let currentUser=globalThis.initialUser;let currentFacultyRecord=null;const sessions=globalThis.sessions;const sessionCache=globalThis.sessionCache;const UCVM=globalThis.UCVM;const authSettings=globalThis.authSettings;const swapNameKey=globalThis.swapNameKey;const splitInstructorNames=globalThis.splitInstructorNames;const publishPageData=()=>{globalThis.metrics.publish+=1};const render=()=>{globalThis.metrics.render+=1};const ensureCurrentFaculty=async()=>{globalThis.metrics.ensure+=1;currentFacultyRecord={id:String(currentUser?.profile?.facultyId||'')};return currentFacultyRecord};${belongsSrc}\n${scheduleSrc}\nreturn{start:(u,p)=>scheduleOptionalFacultyEnrichment(u,p),setUser:u=>{currentUser=u},getUser:()=>currentUser,getFaculty:()=>currentFacultyRecord,belongs:s=>sessionBelongsToCurrentFaculty(s)}})()`;
  const harness=vm.runInContext(code,vm.createContext(sandbox));
  return{harness,userA,profileA,metrics,release:()=>releaseEnrichment?.()};
}

test('REVIEW-1 session-data-first enrichment reconciles My Timetable with one local render',async()=>{
  const {harness,userA,profileA,metrics}=reviewFacultyEnrichmentHarness({sessionsLoaded:true});
  const session={assignments:[{name:'Correct Alias'}],instructor:'Correct Alias'};
  assert.equal(harness.belongs(session),false,'fallback alias does not initially match');
  harness.start(userA,profileA);
  await flushReviewAsync();
  assert.equal(harness.getUser().instructorName,'Correct Alias');
  assert.equal(harness.belongs(session),true,'corrected alias matches after enrichment');
  assert.equal(metrics.render,1,'loaded timetable is locally rerendered exactly once');
});

test('REVIEW-2 enrichment-first waits for normal session render and avoids duplicate local render',async()=>{
  const {harness,userA,profileA,metrics}=reviewFacultyEnrichmentHarness({sessionsLoaded:false});
  harness.start(userA,profileA);
  await flushReviewAsync();
  assert.equal(harness.getUser().instructorName,'Correct Alias');
  assert.equal(metrics.render,0,'no local timetable rerender is needed before session data exists');
  assert.equal(harness.belongs({assignments:[{name:'Correct Alias'}],instructor:'Correct Alias'}),true,'later session data uses the corrected alias');
});

test('REVIEW-3 late User A enrichment cannot overwrite or rerender User B',async()=>{
  const {harness,userA,profileA,metrics,release}=reviewFacultyEnrichmentHarness({sessionsLoaded:true,deferredEnrichment:true});
  harness.start(userA,profileA);
  await Promise.resolve();
  const userB={uid:'B',name:'Faculty B',email:'b@example.invalid',instructorName:'B Alias',profile:{facultyId:'F-B',instructor:'B Alias'}};
  harness.setUser(userB);
  release();
  await flushReviewAsync();
  assert.equal(harness.getUser().uid,'B');
  assert.equal(harness.getUser().instructorName,'B Alias');
  assert.equal(metrics.ensure,0);
  assert.equal(metrics.render,0);
});

test('REVIEW-4 stale ensureCurrentFaculty result cannot write User A faculty context into User B',async()=>{
  const src=sourceFunction('timetable.js','ensureCurrentFaculty');
  let resolveDoc;
  const metrics={publish:0};
  const sandbox={
    userA:{uid:'A',profile:{facultyId:'F-A'}},
    db:{collection(){return{doc(){return{get(){return new Promise(resolve=>{resolveDoc=resolve})}}}}}},
    metrics,
    console:{error(){}}
  };
  sandbox.globalThis=sandbox;
  const code=`(()=>{let currentUser=globalThis.userA;let currentFacultyRecord=null;let currentFacultyLoading=null;const db=globalThis.db;const publishPageData=()=>{globalThis.metrics.publish+=1};const clearCurrentFaculty=()=>{currentFacultyRecord=null;currentFacultyLoading=null;publishPageData()};${src}\nreturn{load:()=>ensureCurrentFaculty(),setUser:u=>{currentUser=u},record:()=>currentFacultyRecord}})()`;
  const h=vm.runInContext(code,vm.createContext(sandbox));
  const pending=h.load();
  h.setUser({uid:'B',profile:{facultyId:'F-B'}});
  resolveDoc({exists:true,id:'F-A',data(){return{name:'Faculty A'}}});
  await pending;
  assert.equal(h.record(),null);
  assert.equal(metrics.publish,0);
});

test('REVIEW-5 mustChangePassword keeps the existing route and never signs out',async()=>{
  const src=sourceFunction('faculty-access.js','ready');
  const metrics={route:null,signout:0};
  const sandbox={
    window:{__ucvmSessionGuard:{blocked:false}},
    location:{replace(value){metrics.route=value}},
    installLandingReset(){},
    clearLegacyAdminLanding(){},
    metrics
  };
  sandbox.globalThis=sandbox;
  const fn=vm.runInContext(`(async()=>{${src}\nreturn ready({uid:'u1'},{active:true,mustChangePassword:true})})()`,vm.createContext(sandbox));
  assert.equal(await fn,false);
  assert.equal(metrics.route,'password.html');
  assert.equal(metrics.signout,0);
});

test('REVIEW-6 password-change route has its own diagnostic classification and stops before T6/T7',()=>{
  const s=timetable();
  const start=s.indexOf('const accessReady=await UCVM.ready(user, profile);');
  const t6=s.indexOf("markLoginStage('T6')",start);
  const branch=s.slice(start,t6);
  assert.match(branch,/password-change-required/);
  assert.doesNotMatch(branch,/setAccessRecovery\(/);
  assert.doesNotMatch(branch,/auth\.signOut\(/);
  assert.match(branch,/if \(!accessReady\)[\s\S]*return;/);
});

test('REVIEW-7 failed tracker attempt cannot later become successful without begin',()=>{
  const t=perfModule().createTracker({now:fakeClock([0,1,2,3])});
  t.begin({method:'email',flow:'interactive'});
  t.mark('T1');
  const failed=t.fail({kind:'transient'});
  assert.equal(failed.status,'failed');
  const completed=t.complete();
  assert.equal(completed.status,'failed');
  assert.equal(completed.failureKind,'transient');
});

test('REVIEW-8 terminal failed attempt rejects new stages but preserves duplicate-stage timing',()=>{
  const t=perfModule().createTracker({now:fakeClock([0,1,99])});
  t.begin({method:'email',flow:'interactive'});
  t.mark('T1');
  t.fail({kind:'transient'});
  assert.equal(t.mark('T1'),1,'late duplicate mark returns the original timestamp');
  assert.throws(()=>t.mark('T2'),/terminal/i);
  assert.equal(t.snapshot().durations.firebaseAuth,null);
});

test('REVIEW-9 completed interactive attempt contains T7 and late duplicate cannot alter durations',()=>{
  const t=perfModule().createTracker({now:fakeClock([0,1,2,3,4,5,6,7,99])});
  t.begin({method:'email',flow:'interactive'});
  for(const stage of ['T1','T2','T3','T4','T5','T6','T7'])t.mark(stage);
  const completed=t.complete();
  assert.equal(completed.status,'complete');
  assert.equal(completed.stages.T7,7);
  const before=JSON.stringify(completed.durations);
  assert.equal(t.mark('T7'),7);
  assert.equal(JSON.stringify(t.snapshot().durations),before);
});
