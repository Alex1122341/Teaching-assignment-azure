'use strict';

const { randomUUID } = require('node:crypto');
const policy = require('../domain/afc-special-leave-policy');

const dateText = value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const numeric = value => value == null ? null : Number(value);

function leaveDto(row) {
  const details = JSON.parse(row.deductionJson);
  const startDate = dateText(row.startDate), endDate = dateText(row.endDate);
  if (startDate !== dateText(row.reviewedStartDate) || endDate !== dateText(row.reviewedEndDate)) {
    // Date editing preserves the AFC and its PDF, but an updated range must be reviewed.
    details.confirmedYears = Object.fromEntries(policy.yearsForRange(startDate, endDate).map(year => [year, false]));
  }
  return {
    ...details, id: row.afcRecordId, facultyId: row.facultyId, versionToken: row.versionToken,
    startDate, endDate, active: Boolean(row.active), approved: true,
    approvedAt: row.approvedAt, reasonCode: 'special', availability: 'available'
  };
}

function createSqlAfcSpecialLeaveRepository(db, writeAfc) {
  async function sources(facultyId, academicYear) {
    const [row] = await db.query(`SELECT f.Fte AS fte,t.ContractTeachingDoe teaching,a.service,a.research,
         CONVERT(varchar(33),f.UpdatedAtUtc,126) facultyVersion,
         CONVERT(varchar(33),t.UpdatedAtUtc,126) teachingVersion,a.serviceVersion,a.researchVersion
       FROM paws.Faculty f
       LEFT JOIN paws.DoeFacultyTarget t ON t.FacultyId=f.FacultyId AND t.AcademicYear=@academicYear AND t.Active=1
       OUTER APPLY (
         SELECT MAX(CASE WHEN a.CategoryCode=N'service' THEN a.AllocationDoe END) service,
                MAX(CASE WHEN a.CategoryCode=N'research' THEN a.AllocationDoe END) research,
                MAX(CASE WHEN a.CategoryCode=N'service' THEN CONVERT(varchar(33),a.UpdatedAtUtc,126) END) serviceVersion,
                MAX(CASE WHEN a.CategoryCode=N'research' THEN CONVERT(varchar(33),a.UpdatedAtUtc,126) END) researchVersion
         FROM paws.DoeFacultyAllocation a
         WHERE a.FacultyId=f.FacultyId AND a.AcademicYear=@academicYear AND a.Active=1
       ) a
       WHERE f.FacultyId=@facultyId`, { facultyId, academicYear });
    if (!row) throw Object.assign(Error('Faculty record was not found.'), { number: 51210 });
    return { fte: numeric(row.fte), doe: Object.fromEntries(policy.CATEGORIES.map(key => [key, numeric(row[key])])),
      revision: [row.facultyVersion, row.teachingVersion, row.serviceVersion, row.researchVersion] };
  }

  async function overlapping(facultyId, startDate, endDate) {
    const rows = await db.query(`SELECT AfcRecordId afcRecordId,FacultyId facultyId,StartDate startDate,EndDate endDate,
       Active active,ApprovedAt approvedAt,VersionToken versionToken,ReviewedStartDate reviewedStartDate,
       ReviewedEndDate reviewedEndDate,DeductionJson deductionJson
       FROM paws.vAfcSpecialLeaveAdmin
       WHERE FacultyId=@facultyId AND Active=1 AND EndDate>=@startDate AND StartDate<=@endDate`,
    { facultyId, startDate, endDate });
    return rows.map(leaveDto);
  }

  async function save(record, input) {
    const years = policy.yearsForRange(record.startDate, record.endDate);
    const details = policy.parseDeduction(input.specialLeave, years);
    const sourceByYear = {};
    const confirmedYears = {}, sourceFingerprintByYear = {};
    for (const year of years) {
      const source = await sources(record.facultyId, year);
      sourceByYear[year] = source;
      const check = policy.validateAllocation(details.fteDeduction, details.allocationsByYear[year], source);
      if (check.errors.some(code => !code.includes('SOURCE_MISSING')))
        throw policy.invalidDeduction('Deduction exceeds a recorded FTE or DOE allocation for ' + year + '.');
      confirmedYears[year] = check.valid;
      sourceFingerprintByYear[year] = JSON.stringify(source);
    }
    const deduction = { ...details, confirmedYears, sourceFingerprintByYear };
    const previous = (await overlapping(record.facultyId, record.startDate, record.endDate)).filter(row => row.id !== record.id);
    deduction.suspendedIntervals = policy.heldIntervals({
      ...record, ...deduction, reasonCode: 'special', availability: 'available', approved: true
    }, previous, sourceByYear);
    const [row] = await db.query(`EXEC paws_api.SaveAfcSpecialLeave
      @AfcRecordId=@id,@FacultyId=@facultyId,@ExpectedVersion=@versionToken,
      @ActorFirebaseUid=@actorFirebaseUid,@RequestId=@requestId,@DeductionJson=@deductionJson`, {
      id: record.id, facultyId: record.facultyId, versionToken: record.versionToken,
      actorFirebaseUid: input.actorFirebaseUid, requestId: input.requestId || randomUUID(),
      deductionJson: JSON.stringify(deduction)
    });
    if (!row) throw Error('Special Leave did not return a readback.');
    return deduction;
  }

  return {
    async specialLeaveSource(facultyId, year) {
      const { fte, doe } = await sources(facultyId, year);
      return { fte, doe };
    },
    async specialLeaveOnDate(facultyId, date) {
      const source = await sources(facultyId, policy.academicYearForDate(date));
      const leaves = await overlapping(facultyId, date, date);
      const [ordinary] = await db.query(`SELECT 1 AS unavailable WHERE EXISTS (
       SELECT 1 FROM paws.vAfcRecordUnified u
       LEFT JOIN paws.vAfcSpecialLeaveAdmin s ON u.SourceKind=N'manual' AND s.AfcRecordId=u.AfcRecordId
       WHERE u.FacultyId=@facultyId AND u.Active=1 AND @date BETWEEN u.StartDate AND u.EndDate AND s.AfcRecordId IS NULL
       ) OR EXISTS (
       SELECT 1 FROM paws.AfcRequest r WHERE r.FacultyId=@facultyId AND r.Status=N'approved' AND @date BETWEEN r.StartDate AND r.EndDate
       )`,
      { facultyId, date });
      if (ordinary) leaves.push({ startDate: date, endDate: date });
      return policy.evaluate({ date, source, leaves });
    },
    async createAvailableSpecialLeave(input) {
      return db.transaction(async () => {
        const row = await writeAfc(input);
        if (!row) throw Error('AFC did not return a readback.');
        const [record] = await db.query(`SELECT AfcRecordId id,FacultyId facultyId,VersionToken versionToken,
          CONVERT(varchar(33),CreatedAtUtc,126) approvedAt FROM paws.vAfcRecordUnified
          WHERE SourceKind=N'manual' AND AfcRecordId=@id`, { id: input.afcRecordId });
        if (!record) throw Error('AFC version could not be read.');
        const specialLeave = await save({ ...record, startDate: input.startDate, endDate: input.endDate }, input);
        return { ...row, availability: 'available', specialLeave };
      });
    },
    async applySpecialLeave(input) {
      return db.transaction(async () => {
        const [row] = await db.query(`SELECT AfcRecordId afcRecordId,FacultyId facultyId,StartDate startDate,EndDate endDate,
          Active active,ApprovedAt approvedAt,VersionToken versionToken,ReviewedStartDate reviewedStartDate,
          ReviewedEndDate reviewedEndDate,DeductionJson deductionJson
          FROM paws.vAfcSpecialLeaveAdmin WHERE AfcRecordId=@id`, { id: input.afcRecordId });
        if (!row || !row.active) throw Object.assign(Error('Active Special Leave was not found.'), { number: 56403 });
        if (row.versionToken.toUpperCase() !== input.expectedVersion.toUpperCase())
          throw Object.assign(Error('AFC changed. Reload before applying deductions.'), { number: 56404 });
        await save(leaveDto(row), input);
        return { afcRecordId: row.afcRecordId };
      });
    }
  };
}

module.exports = { createSqlAfcSpecialLeaveRepository, leaveDto };
