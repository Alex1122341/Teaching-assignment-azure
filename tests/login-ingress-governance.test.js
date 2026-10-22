'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=repositoryPath(__dirname,'..'),freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze');
const previous='0798408fa819f6040953ccf325d5cfb5e06ca7fc',product='331a636544e7232dbe98f67edbdf1cfbfa0e535d';
test('login recovery freeze changes exactly the API origin and preserves all API bytes and protected paths',()=>{
 const historical=execFileSync('git',['show','6b5e744530308c2153d89ddd488731a9f4708c30:tools/beta-freeze.js'],{cwd:root,encoding:'utf8'});assert.ok(historical.includes("const BASELINE_COMMIT='"+product+"'"));execFileSync('git',['merge-base','--is-ancestor',product,freeze.BASELINE_COMMIT],{cwd:root});assert.equal(api.BASELINE_COMMIT,freeze.BASELINE_COMMIT);
 execFileSync('git',['merge-base','--is-ancestor',previous,product],{cwd:root});
 const manifest=ref=>JSON.parse(execFileSync('git',['show',ref+':tools/static-assets.json'],{cwd:root,encoding:'utf8'})).sort();
 const before=manifest(previous),after=manifest(product);assert.equal(after.length,77);assert.deepEqual(after,before);
 const oldApi=api.baselineRuntimeFiles({root,baselineCommit:previous}),newApi=api.baselineRuntimeFiles({root,baselineCommit:product});assert.equal(newApi.length,81);assert.deepEqual(newApi,oldApi);
 const changed=execFileSync('git',['diff','--name-only',previous,product],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(f=>after.includes(f)),['paws-api-origin.js']);
 assert.deepEqual(changed.filter(f=>[...newApi,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES].includes(f)),[]);
 assert.equal(freeze.verifyFreeze({root}).ok,true);assert.equal(api.verifyFreeze({root}).ok,true);
});
