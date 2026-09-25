'use strict';
function createSqlUserRepository(db){return {async findByUid(uid){const rows=await db.query(`SELECT FirebaseUid AS firebaseUid, DisplayName AS displayName, BaseRole AS baseRole, FacultyId AS facultyId, Active AS active FROM paws.UserProfile WHERE FirebaseUid = @uid`,{uid});return rows[0]||null;}};}
module.exports={createSqlUserRepository};
