'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze');
const BASE='9734d2d9ba6cd927dbec3585838689f235ed0e9f',PRODUCT='16027769c774367c65d5dd68fc1a8002a052589e';
const RECEIPT='0baedfefc35dd35be4f146e49e3615351f35ebb7';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
test('office UI changes exactly four static assets with identical full protection and no API or dependency drift',()=>{
 const before=JSON.parse(git('show',BASE+':tools/static-assets.json')),after=JSON.parse(git('show',PRODUCT+':tools/static-assets.json'));
 assert.equal(after.length,87);assert.deepEqual(after,before);
 const staticDelta=after.filter(file=>!freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:BASE,file}),freeze.readBaselineFile({root,baselineCommit:PRODUCT,file})));
 assert.deepEqual(staticDelta.sort(),['index.html','leadership-directory.css','leadership-directory.js','workspace.css']);
 const oldApi=api.baselineRuntimeFiles({root,baselineCommit:BASE}),newApi=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});
 assert.equal(newApi.length,115);assert.deepEqual(newApi,oldApi);
 const changed=git('diff','--name-only',BASE,PRODUCT).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(file=>file.startsWith('database/')||file.startsWith('server/')||file.startsWith('swa-api/')||file==='firestore.rules'||api.REPOSITORY_INPUT_FILES.includes(file)||api.BUILD_DEFINITION_FILES.includes(file)),[]);
});
test('historical office UI governance pins its reviewed product while active freezes remain enforced',()=>{
 assert.ok(git('show',RECEIPT+':tools/beta-freeze.js').includes("const BASELINE_COMMIT='"+PRODUCT+"'"));
 assert.ok(git('show',RECEIPT+':tools/beta-api-freeze.js').includes("const { BASELINE_COMMIT } = require('./beta-freeze')"));
 assert.equal(JSON.parse(git('show',RECEIPT+':tools/beta-baseline.json')).sourceCommit,PRODUCT);
 const protectedApi=[...api.baselineRuntimeFiles({root,baselineCommit:PRODUCT}),...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES];
 assert.deepEqual(git('diff','--name-only',PRODUCT,RECEIPT).trim().split(/\r?\n/).filter(file=>file.startsWith('frontend/')||protectedApi.includes(file)),[]);
 assert.equal(freeze.verifyFreeze({root}).ok,true);assert.equal(api.verifyFreeze({root}).ok,true);
});
