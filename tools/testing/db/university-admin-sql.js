'use strict';
// Server-local administrative transport. It never accepts a SQL password,
// Production database selector, arbitrary SQL or remote-shell command.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {resolveSqlTarget}=require('../../../server/src/runtime/sql-environment-target');
const {buildSqlConnectionConfig}=require('../../../server/src/data/sql-connection');
const {assertTarget}=require('./university-admin');
const {assertNoLinks}=require('../host/artifact-attestation');
const fixed=Object.freeze({server:'ITAPPVETOPSDB01',database:'VetMed-Ops-Testing'});
const validRoot=value=>typeof value==='string'&&path.win32.isAbsolute(value)&&!/^\\\\/.test(value)&&!/[\x00-\x1f<>"|?*]/.test(value)&&!value.split(/[\\/]/).includes('..')&&samePath(value,'P:\\PAWS\\Testing');
const hashFile=async file=>{const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(assertNoLinks(file)))hash.update(chunk);return hash.digest('hex');};

function createPrivateStore(root){
 if(!validRoot(root))throw Error('A dedicated local PAWS Testing administrative directory is required');
 assertNoLinks(root);
 for(let directory=path.resolve(root);;directory=path.dirname(directory)){
  if(fs.existsSync(path.join(directory,'.git')))throw Error('Testing administrative storage must remain outside Git');
  if(path.dirname(directory)===directory)break;
 }
 // A pre-existing broad/inherited ACL is not silently relabeled private. The
 // operator prepares this dedicated directory before invoking the tool.
 function assertPrivateAcl(directory){
 const quoted=directory.replace(/'/g,"''");
 const proof=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
  `$a=Get-Acl -LiteralPath '${quoted}';$me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$svc=(New-Object Security.Principal.NTAccount('NT SERVICE','MSSQLSERVER')).Translate([Security.Principal.SecurityIdentifier]).Value;$rules=@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])|Where-Object{$_.AccessControlType -eq 'Allow'}|ForEach-Object{$_.IdentityReference.Value});[pscustomobject]@{current=$me;service=$svc;allowed=$rules}|ConvertTo-Json -Compress`],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000}).trim());
 const allowed=new Set([proof.current,proof.service,'S-1-5-18','S-1-5-32-544']);
 if(!proof.current||!proof.service||!Array.isArray(proof.allowed)||proof.allowed.some(sid=>!allowed.has(sid)))throw Error('Testing backup directory ACL is not private to the approved identities');
 }
 assertPrivateAcl(root);
 const backups=path.join(root,'Backups'),evidence=path.join(root,'Evidence');
 for(const directory of [backups,evidence]){fs.mkdirSync(directory,{recursive:true});assertNoLinks(directory);assertPrivateAcl(directory);}
 const writeNew=(file,value)=>{assertNoLinks(path.dirname(file));fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});};
 return {
  async reserveBackup(target){const id=crypto.randomUUID(),file=path.join(backups,id+'.bak');
   if(fs.existsSync(file))throw Error('Testing backup destination already exists');writeNew(file+'.reservation.json',{id,target,utc:new Date().toISOString()});return {id,path:file};},
  hashBackup:hashFile,
  async writeBackupReceipt(receipt){writeNew(path.join(backups,receipt.id+'.receipt.json'),receipt);},
  async readBackupReceipt(id){if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Invalid Testing backup identity');return JSON.parse(fs.readFileSync(assertNoLinks(path.join(backups,id+'.receipt.json')),'utf8'));},
  async writeReceipt(receipt){writeNew(path.join(evidence,Date.now()+'-'+crypto.randomUUID()+'.json'),receipt);},
  async readStopProof(){return JSON.parse(fs.readFileSync(assertNoLinks(path.join(root,'host-stop-evidence.json')),'utf8'));}
 };
}

