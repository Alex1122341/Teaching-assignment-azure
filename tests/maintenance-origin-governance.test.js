'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze'),report=require('../tools/beta-baseline.json');
const BASE='ad605dbb9ab92457df972703c723e2b991fa284c',PRODUCT='00ed3f0b2a7936b7957797df944b0fdd91341946';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const changed=(a,b)=>git('diff','--name-only',a,b).split(/\r?\n/).filter(Boolean);
test('maintenance product changes only the origin and preserves all protected static API SQL bytes',()=>{
 const manifest=JSON.parse(git('show',BASE+':tools/static-assets.json'));
 assert.deepEqual(JSON.parse(git('show',PRODUCT+':tools/static-assets.json')),manifest);
 assert.equal(manifest.length,85);assert.deepEqual(changed(BASE,PRODUCT).filter(file=>manifest.includes(file)),['paws-api-origin.js']);
 assert.equal(require('../paws-api-origin').apiOrigin,'https://cultures-please-skirt-tba.trycloudflare.com');
 assert.deepEqual(api.baselineRuntimeFiles({root,baselineCommit:PRODUCT}),api.baselineRuntimeFiles({root,baselineCommit:BASE}));
 const protectedApi=[...api.baselineRuntimeFiles({root,baselineCommit:BASE}),...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES];
 assert.equal(protectedApi.length,113);assert.deepEqual(changed(BASE,PRODUCT).filter(file=>protectedApi.includes(file)||file.startsWith('database/')),[]);
});
test('separate maintenance governance pins the product without changing protected application bytes',()=>{
 assert.equal(freeze.BASELINE_COMMIT,PRODUCT);assert.equal(api.BASELINE_COMMIT,PRODUCT);assert.equal(report.sourceCommit,PRODUCT);
 const manifest=JSON.parse(git('show',PRODUCT+':tools/static-assets.json'));
 assert.deepEqual(Object.keys(report.sha256).sort(),manifest.sort());
 for(const file of manifest)assert.equal(report.sha256[file],freeze.sha256Canonical(freeze.readBaselineFile({root,baselineCommit:PRODUCT,file})),file);
 const protectedApi=[...api.baselineRuntimeFiles({root,baselineCommit:PRODUCT}),...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES];
 assert.deepEqual(changed(PRODUCT,'HEAD').filter(file=>manifest.includes(file)||protectedApi.includes(file)),[]);
 git('merge-base','--is-ancestor','ba915e99ca06677d58e129f6fb671bd40d21600e',PRODUCT);
 assert.equal(freeze.verifyFreeze({root}).ok,true);assert.equal(api.verifyFreeze({root}).ok,true);
});
