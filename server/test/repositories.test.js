'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSqlUserRepository } = require('../src/data/sql-user-repository');
const { createSqlSessionRepository } = require('../src/data/sql-session-repository');

test('user lookup is exact UID, read-only and includes password-change gate', async () => {
  let sql;
  const repository = createSqlUserRepository({ query: async query => { sql = query; return []; } });
  assert.equal(await repository.findByUid('u'), null);
  assert.match(sql, /FROM paws\.UserProfile/);
  assert.match(sql, /MustChangePassword/);
  // A login identity must work with the reviewed column-scoped read grant.
  assert.doesNotMatch(sql, /\bEmail\b/i);
  assert.match(sql, /FirebaseUid = @uid/);
  assert.doesNotMatch(sql, /INSERT|UPDATE|DELETE|staging\./i);
});

test('session repository reads canonical SQL view and optional assignment scope', async () => {
  let seen;
  const repository = createSqlSessionRepository({ query: async (query, params) => { seen = { query, params }; return []; } });
  await repository.list({ start: '2026-09-01', end: '2026-09-08', facultyId: 'f1' });
  assert.match(seen.query, /paws\.vCalendarSession/);
  assert.match(seen.query, /paws\.SessionAssignment/);
  assert.doesNotMatch(seen.query, /staging\./i);
  assert.equal(seen.params.facultyId, 'f1');
});

test('unbounded session repository query targets the full canonical view', async () => {
  let seen;
  const repository = createSqlSessionRepository({ query: async (query, params) => { seen = { query, params }; return []; } });
  await repository.list({});
  assert.match(seen.query, /FROM paws\.vCalendarSession c/);
  assert.doesNotMatch(seen.query, /SessionDate >=/);
  assert.deepEqual(seen.params, {});
});


test('SQL identity omits unnecessary login contacts while /me retains its nullable response field',async()=>{
  const {createDataApi}=require('../src/data/data-api');
  const repository=createSqlUserRepository({query:async (query,params)=>{
    assert.doesNotMatch(query,/\bEmail\b/i);assert.deepEqual(params,{uid:'synthetic'});
    return [{firebaseUid:'synthetic',baseRole:'adfa_regular',active:true,mustChangePassword:false,displayName:'Synthetic Account',facultyId:null}];
  }});
  const api=createDataApi({verifyToken:async()=>({uid:'synthetic',email:'unrelated-contact@example.test'}),findUser:repository.findByUid,listSessions:async()=>[]});
  const result=await api.currentUser('verified-test-token');
  assert.equal(result.status,200);assert.equal(result.body.profile.email,null);
  assert.equal(result.body.profile.role,'adfa_regular');
  assert.doesNotMatch(JSON.stringify(result.body),/unrelated-contact@example\.test/);
});
