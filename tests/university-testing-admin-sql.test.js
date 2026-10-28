'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../tools/testing/db/university-admin-sql.js'),api=fs.existsSync(file)?require(file):{};
const {resolveSqlTarget}=require('../server/src/runtime/sql-environment-target');
const env={PAWS_ENVIRONMENT:'testing',PAWS_TESTING_SQL_PROFILE:'university-testing',PAWS_TESTING_SQL_SERVER:'itappvetopsdb01',PAWS_TESTING_DATABASE:'VetMed-Ops-Testing',
 PAWS_TESTING_ENVIRONMENT_ID:'7e570000-0000-4000-8000-00000000c0de',FIREBASE_PROJECT_ID:'paws-testing',PAWS_SQL_DRIVER:'msnodesqlv8',
 PAWS_SQL_CONNECTION_STRING:'Server=ITAPPVETOPSDB01;Database=VetMed-Ops-Testing;Encrypt=true;TrustServerCertificate=false',PAWS_TESTING_RUNTIME_PRINCIPAL:'UC\\synthetic-runtime'};
const target=resolveSqlTarget(env),operator='UC\\synthetic-admin',now=Date.parse('2026-10-22T23:30:00Z');
function method(){assert.equal(typeof api.createUniversityAdminSql,'function','native University administrative transport must exist');return api.createUniversityAdminSql;}
function harness(extra={}){
 const calls=[],writes=[],resets=[],receipts=[];
 const state={exists:true,hasMarker:1,physicalServer:'ITAPPVETOPSDB01',metadataVisible:1,loginName:operator,trustworthy:0,chaining:0,guestEnabled:0,
  availableBytes:8*1024**3,dataPath:'C:\\Sql\\Data\\',logPath:'C:\\Sql\\Data\\',...extra.state};
 let masterLock=false,targetLock=false;
 const sql={ConnectionPool:class {
  constructor(config){assert.equal(config.database,'master');assert.equal(config.options.trustServerCertificate,false);}
  async connect(){return this;}async close(){}
  request(){const params={};const run=async text=>{
   calls.push({text,params:{...params}});
   if(params.pawsAdminServer!==state.physicalServer)throw Object.assign(Error('wrong physical target'),{number:55880});
   if(text.includes('PAWS_ADMIN_LOCK_ACQUIRE')){masterLock=true;return {recordset:[{acquired:1}]};}
   if(text.includes('PAWS_ADMIN_LOCK_RELEASE')){masterLock=false;return {recordset:[]};}
   if(text.includes('PAWS_ADMIN_LOCK_REQUIRED')&&!masterLock)throw Error('master lock missing');
   if(text.includes('PAWS_ADMIN_AUTHORIZE'))return {recordset:[{loginName:state.loginName,metadataVisible:state.metadataVisible}]};
   if(text.includes('PAWS_ADMIN_INVENTORY'))return {recordset:[{...state}]};
   if(text.includes('PAWS_ADMIN_CREATE_DATABASE')){writes.push(text);state.exists=true;return {recordset:[]};}
   if(text.includes('PAWS_ADMIN_RESTORE_DATABASE')){writes.push(text);return {recordset:[]};}
   if(text.includes('PAWS_ADMIN_RUNTIME_LOGIN'))return {recordset:[{name:env.PAWS_TESTING_RUNTIME_PRINCIPAL,type:'U'}]};
   if(text.includes('PAWS_ADMIN_GUEST'))return {recordset:extra.hideGuest?[]:[{guestEnabled:state.guestEnabled}]};
   return {recordset:[]};
  };return {input(key,value){params[key]=value;return this;},query:run,batch:run};}
 }};
 const connection={target,pool:{async close(){}},async initializeMarker(){state.hasMarker=1;writes.push('INITIALIZE MARKER');},async inspectState(){return {databaseName:target.database,physicalServer:state.physicalServer,canViewDefinition:1,userObjects:0,userSchemas:0,hasMarker:state.hasMarker,marker:state.hasMarker?[{environment:'testing',environmentId:extra.wrongMarker?'wrong':target.environmentId}]:[]};},
  async withResetLock(fn){targetLock=true;try{return await fn(this);}finally{targetLock=false;}},
  async guardedBatch(text,params){calls.push({text,params});assert.equal(targetLock,true,'target operations require held session lock');
   if(/BACKUP DATABASE/.test(text)){writes.push(text);if(extra.backupFails)throw Error('backup failed');}
   if(/RESTORE HEADERONLY/.test(text))return {recordset:[{DatabaseName:target.database,ServerName:target.physicalServer,BackupSetGUID:'7e570000-0000-4000-8000-00000000beef',BackupType:1}]};
   return {recordset:[]};}
 };
 const stopProof={status:'STOPPED',action:'Stop',computerName:'ITAPPVETOPSDB01',listenerFree:true,resetInhibited:true,target,utc:new Date(now-1000).toISOString(),...extra.stopProof};
 const store={async reserveBackup(){return {id:'synthetic-backup',path:'P:\\PAWS\\Testing\\Backups\\synthetic.bak'};},async hashBackup(){return extra.changedHash?'b'.repeat(64):'a'.repeat(64);},
  async writeBackupReceipt(receipt){receipts.push(receipt);},async readBackupReceipt(id){return {...receipts.find(row=>row.id===id&&row.sha256)};},async writeReceipt(receipt){receipts.push(receipt);},async readStopProof(){return stopProof;}};
 const options={env,privateRoot:'P:\\PAWS\\Testing',authorizedOperators:[operator],operator};
 const deps={sql,fileStore:store,computerName:'ITAPPVETOPSDB01',now:()=>now,async connectTestingProfile(){return connection;},
  async resetMain(argv,actualEnv,log,dependencies){resets.push({argv,actualEnv,dependencies});assert.equal(masterLock,true);assert.equal(targetLock,true);assert.equal(dependencies.connection,connection);assert.equal(await dependencies.beforeDestructive({target,action:'reset'}),true);return {ok:true,counts:{marker:1}};}};
 return {options,deps,calls,writes,resets,receipts,state,connection};
}
test('native admin uses only exact physical University master and no Production or server-global mutation',async()=>{
 const h=harness({state:{exists:false}}),admin=await method()(h.options,h.deps);
 try{
  assert.equal(await admin.authorizeOperator(operator),true);
  await admin.withExclusiveReset(target,async()=>admin.createTestingDatabase({target,storage:{dataMaxMiB:1024,logMaxMiB:512,dataInitialMiB:64,logInitialMiB:32,growthMiB:64}}));
  assert.equal(h.writes.length,1);assert.match(h.writes[0],/MAXSIZE\s*=\s*1024MB/i);assert.match(h.writes[0],/MAXSIZE\s*=\s*512MB/i);
  assert.ok(h.calls.every(row=>row.text.includes('PAWS_ADMIN_TARGET')||row.text.includes('PAWS_')));
  assert.ok(h.writes.every(text=>!(/\[VetMed-Ops\]|ALTER SERVER|CREATE LOGIN|sp_configure|\bKILL\b/i.test(text))));
 }finally{await admin.close();}
});
test('native admin rejects wrong physical host metadata visibility and operator before create',async()=>{
 for(const patch of [{physicalServer:'OTHER'},{metadataVisible:0},{loginName:'UC\\someone-else'}]){
  const h=harness({state:patch});let admin;
  try{admin=await method()(h.options,h.deps);await assert.rejects(admin.authorizeOperator(operator),/identity|metadata|operator|target/i);}catch(error){assert.match(error.message,/identity|metadata|operator|target/i);}
  finally{if(admin)await admin.close();}
  assert.equal(h.writes.length,0);assert.equal(h.resets.length,0);
 }
});

