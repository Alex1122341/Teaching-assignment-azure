'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..'),freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze');
const BASE='188451ebf824359cc2dfc2a93395c4f3de32fb21',PRODUCT='2946257c6c01e0201257d5745187e2648abcda50';
const git=(...args)=>execFileSync('git',args,{cwd:root});
test('integrated PR133 retains restored origin and changes only two public assets',()=>{
  const manifest=JSON.parse(git('show',BASE+':tools/static-assets.json'));
  assert.deepEqual(JSON.parse(git('show',PRODUCT+':tools/static-assets.json')),manifest);
  const delta=manifest.filter(file=>!freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:BASE,file}),freeze.readBaselineFile({root,baselineCommit:PRODUCT,file})));
  assert.deepEqual(delta,['paws-data-client.js','timetable.js']);
  assert.equal(require('../frontend/scripts/paws-api-origin').apiOrigin,'https://cultures-please-skirt-tba.trycloudflare.com');
  const protectedApi=[...api.baselineRuntimeFiles({root,baselineCommit:BASE}),...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES];
  for(const file of protectedApi)assert.ok(freeze.bytesMatch(git('show',BASE+':'+file),git('show',PRODUCT+':'+file)),file);
  assert.equal(git('diff','--name-only',BASE,PRODUCT,'--','database').toString().trim(),'');
});
test('integrated governance pins immutable product and changes no shipped bytes',()=>{
  assert.equal(freeze.BASELINE_COMMIT,PRODUCT);assert.equal(api.BASELINE_COMMIT,PRODUCT);
  assert.equal(require('../tools/beta-baseline.json').sourceCommit,PRODUCT);
  const manifest=JSON.parse(git('show',PRODUCT+':tools/static-assets.json'));
  for(const file of manifest)assert.ok(freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:PRODUCT,file}),freeze.readWorkingFile({root,file})),file);
  const protectedApi=[...api.baselineRuntimeFiles({root,baselineCommit:PRODUCT}),...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES];
  assert.deepEqual(git('diff','--name-only',PRODUCT,'HEAD').toString().trim().split(/\r?\n/).filter(file=>protectedApi.includes(file)||file.startsWith('frontend/')),[]);
});
