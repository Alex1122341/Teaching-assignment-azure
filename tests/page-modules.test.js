const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),sourceFunction=require('../test-support/source-function.js');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
test('large pages keep structure while loading cacheable modules',()=>{const main=read('index.html'),admin=read('faculty-admin.html');assert.match(main,/timetable\.css/);assert.match(main,/timetable\.js/);assert.match(admin,/faculty-admin\.css/);assert.match(admin,/faculty-admin\.js/);assert.ok(main.length<50000,`index ${main.length}`);assert.ok(admin.length<40000,`admin ${admin.length}`)});
test('AFC PDF dependencies load only when an approval needs them',()=>{const html=read('index.html');assert.match(html,/asset-loader\.js/);assert.doesNotMatch(html,/pdf-lib\.min\.js|afc-pdf-browser\.js/);const loader=read('asset-loader.js'),actions=read('afc-actions.js');assert.match(loader,/function loadScriptOnce/);assert.match(loader,/ensureAfcPdf/);assert.match(actions,/await UCVM_ASSETS\.ensureAfcPdf\(\)/)});

test('Faculty Dashboard keeps administrative tabs while supporting linked faculty self-service',()=>{
 const html=read('faculty-admin.html'),source=read('faculty-admin.js'),enhancements=read('faculty-admin-enhancements.js');
 for(const pattern of [/<title>Faculty Dashboard<\/title>/,/class="gate-title">Faculty Dashboard</,/class="brand-title">Faculty Dashboard</,/<h1>Faculty Dashboard<\/h1>/])assert.match(html,pattern);
 for(const label of ['Lookup','AFC Requests','User Management','Change password'])assert.ok(html.includes('>'+label+'<'),label);
  for(const present of ['Teaching Summary','Roles &amp; Appointments'])assert.ok(html.includes('>'+present+'<'),present);
  for(const retired of ['Sessional / Other','Faculty Database','Change History'])assert.ok(!html.includes('>'+retired+'<'),retired);
  assert.match(html,/href="index\.html#approvals">AFC Requests<\/a>/);
 assert.doesNotMatch(html,/Faculty Admin Dashboard|Faculty Directory|Faculty Administration/);
 assert.match(source,/function isSelfServiceProfile\(p\)/);
 assert.match(source,/if \(isSelfServiceProfile\(profile\)\) \{ window\.UCVMSessionGuard\?\.clearNotice\?\.\(\); await enterSelfMode\(user, profile\); return; \}/);
 assert.match(source,/if \(dashboardAdmin\(profile\)\) \{ window\.UCVMSessionGuard\?\.clearNotice\?\.\(\); enterAdminMode\(user, profile\); return; \}/);
 assert.doesNotMatch(source,/sessionStorage|localStorage/,'the dashboard delegates notice cleanup without reading storage');
 const auth=source.slice(source.indexOf('auth.onAuthStateChanged'),source.indexOf('\n      });',source.indexOf('auth.onAuthStateChanged')));
 assert.match(auth,/if \(isSelfServiceProfile\(profile\)\) \{ window\.UCVMSessionGuard\?\.clearNotice\?\.\(\); await enterSelfMode\(user, profile\); return; \}/,'clear only after an authorized linked faculty profile is resolved');
 assert.match(auth,/if \(dashboardAdmin\(profile\)\) \{ window\.UCVMSessionGuard\?\.clearNotice\?\.\(\); enterAdminMode\(user, profile\); return; \}/,'clear only after an authorized admin profile is resolved');
 assert.match(source,/\$\('user-management-link'\)\??\.classList\.toggle\('hidden',\s*!dashboardGeneral\(profile\)\)/);
 const rename=enhancements.match(/ function renameDashboard\(\)\{[\s\S]*?\n \}/)?.[0];
 assert.ok(rename,'renameDashboard should remain independently executable');
 const nodes=new Map(),document={title:'Old title',documentElement:{dataset:{}},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{});return nodes.get(selector)}};
 require('node:vm').runInNewContext(`${rename}\nrenameDashboard();`,{document});
 assert.equal(document.title,'Faculty Dashboard');
 assert.equal(nodes.get('.brand-title').textContent,'Faculty Dashboard');
 assert.equal(nodes.get('.gate-title').textContent,'Faculty Dashboard');
 assert.match(nodes.get('.gate-copy').innerHTML,/href="index\.html">Timetable<\/a>/);
});

test('timetable Faculty Dashboard button supports current administrators and faculty self-service',()=>{
 const vm=require('node:vm'),source=read('timetable.js'),loader=read('asset-loader.js');
 const ui=sourceFunction('timetable.js','updateAuthUI');
 const allowed=new Set(['adfa_general','adfa_regular','faculty','hicc','visc']);
 for(const role of [null,'faculty','hicc','visc','adfa_general','adfa_regular','other_office']){
  const currentUser=role?{role,name:'Test'}:null,elements=new Map();
  const $=id=>{if(!elements.has(id))elements.set(id,{classList:{toggle(name,value){this[name]=value;},contains(){return true;}},addEventListener(_name,fn){this.click=fn;}});return elements.get(id);};
  const admin=p=>['adfa_general','adfa_regular','other_office'].includes(p?.role);
  const canOpenFacultyDashboard=p=>allowed.has(p?.role);
  const context={$ ,currentUser,window:{UCVM_PAWS_DATA:{sessionWritesEnabled:()=>false}},UCVM:{admin,general:p=>p?.role==='adfa_general',canOpenFacultyDashboard},canEdit:()=>admin(currentUser),updateScheduleSourceUI(){},roleIsFaculty:p=>p?.role==='faculty',uiSettings:{showMyTimetable:true},myTimetableOnly:false};
  vm.runInNewContext(ui+'\nupdateAuthUI();',context);
  const button=$('faculty-dashboard-btn');
  assert.equal(button.classList.hidden,!canOpenFacultyDashboard(currentUser),String(role));
 }
 assert.match(source,/\$\('faculty-dashboard-btn'\)\.addEventListener\('click',[\s\S]{0,180}UCVM\.canOpenFacultyDashboard\(currentUser\)[\s\S]{0,100}faculty-admin\.html/);
 assert.match(loader,/\['faculty','hicc','visc'\]\.includes\(UCVM\.role\(profile\?\.role\)\)/);
 assert.match(loader,/button\.classList\.remove\('hidden'\)/);
 assert.match(loader,/window\.location\.href='faculty-admin\.html'/);
});

test('the retired change-history panel is gone from the Dashboard and its theme stays available for other pages',()=>{
 const html=read('faculty-admin.html'),css=read('faculty-admin.css'),access=read('faculty-access.js');
 assert.equal(html.includes('history-view'),false);
 assert.equal(html.includes('faculty-audit'),false);
 assert.match(css,/\.history-panel\s*\{[^}]*width:\s*100%/s);
 assert.match(css,/#faculty-audit table\{[^}]*table-layout:fixed/s);
 assert.match(access,/class="audit-table"/);
});
