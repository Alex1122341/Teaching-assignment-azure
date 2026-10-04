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

// PAWS P3B2 candidate: static and API runtimes share one reviewed immutable
// source anchor. FC1 remains the prior static/API runtime baseline for delta proof.
const BASELINE_COMMIT='9d15cb7cd28cdda0eb56a34ccb99777c1d488569';
const PREVIOUS_API_BASELINE_COMMIT='1608577e474d58a2949c1a504bd9368f79d629ee';
const PREVIOUS_STATIC_BASELINE_COMMIT='1224fc5fb5f19a410f18c4f6d966c374498039b4';
const PREVIOUS_BASELINE_COMMIT='6bfd637af57955ded38e6a39d2c055bec67a0aa0';
const manifest=()=>JSON.parse(fs.readFileSync(path.join(root,'tools/static-assets.json'),'utf8'));

function baselineJson(ref){
  return JSON.parse(execFileSync('git',['show',`${ref}:tools/static-assets.json`],{cwd:root,encoding:'utf8'}));
}

// A. Baseline identity -------------------------------------------------------
test('beta identity is pinned to the P3B2 candidate dual-runtime baseline',()=>{
  assert.equal(baseline.sourceCommit,BASELINE_COMMIT);
  assert.equal(baseline.siteUrl,'https://red-cliff-04871ca0f.5.azurestaticapps.net');
  assert.equal(freeze.BASELINE_COMMIT,BASELINE_COMMIT);
});

test('the promoted dual-runtime baseline exists as a Git commit and is an ancestor of HEAD',()=>{
  assert.equal(freeze.baselineCommitExists(root,BASELINE_COMMIT),true);
  execFileSync('git',['merge-base','--is-ancestor',BASELINE_COMMIT,'HEAD'],{cwd:root});
});

// B. Zero drift --------------------------------------------------------------
test('the P3B2 candidate frozen runtime reports zero protected drift',()=>{
  const result=freeze.verifyFreeze({root});
  assert.equal(result.baselineCommit,BASELINE_COMMIT);
  assert.deepEqual(result.drift,[]);
  assert.equal(result.ok,true);
  assert.equal(result.protected,48);
});

