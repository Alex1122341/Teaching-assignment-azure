'use strict';
const {createHash}=require('node:crypto');
const {normalizeBaseRole,isSelfServiceRole}=require('../auth/role-policy');
const {effectivePeriods,validDate}=require('../roles/role-effective-status');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const UID=/^[A-Za-z0-9_.:@-]{1,128}$/,KEY=/^[a-z][a-z0-9_-]{0,63}$/;
const VERSION=/^[a-f0-9]{16}$/i,HASH=/^[a-f0-9]{64}$/i;
const invalid=(message,code='INVALID_LEADERSHIP_CHANGE')=>Object.assign(Error(message),{code});
const closed=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const nextDay=value=>new Date(Date.parse(value+'T00:00:00Z')+86400000).toISOString().slice(0,10);
function uniqueRows(rows,key,limit){
 if(!Array.isArray(rows)||rows.length>limit)throw invalid('A bounded authority snapshot is required.');
 const found=new Map();
 for(const row of rows){const id=row?.[key];if(typeof id!=='string'||found.has(id.toLowerCase()))throw invalid('Authority snapshot is ambiguous.');found.set(id.toLowerCase(),row);}
 return found;
}
function definitionScope(row){
 if(!row||!KEY.test(row.responsibilityId||'')||!['hicc','visc'].includes(row.kind)||row.active!==true||!HASH.test(row.definitionVersion||''))throw invalid('Choose an active versioned responsibility.');
 const courses=[],groups=[],seen=new Set(),source=row.kind==='hicc'?row.courses:row.groups;
 if(!Array.isArray(source)||!source.length||source.length>200)throw invalid('Canonical responsibility scope is missing.');
 for(const item of source){
  if(row.kind==='hicc'){
   if(!UUID.test(item?.courseId||'')||typeof item.courseCode!=='string'||!item.courseCode.trim()||item.courseCode.length>32||seen.has(item.courseId.toLowerCase()))throw invalid('Canonical course scope is invalid.');
   seen.add(item.courseId.toLowerCase());courses.push({courseId:item.courseId.toLowerCase(),courseCode:item.courseCode.trim()});
  }else{
   if(!KEY.test(item?.groupId||'')||typeof item.name!=='string'||!item.name.trim()||item.name.length>120||seen.has(item.groupId))throw invalid('Canonical area scope is invalid.');
   seen.add(item.groupId);groups.push({groupId:item.groupId,name:item.name.trim()});
  }
 }
 courses.sort((a,b)=>a.courseId.localeCompare(b.courseId));groups.sort((a,b)=>a.groupId.localeCompare(b.groupId));
 return {kind:row.kind,definitionVersion:row.definitionVersion.toLowerCase(),courses,groups};
}
function validateSource(source,definition,target,academicYear,change,window){
 const kind=typeof source?.roleType==='string'?source.roleType.trim().toUpperCase():'';
 if(!source||!UUID.test(source.sourceRoleAssignmentId||'')||!same(source.facultyId,target.facultyId)||source.academicYear!==academicYear||
  !(definition.kind==='hicc'?['HICC','COURSE COORDINATOR'].includes(kind):kind==='VISC')||
  !VERSION.test(source.version||'')||!HASH.test(source.signature||'')||typeof source.hasSchedule!=='boolean'||
  typeof source.recordedScope!=='string'||!source.recordedScope.trim()||source.recordedScope.length>1000)throw invalid('The appointment does not prove this person, year and responsibility.');
 if(source.courseId!=null&&(!UUID.test(source.courseId)||definition.kind!=='hicc'||definition.courses.length!==1||!same(source.courseId,definition.courses[0].courseId)))throw invalid('The appointment course does not match the explicit responsibility.');
 if(source.hasSchedule&&!VERSION.test(source.scheduleVersion||''))throw invalid('Appointment schedule version is unavailable.');
 if(!source.hasSchedule&&source.scheduleVersion!=null)throw invalid('Appointment schedule snapshot is inconsistent.');
 if(!source.hasSchedule&&[source.effectiveDate,source.expirationDate].some(value=>value!=null&&!validDate(value)))throw invalid('Legacy appointment dates require review.');
 if(change.usesApprovedDefaultDates){
  if(source.hasSchedule||source.effectiveDate!=null||source.expirationDate!=null||change.startDate!==window.start||nextDay(change.endDate)!==window.end)throw invalid('Default dates require an undated legacy appointment and the approved full-year window.');
 }else{
  const periods=effectivePeriods(source);
  if(!periods?.length||periods.some(p=>!p.startDate)||periods.length>12)throw invalid('Recorded appointment dates are required.');
  const ordered=periods.slice().sort((a,b)=>a.startDate.localeCompare(b.startDate));
  let covered=null;
  for(let index=0;index<ordered.length;index++){
   const period=ordered[index],previous=ordered[index-1];
   if(previous&&(!previous.endDate||period.startDate<=previous.endDate))throw invalid('Overlapping source periods require review.');
   if(covered===null){if(period.startDate<=change.startDate&&(!period.endDate||change.startDate<=period.endDate))covered=period.endDate||window.last;}
   else if(period.startDate<=nextDay(covered))covered=period.endDate||window.last;
  }
  if(!covered||covered<change.endDate)throw invalid('Requested dates exceed the recorded appointment or cross a gap.');
 }
 return {sourceRoleAssignmentId:source.sourceRoleAssignmentId.toLowerCase(),sourceVersion:source.version.toLowerCase(),
  sourceScheduleVersion:source.hasSchedule?source.scheduleVersion.toLowerCase():null,sourceSignature:source.signature.toLowerCase(),recordedScope:source.recordedScope.trim()};
}

