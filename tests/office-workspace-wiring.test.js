'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sourceFunction=require('../test-support/source-function');
const {repositoryPath}=require('../tools/build/frontend-paths');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(repositoryPath(root,name),'utf8');
function context(){const sync=[],nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{classList:{add(){},remove(){}},textContent:'',disabled:false});return nodes.get(id);};return {sync,nodes,$,officeWorkspace:{sync:p=>sync.push(p)},traineesEntry:null,afcForms:null,facultyArchive:null,cccReplace:null,closeHistory(){},document:{body:{classList:{add(){},remove(){}}}}};}

test('office pages load pure navigation capabilities and shared shell before real page controllers',()=>{
 for(const page of ['faculty-admin','teaching-assignments']){
  const html=read(page+'.html');for(const module of ['faculty-route-access.js','workspace-navigation.js','office-workspace.js']){
   assert.ok(html.includes('src="'+module+'"'),page+' '+module);assert.ok(html.indexOf('src="'+module+'"')<html.indexOf('src="'+page+'.js"'));
  }
  assert.doesNotMatch(html,/src="faculty-access\.js"|firebase-firestore-compat/);
 }
 const manifest=JSON.parse(read('tools/static-assets.json'));assert.equal(manifest.length,91);assert.ok(manifest.includes('office-workspace.js'));assert.ok(manifest.includes('faculty-route-access.js'));
});

test('Dashboard lock closes workspace and unlock syncs only supplied validated profile',()=>{
 const h=context(),profile={active:true,role:'faculty'};
 vm.runInNewContext(sourceFunction('faculty-admin.js','lock')+'\n'+sourceFunction('faculty-admin.js','unlock')+'\nlock("Denied");unlock(profile);',{...h,profile});
 assert.equal(h.sync.length,2);assert.equal(h.sync[0],null);assert.equal(h.sync[1],profile);
 const s=read('faculty-admin.js');assert.match(s,/unlock\(profile\); await loadSelfFaculty/);assert.match(s,/unlock\(profile\); loadAdminDashboard/);
});

test('Assignments gate closes workspace and unlock keeps the validated current profile',()=>{
 const h=context(),profile={active:true,role:'faculty'};
 vm.runInNewContext(sourceFunction('teaching-assignments.js','showGate')+'\n'+sourceFunction('teaching-assignments.js','unlock')+'\nshowGate("Denied");unlock();',{...h,profile});
 assert.equal(h.sync.length,2);assert.equal(h.sync[0],null);assert.equal(h.sync[1],profile);
});

test('Assignments bindings are idempotent across auth restoration and identity refresh',()=>{
 const registrations=new Map();const $=id=>({addEventListener(type){const key=id+':'+type;registrations.set(key,(registrations.get(key)||0)+1);}});
 vm.runInNewContext(sourceFunction('teaching-assignments.js','bind')+'\nbind();bind();',{$,controlsBound:false,document:{querySelectorAll:()=>[]},renderQueue(){},publish(){}});
 assert.equal(registrations.get('reload-button:click'),1);assert.equal(registrations.get('publish-button:click'),1);
});

test('office visibility and content surfaces remain scoped and hidden controls cannot leak through flex styles',()=>{
 const css=read('workspace.css');assert.match(css,/\.paws-navigation-section \[hidden\]\{display:none!important\}/);
 assert.match(css,/body\.paws-office-shell/);assert.match(css,/\.paws-office-shell\.paws-office-locked/);
 assert.match(css,/\.paws-office-shell \.data-table/);assert.match(css,/font-variant-numeric:tabular-nums/);
});
