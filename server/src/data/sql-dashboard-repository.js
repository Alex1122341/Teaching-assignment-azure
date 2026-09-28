'use strict';

// BETA-R4D-10A2 — read-only Azure SQL repository for the Dashboard API.
//
// Scope and safety contract:
//   * READ ONLY. This module must never emit INSERT, UPDATE, DELETE, MERGE,
//     EXEC, or any DDL. A repository test asserts this statically.
//   * `paws` schema only. `staging` is never referenced.
//   * Every statement is parameterised; no value is interpolated into SQL text.
//   * Faculty scoping is a server-side WHERE predicate, never a UI filter.
//
// The Dashboard summary/roster/detail payloads are derived exclusively from
// Azure SQL. There is no Firestore read anywhere on this path.
//
// R4D-10A2 widens the read surface from three objects to the full Dashboard
// contract: Faculty, FacultyProfessionalProfile, JointAppointment,
// RoleAssignment, AfcRecord, SessionAssignment (+ vCalendarSession).

const {
  DEFAULT_ACADEMIC_YEAR,
  canonicalAcademicYear,
  resolveAcademicYear
} = require('./academic-year');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The Dashboard "needs attention" predicate mirrors the reviewed session-quality
// taxonomy: a session is grid-positionable only when it starts at or after 07:30
// and ends strictly after it starts. Everything else is check-needed.
const GRID_START = '07:30:00';

// Bounded roster page size. The limit is bound as a SQL parameter (`@limit`),
// never spliced into the statement text.
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

// Deterministic HICC / VISC classification.
//
// CONFIRMED AGAINST LIVE DATA (recon, 2026-09-27): `paws.RoleAssignment.RoleCategory`
// is NULL for ALL 162 rows in academic year 2026-27. The classification
// vocabulary lives entirely in `RoleType`. A predicate on `RoleCategory` would
// have silently returned hiccCount = 0 / viscCount = 0, which is exactly the
// class of failure this task exists to eliminate.
//
// Canonical live vocabulary (`RoleType`, all rows, 2026-27):
//   'Course Coordinator / HICC (legacy ambiguous)'  64 rows / 46 faculty
//   'Rotation Participant'                          38 rows / 27 faculty
//   'VISC'                                          35 rows / 34 faculty
//   'CCC'                                           14 rows / 14 faculty
//   'Designated Rotation Coordinator'               11 rows /  9 faculty
//
// Matching rule: EXACT, case-insensitive whole-value equality against a closed
// list. No LIKE, no substring, no prefix. `Designated Rotation Coordinator`
// is deliberately NOT counted as HICC — despite containing the word
// "Coordinator" — because the source distinguishes the two values and fuzzy
// matching would inflate the HICC count from 64 to 75.
const VISC_ROLE_TYPES = ['VISC'];
const HICC_ROLE_TYPES = ['Course Coordinator / HICC (legacy ambiguous)'];

// Retained only so the R4D-10A export surface does not break. NOT used as a
// query predicate — `RoleCategory` is the wrong axis (it is NULL live).
const HICC_CATEGORY = HICC_ROLE_TYPES[0];
const VISC_CATEGORY = VISC_ROLE_TYPES[0];

// Renders an exact-match predicate over a closed list as `IN (@p0, @p1, ...)`,
// returning both the SQL fragment and the parameters to bind. SQL text is never
// spliced; only generated parameter names appear in the statement.
function roleTypeInPredicate(column, values, prefix) {
  const names = values.map((_, index) => `@${prefix}${index}`);
  const params = {};
  values.forEach((value, index) => {
    params[names[index].slice(1)] = value;
  });
  return {
    sql: `${column} IN (${names.join(', ')})`,
    params
  };
}

