'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const baseline=require('../tools/beta-baseline.json');
const freeze=require('../tools/beta-freeze.js');

const BASELINE_COMMIT='86bd5aa2c8a25259f3f708e49b322220ff43a147';
const manifest=()=>JSON.parse(fs.readFileSync(path.join(root,'tools/static-assets.json'),'utf8'));

test('beta identity is pinned to the verified live Azure site',()=>{
  assert.equal(baseline.sourceCommit,BASELINE_COMMIT);
  assert.equal(baseline.siteUrl,'https://red-cliff-04871ca0f.5.azurestaticapps.net');
  assert.equal(freeze.BASELINE_COMMIT,BASELINE_COMMIT);
});

test('freeze protects every shipped file named by the static asset manifest',()=>{
  const shipped=manifest();
  const protectedFiles=freeze.protectedPaths({root});
  assert.ok(shipped.length>0);
  for(const name of shipped)assert.ok(protectedFiles.includes(name),`${name} must be protected`);
  const legacy=['index.html','timetable.js','timetable.css','faculty-admin.html','faculty-admin.js'];
  for(const name of legacy)assert.ok(protectedFiles.includes(name),`${name} must remain protected`);
  for(const name of ['approval-workflow.js','scheduling-core.js'])assert.ok(protectedFiles.includes(name),`${name} must be protected`);
});

test('release candidate reports only its explicit protected runtime drift',()=>{
  const result=freeze.verifyFreeze({root});
  assert.equal(result.baselineCommit,BASELINE_COMMIT);
  assert.deepEqual(result.drift,[
    {file:'firebase-config.js',reason:'missing-at-baseline'},
    {file:'index.html',reason:'content-drift'},
    {file:'paws-data-client.js',reason:'missing-at-baseline'},
    {file:'timetable.js',reason:'content-drift'}
  ]);
  assert.equal(result.ok,false);
  assert.equal(result.protected,manifest().length);
});

test('beta-baseline.json hashes are derived from the frozen baseline commit',()=>{
  for(const [name,expected] of Object.entries(baseline.sha256)){
    const baselineObject=freeze.readBaselineFile({root,file:name});
    const actual=crypto.createHash('sha256').update(freeze.normalize(baselineObject),'utf8').digest('hex');
    assert.equal(actual,expected,name);
  }
});

test('a runtime edit plus a matching beta-baseline.json edit cannot bypass the freeze',()=>{
  const file='approval-workflow.js';
  const baselineObject=freeze.readBaselineFile({root,file});
  const tampered=Buffer.concat([baselineObject,Buffer.from('\n// tampered by an unauthorized change\n')]);
  // The coordinated edit updates the mutable manifest so it agrees with the tampered file.
  const colludingHash=freeze.sha256Canonical(tampered);
  assert.equal(colludingHash,crypto.createHash('sha256').update(freeze.normalize(tampered),'utf8').digest('hex'));
  const result=freeze.verifyFreeze({root,files:[file],readWorking:()=>tampered});
  assert.equal(result.ok,false);
  assert.deepEqual(result.drift,[{file,reason:'content-drift'}]);
});

test('removing a shipped file from the mutable manifest cannot drop it from the freeze',()=>{
  const protectedFiles=freeze.protectedPaths({root,readManifest:()=>['index.html']});
  assert.ok(protectedFiles.includes('approval-workflow.js'));
  assert.ok(protectedFiles.includes('scheduling-core.js'));
  assert.equal(protectedFiles.length,freeze.readBaselineManifest({root}).length);
});

test('the frozen baseline commit is present and is an ancestor of beta main',()=>{
  assert.equal(freeze.baselineCommitExists(root,BASELINE_COMMIT),true);
  const {execFileSync}=require('node:child_process');
  execFileSync('git',['merge-base','--is-ancestor',BASELINE_COMMIT,'HEAD'],{cwd:root});
});
