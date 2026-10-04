'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('data client uses the reviewed University VetMed-Ops API origin for profile and sessions',async()=>{
  const source=read('paws-data-client.js');
  assert.match(source,/https:\/\/itappvetopsdb01\.uc\.ucalgary\.ca/);
  assert.match(source,/API_ORIGIN/);
  assert.match(source,/const url=apiOrigin\+path/);
  assert.match(source,/fetchImpl\(url,buildInit\(token\)\)/);
  const client=require('../paws-data-client.js').createPawsAzureDataClient({
    fetchImpl:async(url,options)=>{assert.match(url,/^https:\/\/itappvetopsdb01\.uc\.ucalgary\.ca\/api\/v1\//);assert.equal(options.headers.Authorization,'Bearer test-token');return {ok:true,json:async()=>({profile:{role:'adfa_general'},sessions:[]})}},
    tokenProvider:async()=> 'test-token'
  });
  await client.currentUser();
  await client.listSessions();
  assert.equal(client.sessionBackend(),'vetmed-ops');
  assert.equal(client.sessionWritesEnabled(),false);
});

test('data client has no Firestore fallback and fails closed without a token',async()=>{
  const source=read('paws-data-client.js');
  assert.doesNotMatch(source,/firestore|collection\(['"]sessions/);
  const client=require('../paws-data-client.js').createPawsAzureDataClient({fetchImpl:async()=>{throw new Error('must not fetch')},tokenProvider:async()=>''});
  await assert.rejects(()=>client.listSessions(),error=>error.code==='UNAUTHENTICATED');
});

test('production SWA deployment is static-only while API artifact remains buildable',()=>{
  const deploy=read('.github/workflows/azure-beta-deploy.yml');
  assert.doesNotMatch(deploy,/api_location\s*:/);
  assert.doesNotMatch(deploy,/skip_api_build\s*:\s*false/);
  assert.match(deploy,/app_location:\s*\.azure-production\/app/);
  const build=read('tools/build-beta-release.js');
  assert.match(build,/build-swa-api\.js/);
  assert.match(read('tools/build-swa-api.js'),/\.azure-production\\?['"]?,?api|\.azure-production\/api/);
});

test('timetable reads fail closed and representative mutation gates stay disabled',()=>{
  const source=read('timetable.js');
  assert.match(source,/scheduleSource='azure-sql-error'/);
  assert.match(source,/sessionWritesEnabled\(\)/);
  assert.match(source,/if\s*\(enabled\)\s*return true/);
  assert.doesNotMatch(source,/catch[^{]*\{[^}]*collection\(['"]sessions/);
});
