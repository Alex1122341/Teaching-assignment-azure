'use strict';
function publicActivity(row){
 const keys=['activityId','facultyKey','facultyDisplayName','category','label','startDate','endDate','courseCode','timeStatus','version'];
 const result=Object.fromEntries(keys.map(key=>[key,row[key]??null]));
 result.timeEvidence=Array.isArray(row.timeEvidence)?row.timeEvidence.map(value=>({date:value.date,startTime:value.startTime,endTime:value.endTime})):[];
 return result;
}
function createSqlCalendarActivityRepository(db){
 async function exec(name,params){
  const rows=await db.query('EXEC paws_api.'+name+' '+Object.keys(params).map(key=>'@'+key+'=@'+key).join(','),params);
  try{
   const value=JSON.parse(rows[0]?.responseJson);
   if(!value||typeof value!=='object'||Array.isArray(value))throw Error();
   return value;
  }catch(_){throw Object.assign(new Error('The activity service returned an invalid response.'),{code:'INVALID_CALENDAR_RESPONSE'});}
 }
 return Object.freeze({
  stage:({actorFirebaseUid,parsed,requestId})=>exec('StageCalendarActivityImport',{ActorFirebaseUid:actorFirebaseUid,RequestId:requestId,SourceSha256:parsed.sourceSha256,RowsJson:JSON.stringify(parsed.rows)}),
  preview:({actorFirebaseUid,batchId,expectedVersion})=>exec('PreviewCalendarActivityImport',{ActorFirebaseUid:actorFirebaseUid,ImportBatchId:batchId,ExpectedVersion:expectedVersion}),
  getImport:({actorFirebaseUid,batchId})=>exec('GetCalendarActivityImport',{ActorFirebaseUid:actorFirebaseUid,ImportBatchId:batchId}),
  async commit({actorFirebaseUid,batchId,expectedVersion,manifestSha256,sourceSha256,idempotencyKey,confirm}){
   const value=await exec('CommitCalendarActivityImport',{ActorFirebaseUid:actorFirebaseUid,ImportBatchId:batchId,ExpectedVersion:expectedVersion,ManifestSha256:manifestSha256,SourceSha256:sourceSha256,IdempotencyKey:idempotencyKey,Confirm:confirm});
   return Object.fromEntries(['receiptId','batchId','sourceSha256','manifestSha256','insertedCount','deletedAfcCount','committedAtUtc','idempotentReplay'].map(key=>[key,value[key]]));
  },
  async resolveTime({actorFirebaseUid,activityId,expectedVersion,date,startTime,endTime,evidenceRef,evidenceNote}){
   return publicActivity(await exec('ResolveCalendarActivityDayTime',{ActorFirebaseUid:actorFirebaseUid,ActivityId:activityId,ExpectedVersion:expectedVersion,ActivityDate:date,StartTime:startTime,EndTime:endTime,EvidenceRef:evidenceRef,EvidenceNote:evidenceNote}));
  },
  async list({actorFirebaseUid,start,end,facultyKey=null,category=null,cursor=null,limit=100}){
   const response=await exec('ListCalendarActivities',{ActorFirebaseUid:actorFirebaseUid,StartDate:start,EndExclusive:end,FacultyKey:facultyKey,Category:category,Cursor:cursor,Limit:limit});
   if(!Array.isArray(response.activities))throw Object.assign(new Error('The activity service returned an invalid response.'),{code:'INVALID_CALENDAR_RESPONSE'});
   return {activities:response.activities.map(publicActivity),nextCursor:response.nextCursor??null};
  }
 });
}
module.exports={createSqlCalendarActivityRepository,publicActivity};
