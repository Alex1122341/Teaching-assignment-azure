'use strict';
function createSqlSwapRepository(db){
  const exec=async(name,args)=>{
    const rows=await db.query(`EXEC paws_api.${name} ${Object.keys(args).map(key=>`@${key}=@${key}`).join(',')}`,args);
    const body=rows[0]?.responseJson?JSON.parse(rows[0].responseJson):null;
    if(body?.unavailableReasons)body.unavailableReasons=body.unavailableReasons.map(row=>typeof row==='string'?row:row.reason);
    return body;
  };
  return Object.freeze({
    context:({actorFirebaseUid,sessionId})=>exec('GetSessionSwapContext',{ActorFirebaseUid:actorFirebaseUid,SessionId:sessionId}),
    queue:({actorFirebaseUid})=>exec('GetSessionSwapQueue',{ActorFirebaseUid:actorFirebaseUid}),
    detail:({actorFirebaseUid,requestId})=>exec('GetSessionSwap',{ActorFirebaseUid:actorFirebaseUid,RequestId:requestId}),
    create:({actorFirebaseUid,payload})=>exec('SaveSessionSwap',{ActorFirebaseUid:actorFirebaseUid,PayloadJson:JSON.stringify(payload),Revise:0}),
    revise:({actorFirebaseUid,requestId,payload})=>exec('SaveSessionSwap',{ActorFirebaseUid:actorFirebaseUid,PayloadJson:JSON.stringify({...payload,requestId}),Revise:1}),
    decide:({actorFirebaseUid,requestId,payload,applyEnabled})=>exec('DecideSessionSwap',{ActorFirebaseUid:actorFirebaseUid,RequestId:requestId,ExpectedRevision:payload.expectedRevision,Decision:payload.decision,Comment:payload.comment||null,OverrideReason:payload.overrideReason||null,ApplyEnabled:applyEnabled?1:0}),
    withdraw:({actorFirebaseUid,requestId,payload})=>exec('WithdrawSessionSwap',{ActorFirebaseUid:actorFirebaseUid,RequestId:requestId,ExpectedRevision:payload.expectedRevision,Comment:payload.comment||null})
  });
}
module.exports={createSqlSwapRepository};
