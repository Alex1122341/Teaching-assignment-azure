'use strict';
// Local trusted administration only: no HTTP handler, credential discovery,
// Production connection or server-global configuration is implemented here.
const path=require('node:path');
const {compileTargetGuard,UNIVERSITY_HOSTS,UNIVERSITY_SERVER,TESTING_DATABASE}=require('../../server/src/runtime/sql-environment-target');

function assertTarget(target){
 if(target?.profile!=='university-testing'||!UNIVERSITY_HOSTS.includes(target.host)||target.physicalServer!==UNIVERSITY_SERVER||target.database!==TESTING_DATABASE)throw Error('Only the exact University Testing target is approved');
 compileTargetGuard(target);
 return target;
}
function resetConfirmation(target){assertTarget(target);return ['RESET-TESTING',target.physicalServer,target.database,target.environmentId].join('|');}
function assertIdentity(state,target,{allowAbsent=false}={}){
 if(!state||state.physicalServer!==target.physicalServer)throw Error('University SQL physical target identity mismatch');
 if(!state.exists){if(allowAbsent)return;throw Error('Testing target does not exist');}
 if(state.environment!=='testing'||String(state.environmentId).toLowerCase()!==target.environmentId)throw Error('Testing marker identity mismatch');
 if(state.trustworthy!==false||state.chaining!==false||state.guestEnabled!==false)throw Error('Testing isolation settings are unsafe or unavailable');
}
function assertAudit(audit){
 const collections=['serverAuthority','databaseAuthority','ownership','direct','group','public','class0','tokens'];
 if(audit?.complete!==true||collections.some(key=>!Array.isArray(audit[key]))||typeof audit.productionAccess!=='boolean')throw Error('Runtime permission audit is incomplete');
 if(audit.productionAccess||audit.serverAuthority.length||audit.databaseAuthority.length||audit.ownership.length)throw Error('Runtime has unsafe authority, ownership or Production access');
 const dangerous=/CONTROL|ALTER|IMPERSONATE|TAKE OWNERSHIP|CREATE (?:DATABASE|USER|ROLE|SCHEMA|ASSEMBLY)|EXTERNAL ACCESS|UNSAFE ASSEMBLY/i;
 for(const key of ['direct','group','public','class0']){
  if(audit[key].some(row=>row.state!=='DENY'&&(dangerous.test(row.permission||'')||row.state==='GRANT_WITH_GRANT_OPTION')))throw Error('Runtime inherited or direct permission authority is unsafe');
 }
}
async function authorize(adminDb,operator){
 if(typeof operator!=='string'||!operator.trim()||!(await adminDb.authorizeOperator(operator)))throw Error('Testing operator is not authorized');
}
async function inspectUniversityTesting({adminDb,runtimeDb,target}){
 assertTarget(target);
 const state=await adminDb.inspectTarget(target);
 assertIdentity(state,target);
 const audit=await runtimeDb.audit(target);
 assertAudit(audit);
 return {target:{...target},exists:true,runtimeSuitable:true,
  audited:{tokens:audit.tokens.length,direct:audit.direct.length,group:audit.group.length,public:audit.public.length,class0:audit.class0.length},
  isolation:{trustworthy:false,chaining:false,guestEnabled:false}};
}

