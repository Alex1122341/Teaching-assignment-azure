'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze'),report=require('../tools/beta-baseline.json');
const PRODUCT='13fbaa08c13599d727cbc5b24a45502844dc6303',PREVIOUS='9eb2dafea78674013a6c7fd894cdb1b6f2342c3f';
test('compact year history and record originals pin the independently reviewed product without protection removal',()=>{
 assert.equal(freeze.BASELINE_COMMIT,PRODUCT);assert.equal(api.BASELINE_COMMIT,PRODUCT);assert.equal(report.sourceCommit,PRODUCT);
 execFileSync('git',['merge-base','--is-ancestor',PREVIOUS,PRODUCT],{cwd:root});
 const manifest=ref=>JSON.parse(execFileSync('git',['show',ref+':tools/static-assets.json'],{cwd:root,encoding:'utf8'})).sort(),before=manifest(PREVIOUS),after=manifest(PRODUCT),oldApi=api.baselineRuntimeFiles({root,baselineCommit:PREVIOUS}),newApi=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});
 assert.equal(before.length,79);assert.deepEqual(after,before);assert.equal(oldApi.length,93);assert.equal(newApi.length,95);assert.deepEqual(oldApi.filter(f=>!newApi.includes(f)),[]);
 assert.deepEqual(newApi.filter(f=>!oldApi.includes(f)).sort(),['server/src/calendar/ccc-template.js','server/src/history/history-year.js']);
 const changed=execFileSync('git',['diff','--name-only',PREVIOUS,PRODUCT],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(f=>after.includes(f)).sort(),['afc-timetable-panel.js','change-history.css','change-history.js','faculty-admin-afc-forms.js','faculty-admin-afc-records.js','faculty-admin-ccc-replacement.js','faculty-admin.html','faculty-admin.js','paws-data-client.js','timetable.js'].sort());
 assert.deepEqual(changed.filter(f=>[...newApi,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES].includes(f)).sort(),['server/src/afc/afc-form-api.js','server/src/calendar/ccc-replacement-api.js','server/src/calendar/ccc-template.js','server/src/data/dashboard-api.js','server/src/data/sql-afc-write-repository.js','server/src/data/sql-dashboard-repository.js','server/src/history/change-history-api.js','server/src/history/change-history-export.js','server/src/history/change-history-projection.js','server/src/history/history-year.js','server/src/runtime/swa-ccc-replacement-functions.js','server/src/runtime/swa-change-history-functions.js'].sort());
 for(const file of [...after,...newApi,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES].filter(f=>!changed.includes(f)))assert.equal(freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:PREVIOUS,file}),freeze.readBaselineFile({root,baselineCommit:PRODUCT,file})),true,file);
 assert.equal(freeze.verifyFreeze({root}).ok,true);assert.equal(api.verifyFreeze({root}).ok,true);
});
