'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {main,SEED_PERSONAS,OPERATOR_PERSONAS}=require('../tools/testing-db/provision-test-accounts');
const {resolveSqlTarget}=require('../server/src/runtime/sql-environment-target');
const env={PAWS_ENVIRONMENT:'testing',PAWS_TESTING_SQL_PROFILE:'university-testing',PAWS_TESTING_SQL_SERVER:'ITAPPVETOPSDB01',
 PAWS_TESTING_DATABASE:'VetMed-Ops-Testing',PAWS_TESTING_ENVIRONMENT_ID:'7e570000-0000-4000-8000-00000000c0de',
 FIREBASE_PROJECT_ID:'paws-testing',PAWS_SQL_DRIVER:'msnodesqlv8',PAWS_SQL_CONNECTION_STRING:'Server=ITAPPVETOPSDB01;Database=VetMed-Ops-Testing;Encrypt=true;TrustServerCertificate=false',
 PAWS_TEST_PERSONA_PASSWORD:'synthetic-private-password-only'};
function harness(options={}){
 const connectionCalls=[],authWrites=[],logs=[],sqlCalls=[],profiles=SEED_PERSONAS.map(uid=>({uid,email:uid+'@example.test',name:uid}));
 const auth={async updateUser(uid,value){authWrites.push({kind:'update',uid,value});return {uid};},
 async createUser(value){authWrites.push({kind:'create',value});return {uid:'named-operator'};},async getUserByEmail(){return {uid:'existing-named-operator'};}};
 let deleted=0,closed=0,initialized=0;
 const deps={log:message=>logs.push(message),readFile:()=>options.fileText||'[]',
  admin:{credential:{cert(value){return value;}},initializeApp(){initialized++;return {async delete(){deleted++;}};},auth(){return auth;}},
  async connectTestingProfile(value){
   const target=resolveSqlTarget(value);connectionCalls.push({target,driver:value.PAWS_SQL_DRIVER});
   return {target,pool:{async close(){closed++;}},async guardedBatch(text,params){sqlCalls.push({text,params});
    if(options.wrongMarker)throw Object.assign(Error('private target details'),{code:'ENVIRONMENT_MISCONFIGURED'});
    return {recordset:/FROM paws.UserProfile/.test(text)?(options.profiles||profiles):[]};}};
  }};
 return {deps,connectionCalls,authWrites,logs,sqlCalls,get initialized(){return initialized;},get deleted(){return deleted;},get closed(){return closed;}};
}
test('account provisioning selects the guarded Windows connection',async()=>{
 const h=harness(),result=await main([],env,h.deps);
 assert.equal(h.connectionCalls[0].target.profile,'university-testing');assert.equal(h.connectionCalls[0].driver,'msnodesqlv8');
 assert.equal(result.ok,true);assert.equal(h.deleted,1);assert.equal(h.closed,1);
 for(const uid of OPERATOR_PERSONAS){const writes=h.authWrites.filter(row=>row.uid===uid);assert.equal(writes.length,1);assert.deepEqual(writes[0].value,{disabled:true});}
 assert.equal(h.authWrites.filter(row=>row.value?.password).length,SEED_PERSONAS.length-OPERATOR_PERSONAS.length);
 assert.ok(!h.logs.join('').includes(env.PAWS_TEST_PERSONA_PASSWORD));
});
test('wrong database UUID and Production Firebase produce zero Auth writes',async()=>{
 for(const extra of [{PAWS_SQL_CONNECTION_STRING:'Server=ITAPPVETOPSDB01;Database=VetMed-Ops;Encrypt=true'},
  {PAWS_TESTING_ENVIRONMENT_ID:'invalid'},{FIREBASE_PROJECT_ID:'tester-teaching'}]){
  const h=harness();await assert.rejects(main([],{...env,...extra},h.deps));assert.equal(h.authWrites.length,0);assert.equal(h.initialized,0);
 }
 const h=harness({wrongMarker:true});await assert.rejects(main([],env,h.deps));assert.equal(h.authWrites.length,0);assert.equal(h.initialized,0);assert.equal(h.closed,1);
});
test('invalid credential JSON never reaches public output',async()=>{
 for(const extra of [{FIREBASE_SERVICE_ACCOUNT_JSON:'{DO_NOT_LOG_SECRET'},{FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:'tester-teaching',private_key:'DO_NOT_LOG_SECRET'})}]){
  const h=harness();let capturedOutput='';
  try{await main([],{...env,...extra},h.deps);assert.fail('must reject malformed credentials');}catch(error){capturedOutput+=error.message;}
  capturedOutput+=h.logs.join('');assert.ok(!capturedOutput.includes('DO_NOT_LOG_SECRET'));assert.equal(h.authWrites.length,0);
 }
 const h=harness({fileText:'[{DO_NOT_LOG_SECRET'});await assert.rejects(main(['--operators','private.json'],env,h.deps),error=>!error.message.includes('DO_NOT_LOG_SECRET'));
});
test('explicit existing named operators keep their password and synthetic profiles never use real emails',async()=>{
 const h=harness({fileText:JSON.stringify([{email:'named.operator@example.test',role:'administrator'}])});
 const result=await main(['--operators','private.json'],env,h.deps);
 assert.equal(result.ok,true);assert.ok(h.sqlCalls.some(row=>row.params?.uid==='existing-named-operator'&&row.params.role==='adfa_regular'));
 assert.ok(!h.authWrites.some(row=>row.uid==='existing-named-operator'));
 const bad=harness({profiles:[{uid:'syn-faculty-a',email:'actual.person@ucalgary.ca',name:'Unexpected real identity'}]});
 await assert.rejects(main([],env,bad.deps),/synthetic|Testing/i);assert.equal(bad.authWrites.length,0);
});

test('named operator provisioning cannot elevate a shared-password synthetic identity',async()=>{
 const h=harness({fileText:JSON.stringify([{email:'syn-faculty-a@example.test',role:'developer'}])});
 await assert.rejects(main(['--operators','private.json'],env,h.deps),/Testing/i);
 assert.equal(h.authWrites.length,0);assert.ok(!h.sqlCalls.some(row=>/MERGE paws.UserProfile/.test(row.text)));
});
