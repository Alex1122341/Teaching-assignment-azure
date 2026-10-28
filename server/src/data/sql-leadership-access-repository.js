'use strict';
const UID=/^[A-Za-z0-9_.:@-]{1,128}$/,VERSION=/^[a-f0-9]{16}$/i;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const pick=(row,keys)=>Object.fromEntries(keys.filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]]));
function uid(value){if(typeof value!=='string'||!UID.test(value))throw Error('Canonical account identity required.');return value;}
function year(value){const match=typeof value==='string'&&/^([1-9]\d{3})-(\d{2})$/.exec(value);if(!match||Number(match[2])!==(Number(match[1])+1)%100)throw Error('Canonical academic year required.');return value;}
function rows(value,fields,limit=1000){
 if(!Array.isArray(value)||value.length>limit||value.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw Error('Bounded leadership rows required.');
 return value.map(row=>pick(row,fields));
}
function parse(result,field,optional=false){
 if(!Array.isArray(result)||result.length>1)throw Error('Invalid leadership SQL response.');
 if(!result.length&&optional)return null;
 const raw=result[0]?.[field];if(typeof raw!=='string'||raw.length>2097152)throw Error('Leadership SQL JSON is unavailable or exceeds its limit.');
 const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid leadership SQL JSON.');return value;
}
function receipt(result,optional=false){
 const value=parse(result,'receiptJson',optional);if(value===null)return null;
 if(!UUID.test(value.operationId||'')||!UID.test(value.actorUid||'')||!UID.test(value.targetUid||''))throw Error('Persisted leadership receipt is invalid.');
 const resultView=pick(value,['operationId','previewId','actorUid','targetUid','academicYear','reason','savedAuthorityVersion','createdAtUtc']);
 // SQL Server emits uniqueidentifier JSON in uppercase; browser UUIDs are
 // lowercase. Firebase UIDs are case-sensitive and must remain untouched.
 for(const key of ['operationId','previewId'])if(typeof resultView[key]==='string')resultView[key]=resultView[key].toLowerCase();
 return resultView;
}
function createSqlLeadershipAccessRepository(db){
 if(typeof db?.query!=='function')throw TypeError('SQL query required.');
 return Object.freeze({
  async snapshot(targetUid,academicYear,actorUid){
   const result=await db.query('EXEC paws_api.GetTeachingLeadershipAccessSnapshot @ActorUid=@actorUid,@TargetUid=@targetUid,@AcademicYear=@academicYear',
    {actorUid:uid(actorUid),targetUid:uid(targetUid),academicYear:year(academicYear)});
   const value=parse(result,'snapshotJson');
   if(!value.target||typeof value.target!=='object'||Array.isArray(value.target)||!UID.test(value.target.firebaseUid||'')||!VERSION.test(value.target.version||'')||!VERSION.test(value.authorityVersion||''))throw Error('Versioned leadership snapshot unavailable.');
   const catalog=rows(value.catalog,['responsibilityId','kind','label','active','definitionVersion','courses','groups']).map(row=>({...row,courses:rows(row.courses,['courseId','courseCode'],200),groups:rows(row.groups,['groupId','name'],200)}));
   return {target:pick(value.target,['firebaseUid','baseRole','active','mustChangePassword','facultyId','facultyActive','version']),authorityVersion:value.authorityVersion.toLowerCase(),catalog,
    sources:rows(value.sources,['sourceRoleAssignmentId','facultyId','academicYear','roleType','courseId','recordedScope','effectiveDate','expirationDate','hasSchedule','periodsJson','version','scheduleVersion','signature']),
    assignments:rows(value.assignments,['assignmentId','responsibilityId','facultyId','academicYear','startDate','endExclusive','version','managed','sourceRoleAssignmentId','usesApprovedDefaultDates'])};
  },
  async operation(operationId,actorUid){
   if(typeof operationId!=='string'||!UUID.test(operationId))throw Error('Canonical operation identifier required.');
   return receipt(await db.query('EXEC paws_api.GetTeachingLeadershipAccessOperation @ActorUid=@actorUid,@OperationId=@operationId',{actorUid:uid(actorUid),operationId}),true);
  },
  async history({actorUid,targetUid,academicYear,offset=0}){
   if(!Number.isSafeInteger(offset)||offset<0||offset%50)throw Error('Valid history offset required.');
   const value=parse(await db.query('EXEC paws_api.GetTeachingLeadershipAccessHistory @ActorUid=@actorUid,@TargetUid=@targetUid,@AcademicYear=@academicYear,@Offset=@offset',{actorUid:uid(actorUid),targetUid:uid(targetUid),academicYear:year(academicYear),offset}),'historyJson');
   if(!Number.isSafeInteger(value.total)||value.total<0||!Array.isArray(value.operations)||value.operations.length>50||!Array.isArray(value.origins)||value.origins.length>1000)throw Error('Bounded history unavailable.');
   const origins=new Map(value.origins.map(item=>[String(item.operationId).toLowerCase(),item]));
   const state=items=>rows(items||[],['assignmentId','responsibilityId','startDate','endExclusive','grantOperationId','usesApprovedDefaultDates']).map(item=>{
    const origin=origins.get(String(item.grantOperationId).toLowerCase()),grant=origin?.changes?.find(change=>change.action==='grant'&&change.responsibilityId===item.responsibilityId);
    const date=item.endExclusive&&/^\d{4}-\d{2}-\d{2}$/.test(item.endExclusive)?new Date(Date.parse(item.endExclusive+'T12:00:00Z')-86400000):null;
    return {assignmentId:item.assignmentId,responsibilityId:item.responsibilityId,startDate:item.startDate||null,endDate:date&&!Number.isNaN(date.valueOf())?date.toISOString().slice(0,10):null,usesApprovedDefaultDates:item.usesApprovedDefaultDates===true,
     kind:grant?.kind||null,courses:rows(grant?.courses||[],['courseId','courseCode'],200),groups:rows(grant?.groups||[],['groupId','name'],200),scopeRecorded:Boolean(grant)};
   });
   return {total:value.total,rows:value.operations.map(item=>{
    if(!UUID.test(item.operationId||'')||item.receipt?.academicYear!==academicYear)throw Error('History target mismatch.');
    return {operationId:item.operationId,actorName:item.actorName||'Name unavailable',targetName:item.targetName||'Name unavailable',academicYear,reason:item.reason,createdAtUtc:item.createdAtUtc,
     before:state(item.receipt.before),after:state(item.receipt.after)};
   })};
  },
  async commit(intent){
   const result=await db.query(`EXEC paws_api.SetTeachingLeadershipAccess @ActorUid=@actorUid,@ActorVersion=@actorVersion,
    @TargetUid=@targetUid,@TargetVersion=@targetVersion,@AcademicYear=@academicYear,@AuthorityVersion=@authorityVersion,
    @ChangesJson=@changesJson,@Reason=@reason,@IntentHash=@intentHash,@OperationId=@operationId,@PreviewId=@previewId`,
    {actorUid:uid(intent.actorUid),actorVersion:intent.actorVersion,targetUid:uid(intent.targetUid),targetVersion:intent.targetVersion,academicYear:year(intent.academicYear),authorityVersion:intent.authorityVersion,
     changesJson:JSON.stringify(intent.changes),reason:intent.reason,intentHash:intent.intentHash,operationId:intent.operationId,previewId:intent.previewId});
   return receipt(result);
  }
 });
}
module.exports={createSqlLeadershipAccessRepository};
