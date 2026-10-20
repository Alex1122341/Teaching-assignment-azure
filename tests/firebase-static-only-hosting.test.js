'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const flow=fs.readFileSync(path.join(__dirname,'..','.github','workflows','firebase-hosting-deploy.yml'),'utf8');
const between=(left,right)=>flow.slice(flow.indexOf(left),flow.indexOf(right,flow.indexOf(left)));
test('static-only deploy is opt-in and bound to the exact live API SHA',()=>{
 assert.match(flow,/static_only:\s*\n\s*description:[^\n]*\n\s*required: false\s*\n\s*type: boolean\s*\n\s*default: false/);
 assert.match(flow,/expected_live_api_sha:/);
 const attestation=between('Attest unchanged University API for static-only release','Download exact tested artifact');
 for(const marker of ['if: ${{ inputs.static_only }}','LIVE_API_SHA','TARGET_SHA','git cat-file -e','git merge-base --is-ancestor','api.baselineRuntimeFiles','api.BUILD_DEFINITION_FILES','api.REPOSITORY_INPUT_FILES',"'diff','--quiet'"]) assert.ok(attestation.includes(marker),'missing static-only API guard: '+marker);
});
test('only static-only accepts an older live API; normal release pins the exact API SHA without changing approved DOE gates',()=>{
 const before=between('Verify University API before Firebase release','Verify Firebase-site CORS before release');
 const after=between('Verify University API after Firebase release','Write Firebase deploy evidence');
 assert.match(before,/\[ "\$STATIC_ONLY" = "true" \]/);
 assert.match(before,/\.releaseSha == \$expected/);
 assert.match(before,/\.releaseSha == \$commit/);
 assert.match(after,/\[ "\$STATIC_ONLY" != "true" \]/);
 assert.match(after,/\.releaseSha == \$expected/);
 assert.match(after,/\.releaseSha == \$commit/);
 for(const section of [before,after]){
  assert.match(section,/\.writeGates \| type == "object" and length > 0 and all\(\.\[\]; type == "boolean"\)/);
  for(const name of ['doeAdmin','doePolicyPublish','doeRecalculate'])
   assert.ok(!section.includes('.writeGates.'+name+' == false'),'must not require switching off an approved live gate: '+name);
 }
});

test('static-only Hosting verifies pre/post gate fingerprint and produces auditable evidence',()=>{
 const before=between('Verify University API before Firebase release','Verify Firebase-site CORS before release');
 const after=between('Verify University API after Firebase release','Write Firebase deploy evidence');
 const evidence=between('Write Firebase deploy evidence','Upload Firebase deploy evidence');
 assert.match(before,/gateHash=.*jq -cS '\.writeGates'/);
 assert.match(after,/PREFLIGHT_GATE_HASH/);
 assert.match(after,/jq -cS '\.writeGates'/);
 for(const field of ['staticOnly','expectedLiveApiSha','preflightApiSha','preflightGateHash'])assert.ok(evidence.includes(field),'missing receipt field '+field);
 assert.match(flow,/--only hosting/);
 assert.doesNotMatch(flow,/--only firestore|--only functions/);
});
