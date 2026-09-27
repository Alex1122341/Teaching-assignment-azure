'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const baseline=require('../tools/beta-baseline.json');
const freeze=require('../tools/beta-freeze.js');

// BETA-R4D-9E/F (Governance Commit F): the frozen trust anchor is Runtime Commit E.
const BASELINE_COMMIT='f74443d945a9f6c917e7e634eb2e7825f02c7ab0';
const PREVIOUS_BASELINE_COMMIT='6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26';
const manifest=()=>JSON.parse(fs.readFileSync(path.join(root,'tools/static-assets.json'),'utf8'));

function baselineJson(ref){
  return JSON.parse(execFileSync('git',['show',`${ref}:tools/static-assets.json`],{cwd:root,encoding:'utf8'}));
}

// A. Baseline identity -------------------------------------------------------
test('beta identity is pinned to Runtime Commit E',()=>{
  assert.equal(baseline.sourceCommit,BASELINE_COMMIT);
  assert.equal(baseline.siteUrl,'https://red-cliff-04871ca0f.5.azurestaticapps.net');
  assert.equal(freeze.BASELINE_COMMIT,BASELINE_COMMIT);
});

test('Runtime Commit E exists as a Git commit and is an ancestor of HEAD',()=>{
  assert.equal(freeze.baselineCommitExists(root,BASELINE_COMMIT),true);
  execFileSync('git',['merge-base','--is-ancestor',BASELINE_COMMIT,'HEAD'],{cwd:root});
});

// B. Zero drift --------------------------------------------------------------
test('the promoted frozen runtime reports zero protected drift',()=>{
  const result=freeze.verifyFreeze({root});
  assert.equal(result.baselineCommit,BASELINE_COMMIT);
  assert.deepEqual(result.drift,[]);
  assert.equal(result.ok,true);
  assert.equal(result.protected,45);
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

// C. New asset protection ----------------------------------------------------
test('paws-data-client.js is a protected runtime asset',()=>{
  assert.ok(manifest().includes('paws-data-client.js'));
  assert.ok(freeze.protectedPaths({root}).includes('paws-data-client.js'));
  const result=freeze.verifyFreeze({root,files:['paws-data-client.js']});
  assert.equal(result.ok,true);
  assert.deepEqual(result.drift,[]);
});

// D. Historical monotonicity (45 -> 45) --------------------------------------
test('the new baseline manifest is a superset of the previous protected path set',()=>{
  const previous=baselineJson(PREVIOUS_BASELINE_COMMIT);
  const current=baselineJson(BASELINE_COMMIT);
  assert.equal(previous.length,45);
  assert.equal(current.length,45);
  const missing=previous.filter(name=>!current.includes(name));
  assert.deepEqual(missing,[]);
  assert.deepEqual(current.filter(name=>!previous.includes(name)),[]);
});

test('every previous protected path is still protected under the promoted baseline',()=>{
  const previous=baselineJson(PREVIOUS_BASELINE_COMMIT);
  const protectedFiles=freeze.protectedPaths({root});
  for(const name of previous)assert.ok(protectedFiles.includes(name),`${name} must remain protected`);
});

// E. Mutable-manifest attack -------------------------------------------------
test('removing a shipped file from the mutable manifest cannot drop it from the freeze',()=>{
  const protectedFiles=freeze.protectedPaths({root,readManifest:()=>['index.html']});
  assert.ok(protectedFiles.includes('approval-workflow.js'));
  assert.ok(protectedFiles.includes('scheduling-core.js'));
  assert.ok(protectedFiles.includes('paws-data-client.js'));
  // protection must stay at the full baseline manifest, not collapse to the rigged manifest
  assert.equal(protectedFiles.length,freeze.readBaselineManifest({root}).length);
  assert.equal(protectedFiles.length,45);
});

// F. Mutable-hash attack -----------------------------------------------------
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

test('beta-baseline.json hashes are derived from the frozen baseline commit',()=>{
  for(const [name,expected] of Object.entries(baseline.sha256)){
    const baselineObject=freeze.readBaselineFile({root,file:name});
    const actual=crypto.createHash('sha256').update(freeze.normalize(baselineObject),'utf8').digest('hex');
    assert.equal(actual,expected,name);
  }
});

test('beta-baseline.json remains non-authoritative and records the promoted baseline',()=>{
  assert.equal(baseline.sourceCommit,freeze.BASELINE_COMMIT);
  assert.ok(Object.keys(baseline.sha256).length>0);
  // Verification never reads this file: a drift verdict comes from Git objects only.
  const result=freeze.verifyFreeze({root,files:['timetable.js'],readWorking:()=>Buffer.from('tampered\n')});
  assert.equal(result.ok,false);
});
