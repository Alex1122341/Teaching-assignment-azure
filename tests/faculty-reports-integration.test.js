'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {repositoryPath}=require('../tools/build/frontend-paths');
test('reports preserve the shared contrast-aware keyboard focus token',()=>{assert.match(fs.readFileSync(repositoryPath(process.cwd(),'faculty-reports.css'),'utf8'),/focus-visible\{outline:2px solid var\(--workspace-focus/);});
test('reports are deferred, administrator-only and included once in the static manifest',()=>{
 const read=p=>fs.readFileSync(repositoryPath(process.cwd(),p),'utf8'),html=read('faculty-admin.html'),admin=read('faculty-admin.js'),assets=JSON.parse(fs.readFileSync('tools/static-assets.json'));
 assert.match(html,/id="reports-tab"/);assert.match(html,/id="reports-view"/);assert.doesNotMatch(html,/<script[^>]+src="faculty-reports.js"/);assert.match(admin,/createReportEntry/);assert.match(admin,/tabName==='reports'&&!dashboardAdmin/);assert.equal(assets.filter(p=>p==='faculty-reports.js').length,1);assert.equal(assets.filter(p=>p==='faculty-reports.css').length,1);
});
test('deferred module completion cannot mount private reports after account change or leaving the tab',async()=>{
 for(const action of ['clear','identity']){let resolve,mounts=0,user={uid:'admin',role:'owner'};const scripts=[],window={addEventListener(){},UCVM:{admin:u=>u?.role==='owner'}},document={readyState:'loading',querySelector:()=>true,createElement:()=>({}),head:{appendChild:s=>scripts.push(s)}};
 vm.runInNewContext(fs.readFileSync(repositoryPath(process.cwd(),'asset-loader.js'),'utf8'),{window,document,setTimeout});const entry=window.UCVM_ASSETS.createReportEntry({host:{innerHTML:''},getUser:()=>user,isAdministrator:u=>u?.role==='owner'});const p=entry.open();if(action==='clear')entry.clear();else user={uid:'other',role:'owner'};window.PAWS_REPORTS={mount(){mounts++;return {destroy(){}};}};scripts[0].onload();await p;assert.equal(mounts,0,action);}
});