async function createUniversityAdminSql(options,dependencies={}){
 const {env,privateRoot,authorizedOperators,operator}=options||{},target=resolveSqlTarget(env||{});assertTarget(target);
 if((dependencies.computerName||os.hostname()).toUpperCase()!==fixed.server||!validRoot(privateRoot))throw Error('University administration must run on the exact server with its private Testing directory');
 const operators=(authorizedOperators||[]).map(value=>String(value).toLowerCase());
 if(typeof operator!=='string'||!operators.includes(operator.toLowerCase()))throw Error('University operator is not explicitly authorized');
 const runtimePrincipal=String(env.PAWS_TESTING_RUNTIME_PRINCIPAL||'');
 if(!/^[A-Za-z0-9_.-]+\\[A-Za-z0-9_.@$ -]+$/.test(runtimePrincipal))throw Error('Testing runtime requires an explicit existing Windows principal');
 const sql=dependencies.sql||require(path.join(__dirname,'../../../server/node_modules/mssql/msnodesqlv8'));
 const master=new sql.ConnectionPool({...buildSqlConnectionConfig({driver:'msnodesqlv8',connectionString:`Server=tcp:${target.host},1433;Database=master;Encrypt=true;TrustServerCertificate=false`}),connectionTimeout:15000,requestTimeout:90000,pool:{max:1,min:1,idleTimeoutMillis:30000}});
 try{await master.connect();}catch(error){await master.close().catch(()=>{});throw Error('University administrative SQL connection is unavailable');}
 let authorized=false,locked=false,connection=null,created=false,latestBackup=null;
 const knownBackups=new Map(),clock=dependencies.now||Date.now;
 let store=dependencies.fileStore;
 const sameTarget=value=>{assertTarget(value);if(Object.keys(target).some(key=>value[key]!==target[key]))throw Error('University administration target identity mismatch');};
 const MASTER_GUARD=`/* PAWS_ADMIN_TARGET */
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'master' OR COALESCE(UPPER(CONVERT(nvarchar(128),SERVERPROPERTY(N'ServerName'))),N'') COLLATE Latin1_General_100_BIN2<>@pawsAdminServer COLLATE Latin1_General_100_BIN2
 THROW 55880,'University administrative SQL target rejected.',1;
`;
 async function query(text,params={},checkLock=true){
  const request=master.request();
  for(const [key,value]of Object.entries({pawsAdminServer:fixed.server,pawsAdminResource:'PAWS_UNIVERSITY_TESTING_ADMIN',...params}))request.input(key,value);
  const guard=locked&&checkLock?`/* PAWS_ADMIN_LOCK_REQUIRED */ IF COALESCE(APPLOCK_MODE(N'public',@pawsAdminResource,N'Session'),N'NoLock')<>N'Exclusive' THROW 55880,'University administration lock lost.',1;\n`:'';
  try{return await request.query(MASTER_GUARD+guard+text);}catch{throw Error('University SQL target, lock or administrative operation rejected');}
 }
 const requireLock=()=>{if(!authorized||!locked)throw Error('Authorized serialized Testing administration is required');};
 async function getConnection(){if(!connection){const connect=dependencies.connectTestingProfile||require('./connection-profile').connectTestingProfile;connection=await connect(env);sameTarget(connection.target);}return connection;}
 async function authorizeOperator(who){
  const result=await query(`/* PAWS_ADMIN_AUTHORIZE */ SELECT ORIGINAL_LOGIN() AS loginName,HAS_PERMS_BY_NAME(NULL,NULL,N'VIEW ANY DATABASE') AS metadataVisible;`);
  const row=result.recordset?.[0];
  if(who?.toLowerCase()!==operator.toLowerCase()||row?.loginName?.toLowerCase()!==operator.toLowerCase()||Number(row.metadataVisible)!==1)throw Error('University operator identity or metadata visibility is not verified');
  authorized=true;return true;
 }
 async function inspectTarget(value){
  sameTarget(value);if(!authorized)throw Error('University operator is not authorized');
  const result=await query(`/* PAWS_ADMIN_INVENTORY */
DECLARE @data nvarchar(4000)=CONVERT(nvarchar(4000),SERVERPROPERTY(N'InstanceDefaultDataPath')),@log nvarchar(4000)=CONVERT(nvarchar(4000),SERVERPROPERTY(N'InstanceDefaultLogPath'));
SELECT UPPER(CONVERT(nvarchar(128),SERVERPROPERTY(N'ServerName'))) AS physicalServer,
 CASE WHEN DB_ID(N'VetMed-Ops-Testing') IS NULL THEN 0 ELSE 1 END AS [exists],
 HAS_PERMS_BY_NAME(NULL,NULL,N'VIEW ANY DATABASE') AS metadataVisible,
 (SELECT is_trustworthy_on FROM sys.databases WHERE name=N'VetMed-Ops-Testing') AS trustworthy,
 (SELECT is_db_chaining_on FROM sys.databases WHERE name=N'VetMed-Ops-Testing') AS chaining,
 @data AS dataPath,@log AS logPath,
 CASE WHEN EXISTS(SELECT 1 FROM sys.master_files f CROSS APPLY sys.dm_os_volume_stats(f.database_id,f.file_id) v WHERE f.database_id=1 AND @data LIKE v.volume_mount_point+N'%' AND @log LIKE v.volume_mount_point+N'%')
 THEN (SELECT MIN(v.available_bytes) FROM sys.master_files f CROSS APPLY sys.dm_os_volume_stats(f.database_id,f.file_id) v WHERE f.database_id=1 AND @data LIKE v.volume_mount_point+N'%' AND @log LIKE v.volume_mount_point+N'%') ELSE NULL END AS availableBytes;`);
  const row=result.recordset?.[0];if(!row||row.physicalServer!==fixed.server)throw Error('University physical target metadata unavailable');
  if(![true,false,0,1].includes(row.exists)||Number(row.metadataVisible)!==1)throw Error('University database-existence metadata is unavailable');
  const exists=row.exists===true||row.exists===1,state={...row,exists,availableBytes:row.availableBytes!==null&&row.availableBytes!==undefined&&Number.isSafeInteger(Number(row.availableBytes))?Number(row.availableBytes):null};
  if(!exists)return state;
  if(![true,false,0,1].includes(row.trustworthy)||![true,false,0,1].includes(row.chaining))throw Error('Testing isolation setting metadata is unavailable');
  const c=await getConnection(),actual=await c.inspectState();
  const marker=actual.marker||[];
  const guest=await query(`/* PAWS_ADMIN_GUEST */
;WITH guestTokens AS(
 SELECT principal_id FROM [VetMed-Ops-Testing].sys.database_principals WHERE name IN(N'guest',N'public')
 UNION ALL SELECT m.role_principal_id FROM [VetMed-Ops-Testing].sys.database_role_members m JOIN guestTokens g ON g.principal_id=m.member_principal_id
)
SELECT CASE WHEN EXISTS(SELECT 1 FROM [VetMed-Ops-Testing].sys.database_permissions p WHERE p.grantee_principal_id IN(SELECT principal_id FROM guestTokens) AND p.class=0 AND p.permission_name IN(N'CONNECT',N'CONTROL') AND p.state IN(N'G',N'W'))
 OR EXISTS(SELECT 1 FROM [VetMed-Ops-Testing].sys.database_principals d WHERE d.principal_id IN(SELECT principal_id FROM guestTokens) AND d.type=N'R' AND d.name<>N'public')
 THEN 1 ELSE 0 END AS guestEnabled OPTION(MAXRECURSION 100);`);
  if(guest.recordset?.length!==1||![true,false,0,1].includes(guest.recordset[0].guestEnabled))throw Error('Testing guest permission metadata is unavailable');
  return {...state,trustworthy:row.trustworthy===true||row.trustworthy===1,chaining:row.chaining===true||row.chaining===1,guestEnabled:guest.recordset[0].guestEnabled===1||guest.recordset[0].guestEnabled===true,
   environment:marker.length===1?marker[0].environment:null,environmentId:marker.length===1?String(marker[0].environmentId).toLowerCase():null};
 }
 async function withMasterLock(value,callback,includeTargetLock=true){
  sameTarget(value);if(!authorized||locked)throw Error('Testing administration is unauthorized or already locked');
  locked=true;let acquired=false;
  try{
   const result=await query(`/* PAWS_ADMIN_LOCK_ACQUIRE */ DECLARE @acquired int;EXEC @acquired=sys.sp_getapplock @Resource=@pawsAdminResource,@LockMode=N'Exclusive',@LockOwner=N'Session',@LockTimeout=15000,@DbPrincipal=N'public';SELECT @acquired AS acquired;`,{},false);
   if(!Number.isInteger(result.recordset?.[0]?.acquired)||result.recordset[0].acquired<0)throw Error('University Testing administrative lock unavailable');acquired=true;
   const inventory=await inspectTarget(target);
   if(!inventory.exists)return await callback();
   if(!includeTargetLock)return await callback();
   return await (await getConnection()).withResetLock(async()=>callback());
  }finally{
   try{if(acquired)await query(`/* PAWS_ADMIN_LOCK_RELEASE */ EXEC sys.sp_releaseapplock @Resource=@pawsAdminResource,@LockOwner=N'Session',@DbPrincipal=N'public';`,{},false);}finally{locked=false;}
  }
 }
 const withExclusiveReset=(value,callback)=>withMasterLock(value,callback,true);
 async function createTestingDatabase({target:value,storage}){
  sameTarget(value);requireLock();const state=await inspectTarget(target);
  if(state.exists||!Number.isSafeInteger(Number(state.availableBytes))||Number(state.availableBytes)<2*1024**3||!path.win32.isAbsolute(state.dataPath||'')||!path.win32.isAbsolute(state.logPath||''))throw Error('Testing create requires an absent target and verified local storage');
  if(storage?.dataMaxMiB!==1024||storage.logMaxMiB!==512)throw Error('Testing database size limits are fixed');
  const suffix=target.environmentId.replaceAll('-',''),dataFile=path.win32.join(state.dataPath,'PAWS_Testing_'+suffix+'.mdf'),logFile=path.win32.join(state.logPath,'PAWS_Testing_'+suffix+'.ldf');
  await query(`/* PAWS_ADMIN_CREATE_DATABASE */
IF DB_ID(N'VetMed-Ops-Testing') IS NOT NULL OR EXISTS(SELECT 1 FROM sys.dm_os_file_exists(@dataFile) WHERE file_exists=1) OR EXISTS(SELECT 1 FROM sys.dm_os_file_exists(@logFile) WHERE file_exists=1) THROW 55880,'Testing database or data files already exist.',1;
DECLARE @create nvarchar(max)=N'CREATE DATABASE [VetMed-Ops-Testing] ON (NAME=N''PAWS_Testing_Data'',FILENAME=N'''+REPLACE(@dataFile,N'''',N'''''')+N''',SIZE=64MB,MAXSIZE=1024MB,FILEGROWTH=64MB) LOG ON (NAME=N''PAWS_Testing_Log'',FILENAME=N'''+REPLACE(@logFile,N'''',N'''''')+N''',SIZE=32MB,MAXSIZE=512MB,FILEGROWTH=64MB)';
EXEC sys.sp_executesql @create;
ALTER DATABASE [VetMed-Ops-Testing] SET TRUSTWORTHY OFF;
ALTER DATABASE [VetMed-Ops-Testing] SET DB_CHAINING OFF;`,{dataFile,logFile});
  created=true;return {created:true};
 }
 async function initializeOwnedEmpty(value){
  sameTarget(value);if(!created)throw Error('Only this operation newly created and owned Testing database may be initialized');
  return withExclusiveReset(target,async()=>{
   if(!await assertTestingStopped(target))throw Error('Testing stopped-host evidence is required before initialization');
   const c=await getConnection(),state=await c.inspectState();
   if(state.hasMarker||state.marker?.length||Number(state.canViewDefinition)!==1||Number(state.userObjects)!==0||Number(state.userSchemas)!==0)throw Error('Newly created Testing database is not provably empty');
   const login=await query(`/* PAWS_ADMIN_RUNTIME_LOGIN */ SELECT name,type FROM sys.server_principals WHERE name=@runtimePrincipal AND type IN(N'U',N'G');`,{runtimePrincipal});
   if(login.recordset?.length!==1)throw Error('Testing runtime Windows login must already exist; no server login or role is created');
   await c.initializeMarker();
   await c.guardedBatch(`IF USER_ID(@pawsRuntimePrincipal) IS NULL BEGIN
DECLARE @map nvarchar(max)=N'CREATE USER '+QUOTENAME(@pawsRuntimePrincipal)+N' FOR LOGIN '+QUOTENAME(@pawsRuntimePrincipal)+N' WITH DEFAULT_SCHEMA=[dbo]';
EXEC sys.sp_executesql @map; END;
REVOKE CONNECT FROM guest;`,{pawsRuntimePrincipal:runtimePrincipal});
   return {initialized:true,ready:false};
  });
 }
 async function assertTestingStopped(value){
  sameTarget(value);requireLock();let proof;try{proof=await store.readStopProof();}catch{return false;}
  const age=clock()-Date.parse(proof?.utc);
  return Boolean(proof?.status==='STOPPED'&&proof.action==='Stop'&&proof.computerName==='ITAPPVETOPSDB01'&&proof.listenerFree===true&&proof.resetInhibited===true&&proof.target?.database===target.database&&proof.target?.environmentId===target.environmentId&&proof.target?.physicalServer===target.physicalServer&&age>=-30000&&age<=300000);
 }
 async function verifyBackup(backup,value){
  sameTarget(value);requireLock();const known=knownBackups.get(backup?.id);
  if(!known||known.path!==backup.path||known.sha256!==backup.sha256||backup.database!==target.database||backup.environmentId!==target.environmentId)return false;
  if(await store.hashBackup(backup.path)!==backup.sha256)return false;
  const c=await getConnection();await c.guardedBatch('RESTORE VERIFYONLY FROM DISK=@pawsBackupPath WITH CHECKSUM;',{pawsBackupPath:backup.path});
  const result=await c.guardedBatch('RESTORE HEADERONLY FROM DISK=@pawsBackupPath;',{pawsBackupPath:backup.path});
  const header=result.recordset?.[0];return header?.DatabaseName===target.database&&header.ServerName===target.physicalServer&&header.BackupSetGUID===backup.backupSetGuid&&header.BackupType===1;
 }
 async function backupTesting({target:value,backupPath}){
  sameTarget(value);requireLock();if(!samePath(backupPath,path.win32.join(privateRoot,'Backups')))throw Error('Testing backup must use its dedicated private directory');
  if(!await assertTestingStopped(target))throw Error('Testing stopped-host evidence is missing or stale');
  const state=await inspectTarget(target);
  if(state.environment!=='testing'||state.environmentId!==target.environmentId)throw Error('Testing backup marker identity mismatch');
  try{
   const destination=await store.reserveBackup(target),c=await getConnection();
   if(!samePath(path.win32.dirname(destination.path),path.win32.join(privateRoot,'Backups')))throw Error('Testing backup path escaped private directory');
   await c.guardedBatch('BACKUP DATABASE [VetMed-Ops-Testing] TO DISK=@pawsBackupPath WITH COPY_ONLY,CHECKSUM,NOINIT;',{pawsBackupPath:destination.path});
   const result=await c.guardedBatch('RESTORE HEADERONLY FROM DISK=@pawsBackupPath;',{pawsBackupPath:destination.path}),header=result.recordset?.[0];
   if(header?.DatabaseName!==target.database||header.ServerName!==target.physicalServer||header.BackupType!==1||typeof header.BackupSetGUID!=='string')throw Error('Testing backup header invalid');
   const receipt={id:destination.id,path:destination.path,database:target.database,environmentId:target.environmentId,backupSetGuid:header.BackupSetGUID,sha256:await store.hashBackup(destination.path),verified:true};
   knownBackups.set(receipt.id,Object.freeze({...receipt}));
   if(!await verifyBackup(receipt,target))throw Error('Testing backup verification failed');
   await store.writeBackupReceipt({...receipt});latestBackup=Object.freeze({...receipt});return receipt;
  }catch{throw Error('Testing backup failed or could not be verified; no reset is authorized');}
 }
 async function resetTesting({target:value,backup}){
  sameTarget(value);requireLock();if(!latestBackup||latestBackup.id!==backup?.id||!await verifyBackup(backup,target)||!await assertTestingStopped(target))throw Error('Verified Testing backup and stopped-host evidence are required before reset');
  const c=await getConnection(),resetMain=dependencies.resetMain||require('./reset-testing-db').main;
  const result=await resetMain(['--confirm-reset'],env,()=>{},{connection:c,beforeDestructive:async({target:actual,action})=>{
   sameTarget(actual);requireLock();if(action!=='reset'||!await verifyBackup(backup,target)||!await assertTestingStopped(target))return false;
   await c.guardedBatch('SELECT 1 AS resetLockVerified;');return true;
  }});
  return {verified:result?.ok===true,markerCount:result?.counts?.marker};
 }
 async function loadOwnedBackup(id){
  requireLock();
  if(typeof id!=='string'||!/^[A-Za-z0-9-]{1,80}$/.test(id))throw Error('Invalid private Testing backup identity');
  try{
   const receipt=await store.readBackupReceipt(id);
   if(receipt?.id!==id||receipt.database!==target.database||receipt.environmentId!==target.environmentId||receipt.verified!==true||!samePath(path.win32.dirname(receipt.path||''),path.win32.join(privateRoot,'Backups'))||!/^[a-f0-9]{64}$/.test(receipt.sha256||''))throw Error('Backup receipt mismatch');
   knownBackups.set(id,Object.freeze({...receipt}));
   if(!await verifyBackup(receipt,target)){knownBackups.delete(id);throw Error('Backup verification failed');}
   return {...receipt};
  }catch{throw Error('Private Testing backup receipt could not be verified');}
 }
 async function restoreTesting({target:value,backup,confirmation}){
  sameTarget(value);
  if(confirmation!==['RESTORE-TESTING',target.physicalServer,target.database,target.environmentId,backup?.sha256].join('|'))throw Error('Exact Testing restore backup confirmation is required');
  return withMasterLock(target,async()=>{
   const c=await getConnection();
   await c.withResetLock(async()=>{
    const state=await inspectTarget(target);
    if(state.environment!=='testing'||state.environmentId!==target.environmentId||!await assertTestingStopped(target)||!await verifyBackup(backup,target))throw Error('Testing restore target, backup or stopped-host proof is invalid');
   });
   // Restore needs exclusive access. Release only this tool's connection;
   // refuse foreign sessions instead of terminating them. The master lock
   // serializes all administrative entrypoints while target access closes.
   await c.pool.close();connection=null;
   await query(`/* PAWS_ADMIN_RESTORE_DATABASE */
IF EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE database_id=DB_ID(N'VetMed-Ops-Testing') AND session_id<>@@SPID AND is_user_process=1)
 THROW 55880,'Testing restore requires all Testing sessions to be closed.',1;
RESTORE DATABASE [VetMed-Ops-Testing] FROM DISK=@pawsBackupPath WITH REPLACE,CHECKSUM,RECOVERY;`,{pawsBackupPath:backup.path});
   const restored=await getConnection();
   await restored.withResetLock(async()=>{
    const state=await inspectTarget(target);if(state.environment!=='testing'||state.environmentId!==target.environmentId)throw Error('Restored Testing marker did not verify');
   });
   await store.writeReceipt({ok:true,action:'restore',target,backupId:backup.id,backupSha256:backup.sha256,ready:false,utc:new Date(clock()).toISOString()});
   return {restored:true,ready:false};
  },false);
 }
 const admin={authorizeOperator,inspectTarget,withExclusiveReset,createTestingDatabase,initializeOwnedEmpty,assertTestingStopped,backupTesting,verifyBackup,loadOwnedBackup,resetTesting,restoreTesting,
  async recordReceipt(receipt){return store.writeReceipt(receipt);},
  async close(){try{if(connection)await connection.pool.close();}finally{await master.close();}}};
 try{
  await authorizeOperator(operator);if(!store)store=createPrivateStore(privateRoot);
  return admin;
 }catch(error){await admin.close();throw error;}
}
function samePath(a,b){return typeof a==='string'&&typeof b==='string'&&path.win32.resolve(a).toLowerCase()===path.win32.resolve(b).toLowerCase();}
module.exports={createUniversityAdminSql,createPrivateStore};
