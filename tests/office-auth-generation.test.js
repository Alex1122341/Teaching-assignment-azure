'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const sourceFunction=require('../test-support/source-function');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function harness(page){
 const events=[],requests=[],nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:'2026-27',classList:{add(){},remove(){},toggle(){}},textContent:'',innerHTML:''});return nodes.get(id);};
 let handler;
 const auth={currentUser:null,setPersistence:()=>Promise.resolve(),onAuthStateChanged:f=>{handler=f;}};
 const firebase={apps:[{}],auth:()=>auth};firebase.auth.Auth={Persistence:{LOCAL:'local'}};
 const ctx={console:{error(){}},performance:{now:()=>0},firebase,FIREBASE_CONFIG:{},auth,authGeneration:0,currentUser:null,profile:null,
  $,document:{body:{classList:{add(){},remove(){}}},querySelector:()=>node('query'),querySelectorAll:()=>[]},window:{},location:{replace:()=>events.push('redirect')},
  officeWorkspace:{sync:p=>events.push(p?.role||'LOCK')},traineesEntry:null,afcForms:null,facultyArchive:null,cccReplace:null,workView:null,workImport:null,
  UCVM_PAWS_DATA:{currentUser:()=>{const r=deferred();requests.push(r);return r.promise;}},
  bindUI(){},cameFromTimetable:()=>false,lock:()=>events.push('LOCK'),unlock:()=>events.push(ctx.profile?.role||'LOCK'),
  pawsTimingLog(){},dashboardAuthFailureMessage:()=>'',dashboardAdmin:p=>['adfa_general','administrator'].includes(p?.role),isSelfServiceProfile:p=>p?.role==='faculty',
  enterAdminMode:(u,p)=>events.push(p.role),enterSelfMode:async(u,p)=>events.push(p.role),
  queueRoles:new Set(['adfa_general','hicc','visc']),role:()=>ctx.profile?.role,isAdmin:()=>ctx.profile?.role==='adfa_general',displayFaculty:x=>x,
  academicYearNow:()=> '2026-27',bind(){},loadCapabilities:async()=>{},loadFacultyReference:async()=>{},selectView:async()=>events.push('VIEW'),apiError:()=>'',
  packages:[],selectedId:'',selectedPackage:null,capabilities:{},facultyOptions:[],facultyEvidence:new Map(),aggregateCache:{},invalidateFacultyDetails(){},resetAuthData(){}};
 function $(id){return node(id);}
 if(page==='assignments')vm.runInNewContext(sourceFunction('teaching-assignments.js','showGate')+'\n'+sourceFunction('teaching-assignments.js','unlock')+'\n'+sourceFunction('teaching-assignments.js','start'),ctx);
 else {vm.runInNewContext(sourceFunction('faculty-admin.js','init')+'\ninit();',ctx);ctx.start=handler;}
 return {ctx,events,requests,node,run(user){auth.currentUser=user;return ctx.start(user);}};
}
for(const page of ['assignments','dashboard']){
 test(page+' immediately locks while a new identity profile is pending',async()=>{
  const h=harness(page),pending=h.run({uid:'a'});assert.equal(h.events.at(-1),'LOCK');h.requests[0].resolve({active:false});await pending;
 });
 test(page+' ignores administrator success arriving after sign-out',async()=>{
  const h=harness(page),pending=h.run({uid:'a'});await h.run(null);h.requests[0].resolve({active:true,role:'adfa_general'});await pending;assert.ok(!h.events.includes('adfa_general'));
 });
 for(const sameUid of [false,true])test(page+' rejects obsolete admin response after '+(sameUid?'same-UID role downgrade':'identity replacement'),async()=>{
  const h=harness(page),old=h.run({uid:'a'}),current=h.run({uid:sameUid?'a':'b'});h.requests[1].resolve({active:true,role:'faculty',facultyId:'self'});await current;h.requests[0].resolve({active:true,role:'adfa_general'});await old;
  assert.ok(h.events.includes('faculty'));assert.ok(!h.events.includes('adfa_general'));
 });
 test(page+' obsolete rejection cannot lock the newer authorized identity',async()=>{
  const h=harness(page),old=h.run({uid:'a'}),current=h.run({uid:'b'});h.requests[1].resolve({active:true,role:'faculty',facultyId:'self'});await current;const count=h.events.length;h.requests[0].reject(Error('old request'));await old;assert.equal(h.events.length,count);
 });
}
test('Dashboard admin loader discards responses after authorization generation changes',async()=>{
 const d=deferred(),ctx={authGeneration:1,currentUser:{uid:'a'},facultyStatus:'active',performance:{now:()=>0},setDashboardLoading(){},UCVM_PAWS_DATA:{dashboardSummary:()=>d.promise,dashboardFaculty:async()=>[]},console:{error(){}},markDashboardUnavailable(){throw Error('stale error applied')},dashboardAuthFailureMessage:()=>''};
 vm.runInNewContext(sourceFunction('faculty-admin.js','loadAdminDashboard'),ctx);const pending=ctx.loadAdminDashboard();ctx.authGeneration++;ctx.currentUser=null;d.resolve({private:true});await pending;assert.equal(ctx.dashboardSummary,undefined);
});
test('Dashboard own loader discards roster before loading detail after sign-out',async()=>{
 const d=deferred(),ctx={authGeneration:1,currentUser:{uid:'a'},UCVM_PAWS_DATA:{dashboardFaculty:()=>d.promise,dashboardFacultyById(){throw Error('stale detail request')}},rosterRecord:x=>x,detailCache:new Map(),renderApiDetail(){throw Error('stale self render')}};
 vm.runInNewContext(sourceFunction('faculty-admin.js','loadSelfFaculty'),ctx);const pending=ctx.loadSelfFaculty('self');ctx.authGeneration++;ctx.currentUser=null;d.resolve([{facultyId:'self',__id:'self'}]);await pending;assert.equal(ctx.faculty,undefined);
});
for(const [name,api,key] of [['loadTeachingSummary','dashboardTeachingSummary','teachingSummary'],['loadRoles','dashboardRoles','roles'],['loadDoeOverview','dashboardDoeOverview','doeOverview'],['loadAfcRecords','dashboardAfcRecords','afc']])test('Dashboard '+name+' rejects obsolete private result',async()=>{
 const d=deferred(),nodes=new Map(),ctx={authGeneration:1,aggregateCache:{},afcLoaded:false,afcRecords:[],UCVM_PAWS_DATA:{[api]:()=>d.promise},$:(id)=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},esc:x=>x,detailFailureMessage:()=>'',renderTeachingSummary(){},renderRoles(){},fillRoleFilter(){},renderDoeOverview(){},renderAfcRecords(){}};
 vm.runInNewContext(sourceFunction('faculty-admin.js',name),ctx);const pending=ctx[name]();ctx.authGeneration++;d.resolve([{private:true}]);await pending;
 assert.equal(key==='afc'?ctx.afcRecords.length:ctx.aggregateCache[key],key==='afc'?0:undefined);
});
for(const name of ['loadQueue','openPackage'])test('Assignments '+name+' rejects obsolete package data',async()=>{
 const d=deferred(),node={value:'2026-27'},ctx={authGeneration:1,selectedId:'',selectedPackage:null,packages:[],UCVM_PAWS_DATA:{teachingAssignmentWorkQueue:()=>d.promise,teachingAssignmentPackage:()=>d.promise},$:()=>node,renderQueue(){},renderDetail(){},apiError:()=>'',esc:x=>x};
 vm.runInNewContext(sourceFunction('teaching-assignments.js',name),ctx);const pending=ctx[name]('p');ctx.authGeneration++;d.resolve(name==='loadQueue'?[{private:true}]:{private:true});await pending;
 assert.equal(name==='loadQueue'?ctx.packages.length:ctx.selectedPackage,name==='loadQueue'?0:null);
});
test('Assignments obsolete queue error cannot replace the next identity queue',async()=>{
 const d=deferred(),node={value:'2026-27'},ctx={authGeneration:1,$:()=>node,UCVM_PAWS_DATA:{teachingAssignmentWorkQueue:()=>d.promise},apiError:()=> 'old error',esc:x=>x};
 vm.runInNewContext(sourceFunction('teaching-assignments.js','loadQueue'),ctx);const pending=ctx.loadQueue();ctx.authGeneration++;node.innerHTML='new queue';d.reject(Error('obsolete'));await pending;assert.equal(node.innerHTML,'new queue');
});
test('Assignments removes prior identity detail DOM before checking a replacement identity',async()=>{
 const h=harness('assignments');h.node('detail-panel').textContent='private prior package';const pending=h.run({uid:'next'});assert.equal(h.node('detail-panel').textContent,'');h.requests[0].resolve({active:false});await pending;
});
