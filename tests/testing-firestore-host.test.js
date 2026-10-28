'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { hostConfig, startHost } = require('../tools/testing/firestore-api-host');

const fakeKey = project_id => JSON.stringify({ project_id, client_email:'test-api@'+project_id+'.iam.gserviceaccount.com',
  private_key:'-----BEGIN PRIVATE KEY-----\nfictional '+project_id+'\n-----END PRIVATE KEY-----' });
function settings(patch={}) { return {
  PAWS_ENVIRONMENT:'testing', PAWS_API_HOST:'127.0.0.1',PAWS_API_PORT:'18788',
  PAWS_TESTING_FIRESTORE_PROJECT:'vista-teaching-lab',
  PAWS_TESTING_AUTH_PROJECT:'paws-testing-ucvm-20261022',
  PAWS_TESTING_ALLOW_SAME_SITE:'false',PAWS_TESTING_RELEASE_SHA:'a'.repeat(40),
  PAWS_TESTING_AUTH_SERVICE_ACCOUNT_JSON:fakeKey('paws-testing-ucvm-20261022'),
  PAWS_TESTING_LAB_SERVICE_ACCOUNT_JSON:fakeKey('vista-teaching-lab'),...patch
};}

test('Firestore Testing host rejects Production SQL, wrong auth audience, credentials and external listener', () => {
  assert.equal(hostConfig(settings()).allowSameSite,false);
  assert.equal(hostConfig(settings({PAWS_TESTING_ALLOW_SAME_SITE:'true'})).allowSameSite,true);
  assert.equal(hostConfig(settings()).enableSessionWrites,false);
  assert.equal(hostConfig(settings({PAWS_TESTING_SESSION_WRITES_ENABLED:'true'})).enableSessionWrites,true);
  for (const patch of [{PAWS_ENVIRONMENT:'production'},{PAWS_API_PORT:'18787'},{PAWS_API_HOST:'0.0.0.0'},
    {PAWS_TESTING_FIRESTORE_PROJECT:'tester-teaching'}, {PAWS_TESTING_AUTH_PROJECT:'tester-teaching'},
    {PAWS_TESTING_AUTH_SERVICE_ACCOUNT_JSON:fakeKey('tester-teaching')},
    {PAWS_TESTING_LAB_SERVICE_ACCOUNT_JSON:fakeKey('tester-teaching')},
    {PAWS_TESTING_ALLOW_SAME_SITE:'yes'},{PAWS_TESTING_SESSION_WRITES_ENABLED:'yes'},{PAWS_TESTING_RELEASE_SHA:'unknown'}]) {
    assert.throws(()=>hostConfig(settings(patch)),undefined,JSON.stringify(Object.keys(patch)));
  }
});

test('Firestore host isolates the two Firebase apps and starts only the pinned loopback port', async () => {
  const calls=[],deleted=[];
  const admin={
    credential:{cert:key=>({projectId:key.project_id})},
    initializeApp(options,name){calls.push({kind:'app',name,options});return {name,delete:async()=>{deleted.push(name);}};},
    firestore(app){assert.equal(app.name,'paws-testing-lab-host');return {projectId:'vista-teaching-lab',databaseId:'(default)',collection(){return {};}};},
    auth(app){assert.equal(app.name,'paws-testing-auth-host');return {verifyIdToken:async()=>{throw Error('invalid');}};}
  };
  let started;
  const host=await startHost({env:settings({PAWS_TESTING_ALLOW_SAME_SITE:'true',PAWS_TESTING_SESSION_WRITES_ENABLED:'true'}),adminSdk:admin,
    startServer:async options=>{started=options;return {close:callback=>callback()};}});
  assert.equal(started.port,18788);
  assert.equal(started.allowSameSite,true);
  assert.equal(started.allowSessionWrites,true);
  assert.equal((await started.runtime(new Request('https://test.invalid/api/v1/me'))).status,401);
  assert.deepEqual(calls.map(x=>x.name),['paws-testing-auth-host','paws-testing-lab-host']);
  await host.close();
  assert.deepEqual(deleted.sort(),['paws-testing-auth-host','paws-testing-lab-host']);
});
