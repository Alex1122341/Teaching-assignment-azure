'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSqlDoeWorksheetRepository}=require('../src/data/sql-doe-worksheet-repository');
const {createSqlSessionRepository}=require('../src/data/sql-session-repository');

test('Worksheet carries separate MASTER clinical and potential graduate figures without changing target or total',async()=>{
 const calls=[];
 const db={async query(sql){calls.push(sql);
  if(sql.includes('FROM paws.Faculty AS f'))return [{facultyId:'f',displayName:'Example, Jane'}];
  if(sql.includes('FROM paws.DoeFacultyTarget'))return [{facultyId:'f',contractTeachingDoe:30,effectiveTargetDoe:15,contractClinicalTeachingDoe:0,potentialGradTeachingDoe:14.3,summarySourceReference:'DOE Simplified!C2,G2'}];
  return [];
 }};
 const source=await createSqlDoeWorksheetRepository(db).getFacultyWorksheetSource('f','2026-27');
 assert.equal(source.target.contractClinicalTeachingDoe,0);
 assert.equal(source.target.potentialGradTeachingDoe,14.3);
 assert.equal(source.target.effectiveTargetDoe,15);
 assert.equal(source.lines.length,0);
 assert.match(calls.find(s=>s.includes('FROM paws.DoeFacultyTarget')),/DoeFacultySummarySource/);
 assert.match(calls.find(s=>s.includes('FROM paws.DoeFacultyTarget')),/FULL OUTER JOIN paws\.DoeFacultySummarySource/);
});

test('Missing MASTER summary values stay null rather than being supplied by unrelated allocations',async()=>{
 const db={async query(sql){
  if(sql.includes('FROM paws.Faculty AS f'))return [{facultyId:'f'}];
  if(sql.includes('FROM paws.DoeFacultyTarget'))return [{facultyId:'f',contractTeachingDoe:20,effectiveTargetDoe:20}];
  return [];
 }};
 const source=await createSqlDoeWorksheetRepository(db).getFacultyWorksheetSource('f','2026-27');
 assert.equal(source.target.contractClinicalTeachingDoe,null);
 assert.equal(source.target.potentialGradTeachingDoe,null);
});

test('Calendar labels Sessional assignments from explicit source classification without replacing teaching identities',async()=>{
 let query;
 await createSqlSessionRepository({async query(sql){query=sql;return [];}}).list({academicYear:'2026-27'});
 assert.match(query,/paws\.SessionalAssignment/);
 assert.match(query,/Sessional/);
 assert.match(query,/ContributorLabel/);
 assert.match(query,/sn\.SessionAssignmentId/);
 assert.doesNotMatch(query,/UPDATE|INSERT|DELETE/);
});

test('Sessional name formatting precedes long and parenthesized labels and stays stable in the browser formatter',async()=>{
 const names=require('../src/domain/person-name');
 const subtype='Visiting librarian (UCVM) and information literacy instructor';
 const result=await createSqlSessionRepository({async query(){return [{instructorNames:'Rebecca Jackson',sessionalContributorsJson:JSON.stringify([{name:'Heather Ganshorn',label:subtype}])}];}}).list({academicYear:'2026-27'});
 assert.equal(result[0].instructorNames,`Jackson, Rebecca; Ganshorn, Heather (Sessional · ${subtype})`);
 assert.equal(names.formatList(result[0].instructorNames),result[0].instructorNames);
 assert.equal(Object.hasOwn(result[0],'sessionalContributorsJson'),false);
});

test('Sessional subtype never reparses placeholders or a single recorded name',async()=>{
 const names=require('../src/domain/person-name');
 const subtype='Visiting librarian (UCVM) and information literacy instructor';
 for(const person of ['TBD','Locum','Madonna']){
  const rows=await createSqlSessionRepository({async query(){return [{instructorNames:'',sessionalContributorsJson:JSON.stringify([{name:person,label:subtype}])}];}}).list({academicYear:'2026-27'});
  assert.equal(names.formatList(rows[0].instructorNames),`${person} (Sessional · ${subtype})`);
 }
});
