'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createLabReadRuntime}=require('../tools/testing/firestore-read-runtime');
const {startTestingHttpServer}=require('../tools/testing/firestore-http');
const PROJECT='paws-testing-ucvm-20261022';
const ID='c1111111-1111-4111-8111-111111111111';
const auth=async token=>{
  if(!['admin','faculty'].includes(token))throw Error('Bad token');
  return {uid:token,aud:PROJECT,iss:'https://securetoken.google.com/'+PROJECT};
};
const db={
  projectId:'vista-teaching-lab',databaseId:'(default)',
  collection(name){
    if(name!=='paws_testing_users')throw Error('No unnecessary DB access: '+name);
    return {doc(uid){return {get:async()=>({exists:true,data:()=>({
      synthetic:true,firstName:'Test',lastName:'Person',role:uid==='admin'?'owner':'faculty',
      facultyId:uid==='faculty'?'a1111111-1111-4111-8111-111111111111':null,
      active:true,mustChangePassword:false
    })})};}};
  }
};
const request=(method,path,token='admin',body={room:'New Room'})=>new Request('https://testing.invalid'+path,{
  method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  ...(method==='PATCH'?{body:JSON.stringify(body)}:{})
});
test('Testing Session write gate defaults closed; no repository called',async()=>{
  const calls=[];
  const runtime=createLabReadRuntime({db,verifyIdToken:auth,sessionWriter:{updateSession:async()=>{calls.push('write');return{};}}});
  const r=await runtime(request('PATCH','/api/v1/sessions/'+ID));
  assert.equal(r.status,405);
  assert.deepEqual(calls,[]);
});
test('opted-in Testing Session PATCH keeps PAWS role checks and uses only injected Testing writer',async()=>{
  const writes=[];
  const runtime=createLabReadRuntime({db,verifyIdToken:auth,enableSessionWrites:true,
    sessionWriter:{updateSession:async args=>{writes.push(args);return{id:args.sessionId,room:args.patch.room};}}});
  const own=await runtime(request('PATCH','/api/v1/sessions/'+ID));
  assert.equal(own.status,200);
  assert.equal(own.jsonBody.session.room,'New Room');
  assert.equal(writes.length,1);
  assert.equal(writes[0].actorFirebaseUid,'admin');
  assert.equal((await runtime(request('PATCH','/api/v1/sessions/'+ID,'faculty'))).status,403);
  assert.equal((await runtime(request('PATCH','/api/v1/sessions/'+ID,'invalid'))).status,401);
  assert.equal(writes.length,1);
});
test('Loopback Testing HTTP accepts only explicit bounded Session PATCH when configured',async t=>{
  const requests=[];
  const server=await startTestingHttpServer({port:0,allowSameSite:true,allowSessionWrites:true,
    runtime:async req=>{requests.push({method:req.method,url:new URL(req.url).pathname,body:await req.json()});
      return{status:200,jsonBody:{session:{id:ID}}};}});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url='http://127.0.0.1:'+server.address().port+'/api/v1/sessions/'+ID;
  const origin='https://tester-teaching.web.app';
  const preflight=await fetch(url,{method:'OPTIONS',headers:{origin,'access-control-request-method':'PATCH',
    'access-control-request-headers':'authorization,content-type'}});
  assert.equal(preflight.status,204);
  const response=await fetch(url,{method:'PATCH',headers:{origin,authorization:'Bearer synthetic',
    'content-type':'application/json'},body:JSON.stringify({room:'Fake room'})});
  assert.equal(response.status,200);
  assert.deepEqual(requests,[{method:'PATCH',url:'/api/v1/sessions/'+ID,body:{room:'Fake room'}}]);
  assert.equal((await fetch(url,{method:'PATCH',headers:{origin,'content-type':'application/json'},
    body:JSON.stringify({room:'x'.repeat(30000)})})).status,413);
  assert.equal(requests.length,1);
});
