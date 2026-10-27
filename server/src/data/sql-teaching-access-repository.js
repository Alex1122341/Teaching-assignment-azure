'use strict';

const {validDate}=require('../roles/role-effective-status');
const FIELDS=['assignmentId','responsibilityId','kind','facultyId','academicYear','active','startDate','endExclusive','version','definitionVersion'];

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
   const year=/^([1-9]\d{3})-(\d{2})$/.exec(academicYear||'');
   if(!year||Number(year[2])!==(Number(year[1])+1)%100||!validDate(asOfDate))throw Error('Canonical year and Calgary date required.');
   const rows=await db.query(`SELECT TOP (1001)
    assignmentId,responsibilityId,kind,facultyId,academicYear,active,
    startDate,endExclusive,version,definitionVersion,coursesJson,groupsJson
    FROM paws_api.EffectiveTeachingAssignments(@uid,@academicYear,@asOfDate)
    ORDER BY assignmentId`,{uid,academicYear,asOfDate});
   if(!Array.isArray(rows)||rows.length>1000)throw Error('Teaching authority exceeds its bounded contract.');
   return rows.map(row=>({
    ...Object.fromEntries(FIELDS.map(key=>[key,row[key]])),
    courses:scopeRows(row.coursesJson,['courseId','courseCode']),
    groups:scopeRows(row.groupsJson,['groupId','name'])
   }));
  }
 });
}

module.exports={createSqlTeachingAccessRepository};