test('server permission visibility uses the SQL Server NULL securable class',()=>{
 const source=fs.readFileSync(file,'utf8');
 assert.ok(source.includes("HAS_PERMS_BY_NAME(NULL,NULL,N'VIEW ANY DATABASE')"));
 assert.ok(!source.includes("HAS_PERMS_BY_NAME(NULL,N'SERVER'"));
});
test('native backup binds SHA header target and same-session reset connection',async()=>{
 const h=harness(),admin=await method()(h.options,h.deps);
 try{
  await admin.authorizeOperator(operator);
  await admin.withExclusiveReset(target,async()=>{
   assert.equal(await admin.assertTestingStopped(target),true);
   const backup=await admin.backupTesting({target,backupPath:'P:\\PAWS\\Testing\\Backups'});
   assert.equal(backup.database,target.database);assert.equal(backup.environmentId,target.environmentId);assert.equal(await admin.verifyBackup(backup,target),true);
   assert.equal((await admin.resetTesting({target,backup})).verified,true);
  });
  assert.equal(h.resets.length,1);
 }finally{await admin.close();}
});
test('failed native backup and stale stopped-host proof never reach reset',async()=>{
 for(const extra of [{backupFails:true},{stopProof:{utc:new Date(now-600000).toISOString()}},{stopProof:{listenerFree:false}},{stopProof:{resetInhibited:false}}]){
  const h=harness(extra),admin=await method()(h.options,h.deps);
  try{await admin.authorizeOperator(operator);await admin.withExclusiveReset(target,async()=>{
   if(await admin.assertTestingStopped(target)){await assert.rejects(admin.backupTesting({target,backupPath:'P:\\PAWS\\Testing\\Backups'}),/backup/i);}
  });assert.equal(h.resets.length,0);}finally{await admin.close();}
 }
});

