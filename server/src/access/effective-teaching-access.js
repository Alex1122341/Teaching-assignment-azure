'use strict';

const {createHash}=require('node:crypto');
const {normalizeBaseRole,isSelfServiceRole}=require('../auth/role-policy');
const {validDate}=require('../roles/role-effective-status');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const KEY=/^[a-z][a-z0-9_-]{0,63}$/;
const ROW_VERSION=/^[a-f0-9]{16}$/i;
const SCOPE_VERSION=/^[a-f0-9]{64}$/i;
const text=value=>typeof value==='string'?value.trim():'';
const sameId=(a,b)=>UUID.test(a||'')&&UUID.test(b||'')&&a.toLowerCase()===b.toLowerCase();
const byKey=key=>(a,b)=>a[key].localeCompare(b[key],'en');

function yearWindow(value){
 const match=/^([1-9]\d{3})-(\d{2})$/.exec(value||'');
 if(!match||Number(match[2])!==(Number(match[1])+1)%100)throw Error('A canonical academic year is required.');
 return {start:match[1]+'-05-01',end:String(Number(match[1])+1)+'-05-01'};
}

function courseScope(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>200)return null;
 const seen=new Set(),scope=[];
 for(const row of rows){
  const code=text(row?.courseCode);
  if(!UUID.test(row?.courseId||'')||!code||code.length>32)return null;
  const id=row.courseId.toLowerCase();if(seen.has(id))return null;seen.add(id);
  scope.push({courseId:id,courseCode:code});
 }
 return scope.sort(byKey('courseId'));
}

function groupScope(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>200)return null;
 const seen=new Set(),scope=[];
 for(const row of rows){
  const name=text(row?.name);
  if(!KEY.test(row?.groupId||'')||!name||name.length>120||seen.has(row.groupId))return null;
  seen.add(row.groupId);scope.push({groupId:row.groupId,name});
 }
 return scope.sort(byKey('groupId'));
}

// Only trusted SQL responsibility/assignee rows belong here. Business appointment
// labels, client-selected roles and collaboration membership are not grant inputs.
function deriveEffectiveTeachingAccess({profile,assignments,academicYear,asOfDate,authorityVersion}={}){
 const window=yearWindow(academicYear);
 if(!validDate(asOfDate))throw Error('A valid Calgary calendar date is required.');
 if(!ROW_VERSION.test(authorityVersion||''))throw Error('A retained teaching authority epoch is required.');
 if(!Array.isArray(assignments)||assignments.length>1000)throw Error('A bounded trusted responsibility list is required.');
 const baseRole=normalizeBaseRole(profile?.baseRole);
 const ready=Boolean(baseRole&&profile?.active===true&&profile?.mustChangePassword!==true);
 const eligible=ready&&isSelfServiceRole(baseRole)&&UUID.test(profile?.facultyId||'')&&profile?.facultyActive===true;
 const responsibilities=[],versions=[],seen=new Set();
 if(eligible&&window.start<=asOfDate&&asOfDate<window.end){
  for(const row of assignments){
   if(!row||!UUID.test(row.assignmentId||'')||!KEY.test(row.responsibilityId||'')||!['hicc','visc'].includes(row.kind)||
      !sameId(row.facultyId,profile.facultyId)||row.academicYear!==academicYear||row.active!==true||
      !validDate(row.startDate)||!validDate(row.endExclusive)||row.startDate>=row.endExclusive||
      row.startDate>asOfDate||asOfDate>=row.endExclusive||!ROW_VERSION.test(row.version||'')||!SCOPE_VERSION.test(row.definitionVersion||''))continue;
   const courses=row.kind==='hicc'?courseScope(row.courses):[];
   const groups=row.kind==='visc'?groupScope(row.groups):[];
   if(!courses||!groups)continue;
   const id=row.assignmentId.toLowerCase();
   if(seen.has(id))throw Error('Duplicate trusted responsibility assignment.');
   seen.add(id);
   const endDate=new Date(Date.parse(row.endExclusive+'T00:00:00Z')-86400000).toISOString().slice(0,10);
   const descriptor={assignmentId:id,responsibilityId:row.responsibilityId,kind:row.kind,academicYear,startDate:row.startDate,endDate,courses,groups};
   responsibilities.push(descriptor);
   versions.push({id,version:row.version.toLowerCase(),definitionVersion:row.definitionVersion.toLowerCase(),descriptor});
  }
 }
 responsibilities.sort(byKey('assignmentId'));versions.sort(byKey('id'));
 const effectiveRoles=ready?[...new Set([baseRole,...responsibilities.map(row=>row.kind)])]:[];
 effectiveRoles.sort((a,b)=>a===baseRole?-1:b===baseRole?1:a.localeCompare(b,'en'));
 const scopeVersion=createHash('sha256').update(JSON.stringify({
  baseRole,ready,facultyId:profile?.facultyId?.toLowerCase()||null,profileVersion:profile?.version||null,academicYear,authorityVersion:authorityVersion.toLowerCase(),versions
 })).digest('hex');
 return {baseRole,academicYear,effectiveRoles,responsibilities,scopeVersion};
}

function canUseTeachingResponsibility(access,request){
 if(!request||!['hicc','visc'].includes(request.kind)||access?.academicYear!==request.academicYear||!KEY.test(request.responsibilityId||''))return false;
 return Array.isArray(access.responsibilities)&&access.responsibilities.some(row=>
  row.kind===request.kind&&row.responsibilityId===request.responsibilityId&&row.academicYear===request.academicYear&&
  (request.kind==='hicc'
   ?row.courses.some(course=>sameId(course.courseId,request.courseId))
   :KEY.test(request.groupId||'')&&row.groups.some(group=>group.groupId===request.groupId))
 );
}

module.exports={deriveEffectiveTeachingAccess,canUseTeachingResponsibility};
