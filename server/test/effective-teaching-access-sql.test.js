'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../../database/azure-sql/061_effective_teaching_access.sql');
test('leadership schema refuses unknown deployments before any DDL and does not seed real grants',()=>{
 const sql=fs.readFileSync(file,'utf8'),begin=sql.indexOf('BEGIN TRANSACTION;');
 assert.ok(begin>0);assert.ok(sql.indexOf("DB_NAME()<>N'VetMed-Ops'")<begin);
 assert.ok(sql.indexOf('refuses existing or unknown leadership deployment')<begin);
 assert.ok(sql.indexOf('refuses pre-existing authority version columns')<begin);
 assert.doesNotMatch(sql,/timothy|olchowy|adfa@|INSERT\s+(?:INTO\s+)?paws\.(?:UserProfile|TeachingResponsibilityAssignee)\b/i);
 assert.doesNotMatch(sql,/UPDATE\s+paws\.(?:Faculty|RoleAssignment|AfcRecord|Session|UserProfile)\s+SET/i);
});
test('read contract versions canonical mappings and requires explicit source approval for additional roles',()=>{
 const sql=fs.readFileSync(file,'utf8');
 assert.match(sql,/CREATE FUNCTION paws_api\.EffectiveTeachingAssignments/);
 assert.match(sql,/CREATE FUNCTION paws_api\.TeachingAppointmentAccessSourceStamp/);
 assert.match(sql,/TeachingLeadershipGrantSource/);
 assert.match(sql,/ApprovedSourceSignature/);
 assert.match(sql,/LOWER\(LTRIM\(RTRIM\(u\.BaseRole\)\)\)=r\.Kind/);
 assert.match(sql,/state\.Enabled=1/);
 assert.match(sql,/scope\.CourseId/);assert.match(sql,/LeaderViscResponsibilityId/);
 assert.match(sql,/a\.ActiveDate<=@AsOfDate AND @AsOfDate<a\.ExpirationDate/);
 assert.doesNotMatch(sql,/\bUcid\b|\bFte\b|\bRank\b|\bDoe\b/i);
});
