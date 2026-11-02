'use strict';

const PROFILE_FIELDS = Object.freeze([
  'teachingArea', 'professionalCategory', 'serviceDate', 'priorYearsExperience', 'dvmEarnedDate', 'dvmType',
  'mastersEarnedDate', 'mastersArea', 'phdEarnedDate', 'phdArea', 'boardCertifiedDate', 'boardCertification',
  'boardCertificationCount', 'abvmaLicenseNumber', 'abvmaMemberType'
]);

function facultyDto(row) {
  if (!row) return null;
  const text = value => value === null || value === undefined ? null : String(value);
  const number = value => value === null || value === undefined ? null : Number(value);
  return {
    facultyId: text(row.facultyId), preferredFirstName: text(row.preferredFirstName), preferredLastName: text(row.preferredLastName),
    displayName: text(row.displayName), ucid: text(row.ucid), email: text(row.email), recordType: text(row.recordType),
    stream: text(row.stream), rank: text(row.rank), fte: number(row.fte), reportsToFacultyId: text(row.reportsToFacultyId),
    active: row.active === true || row.active === 1, administrativeActive: row.administrativeActive === undefined ? (row.active === true || row.active === 1) : (row.administrativeActive === true || row.administrativeActive === 1), activationDate: text(row.activationDate), updatedAtUtc: row.updatedAtUtc instanceof Date ? row.updatedAtUtc.toISOString() : text(row.updatedAtUtc),
    profileVersion: text(row.profileVersion),
    professionalProfile: Object.fromEntries(PROFILE_FIELDS.map(field => [field, field.endsWith('Count') || field === 'priorYearsExperience' ? number(row[field]) : text(row[field])]))
  };
}

function createSqlFacultyAdminRepository(db) {
  const run = (procedure, params) => db.query(
    `EXEC paws_api.${procedure}\n${Object.keys(params).map(key => `@${key} = @${key}`).join(',\n')}`,
    params
  );
  const paramsForUpdate = input => ({
    FacultyId: input.facultyId, ExpectedUpdatedAtUtc: input.expectedUpdatedAtUtc,
    ExpectedProfileVersion: input.expectedProfileVersion, ActorFirebaseUid: input.actorFirebaseUid,
    PreferredFirstName: input.preferredFirstName, PreferredLastName: input.preferredLastName, DisplayName: input.displayName,
    Ucid: input.ucid, Email: input.email, RecordType: input.recordType, Stream: input.stream, Rank: input.rank,
    Fte: input.fte, ReportsToFacultyId: input.reportsToFacultyId,
    TeachingArea: input.professionalProfile.teachingArea, ProfessionalCategory: input.professionalProfile.professionalCategory,
    ServiceDate: input.professionalProfile.serviceDate, PriorYearsExperience: input.professionalProfile.priorYearsExperience,
    DvmEarnedDate: input.professionalProfile.dvmEarnedDate, DvmType: input.professionalProfile.dvmType,
    MastersEarnedDate: input.professionalProfile.mastersEarnedDate, MastersArea: input.professionalProfile.mastersArea,
    PhdEarnedDate: input.professionalProfile.phdEarnedDate, PhdArea: input.professionalProfile.phdArea,
    BoardCertifiedDate: input.professionalProfile.boardCertifiedDate, BoardCertification: input.professionalProfile.boardCertification,
    BoardCertificationCount: input.professionalProfile.boardCertificationCount,
    AbvmaLicenseNumber: input.professionalProfile.abvmaLicenseNumber, AbvmaMemberType: input.professionalProfile.abvmaMemberType
  });
  return Object.freeze({
    async updateRolePeriods(input) {
      const rows = await run('SetRoleAppointmentPeriods', {RoleAssignmentId:input.roleAssignmentId,ExpectedVersion:input.expectedVersion,PeriodsJson:JSON.stringify(input.periods),ActorFirebaseUid:input.actorFirebaseUid});
      return rows[0] || null;
    },
    async createFaculty(input) {
      const params = paramsForUpdate(input);
      delete params.FacultyId;
      delete params.ExpectedUpdatedAtUtc;
      delete params.ExpectedProfileVersion;
      params.ActivationDate = input.activationDate ?? null;
      const rows = await run('CreateFaculty', params);
      return facultyDto(rows[0]);
    },
    async updateFaculty(input) {
      if (!Object.prototype.hasOwnProperty.call(input, 'activationDate')) {
        const rows = await run('UpdateFaculty', paramsForUpdate(input));
        return facultyDto(rows[0]);
      }
      if (typeof db.transaction !== 'function')
        throw new Error('Atomic Faculty profile/activation update requires a SQL transaction.');
      return db.transaction(async () => {
        const rows = await run('UpdateFaculty', paramsForUpdate(input));
        if (!rows[0]) return null;
        const after = await run('SetFacultyActivation', {
          FacultyId: input.facultyId,
          ExpectedUpdatedAtUtc: rows[0].updatedAtUtc,
          ActivationDate: input.activationDate ?? null,
          ActorFirebaseUid: input.actorFirebaseUid
        });
        return facultyDto(after[0]);
      });
    },
    async deactivateFaculty(input) {
      const rows = await run('DeactivateFaculty', {
        FacultyId: input.facultyId, ExpectedUpdatedAtUtc: input.expectedUpdatedAtUtc, ActorFirebaseUid: input.actorFirebaseUid
      });
      return facultyDto(rows[0]);
    },
    async restoreFaculty(input) {
      const rows = await run('RestoreFaculty', {
        FacultyId: input.facultyId, ExpectedUpdatedAtUtc: input.expectedUpdatedAtUtc, ActorFirebaseUid: input.actorFirebaseUid
      });
      return facultyDto(rows[0]);
    }
  });
}

module.exports = { createSqlFacultyAdminRepository, facultyDto, PROFILE_FIELDS };
