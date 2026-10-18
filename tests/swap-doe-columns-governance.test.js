'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze'),report=require('../tools/beta-baseline.json');
const PRODUCT='894090c5204f8df97671b0dc4588f661534bad32',PREVIOUS='d7e4887cb413667fef0d992105148defb19f856c';
test('SWAP DOE column governance pins the reviewed product and preserves all protected paths',()=>{
 assert.equal(freeze.BASELINE_COMMIT,PRODUCT);assert.equal(api.BASELINE_COMMIT,PRODUCT);assert.equal(report.sourceCommit,PRODUCT);
 execFileSync('git',['merge-base','--is-ancestor',PREVIOUS,PRODUCT],{cwd:root});
 const manifest=ref=>JSON.parse(execFileSync('git',['show',ref+':tools/static-assets.json'],{cwd:root,encoding:'utf8'})).sort(),before=manifest(PREVIOUS),after=manifest(PRODUCT);
 assert.equal(after.length,79);assert.deepEqual(after,before);
 const oldApi=api.baselineRuntimeFiles({root,baselineCommit:PREVIOUS}),newApi=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});assert.equal(newApi.length,95);assert.deepEqual(newApi,oldApi);
 const changed=execFileSync('git',['diff','--name-only',PREVIOUS,PRODUCT],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(f=>after.includes(f)).sort(),['adfa-swap-panel.js','swap-workflow-sql.css']);
 assert.deepEqual(changed.filter(f=>[...newApi,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES].includes(f)).sort(),['server/src/doe/doe-workflow-preview-service.js','server/src/swap/swap-api.js']);
 for(const file of after)assert.equal(report.sha256[file],freeze.sha256Canonical(freeze.readBaselineFile({root,baselineCommit:PRODUCT,file})),file);
 const historical=execFileSync('git',['show','a3a3efa8ddee1d0cc3e3ef15c35280e692b33d2d:tools/beta-freeze.js'],{cwd:root,encoding:'utf8'});assert.ok(historical.includes("const BASELINE_COMMIT='"+PREVIOUS+"'"));
 assert.equal(freeze.verifyFreeze({root}).ok,true);assert.equal(api.verifyFreeze({root}).ok,true);
});
