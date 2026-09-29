'use strict';

function createSqlTeachingAssignmentRepository({query}) {
  if (typeof query !== 'function') throw new Error('A SQL query function is required.');
  const run = (sql, params = {}) => query(sql, params);
  return Object.freeze({
    getActorResponsibilities({facultyId, academicYear, asOfDate}) {
      return run(`SELECT tr.ResponsibilityId, tr.Kind, tr.Label, tr.Active, tra.AcademicYear, tra.FacultyId, tra.ActiveDate, tra.ExpirationDate FROM paws.TeachingResponsibility tr INNER JOIN paws.TeachingResponsibilityAssignee tra ON tra.ResponsibilityId = tr.ResponsibilityId WHERE tra.FacultyId = @facultyId AND tra.AcademicYear = @academicYear AND tr.Active = 1 AND tra.ActiveDate <= @asOfDate AND @asOfDate < tra.ExpirationDate ORDER BY tr.ResponsibilityId`, {facultyId, academicYear, asOfDate});
    },
    getResponsibility(responsibilityId) {
      return run(`SELECT ResponsibilityId, Kind, Label, Active FROM paws.TeachingResponsibility WHERE ResponsibilityId = @responsibilityId`, {responsibilityId});
    },
    getResponsibilityScopes(responsibilityId) {
      return run(`SELECT trs.ResponsibilityScopeId, trs.HiccResponsibilityId, trs.HiccResponsibilityKind, c.CourseId, c.CourseCode, s.SubjectId, s.SubjectKey FROM paws.TeachingResponsibilityScope trs INNER JOIN paws.Course c ON c.CourseId = trs.CourseId LEFT JOIN paws.Subject s ON s.SubjectId = trs.SubjectId WHERE trs.HiccResponsibilityId = @responsibilityId AND trs.HiccResponsibilityKind = N'hicc' ORDER BY c.CourseCode, s.SubjectKey`, {responsibilityId});
    },
    getResponsibilityAssignees(responsibilityId, academicYear) {
      return run(`SELECT ResponsibilityAssigneeId, ResponsibilityId, AcademicYear, FacultyId, ActiveDate, ExpirationDate FROM paws.TeachingResponsibilityAssignee WHERE ResponsibilityId = @responsibilityId AND AcademicYear = @academicYear ORDER BY ActiveDate, ExpirationDate, FacultyId`, {responsibilityId, academicYear});
    },
    getGroupsForResponsibility(responsibilityId) {
      return run(`SELECT DISTINCT g.GroupId, g.Name, g.LeaderViscResponsibilityId, g.LeaderViscResponsibilityKind, g.Active FROM paws.TeachingAssignmentGroup g LEFT JOIN paws.TeachingAssignmentGroupHicc gh ON gh.GroupId = g.GroupId WHERE g.Active = 1 AND (g.LeaderViscResponsibilityId = @responsibilityId OR gh.HiccResponsibilityId = @responsibilityId) ORDER BY g.GroupId`, {responsibilityId});
    },
    getPackage(academicYear, groupId, hiccResponsibilityId) {
      return run(`SELECT TeachingAssignmentPackageId, PackageIdentity, AcademicYear, GroupId, HiccResponsibilityId, HiccResponsibilityKind, Status, WorkingRevision, SubmittedWorkingRevision, ViscApprovedWorkingRevision, ReviewFingerprint, ViscApprovedFingerprint, ViscReviewComment, CreatedAtUtc, UpdatedAtUtc FROM paws.TeachingAssignmentPackage WHERE AcademicYear = @academicYear AND GroupId = @groupId AND HiccResponsibilityId = @hiccResponsibilityId`, {academicYear, groupId, hiccResponsibilityId});
    },
    listPackagesForActor(facultyId, academicYear, asOfDate) {
      return run(`SELECT DISTINCT p.TeachingAssignmentPackageId, p.PackageIdentity, p.AcademicYear, p.GroupId, p.HiccResponsibilityId, p.HiccResponsibilityKind, p.Status, p.WorkingRevision, p.SubmittedWorkingRevision, p.ViscApprovedWorkingRevision, p.ReviewFingerprint, p.ViscApprovedFingerprint, p.ViscReviewComment, p.CreatedAtUtc, p.UpdatedAtUtc FROM paws.TeachingAssignmentPackage p INNER JOIN paws.TeachingAssignmentGroup g ON g.GroupId = p.GroupId AND g.Active = 1 LEFT JOIN paws.TeachingAssignmentGroupHicc gh ON gh.GroupId = p.GroupId AND gh.HiccResponsibilityId = p.HiccResponsibilityId INNER JOIN paws.TeachingResponsibilityAssignee tra ON tra.AcademicYear = p.AcademicYear AND tra.FacultyId = @facultyId AND tra.ActiveDate <= @asOfDate AND @asOfDate < tra.ExpirationDate INNER JOIN paws.TeachingResponsibility tr ON tr.ResponsibilityId = tra.ResponsibilityId AND tr.Active = 1 WHERE p.AcademicYear = @academicYear AND ((tra.ResponsibilityId = p.HiccResponsibilityId AND tr.Kind = N'hicc' AND gh.GroupId IS NOT NULL) OR (tra.ResponsibilityId = g.LeaderViscResponsibilityId AND tr.Kind = N'visc')) ORDER BY p.PackageIdentity`, {facultyId, academicYear, asOfDate});
    },
    getWorkingSessionOwnership(sessionId) {
      return run(`SELECT tso.SessionOwnershipId, tso.SessionId, tso.AcademicYear, tso.TeachingAssignmentGroupId, tso.ResponsibleHiccResponsibilityId, tso.TeachingAssignmentPackageId, tso.SubjectId, p.PackageIdentity FROM paws.TeachingSessionOwnership tso INNER JOIN paws.TeachingAssignmentPackage p ON p.AcademicYear = tso.AcademicYear AND p.GroupId = tso.TeachingAssignmentGroupId AND p.HiccResponsibilityId = tso.ResponsibleHiccResponsibilityId AND p.TeachingAssignmentPackageId = tso.TeachingAssignmentPackageId WHERE tso.SessionId = @sessionId`, {sessionId});
    }
  });
}

module.exports = {createSqlTeachingAssignmentRepository};
