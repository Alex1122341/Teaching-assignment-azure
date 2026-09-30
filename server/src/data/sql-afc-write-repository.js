'use strict';

// B1: the only SQL business write in this module is the reviewed, hard-coded
// stored procedure. No caller-controlled SQL, table DML, or generic mutation
// helper belongs on the Dashboard path.

const CREATE_AFC_PROCEDURE = 'paws_api.CreateAfcRecord';

function createSqlAfcWriteRepository(db) {
  return {
    async createAfcRecord({
      afcRecordId,
      facultyId,
      startDate,
      endDate,
      reasonCode,
      notes = null,
      actorFirebaseUid,
      actorName = null,
      requestId
    } = {}) {
      const rows = await db.query(
        `EXEC ${CREATE_AFC_PROCEDURE}
          @AfcRecordId = @afcRecordId,
          @FacultyId = @facultyId,
          @StartDate = @startDate,
          @EndDate = @endDate,
          @ReasonCode = @reasonCode,
          @Notes = @notes,
          @ActorFirebaseUid = @actorFirebaseUid,
          @ActorName = @actorName,
          @RequestId = @requestId`,
        {
          afcRecordId,
          facultyId,
          startDate,
          endDate,
          reasonCode,
          notes,
          actorFirebaseUid,
          actorName,
          requestId
        }
      );
      return rows[0] || null;
    }
  };
}

module.exports = { createSqlAfcWriteRepository, CREATE_AFC_PROCEDURE };