// Metadata/effective permissions only. HAS_DBACCESS checks cross-DB authority
// without selecting any Production business row. Every collection is scoped
// to the current effective login/user token graph, including groups/roles.
const RUNTIME_AUDIT_SQL=`
SELECT (SELECT CAST(1 AS bit) AS complete,
 CAST(CASE WHEN COALESCE(HAS_DBACCESS(N'VetMed-Ops'),1)=0 THEN 0 ELSE 1 END AS bit) AS productionAccess,
 JSON_QUERY((SELECT name,type FROM sys.login_token FOR JSON PATH)) AS tokens,
 JSON_QUERY((SELECT permission_name AS permission FROM sys.fn_my_permissions(NULL,N'SERVER')
  WHERE permission_name NOT IN(N'CONNECT SQL',N'VIEW ANY DATABASE') FOR JSON PATH)) AS serverAuthority,
 JSON_QUERY((SELECT permission FROM (SELECT permission_name AS permission FROM sys.fn_my_permissions(NULL,N'DATABASE')
  WHERE permission_name IN(N'CONTROL',N'ALTER ANY USER',N'ALTER ANY ROLE',N'IMPERSONATE ANY USER',N'ALTER ANY SCHEMA',N'TAKE OWNERSHIP',N'CREATE ASSEMBLY')
  UNION ALL SELECT N'db_owner' WHERE IS_MEMBER(N'db_owner')=1) effectivePermissions FOR JSON PATH)) AS databaseAuthority,
 JSON_QUERY((SELECT kind,name FROM (SELECT N'schema' AS kind,s.name FROM sys.schemas s WHERE s.principal_id IN(SELECT principal_id FROM sys.user_token)
  UNION ALL SELECT N'object',o.name FROM sys.objects o WHERE o.principal_id IN(SELECT principal_id FROM sys.user_token)
  UNION ALL SELECT N'database',DB_NAME() WHERE USER_NAME()=N'dbo') ownedScopes FOR JSON PATH)) AS ownership,
 JSON_QUERY((SELECT p.class,p.permission_name AS permission,p.state_desc AS state FROM sys.database_permissions p
  WHERE p.grantee_principal_id=USER_ID() FOR JSON PATH)) AS direct,
 JSON_QUERY((SELECT p.class,p.permission_name AS permission,p.state_desc AS state FROM sys.database_permissions p
  JOIN sys.database_principals d ON d.principal_id=p.grantee_principal_id
  WHERE d.type IN(N'G',N'X',N'R') AND d.name<>N'public' AND d.principal_id IN(SELECT principal_id FROM sys.user_token) FOR JSON PATH)) AS [group],
 JSON_QUERY((SELECT p.class,p.permission_name AS permission,p.state_desc AS state FROM sys.database_permissions p
  WHERE p.grantee_principal_id=DATABASE_PRINCIPAL_ID(N'public') FOR JSON PATH)) AS [public],
 JSON_QUERY((SELECT p.class,p.permission_name AS permission,p.state_desc AS state FROM sys.database_permissions p
  WHERE p.class=0 AND p.grantee_principal_id IN(SELECT principal_id FROM sys.user_token) FOR JSON PATH)) AS class0
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER) AS auditJson;`;
async function auditRuntimeSql(connection,target){
 assertTarget(target);
 if(!connection?.target||connection.target.database!==target.database||connection.target.environmentId!==target.environmentId||connection.target.physicalServer!==target.physicalServer)throw Error('Runtime audit connection target mismatch');
 const result=await connection.guardedBatch(RUNTIME_AUDIT_SQL);
 let audit;
 try{audit=JSON.parse(result.recordset?.[0]?.auditJson);}catch{throw Error('Runtime permission audit metadata unavailable');}
 assertAudit(audit);return audit;
}
async function createUniversityTesting({adminDb,target,storage,operator}){
 assertTarget(target);await authorize(adminDb,operator);
 return adminDb.withExclusiveReset(target,async()=>{
  const state=await adminDb.inspectTarget(target);
  assertIdentity(state,target,{allowAbsent:true});
  if(state.exists)throw Error('Testing database already exists; never take over an existing database');
  // Use measured server capacity, not the caller's suggested value.
  if(!Number.isSafeInteger(state.availableBytes)||state.availableBytes<2*1024**3)throw Error('Insufficient or unknown server storage capacity');
  if(storage?.dataMaxMiB!==undefined&&storage.dataMaxMiB!==1024||storage?.logMaxMiB!==undefined&&storage.logMaxMiB!==512)throw Error('Testing storage limits are fixed');
  const result=await adminDb.createTestingDatabase({target,storage:{dataMaxMiB:1024,logMaxMiB:512,dataInitialMiB:64,logInitialMiB:32,growthMiB:64}});
  if(result?.created!==true)throw Error('Testing database creation not verified');
  const receipt={ok:true,action:'create',target:{...target},created:true,ready:false,utc:new Date().toISOString()};
  await adminDb.recordReceipt(receipt);return receipt;
 });
}
function assertBackupPath(value){
 if(typeof value!=='string'||!path.win32.isAbsolute(value)||/^\\\\/.test(value)||/[\x00-\x1f]/.test(value)||value.split(/[\\/]/).some(part=>part==='..')||value.length>220||path.win32.parse(value).root===value)throw Error('A dedicated private Testing backup directory is required');
}
async function resetUniversityTesting({adminDb,target,operator,confirmation,backupPath}){
 assertTarget(target);
 // Deliberately before authentication, metadata queries, backup or lock calls.
 if(confirmation!==resetConfirmation(target))throw Error('Exact RESET-TESTING target confirmation is required');
 assertBackupPath(backupPath);await authorize(adminDb,operator);
 return adminDb.withExclusiveReset(target,async()=>{
  assertIdentity(await adminDb.inspectTarget(target),target);
  if(await adminDb.assertTestingStopped(target)!==true)throw Error('Verified Testing runtime must be stopped before reset');
  const backup=await adminDb.backupTesting({target,backupPath});
  if(backup?.database!==target.database||backup?.environmentId!==target.environmentId||!/^[0-9a-f]{64}$/i.test(backup?.sha256||'')||backup.verified!==true||await adminDb.verifyBackup(backup,target)!==true)throw Error('Testing backup verification failed');
  // Recheck after backup: a target/marker change cannot authorize a reset.
  assertIdentity(await adminDb.inspectTarget(target),target);
  let outcome;
  try {
   outcome=await adminDb.resetTesting({target,backup});
   if(outcome?.verified!==true||outcome.markerCount!==1)throw Error('Testing reset verification failed');
   assertIdentity(await adminDb.inspectTarget(target),target);
  }catch(error){
   await adminDb.recordReceipt({ok:false,action:'reset',target:{...target},backupId:backup.id,ready:false,utc:new Date().toISOString()});
   throw error;
  }
  const receipt={ok:true,action:'reset',target:{...target},backupId:backup.id,backupSha256:backup.sha256,ready:false,utc:new Date().toISOString()};
  await adminDb.recordReceipt(receipt);return receipt;
 });
}
module.exports={inspectUniversityTesting,createUniversityTesting,resetUniversityTesting,resetConfirmation,assertTarget,assertAudit,auditRuntimeSql};
