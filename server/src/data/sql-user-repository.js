'use strict';

function createSqlUserRepository(db) {
  return {
    async findByUid(uid, timing) {
      const rows = await db.query(
        `SELECT u.FirebaseUid AS firebaseUid,
                u.Email AS email,
                u.DisplayName AS displayName,
                u.BaseRole AS baseRole,
                u.FacultyId AS facultyId,
                CASE WHEN LOWER(LTRIM(RTRIM(u.BaseRole))) IN (N'faculty',N'hicc',N'visc')
                  AND (f.FacultyId IS NULL OR f.Active=0 OR
                    (f.ActivationDate IS NOT NULL AND f.ActivationDate>CONVERT(date,SYSDATETIMEOFFSET() AT TIME ZONE 'Mountain Standard Time')))
                  THEN CAST(0 AS bit) ELSE u.Active END AS active,
                u.MustChangePassword AS mustChangePassword
         FROM paws.UserProfile u
         LEFT JOIN paws.Faculty f ON f.FacultyId=u.FacultyId
         WHERE u.FirebaseUid = @uid`,
        { uid },
        { timing, queryMetric: 'sql_user_query' }
      );
      return rows[0] || null;
    }
  };
}

module.exports = { createSqlUserRepository };