test('native isolation metadata absence never becomes an OFF setting',async()=>{
 for(const extra of [{state:{trustworthy:null}},{state:{chaining:null}},{state:{exists:null}},{hideGuest:true}]){
  const h=harness(extra),admin=await method()(h.options,h.deps);
  try{await assert.rejects(admin.inspectTarget(target),/metadata|isolation|setting/i);assert.equal(h.resets.length,0);}finally{await admin.close();}
 }
});

test('initialization is limited to the newly created owned empty Testing database and an existing Windows login',async()=>{
 const unknown=harness({state:{hasMarker:0}}),u=await method()(unknown.options,unknown.deps);
 try{assert.equal(typeof u.initializeOwnedEmpty,'function');await assert.rejects(u.initializeOwnedEmpty(target),/owned|created/i);assert.equal(unknown.writes.length,0);}finally{await u.close();}
 const h=harness({state:{exists:false,hasMarker:0}}),admin=await method()(h.options,h.deps);
 try{
  await admin.withExclusiveReset(target,async()=>admin.createTestingDatabase({target,storage:{dataMaxMiB:1024,logMaxMiB:512}}));
  const receipt=await admin.initializeOwnedEmpty(target);assert.equal(receipt.initialized,true);assert.equal(h.state.hasMarker,1);
  const queries=h.calls.map(row=>row.text).join('\n');assert.match(queries,/PAWS_ADMIN_RUNTIME_LOGIN/);assert.match(queries,/CREATE USER/);assert.doesNotMatch(queries,/CREATE LOGIN/);
 }finally{await admin.close();}
});
test('mutating a returned backup cannot change the privately held backup identity',async()=>{
 const h=harness(),admin=await method()(h.options,h.deps);
 try{await admin.withExclusiveReset(target,async()=>{
  const backup=await admin.backupTesting({target,backupPath:'P:\\PAWS\\Testing\\Backups'});
  backup.path='C:\\unapproved\\different.bak';
  assert.equal(await admin.verifyBackup(backup,target),false);
  await assert.rejects(admin.resetTesting({target,backup}),/backup/i);assert.equal(h.resets.length,0);
 });}finally{await admin.close();}
});

test('restore requires the exact backup confirmation and restores only the marked Testing DB without killing sessions',async()=>{
 const h=harness(),admin=await method()(h.options,h.deps);let backup;
 try{
  await admin.withExclusiveReset(target,async()=>{backup=await admin.backupTesting({target,backupPath:'P:\\PAWS\\Testing\\Backups'});});
  assert.equal(typeof admin.restoreTesting,'function');
  await assert.rejects(admin.restoreTesting({target,backup,confirmation:'RESTORE'}),/confirmation/i);
  assert.equal(h.writes.filter(sql=>sql.includes('PAWS_ADMIN_RESTORE_DATABASE')).length,0);
  const confirmation=['RESTORE-TESTING',target.physicalServer,target.database,target.environmentId,backup.sha256].join('|');
  assert.equal((await admin.restoreTesting({target,backup,confirmation})).restored,true);
  const queries=h.writes.filter(sql=>sql.includes('PAWS_ADMIN_RESTORE_DATABASE'));assert.equal(queries.length,1);
  assert.match(queries[0],/RESTORE DATABASE \[VetMed-Ops-Testing\]/);assert.doesNotMatch(queries[0],/\[VetMed-Ops\]|\bKILL\b|ROLLBACK IMMEDIATE/i);
 }finally{await admin.close();}
});
test('guest metadata audit includes public and inherited database roles',async()=>{
 const h=harness(),admin=await method()(h.options,h.deps);
 try{await admin.inspectTarget(target);const sql=h.calls.find(row=>row.text.includes('PAWS_ADMIN_GUEST')).text;assert.match(sql,/database_role_members/);assert.match(sql,/public/);}finally{await admin.close();}
});

test('verified private backup receipts can be reloaded after the administrative process closes',async()=>{
 const h=harness();let backup,admin=await method()(h.options,h.deps);
 try{await admin.withExclusiveReset(target,async()=>{backup=await admin.backupTesting({target,backupPath:'P:\\PAWS\\Testing\\Backups'});});}finally{await admin.close();}
 admin=await method()(h.options,h.deps);
 try{assert.equal(typeof admin.loadOwnedBackup,'function');
  await admin.withExclusiveReset(target,async()=>{const loaded=await admin.loadOwnedBackup(backup.id);assert.equal(loaded.sha256,backup.sha256);await assert.rejects(admin.resetTesting({target,backup:loaded}),/backup/i);await assert.rejects(admin.loadOwnedBackup('../outside'),/backup|identity/i);});
  await assert.rejects(admin.loadOwnedBackup(backup.id),/serialized|administration/i);
 }finally{await admin.close();}
});
