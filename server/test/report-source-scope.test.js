'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createSqlSessionRepository}=require('../src/data/sql-session-repository');
test('report session reads bind academic year and retain undated records without changing existing range callers',async()=>{
 const calls=[],repository=createSqlSessionRepository({query:async(sql,params)=>{calls.push({sql,params});return [];}});
 await repository.list({academicYear:'2026-2027',includeAssignmentTargets:true});assert.match(calls[0].sql,/c\.AcademicYear\s*=\s*@academicYear/);assert.equal(calls[0].params.academicYear,'2026-27');assert.doesNotMatch(calls[0].sql,/c\.SessionDate >= @start/);assert.match(calls[0].sql,/AS assignmentsJson/);
 await assert.rejects(repository.list({academicYear:'2026-28'}),{code:'INVALID_ACADEMIC_YEAR'});assert.equal(calls.length,1);
 await repository.list({start:'2026-10-01',end:'2026-11-01'});assert.deepEqual(calls[1].params,{start:'2026-10-01',end:'2026-11-01'});assert.doesNotMatch(calls[1].sql,/c\.AcademicYear\s*=\s*@academicYear/);
});
