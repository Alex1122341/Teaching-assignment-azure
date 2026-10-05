'use strict';

function createSqlSessionRepository(db) {
  return {
    async list({ start = null, end = null, facultyId = null } = {}) {
      const predicates = [];
      const params = {};

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
      return db.query(
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
            c.InstructorNames AS instructorNames
         FROM paws.vCalendarSession c${where}
         ORDER BY c.SessionDate, c.StartTime, c.SessionId`,
        params
      );
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
    }
  };
}

module.exports = { createSqlSessionRepository };
