'use strict';

function createSqlChangeHistoryRepository(db){
 return Object.freeze({
  list:({actorFirebaseUid,scope,start,end})=>db.transaction(()=>db.query(
   'EXEC paws_api.ListChangeHistoryEvents @ActorFirebaseUid=@ActorFirebaseUid,@Scope=@Scope,@StartUtc=@StartUtc,@EndExclusiveUtc=@EndExclusiveUtc',
   {ActorFirebaseUid:actorFirebaseUid,Scope:scope,StartUtc:start+'T00:00:00.000Z',EndExclusiveUtc:end+'T00:00:00.000Z'}
  ))
 });
}
module.exports={createSqlChangeHistoryRepository};
