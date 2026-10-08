'use strict';

const { resolveTeachingDoe, resolveRoleDoe } = require('../domain/doe-calculator');

function resolutionEvidence(resolved) {
  return {
    resultDoe: resolved.effectiveDoe, calculatedDoe: resolved.calculatedDoe,
    storedDoe: resolved.storedDoe ?? resolved.mappedDoe ?? null, overrideDoe: resolved.overrideDoe ?? null,
    doeSource: resolved.source, status: resolved.source === 'missing' ? 'needs_review' : resolved.status,
    applicable: resolved.applicable, requiresReview: resolved.requiresReview === true,
    reviewReason: resolved.reviewReason, ruleKey: resolved.ruleCode,
    reference: { title: resolved.sourceReference || resolved.calculatorSource }, calculatorVersion: resolved.calculatorVersion,
    errorCode: resolved.reviewReason ? resolved.reviewReason.replace(/-/g, '_').toUpperCase() : null
  };
}

const text = value => value === null || value === undefined ? '' : String(value).trim();
const number = value => value === null || value === undefined || value === '' ? null : Number(value);
const bool = value => value === true || value === 1 || value === '1';
const parseObject = value => {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try { const result = JSON.parse(value); return result && typeof result === 'object' && !Array.isArray(result) ? result : null; }
  catch (_) { return null; }
};

const RESERVE_PARAMETERS = new Set([
  'splitThreshold', 'splitRatio', 'highTeachingTraineeCeiling',
  'teachingFocusedTraineeCeiling', 'rollingAverageYears'
]);

