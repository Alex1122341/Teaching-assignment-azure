'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Firebase is the only static Hosting build target',()=>{
 const firebase=JSON.parse(read('firebase.json'));
 const manifest=JSON.parse(read('tools/static-assets.json'));
 assert.equal(firebase.hosting.public,'.deploy-static');
 assert.deepEqual(firebase.hosting.predeploy,['node tools/build-static.js']);
 assert.ok(!fs.existsSync(path.join(root,'staticwebapp.config.json')));
 for(const file of ['index.html','faculty-admin.html','approval-workflow.js','faculty-swap-safe.js','absence-from-campus-app.pdf'])assert.ok(manifest.includes(file),file+' is required');
});

test('static manifest excludes repository, development and retired Azure routing files',()=>{
 const manifest=JSON.parse(read('tools/static-assets.json'));
 assert.equal(new Set(manifest).size,manifest.length);
 for(const file of manifest){
  assert.equal(path.isAbsolute(file),false);
  assert.equal(file.includes('..'),false);
  assert.doesNotMatch(file,/(^|\/)(\.git|tests|tools|functions|docs|output)(\/|$)/);
  assert.doesNotMatch(file,/\.(?:log|rules)$/);
  assert.notEqual(file,'staticwebapp.config.json');
 }
});

test('static builder validates sources and copies only the manifest',()=>{
 const builder=read('tools/build-static.js');
 assert.match(builder,/static-assets\.json/);
 assert.match(builder,/path\.resolve/);
 assert.match(builder,/startsWith/);
 assert.match(builder,/copyFileSync/);
 assert.match(builder,/rmSync/);
});

test('Firebase retains the historic faculty-dashboard redirect',()=>{
 const hosting=JSON.parse(read('firebase.json')).hosting;
 assert.deepEqual(hosting.redirects?.find(rule=>rule.source==='/faculty-dashboard.html'),{
  source:'/faculty-dashboard.html',destination:'/index.html',type:301
 });
});

test('generated Firebase Hosting directory is exactly the application allowlist',()=>{
 execFileSync(process.execPath,[path.join(root,'tools/build-static.js')],{cwd:root,encoding:'utf8',timeout:30000});
 const output=path.join(root,'.deploy-static');
 const manifest=JSON.parse(read('tools/static-assets.json'));
 assert.ok(manifest.includes('dashboard-view-model.js'));
 assert.ok(manifest.includes('paws-login-performance.js'));
 assert.deepEqual(fs.readdirSync(output).sort(),[...manifest].sort());
 for(const name of manifest)assert.deepEqual(fs.readFileSync(path.join(output,name)),fs.readFileSync(path.join(root,name)));
 assert.equal(fs.existsSync(path.join(output,'faculty-dashboard.html')),false);
 assert.equal(fs.existsSync(path.join(output,'staticwebapp.config.json')),false);
});
