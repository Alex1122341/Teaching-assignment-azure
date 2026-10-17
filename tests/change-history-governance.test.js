'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze'),report=require('../tools/beta-baseline.json'),root=path.resolve(__dirname,'..');
const PRODUCT='0798408fa819f6040953ccf325d5cfb5e06ca7fc',PREVIOUS='3d983cf317147a20415e8e5cfd0d3f17532af27f';
test('history promotion pins the accepted product with exact additive runtime coverage and no exceptions',()=>{
 assert.equal(freeze.BASELINE_COMMIT,PRODUCT);assert.equal(api.BASELINE_COMMIT,PRODUCT);assert.equal(report.sourceCommit,PRODUCT);
 execFileSync('git',['merge-base','--is-ancestor',PREVIOUS,PRODUCT],{cwd:root});
 const manifest=ref=>JSON.parse(execFileSync('git',['show',ref+':tools/static-assets.json'],{cwd:root,encoding:'utf8'}));
 const before=manifest(PREVIOUS).sort(),after=manifest(PRODUCT).sort();assert.equal(before.length,75);assert.equal(after.length,77);assert.deepEqual(before.filter(f=>!after.includes(f)),[]);assert.deepEqual(after.filter(f=>!before.includes(f)),['change-history.css','change-history.js']);
 const oldApi=api.baselineRuntimeFiles({root,baselineCommit:PREVIOUS}),newApi=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});assert.equal(oldApi.length,76);assert.equal(newApi.length,81);assert.deepEqual(oldApi.filter(f=>!newApi.includes(f)),[]);
 const changed=execFileSync('git',['diff','--name-only',PREVIOUS,PRODUCT],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(f=>after.includes(f)).sort(),['afc-timetable-panel.js','change-history.css','change-history.js','faculty-admin.html','faculty-admin.js','index.html','paws-data-client.js','timetable.js']);
 assert.deepEqual(changed.filter(f=>newApi.includes(f)).sort(),['server/src/data/sql-change-history-repository.js','server/src/data/sql-doe-policy-repository.js','server/src/history/change-history-api.js','server/src/history/change-history-export.js','server/src/history/change-history-projection.js','server/src/runtime/swa-change-history-functions.js','server/src/runtime/swa-sql-runtime.js']);
 assert.equal(freeze.verifyFreeze({root}).ok,true);assert.equal(api.verifyFreeze({root}).ok,true);
});
