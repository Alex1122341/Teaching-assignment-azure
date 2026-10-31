'use strict';

const SUBMIT_PROCEDURE = 'paws_api.SubmitAfcRequest';
const WITHDRAW_PROCEDURE = 'paws_api.WithdrawAfcRequest';
const DATE_CHANGE_PROCEDURE = 'paws_api.SubmitAfcDateChange';
const OFFICE_DATES_PROCEDURE = 'paws_api.UpdateAfcDates';

function createSqlAfcRequestRepository(db) {
  return {
    async listRequests({ actorFirebaseUid, administrator = false } = {}) {
      return db.query(
        `SELECT
           ar.AfcRequestId AS afcRequestId,
           ar.FacultyId AS facultyId,
           ar.FacultyName AS facultyName,
           ar.RequesterFirebaseUid AS requesterFirebaseUid,
           ar.ReportToFirebaseUid AS reportToFirebaseUid,
           ar.Status AS status,
           CONVERT(varchar(10), ar.StartDate, 23) AS startDate,
           CONVERT(varchar(10), ar.EndDate, 23) AS endDate,
           ar.WorkDays AS workDays,
           ar.Reason AS reason,
           ar.PurposeDestination AS purposeDestination,
           ar.Coverage AS coverage,
           ar.SubmittedAtUtc AS submittedAtUtc,
           ar.UpdatedAtUtc AS updatedAtUtc,
           ar.ReplacesAfcRequestId AS replacesAfcRequestId,
           ar.SupersededByAfcRequestId AS supersededByAfcRequestId,
           CONVERT(varchar(16), ar.AfcVersion, 2) AS versionToken
         FROM paws.AfcRequest AS ar
         WHERE @administrator = 1
            OR ar.RequesterFirebaseUid = @actorFirebaseUid
            OR ar.ReportToFirebaseUid = @actorFirebaseUid
         ORDER BY ar.SubmittedAtUtc DESC, ar.AfcRequestId`,
        { actorFirebaseUid, administrator: administrator ? 1 : 0 }
      );
    },

    async submitRequest(input = {}) {
      const rows = await db.query(
        `EXEC ${SUBMIT_PROCEDURE}
          @AfcRequestId = @afcRequestId,
          @StartDate = @startDate,
          @EndDate = @endDate,
          @WorkDays = @workDays,
          @Reason = @reason,
          @PurposeDestination = @purposeDestination,
          @Coverage = @coverage,
          @ContactAddress = @contactAddress,
          @ContactPhone = @contactPhone,
          @TermsVersion = @termsVersion,
          @TermsSource = @termsSource,
          @SignatureMode = @signatureMode,
          @SignatureName = @signatureName,
          @SignatureSignedAt = @signatureSignedAt,
          @SignatureFingerprint = @signatureFingerprint,
          @SignatureImageDataUrl = @signatureImageDataUrl,
          @ActorFirebaseUid = @actorFirebaseUid`,
        input
      );
      return rows[0] || null;
    },

    // UX-07: a faculty date change for their own approved request. It is a new
    // linked request that goes through the normal approval; the old dates stay
    // approved until it is approved.
    async submitDateChange(input = {}) {
      const rows = await db.query(
        `EXEC ${DATE_CHANGE_PROCEDURE}
          @ReplacesAfcRequestId = @replacesAfcRequestId,
          @AfcRequestId = @afcRequestId,
          @StartDate = @startDate,
          @EndDate = @endDate,
          @WorkDays = @workDays,
          @Reason = @reason,
          @PurposeDestination = @purposeDestination,
          @Coverage = @coverage,
          @ContactAddress = @contactAddress,
          @ContactPhone = @contactPhone,
          @TermsVersion = @termsVersion,
          @TermsSource = @termsSource,
          @SignatureMode = @signatureMode,
          @SignatureName = @signatureName,
          @SignatureSignedAt = @signatureSignedAt,
          @SignatureFingerprint = @signatureFingerprint,
          @SignatureImageDataUrl = @signatureImageDataUrl,
          @ActorFirebaseUid = @actorFirebaseUid`,
        input
      );
      return rows[0] ? { ...rows[0], replacesAfcRequestId: input.replacesAfcRequestId } : null;
    },

    // UX-07: office date change for an approved request (no new approval).
    async updateApprovedRequestDates({ afcRequestId, expectedVersion, startDate, endDate, workDays, actorFirebaseUid, requestId } = {}) {
      const rows = await db.query(
        `EXEC ${OFFICE_DATES_PROCEDURE}
          @AfcRecordId = @afcRequestId, @SourceKind = N'request', @ExpectedVersion = @expectedVersion,
          @StartDate = @startDate, @EndDate = @endDate, @WorkDays = @workDays,
          @ActorFirebaseUid = @actorFirebaseUid, @RequestId = @requestId`,
        { afcRequestId, expectedVersion, startDate, endDate, workDays, actorFirebaseUid, requestId }
      );
      return rows[0] || null;
    },

    async withdrawRequest({ afcRequestId, actorFirebaseUid, auditRequestId } = {}) {
      const rows = await db.query(
        `EXEC ${WITHDRAW_PROCEDURE}
          @AfcRequestId = @afcRequestId,
          @ActorFirebaseUid = @actorFirebaseUid,
          @AuditRequestId = @auditRequestId`,
        { afcRequestId, actorFirebaseUid, auditRequestId }
      );
      return rows[0] || null;
    }
  };
}

module.exports = {
  createSqlAfcRequestRepository,
  SUBMIT_PROCEDURE,
  WITHDRAW_PROCEDURE,
  DATE_CHANGE_PROCEDURE,
  OFFICE_DATES_PROCEDURE
};
