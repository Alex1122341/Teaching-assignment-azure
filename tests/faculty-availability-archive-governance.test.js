'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze');
const GOVERNANCE='ad605dbb9ab92457df972703c723e2b991fa284c';
const report=JSON.parse(execFileSync('git',['show',GOVERNANCE+':tools/beta-baseline.json'],{cwd:root,encoding:'utf8'}));
const BASE='33c4e9f4506e4632e673c2e8a462bc9987ce7e51',PRODUCT='370c30a21d99ae7227f97f1e0cb781864c674768',ORIGINAL='23e35c8bd0d107a22fcea6f00c88e9f221f0fa53';
// Verify Availability's original release delta against the immutable CCC product,
// separately from the current presentation-only faculty name promotion.
const PREVIOUS_ANCHOR='5b135dfc91332a6fad29376d1d88d9acd33fd62a',ANCHOR='ba915e99ca06677d58e129f6fb671bd40d21600e';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const tree=ref=>new Map(git('ls-tree','-r',ref).split(/\r?\n/).map(line=>{const [meta,file]=line.split('\t');return[file,meta.split(' ')[2]];}));
test('release freeze retains latest accepted History archive restoration and exact original Availability runtime',()=>{
 assert.ok(git('show',GOVERNANCE+':tools/beta-freeze.js').includes("const BASELINE_COMMIT='"+ANCHOR+"'"));
 assert.ok(git('show',GOVERNANCE+':tools/beta-api-freeze.js').includes("require('./beta-freeze')"));assert.equal(report.sourceCommit,ANCHOR);
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
 const historicCccTree=tree(PREVIOUS_ANCHOR);
 assert.deepEqual(after.filter(file=>historicCccTree.get(file)!==combined.get(file)).sort(),['index.html','paws-data-client.js','timetable.js']);
 const newAnchorTree=tree(ANCHOR);
 for(const file of manifest(PREVIOUS_ANCHOR))assert.ok(newAnchorTree.has(file),'previous protected asset missing: '+file);
 assert.deepEqual(manifest(ANCHOR),manifest(PREVIOUS_ANCHOR),'the display-only promotion must not alter protected inventory');
 assert.equal(freeze.verifyFreeze({root}).ok,true);assert.equal(api.verifyFreeze({root}).ok,true);
});

