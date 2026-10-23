'use strict';

const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), {execFileSync}=require('node:child_process');
const root=repositoryPath(__dirname,'..');
const staticFreeze=require('../tools/beta-freeze.js'), apiFreeze=require('../tools/beta-api-freeze.js');
const GOVERNANCE='8249a331a2069d2172db304cc7dff586a7f8df02';
const report=JSON.parse(execFileSync('git',['show',GOVERNANCE+':tools/beta-baseline.json'],{cwd:root,encoding:'utf8'}));
const MAIN='ad605dbb9ab92457df972703c723e2b991fa284c';
const PREVIOUS='ba915e99ca06677d58e129f6fb671bd40d21600e';
const PRODUCT='f78b10a1401bcb8675f8fd5414ec3d98eafa1ffd';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const changes=(before,after)=>git('diff','--name-only',before,after).split(/\r?\n/).filter(Boolean);

test('retired Azure frontend product modifies exactly two frozen browser assets',()=>{
  git('merge-base','--is-ancestor',MAIN,PRODUCT);
  git('merge-base','--is-ancestor',PREVIOUS,PRODUCT);
  git('merge-base','--is-ancestor',PRODUCT,'HEAD');
  const before=JSON.parse(git('show',MAIN+':tools/static-assets.json'));
  const after=JSON.parse(git('show',PRODUCT+':tools/static-assets.json'));
  assert.equal(before.length,85);
  assert.deepEqual(after,before,'do not silently remove any browser functionality');
  const modified=changes(MAIN,PRODUCT).filter(file=>before.includes(file)).sort();
  assert.deepEqual(modified,['paws-data-client.js','timetable.js']);
  for(const asset of before.filter(file=>!modified.includes(file)))assert.equal(
    staticFreeze.sha256Canonical(staticFreeze.readBaselineFile({root,baselineCommit:MAIN,file:asset})),
    staticFreeze.sha256Canonical(staticFreeze.readBaselineFile({root,baselineCommit:PRODUCT,file:asset})),asset);
});

test('retired frontend symbols do not touch protected API, SQL or deployment workflows',()=>{
  const oldRuntime=apiFreeze.baselineRuntimeFiles({root,baselineCommit:MAIN});
  const newRuntime=apiFreeze.baselineRuntimeFiles({root,baselineCommit:PRODUCT});
  assert.deepEqual(newRuntime,oldRuntime);
  const protectedApi=[...oldRuntime,...apiFreeze.BUILD_DEFINITION_FILES,...apiFreeze.REPOSITORY_INPUT_FILES];
  const actual=changes(MAIN,PRODUCT);
  assert.deepEqual(actual.filter(file=>protectedApi.includes(file)),[]);
  assert.deepEqual(actual.filter(file=>file.startsWith('database/')),[]);
  assert.deepEqual(actual.filter(file=>file.startsWith('.github/workflows/')),[]);
  assert.deepEqual(actual.filter(file=>file.startsWith('server/src/')),[]);
});

test('separate governance promotion pins the immutable product commit and current artifact hashes',()=>{
  assert.ok(git('show',GOVERNANCE+':tools/beta-freeze.js').includes("const BASELINE_COMMIT='"+PRODUCT+"'"));
  assert.ok(git('show',GOVERNANCE+':tools/beta-api-freeze.js').includes("require('./beta-freeze')"));
  assert.equal(report.sourceCommit,PRODUCT);
  const files=JSON.parse(git('show',PRODUCT+':tools/static-assets.json'));
  assert.deepEqual(Object.keys(report.sha256).sort(),[...files].sort());
  for(const asset of files)assert.equal(
    report.sha256[asset],
    staticFreeze.sha256Canonical(staticFreeze.readBaselineFile({root,baselineCommit:PRODUCT,file:asset})),asset);
  const protectedApi=apiFreeze.baselineRuntimeFiles({root,baselineCommit:PRODUCT});
  const unexpected=changes(PRODUCT,'8249a331a2069d2172db304cc7dff586a7f8df02').filter(file=>
    files.includes(file)||protectedApi.includes(file)||
    apiFreeze.BUILD_DEFINITION_FILES.includes(file)||apiFreeze.REPOSITORY_INPUT_FILES.includes(file));
  assert.deepEqual(unexpected,[],'governance commit cannot edit protected application blobs');
  assert.equal(staticFreeze.verifyFreeze({root}).ok,true);
  assert.equal(apiFreeze.verifyFreeze({root}).ok,true);
});
