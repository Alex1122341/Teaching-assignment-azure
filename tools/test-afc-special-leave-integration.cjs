'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const sql = require('../server/node_modules/mssql');
const { createSqlConnection } = require('../server/src/data/sql-connection');
const { createSqlAfcWriteRepository } = require('../server/src/data/sql-afc-write-repository');
const { createSqlAfcSpecialLeaveRepository } = require('../server/src/data/sql-afc-special-leave-repository');
const { createSqlDashboardRepository } = require('../server/src/data/sql-dashboard-repository');
const { createDashboardApi } = require('../server/src/data/dashboard-api');

const password = process.env.PAWS_SQL_TEST_PASSWORD;
if (!/^Synthetic-[a-f0-9-]{36}!Aa1$/i.test(password || '')) throw Error('Disposable SQL credentials required.');
const connection = createSqlConnection({ sql, config: { server:'127.0.0.1', port:14339, database:'VetMed-Ops',
  user:'sa', password, options:{ encrypt:true, trustServerCertificate:true } } });
const query = (text,params) => connection.query(
  "EXECUTE AS USER=N'paws-calendar-test-runtime'; BEGIN TRY\n" + text +
  "\nREVERT; END TRY BEGIN CATCH REVERT; THROW; END CATCH;", params);
const db = { query, transaction: callback => connection.transaction(callback) };
const write = createSqlAfcWriteRepository(db);
const repo = createSqlDashboardRepository(db);
const leave = createSqlAfcSpecialLeaveRepository(db,write.createAfcRecord);
const facultyId = randomUUID(), actor = 'synthetic-afc-068-node';
const input = { facultyId, startDate:'2098-06-01', endDate:'2098-06-30', reasonCode:'special',
  notes:'Synthetic special leave', availability:'available', specialLeave:{fteDeduction:.25,
    allocationsByYear:{'2098-99':{teaching:15,service:5,research:5}}} };

(async () => {
  await connection.query(`
    DECLARE @batch uniqueidentifier=NEWID();
    INSERT staging.ImportBatch(ImportBatchId,StartedAtUtc,Status,SourceManifestSha256,ImporterVersion,ValidationSummaryJson)
      VALUES(@batch,SYSUTCDATETIME(),N'synthetic',REPLICATE('C',64),N'068-Node',N'{}');
    INSERT paws.Faculty(FacultyId,RecordType,DisplayName,Active,Fte,SourceImportBatchId)
      VALUES(@facultyId,N'faculty',N'Synthetic Leave Node',1,1,@batch);
    INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,Active,MustChangePassword)
      VALUES(@actor,N'node068@example.invalid',N'Synthetic Admin',N'owner',1,0);
    INSERT paws.DoeFacultyTarget(DoeFacultyTargetId,FacultyId,AcademicYear,ContractTeachingDoe)
      VALUES(NEWID(),@facultyId,N'2098-99',40);
    IF IS_ROLEMEMBER(N'paws_runtime_read',N'paws-calendar-test-runtime')<>1
      ALTER ROLE paws_runtime_read ADD MEMBER [paws-calendar-test-runtime];
    IF IS_ROLEMEMBER(N'paws_runtime_afc_single_write',N'paws-calendar-test-runtime')<>1
      ALTER ROLE paws_runtime_afc_single_write ADD MEMBER [paws-calendar-test-runtime];
    IF IS_ROLEMEMBER(N'paws_runtime_afc_edit_write',N'paws-calendar-test-runtime')<>1
      ALTER ROLE paws_runtime_afc_edit_write ADD MEMBER [paws-calendar-test-runtime];`,{facultyId,actor});
  const api = createDashboardApi({ verifyToken:async()=>({uid:actor}),
    findUser:async()=>({active:true,baseRole:'owner',displayName:'Synthetic Admin'}),
    repository:repo,writeRepository:{...write,...leave},writeGates:{afcSingle:true,afcEdit:true} });
  const result = await api.createAfcRecord('test',input);
  assert.equal(result.status,201,JSON.stringify(result.body));
  const id = result.body.afcRecord.afcRecordId;
  const [saved] = (await api.afcRecords('test')).body.afcRecords.filter(row=>row.afcRecordId===id);
  assert.equal(saved.specialLeave.confirmedYears['2098-99'],false);
  assert.equal((await api.afcSpecialLeaveOnDate('test',facultyId,'2098-06-15')).body.evaluation.effectiveFte,1);
  await connection.query(`
    DECLARE @policy uniqueidentifier=NEWID();
    INSERT paws.DoePolicyVersion(PolicyVersionId,AcademicYear,VersionLabel,SourceReference,Active,Status,Revision)
     VALUES(@policy,N'2098-99',N'Synthetic',N'Synthetic',0,N'draft',1);
    INSERT paws.DoeFacultyAllocation(DoeFacultyAllocationId,FacultyId,AcademicYear,CategoryCode,AllocationDoe,SourceReference,PolicyVersionId)
     VALUES(NEWID(),@facultyId,N'2098-99',N'service',30,N'Synthetic',@policy),
           (NEWID(),@facultyId,N'2098-99',N'research',30,N'Synthetic',@policy);`,{facultyId});
  assert.equal((await api.afcSpecialLeaveOnDate('test',facultyId,'2098-06-15')).body.evaluation.effectiveFte,1);
  const payload = {expectedVersion:saved.versionToken,specialLeave:input.specialLeave};
  const confirmed = await api.applyAfcSpecialLeave('test',id,payload);
  assert.equal(confirmed.status,200,JSON.stringify(confirmed.body));
  assert.equal((await api.applyAfcSpecialLeave('test',id,payload)).status,409);
  const current = (await api.afcSpecialLeaveOnDate('test',facultyId,'2098-06-15')).body.evaluation;
  assert.equal(current.effectiveFte,.75);
  assert.deepEqual(current.effectiveDoe,{teaching:25,service:25,research:25});
  assert.equal((await api.afcSpecialLeaveOnDate('test',facultyId,'2098-07-01')).body.evaluation.effectiveFte,1);
  console.log('AFC_SPECIAL_LEAVE_068_REAL_REPOSITORY_OK');
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>connection.close());
