'use strict';
// Exact original and candidate production functions, synthetic controlled
// dependencies only. Browser animation/real auth are independently tested.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),baseline=process.env.PAWS_BASELINE_ROOT;
const original='343f04b06f7360d0b5ee3b1ab0c9d8bda4a6ded8';
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:baseline,encoding:'utf8'}).trim(),original);
const css='frontend/styles/timetable.css';
assert.deepEqual(fs.readFileSync(path.join(root,css)),fs.readFileSync(path.join(baseline,css)));
const source=fs.readFileSync(path.join(root,css),'utf8');
assert.match(source,/login-ripple 1\.45s linear infinite/);
assert.match(source,/prefers-reduced-motion:\s*reduce/);
const deferred=()=>{let resolve;return {promise:new Promise(done=>{resolve=done;}),resolve};};
const flush=()=>new Promise(done=>setImmediate(done));
async function check(dir,label){
 const extract=require(path.join(dir,'test-support/source-function.js'));
 const tracker=require(path.join(dir,'frontend/scripts/paws-login-performance.js')).createTracker({now:(()=>{let n=0;return()=>++n;})()});
 tracker.begin({method:'email',flow:'interactive'});tracker.mark('T1');tracker.mark('T2');
 const user={uid:'synthetic'},profile={name:'Synthetic',role:'developer',facultyId:null,active:true,mustChangePassword:false};
 const profileGate=deferred(),capabilityGate=deferred(),events=[];
 let locked=true,modal=true;
 const elements=Object.fromEntries(['gate-status','email-login-status','email-login-submit','modal','auth-gate'].map(id=>[id,{textContent:'',dataset:{},classList:{remove(){if(id==='modal'){events.push('close');assert.ok(!locked);assert.ok(tracker.snapshot().stages.T7);modal=false;}}}}]));
 const document={body:{classList:{toggle(_name,value){locked=value;if(!value)events.push('unlock');}}}};
 const mark=tracker.mark;tracker.mark=stage=>{const value=mark(stage);if(stage==='T7')events.push('T7');return value;};
 const no=()=>{},context={
  $:id=>elements[id],text:{textContent:''},document,auth:{currentUser:user},sessions:[],sessionCache:new Map(),sessionRangeLoads:new Map(),sessionDateLoads:new Map(),
  currentUser:null,canonicalWriteFaculty:[],viewMode:null,myTimetableOnly:false,authSettings:{},emailLoginInFlight:true,phoneVerifyInFlight:false,interactiveLoginMethod:'email',
  UCVM:{ready:async()=>true},window:{PAWS_FACULTY_NAME:{format:v=>v},UCVM_PAWS_DATA:{refreshWriteCapabilities:()=>capabilityGate.promise}},
  loginPerformance:()=>tracker,getRoleProfile:()=>profileGate.promise,
  invalidateAllSessions:no,resetWorkingCalendar:no,resetCalendarActivityFilterForUser:no,resetSessionSelection:no,publishPageData:no,roleIsFaculty:()=>false,
  setViewButtons:no,updateAuthUI:no,subscribeSessions:()=>Promise.resolve([]),unsubscribeFacultyDirectory:no,render:no,prefetchDashboardShell:no,
  setAccessRecovery:no,updateScheduleSourceUI:no,clearRecaptcha:no,toast:no,scheduleAllSessionsPrefetch:no,scheduleOptionalFacultyEnrichment:no,canEdit:()=>true,
  console:{warn(){},error(){throw Error('Unexpected bootstrap failure');}}
 };
 const tt=fs.readFileSync(path.join(dir,'frontend/scripts/timetable.js'),'utf8');
 let extra='';
 if(tt.includes('const bootstrapStillCurrent=')){
  extra=extract('timetable.js','effectiveAccessBlocked')+'\n'+tt.match(/^\s*const bootstrapStillCurrent=.*;$/m)[0]+'\n';
 }
 const body=extract('timetable.js','bootstrapForUser');
 const fn=vm.runInNewContext(['setLoginProgress','setAppLocked','markLoginStage','settleInteractiveLogin','closeModal'].map(name=>extract('timetable.js',name)).join('\n')+'\n'+extra+body+'\nbootstrapForUser',context);
 const pending=fn(user,{provider:'email'});
 await flush();
 assert.equal(locked,true);assert.equal(modal,true);assert.equal(elements['email-login-status'].dataset.phase,'access');assert.equal(elements['email-login-status'].dataset.active,'true');assert.equal(tracker.snapshot().stages.T7,undefined);
 profileGate.resolve(profile);await flush();
 assert.equal(locked,true);assert.equal(modal,true);assert.equal(elements['email-login-status'].dataset.phase,'timetable');assert.equal(elements['email-login-status'].dataset.active,'true');assert.equal(tracker.snapshot().stages.T7,undefined);
 capabilityGate.resolve();await pending;
 assert.deepEqual(events,['unlock','T7','close']);assert.equal(locked,false);assert.equal(modal,false);assert.equal(elements['email-login-status'].dataset.active,'false');assert.equal(tracker.snapshot().status,'complete');
 console.log('PR171_LOGIN_FUNCTION_ORDER_OK '+JSON.stringify({version:label,accessWait:true,timetableWait:true,events,completed:true,oldFixedWindowCloseOffset:body.indexOf('closeModal()')}));
}
(async()=>{await check(baseline,'approved-original');await check(root,'candidate');console.log('PR171_LOGIN_FUNCTION_COMPARISON_OK');})().catch(error=>{console.error('PR171_LOGIN_FUNCTION_COMPARISON_FAILED '+error.name);process.exitCode=1;});
