'use strict';

const assert = require('node:assert/strict');
const sql = require('../server/node_modules/mssql');

async function verifyRace() {
  const password = process.env.PAWS_SQL_TEST_PASSWORD || '';
  if (!/^Synthetic-[a-f0-9-]{36}!Aa1$/i.test(password)) throw Error('Disposable SQL credentials required.');
  const pool = await new sql.ConnectionPool({
    server: '127.0.0.1', port: 14339, database: 'VetMed-Ops', user: 'sa', password,
    options: { encrypt: true, trustServerCertificate: true }
  }).connect();
  try {
    const { recordset: [fixture] } = await pool.request().query(`
      DECLARE @faculty uniqueidentifier=(SELECT FacultyId FROM paws.UserProfile WHERE FirebaseUid=N'batchpdf-self'),
              @content varbinary(max)=0x255044462D616E6F74686572, @request uniqueidentifier=NEWID();
      DECLARE @hash varchar(64)=CONVERT(varchar(64),HASHBYTES('SHA2_256',@content),2);
      DECLARE @upload TABLE(responseJson nvarchar(max));
      INSERT @upload EXEC paws_api.UploadAfcForm N'batchpdf-owner',@faculty,@request,N'Alternative.pdf',@content,@hash,1;
      DECLARE @target uniqueidentifier=(SELECT AfcRecordId FROM paws.AfcManualRecord
                                         WHERE FacultyId=@faculty AND BatchRowNumber=0 AND Active=0);
      UPDATE paws.AfcManualRecord SET Active=1 WHERE AfcRecordId=@target;
      SELECT @target AS recordId, @faculty AS facultyId, JSON_VALUE(responseJson,'$.documentId') AS alternativeId,
             (SELECT DocumentId FROM paws.AfcFormDocument WHERE FacultyId=@faculty AND FileName=N'Vacation.pdf') AS originalId
      FROM @upload;
    `);
    assert.ok(fixture.recordId && fixture.originalId && fixture.alternativeId);
    const attach = (documentId, connection) => new sql.Request(connection)
      .input('record', sql.UniqueIdentifier, fixture.recordId)
      .input('faculty', sql.UniqueIdentifier, fixture.facultyId)
      .input('doc', sql.UniqueIdentifier, documentId)
      .query(`DECLARE @request uniqueidentifier=NEWID();
        EXEC paws_api.LinkAfcBatchRecordDocument N'batchpdf-owner',@record,@faculty,@doc,@request;`);

    // An open outer transaction deliberately keeps the first attachment locked while the two competitors enter.
    const first = pool.transaction();
    await first.begin();
    let contenders;
    try {
      const initial = await attach(fixture.originalId, first);
      assert.equal(initial.recordset[0].idempotentReplay, false);
      const { recordset: [session] } = await new sql.Request(first).query('SELECT @@SPID AS sessionId;');
      contenders = Promise.allSettled([attach(fixture.originalId, pool), attach(fixture.alternativeId, pool)]);
      const deadline = Date.now() + 10000;
      let waiterCount = 0;
      while (Date.now() < deadline && waiterCount === 0) {
        const { recordset: [locks] } = await pool.request().input('holder', sql.Int, session.sessionId).query(
          'SELECT COUNT(*) AS waiters FROM sys.dm_exec_requests WHERE blocking_session_id=@holder;'
        );
        waiterCount = locks.waiters;
        if (waiterCount === 0) await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert.ok(waiterCount > 0, 'A concurrent attachment should wait for the uncommitted record.');
      await first.commit();
    } catch (error) {
      await first.rollback().catch(() => {});
      if (contenders) await contenders;
      throw error;
    }
    const [same, different] = await contenders;
    assert.equal(same.status, 'fulfilled');
    assert.equal(same.value.recordset[0].idempotentReplay, true);
    assert.equal(different.status, 'rejected');
    assert.equal(different.reason.number, 57104);
    const { recordset: [saved] } = await pool.request().input('record', sql.UniqueIdentifier, fixture.recordId).query(`
      SELECT DocumentId AS documentId, (SELECT COUNT(*) FROM paws.AuditEvent
        WHERE EntityId=CONVERT(nvarchar(36),@record) AND EventType=N'afc_form_linked') AS audits
      FROM paws.AfcRecordDocument WHERE AfcRecordId=@record;`);
    assert.equal(saved.documentId.toLowerCase(), fixture.originalId.toLowerCase());
    assert.equal(saved.audits, 1);
    console.log('AFC_BATCH_RECORD_DOCUMENT_RACE_071_OK');
  } finally {
    await pool.close();
  }
}

verifyRace().catch(error => { console.error(error); process.exitCode = 1; });
