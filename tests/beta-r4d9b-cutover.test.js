'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=repositoryPath(__dirname,'..');
const read=relative=>fs.readFileSync(repositoryPath(root,relative),'utf8');
const originConfig=require('../frontend/scripts/paws-api-origin.js');

test('data client uses the centralized temporary University API origin for profile and sessions',async()=>{
  const source=read('paws-data-client.js');
  assert.match(source,/API_ORIGIN/);
  assert.match(source,/PAWS_API_ORIGIN_CONFIG/);
  assert.match(source,/const url=apiOrigin\+path/);
  assert.match(source,/fetchImpl\(url,buildInit\(token\)\)/);
  const client=require('../frontend/scripts/paws-data-client.js').createPawsDataClient({
    fetchImpl:async(url,options)=>{assert.equal(new URL(url).origin,originConfig.apiOrigin);assert.match(url,/\/api\/v1\//);assert.equal(options.headers.Authorization,'Bearer test-token');return {ok:true,json:async()=>({profile:{role:'adfa_general'},sessions:[]})}},
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
  const client=require('../frontend/scripts/paws-data-client.js').createPawsDataClient({fetchImpl:async()=>{throw new Error('must not fetch')},tokenProvider:async()=>''});
  await assert.rejects(()=>client.listSessions(),error=>error.code==='UNAUTHENTICATED');
});

test('Firebase Hosting is static-only while the University API artifact remains independently buildable',()=>{
  const deploy=read('.github/workflows/firebase-hosting-deploy.yml');
  assert.match(deploy,/firebase deploy/);
  assert.match(deploy,/--only hosting/);
  assert.doesNotMatch(deploy,/Azure\/static-web-apps-deploy|api_location\s*:/);
  const build=read('tools/build-beta-release.js');
  assert.match(build,/build-swa-api\.js/);
  assert.match(read('tools/build-swa-api.js'),/\.azure-production\\?['"]?,?api|\.azure-production\/api/);
  assert.equal(require('node:fs').existsSync(require('node:path').join(root,'.github/workflows/azure-beta-deploy.yml')),false);
});

test('timetable reads fail closed and representative mutation gates stay disabled',()=>{
  const source=read('timetable.js');
  assert.match(source,/scheduleSource='vetmed-ops-error'/);
  assert.match(source,/sessionWritesEnabled\(\)/);
  assert.match(source,/if\s*\(enabled\)\s*return true/);
  assert.doesNotMatch(source,/catch[^{]*\{[^}]*collection\(['"]sessions/);
});