function createSqlDoeWorksheetRepository(db) {
  if (!db || typeof db.query !== 'function') throw new TypeError('A SQL query adapter is required.');

  async function loadSources(academicYear, facultyId = null) {
    const params = { academicYear, facultyId: text(facultyId), limit: 500 };
    const [facultyRows, targetRows, policyRows, reserveRows, assignmentRows, sessionRows, legacyRoleRows] = await Promise.all([
      db.query(
        `SELECT TOP (@limit) f.FacultyId AS facultyId, f.DisplayName AS displayName, f.Stream AS stream, f.Active AS facultyActive
           FROM paws.Faculty AS f
          WHERE (@facultyId=N'' OR f.FacultyId=TRY_CONVERT(uniqueidentifier,@facultyId))
          ORDER BY f.DisplayName, f.FacultyId`, params),
      db.query(
        `SELECT t.FacultyId AS facultyId, t.ContractTeachingDoe AS contractTeachingDoe,
                t.OverrideDoe AS overrideDoe, t.OverrideReason AS overrideReason,
                t.OverrideNotes AS overrideNotes, t.EffectiveTargetDoe AS effectiveTargetDoe,
                t.Source AS source, t.PolicyVersionId AS policyVersionId
           FROM paws.DoeFacultyTarget AS t
          WHERE t.AcademicYear=@academicYear AND t.Active=1
            AND (@facultyId=N'' OR t.FacultyId=TRY_CONVERT(uniqueidentifier,@facultyId))`, params),
      db.query(
        `SELECT PolicyVersionId AS policyVersionId, AcademicYear AS academicYear, Status AS status,
                Revision AS revision, VersionLabel AS versionLabel
           FROM paws.DoePolicyVersion
          WHERE AcademicYear=@academicYear AND Status=N'active'`, params),
      db.query(
        `SELECT p.Name AS name, p.ValueNumber AS valueNumber, p.ValueText AS valueText
           FROM paws.DoeRuleParameter AS p
           INNER JOIN paws.DoePolicyRule AS r ON r.RuleId=p.RuleId
           INNER JOIN paws.DoePolicyVersion AS v ON v.PolicyVersionId=r.PolicyVersionId
          WHERE v.AcademicYear=@academicYear AND v.Status=N'active'
            AND r.Enabled=1 AND r.ReviewStatus=N'approved'`, params),
      db.query(
        `SELECT a.AssignmentFactId AS assignmentFactId, a.FacultyId AS facultyId,
                a.AcademicYear AS academicYear, a.Category AS category, a.RoleType AS roleType,
                a.ActivityType AS activityType, a.ScopeText AS scopeText, a.CourseCode AS courseCode,
                a.SubjectKey AS subjectKey, a.SessionId AS sessionId, a.SessionAssignmentId AS sessionAssignmentId,
                a.SourceEntityType AS sourceEntityType, a.SourceEntityId AS sourceEntityId, a.Notes AS notes,
                a.Active AS active, a.Revision AS revision, a.CurrentCalculationId AS currentCalculationId,
                c.PolicyVersionId AS policyVersionId, c.RuleId AS ruleId, c.RuleKey AS ruleKey,
                c.FactsSnapshotJson AS factsSnapshotJson, c.InputsSnapshotJson AS inputsSnapshotJson,
                c.ParameterSnapshotJson AS parameterSnapshotJson, c.RuleSnapshotJson AS ruleSnapshotJson,
                c.ReferenceSnapshotJson AS referenceSnapshotJson, c.CalculationText AS calculationText,
                c.ResultDoe AS resultDoe, c.CalculationStatus AS calculationStatus, c.CalculatedAtUtc AS calculatedAt
           FROM paws.DoeAssignmentFact AS a
           LEFT JOIN paws.DoeCalculationRecord AS c ON c.CalculationId=a.CurrentCalculationId
          WHERE a.AcademicYear=@academicYear AND a.Active=1
            AND (@facultyId=N'' OR a.FacultyId=TRY_CONVERT(uniqueidentifier,@facultyId))
          ORDER BY a.FacultyId, a.CreatedAtUtc, a.AssignmentFactId`, params),
      db.query(
        `SELECT sa.SessionAssignmentId AS sessionAssignmentId, sa.SessionId AS sessionId,
                sa.FacultyId AS facultyId, sa.TeachingRole AS teachingRole,
                sa.DoeCredit AS doeCredit, sa.DoeStatus AS doeStatus,
                sa.CreditedHours AS creditedHours, sa.DoeQuantity AS doeQuantity,
                s.SessionType AS sessionType
           FROM paws.SessionAssignment AS sa
           INNER JOIN paws.vCalendarSession AS s ON s.SessionId=sa.SessionId
          WHERE s.AcademicYear=@academicYear AND sa.FacultyId IS NOT NULL
            AND (@facultyId=N'' OR sa.FacultyId=TRY_CONVERT(uniqueidentifier,@facultyId))
            AND NOT EXISTS (SELECT 1 FROM paws.DoeAssignmentFact AS a
                             WHERE a.SessionAssignmentId=sa.SessionAssignmentId AND a.Active=1)
          ORDER BY sa.FacultyId, s.SessionDate, sa.SessionAssignmentId`, params),
      db.query(
        `SELECT r.RoleAssignmentId AS roleAssignmentId, r.FacultyId AS facultyId,
                r.RoleType AS roleType, r.CourseOrSubjectOrRotation AS scopeText,
                r.DoeMappedValue AS doeMappedValue, r.DoeOverrideValue AS doeOverrideValue,
                r.DoeOverrideReason AS doeOverrideReason, r.SpecialNotes AS specialNotes,
                r.EffectiveDate AS effectiveDate, r.ExpirationDate AS expirationDate,
                r.AcademicYear AS academicYear, r.CourseName AS courseName, r.Details AS details
           FROM paws.RoleAssignment AS r
          WHERE (r.AcademicYear=@academicYear OR r.AcademicYear IS NULL)
            AND r.FacultyId IS NOT NULL AND (@facultyId=N'' OR r.FacultyId=TRY_CONVERT(uniqueidentifier,@facultyId))
          ORDER BY r.FacultyId, r.RoleAssignmentId`, params)
    ]);

    const policy = policyRows.length === 1 ? policyRows[0] : null;
    const targets = new Map(targetRows.map(row => [text(row.facultyId).toLowerCase(), row]));
    const reservePolicy = {};
    for (const row of reserveRows) {
      const name = text(row.name);
      if (RESERVE_PARAMETERS.has(name)) reservePolicy[name] = row.valueNumber === null ? row.valueText : Number(row.valueNumber);
    }
    const assignmentsByFaculty = new Map();
    const pushLine = (faculty, line) => {
      const key = text(faculty).toLowerCase();
      if (!assignmentsByFaculty.has(key)) assignmentsByFaculty.set(key, []);
      assignmentsByFaculty.get(key).push(line);
    };

    for (const row of assignmentRows) {
      const facts = parseObject(row.factsSnapshotJson) || {};
      const reference = parseObject(row.referenceSnapshotJson);
      pushLine(row.facultyId, {
        lineId: text(row.assignmentFactId), assignmentFactId: text(row.assignmentFactId),
        sourceEntityType: text(row.sourceEntityType), sourceEntityId: text(row.sourceEntityId),
        category: text(row.category), roleType: text(row.roleType), activityType: text(row.activityType),
        scopeText: text(row.scopeText), courseCode: text(row.courseCode), subjectKey: text(row.subjectKey),
        notes: text(row.notes), active: bool(row.active), revision: Number(row.revision || 0),
        sessionId: text(row.sessionId), resultDoe: number(row.resultDoe), status: text(row.calculationStatus) || 'needs_review',
        policyVersionId: text(row.policyVersionId), ruleId: text(row.ruleId), ruleKey: text(row.ruleKey),
        calculationId: text(row.currentCalculationId),
        facts, inputs: parseObject(row.inputsSnapshotJson), parameters: parseObject(row.parameterSnapshotJson),
        rule: parseObject(row.ruleSnapshotJson), reference, calculationText: text(row.calculationText),
        calculatedAt: row.calculatedAt || null,
        errorCode: row.calculationStatus && text(row.calculationStatus).toLowerCase() !== 'calculated' ? text(row.calculationStatus).toUpperCase() : null
      });
    }

    for (const row of sessionRows) pushLine(row.facultyId, {
      lineId: text(row.sessionAssignmentId), sourceEntityType: 'legacy_session_assignment',
      sourceEntityId: text(row.sessionAssignmentId), category: 'teaching', roleType: text(row.teachingRole),
      sessionId: text(row.sessionId), legacyResultDoe: number(row.doeCredit), legacyDoeStatus: text(row.doeStatus),
      creditedHours: number(row.creditedHours), doeQuantity: number(row.doeQuantity),
      ...resolutionEvidence(resolveTeachingDoe(row))
    });

    for (const row of legacyRoleRows) {
      if (assignmentRows.some(a => text(a.facultyId).toLowerCase() === text(row.facultyId).toLowerCase()
          && text(a.sourceEntityId).toLowerCase() === text(row.roleAssignmentId).toLowerCase())) continue;
      pushLine(row.facultyId, {
      lineId: text(row.roleAssignmentId), sourceEntityType: 'legacy_role_assignment',
      sourceEntityId: text(row.roleAssignmentId), category: 'role', roleType: text(row.roleType),
      scopeText: text(row.scopeText),
      legacyResultDoe: number(row.doeOverrideValue) ?? number(row.doeMappedValue), notes: text(row.specialNotes),
      ...resolutionEvidence(resolveRoleDoe({ ...row, academicYear: row.academicYear || academicYear, courseOrSubjectOrRotation: row.scopeText })),
      overrideReason: text(row.doeOverrideReason), effectiveDate: row.effectiveDate || null, expirationDate: row.expirationDate || null
    });
    }

    return facultyRows.map(row => {
      const key = text(row.facultyId).toLowerCase(), targetRow = targets.get(key);
      const lines = assignmentsByFaculty.get(key) || [];
      const versions = [...new Set(lines.map(line => text(line.policyVersionId)).filter(Boolean))];
      const policyStatus = versions.some(versionId => versionId !== text(policy?.policyVersionId)) ? 'mixed'
        : lines.some(line => line.policyVersionId && !policy?.policyVersionId) ? 'missing_version' : 'consistent';
      return {
        facultyId: text(row.facultyId), displayName: text(row.displayName), stream: text(row.stream), facultyActive: bool(row.facultyActive),
        academicYear, policyStatus,
        target: targetRow ? {
          contractTeachingDoe: number(targetRow.contractTeachingDoe), overrideDoe: number(targetRow.overrideDoe),
          overrideReason: text(targetRow.overrideReason), overrideNotes: text(targetRow.overrideNotes),
          effectiveTargetDoe: number(targetRow.effectiveTargetDoe), source: text(targetRow.source),
          policyVersionId: text(targetRow.policyVersionId)
        } : { contractTeachingDoe: null, overrideDoe: null, effectiveTargetDoe: null },
        reservePolicy: { ...reservePolicy }, lines
      };
    });
  }

  return Object.freeze({
    async getFacultyWorksheetSource(facultyId, academicYear) {
      if (!text(facultyId)) throw new TypeError('Faculty ID is required.');
      return (await loadSources(academicYear, facultyId))[0] || null;
    },
    async listFacultyWorksheetSources(academicYear) {
      return loadSources(academicYear, null);
    }
  });
}

module.exports = { createSqlDoeWorksheetRepository };
