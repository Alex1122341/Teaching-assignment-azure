'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createPawsAzureDataClient}=require('../paws-data-client.js');

test('Azure client is fixed to SQL mode and exposes no backend selector or write path',()=>{
  const source=fs.readFileSync('paws-data-client.js','utf8');
  const client=createPawsAzureDataClient({fetchImpl:async()=>({ok:true,json:async()=>({})}),tokenProvider:async()=>'t'});
  assert.equal(client.sessionBackend(),'azure-sql');
  assert.equal(client.sessionWritesEnabled(),false);
  assert.doesNotMatch(source,/firestore/i);
  assert.doesNotMatch(source,/UCVM_PAWS_SESSION_BACKEND|backend\s*:\s*['\"]/i);
});

test('current user and sessions use same-origin bearer GET requests',async()=>{
  const calls=[];
  const client=createPawsAzureDataClient({
    tokenProvider:async()=>'firebase-id-token',
    fetchImpl:async(url,init)=>{
      calls.push({url,init});
      if(url==='/api/v1/me')return{ok:true,json:async()=>({profile:{role:'viewer'}})};
      return{ok:true,json:async()=>({sessions:[{id:'1'}]})};
    }
  });
  assert.equal((await client.currentUser()).role,'viewer');
  assert.deepEqual(await client.listSessions({start:'2026-09-01',end:'2026-09-08'}),[{id:'1'}]);
  assert.equal(calls[0].url,'/api/v1/me');
  assert.match(calls[1].url,/^\/api\/v1\/sessions\?/);
  for(const call of calls){
    assert.equal(call.init.method,'GET');
    assert.equal(call.init.headers.Authorization,'Bearer firebase-id-token');
  }
});

test('missing token and API failures fail closed without alternate data source',async()=>{
  let called=false;
  const noToken=createPawsAzureDataClient({tokenProvider:async()=>'',fetchImpl:async()=>{called=true;throw new Error('should not call')}});
  await assert.rejects(noToken.currentUser(),e=>e.code==='UNAUTHENTICATED');
  assert.equal(called,false);

  const failed=createPawsAzureDataClient({
    tokenProvider:async()=>'x',
    fetchImpl:async()=>({ok:false,status:403,json:async()=>({error:{code:'PROFILE_REQUIRED',message:'No SQL profile'}})})
  });
  await assert.rejects(failed.listSessions(),e=>e.code==='PROFILE_REQUIRED'&&e.status===403);
});