test('the current static manifest has exactly 48 protected files',()=>{
  assert.equal(manifest().length,48);
  assert.equal(freeze.protectedPaths({root}).length,48);
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

test('all 48 current protected files are byte-identical to immutable B2B-PERF candidate blobs',()=>{
  const protectedFiles=freeze.protectedPaths({root});
  assert.equal(protectedFiles.length,48);
  for(const name of protectedFiles){
    assert.equal(freeze.bytesMatch(
      freeze.readBaselineFile({root,file:name}),
      fs.readFileSync(path.join(root,name))
    ),true,name);
  }
});

// C. New asset protection ----------------------------------------------------
test('B2B login/auth helper assets are protected runtime assets',()=>{
  for(const name of ['paws-data-client.js','paws-auth-continuity.js','paws-login-performance.js']){
    assert.ok(manifest().includes(name),name);
    assert.ok(freeze.protectedPaths({root}).includes(name),name);
    const result=freeze.verifyFreeze({root,files:[name]});
    assert.equal(result.ok,true,name);
    assert.deepEqual(result.drift,[],name);
  }
});

// D. Static baseline continuity (48 -> 48) ----------------------------------
test('the FC1 baseline preserves every P2A static path and adds none',()=>{
  const previous=baselineJson(PREVIOUS_STATIC_BASELINE_COMMIT);
  const current=baselineJson(BASELINE_COMMIT);
  assert.equal(previous.length,48);
  assert.equal(current.length,48);
  const missing=previous.filter(name=>!current.includes(name));
  const added=current.filter(name=>!previous.includes(name));
  assert.deepEqual(missing,[]);
  assert.deepEqual(added,[]);
});

test('the FC1 baseline changes only the reviewed PAWS data client from P2A',()=>{
  const previousPaths=freeze.protectedPaths({root,baselineCommit:PREVIOUS_STATIC_BASELINE_COMMIT});
  const currentPaths=freeze.protectedPaths({root,baselineCommit:BASELINE_COMMIT});
  const union=[...new Set([...previousPaths,...currentPaths])].sort();
  assert.equal(previousPaths.length,48);
  assert.equal(currentPaths.length,48);
  assert.equal(union.length,48);
  const changed=[];
  for(const name of union){
    const same=freeze.bytesMatch(
      freeze.readBaselineFile({root,baselineCommit:PREVIOUS_STATIC_BASELINE_COMMIT,file:name}),
      freeze.readBaselineFile({root,baselineCommit:BASELINE_COMMIT,file:name})
    );
    if(!same)changed.push(name);
  }
  assert.deepEqual(changed,['paws-data-client.js']);
});

test('tools/static-assets.json is unchanged by the FC1 promotion',()=>{
  assert.equal(freeze.bytesMatch(
    freeze.readBaselineFile({root,baselineCommit:PREVIOUS_STATIC_BASELINE_COMMIT,file:'tools/static-assets.json'}),
    freeze.readBaselineFile({root,baselineCommit:BASELINE_COMMIT,file:'tools/static-assets.json'})
  ),true);
});

test('every P2A protected path is still protected under the FC1 baseline',()=>{
  const previous=baselineJson(PREVIOUS_STATIC_BASELINE_COMMIT);
  const protectedFiles=freeze.protectedPaths({root});
  for(const name of previous)assert.ok(protectedFiles.includes(name),`${name} must remain protected`);
});

test('B0 runtime candidate files are protected and byte-identical to the promoted baseline',()=>{
  for(const name of ['asset-loader.js','approval-workflow.js','afc-workflow.js']){
    assert.ok(freeze.protectedPaths({root}).includes(name),`${name} must be protected`);
    assert.equal(freeze.bytesMatch(
      freeze.readBaselineFile({root,file:name}),
      fs.readFileSync(path.join(root,name))
    ),true,name);
  }
});

// E. Mutable-manifest attack -------------------------------------------------
test('removing a shipped file from the mutable manifest cannot drop it from the freeze',()=>{
  const protectedFiles=freeze.protectedPaths({root,readManifest:()=>['index.html']});
  assert.ok(protectedFiles.includes('approval-workflow.js'));
  assert.ok(protectedFiles.includes('scheduling-core.js'));
  assert.ok(protectedFiles.includes('paws-data-client.js'));
  assert.ok(protectedFiles.includes('paws-auth-continuity.js'));
  assert.ok(protectedFiles.includes('paws-login-performance.js'));
  // protection must stay at the full baseline manifest, not collapse to the rigged manifest
  assert.equal(protectedFiles.length,freeze.readBaselineManifest({root}).length);
  assert.equal(protectedFiles.length,48);
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
  assert.equal(Object.keys(baseline.sha256).length,11);
  assert.ok(baseline.sha256['paws-auth-continuity.js']);
  assert.ok(baseline.sha256['paws-login-performance.js']);
  // Verification never reads this file: a drift verdict comes from Git objects only.
  const result=freeze.verifyFreeze({root,files:['timetable.js'],readWorking:()=>Buffer.from('tampered\n')});
  assert.equal(result.ok,false);
});

// G. Dual-runtime baseline ---------------------------------------------------
test('API freeze shares the promoted static baseline and has zero runtime drift',()=>{
  const apiFreeze=require('../tools/beta-api-freeze.js');
  assert.equal(apiFreeze.BASELINE_COMMIT,BASELINE_COMMIT);
  assert.equal(apiFreeze.BASELINE_COMMIT,freeze.BASELINE_COMMIT);
  const result=apiFreeze.verifyFreeze({root});
  assert.deepEqual(result.drift,[]);
  assert.equal(result.ok,true);
  assert.equal(result.runtimeFiles.length,27);
  assert.ok(result.runtimeFiles.includes('server/src/data/sql-doe-target-repository.js'));
  assert.ok(result.runtimeFiles.includes('server/src/data/sql-afc-write-repository.js'));
  assert.ok(result.runtimeFiles.includes('server/src/afc/afc-request-api.js'));
  assert.ok(result.runtimeFiles.includes('server/src/afc/afc-approval-api.js'));
  assert.ok(result.runtimeFiles.includes('server/src/runtime/swa-afc-request-functions.js'));
  assert.ok(result.buildDefinitionFiles.includes('deploy/aca/Dockerfile'));
});

test('API freeze imports the single static baseline constant',()=>{
  const apiFreezeSource=fs.readFileSync(path.join(root,'tools/beta-api-freeze.js'),'utf8');
  assert.doesNotMatch(apiFreezeSource,/const\s+BASELINE_COMMIT\s*=/);
  assert.match(apiFreezeSource,/require\('\.\/beta-freeze'\)/);
});

test('P3B preserves the FC1 API runtime and adds only the reviewed AFC workflow files',()=>{
  const apiFreeze=require('../tools/beta-api-freeze.js');
  const previous=apiFreeze.baselineRuntimeFiles({root,baselineCommit:PREVIOUS_API_BASELINE_COMMIT});
  const current=apiFreeze.baselineRuntimeFiles({root,baselineCommit:BASELINE_COMMIT});
  assert.equal(previous.length,21);
  assert.equal(current.length,27);
  assert.deepEqual(previous.filter(name=>!current.includes(name)),[]);
  assert.deepEqual(current.filter(name=>!previous.includes(name)),[
    'server/src/afc/afc-approval-api.js',
    'server/src/afc/afc-policy.js',
    'server/src/afc/afc-request-api.js',
    'server/src/data/sql-afc-approval-repository.js',
    'server/src/data/sql-afc-request-repository.js',
    'server/src/runtime/swa-afc-request-functions.js'
  ]);
});

test('P3B changes only the reviewed shared SQL runtime mount among pre-existing FC1 API files',()=>{
  const apiFreeze=require('../tools/beta-api-freeze.js');
  const previous=apiFreeze.baselineRuntimeFiles({root,baselineCommit:PREVIOUS_API_BASELINE_COMMIT});
  const changed=[];
  for(const name of previous){
    const same=freeze.bytesMatch(
      freeze.readBaselineFile({root,baselineCommit:PREVIOUS_API_BASELINE_COMMIT,file:name}),
      freeze.readBaselineFile({root,baselineCommit:BASELINE_COMMIT,file:name})
    );
    if(!same)changed.push(name);
  }
  assert.deepEqual(changed,['server/src/runtime/swa-sql-runtime.js']);
});

test('P3B leaves swa-api and the ACA Dockerfile untouched from FC1',()=>{
  const apiFreeze=require('../tools/beta-api-freeze.js');
  const unchanged=[...apiFreeze.API_SOURCE_ROOTS,...apiFreeze.BUILD_DEFINITION_FILES];
  for(const name of unchanged){
    assert.equal(freeze.bytesMatch(
      freeze.readBaselineFile({root,baselineCommit:PREVIOUS_API_BASELINE_COMMIT,file:name}),
      freeze.readBaselineFile({root,baselineCommit:BASELINE_COMMIT,file:name})
    ),true,`${name} must be unchanged by the P3B promotion`);
  }
});

test('the promoted API anchor carries the accepted request-timing allowlist',()=>{
  const anchored=freeze.readBaselineFile({root,file:'server/src/perf/request-timing.js'}).toString('utf8');
  assert.match(anchored,/const METRIC_NAMES = Object\.freeze\(\[/);
  for(const metric of ['firebase_verify','sql_connect','sql_user_query','profile_validate','me_total']){
    assert.match(anchored,new RegExp(`'${metric}'`),metric);
  }
  assert.match(anchored,/new Set\(\['cold', 'warm'\]\)/);
  // No persistence, logging sink, or identity material may appear in the timing module.
  assert.doesNotMatch(anchored,/require\('node:fs'\)/);
  assert.doesNotMatch(anchored,/console\./);
  assert.doesNotMatch(anchored,/token|uid|facultyId|email/i);
});

test('the timing module only emits Server-Timing for eligible authenticated requests',()=>{
  const timing=freeze.readBaselineFile({root,file:'server/src/perf/request-timing.js'}).toString('utf8');
  assert.match(timing,/if \(!eligible\) return '';/);
  const api=freeze.readBaselineFile({root,file:'server/src/data/data-api.js'}).toString('utf8');
  // Eligibility is granted only after a successful token verification.
  assert.match(api,/if \(timing\) timing\.markEligible\(\);/);
  const runtime=freeze.readBaselineFile({root,file:'server/src/runtime/swa-functions.js'}).toString('utf8');
  // The header is attached only when a non-empty Server-Timing value exists.
  assert.match(runtime,/const value = timing && timing\.serverTiming\(\);/);
  assert.match(runtime,/if \(!value\) return \{ status, jsonBody: body \};/);
  assert.match(runtime,/'Access-Control-Expose-Headers': 'Server-Timing'/);
});

// H. Corrected runtime anchoring --------------------------------------------
test('the promoted API anchor carries the corrected unfiltered AFC list query',()=>{
  const anchored=freeze.readBaselineFile({root,file:'server/src/data/sql-dashboard-repository.js'}).toString('utf8');
  // BETA-R4D-12B1D-R: an unfiltered AFC list has no predicates at all, so the
  // WHERE clause must be omitted entirely. The superseded runtime emitted a
  // bare `WHERE`, which the endpoint surfaced as 503 SQL_UNAVAILABLE.
  assert.match(anchored,/const whereClause = predicates\.length \? `WHERE \$\{predicates\.join\(' AND '\)\}` : '';/);
  const afc=anchored.slice(anchored.indexOf('FROM paws.vAfcRecordUnified u'));
  const statement=afc.slice(0,afc.indexOf('ORDER BY'));
  assert.ok(statement.length>0);
  assert.match(statement,/\$\{whereClause\}/);
  assert.doesNotMatch(statement,/WHERE \$\{predicates\.join/);
});

test('the superseded anchor is retained as historical evidence only',()=>{
  assert.notEqual(PREVIOUS_BASELINE_COMMIT,BASELINE_COMMIT);
  assert.equal(freeze.baselineCommitExists(root,PREVIOUS_BASELINE_COMMIT),true);
  // The superseded anchor is still an ancestor, so its blobs stay readable as
  // history while no longer being the verification authority.
  execFileSync('git',['merge-base','--is-ancestor',PREVIOUS_BASELINE_COMMIT,'HEAD'],{cwd:root});
});
