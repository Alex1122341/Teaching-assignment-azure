'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSqlFacultyAdminRepository}=require('../src/data/sql-faculty-admin-repository');

const fields={
 facultyId:'11111111-1111-4111-8111-111111111111',
 expectedUpdatedAtUtc:'2026-10-31T12:00:00.000Z',
 expectedProfileVersion:null,
 actorFirebaseUid:'sql-admin',
 preferredFirstName:'Early',preferredLastName:'Hire',
 displayName:'Early Hire',ucid:'uc-111',email:'hire@example.edu',
 recordType:'faculty',stream:'Clinical',rank:'Assistant Professor',
 fte:1,reportsToFacultyId:null,activationDate:'2027-06-01',
 professionalProfile:{
  teachingArea:'Anatomy',professionalCategory:null,serviceDate:null,priorYearsExperience:null,
  dvmEarnedDate:null,dvmType:null,mastersEarnedDate:null,mastersArea:null,
  phdEarnedDate:null,phdArea:null,boardCertifiedDate:null,boardCertification:null,
  boardCertificationCount:null,abvmaLicenseNumber:null,abvmaMemberType:null
 }
};
test('SQL create reuses exactly the approved profile fields and calls CreateFaculty',async()=>{
 const calls=[];
 const repo=createSqlFacultyAdminRepository({query:async(q,params)=>{
  calls.push({q,params});
  return [{facultyId:fields.facultyId,displayName:fields.displayName,activationDate:fields.activationDate,administrativeActive:true,active:false}];
 }});
 const value=await repo.createFaculty(fields);
 assert.equal(calls.length,1);
 assert.match(calls[0].q,/EXEC paws_api\.CreateFaculty/);
 assert.equal(Object.hasOwn(calls[0].params,'FacultyId'),false);
 assert.equal(Object.hasOwn(calls[0].params,'ExpectedUpdatedAtUtc'),false);
 assert.equal(Object.hasOwn(calls[0].params,'ExpectedProfileVersion'),false);
 assert.equal(calls[0].params.ActivationDate,'2027-06-01');
 assert.equal(value.active,false);
 assert.equal(value.administrativeActive,true);
});
test('editing appointment + date is serialized inside one SQL transaction',async()=>{
 const calls=[];
 const db={query:async(q,params)=>{
  calls.push([q,params]);
  if(q.includes('UpdateFaculty'))return[{updatedAtUtc:'2026-10-31T15:30:00.000Z',facultyId:fields.facultyId}];
  if(q.includes('SetFacultyActivation'))return[{facultyId:fields.facultyId,activationDate:'2027-06-01',administrativeActive:true,active:false}];
  throw Error('unexpected procedure');
 }, transaction:async action=>{calls.push(['BEGIN']);const result=await action();calls.push(['COMMIT']);return result;}};
 const value=await createSqlFacultyAdminRepository(db).updateFaculty(fields);
 assert.deepEqual(calls.map(c=>c[0].startsWith('EXEC')?c[0].split('paws_api.')[1].split('\n')[0]:c[0]),['BEGIN','UpdateFaculty','SetFacultyActivation','COMMIT']);
 assert.equal(calls[2][1].ExpectedUpdatedAtUtc,'2026-10-31T15:30:00.000Z');
 assert.equal(value.activationDate,'2027-06-01');
 assert.equal(value.active,false);
});
test('changing an effective date never falls back to nontransactional writes',async()=>{
 let calls=0;
 const repo=createSqlFacultyAdminRepository({query:async()=>{calls++;return [];}});
 await assert.rejects(()=>repo.updateFaculty(fields),/transaction/i);
 assert.equal(calls,0);
});
