'use strict';
const {isAdministratorRole,isSelfServiceRole,normalizeBaseRole}=require('../auth/role-policy');
const {UUID,validDate}=require('./faculty-availability-window');
const {createAvailabilityCoordination}=require('./faculty-availability-coordination');
const fail=(status,code,message)=>({status,body:{error:{code,message}}});
function createFacultyAvailabilityApi({verifyToken,findUser,repository,clock,randomId}={}){
 if(!verifyToken||!findUser||!repository)throw Error('Availability dependencies required.');
 async function authorize(token){
  const unauthenticated=()=>({response:fail(401,'UNAUTHENTICATED','Sign in to check availability.')});
  if(!token)return unauthenticated();
  let decoded;try{decoded=await verifyToken(token);}catch(_){return unauthenticated();}
  if(typeof decoded?.uid!=='string'||!decoded.uid||decoded.uid.length>128)return unauthenticated();
  let profile;try{profile=await findUser(decoded.uid);}catch(_){return {response:fail(503,'SERVICE_UNAVAILABLE','Profile verification unavailable.')};}
  const role=normalizeBaseRole(profile?.baseRole||profile?.role),admin=isAdministratorRole(role);
  if(!profile?.active||profile?.mustChangePassword||(!admin&&!isSelfServiceRole(role))){
   return {response:fail(403,'ROLE_DENIED','Availability is not authorized.')};
  }
  return {uid:decoded.uid,role,admin,facultyId:String(profile.facultyId||'').toLowerCase()};
 }
 return Object.freeze({
  ...createAvailabilityCoordination({authorize,repository,clock,randomId}),
  async list(token,facultyId,query={}){
   const auth=await authorize(token);
   if(auth.response)return auth.response;
   if(!UUID.test(facultyId))return fail(400,'INVALID_FACULTY','Select a valid faculty.');
   if(!auth.admin&&auth.facultyId!==facultyId.toLowerCase())return fail(403,'ROLE_DENIED','Only your own availability can be viewed.');
   const keys=['mode','startDate','endDate','kind','cursor','limit'];
   if(!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).some(k=>!keys.includes(k)))return fail(400,'INVALID_QUERY','Invalid availability filters.');
   const mode=query.mode||'upcoming',start=query.startDate||null,end=query.endDate||null,kind=query.kind||'all';
   const cursor=Number(query.cursor??0),limit=Number(query.limit??50);
   if(!['upcoming','from','range'].includes(mode)||!['all','teaching','work','afc','pending','role'].includes(kind)
      ||(mode==='upcoming'&&(start||end))||(mode==='from'&&(!start||end))||(mode==='range'&&(!start||!end||start>end))
      ||(start&&!validDate(start))||(end&&!validDate(end))
      ||!Number.isSafeInteger(cursor)||cursor<0||cursor>100000||!Number.isSafeInteger(limit)||limit<1||limit>100)
     return fail(400,'INVALID_QUERY','Choose a valid date range.');
   try{
    const value=await repository.list({actorFirebaseUid:auth.uid,facultyId,mode,startDate:start,endDate:end,kind,cursor,limit});
    if(!value||!Array.isArray(value.items)||!Number.isInteger(value.total)||value.total<value.items.length||value.items.length>limit)
      throw Error('Invalid availability response.');
    if(!value.coverage||!['undatedSessions','undatedRoles'].every(k=>Number.isInteger(value.coverage[k])&&value.coverage[k]>=0)
      ||(value.nextCursor!==null&&(!/^\d+$/.test(value.nextCursor)||Number(value.nextCursor)<=cursor)))throw Error('Incomplete availability coverage.');
    const fields=['eventKey','kind','label','startDate','endDate','startTime','endTime','availability','timeStatus','courseCode','sessionId','detail'];
    const items=value.items.map(row=>{
     if(!row||typeof row.eventKey!=='string'||typeof row.label!=='string')throw Error('Invalid availability item.');
     const clean=Object.fromEntries(fields.map(k=>[k,row[k]??null]));
     clean.timeEvidence=Array.isArray(row.timeEvidence)?row.timeEvidence.map(t=>({date:t.date,startTime:t.startTime,endTime:t.endTime})):[];
     return clean;
    });
    return {status:200,body:{items,total:value.total,nextCursor:value.nextCursor,today:value.today,coverage:{undatedSessions:value.coverage.undatedSessions,undatedRoles:value.coverage.undatedRoles},facultyId,mode}};
   }catch(error){
    const number=Number(error?.number??error?.originalError?.info?.number);
    if(number===55603)return fail(403,'ROLE_DENIED','Availability is not authorized.');
    if(number===55604)return fail(404,'FACULTY_NOT_FOUND','Faculty is not found.');
    if(number===55601)return fail(400,'INVALID_QUERY','Choose a valid date range.');
    return fail(503,'SERVICE_UNAVAILABLE','Availability cannot be verified. Try again.');
   }
  }
 });
}
module.exports={createFacultyAvailabilityApi,validDate};
