'use strict';

const { facultyDisplayNameSql } = require('./faculty-display-name');
const { canonicalAcademicYear } = require('./academic-year');
const names = require('../domain/person-name');

function createSqlSessionRepository(db) {
  return {
    async list({ start = null, end = null, facultyId = null, academicYear = null, includeAssignmentTargets = false, includeUnresolvedAssignmentLabels = false } = {}) {
      const predicates = [];
      const params = {};

      if (academicYear !== null) {
        params.academicYear = canonicalAcademicYear(academicYear);
        predicates.push('c.AcademicYear = @academicYear');
      }

      if (start && end) {
        predicates.push('c.SessionDate >= @start', 'c.SessionDate < @end');
        params.start = start;
        params.end = end;
      }

      if (facultyId) {
        predicates.push('EXISTS (SELECT 1 FROM paws.SessionAssignment sa WHERE sa.SessionId = c.SessionId AND sa.FacultyId = @facultyId)');
        params.facultyId = facultyId;
      }

      const where = predicates.length ? ' WHERE ' + predicates.join(' AND ') : '';
      const assignmentProjection = includeAssignmentTargets
        ? `COALESCE((SELECT sa.FacultyId AS facultyId, sa.TeachingRole AS teachingRole, ${includeUnresolvedAssignmentLabels?'f.DisplayName AS displayName, sa.SourceFacultyName AS sourceFacultyName':facultyDisplayNameSql()+' AS displayName'}, f.Active AS active
                       FROM paws.SessionAssignment sa
                       LEFT JOIN paws.Faculty f ON f.FacultyId = sa.FacultyId
                      WHERE sa.SessionId = c.SessionId${includeUnresolvedAssignmentLabels?'':' AND sa.FacultyId IS NOT NULL'}
                      FOR JSON PATH, INCLUDE_NULL_VALUES), N'[]') AS assignmentsJson,
            (SELECT COUNT_BIG(*) FROM paws.SessionAssignment unresolved WHERE unresolved.SessionId = c.SessionId AND unresolved.FacultyId IS NULL) AS unresolvedAssignmentCount`
        : `CAST(N'[]' AS nvarchar(max)) AS assignmentsJson, CAST(0 AS bigint) AS unresolvedAssignmentCount`;
      const rows = await db.query(
        `SELECT
            c.SessionId AS id,
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
            COALESCE((SELECT STRING_AGG(CONVERT(nvarchar(max),
              COALESCE(NULLIF(${facultyDisplayNameSql()},N''),LTRIM(RTRIM(REPLACE(sn.SourceFacultyName,N',',N' '))))), N'; ')
              WITHIN GROUP (ORDER BY sn.SessionAssignmentId) FROM paws.SessionAssignment sn
              LEFT JOIN paws.Faculty f ON f.FacultyId = sn.FacultyId
              WHERE sn.SessionId=c.SessionId AND NOT EXISTS(SELECT 1 FROM paws.SessionalAssignment matched WHERE matched.SessionId=sn.SessionId AND matched.SessionAssignmentId=sn.SessionAssignmentId)),
              CASE WHEN EXISTS(SELECT 1 FROM paws.SessionalAssignment contributor WHERE contributor.SessionId=c.SessionId) THEN N'' ELSE REPLACE(c.InstructorNames,N',',N' ') END) AS instructorNames,
            (SELECT contributor.ContributorName AS name, contributor.ContributorLabel AS label FROM paws.SessionalAssignment contributor WHERE contributor.SessionId=c.SessionId ORDER BY contributor.ContributorName FOR JSON PATH) AS sessionalContributorsJson,
            ${assignmentProjection}
         FROM paws.vCalendarSession c${where}
         ORDER BY c.SessionDate, c.StartTime, c.SessionId`,
        params
      );
      return rows.map(({ sessionalContributorsJson, ...row }) => {
        const contributors = JSON.parse(sessionalContributorsJson || '[]');
        const labels = contributors.map(contributor => {
          const person = names.format(contributor.name);
          const label = String(contributor.label || 'Sessional').replace(/[;\r\n]+/g, ' · ');
          return `${person} (${label === 'Sessional' ? 'Sessional' : 'Sessional · ' + label})`;
        });
        return { ...row, instructorNames: [names.formatList(row.instructorNames), ...labels].filter(Boolean).join('; ') };
      });
    },

    async updateExisting({ sessionId, patch, actorFirebaseUid, actorName = null } = {}) {
      const rows = await db.query(
        `EXEC paws_api.UpdateCalendarSession
          @SessionId = @sessionId,
          @PatchJson = @patchJson,
          @ActorFirebaseUid = @actorFirebaseUid,
          @ActorName = @actorName`,
        { sessionId, patchJson: JSON.stringify(patch), actorFirebaseUid, actorName }
      );
      return rows[0] || null;
    },

    async createNew({ session, actorFirebaseUid, actorName = null } = {}) {
      const rows = await db.query(
        `EXEC paws_api.CreateCalendarSession
          @SessionJson = @sessionJson,
          @ActorFirebaseUid = @actorFirebaseUid,
          @ActorName = @actorName`,
        { sessionJson: JSON.stringify(session), actorFirebaseUid, actorName }
      );
      return rows[0] || null;
    },

    async createBatch({ requestId, sessions, actorFirebaseUid, actorName = null } = {}) {
      return db.query(
        `EXEC paws_api.CreateCalendarSessionBatch
          @RequestId = @requestId,
          @SessionsJson = @sessionsJson,
          @ActorFirebaseUid = @actorFirebaseUid,
          @ActorName = @actorName`,
        { requestId, sessionsJson: JSON.stringify(sessions), actorFirebaseUid, actorName }
      );
    },

    async replaceAssignments({ sessionId, assignments, actorFirebaseUid, actorName = null } = {}) {
      const rows = await db.query(
        `EXEC paws_api.ReplaceCalendarSessionAssignments
          @SessionId = @sessionId,
          @AssignmentsJson = @assignmentsJson,
          @ActorFirebaseUid = @actorFirebaseUid,
          @ActorName = @actorName`,
        { sessionId, assignmentsJson: JSON.stringify(assignments), actorFirebaseUid, actorName }
      );
      return rows[0] || null;
    }
  };
}

module.exports = { createSqlSessionRepository };
