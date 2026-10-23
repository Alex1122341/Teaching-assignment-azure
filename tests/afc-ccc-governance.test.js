'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=repositoryPath(__dirname,'..'),freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze'),report=require('../tools/beta-baseline.json');
const PRODUCT='9eb2dafea78674013a6c7fd894cdb1b6f2342c3f',PREVIOUS='331a636544e7232dbe98f67edbdf1cfbfa0e535d';
test('AFC originals and whole-year CCC have one exact immutable product anchor with additive protection',()=>{
 const historical=execFileSync('git',['show','2cc768516dcf4e1785074dec9156ef1c7c923922:tools/beta-freeze.js'],{cwd:root,encoding:'utf8'});assert.ok(historical.includes("const BASELINE_COMMIT='"+PRODUCT+"'"));execFileSync('git',['merge-base','--is-ancestor',PRODUCT,freeze.BASELINE_COMMIT],{cwd:root});assert.equal(api.BASELINE_COMMIT,freeze.BASELINE_COMMIT);assert.equal(report.sourceCommit,freeze.BASELINE_COMMIT);
 execFileSync('git',['merge-base','--is-ancestor',PREVIOUS,PRODUCT],{cwd:root});
 const manifest=ref=>JSON.parse(execFileSync('git',['show',ref+':tools/static-assets.json'],{cwd:root,encoding:'utf8'})).sort();
 const before=manifest(PREVIOUS),after=manifest(PRODUCT),oldApi=api.baselineRuntimeFiles({root,baselineCommit:PREVIOUS}),newApi=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});
 assert.equal(before.length,77);assert.equal(after.length,79);assert.deepEqual(before.filter(f=>!after.includes(f)),[]);assert.deepEqual(after.filter(f=>!before.includes(f)),['faculty-admin-afc-forms.js','faculty-admin-ccc-replacement.js']);
 assert.equal(oldApi.length,81);assert.equal(newApi.length,93);assert.deepEqual(oldApi.filter(f=>!newApi.includes(f)),[]);
 const changed=execFileSync('git',['diff','--name-only',PREVIOUS,PRODUCT],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 const staticDelta=['faculty-admin-afc-forms.js','faculty-admin-ccc-replacement.js','faculty-admin.css','faculty-admin.html','faculty-admin.js','paws-data-client.js'];
 const apiDelta=['server/src/afc/afc-form-api.js','server/src/afc/afc-form-pdf-guards.js','server/src/afc/afc-form-pdf-worker.js','server/src/afc/afc-form-pdf.js','server/src/calendar/activity-workbook-worker.js','server/src/calendar/ccc-replacement-api.js','server/src/calendar/ccc-workbook-worker.js','server/src/calendar/ccc-workbook.js','server/src/calendar/workbook-safety.js','server/src/data/sql-afc-form-repository.js','server/src/data/sql-ccc-replacement-repository.js','server/src/data/write-gates.js','server/src/history/change-history-projection.js','server/src/runtime/swa-afc-form-functions.js','server/src/runtime/swa-ccc-replacement-functions.js','server/src/runtime/swa-sql-runtime.js','server/src/runtime/university-http-server.js'];
 assert.deepEqual(changed.filter(f=>after.includes(f)).sort(),staticDelta.sort());assert.deepEqual(changed.filter(f=>[...newApi,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES].includes(f)).sort(),apiDelta.sort());
 for(const file of [...after,...newApi,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES].filter(f=>!changed.includes(f)))assert.equal(freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:PREVIOUS,file}),freeze.readBaselineFile({root,baselineCommit:PRODUCT,file})),true,file);
 assert.equal(freeze.verifyFreeze({root}).ok,true);assert.equal(api.verifyFreeze({root}).ok,true);
});
