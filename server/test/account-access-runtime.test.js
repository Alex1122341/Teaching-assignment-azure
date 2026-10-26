'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createSwaSqlRuntime}=require('../src/runtime/swa-sql-runtime');
const {createWriteGates}=require('../src/data/write-gates');
function harness(env={}){
 const state={role:'owner',active:true,password:false,reads:[],firestoreReads:0};
 class Pool{async connect(){return this;}async close(){}request(){return {input(){return this;},async query(sql){state.reads.push(sql);if(sql.includes('FROM paws.UserProfile'))return {recordset:[{firebaseUid:'user',displayName:'Taylor Example',baseRole:state.role,active:state.active,mustChangePassword:state.password,facultyId:state.role==='faculty'?'10000000-0000-4000-8000-000000000001':null,version:'0000000000000001'}]};if(sql.includes('FROM paws.SupportContext'))return {recordset:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',targetUid:'target',expiresAtUtc:'2099-01-01'}]};if(sql.includes('FROM paws.Faculty'))return {recordset:[]};throw Error('Unexpected SQL');}};}}
 const project='synthetic-access',app={name:'paws-beta-sql'};
 const admin={initializeApp:()=>app,app:name=>{assert.equal(name,'paws-beta-sql');return app;},auth:()=>({verifyIdToken:async token=>{if(token!=='synthetic')throw Error('Bad token');return {uid:'user',aud:project,iss:'https://securetoken.google.com/'+project};}}),firestore:()=>{state.firestoreReads++;throw Error('No Firestore in this route');}};
 admin.firestore.FieldValue={serverTimestamp:()=>null};
 const runtime=createSwaSqlRuntime({env:{FIREBASE_PROJECT_ID:project,PAWS_SQL_CONNECTION_STRING:'Server=localhost;Database=VetMed-Ops;Encrypt=true;',PAWS_SQL_DRIVER:'tedious',...env},admin,sql:{ConnectionPool:Pool}});
 return {state,runtime};
}
const request=(path,options={})=>new Request('http://local/api/v1/access/'+path,{...options,headers:{authorization:'Bearer synthetic',...(options.headers||{})}});
test('runtime checks SQL effective access on every request with the unchanged identity token',async()=>{
 const h=harness();try{
  assert.equal((await h.runtime(new Request('http://local/api/v1/access/self'))).status,401);
  const first=await h.runtime(request('self'));assert.equal(first.status,200);assert.equal(first.jsonBody.access.role,'adfa_general');assert.equal(first.jsonBody.access.version,'0000000000000001');
  assert.equal((await h.runtime(request('accounts'))).status,200);
  const catalog=await h.runtime(request('catalog'));assert.equal(catalog.status,200);assert.equal(catalog.jsonBody.writeEnabled,false);
  h.state.role='administrator';assert.equal((await h.runtime(request('accounts'))).status,403);
  h.state.role='faculty';assert.equal((await h.runtime(request('groups'))).status,403);
  h.state.active=false;const revoked=await h.runtime(request('self'));assert.equal(revoked.status,200);assert.equal(revoked.jsonBody.access.allowed,false);assert.equal((await h.runtime(request('announcements'))).status,403);
  h.state.active=true;h.state.password=true;assert.equal((await h.runtime(request('self'))).jsonBody.access.status,'password_required');assert.equal(h.state.firestoreReads,0);
 }finally{await h.runtime.close();}
});
test('access write gates fail closed independently and support impersonation cannot reach access routes',async()=>{
 const defaults=createWriteGates({}),bad=createWriteGates({PAWS_ACCOUNT_ACCESS_WRITE_ENABLED:'TRUE',PAWS_COLLABORATION_WRITE_ENABLED:'1'}),enabled=createWriteGates({PAWS_ACCOUNT_ACCESS_WRITE_ENABLED:'true',PAWS_COLLABORATION_WRITE_ENABLED:'true'});
 assert.equal(defaults.accountAccess,false);assert.equal(defaults.collaboration,false);assert.equal(bad.accountAccess,false);assert.equal(bad.collaboration,false);assert.equal(enabled.accountAccess,true);assert.equal(enabled.collaboration,true);
 const h=harness();try{
  const denied=await h.runtime(request('commit',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}));assert.equal(denied.status,503);assert.equal(denied.jsonBody.error.code,'WRITE_DISABLED');
  h.state.role='developer';const support=await h.runtime(request('self',{headers:{'x-paws-support-context':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}}));assert.equal(support.status,403);assert.equal(support.jsonBody.error.code,'SUPPORT_ROUTE_DENIED');assert.equal(h.state.firestoreReads,0);
 }finally{await h.runtime.close();}
});
