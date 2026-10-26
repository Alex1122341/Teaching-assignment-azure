'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
let createAccountAccessFunctions;
try{({createAccountAccessFunctions}=require('../src/runtime/swa-account-access-functions'));}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
function harness(){
 assert.equal(typeof createAccountAccessFunctions,'function','access HTTP wrapper must exist');
 const calls=[],make=names=>Object.fromEntries(names.map(name=>[name,async(...args)=>{calls.push({name,args});return {status:200,body:{name}};}]));
 return {calls,handle:createAccountAccessFunctions({api:make(['self','catalog','list','preview','commit','history']),collaboration:make(['groups','saveGroup','updateMembers','announcements','publishAnnouncement','legacyAudit'])})};
}
const request=(path,options={})=>new Request('https://paws.test/api/v1/access/'+path,{...options,headers:{authorization:'Bearer credential',...(options.headers||{})}});
const json=(body,method='POST')=>({method,headers:{'content-type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)});

test('access HTTP routes dispatch exact methods and preserve private no-store and domain status',async()=>{
 const h=harness();
 for(const [path,method,name,args] of [
  ['self','GET','self',[]],['catalog','GET','catalog',[]],['accounts?search=Smith&offset=50','GET','list',[{search:'Smith',offset:50}]],
  ['preview','POST','preview',[{reason:'Approved'}]],['commit','POST','commit',[{operationId:'stable'}]],
  ['history?targetUid=target&offset=0','GET','history',[{targetUid:'target',offset:0}]],
  ['groups','GET','groups',[]],['groups','POST','saveGroup',[null,{name:'Group'}]],
  ['groups/g-1','PATCH','saveGroup',['g-1',{name:'Group'}]],['groups/g-1/members','PATCH','updateMembers',['g-1',{name:'Group'}]],
  ['announcements','GET','announcements',[]],['announcements','POST','publishAnnouncement',[{name:'Group'}]],
  ['legacy-audit?cursor=last','GET','legacyAudit',[{cursor:'last'}]]
 ]){
  const payload=name==='preview'?{reason:'Approved'}:name==='commit'?{operationId:'stable'}:{name:'Group'};
  const result=await h.handle(request(path,method==='GET'?{}:json(payload,method)));
  assert.equal(result.status,200,path);assert.equal(result.headers['Cache-Control'],'private, no-store');assert.deepEqual(h.calls.at(-1),{name,args:['credential',...args]});
 }
 const denied=await h.handle(request('commit'));assert.equal(denied.status,405);assert.equal(denied.headers.Allow,'POST');
 assert.equal((await h.handle(request('groups/g-1/members',{method:'DELETE'}))).status,405);
 assert.equal((await h.handle(request('unknown'))).status,404);
});

test('access HTTP rejects duplicate keys, unknown query fields, invalid offsets and oversized raw JSON before dispatch',async()=>{
 const h=harness();
 for(const path of ['accounts?offset=-50','accounts?offset=1','accounts?offset=1e2','accounts?offset=00','accounts?offset=50&offset=100','history?offset=9007199254741000','self?role=owner','groups?ownerUid=other','legacy-audit?cursor=a&cursor=b'])assert.equal((await h.handle(request(path))).status,400,path);
 assert.equal((await h.handle(request('groups/bad%2Fid/members',json({},'PATCH')))).status,400);
 assert.equal((await h.handle(request('preview',json('{"changes":{"role":"faculty","r\\u006fle":"owner"}}')))).status,400);
 assert.equal((await h.handle(request('preview',json('{"reason":"one","reason":"two"}')))).status,400);
 assert.equal((await h.handle(request('preview',json({value:'x'.repeat(32768)})))).status,413);
 assert.equal((await h.handle(request('preview',{method:'POST',body:'{}'}))).status,415);
 assert.equal((await h.handle({url:'https://paws.test/api/v1/access/preview',method:'POST',headers:new Headers({'content-type':'application/json'}),json:async()=>({})})).status,400);
 assert.equal(h.calls.length,0);
});

test('access HTTP delegates identity denial and hides unexpected server details',async()=>{
 const h=harness(),handle=createAccountAccessFunctions({api:{self:async token=>({status:token?403:401,body:{error:{code:token?'OWNER_REQUIRED':'UNAUTHENTICATED'}}})},collaboration:{}});
 const result=await handle(new Request('https://paws.test/api/v1/access/self'));assert.equal(result.status,401);assert.equal(result.jsonBody.error.code,'UNAUTHENTICATED');
 assert.equal((await handle(request('self'))).status,403);
 const broken=createAccountAccessFunctions({api:{self:async()=>{throw Error('PRIVATE-DETAIL');}},collaboration:{}});
 const unavailable=await broken(request('self'));assert.equal(unavailable.status,503);assert.doesNotMatch(JSON.stringify(unavailable),/PRIVATE-DETAIL/);assert.equal(h.calls.length,0);
});
