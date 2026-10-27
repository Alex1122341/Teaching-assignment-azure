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
 return pick(value,['operationId','previewId','actorUid','targetUid','academicYear','reason','savedAuthorityVersion','createdAtUtc']);
}
function createSqlLeadershipAccessRepository(db){
 if(typeof db?.query!=='function')throw TypeError('SQL query required.');
 return Object.freeze({
  async snapshot(targetUid,academicYear,actorUid){
   const result=await db.query('EXEC paws_api.GetTeachingLeadershipAccessSnapshot @ActorUid=@actorUid,@TargetUid=@targetUid,@AcademicYear=@academicYear',
    {actorUid:uid(actorUid),targetUid:uid(targetUid),academicYear:year(academicYear)});
   const value=parse(result,'snapshotJson');
   if(!value.target||typeof value.target!=='object'||Array.isArray(value.target)||!UID.test(value.target.firebaseUid||'')||!VERSION.test(value.target.version||'')||!VERSION.test(value.authorityVersion||''))throw Error('Versioned leadership snapshot unavailable.');
   const catalog=rows(value.catalog,['responsibilityId','kind','active','definitionVersion','courses','groups']).map(row=>({...row,courses:rows(row.courses,['courseId','courseCode'],200),groups:rows(row.groups,['groupId','name'],200)}));
   return {target:pick(value.target,['firebaseUid','baseRole','active','mustChangePassword','facultyId','facultyActive','version']),authorityVersion:value.authorityVersion.toLowerCase(),catalog,
    sources:rows(value.sources,['sourceRoleAssignmentId','facultyId','academicYear','roleType','courseId','recordedScope','effectiveDate','expirationDate','hasSchedule','periodsJson','version','scheduleVersion','signature']),
    assignments:rows(value.assignments,['assignmentId','responsibilityId','facultyId','academicYear','startDate','endExclusive','version','managed'])};
  },
  async operation(operationId,actorUid){
   if(typeof operationId!=='string'||!UUID.test(operationId))throw Error('Canonical operation identifier required.');
   return receipt(await db.query('EXEC paws_api.GetTeachingLeadershipAccessOperation @ActorUid=@actorUid,@OperationId=@operationId',{actorUid:uid(actorUid),operationId}),true);
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
