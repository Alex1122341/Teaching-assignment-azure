'use strict';
// Trusted offline operator entry point. No HTTP route and no browser credentials.
const fs=require('node:fs/promises'),path=require('node:path');
const {createMasterRefreshService}=require('../../server/src/master-refresh/master-refresh-service');
const {createSqlMasterRefreshRepository}=require('../../server/src/data/sql-master-refresh-repository');
async function connect(){
 const {createSqlConnection,resolveSqlDriver}=require('../../server/src/data/sql-connection');
 const expected=process.env.PAWS_MASTER_EXPECTED_SERVER;
 if(!expected)throw Object.assign(Error('Expected SQL server must be configured.'),{code:'EXPECTED_SERVER_REQUIRED'});
 const driver=resolveSqlDriver(process.env.PAWS_SQL_DRIVER),sql=require(require.resolve(driver==='msnodesqlv8'?'mssql/msnodesqlv8':'mssql',{paths:[path.resolve(__dirname,'../../server')]}));
 const db=createSqlConnection({connectionString:process.env.PAWS_SQL_CONNECTION_STRING,miClientId:process.env.PAWS_SQL_MI_CLIENT_ID,driver,allowSelfSigned:process.env.PAWS_SQL_ALLOW_SELF_SIGNED==='true',sql,requestTimeoutMs:90000});
 try{
  const [row]=await db.query("SELECT CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,DB_NAME() databaseName");
  if(row?.databaseName!=='VetMed-Ops'||String(row.serverName).toLowerCase()!==expected.toLowerCase())throw Object.assign(Error('SQL target differs from explicit operator binding.'),{code:'MASTER_TARGET_MISMATCH'});
  return db;
 }catch(e){await db.close();throw e;}
}
async function run(options,{connect:open=connect}={}){
 const mode=options?.mode;
 const common=['mode','domain','outputPath'],keys=mode==='Plan'?['sourcePath']:mode==='Stage'?['sourcePath','actorFirebaseUid']:mode==='Apply'?['batchId','expectedVersion','sourceSha256','manifestSha256','idempotencyKey','actorFirebaseUid','confirm']:mode==='Recover'?['receiptId','actorFirebaseUid','confirm']:[];
 if(!['Plan','Stage','Apply','Recover'].includes(mode)||Object.keys(options).some(k=>![...common,...keys].includes(k))||!options.outputPath)throw Object.assign(Error('Invalid MASTER CLI arguments.'),{code:'INVALID_MASTER_CLI'});
 let request,method;
 if(mode==='Plan'||mode==='Stage'){
  const source=JSON.parse(await fs.readFile(options.sourcePath,'utf8'));
  request={domain:options.domain,academicYear:source.academicYear,source,actorFirebaseUid:options.actorFirebaseUid||'read-only-plan'};method='preview';
 }else{
  request=Object.fromEntries(Object.entries(options).filter(([k])=>![...common.filter(k=>k!=='domain')].includes(k)));
  if(mode==='Recover')delete request.domain;
  method=mode==='Apply'?'apply':'recover';
 }
 // Validation occurs before opening a database connection or creating output.
 const validator=createMasterRefreshService({repository:{preview:async()=>({}),apply:async()=>({}),recover:async()=>({})}});
 await validator[method](request);
 const handle=await fs.open(options.outputPath,'wx',0o600);let db;
 try{
  let result;
  if(mode==='Plan')result={mode,domain:request.domain,academicYear:request.academicYear,sourceSha256:request.source.sourceSha256,manifestSha256:request.source.manifestSha256,databaseWrites:false};
  else{
   db=await open();const service=createMasterRefreshService({repository:createSqlMasterRefreshRepository(db)});
   result=await service[method](request);
   if(mode==='Apply'){
    const [receipt]=await db.query('SELECT ReceiptId receiptId,SourceSha256 sourceSha256,ManifestSha256 manifestSha256,BeforeJson beforeJson,AfterHash afterHash FROM paws.MasterRefreshReceipt WHERE ReceiptId=@receiptId',{receiptId:result.receiptId});
    if(!receipt||receipt.sourceSha256.toUpperCase()!==request.sourceSha256.toUpperCase()||receipt.manifestSha256.toUpperCase()!==request.manifestSha256.toUpperCase())throw Object.assign(Error('Private receipt export mismatch.'),{code:'MASTER_RECEIPT_EXPORT_FAILED'});
    result={...result,privateRecoveryReceipt:receipt};
   }
  }
  await handle.writeFile(JSON.stringify(result,null,2));await handle.sync();return result;
 }catch(e){await handle.writeFile(JSON.stringify({mode,status:'failed',code:e.code||'MASTER_REFRESH_FAILED'}));throw e;}
 finally{await handle.close();if(db)await db.close();}
}
if(require.main===module){
 const mapping={'--mode':'mode','--domain':'domain','--source':'sourcePath','--output':'outputPath','--actor':'actorFirebaseUid','--batch':'batchId','--version':'expectedVersion','--source-sha256':'sourceSha256','--manifest-sha256':'manifestSha256','--key':'idempotencyKey','--receipt':'receiptId'},options={};
 try{
  const args=process.argv.slice(2);
  for(let i=0;i<args.length;i++){if(args[i]==='--confirm'){if(options.confirm)throw Error();options.confirm=true;continue;}const key=mapping[args[i]];if(!key||!args[i+1]||Object.hasOwn(options,key))throw Error();options[key]=args[++i];}
  run(options).then(r=>console.log(JSON.stringify({mode:options.mode,batchId:r.batchId,receiptId:r.receiptId,databaseWrites:r.databaseWrites,outputWritten:true}))).catch(e=>{console.error(e.code||'MASTER_REFRESH_FAILED');process.exitCode=1;});
 }catch(_){console.error('INVALID_MASTER_CLI_ARGUMENTS');process.exitCode=1;}
}
module.exports={run};
