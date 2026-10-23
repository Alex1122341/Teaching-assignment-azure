'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../tools/testing-db/university-admin.js');
const api=fs.existsSync(file)?require(file):{};
const target=Object.freeze({profile:'university-testing',host:'itappvetopsdb01',physicalServer:'ITAPPVETOPSDB01',database:'VetMed-Ops-Testing',environmentId:'7e570000-0000-4000-8000-00000000c0de'});
const operator='UC\\synthetic-operator';
function method(name){assert.equal(typeof api[name],'function',name+' must implement guarded University administration');return api[name];}
function harness(extra={}){
 const calls=[],backupCalls=[],destructiveBatchCalls=[];
 const state={physicalServer:'ITAPPVETOPSDB01',exists:true,environment:'testing',environmentId:target.environmentId,
  trustworthy:false,chaining:false,guestEnabled:false,availableBytes:8*1024**3,...extra.state};
 const audit={complete:true,serverAuthority:[],databaseAuthority:[],ownership:[],productionAccess:false,
  tokens:['WINDOWS_LOGIN','WINDOWS_GROUP','DATABASE_ROLE','public'],direct:[],group:[],public:[],class0:[],...extra.audit};
 const adminDb={async authorizeOperator(who){calls.push('authorize');return who===operator;},
  async inspectTarget(){calls.push('inspect');return {...state};},
  async withExclusiveReset(t,fn){calls.push('lock');try{return await fn();}finally{calls.push('unlock');}},
  async createTestingDatabase(options){destructiveBatchCalls.push({kind:'create',...options});return {created:true};},
  async backupTesting(options){backupCalls.push(options);if(extra.backupFails)throw Error('backup failed');return {id:'synthetic-backup',database:target.database,environmentId:target.environmentId,sha256:'1'.repeat(64),verified:true};},
  async verifyBackup(){calls.push('verify');return !extra.verifyFails;},
  async assertTestingStopped(){calls.push('stopped');return extra.running!==true;},
  async resetTesting(options){destructiveBatchCalls.push({kind:'reset',...options});if(extra.resetFails)throw Error('reset failed');return {verified:true,markerCount:1};},
  async recordReceipt(receipt){calls.push('receipt');return receipt;}
 };
 return {adminDb,runtimeDb:{async audit(){return audit;}},state,audit,calls,backupCalls,destructiveBatchCalls};
}
test('reset refuses a wrong confirmation before backup or SQL',async()=>{
 const h=harness();
 await assert.rejects(method('resetUniversityTesting')({...h,target,operator,confirmation:'RESET',backupPath:'P:\\PAWS\\Testing\\Backups'}),/confirmation/i);
 assert.deepEqual(h.calls,[]);assert.equal(h.backupCalls.length,0);assert.equal(h.destructiveBatchCalls.length,0);
});
test('failed Testing backup prevents destructive batches',async()=>{
 for(const extra of [{backupFails:true},{verifyFails:true}]){
  const h=harness(extra);
  await assert.rejects(method('resetUniversityTesting')({...h,target,operator,confirmation:method('resetConfirmation')(target),backupPath:'P:\\PAWS\\Testing\\Backups'}),/backup/i);
  assert.equal(h.backupCalls.length,1);assert.equal(h.destructiveBatchCalls.length,0);assert.ok(h.calls.includes('unlock'));
 }
});
test('create accepts only exact University Testing target with bounded dedicated storage',async()=>{
 const create=method('createUniversityTesting');
 for(const changed of [{database:'VetMed-Ops'},{physicalServer:'OTHER'},{host:'127.0.0.1'},{environmentId:''},{profile:'production'}]){
  const h=harness({state:{exists:false}});
  await assert.rejects(create({...h,target:{...target,...changed},operator,storage:{availableBytes:8*1024**3}}),/target|identity|Testing|UUID/i);
  assert.equal(h.destructiveBatchCalls.length,0);
 }
 const h=harness({state:{exists:false}}),receipt=await create({...h,target,operator,storage:{availableBytes:8*1024**3}});
 assert.equal(receipt.target.database,'VetMed-Ops-Testing');
 assert.equal(h.destructiveBatchCalls[0].storage.dataMaxMiB,1024);assert.equal(h.destructiveBatchCalls[0].storage.logMaxMiB,512);
 for(const state of [{exists:true},{exists:false,availableBytes:512*1024**2}]){
  const bad=harness({state});await assert.rejects(create({...bad,target,operator,storage:{availableBytes:8*1024**3}}),/exist|capacity|storage/i);assert.equal(bad.destructiveBatchCalls.length,0);
 }
});
test('runtime isolation audit fails closed on inherited, public, ownership, server authority or Production access',async()=>{
 const inspect=method('inspectUniversityTesting');
 for(const audit of [{complete:false},{serverAuthority:['CONTROL SERVER']},{databaseAuthority:['CONTROL']},
  {ownership:['schema:paws']},{productionAccess:true},{group:[{permission:'CONTROL',state:'GRANT'}]},
  {public:[{permission:'ALTER',state:'GRANT'}]},{class0:[{permission:'IMPERSONATE ANY USER',state:'GRANT'}]}]){
  const h=harness({audit});await assert.rejects(inspect({...h,target}),/audit|authority|access|ownership|permission/i);
 }
 for(const state of [{trustworthy:true},{chaining:true},{guestEnabled:true},{environmentId:'wrong'},{physicalServer:'OTHER'}]){
  const h=harness({state});await assert.rejects(inspect({...h,target}),/target|identity|isolation|marker/i);
 }
 const h=harness();assert.equal((await inspect({...h,target})).runtimeSuitable,true);
});