// ---------------------------------------------------------------------------
// GRANT-SAFE ROW COUNTING (R4D-10A2 hotfix, confirmed live 2026-09-28)
// ---------------------------------------------------------------------------
//
// `paws-sql-beta-mi` holds COLUMN-scoped SELECT grants, not object-scoped ones.
// Several tables retain import-provenance columns (`SourceImportBatchId`,
// `SourceRow`, `SourceFacultyName`, `ReportsToRaw`, `CreatedAtUtc`,
// `UpdatedAtUtc`, …) that are deliberately NOT granted.
//
// Under column-level security, `SELECT COUNT(*)` is authorised against *every*
// column of the object, so a bare `COUNT(*)` over such a table is refused even
// though it returns no data:
//
//   The SELECT permission was denied on the column 'SourceRow' of the object
//   'AfcRecord', database 'teaching-assignment-lab', schema 'paws'. (err 230)
//
// A correlated `COUNT(*)` that filters on a granted column happens to succeed
// (the optimiser can seek), but that is an accident of the plan, not a contract.
// The deterministic fix is to count a NOT NULL column the principal is
// authorised to read. Every table below has a NOT NULL primary-key surrogate
// (`AfcRecordId`, `RoleAssignmentId`, `SessionAssignmentId`, `FacultyId`,
// `JointAppointmentId`), so `COUNT(<pk>)` equals `COUNT(*)` exactly, while
// touching only granted columns.
//
// This helper renders that form for a qualified column reference.
function rowCount(qualifiedKey) {
  return `COUNT(${qualifiedKey})`;
}

function isUuid(value) {
  return typeof value === 'string' && UUID.test(value.trim());
}

// Kept for backwards compatibility with the R4D-10A export surface. Delegates
// to the canonical implementation so there is exactly one year rule.
function academicYear(value) {
  return resolveAcademicYear(value);
}

function boundLimit(value) {
  const numeric = Number.isFinite(value) ? Math.trunc(value) : NaN;
  if (!Number.isFinite(numeric)) return DEFAULT_LIMIT;
  return Math.min(Math.max(numeric, 1), MAX_LIMIT);
}

// `LIKE` metacharacters are escaped and the statement declares `ESCAPE '\'`, so
// a search for `100%` cannot broaden into a wildcard scan.
function likePattern(value) {
  return '%' + String(value).replace(/[\\%_[\]]/g, match => '\\' + match) + '%';
}

function toNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function toInt(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

function toText(value) {
  return value === null || value === undefined ? null : String(value);
}

function toBool(value) {
  return value === true || value === 1;
}

function createSqlDashboardRepository(db) {
  return {
    // ---------------------------------------------------------------- summary
    // Complete business KPI set for the Dashboard. Faculty-scoped callers
    // receive the same counters narrowed to their own assignments.
    //
    // sessionCount deliberately counts EVERY vCalendarSession row for the year
    // (including the four that carry no SessionAssignment), because the
    // Dashboard reports the canonical session total.
    async summary({ academicYear: year, facultyId = null } = {}) {
      const resolvedYear = resolveAcademicYear(year);
      const scoped = facultyId ? ' AND sa.FacultyId = @facultyId' : '';
      const roleScoped = facultyId ? ' AND ra.FacultyId = @facultyId' : '';
      const afcScoped = facultyId ? ' AND ar.FacultyId = @facultyId' : '';
      // `@facultyId` is ALWAYS referenced by the CTE's
      // `(@facultyId IS NULL OR EXISTS (...))` guard, so it must ALWAYS be
      // supplied. The connection layer deliberately drops null/undefined
      // parameters (`sql-connection.js`), which would leave the statement
      // referencing an undeclared variable and fail with
      // "Must declare the scalar variable @facultyId" -> 503 SQL_UNAVAILABLE.
      // Bind an explicit SQL NULL instead of omitting the parameter.
      const params = { academicYear: resolvedYear, facultyId: facultyId || null };

      // HICC / VISC are matched on `RoleType`, the column that actually carries
      // the vocabulary. See the constant block above for the live evidence.
      const hicc = roleTypeInPredicate('ra.RoleType', HICC_ROLE_TYPES, 'hiccRoleType');
      const visc = roleTypeInPredicate('ra.RoleType', VISC_ROLE_TYPES, 'viscRoleType');
      Object.assign(params, hicc.params, visc.params);

      const rows = await db.query(
        `WITH scoped AS (
             SELECT c.SessionId,
                    c.SessionDate,
                    c.StartTime,
                    c.EndTime,
                    c.CourseCode
             FROM paws.vCalendarSession c
             WHERE c.AcademicYear = @academicYear
               AND (@facultyId IS NULL OR EXISTS (
                   SELECT 1
                   FROM paws.SessionAssignment sa
                   WHERE sa.SessionId = c.SessionId${scoped}
               ))
         )
         SELECT
             (SELECT ${rowCount('f.FacultyId')} FROM paws.Faculty f WHERE f.Active = 1) AS activeFacultyCount,
             (SELECT COUNT(*) FROM scoped) AS sessionCount,
             (SELECT COUNT(DISTINCT s.CourseCode) FROM scoped s) AS courseCount,
             (SELECT COUNT(*)
                FROM scoped s
               WHERE s.StartTime IS NOT NULL
                 AND s.EndTime IS NOT NULL
                 AND s.StartTime >= CONVERT(time(0), '${GRID_START}')
                 AND s.EndTime > s.StartTime) AS gridPositionableCount,
             (SELECT COUNT(*)
                FROM scoped s
               WHERE s.StartTime IS NULL
                  OR s.EndTime IS NULL
                  OR s.StartTime < CONVERT(time(0), '${GRID_START}')
                  OR s.EndTime <= s.StartTime) AS checkNeededCount,
             (SELECT ${rowCount('sa.SessionAssignmentId')}
                FROM paws.SessionAssignment sa
                INNER JOIN paws.vCalendarSession c ON c.SessionId = sa.SessionId
               WHERE c.AcademicYear = @academicYear${scoped}) AS assignmentCount,
             (SELECT ${rowCount('ra.RoleAssignmentId')}
                FROM paws.RoleAssignment ra
               WHERE ra.AcademicYear = @academicYear${roleScoped}) AS roleAssignmentCount,
             (SELECT ${rowCount('ra.RoleAssignmentId')}
                FROM paws.RoleAssignment ra
               WHERE ra.AcademicYear = @academicYear
                 AND ${hicc.sql}${roleScoped}) AS hiccCount,
             (SELECT ${rowCount('ra.RoleAssignmentId')}
                FROM paws.RoleAssignment ra
               WHERE ra.AcademicYear = @academicYear
                 AND ${visc.sql}${roleScoped}) AS viscCount,
             (SELECT ${rowCount('ar.AfcRecordId')} FROM paws.AfcRecord ar WHERE 1 = 1${afcScoped}) AS afcRecordCount`,
        params
      );

      const row = rows[0] || {};
      return {
        academicYear: resolvedYear,
        activeFacultyCount: toInt(row.activeFacultyCount),
        sessionCount: toInt(row.sessionCount),
        assignmentCount: toInt(row.assignmentCount),
        courseCount: toInt(row.courseCount),
        roleAssignmentCount: toInt(row.roleAssignmentCount),
        hiccCount: toInt(row.hiccCount),
        viscCount: toInt(row.viscCount),
        afcRecordCount: toInt(row.afcRecordCount),
        gridPositionableCount: toInt(row.gridPositionableCount),
        checkNeededCount: toInt(row.checkNeededCount)
      };
    },

    // ---------------------------------------------------------------- faculty
    // Roster. Administrators receive the full active roster; a faculty-scoped
    // caller is narrowed by `facultyId` to exactly its own row.
    async faculty({ academicYear: year, search = null, limit, facultyId = null } = {}) {
      const resolvedYear = resolveAcademicYear(year);
      const params = { academicYear: resolvedYear, limit: boundLimit(limit) };
      const predicates = ['f.Active = 1'];

      if (facultyId) {
        predicates.push('f.FacultyId = @facultyId');
        params.facultyId = facultyId;
      }

      if (search) {
        predicates.push("(f.DisplayName LIKE @search ESCAPE '\\' OR f.Email LIKE @search ESCAPE '\\' OR f.Ucid LIKE @search ESCAPE '\\')");
        params.search = likePattern(search);
      }

      const rows = await db.query(
        `SELECT TOP (@limit)
             f.FacultyId AS facultyId,
             f.PreferredFirstName AS preferredFirstName,
             f.PreferredLastName AS preferredLastName,
             f.DisplayName AS displayName,
             f.Ucid AS ucid,
             f.Email AS email,
             f.RecordType AS recordType,
             f.Stream AS stream,
             f.Rank AS rank,
             f.Fte AS fte,
             f.ReportsToFacultyId AS reportsToFacultyId,
             manager.DisplayName AS reportsToName,
             f.Active AS active,
             profile.TeachingArea AS teachingArea,
             profile.ProfessionalCategory AS professionalCategory,
             (SELECT COUNT(DISTINCT c.SessionId)
                FROM paws.SessionAssignment sa
                INNER JOIN paws.vCalendarSession c ON c.SessionId = sa.SessionId
               WHERE sa.FacultyId = f.FacultyId
                 AND c.AcademicYear = @academicYear) AS sessionCount,
             (SELECT ${rowCount('ra.RoleAssignmentId')}
                FROM paws.RoleAssignment ra
               WHERE ra.FacultyId = f.FacultyId
                 AND ra.AcademicYear = @academicYear) AS roleCount,
             (SELECT ${rowCount('ar.AfcRecordId')}
                FROM paws.AfcRecord ar
               WHERE ar.FacultyId = f.FacultyId) AS afcCount,
             (SELECT ${rowCount('ja.JointAppointmentId')}
                FROM paws.JointAppointment ja
               WHERE ja.FacultyId = f.FacultyId) AS jointAppointmentCount
         FROM paws.Faculty f
         LEFT JOIN paws.Faculty manager ON manager.FacultyId = f.ReportsToFacultyId
         LEFT JOIN paws.FacultyProfessionalProfile profile ON profile.FacultyId = f.FacultyId
         WHERE ${predicates.join(' AND ')}
         ORDER BY f.DisplayName, f.FacultyId`,
        params
      );

      return rows.map(row => ({
        facultyId: row.facultyId,
        preferredFirstName: toText(row.preferredFirstName),
        preferredLastName: toText(row.preferredLastName),
        displayName: toText(row.displayName),
        ucid: toText(row.ucid),
        email: toText(row.email),
        recordType: toText(row.recordType),
        stream: toText(row.stream),
        rank: toText(row.rank),
        fte: toNumber(row.fte),
        reportsToFacultyId: toText(row.reportsToFacultyId),
        reportsToName: toText(row.reportsToName),
        active: toBool(row.active),
        teachingArea: toText(row.teachingArea),
        professionalCategory: toText(row.professionalCategory),
        sessionCount: toInt(row.sessionCount),
        roleCount: toInt(row.roleCount),
        afcCount: toInt(row.afcCount),
        jointAppointmentCount: toInt(row.jointAppointmentCount)
      }));
    },

    // -------------------------------------------------------------- facultyById
    // Full single-faculty detail. Returns null when the FacultyId is unknown or
    // the faculty record is inactive.
    //
    // The six required sections are returned as siblings of `faculty`, never
    // nested inside it.
    async facultyById({ facultyId, academicYear: year } = {}) {
      if (!isUuid(facultyId)) return null;
      const resolvedYear = resolveAcademicYear(year);

      const rows = await db.query(
        `SELECT
             f.FacultyId AS facultyId,
             f.RecordType AS recordType,
             f.PreferredFirstName AS preferredFirstName,
             f.PreferredLastName AS preferredLastName,
             f.DisplayName AS displayName,
             f.Ucid AS ucid,
             f.Email AS email,
             f.Stream AS stream,
             f.Rank AS rank,
             f.Fte AS fte,
             f.ReportsToFacultyId AS reportsToFacultyId,
             manager.DisplayName AS reportsToName,
             f.Active AS active
         FROM paws.Faculty f
         LEFT JOIN paws.Faculty manager ON manager.FacultyId = f.ReportsToFacultyId
         WHERE f.FacultyId = @facultyId
           AND f.Active = 1`,
        { facultyId }
      );

      const record = rows[0];
      if (!record) return null;

      const [profileRows, jointRows, roleRows, afcRows, assignmentRows] = await Promise.all([
        // ---------------------------------------------------- professional profile
        db.query(
          `SELECT
               p.TeachingArea AS teachingArea,
               p.ProfessionalCategory AS professionalCategory,
               CONVERT(varchar(10), p.ServiceDate, 23) AS serviceDate,
               p.PriorYearsExperience AS priorYearsExperience,
               p.DvmEarnedDate AS dvmEarnedDate,
               p.DvmType AS dvmType,
               p.MastersEarnedDate AS mastersEarnedDate,
               p.MastersArea AS mastersArea,
               p.PhdEarnedDate AS phdEarnedDate,
               p.PhdArea AS phdArea,
               p.BoardCertifiedDate AS boardCertifiedDate,
               p.BoardCertification AS boardCertification,
               p.BoardCertificationCount AS boardCertificationCount,
               p.AbvmaLicenseNumber AS abvmaLicenseNumber,
               p.AbvmaMemberType AS abvmaMemberType
           FROM paws.FacultyProfessionalProfile p
           WHERE p.FacultyId = @facultyId`,
          { facultyId }
        ),
        // ----------------------------------------------------- joint appointments
        db.query(
          `SELECT
               j.JointAppointmentId AS jointAppointmentId,
               j.HomeFaculty AS homeFaculty,
               j.JointFaculty AS jointFaculty,
               j.FteUcvm AS fteUcvm,
               j.FteOtherFaculty AS fteOtherFaculty,
               CONVERT(varchar(10), j.ExpiryDate, 23) AS expiryDate,
               j.Notes AS notes
           FROM paws.JointAppointment j
           WHERE j.FacultyId = @facultyId
           ORDER BY j.JointAppointmentId`,
          { facultyId }
        ),
        // -------------------------------------------------------- role assignments
        db.query(
          `SELECT
               r.RoleAssignmentId AS roleAssignmentId,
               r.FacultyResolutionStatus AS facultyResolutionStatus,
               r.AcademicYear AS academicYear,
               r.RoleCategory AS roleCategory,
               r.RoleType AS roleType,
               r.CourseOrSubjectOrRotation AS courseOrSubjectOrRotation,
               r.CourseName AS courseName,
               r.Details AS details,
               CONVERT(varchar(10), r.EffectiveDate, 23) AS effectiveDate,
               CONVERT(varchar(10), r.ExpirationDate, 23) AS expirationDate,
               r.DoeMappedValue AS doeMappedValue,
               r.DoeOverrideValue AS doeOverrideValue,
               r.DoeOverrideReason AS doeOverrideReason,
               r.SpecialNotes AS specialNotes
           FROM paws.RoleAssignment r
           WHERE r.FacultyId = @facultyId
             AND r.AcademicYear = @academicYear
           ORDER BY r.RoleCategory, r.RoleType, r.RoleAssignmentId`,
          { facultyId, academicYear: resolvedYear }
        ),
        // ------------------------------------------------------------ AFC records
        db.query(
          `SELECT
               a.AfcRecordId AS afcRecordId,
               CONVERT(varchar(10), a.StartDate, 23) AS startDate,
               CONVERT(varchar(10), a.EndDate, 23) AS endDate,
               a.Purpose AS purpose,
               a.Active AS active
           FROM paws.AfcRecord a
           WHERE a.FacultyId = @facultyId
           ORDER BY a.StartDate DESC, a.AfcRecordId`,
          { facultyId }
        ),
        // ---------------------------------------------------- teaching assignments
        db.query(
          `SELECT
               sa.SessionAssignmentId AS sessionAssignmentId,
               c.SessionId AS sessionId,
               c.AcademicYear AS academicYear,
               c.CurriculumYear AS curriculumYear,
               c.CourseCode AS courseCode,
               c.CourseName AS courseName,
               c.Topic AS topic,
               c.SessionType AS sessionType,
               CONVERT(varchar(10), c.SessionDate, 23) AS date,
               CONVERT(varchar(8), c.StartTime, 108) AS startTime,
               CONVERT(varchar(8), c.EndTime, 108) AS endTime,
               c.Room AS room,
               sa.TeachingRole AS teachingRole,
               sa.LabLead AS labLead,
               sa.CreditedHours AS creditedHours,
               sa.DoeRate AS doeRate,
               sa.DoeQuantity AS doeQuantity,
               sa.DoeUnit AS doeUnit,
               sa.DoeCredit AS doeCredit,
               sa.DoeStatus AS doeStatus
           FROM paws.SessionAssignment sa
           INNER JOIN paws.vCalendarSession c ON c.SessionId = sa.SessionId
           WHERE sa.FacultyId = @facultyId
             AND c.AcademicYear = @academicYear
           ORDER BY c.SessionDate, c.StartTime, c.SessionId, sa.SessionAssignmentId`,
          { facultyId, academicYear: resolvedYear }
        )
      ]);

      const profile = profileRows[0] || null;
      const teachingAssignments = assignmentRows.map(row => ({
        sessionAssignmentId: row.sessionAssignmentId,
        sessionId: row.sessionId,
        academicYear: toText(row.academicYear),
        curriculumYear: toText(row.curriculumYear),
        courseCode: toText(row.courseCode),
        courseName: toText(row.courseName),
        topic: toText(row.topic),
        sessionType: toText(row.sessionType),
        date: toText(row.date),
        startTime: toText(row.startTime),
        endTime: toText(row.endTime),
        room: toText(row.room),
        teachingRole: toText(row.teachingRole),
        labLead: toText(row.labLead),
        creditedHours: toNumber(row.creditedHours),
        doeRate: toNumber(row.doeRate),
        doeQuantity: toNumber(row.doeQuantity),
        doeUnit: toText(row.doeUnit),
        doeCredit: toNumber(row.doeCredit),
        doeStatus: toText(row.doeStatus)
      }));

      const checkNeeded = teachingAssignments.filter(assignment => {
        const start = assignment.startTime;
        const end = assignment.endTime;
        if (!start || !end) return true;
        if (start < GRID_START) return true;
        return end <= start;
      }).length;

      return {
        faculty: {
          facultyId: record.facultyId,
          recordType: toText(record.recordType),
          preferredFirstName: toText(record.preferredFirstName),
          preferredLastName: toText(record.preferredLastName),
          displayName: toText(record.displayName),
          ucid: toText(record.ucid),
          email: toText(record.email),
          stream: toText(record.stream),
          rank: toText(record.rank),
          fte: toNumber(record.fte),
          reportsToFacultyId: toText(record.reportsToFacultyId),
          reportsToName: toText(record.reportsToName),
          active: toBool(record.active)
        },
        academicYear: resolvedYear,
        professionalProfile: profile
          ? {
              teachingArea: toText(profile.teachingArea),
              professionalCategory: toText(profile.professionalCategory),
              serviceDate: toText(profile.serviceDate),
              priorYearsExperience: toNumber(profile.priorYearsExperience),
              dvmEarnedDate: toText(profile.dvmEarnedDate),
              dvmType: toText(profile.dvmType),
              mastersEarnedDate: toText(profile.mastersEarnedDate),
              mastersArea: toText(profile.mastersArea),
              phdEarnedDate: toText(profile.phdEarnedDate),
              phdArea: toText(profile.phdArea),
              boardCertifiedDate: toText(profile.boardCertifiedDate),
              boardCertification: toText(profile.boardCertification),
              boardCertificationCount: toNumber(profile.boardCertificationCount),
              abvmaLicenseNumber: toText(profile.abvmaLicenseNumber),
              abvmaMemberType: toText(profile.abvmaMemberType)
            }
          : null,
        jointAppointments: jointRows.map(row => ({
          jointAppointmentId: row.jointAppointmentId,
          homeFaculty: toText(row.homeFaculty),
          jointFaculty: toText(row.jointFaculty),
          fteUcvm: toNumber(row.fteUcvm),
          fteOtherFaculty: toNumber(row.fteOtherFaculty),
          expiryDate: toText(row.expiryDate),
          notes: toText(row.notes)
        })),
        roles: roleRows.map(row => ({
          roleAssignmentId: row.roleAssignmentId,
          facultyResolutionStatus: toText(row.facultyResolutionStatus),
          academicYear: toText(row.academicYear),
          roleCategory: toText(row.roleCategory),
          roleType: toText(row.roleType),
          courseOrSubjectOrRotation: toText(row.courseOrSubjectOrRotation),
          courseName: toText(row.courseName),
          details: toText(row.details),
          effectiveDate: toText(row.effectiveDate),
          expirationDate: toText(row.expirationDate),
          doeMappedValue: toNumber(row.doeMappedValue),
          doeOverrideValue: toNumber(row.doeOverrideValue),
          doeOverrideReason: toText(row.doeOverrideReason),
          specialNotes: toText(row.specialNotes)
        })),
        afcRecords: afcRows.map(row => ({
          afcRecordId: row.afcRecordId,
          startDate: toText(row.startDate),
          endDate: toText(row.endDate),
          purpose: toText(row.purpose),
          active: toBool(row.active)
        })),
        teachingAssignments,
        sessionCount: teachingAssignments.length,
        checkNeededCount: checkNeeded
      };
    },

    // ---------------------------------------------------- vocabulary inspection
    // Read-only helper. Reports `RoleCategory` AND `RoleType` because the live
    // data proved `RoleCategory` is entirely NULL while `RoleType` carries the
    // real vocabulary — the helper must not hide that.
    async roleCategoryVocabulary() {
      const rows = await db.query(
        `SELECT DISTINCT r.RoleCategory AS roleCategory, r.RoleType AS roleType
           FROM paws.RoleAssignment r
          ORDER BY r.RoleCategory, r.RoleType`
      );
      return rows.map(row => ({
        roleCategory: toText(row.roleCategory),
        roleType: toText(row.roleType)
      }));
    }
  };
}

module.exports = {
  createSqlDashboardRepository,
  DEFAULT_ACADEMIC_YEAR,
  GRID_START,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  HICC_ROLE_TYPES,
  VISC_ROLE_TYPES,
  HICC_CATEGORY,
  VISC_CATEGORY,
  roleTypeInPredicate,
  isUuid,
  academicYear,
  boundLimit,
  likePattern
};
