'use strict';

// BETA-R4D-10A — read-only Azure SQL repository for the Dashboard API.
//
// Scope and safety contract:
//   * READ ONLY. This module must never emit INSERT, UPDATE, DELETE, MERGE,
//     EXEC, or any DDL. A repository test asserts this statically.
//   * `paws` schema only. `staging` is never referenced.
//   * Every statement is parameterised; no value is interpolated into SQL text.
//   * Faculty scoping is a server-side WHERE predicate, never a UI filter.
//
// The Dashboard summary/faculty payloads are derived exclusively from Azure SQL.
// There is no Firestore read anywhere on this path.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Academic-year vocabulary shared with the calendar view. Values are used as
// parameters, never spliced into SQL.
const DEFAULT_ACADEMIC_YEAR = '2026-2027';

function isUuid(value) {
  return typeof value === 'string' && UUID.test(value.trim());
}

function academicYear(value) {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return /^\d{4}-\d{4}$/.test(text) ? text : DEFAULT_ACADEMIC_YEAR;
}

// The Dashboard "needs attention" predicate mirrors the reviewed session-quality
// taxonomy: a session is grid-positionable only when it starts at or after 07:30
// and ends strictly after it starts. Everything else is check-needed.
const GRID_START = '07:30:00';

function createSqlDashboardRepository(db) {
  return {
    // ---------------------------------------------------------------- summary
    // Returns coarse aggregate counters. Faculty-scoped callers receive the
    // same counters narrowed to their own assignments.
    async summary({ academicYear: year, facultyId = null } = {}) {
      const scoped = facultyId ? ' AND sa.FacultyId = @facultyId' : '';
      const params = { academicYear: academicYear(year) };
      if (facultyId) params.facultyId = facultyId;

      const rows = await db.query(
        `WITH scoped AS (
             SELECT c.SessionId,
                    c.SessionDate,
                    c.StartTime,
                    c.EndTime,
                    c.CourseCode
             FROM paws.vCalendarSession c
             WHERE c.AcademicYear = @academicYear
               AND EXISTS (
                   SELECT 1
                   FROM paws.SessionAssignment sa
                   WHERE sa.SessionId = c.SessionId${scoped}
               )
         )
         SELECT
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
             (SELECT COUNT(*)
                FROM paws.SessionAssignment sa
                INNER JOIN paws.vCalendarSession c ON c.SessionId = sa.SessionId
               WHERE c.AcademicYear = @academicYear${scoped}) AS assignmentCount`,
        params
      );

      const row = rows[0] || {};
      return {
        academicYear: academicYear(year),
        sessionCount: Number(row.sessionCount || 0),
        courseCount: Number(row.courseCount || 0),
        gridPositionableCount: Number(row.gridPositionableCount || 0),
        checkNeededCount: Number(row.checkNeededCount || 0),
        assignmentCount: Number(row.assignmentCount || 0)
      };
    },

    // ---------------------------------------------------------------- faculty
    // Roster for administrator roles. Faculty-scoped callers never reach this
    // method (the API denies it before the repository is consulted).
    async faculty({ academicYear: year, search = null, limit = 200 } = {}) {
      const params = { academicYear: academicYear(year) };
      const predicates = ['f.Active = 1'];

      if (search) {
        predicates.push('(f.DisplayName LIKE @search OR f.Email LIKE @search OR f.Ucid LIKE @search)');
        params.search = '%' + String(search).replace(/[\\%_[\]]/g, match => '\\' + match) + '%';
      }

      const bounded = Math.min(Math.max(Number.isFinite(limit) ? Math.trunc(limit) : 200, 1), 500);

      const rows = await db.query(
        `SELECT TOP (${bounded})
             f.FacultyId AS facultyId,
             f.DisplayName AS displayName,
             f.Email AS email,
             f.Ucid AS ucid,
             f.RecordType AS recordType,
             f.Stream AS stream,
             f.Rank AS rank,
             f.Fte AS fte,
             (SELECT COUNT(DISTINCT c.SessionId)
                FROM paws.SessionAssignment sa
                INNER JOIN paws.vCalendarSession c ON c.SessionId = sa.SessionId
               WHERE sa.FacultyId = f.FacultyId
                 AND c.AcademicYear = @academicYear) AS sessionCount
         FROM paws.Faculty f
         WHERE ${predicates.join(' AND ')}
         ORDER BY f.DisplayName, f.FacultyId`,
        params
      );

      return rows.map(row => ({
        facultyId: row.facultyId,
        displayName: row.displayName,
        email: row.email || null,
        ucid: row.ucid || null,
        recordType: row.recordType || null,
        stream: row.stream || null,
        rank: row.rank || null,
        fte: row.fte === null || row.fte === undefined ? null : Number(row.fte),
        sessionCount: Number(row.sessionCount || 0)
      }));
    },

    // -------------------------------------------------------------- facultyById
    // Single-faculty detail. Returns null when the FacultyId is unknown or the
    // faculty record is inactive.
    async facultyById({ facultyId, academicYear: year } = {}) {
      if (!isUuid(facultyId)) return null;

      const rows = await db.query(
        `SELECT
             f.FacultyId AS facultyId,
             f.DisplayName AS displayName,
             f.Email AS email,
             f.Ucid AS ucid,
             f.RecordType AS recordType,
             f.Stream AS stream,
             f.Rank AS rank,
             f.Fte AS fte,
             f.Active AS active
         FROM paws.Faculty f
         WHERE f.FacultyId = @facultyId
           AND f.Active = 1`,
        { facultyId }
      );

      const record = rows[0];
      if (!record) return null;

      const sessions = await db.query(
        `SELECT
             c.SessionId AS id,
             c.CourseCode AS courseCode,
             c.CourseName AS courseName,
             c.Topic AS topic,
             c.SessionType AS sessionType,
             CONVERT(varchar(10), c.SessionDate, 23) AS date,
             CONVERT(varchar(8), c.StartTime, 108) AS startTime,
             CONVERT(varchar(8), c.EndTime, 108) AS endTime,
             c.Room AS room
         FROM paws.vCalendarSession c
         INNER JOIN paws.SessionAssignment sa ON sa.SessionId = c.SessionId
         WHERE sa.FacultyId = @facultyId
           AND c.AcademicYear = @academicYear
         ORDER BY c.SessionDate, c.StartTime, c.SessionId`,
        { facultyId, academicYear: academicYear(year) }
      );

      const checkNeeded = sessions.filter(session => {
        const start = session.startTime;
        const end = session.endTime;
        if (!start || !end) return true;
        if (start < GRID_START) return true;
        return end <= start;
      }).length;

      return {
        facultyId: record.facultyId,
        displayName: record.displayName,
        email: record.email || null,
        ucid: record.ucid || null,
        recordType: record.recordType || null,
        stream: record.stream || null,
        rank: record.rank || null,
        fte: record.fte === null || record.fte === undefined ? null : Number(record.fte),
        active: record.active === true || record.active === 1,
        academicYear: academicYear(year),
        sessionCount: sessions.length,
        checkNeededCount: checkNeeded,
        sessions
      };
    }
  };
}

module.exports = {
  createSqlDashboardRepository,
  DEFAULT_ACADEMIC_YEAR,
  GRID_START,
  isUuid
};
