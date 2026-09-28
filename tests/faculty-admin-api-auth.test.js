'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

function functionSource(source,name){
  const start=source.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`${name} must exist`);
  const brace=source.indexOf('{',start);
  let depth=0;
  for(let i=brace;i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`${name} has no closing brace`);
}

function dashboardHarness(currentUser){
  let authCallback=null,signOuts=0;
  const redirects=[],reads=[];
  const classList={add(){},remove(){},toggle(){}};
  const element=()=>({classList,dataset:{},style:{},value:'',textContent:'',innerHTML:'',click(){},appendChild(){},remove(){}});
  const nodes=new Map();
  const byId=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
  const auth={
    setPersistence:async()=>{},
    onAuthStateChanged(callback){authCallback=callback},
    async signOut(){signOuts++}
  };
  const db={collection(name){reads.push(name);return{doc(){return this},where(){return this},onSnapshot(){return()=>{}},async get(){return{exists:false,docs:[]}}}}};
  const context={
    window:{dispatchEvent(){},UCVM_ADMIN_DATA:null},
    document:{getElementById:byId,querySelector:()=>element(),querySelectorAll:()=>[],createElement:()=>element(),body:element(),head:{appendChild(){}}},
    location:{href:'',replace(value){redirects.push(value)}},
    firebase:{auth:{Auth:{Persistence:{LOCAL:'local'}}},firestore:{FieldValue:{}}},
    UCVM:{init:()=>({auth,db}),number:value=>Number(value),role:value=>String(value||''),admin:profile=>['owner','administrator','adfa_general','adfa_regular','admin'].includes(profile?.role),general:()=>true,label:value=>String(value||'')},
    UCVM_PAWS_DATA:{currentUser},
    Event:class{constructor(type){this.type=type}},
    console:{error(){}},setTimeout,clearTimeout,Map,Set,Date,JSON,String,Number,Array,Object,Math,Blob:class{},URL:{createObjectURL(){return''},revokeObjectURL(){}},confirm:()=>false
  };
  vm.runInNewContext(read('faculty-admin.js'),context);
  assert.equal(typeof authCallback,'function','Dashboard must register an auth callback');
  return{run:user=>authCallback(user),redirects,reads,signOuts:()=>signOuts,nodes};
}

test('Faculty Dashboard loads the PAWS data client after Firebase and before its page controller',()=>{
  const html=read('faculty-admin.html');
  const firebase=html.indexOf('firebase-auth-compat.js');
  const client=html.indexOf('<script src="paws-data-client.js"></script>');
  const admin=html.indexOf('<script src="faculty-admin.js"></script>');
  assert.ok(firebase>=0&&client>firebase&&admin>client,{firebase,client,admin});
});

test('Dashboard authorization reads SQL UserProfile through /me and has no Firestore identity fallback',()=>{
  const init=functionSource(read('faculty-admin.js'),'init');
  assert.match(init,/UCVM_PAWS_DATA\.currentUser\(\)/);
  assert.doesNotMatch(init,/collection\(['"]users['"]\)|UCVM\.ready\(|UCVM\.watch\(|linkFacultyIdentity\(/);
});

test('Dashboard auth preserves API password, role, self-link, and failure gates',()=>{
  const source=read('faculty-admin.js');
  const init=functionSource(source,'init');
  assert.match(init,/mustChangePassword/);
  assert.match(init,/location\.replace\(['"]password\.html['"]\)/);
  assert.match(init,/isSelfServiceProfile\(p\)/);
  assert.match(init,/p\.facultyId/);
  assert.match(init,/UCVM\.admin\(p\)/);
  assert.match(init,/dashboardAuthFailureMessage\(e\)/);
  assert.doesNotMatch(init,/auth\.signOut\(|location\.(?:href|replace)\(['"]index\.html['"]\)/);
});

test('Dashboard auth does not use email to link a self-service identity',()=>{
  const init=functionSource(read('faculty-admin.js'),'init');
  assert.doesNotMatch(init,/user\.email[\s\S]{0,160}(?:facultyId|collection\(['"]faculty['"]\))/);
  assert.match(init,/linked faculty profile/i);
});

test('Dashboard auth distinguishes 401, 403, and transient API failures without signing out',()=>{
  const source=read('faculty-admin.js');
  const helper=functionSource(source,'dashboardAuthFailureMessage');
  assert.match(helper,/401|UNAUTHENTICATED/);
  assert.match(helper,/403|ROLE_DENIED|PROFILE_REQUIRED|FACULTY_LINK_REQUIRED/);
  assert.match(helper,/503|SQL_UNAVAILABLE/);
  assert.doesNotMatch(helper,/signOut|firestore|collection\(/i);
  const message=vm.runInNewContext(`(${helper})`);
  assert.match(message({status:401,code:'UNAUTHENTICATED'}),/session could not be verified/i);
  assert.equal(message({status:403,code:'ROLE_DENIED',message:'Role denied by SQL profile'}),'Role denied by SQL profile');
  assert.match(message({status:503,code:'SQL_UNAVAILABLE'}),/temporarily unavailable.*sign-in is still active/is);
  assert.match(message(new TypeError('network failed')),/temporarily unavailable.*sign-in is still active/is);
});

test('Dashboard redirects a password-gated /me rejection without Firestore lookup or signout',async()=>{
  const failure=Object.assign(new Error('Password change is required before Dashboard access.'),{status:403,code:'PASSWORD_CHANGE_REQUIRED'});
  const harness=dashboardHarness(async()=>{throw failure});
  await harness.run({uid:'firebase-user',email:'user@example.test'});
  assert.deepEqual(harness.redirects,['password.html']);
  assert.equal(harness.signOuts(),0);
  assert.deepEqual(harness.reads,[]);
});
