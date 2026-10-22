'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze'),report=require('../tools/beta-baseline.json');
const BASE='33c4e9f4506e4632e673c2e8a462bc9987ce7e51',PRODUCT='370c30a21d99ae7227f97f1e0cb781864c674768',ORIGINAL='23e35c8bd0d107a22fcea6f00c88e9f221f0fa53';
// The current anchor is the reviewed CCC Schedule product, which must retain the
// accepted Availability release unchanged apart from its own reviewed delta.
const ANCHOR='5b135dfc91332a6fad29376d1d88d9acd33fd62a';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const tree=ref=>new Map(git('ls-tree','-r',ref).split(/\r?\n/).map(line=>{const [meta,file]=line.split('\t');return[file,meta.split(' ')[2]];}));
test('release freeze retains latest accepted History archive restoration and exact original Availability runtime',()=>{
 assert.equal(freeze.BASELINE_COMMIT,ANCHOR);assert.equal(api.BASELINE_COMMIT,ANCHOR);assert.equal(report.sourceCommit,ANCHOR);
 git('merge-base','--is-ancestor',PRODUCT,ANCHOR);
 for(const ancestor of [BASE,ORIGINAL,'7fb4229fb718173f0d3cd6b8102451ddbfba0e48'])git('merge-base','--is-ancestor',ancestor,PRODUCT);
 git('merge-base','--is-ancestor',PRODUCT,'HEAD');
 const manifest=ref=>JSON.parse(git('show',ref+':tools/static-assets.json')).sort(),before=manifest(BASE),after=manifest(PRODUCT);
 const oldApi=api.baselineRuntimeFiles({root,baselineCommit:BASE}),newApi=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});
 assert.equal(before.length,81);assert.equal(after.length,83);assert.deepEqual(before.filter(p=>!after.includes(p)),[]);assert.deepEqual(after.filter(p=>!before.includes(p)),['faculty-availability.css','faculty-availability.js']);
 assert.equal(oldApi.length,104);assert.equal(newApi.length,107);assert.deepEqual(oldApi.filter(p=>!newApi.includes(p)),[]);assert.deepEqual(newApi.filter(p=>!oldApi.includes(p)),['server/src/availability/faculty-availability-api.js','server/src/data/sql-faculty-availability-repository.js','server/src/runtime/swa-faculty-availability-functions.js']);
 const staticDelta=['faculty-admin.html','faculty-admin.js','faculty-availability.css','faculty-availability.js','paws-data-client.js'];
 const apiDelta=['server/src/availability/faculty-availability-api.js','server/src/data/sql-dashboard-repository.js','server/src/data/sql-faculty-availability-repository.js','server/src/runtime/swa-faculty-availability-functions.js','server/src/runtime/swa-sql-runtime.js'];
 const sqlDelta=['database/azure-sql/056_faculty_availability_read.sql','database/azure-sql/rollback_056_faculty_availability_read.sql'];
 const changed=git('diff','--name-only',BASE,PRODUCT).split(/\r?\n/),protectedApi=[...new Set([...oldApi,...newApi,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES])];
 assert.deepEqual(changed.filter(p=>after.includes(p)).sort(),staticDelta);assert.deepEqual(changed.filter(p=>protectedApi.includes(p)).sort(),apiDelta);assert.deepEqual(changed.filter(p=>p.startsWith('database/azure-sql/')).sort(),sqlDelta);
 const original=tree(ORIGINAL),combined=tree(PRODUCT),main=tree(BASE);
 for(const file of [...staticDelta,...apiDelta,...sqlDelta])assert.equal(combined.get(file),original.get(file),file);
 for(const file of [...before,...protectedApi].filter(p=>!changed.includes(p)))assert.equal(combined.get(file),main.get(file),file);
 assert.equal(combined.get('.github/workflows/firebase-hosting-deploy.yml'),main.get('.github/workflows/firebase-hosting-deploy.yml'));
 assert.deepEqual(Object.keys(report.sha256).sort(),manifest(ANCHOR));for(const file of manifest(ANCHOR))assert.equal(report.sha256[file],freeze.sha256Canonical(freeze.readBaselineFile({root,baselineCommit:ANCHOR,file})),file);
 assert.deepEqual(after.filter(file=>!manifest(ANCHOR).includes(file)),[],'the CCC promotion must not drop Availability protection');
 const anchorTree=tree(ANCHOR);
 assert.deepEqual(after.filter(file=>anchorTree.get(file)!==combined.get(file)).sort(),['index.html','paws-data-client.js','timetable.js']);
 assert.equal(freeze.verifyFreeze({root}).ok,true);assert.equal(api.verifyFreeze({root}).ok,true);
});

