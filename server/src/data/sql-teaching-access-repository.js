'use strict';

const {validDate}=require('../roles/role-effective-status');
const FIELDS=['assignmentId','responsibilityId','kind','facultyId','academicYear','active','startDate','endExclusive','version','definitionVersion'];
function validateContext({academicYear,asOfDate}={}){
 const year=/^([1-9]\d{3})-(\d{2})$/.exec(academicYear||'');
 if(!year||Number(year[2])!==(Number(year[1])+1)%100||!validDate(asOfDate))throw Error('Canonical year and Calgary date required.');
 return {academicYear,asOfDate};
}
function assignment(row){return {
 ...Object.fromEntries(FIELDS.map(key=>[key,row[key]])),
 courses:scopeRows(row.coursesJson,['courseId','courseCode']),groups:scopeRows(row.groupsJson,['groupId','name'])
};}

function scopeRows(value,fields){
 if(typeof value!=='string')throw Error('Missing canonical teaching scope.');
 const rows=JSON.parse(value);
 if(!Array.isArray(rows)||rows.length>200)throw Error('Invalid canonical teaching scope.');
 return rows.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Invalid scope row.');
  return Object.fromEntries(fields.map(key=>[key,row[key]]));
 });
}

function createSqlTeachingAccessRepository(db){
 if(typeof db?.query!=='function')throw TypeError('SQL query required.');
 return Object.freeze({
  async listAssignments(uid,{academicYear,asOfDate}={}){
   validateContext({academicYear,asOfDate});
   const rows=await db.query(`SELECT TOP (1001)
    assignmentId,responsibilityId,kind,facultyId,academicYear,active,
    startDate,endExclusive,version,definitionVersion,coursesJson,groupsJson
    FROM paws_api.EffectiveTeachingAssignments(@uid,@academicYear,@asOfDate)
    ORDER BY assignmentId`,{uid,academicYear,asOfDate});
   if(!Array.isArray(rows)||rows.length>1000)throw Error('Teaching authority exceeds its bounded contract.');
   return rows.map(assignment);
  },
  async snapshot(uid,context){
   const {academicYear,asOfDate}=validateContext(context);
   const rows=await db.query(`SELECT TOP (1001) state.authorityVersion,
    a.assignmentId,a.responsibilityId,a.kind,a.facultyId,a.academicYear,a.active,
    a.startDate,a.endExclusive,a.version,a.definitionVersion,a.coursesJson,a.groupsJson
    FROM paws_api.TeachingAuthorityState() state
    OUTER APPLY paws_api.EffectiveTeachingAssignments(@uid,@academicYear,@asOfDate) a
    ORDER BY a.assignmentId`,{uid,academicYear,asOfDate});
   if(!Array.isArray(rows)||!rows.length||rows.length>1000||!rows.every(row=>/^[a-f0-9]{16}$/i.test(row.authorityVersion||'')&&row.authorityVersion.toLowerCase()===rows[0].authorityVersion.toLowerCase()))throw Error('Teaching authority snapshot is unavailable or exceeds its bounded contract.');
   if(rows.some(row=>row.assignmentId==null)&&!(rows.length===1&&rows[0].assignmentId===null))throw Error('Teaching authority snapshot is inconsistent.');
   return {authorityVersion:rows[0].authorityVersion.toLowerCase(),assignments:rows[0].assignmentId===null?[]:rows.map(assignment)};
  }
 });
}

module.exports={createSqlTeachingAccessRepository};
