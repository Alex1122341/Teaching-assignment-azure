'use strict';
// Only the already marker-verified disposable CI SQL instance is usable.
// Actual repository and Firebase-authenticated API; no response fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {createSqlAccountAccessRepository}=require('../server/src/data/sql-account-access-repository');
const root=path.resolve(__dirname,'..');
const containerName='paws-calendar-pr171-browser';
const procedure='paws_api.ListOwnerAccountDirectory';
const fields=['active','baseRole','displayName','email','facultyId','firebaseUid','mustChangePassword','preferredFirstName','preferredLastName','version'].sort();
const publicFields=['active','displayName','editable','email','facultyId','mustChangePassword','role','uid','version'].sort();
const ownerOf=identities=>identities.find(user=>user.role==='adfa_general');
async function requireDisposable(db){
 assert.equal(process.env.GITHUB_ACTIONS,'true');
 const marker=process.env.PAWS_BROWSER_TEST_MARKER;
 assert.match(marker||'',/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
 const info=JSON.parse(execFileSync('docker',['inspect',containerName],{encoding:'utf8'}))[0];
 assert.equal(info.Config.Labels['paws.calendar-test'],'1');assert.equal(info.State.Running,true);
 assert.deepEqual(info.NetworkSettings.Ports['1433/tcp'],[{HostIp:'127.0.0.1',HostPort:'14339'}]);
 const rows=await db.query('SELECT CONVERT(varchar(36),Marker) AS marker FROM dbo.PawsBrowserDisposableMarker WHERE Marker=@marker',{marker});
 assert.equal(rows.length,1);assert.equal(rows[0].marker.toLowerCase(),marker.toLowerCase());
}
function sqlFile(file,hash){
 const args=['exec','-i','-e','SQLCMDPASSWORD',containerName,'/opt/mssql-tools18/bin/sqlcmd','-S','localhost','-U','sa','-C','-I','-b','-d','VetMed-Ops','-i','/dev/stdin','-f','65001'];
 if(hash){assert.match(hash,/^[a-f0-9]{64}$/i);args.push('-v','PAWS_OWNER_DIRECTORY_SHA256='+hash);}
 try{execFileSync('docker',args,{input:fs.readFileSync(path.join(root,'database/azure-sql',file)),env:{...process.env,SQLCMDPASSWORD:process.env.PAWS_SQL_TEST_PASSWORD},stdio:['pipe','pipe','pipe']});}
 catch(_){throw Object.assign(Error('Disposable SQL script refused'),{code:'QA_SQL_SCRIPT_REFUSED'});}
}
async function inspect(db){
 const [module]=await db.query("SELECT OBJECT_ID(N'paws_api.ListOwnerAccountDirectory',N'P') AS objectId,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'paws_api.ListOwnerAccountDirectory',N'P'))),2) AS definitionHash,(SELECT execute_as_principal_id FROM sys.sql_modules WHERE object_id=OBJECT_ID(N'paws_api.ListOwnerAccountDirectory',N'P')) AS executeAs");
 const grants=await db.query("SELECT class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state FROM sys.database_permissions ORDER BY class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state");
 const memberships=await db.query('SELECT role_principal_id,member_principal_id FROM sys.database_role_members ORDER BY role_principal_id,member_principal_id');
 const [role]=await db.query("SELECT DATABASE_PRINCIPAL_ID(N'paws_runtime_account_access') AS principalId");
 const direct=grants.filter(row=>row.class===1&&row.major_id===module.objectId);
 const unrelated=grants.filter(row=>!(row.class===1&&row.major_id===module.objectId));
 return {module,direct,unrelated,memberships,role:role.principalId};
}
async function privateState(db){
 return {profiles:await db.query('SELECT FirebaseUid AS uid,CONVERT(varchar(16),AccessVersion,2) AS version FROM paws.UserProfile ORDER BY FirebaseUid'),counts:(await db.query('SELECT (SELECT COUNT_BIG(*) FROM paws.AuditEvent) AS auditCount,(SELECT COUNT_BIG(*) FROM paws.AccountAccessChange) AS operationCount'))[0]};
}
async function runOwnerSql({db,runtimeDb,identities,baselineRoot}){
 await requireDisposable(db);
 const repo=createSqlAccountAccessRepository(runtimeDb);
 const old=require(path.join(baselineRoot,'server','src','data','sql-account-access-repository')).createSqlAccountAccessRepository(runtimeDb);
 const owner=ownerOf(identities),profile=await repo.read(owner.uid),binding={actorUid:owner.uid,actorVersion:profile.version};
 const permission=async()=> (await runtimeDb.query("SELECT IS_ROLEMEMBER(N'db_owner') AS owner,IS_SRVROLEMEMBER(N'sysadmin') AS sysadmin,HAS_PERMS_BY_NAME(N'paws.UserProfile',N'OBJECT',N'SELECT',N'Email',N'COLUMN') AS emailSelect,HAS_PERMS_BY_NAME(N'paws.UserProfile',N'OBJECT',N'UPDATE') AS directUpdate,HAS_PERMS_BY_NAME(N'paws_api.ListOwnerAccountDirectory',N'OBJECT',N'EXECUTE') AS directoryExecute"))[0];
 assert.deepEqual(await permission(),{owner:0,sysadmin:0,emailSelect:0,directUpdate:0,directoryExecute:1});
 const expectedDenied=error=>Number(error?.number)===57302;
 const expectedEmailDenied=error=>Number(error?.number)===230;
 await assert.rejects(old.list(),expectedEmailDenied);
 await assert.rejects(runtimeDb.query('SELECT Email FROM paws.UserProfile WHERE FirebaseUid=@uid',{uid:owner.uid}),expectedEmailDenied);
 const before=await privateState(db),rows=await repo.list(binding);
 assert.equal(rows.length,before.profiles.length);
 for(const row of rows)assert.deepEqual(Object.keys(row).sort(),fields);
 for(const user of identities){
  const row=rows.find(item=>item.firebaseUid===user.uid);
  assert.ok(row);assert.equal(row.email,user.email);assert.equal(row.baseRole,user.role);assert.equal(row.active,true);
  assert.equal(String(row.facultyId||'').toLowerCase(),String(user.facultyId||'').toLowerCase());
  if(user.uid!==owner.uid){const denied=await repo.read(user.uid);await assert.rejects(repo.list({actorUid:user.uid,actorVersion:denied.version}),expectedDenied);}
 }
 for(const args of [{actorUid:owner.uid,actorVersion:'bad'},{actorUid:owner.uid,actorVersion:'0000000000000000'},{actorUid:owner.uid.toUpperCase(),actorVersion:profile.version},{actorUid:'unknown-synthetic',actorVersion:profile.version}]){
  await assert.rejects(repo.list(args),expectedDenied);
 }
 assert.deepEqual(await privateState(db),before);
 const installed=await inspect(db),hash=installed.module.definitionHash;
 assert.match(hash,/^[a-f0-9]{64}$/i);assert.equal(installed.module.executeAs,null);
 assert.equal(installed.direct.length,1);
 assert.equal(installed.direct[0].grantee_principal_id,installed.role);assert.equal(installed.direct[0].minor_id,0);
 assert.equal(installed.direct[0].type.trim(),'EX');assert.equal(installed.direct[0].state,'G');
 console.log('PR171_OWNER_SQL_READ_OK '+JSON.stringify({rows:rows.length,allNineFixturesCorrect:true,fields:fields.length,nonOwnerDenied:8,invalidBindingsDenied:4,directEmailDenied:true,oldRepositoryDenied:true,unchangedProfilesAndAudit:true,onlyExecuteGrant:true,definitionHash:hash}));
 // Hash-guarded rollback and re-apply on this disposable instance only.
 const wrongHash=(hash[0]==='A'?'B':'A')+hash.slice(1);
 assert.throws(()=>sqlFile('rollback_073_owner_account_directory_read.sql',wrongHash),{code:'QA_SQL_SCRIPT_REFUSED'});
 assert.equal((await inspect(db)).module.definitionHash,hash);
 sqlFile('rollback_073_owner_account_directory_read.sql',hash);
 const removed=await inspect(db);assert.equal(removed.module.objectId,null);
 assert.deepEqual(removed.unrelated,installed.unrelated);assert.deepEqual(removed.memberships,installed.memberships);
 await assert.rejects(repo.list(binding),error=>[2812,229].includes(Number(error?.number)));
 await assert.rejects(runtimeDb.query('SELECT Email FROM paws.UserProfile WHERE FirebaseUid=@uid',{uid:owner.uid}),expectedEmailDenied);
 assert.deepEqual(await privateState(db),before);
 sqlFile('073_owner_account_directory_read.sql');
 const restored=await inspect(db);
 assert.equal(restored.module.definitionHash,hash);assert.equal(restored.direct.length,1);
 assert.equal(restored.direct[0].grantee_principal_id,installed.role);
 assert.deepEqual(restored.unrelated,installed.unrelated);assert.deepEqual(restored.memberships,installed.memberships);
 assert.deepEqual(await permission(),{owner:0,sysadmin:0,emailSelect:0,directUpdate:0,directoryExecute:1});
 assert.deepEqual(await repo.list(binding),rows);assert.deepEqual(await privateState(db),before);
 console.log('PR171_OWNER_ROLLBACK_REAPPLY_OK '+JSON.stringify({wrongHashRefused:true,procedureRemoved:true,readUnavailableAfterRollback:true,allOtherGrantsUnchanged:true,membershipsUnchanged:true,definitionRestored:true,privateStateUnchanged:true}));
 return {status:'passed',definitionHash:hash,rawRows:rows.length,nonOwnerDenied:8,invalidBindingsDenied:4,directEmailDenied:true,onlyExecuteGrant:true,rollbackReapplyVerified:true};
}
async function runOwnerHttp({db,runtimeDb,identities,auth,password,emulatorToken,call,api}){
 await requireDisposable(db);
 const repo=createSqlAccountAccessRepository(runtimeDb),owner=ownerOf(identities),ownerToken=await emulatorToken(owner);
 const route='/api/v1/access/accounts';
 const reject=async(token,status,code,query='')=>{
  const result=await call(token,route+query);
  assert.equal(result.status,status);assert.equal(result.body.error.code,code);assert.equal(Object.hasOwn(result.body,'accounts'),false);
 };
 await reject('',401,'UNAUTHENTICATED');await reject('invalid-synthetic-token',401,'UNAUTHENTICATED');
 await reject(ownerToken,400,'INVALID_ACCESS_QUERY','?actorUid=synthetic');
 const noCache=await fetch(api+route,{headers:{authorization:'Bearer '+ownerToken}});
 assert.equal(noCache.status,200);assert.match(noCache.headers.get('cache-control'),/no-store/i);
 const normal=await noCache.json();
 assert.ok(normal.accounts.length>0);for(const row of normal.accounts)assert.deepEqual(Object.keys(row).sort(),publicFields);
 for(const user of identities){
  const result=await call(ownerToken,route+'?search='+encodeURIComponent(user.email));
  assert.equal(result.status,200);assert.equal(result.body.total,1);
  const row=result.body.accounts[0];assert.equal(row.uid,user.uid);assert.equal(row.email,user.email);assert.equal(row.role,user.role);assert.equal(row.active,true);
  assert.equal(row.editable,user.role!=='developer');
 }
 const added=[],negative={uid:'pr171-dir-revocable-owner',email:'pr171-dir-revocable-owner@example.test'};
 const stateBefore=await privateState(db);
 try{
  // 53 directory-only SQL fixtures, no real or emulator Auth accounts for
  // pagination rows. The existing nine Calendar identities are untouched.
  for(let i=0;i<53;i++){
   const uid='pr171-dir-page-'+String(i).padStart(2,'0'),email=uid+'@example.test';added.push(uid);
   await db.query("INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,Active,MustChangePassword) VALUES(@uid,@email,@name,N'adfa_regular',@active,@passwordRequired)",{uid,email,name:'Synthetic directory page '+String(i).padStart(2,'0'),active:i!==1,passwordRequired:i===2});
  }
  const first=await call(ownerToken,route+'?search=pr171-dir-page-&offset=0'),second=await call(ownerToken,route+'?search=pr171-dir-page-&offset=50');
  assert.equal(first.status,200);assert.equal(second.status,200);assert.equal(first.body.total,53);assert.equal(second.body.total,53);
  assert.equal(first.body.accounts.length,50);assert.equal(second.body.accounts.length,3);
  const pageRows=[...first.body.accounts,...second.body.accounts];
  assert.deepEqual(pageRows.map(row=>row.uid).sort(),added.slice().sort());
  assert.equal(pageRows.find(row=>row.uid===added[1]).active,false);
  assert.equal(pageRows.find(row=>row.uid===added[2]).mustChangePassword,true);
  for(const row of pageRows)assert.deepEqual(Object.keys(row).sort(),publicFields);
  const empty=await call(ownerToken,route+'?search=pr171-no-directory-match');assert.equal(empty.status,200);assert.equal(empty.body.total,0);assert.deepEqual(empty.body.accounts,[]);
  // Same bearer token survives these fixture-only SQL changes. The API and
  // raw procedure must revoke visibility on the very next read.
  await auth.createUser({...negative,password,emailVerified:true});
  added.push(negative.uid);
  await db.query("INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,Active,MustChangePassword) VALUES(@uid,@email,N'Synthetic revocable Owner',N'owner',1,0)",negative);
  const token=await emulatorToken(negative),original=await repo.read(negative.uid),oldBinding={actorUid:negative.uid,actorVersion:original.version};
  assert.equal((await call(token,route)).status,200);
  const checks=[];
  for(const change of [{role:'adfa_regular',active:true,passwordRequired:false,kind:'demoted'},{role:'owner',active:false,passwordRequired:false,kind:'inactive'},{role:'owner',active:true,passwordRequired:true,kind:'password-required'}]){
   await db.query('UPDATE paws.UserProfile SET BaseRole=@role,Active=@active,MustChangePassword=@passwordRequired WHERE FirebaseUid=@uid',{...change,uid:negative.uid});
   await reject(token,403,'OWNER_REQUIRED');
   const now=await repo.read(negative.uid);
   await assert.rejects(repo.list({actorUid:negative.uid,actorVersion:now.version}),error=>Number(error?.number)===57302);
   checks.push(change.kind);
  }
  await db.query("UPDATE paws.UserProfile SET BaseRole=N'owner',Active=1,MustChangePassword=0 WHERE FirebaseUid=@uid",{uid:negative.uid});
  await assert.rejects(repo.list(oldBinding),error=>Number(error?.number)===57302);
  assert.equal((await call(token,route)).status,200);
  const disabled=await call(ownerToken,'/api/v1/access/commit','POST',{});
  assert.equal(disabled.status,503);assert.equal(disabled.body.error.code,'WRITE_DISABLED');
  console.log('PR171_OWNER_HTTP_OK '+JSON.stringify({allFixtureEmailsCorrect:true,searchAndPaging:true,pageRows:53,emptySearch:true,fieldCount:publicFields.length,cacheNoStore:true,aliasOwner:true,sameTokenRevocation:checks,staleBindingDenied:true,writeGateClosed:true}));
  return {status:'passed',searchAndPaging:true,fields:publicFields.length,revokedStates:checks,staleBindingDenied:true,writeGateClosed:true};
 }finally{
  // Clean only the exact generated fixture keys; never delete the original
  // nine identities. All writes here are disposable test setup/teardown.
  for(const uid of added)await db.query('DELETE FROM paws.UserProfile WHERE FirebaseUid=@uid',{uid});
  await auth.deleteUser(negative.uid).catch(error=>{if(error.code!=='auth/user-not-found')throw error;});
  assert.deepEqual(await privateState(db),stateBefore);
  console.log('PR171_OWNER_FIXTURE_CLEANUP_OK');
 }
}
module.exports={runOwnerSql,runOwnerHttp};
