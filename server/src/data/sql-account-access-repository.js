'use strict';
const PROFILE=`u.FirebaseUid AS firebaseUid,u.Email AS email,u.DisplayName AS displayName,u.BaseRole AS baseRole,
 u.FacultyId AS facultyId,u.Active AS active,u.MustChangePassword AS mustChangePassword,
 LOWER(CONVERT(varchar(16),u.AccessVersion,2)) AS version`;
function receipt(row){return row?JSON.parse(row.receiptJson):null;}
function createSqlAccountAccessRepository(db){
 return Object.freeze({
  async read(uid){return (await db.query(`SELECT ${PROFILE} FROM paws.UserProfile u WHERE u.FirebaseUid=@uid`,{uid}))[0]||null;},
  list:()=>db.query(`SELECT TOP(1001) ${PROFILE} FROM paws.UserProfile u ORDER BY u.DisplayName,u.FirebaseUid`),
  eligibleFaculty:()=>db.query(`SELECT TOP(5001) FacultyId AS facultyId,DisplayName AS displayName,PreferredFirstName AS preferredFirstName,PreferredLastName AS preferredLastName,Active AS active FROM paws.Faculty WHERE Active=1 ORDER BY DisplayName,FacultyId`),
  async operation(operationId){return receipt((await db.query('SELECT ReceiptJson AS receiptJson FROM paws.AccountAccessChange WHERE OperationId=@operationId',{operationId}))[0]);},
  async commit(change){
   const rows=await db.query(`EXEC paws_api.SetAccountAccess @ActorUid=@actorUid,@ActorVersion=@actorVersion,@TargetUid=@targetUid,
    @ExpectedVersion=@expectedVersion,@Role=@role,@Active=@active,@FacultyId=@facultyId,
    @Reason=@reason,@IntentHash=@intentHash,@OperationId=@operationId,@PreviewId=@previewId`,
   {actorUid:change.actorUid,actorVersion:change.actorVersion,targetUid:change.targetUid,expectedVersion:change.expectedVersion,role:change.after.role,active:change.after.active,facultyId:change.after.facultyId,reason:change.reason,intentHash:change.intentHash,operationId:change.operationId,previewId:change.previewId});
   const result=receipt(rows[0]);if(!result)throw Error('Access command did not return a persisted receipt');return result;
  },
  async history({targetUid,offset}){
   const rows=await db.query(`SELECT ReceiptJson AS receiptJson,COUNT_BIG(*) OVER() AS total FROM paws.AccountAccessChange
    WHERE @targetUid IS NULL OR TargetUid=@targetUid ORDER BY CreatedAtUtc DESC,OperationId DESC OFFSET @offset ROWS FETCH NEXT 50 ROWS ONLY`,{targetUid,offset});
   // Count is fetched separately for an empty final page, not inferred from page size.
   const total=rows.length?Number(rows[0].total):Number((await db.query('SELECT COUNT_BIG(*) AS total FROM paws.AccountAccessChange WHERE @targetUid IS NULL OR TargetUid=@targetUid',{targetUid}))[0]?.total||0);
   return {total,rows:rows.map(receipt)};
  }
 });
}
module.exports={createSqlAccountAccessRepository};
