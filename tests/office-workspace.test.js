'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {domHarness}=require('../test-support/workspace-dom');
const root=path.resolve(__dirname,'..'),adapterPath=path.join(root,'frontend/scripts/office-workspace.js');
function access(){const window={};vm.runInNewContext(fs.readFileSync(path.join(root,'frontend/scripts/faculty-access.js'),'utf8'),{window});return window.UCVM;}
function adapter(){return require(adapterPath);}
function office(page='faculty',width=1024){
 const h=domHarness(width,{autoMount:false});h.win.PAWS_FACULTY_ROUTE_ACCESS=require('../frontend/scripts/faculty-route-access');h.win.PAWS_WORKSPACE_NAVIGATION=require('../frontend/scripts/workspace-navigation');
 const nodes={header:h.options.header,calendar:h.destination,admin:h.privateNode,globalNodes:[]};h.destination.textContent='Teaching Schedule';
 const api=adapter().mount({document:h.doc,window:h.win,page,nodes});
 return {...h,api,officeNodes:nodes,nav:h.created.find(n=>n.className==='paws-navigation'),menu:h.created.find(n=>n.className==='paws-navigation-toggle')};
}

test('shared Assignments navigation admission exactly matches existing route roles',()=>{
 const a=access();
 for(const role of ['owner','administrator','admin','adfa_general','adfa_regular','hicc','visc','faculty'])assert.equal(a.canOpenTeachingAssignments({role}),true,role);
 for(const role of ['developer','other_office','editor','viewer','adc','lab','unknown',''])assert.equal(a.canOpenTeachingAssignments({role}),false,role);
 assert.equal(a.canOpenTeachingAssignments(null),false);assert.equal(a.canOpenTeachingAssignments({baseRole:'faculty'}),true);
});

test('shared access import installs no Calendar observer on office routes and retains Calendar alignment',()=>{
 const source=fs.readFileSync(path.join(root,'frontend/scripts/faculty-access.js'),'utf8');let styles=0,observers=0;
 const document={readyState:'complete',documentElement:{},getElementById:id=>id==='calendar-body'?{}:null,createElement:()=>({}),head:{appendChild(){styles++;}},querySelectorAll:()=>[]};
 vm.runInNewContext(source,{window:{},document,requestAnimationFrame:fn=>fn(),MutationObserver:class{observe(){observers++;}}});
 assert.equal(styles,1);assert.equal(observers,1);
 vm.runInNewContext(source,{window:{},document:{getElementById:()=>null}});
});

test('pure route capability projection exactly matches shared compatibility helpers and performs no I/O',()=>{
 const pure=require('../frontend/scripts/faculty-route-access'),legacy=access();
 for(const role of ['owner','administrator','admin','adfa_general','adfa_regular','faculty','hicc','visc','developer','editor','viewer','other_office','unknown','']){
  for(const name of ['canOpenFacultyDashboard','canOpenTeachingAssignments'])assert.equal(pure[name]({role}),legacy[name]({role}),name+' '+role);
 }
 assert.doesNotMatch(fs.readFileSync(path.join(root,'frontend/scripts/faculty-route-access.js'),'utf8'),/fetch\(|firestore|document|localStorage|sessionStorage|firebase/);
});

test('office shell moves original actions once, labels current route and never widens guarded management',()=>{
 const h=office('faculty',1440);const {mount}=adapter();assert.equal(mount({document:h.doc,window:h.win,page:'faculty',nodes:h.officeNodes}),h.api);
 assert.equal(h.destination.parentElement.className,'paws-navigation-section');
 assert.equal(h.doc.body.classList.contains('paws-office-shell'),true);
 assert.equal(h.created.find(n=>n.className==='paws-page-title').textContent,'Faculty Dashboard');
 h.api.sync({active:true,role:'adfa_regular'});
 assert.equal(h.nav.hidden,false);assert.equal(h.privateNode.parentElement.hidden,true);
 const active=h.created.filter(n=>n.attrs['aria-current']==='page');assert.equal(active.length,1);assert.equal(active[0].href,'faculty-admin.html');
});

test('office lock and profile switch clear global visibility and restore drawer background',()=>{
 const h=office();h.api.sync({active:true,role:'adfa_general'});h.menu.onclick();assert.equal(h.main.inert,true);
 h.api.sync(null);assert.equal(h.nav.hidden,true);assert.equal(h.menu.disabled,true);assert.equal(h.main.inert,false);
 h.api.sync({active:true,role:'developer'});const assignments=h.created.find(n=>n.href==='teaching-assignments.html');assert.equal(assignments.hidden,true);
 h.api.sync({active:true,role:'faculty'});assert.equal(assignments.hidden,false);
 h.api.sync({active:false,role:'adfa_general'});assert.equal(h.nav.hidden,true);
 h.api.sync({active:true,role:'faculty',mustChangePassword:true});assert.equal(h.nav.hidden,true);
});

test('Assignments shell keeps a truthful title and intentionally authorized current route',()=>{
 const h=office('assignments');h.api.sync({active:true,role:'faculty'});
 assert.equal(h.created.find(n=>n.className==='paws-page-title').textContent,'Teaching Assignments');
 assert.equal(h.created.find(n=>n.attrs['aria-current']==='page').href,'teaching-assignments.html');
 assert.throws(()=>office('mock-overview'),/Unsupported/);
});

test('office theme control uses current shared theme and remains local presentation state',()=>{
 const h=office();h.api.sync({active:true,role:'faculty'});const theme=h.created.find(n=>n.id==='office-theme-toggle');
 assert.equal(theme.attrs['aria-pressed'],'false');theme.onclick();assert.equal(h.doc.documentElement.classList.contains('dark'),true);assert.equal(theme.attrs['aria-pressed'],'true');theme.onclick();assert.equal(h.doc.documentElement.classList.contains('dark'),false);
});

test('office adapter is presentation only and uses shared role capabilities',()=>{
 const s=fs.readFileSync(adapterPath,'utf8');assert.doesNotMatch(s,/fetch\(|firestore|localStorage|sessionStorage|\.currentUser\(|Overview|location\.(?:assign|replace)/);
 assert.match(s,/canOpenTeachingAssignments/);assert.match(s,/canOpenFacultyDashboard/);assert.doesNotMatch(s,/cloneNode/);
});
