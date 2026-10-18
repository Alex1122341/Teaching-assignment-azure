'use strict';
function createSqlMasterRefreshRepository(db){
 if(typeof db?.query!=='function')throw new TypeError('A SQL query adapter is required.');
 async function exec(name,params){
  const rows=await db.query(`EXEC paws_api.${name} ${Object.keys(params).map(k=>`@${k}=@${k}`).join(',')}`,params);
  try{const r=JSON.parse(rows[0]?.responseJson);if(!r||typeof r!=='object'||Array.isArray(r))throw Error();return r;}
  catch(_){throw Object.assign(new Error('Invalid MASTER refresh response.'),{code:'INVALID_MASTER_REFRESH_RESPONSE'});}
 }
 return Object.freeze({
  preview:({domain,academicYear,source,actorFirebaseUid})=>exec('PreviewMasterRefresh',{Domain:domain,AcademicYear:academicYear,SourceJson:JSON.stringify(source),ActorFirebaseUid:actorFirebaseUid}),
  apply:({domain,batchId,expectedVersion,manifestSha256,sourceSha256,idempotencyKey,actorFirebaseUid,confirm})=>exec('CommitMasterRefresh',{Domain:domain,BatchId:batchId,ExpectedVersion:expectedVersion,ManifestSha256:manifestSha256,SourceSha256:sourceSha256,IdempotencyKey:idempotencyKey,ActorFirebaseUid:actorFirebaseUid,Confirm:confirm}),
  recover:({receiptId,actorFirebaseUid,confirm})=>exec('RecoverMasterRefresh',{ReceiptId:receiptId,ActorFirebaseUid:actorFirebaseUid,Confirm:confirm})
 });
}
module.exports={createSqlMasterRefreshRepository};
