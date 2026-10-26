'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPawsDataClient}=require('../frontend/scripts/paws-data-client');
test('access client sends exact persisted-intent commands and uses only authenticated API reads',async()=>{
 const calls=[],client=createPawsDataClient({tokenProvider:async()=>'identity',fetchImpl:async(url,init)=>{calls.push({url,init});return {ok:true,status:200,json:async()=>({access:{allowed:true},accounts:[]})};}});
 assert.equal(typeof client.effectiveAccess,'function');
 assert.equal((await client.effectiveAccess()).allowed,true);await client.accessCatalog();await client.accessAccounts({search:'de la Cruz',offset:50});
 await client.previewAccountAccess({targetUid:'person',expectedVersion:'v1',changes:{active:false},reason:'Review'});
 const command={previewId:'preview',operationId:'same-operation'};await client.commitAccountAccess(command);await client.commitAccountAccess(command);
 await client.accountAccessHistory({targetUid:'person',offset:0});await client.collaborationGroups();await client.saveCollaborationGroup(null,{creationId:'same-create',name:'Group'});await client.saveCollaborationGroup('g-1',{expectedVersion:'v1',name:'Group'});await client.saveCollaborationMembers('g-1',{expectedVersion:'v1',memberFacultyIds:['faculty']});await client.announcements();await client.publishAnnouncement({expectedVersion:'v1',title:'Title',body:'Message'});await client.legacyAccessHistory({cursor:'last'});
 assert.deepEqual(calls.map(c=>new URL(c.url).pathname),['self','catalog','accounts','preview','commit','commit','history','groups','groups','groups/g-1','groups/g-1/members','announcements','announcements','legacy-audit'].map(p=>'/api/v1/access/'+p));
 assert.equal(new URL(calls[2].url).searchParams.get('search'),'de la Cruz');assert.equal(new URL(calls[6].url).searchParams.get('offset'),'0');assert.equal(new URL(calls[13].url).searchParams.get('cursor'),'last');
 assert.equal(calls[4].init.body,calls[5].init.body);assert.deepEqual(JSON.parse(calls[8].init.body),{creationId:'same-create',name:'Group'});assert.equal(calls[9].init.method,'PATCH');assert.equal(calls[10].init.method,'PATCH');assert.ok(calls.every(c=>c.init.credentials==='omit'&&c.init.headers.Authorization==='Bearer identity'));
});
test('ambiguous access commit is never automatically replayed and carries the same recovery identifier',async()=>{
 let count=0;const client=createPawsDataClient({tokenProvider:async()=>'identity',fetchImpl:async()=>{count++;return {ok:false,status:503,json:async()=>({error:{code:'ACCESS_CONFIRMATION_REQUIRED',message:'Retry same operation'},operationId:'stable'})};}});
 assert.equal(typeof client.commitAccountAccess,'function');
 await assert.rejects(client.commitAccountAccess({previewId:'p',operationId:'stable'}),e=>e.code==='ACCESS_CONFIRMATION_REQUIRED'&&e.operationId==='stable');assert.equal(count,1);
});

test('client discards a late private response after a newer SQL scope invalidates it',async()=>{
 const {createEffectiveAccessGuard}=require('../frontend/scripts/effective-access-guard');
 const guard=createEffectiveAccessGuard({load:async()=>null,onChange:()=>{}});guard.observe({allowed:true,status:'ready',role:'owner',version:'0000000000000001'});
 let resolve;const client=createPawsDataClient({accessGuard:guard,tokenProvider:async()=>'identity',fetchImpl:async()=>new Promise(done=>resolve=done)});
 const pending=client.accessAccounts();await Promise.resolve();await Promise.resolve();guard.invalidate('changed');resolve({ok:true,status:200,json:async()=>({accounts:[{email:'PRIVATE'}]})});
 await assert.rejects(pending,e=>e.code==='ACCESS_CHANGED');
 await assert.rejects(client.accessAccounts(),e=>e.code==='ACCESS_CHANGED');
});

test('client observes authoritative self state and sends revocation errors to the guard',async()=>{
 const events=[],guard={capture:()=>0,current:()=>true,observe:access=>events.push(access),reject:error=>events.push(error.code)};
 const client=createPawsDataClient({accessGuard:guard,tokenProvider:async()=>'identity',fetchImpl:async url=>url.endsWith('/self')?{ok:true,status:200,json:async()=>({access:{allowed:false,status:'inactive'}})}:{ok:false,status:403,json:async()=>({error:{code:'PROFILE_REQUIRED'}})}});
 await client.effectiveAccess();await assert.rejects(client.accessAccounts(),e=>e.code==='PROFILE_REQUIRED');assert.deepEqual(events,[{allowed:false,status:'inactive'},'PROFILE_REQUIRED']);
});
