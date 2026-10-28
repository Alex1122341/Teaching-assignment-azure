'use strict';
const {randomUUID}=require('node:crypto');
const {normalizeBaseRole,isSelfServiceRole}=require('../auth/role-policy');
const {effectivePeriods,calgaryDate,classify}=require('../roles/role-effective-status');
const {buildLeadershipGrantIntent}=require('./leadership-grant-policy');
const UID=/^[A-Za-z0-9_.:@-]{1,128}$/,VERSION=/^[a-f0-9]{16}$/i;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const closed=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));
const fail=(status,code,message)=>({status,body:{error:{code,message}}}),ok=body=>({status:200,body});
const binding=profile=>JSON.stringify([normalizeBaseRole(profile?.baseRole),profile?.active,profile?.mustChangePassword,profile?.facultyId||null,profile?.version]);
const operationView=row=>Object.fromEntries(['operationId','previewId','actorUid','targetUid','academicYear','reason','savedAuthorityVersion','createdAtUtc'].map(key=>[key,row[key]]));
function yearValid(value){const year=/^([1-9]\d{3})-(\d{2})$/.exec(value||'');return Boolean(year&&Number(year[2])===(Number(year[1])+1)%100);}

function createLeadershipAccessApi({verifyToken,findUser,repository,writeEnabled=false,clock=Date.now,randomId=randomUUID}){
 const previews=new Map();writeEnabled=writeEnabled===true;
 async function authorize(token){
  let decoded;try{decoded=token&&await verifyToken(token);}catch(_){/* uniform identity failure */}
  if(!UID.test(decoded?.uid||''))return {response:fail(401,'UNAUTHENTICATED','A valid sign-in is required.')};
  let profile;try{profile=await findUser(decoded.uid);}catch(_){return {response:fail(503,'LEADERSHIP_UNAVAILABLE','Effective access could not be checked.')};}
  if(normalizeBaseRole(profile?.baseRole)!=='adfa_general'||profile?.active!==true||profile?.mustChangePassword!==false||!VERSION.test(profile?.version||''))return {response:fail(403,'OWNER_REQUIRED','A ready SQL Owner account is required.')};
  return {uid:decoded.uid,profile:{...profile},binding:binding(profile)};
 }
 async function recheck(token,auth){const current=await authorize(token);if(current.response)return current.response;return current.uid===auth.uid&&current.binding===auth.binding?null:fail(403,'ACCESS_CHANGED','Your effective access changed. Refresh before continuing.');}
 function prune(){for(const [id,entry] of previews)if(entry.expiresAt<=clock())previews.delete(id);}
 return Object.freeze({
  async catalog(token,input){
   const auth=await authorize(token);if(auth.response)return auth.response;
   if(!closed(input,['targetUid','academicYear'])||typeof input.targetUid!=='string'||!UID.test(input.targetUid)||!yearValid(input.academicYear))return fail(400,'INVALID_LEADERSHIP_QUERY','Choose an account and canonical academic year.');
   try{
    const snapshot=await repository.snapshot(input.targetUid,input.academicYear,auth.uid),target=snapshot?.target;
    if(target?.firebaseUid!==input.targetUid||!isSelfServiceRole(target.baseRole)||target.active!==true||target.mustChangePassword!==false||target.facultyActive!==true||!UUID.test(target.facultyId||'')||!VERSION.test(target.version||''))return fail(409,'TARGET_ACCESS_INELIGIBLE','Leadership grants require a ready account linked to active Faculty.');
    if(!VERSION.test(snapshot.authorityVersion||'')||!['catalog','sources','assignments'].every(key=>Array.isArray(snapshot[key])&&snapshot[key].length<=1000))throw Error('Invalid leadership catalog.');
    const definitions=snapshot.catalog.map(row=>({responsibilityId:row.responsibilityId,kind:row.kind,label:typeof row.label==='string'?row.label:row.kind==='hicc'?'HICC / Course Coordinator':'VISC',
     courses:(row.courses||[]).map(item=>({courseId:item.courseId,courseCode:item.courseCode})),groups:(row.groups||[]).map(item=>({groupId:item.groupId,name:item.name}))}));
    const asOfDate=calgaryDate(new Date(clock()));
    const sources=snapshot.sources.map(row=>{
     if(row.facultyId?.toLowerCase()!==target.facultyId.toLowerCase()||row.academicYear!==input.academicYear||typeof row.hasSchedule!=='boolean')throw Error('Source target mismatch.');
     const type=typeof row.roleType==='string'?row.roleType.trim().toUpperCase():'';
     const kind=['HICC','COURSE COORDINATOR'].includes(type)?'hicc':type==='VISC'?'visc':null;if(!kind)throw Error('Unsupported source appointment.');
     const periods=effectivePeriods(row);
     return {sourceRoleAssignmentId:row.sourceRoleAssignmentId,kind,description:typeof row.recordedScope==='string'?row.recordedScope.trim():'Not provided',courseId:row.courseId||null,
      periods:periods||[],status:classify(row,asOfDate).status,datesNeedReview:periods===null||periods.some(period=>!period.startDate),
      canUseAcademicYearDefault:row.hasSchedule===false&&row.effectiveDate==null&&row.expirationDate==null};
    });
    const assignments=snapshot.assignments.filter(row=>row.facultyId?.toLowerCase()===target.facultyId.toLowerCase()&&row.academicYear===input.academicYear).map(row=>Object.fromEntries(
     ['assignmentId','responsibilityId','startDate','endExclusive','version','managed','sourceRoleAssignmentId','usesApprovedDefaultDates'].filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]])));
    const changed=await recheck(token,auth);if(changed)return changed;
    return ok({target:{uid:target.firebaseUid,role:normalizeBaseRole(target.baseRole),facultyId:target.facultyId,version:target.version},academicYear:input.academicYear,authorityVersion:snapshot.authorityVersion,asOfDate,definitions,sources,assignments,writeEnabled});
   }catch(_){return fail(503,'LEADERSHIP_UNAVAILABLE','Leadership choices could not be loaded. No permissions were changed.');}
  },
  async preview(token,input){
   const auth=await authorize(token);if(auth.response)return auth.response;
   if(!closed(input,['targetUid','academicYear','expectedVersion','expectedAuthorityVersion','changes','reason'])||!UID.test(input.targetUid||'')||!yearValid(input.academicYear)||!VERSION.test(input.expectedVersion||'')||input.expectedAuthorityVersion!==undefined&&!VERSION.test(input.expectedAuthorityVersion||''))return fail(400,'INVALID_LEADERSHIP_CHANGE','Provide an exact target version, academic year and scope changes.');
   try{
    const snapshot=await repository.snapshot(input.targetUid,input.academicYear,auth.uid);
    if(!snapshot?.target||snapshot.target.firebaseUid!==input.targetUid)return fail(409,'TARGET_ACCESS_INELIGIBLE','The target account is unavailable.');
    if(snapshot.target.version?.toLowerCase()!==input.expectedVersion.toLowerCase())return fail(409,'LEADERSHIP_STALE','Target access changed. Refresh and preview again.');
    if(input.expectedAuthorityVersion!==undefined&&snapshot.authorityVersion?.toLowerCase()!==input.expectedAuthorityVersion.toLowerCase())return fail(409,'LEADERSHIP_STALE','The authority choices changed. Reload them and preview again.');
    const intent=buildLeadershipGrantIntent({...snapshot,actor:auth.profile,target:snapshot.target,academicYear:input.academicYear,changes:input.changes,reason:input.reason});
    const changed=await recheck(token,auth);if(changed)return changed;
    prune();const previewId=randomId(),expiresAt=clock()+600000;
    if(!UUID.test(previewId)||previews.has(previewId))throw Error('Invalid preview identifier.');
    const own=[...previews].filter(([,entry])=>entry.intent.actorUid===auth.uid);while(own.length>=2)previews.delete(own.shift()[0]);
    while(previews.size>=8)previews.delete(previews.keys().next().value);
    previews.set(previewId,{intent:structuredClone(intent),binding:auth.binding,expiresAt});
    return ok({previewId,expiresAt:new Date(expiresAt).toISOString(),targetUid:intent.targetUid,academicYear:intent.academicYear,reason:intent.reason,changes:structuredClone(intent.changes),writeEnabled});
   }catch(error){
    const known={OWNER_REQUIRED:403,TARGET_ACCESS_INELIGIBLE:409,INVALID_LEADERSHIP_CHANGE:400,LEADERSHIP_OVERLAP:409};
    return known[error?.code]?fail(known[error.code],error.code,error.message):fail(503,'LEADERSHIP_UNAVAILABLE','The scope change could not be previewed. No permissions were changed.');
   }
  },
  async history(token,input={}){
   const auth=await authorize(token);if(auth.response)return auth.response;
   if(!closed(input,['targetUid','academicYear','offset'])||!UID.test(input.targetUid||'')||!yearValid(input.academicYear)||input.offset!==undefined&&(!Number.isSafeInteger(input.offset)||input.offset<0||input.offset%50))return fail(400,'INVALID_ACCESS_QUERY','Choose a target, academic year and valid page offset.');
   try{
    const result=await repository.history({actorUid:auth.uid,targetUid:input.targetUid,academicYear:input.academicYear,offset:input.offset||0});
    if(!Number.isSafeInteger(result?.total)||result.total<0||!Array.isArray(result.rows)||result.rows.length>50)throw Error('Invalid history result.');
    const changed=await recheck(token,auth);if(changed)return changed;
    return ok({total:result.total,rows:result.rows,academicYear:input.academicYear,offset:input.offset||0,pageSize:50});
   }catch(_){return fail(503,'LEADERSHIP_UNAVAILABLE','Teaching responsibility history could not be loaded.');}
  },
  async commit(token,input){
   const auth=await authorize(token);if(auth.response)return auth.response;
   if(!writeEnabled)return fail(503,'WRITE_DISABLED','Leadership access changes are disabled.');
   if(!closed(input,['previewId','operationId'])||!UUID.test(input.previewId||'')||!UUID.test(input.operationId||''))return fail(400,'INVALID_LEADERSHIP_CHANGE','Provide the exact preview and operation identifiers.');
   input={previewId:input.previewId.toLowerCase(),operationId:input.operationId.toLowerCase()};
   try{
    let receipt=await repository.operation(input.operationId,auth.uid),replayed=Boolean(receipt);
    if(receipt&&(receipt.actorUid!==auth.uid||receipt.previewId!==input.previewId))return fail(409,'LEADERSHIP_OPERATION_CONFLICT','This operation identifier belongs to another intent.');
    if(!receipt){
     prune();const preview=previews.get(input.previewId);
     if(!preview||preview.expiresAt<=clock())return fail(409,'LEADERSHIP_PREVIEW_EXPIRED','The preview expired. Refresh and preview again.');
     if(preview.intent.actorUid!==auth.uid||preview.binding!==auth.binding)return fail(403,'ACCESS_CHANGED','This preview belongs to another effective access context.');
     const changed=await recheck(token,auth);if(changed)return changed;
     receipt=await repository.commit({...structuredClone(preview.intent),previewId:input.previewId,operationId:input.operationId});
    }
    if(!receipt||receipt.actorUid!==auth.uid||receipt.previewId!==input.previewId||receipt.operationId!==input.operationId||!UID.test(receipt.targetUid||'')||!yearValid(receipt.academicYear)||!VERSION.test(receipt.savedAuthorityVersion||''))throw Error('Invalid persisted leadership receipt.');
    const changed=await recheck(token,auth);if(changed)return changed;
    const current=await repository.snapshot(receipt.targetUid,receipt.academicYear,auth.uid);
    if(!VERSION.test(current?.authorityVersion||''))throw Error('Readback unavailable.');
    const finalAccess=await recheck(token,auth);if(finalAccess)return finalAccess;
    return ok({operation:operationView(receipt),replayed,superseded:current.authorityVersion.toLowerCase()!==receipt.savedAuthorityVersion.toLowerCase()});
   }catch(error){
    const number=error.number||error.originalError?.info?.number;
    const known={54101:[403,'OWNER_REQUIRED','Your Owner authority changed.'],54102:[409,'TARGET_ACCESS_INELIGIBLE','Target access changed.'],54103:[409,'LEADERSHIP_STALE','Authority changed after preview. Refresh and preview again.'],54104:[409,'LEADERSHIP_SOURCE_CHANGED','Appointment or scope evidence changed.'],54105:[409,'LEADERSHIP_OVERLAP','The responsibility has an overlapping assignee.'],54106:[403,'PROTECTED_ACCOUNT','This account cannot receive a leadership grant.'],54107:[400,'INVALID_LEADERSHIP_CHANGE','The leadership change is invalid.'],54108:[409,'LEADERSHIP_OPERATION_CONFLICT','The operation identifier belongs to another intent.'],54109:[409,'LEADERSHIP_SOURCE_CHANGED','The exact managed assignee is no longer current.']};
    return known[number]?fail(...known[number]):{status:503,body:{error:{code:'LEADERSHIP_CONFIRMATION_REQUIRED',message:'The outcome could not be confirmed. Retry the same operation identifier before making another change.'},operationId:input.operationId}};
   }
  }
 });
}
module.exports={createLeadershipAccessApi};
