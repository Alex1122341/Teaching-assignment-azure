'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze');
const BASE='2664feef74e340d0b3df4a6f422663c571bc7731',PRODUCT='5a3117d4aec48b685e734651f4caa24d9050ba4f';
const NAME_ACCEPTED_MAIN='9734d2d9ba6cd927dbec3585838689f235ed0e9f';
const CURRENT_FREEZE_PRODUCT='4c23f7f1d096437c4fcc020556cb1f0253701ecb';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
test('name constitution promotion protects all existing static and API assets, adds only the shared server formatter',()=>{
 const before=JSON.parse(git('show',BASE+':tools/static-assets.json')),after=JSON.parse(git('show',PRODUCT+':tools/static-assets.json'));
 assert.equal(after.length,87);assert.deepEqual(after,before);
 const oldApi=api.baselineRuntimeFiles({root,baselineCommit:BASE}),newApi=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});
 assert.equal(newApi.length,115);assert.deepEqual(oldApi.filter(f=>!newApi.includes(f)),[]);
 assert.deepEqual(newApi.filter(f=>!oldApi.includes(f)),['server/src/domain/person-name.js']);
 const changed=git('diff','--name-only',BASE,PRODUCT).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(f=>f.startsWith('database/')||api.REPOSITORY_INPUT_FILES.includes(f)||api.BUILD_DEFINITION_FILES.includes(f)),[]);
 assert.equal(changed.includes('server/src/data/faculty-display-name.js'),false,'legacy identity/matching stays unchanged');
});
test('name governance remains immutable and the later Role Period freeze does not erase its receipt',()=>{
 git('merge-base','--is-ancestor',PRODUCT,CURRENT_FREEZE_PRODUCT);
 const protectedApi=[...api.baselineRuntimeFiles({root,baselineCommit:PRODUCT}),...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES];
 assert.deepEqual(git('diff','--name-only',PRODUCT,NAME_ACCEPTED_MAIN).trim().split(/\r?\n/).filter(f=>f.startsWith('frontend/')||protectedApi.includes(f)),[]);
 assert.equal(freeze.BASELINE_COMMIT,CURRENT_FREEZE_PRODUCT);
 assert.equal(api.BASELINE_COMMIT,CURRENT_FREEZE_PRODUCT);
 assert.equal(require('../tools/beta-baseline.json').sourceCommit,CURRENT_FREEZE_PRODUCT);
 const currentApi=[...api.baselineRuntimeFiles({root,baselineCommit:CURRENT_FREEZE_PRODUCT}),...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES];
 assert.deepEqual(git('diff','--name-only',CURRENT_FREEZE_PRODUCT,'HEAD').trim().split(/\r?\n/).filter(f=>f.startsWith('frontend/')||currentApi.includes(f)),[]);
 assert.equal(freeze.verifyFreeze({root}).ok,true);assert.equal(api.verifyFreeze({root}).ok,true);
});