// Trusted catalog/source/snapshot inputs come from SQL, never from browser form
// values. The SQL command independently rechecks them under its transaction.
function buildLeadershipGrantIntent({actor,target,academicYear,authorityVersion,changes,catalog,sources,assignments,reason}={}){
 if(normalizeBaseRole(actor?.baseRole)!=='adfa_general'||actor.active!==true||actor.mustChangePassword!==false||!VERSION.test(actor.version||'')||!UID.test(actor.firebaseUid||''))throw invalid('A ready versioned Owner is required.','OWNER_REQUIRED');
 if(!isSelfServiceRole(target?.baseRole)||target.active!==true||target.mustChangePassword!==false||target.facultyActive!==true||!UUID.test(target.facultyId||'')||!VERSION.test(target.version||'')||!UID.test(target.firebaseUid||''))throw invalid('A ready faculty-facing target is required.','TARGET_ACCESS_INELIGIBLE');
 const year=/^([1-9]\d{3})-(\d{2})$/.exec(academicYear||'');
 if(!year||Number(year[2])!==(Number(year[1])+1)%100||!VERSION.test(authorityVersion||'')||typeof reason!=='string'||!reason.trim()||reason.trim().length>1000)throw invalid('Provide the exact year, authority version and reason.');
 const window={start:year[1]+'-05-01',end:String(Number(year[1])+1)+'-05-01',last:String(Number(year[1])+1)+'-04-30'};
 if(!Array.isArray(changes)||!changes.length||changes.length>20)throw invalid('Choose between one and twenty explicit scope changes.');
 const definitions=uniqueRows(catalog,'responsibilityId',1000),appointments=uniqueRows(sources,'sourceRoleAssignmentId',1000),existing=uniqueRows(assignments,'assignmentId',1000);
 const normalized=[],revoked=new Set(),granted=new Set();
 for(const change of changes.filter(row=>row?.action==='revoke')){
  if(!closed(change,['action','assignmentId','expectedVersion'])||!UUID.test(change.assignmentId||'')||!VERSION.test(change.expectedVersion||'')||revoked.has(change.assignmentId.toLowerCase()))throw invalid('Choose an exact assignee/version to revoke.');
  const row=existing.get(change.assignmentId.toLowerCase());
  if(!row||row.managed!==true||!same(row.facultyId,target.facultyId)||row.academicYear!==academicYear||!same(row.version,change.expectedVersion)||!KEY.test(row.responsibilityId||''))throw invalid('Only this person’s managed assignee in the selected year can be revoked.');
  revoked.add(change.assignmentId.toLowerCase());normalized.push({action:'revoke',assignmentId:change.assignmentId.toLowerCase(),expectedVersion:change.expectedVersion.toLowerCase(),responsibilityId:row.responsibilityId});
 }
 for(const change of changes.filter(row=>row?.action==='grant')){
  if(!closed(change,['action','responsibilityId','sourceRoleAssignmentId','startDate','endDate','usesApprovedDefaultDates'])||!KEY.test(change.responsibilityId||'')||!UUID.test(change.sourceRoleAssignmentId||'')||typeof change.usesApprovedDefaultDates!=='boolean'||!validDate(change.startDate)||!validDate(change.endDate)||change.startDate>change.endDate||change.startDate<window.start||change.endDate>=window.end||granted.has(change.responsibilityId))throw invalid('Provide an explicit responsibility, source and valid bounded dates.');
  granted.add(change.responsibilityId);
  const definition=definitionScope(definitions.get(change.responsibilityId)),source=validateSource(appointments.get(change.sourceRoleAssignmentId.toLowerCase()),definition,target,academicYear,change,window),endExclusive=nextDay(change.endDate);
  for(const row of assignments){
   if(row.responsibilityId!==change.responsibilityId||row.academicYear!==academicYear||revoked.has(row.assignmentId.toLowerCase()))continue;
   if(!validDate(row.startDate)||!validDate(row.endExclusive)||row.startDate>=row.endExclusive)throw invalid('Existing assignee dates require review.');
   if(row.startDate<endExclusive&&change.startDate<row.endExclusive)throw invalid('This responsibility already has an overlapping assignee.','LEADERSHIP_OVERLAP');
  }
  normalized.push({action:'grant',responsibilityId:change.responsibilityId,...definition,...source,startDate:change.startDate,endExclusive,usesApprovedDefaultDates:change.usesApprovedDefaultDates,assignmentMode:'exclusive'});
 }
 if(normalized.length!==changes.length)throw invalid('Only explicit grant and revoke actions are supported.');
 normalized.sort((a,b)=>(a.action==='revoke'?0:1)-(b.action==='revoke'?0:1)||a.responsibilityId.localeCompare(b.responsibilityId)||(a.assignmentId||'').localeCompare(b.assignmentId||''));
 const intent={actorUid:actor.firebaseUid,actorVersion:actor.version.toLowerCase(),targetUid:target.firebaseUid,targetVersion:target.version.toLowerCase(),facultyId:target.facultyId.toLowerCase(),academicYear,authorityVersion:authorityVersion.toLowerCase(),changes:normalized,reason:reason.trim()};
 return {...intent,intentHash:createHash('sha256').update(JSON.stringify(intent)).digest('hex')};
}
module.exports={buildLeadershipGrantIntent};
