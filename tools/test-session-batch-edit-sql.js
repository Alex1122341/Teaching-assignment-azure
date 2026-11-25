'use strict';
// Independent QA only, not a shipped runtime asset.
// This runner cannot select an external SQL endpoint or use production data.
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const sql=require('../server/node_modules/mssql');
const {createSqlConnection}=require('../server/src/data/sql-connection');
const {createSqlSessionRepository}=require('../server/src/data/sql-session-repository');
const actor='batch171-synthetic-actor';
const ids=['11111111-2222-4333-8444-555555555555','22222222-3333-4444-8555-666666666666'];
const people=['33333333-4444-4555-8666-777777777777','44444444-5555-4666-8777-888888888888'];
const marker=process.env.PAWS_BATCH_TEST_MARKER;
const saPassword=process.env.PAWS_SQL_TEST_PASSWORD;
if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(marker||'')||!saPassword)throw Error('Synthetic QA environment is required.');
function connection(user,password){
 return createSqlConnection({sql,requestTimeoutMs:45000,config:{
  server:'127.0.0.1',port:14337,database:'VetMed-Ops',user,password,
  options:{encrypt:true,trustServerCertificate:true},pool:{max:2,min:0}
 }});
}
const admin=connection('sa',saPassword);
let db1,db2,stage='marker';
const sqlNumber=error=>Number(error?.number??error?.originalError?.info?.number);
async function main(){
 // Confirm the runner-generated marker before any seed or principal operations.
 const rows=await admin.query("SELECT CONVERT(varchar(36),Marker) AS marker FROM dbo.Batch171DisposableMarker WHERE Marker=@marker",{marker});
 assert.equal(rows.length,1);assert.equal(rows[0].marker.toLowerCase(),marker.toLowerCase());
 stage='fixture-and-runtime-role';
 const password=randomBytes(24).toString('hex')+'!Aa1';
 // Exact grants are fixture-only. University service identity and its actual
 // effective grants remain separate release acceptance requirements.
 await admin.query("CREATE LOGIN batch171_runtime WITH PASSWORD='"+password+"';");
 await admin.query(`
 CREATE USER batch171_runtime FOR LOGIN batch171_runtime;
 ALTER ROLE paws_runtime_read ADD MEMBER batch171_runtime;
 ALTER ROLE paws_runtime_session_edit_write ADD MEMBER batch171_runtime;
 GRANT SELECT ON OBJECT::paws.SessionAssignment(SourceFacultyName) TO batch171_runtime;
 GRANT EXECUTE ON OBJECT::paws_api.ReplaceCalendarSessionAssignments TO batch171_runtime;
 DECLARE @Batch uniqueidentifier=NEWID(),@Course uniqueidentifier=NEWID();
 INSERT staging.ImportBatch(ImportBatchId,StartedAtUtc,Status,SourceManifestSha256,ImporterVersion,ValidationSummaryJson)
 VALUES(@Batch,SYSUTCDATETIME(),N'synthetic',REPLICATE('D',64),N'batch171-test',N'{}');
 INSERT paws.Faculty(FacultyId,RecordType,DisplayName,Active,SourceImportBatchId)
 VALUES(@f1,N'faculty',N'Synthetic Alpha',1,@Batch),(@f2,N'faculty',N'Synthetic Beta',1,@Batch);
 INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,Active,MustChangePassword)
 VALUES(@actor,N'batch171@example.test',N'Synthetic ADFAD',N'adfa_regular',1,0);
 INSERT paws.Course(CourseId,CourseCode,CourseName,SourceImportBatchId)
 VALUES(@Course,N'BATCH171',N'Synthetic course',@Batch);
 INSERT paws.Session(SessionId,AcademicYear,CurriculumYear,CourseId,CourseCode,CourseName,Topic,SessionType,SessionDate,StartTime,EndTime,Room,SourceImportBatchId)
 VALUES(@s1,N'2026-27',N'2',@Course,N'BATCH171',N'Synthetic course',N'Original A',N'LEC','2026-11-25','09:00','10:00',N'Room A',@Batch),
 (@s2,N'2026-27',N'2',@Course,N'BATCH171',N'Synthetic course',N'Original B',N'LEC','2026-11-25','10:00','11:00',N'Room B',@Batch);
 INSERT paws.SessionAssignment(SessionAssignmentId,SessionId,FacultyId,FacultyResolutionStatus,TeachingRole,SourceImportBatchId,SourceRow)
 VALUES(NEWID(),@s1,@f1,N'resolved',N'Lecture',@Batch,1), (NEWID(),@s2,@f1,N'resolved',N'Lecture',@Batch,2);
 `,{actor,s1:ids[0],s2:ids[1],f1:people[0],f2:people[1]});
 db1=connection('batch171_runtime',password);db2=connection('batch171_runtime',password);
 stage='least-privilege';
 const privileges=(await db1.query("SELECT IS_ROLEMEMBER('db_owner') AS owner, HAS_PERMS_BY_NAME('paws.Session','OBJECT','UPDATE') AS directUpdate, HAS_PERMS_BY_NAME('paws.SessionAssignment','OBJECT','DELETE') AS directDelete"))[0];
 assert.equal(privileges.owner,0);assert.equal(privileges.directUpdate,0);assert.equal(privileges.directDelete,0);
 const repo=createSqlSessionRepository(db1),other=createSqlSessionRepository(db2);
 const read=async(id,repository=repo)=>{
  const rows=await repository.list({sessionId:id,includeAssignmentTargets:true,includeBatchEditToken:true});
  assert.equal(rows.length,1);assert.match(rows[0].batchEditToken,/^[A-F0-9]{64}$/);return rows[0];
 };
 const audit=async()=>Number((await admin.query("SELECT COUNT(*) AS total FROM paws.AuditEvent WHERE ActorFirebaseUid=@actor AND EventType IN (N'session_updated',N'session_assignments_replaced')",{actor}))[0].total);
 stage='initial-snapshot';
 const original=[await read(ids[0]),await read(ids[1])];
 const edit=(row,patch,assignments)=>({sessionId:String(row.id).toLowerCase(),expectedToken:row.batchEditToken,patch,...(assignments===undefined?{}:{assignments})});
 const write=(edits,repository=repo)=>repository.updateBatch({edits,actorFirebaseUid:actor,actorName:'Synthetic ADFAD'});
 assert.equal(await audit(),0);
 stage='rollback';
 // Second row is syntactically valid but fails in the real SQL procedure
 // after the first row has executed. Neither data nor audit may commit.
 await assert.rejects(write([edit(original[0],{room:'Rollback A'}),edit(original[1],{courseCode:'BATCH171_MISSING'})]),error=>sqlNumber(error)===51243);
 assert.equal((await read(ids[0])).room,'Room A');assert.equal((await read(ids[1])).topic,'Original B');assert.equal(await audit(),0);
 console.log('BATCH171_REAL_SQL_ROLLBACK_AND_AUDIT_OK');
 stage='commit';
 const assignments=[{facultyId:people[0],teachingRole:'Lecture'},{facultyId:people[1],teachingRole:'Lecture'}];
 await write([edit(original[0],{topic:'Committed A'},assignments),edit(original[1],{topic:'Committed B'})]);
 const committed=[await read(ids[0]),await read(ids[1])];
 assert.equal(committed[0].topic,'Committed A');assert.equal(committed[1].topic,'Committed B');
 assert.deepEqual(JSON.parse(committed[0].assignmentsJson).map(a=>String(a.facultyId).toLowerCase()).sort(),[...people].sort());assert.equal(await audit(),3);
 console.log('BATCH171_REAL_SQL_COMMIT_AND_ASSIGNMENT_OK');
 stage='stale';
 await assert.rejects(write([edit(committed[0],{room:'Must not change'}),edit(original[1],{room:'Stale'})]),error=>error.batchCode==='SESSION_BATCH_STALE');
 assert.equal((await read(ids[0])).room,'Room A');assert.equal(await audit(),3);
 console.log('BATCH171_REAL_SQL_STALE_BATCH_OK');
 stage='concurrent';
 // Two independent SQL connections use the same reviewed snapshot. The loser
 // must be rejected as stale or by SQL Server's deadlock detector.
 const competing=await read(ids[0],other);
 assert.equal(competing.batchEditToken,committed[0].batchEditToken);
 const race=await Promise.allSettled([write([edit(committed[0],{room:'Race A'})]),write([edit(competing,{room:'Race B'})],other)]);
 const winners=race.filter(r=>r.status==='fulfilled');const losers=race.filter(r=>r.status==='rejected');
 assert.equal(winners.length,1);assert.equal(losers.length,1);
 const failure=losers[0].reason;
 assert.ok(failure.batchCode==='SESSION_BATCH_STALE'||sqlNumber(failure)===1205,'Concurrent rejection must be a stale snapshot or SQL deadlock victim.');
 const final=await read(ids[0]);assert.ok(['Race A','Race B'].includes(final.room));assert.equal(await audit(),4);
 console.log('BATCH171_REAL_SQL_CONCURRENT_WRITE_OK');
 console.log('BATCH171_REAL_SQL_ACCEPTANCE_OK (scoped synthetic schema; University Staging and Firebase not covered)');
}
main().catch(error=>{
 // Report the failed phase and error code without dumping credentials or SQL.
 console.error('BATCH171_REAL_SQL_ACCEPTANCE_FAILED',stage,error?.batchCode||error?.code||error?.number||error?.name||'');
 if(error?.code==='ERR_ASSERTION')console.error(error.message);
 process.exitCode=1;
}).finally(async()=>{await Promise.allSettled([db1?.close(),db2?.close(),admin.close()]);});
