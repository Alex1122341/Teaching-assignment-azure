'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze'),report=require('../tools/beta-baseline.json');
const MAIN='ad605dbb9ab92457df972703c723e2b991fa284c',ORIGINAL='2994c73df92d1e692aa28094bb5c1ceec72403c8',PRODUCT='424242603af2d6ff313d6db3520e6d04ad5f9024';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const manifest=ref=>JSON.parse(git('show',ref+':tools/static-assets.json')).sort();
const tree=ref=>new Map(git('ls-tree','-r',ref).split(/\r?\n/).map(line=>{const [meta,file]=line.split('\t');return[file,meta.split(' ')[2]];}));

test('reviewed latest-name environment product retains current main and protects only its bounded runtime delta',()=>{
 assert.equal(freeze.BASELINE_COMMIT,PRODUCT);assert.equal(api.BASELINE_COMMIT,PRODUCT);assert.equal(report.sourceCommit,PRODUCT);
 for(const parent of [MAIN,ORIGINAL])git('merge-base','--is-ancestor',parent,PRODUCT);
 git('merge-base','--is-ancestor',PRODUCT,'HEAD');
 const before=manifest(MAIN),after=manifest(PRODUCT),oldApi=api.baselineRuntimeFiles({root,baselineCommit:MAIN}),newApi=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});
 assert.equal(before.length,85);assert.equal(after.length,86);assert.deepEqual(before.filter(f=>!after.includes(f)),[]);assert.deepEqual(after.filter(f=>!before.includes(f)),['paws-environment-nav.js']);
 assert.equal(oldApi.length,110);assert.equal(newApi.length,111);assert.deepEqual(oldApi.filter(f=>!newApi.includes(f)),[]);assert.deepEqual(newApi.filter(f=>!oldApi.includes(f)),['server/src/runtime/environment.js']);
 const staticDelta=['bulk-import-ui.js','developer-support.js','faculty-access.js','faculty-admin.html','faculty-admin.js','index.html','password.html','paws-api-origin.js','paws-data-client.js','paws-environment-nav.js','teaching-assignments.html','teaching-assignments.js','timetable.js','user-management.html'];
 const apiDelta=['server/src/data/sql-connection.js','server/src/data/write-gates.js','server/src/runtime/environment.js','server/src/runtime/swa-sql-runtime.js','server/src/runtime/university-api.js','server/src/runtime/university-http-server.js','server/src/support/support-service.js'];
 const changed=git('diff','--name-only',MAIN,PRODUCT).split(/\r?\n/),protectedApi=[...new Set([...newApi,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES])];
 assert.deepEqual(changed.filter(f=>after.includes(f)).sort(),staticDelta);assert.deepEqual(changed.filter(f=>protectedApi.includes(f)).sort(),apiDelta);
 assert.equal(protectedApi.length,114);assert.deepEqual(changed.filter(f=>f.startsWith('database/azure-sql/')),[]);
 const previous=tree(MAIN),product=tree(PRODUCT);
 for(const file of [...before,...protectedApi].filter(f=>!staticDelta.includes(f)&&!apiDelta.includes(f)))assert.equal(product.get(file),previous.get(file),file);
 for(const file of ['faculty-availability.js','faculty-availability.css','ccc-schedule.js','ccc-schedule.css','change-history.js','server/src/availability/faculty-availability-api.js','server/src/ccc/ccc-schedule-api.js','database/azure-sql/056_faculty_availability_read.sql','database/azure-sql/057_ccc_schedule_read.sql'])assert.equal(product.get(file),previous.get(file),file);
 assert.deepEqual(Object.keys(report.sha256).sort(),after);
 for(const file of after)assert.equal(report.sha256[file],freeze.sha256Canonical(freeze.readBaselineFile({root,baselineCommit:PRODUCT,file})),file);
 assert.equal(freeze.verifyFreeze({root}).ok,true);assert.equal(api.verifyFreeze({root}).ok,true);
});