test('runtime SQL audit inspects effective permissions, group tokens, public, ownership and class0 without reading Production rows',async()=>{
 const run=method('auditRuntimeSql'),h=harness(),queries=[];
 const connection={target,async guardedBatch(text){queries.push(text);return {recordset:[{auditJson:JSON.stringify(h.audit)}]};}};
 assert.deepEqual(await run(connection,target),h.audit);
 const sql=queries[0];
 for(const pattern of [/sys\.login_token/i,/sys\.user_token/i,/sys\.database_permissions/i,/sys\.schemas/i,/sys\.objects/i,/fn_my_permissions/i,/class\s*=\s*0/i,/public/i,/HAS_DBACCESS\(N'VetMed-Ops'\)/i,/sys\.database_principals[\s\S]*owning_principal_id/i,/sys\.server_principals[\s\S]*owning_principal_id/i])assert.match(sql,pattern);
 assert.doesNotMatch(sql,/FROM\s+\[?VetMed-Ops\]?\./i);
 await assert.rejects(run({...connection,target:{...target,database:'VetMed-Ops'}},target),/target/i);
});
test('reset checks marker, stopped runtime, backup and operator while holding a serialized lock',async()=>{
 const reset=method('resetUniversityTesting'),confirmation=method('resetConfirmation')(target);
 for(const extra of [{state:{environment:'production'}},{running:true}]){
  const h=harness(extra);await assert.rejects(reset({...h,target,operator,confirmation,backupPath:'P:\\PAWS\\Testing\\Backups'}),/identity|marker|stop/i);
  assert.equal(h.destructiveBatchCalls.length,0);
 }
 const h=harness(),receipt=await reset({...h,target,operator,confirmation,backupPath:'P:\\PAWS\\Testing\\Backups'});
 assert.equal(receipt.ok,true);assert.equal(receipt.target.database,'VetMed-Ops-Testing');assert.equal(h.backupCalls.length,1);
 assert.ok(h.calls.indexOf('lock')<h.calls.indexOf('stopped'));assert.ok(h.calls.indexOf('verify')<h.calls.indexOf('receipt'));
 assert.equal(h.destructiveBatchCalls.length,1);assert.equal(h.destructiveBatchCalls[0].kind,'reset');
});
