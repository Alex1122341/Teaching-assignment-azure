'use strict';

const SUBJECT_KEY = /^[a-z][a-z0-9_-]{0,63}$/;
const CANONICAL_ID = /^[a-z][a-z0-9_-]{0,63}$/;
const COURSE_CODE = /^[A-Z]{2,10} [0-9]{3,4}[A-Z]?$/;
const ACADEMIC_YEAR = /^(\d{4})-(\d{2})$/;
const FINGERPRINT = /^[0-9a-f]{64}$/;

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function normalizeSubjectKey(value) { const key = text(value).toLowerCase(); return SUBJECT_KEY.test(key) ? key : ''; }
function normalizeCourseCode(value) { const code = text(value).replace(/\s+/g, ' ').toUpperCase(); return COURSE_CODE.test(code) ? code : ''; }
function validRevision(value) { return Number.isInteger(value) && value >= 0; }
function validFingerprint(value) { return typeof value === 'string' && FINGERPRINT.test(value); }

function subjectRecord(input = {}) {
  const subjectKey = normalizeSubjectKey(input.subjectKey), label = text(input.label);
  if (!subjectKey || !label || label.length > 100 || typeof input.active !== 'boolean') throw new Error('Invalid Subject record.');
  return Object.freeze({subjectKey, label, active: input.active});
}

function responsibilityRecord(input = {}) {
  const id = text(input.id), kind = text(input.kind).toLowerCase(), label = text(input.label);
  if (!CANONICAL_ID.test(id) || !['hicc', 'visc'].includes(kind) || !label || label.length > 120 || typeof input.active !== 'boolean') throw new Error('Invalid Teaching Responsibility record.');
  return Object.freeze({id, kind, label, active: input.active});
}

function academicYear(value) {
  const year = text(value), match = ACADEMIC_YEAR.exec(year);
  return match && Number(match[2]) === (Number(match[1]) + 1) % 100 ? year : '';
}

function canonicalId(value, field) {
  const id = text(value);
  if (!CANONICAL_ID.test(id)) throw new Error(`${field} must be a canonical identifier.`);
  return id;
}

function packageIdentity({academicYear: year, groupId, hiccResponsibilityId} = {}) {
  const normalizedYear = academicYear(year);
  if (!normalizedYear) throw new Error('Academic Year must use YYYY-YY.');
  return `ta-package-v1__${normalizedYear}__${canonicalId(groupId, 'groupId')}__${canonicalId(hiccResponsibilityId, 'hiccResponsibilityId')}`;
}

function dateMs(value) {
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw ? null : date.getTime();
}

function isCurrentTemporalAssignee(input = {}) {
  const start = dateMs(input.activeDate), end = dateMs(input.expirationDate), asOf = dateMs(input.asOfDate);
  return Boolean(input.enabled !== false && text(input.authenticatedFacultyId) && text(input.authenticatedFacultyId) === text(input.facultyId) && start !== null && end !== null && asOf !== null && end > start && asOf >= start && asOf < end);
}

function validateTemporalAssignees(rows) {
  if (!Array.isArray(rows)) throw new Error('Temporal assignees must be a list.');
  const byResponsibilityYear = new Map();
  rows.forEach(row => {
    const start = dateMs(row?.activeDate), end = dateMs(row?.expirationDate);
    if (start === null || end === null || end <= start) throw new Error('Temporal assignee expiration must be later than active date.');
    const key = `${text(row?.responsibilityId)}\u0000${text(row?.academicYear)}`;
    const bucket = byResponsibilityYear.get(key) || [];
    bucket.push({start, end});
    byResponsibilityYear.set(key, bucket);
  });
  for (const windows of byResponsibilityYear.values()) {
    windows.sort((a, b) => a.start - b.start || a.end - b.end);
    for (let index = 1; index < windows.length; index += 1) {
      if (windows[index].start < windows[index - 1].end) throw new Error('Temporal assignee windows overlap.');
    }
  }
  return true;
}

function isSubmittedRevisionFresh(record = {}) {
  return validRevision(record.workingRevision) && validRevision(record.submittedWorkingRevision) && record.submittedWorkingRevision === record.workingRevision && validFingerprint(record.reviewFingerprint);
}

function isApprovedRevisionFresh(record = {}) {
  return isSubmittedRevisionFresh(record) && validRevision(record.viscApprovedWorkingRevision) && record.viscApprovedWorkingRevision === record.workingRevision && validFingerprint(record.viscApprovedFingerprint) && record.viscApprovedFingerprint === record.reviewFingerprint;
}

function hasReviewMetadata(record = {}) {
  return record.submittedWorkingRevision !== null && record.submittedWorkingRevision !== undefined || record.reviewFingerprint !== null && record.reviewFingerprint !== undefined && record.reviewFingerprint !== '';
}

function hasApprovalMetadata(record = {}) {
  return record.viscApprovedWorkingRevision !== null && record.viscApprovedWorkingRevision !== undefined || record.viscApprovedFingerprint !== null && record.viscApprovedFingerprint !== undefined && record.viscApprovedFingerprint !== '';
}

function packageStateIntegrity(record = {}) {
  const status = text(record.status);
  if (!validRevision(record.workingRevision)) return false;
  if (status === 'draft' || status === 'changes_requested') {
    if (hasApprovalMetadata(record)) return isApprovedRevisionFresh(record);
    return !hasReviewMetadata(record) || isSubmittedRevisionFresh(record);
  }
  if (status === 'visc_review') return isSubmittedRevisionFresh(record);
  if (status === 'visc_approved' || status === 'submitted_to_adfad' || status === 'adfad_finalized') return isApprovedRevisionFresh(record);
  return false;
}

function isPackageFresh(record = {}) { return packageStateIntegrity(record); }

function packageIdentityMatches(record) {
  if (!record || !academicYear(record.academicYear) || !CANONICAL_ID.test(text(record.groupId)) || !CANONICAL_ID.test(text(record.hiccResponsibilityId))) return false;
  return record.packageIdentity === packageIdentity({academicYear: record.academicYear, groupId: record.groupId, hiccResponsibilityId: record.hiccResponsibilityId});
}

function packageMatchesForHicc(record, session) {
  const year = academicYear(session?.academicYear);
  return Boolean(isPackageFresh(record) && packageIdentityMatches(record) && year && record.academicYear === year && record.groupId === session.groupId && record.hiccResponsibilityId === session.hiccResponsibilityId);
}

function packageMatchesForVisc(record, session) {
  const year = academicYear(session?.academicYear);
  return Boolean(isPackageFresh(record) && packageIdentityMatches(record) && year && record.academicYear === year && record.groupId === session.groupId);
}

function optionalSubject(value) {
  const raw = text(value);
  if (!raw) return null;
  const normalized = normalizeSubjectKey(raw);
  return normalized || false;
}

function exactHiccScope(scopes, session) {
  const course = normalizeCourseCode(session?.courseCode), subject = optionalSubject(session?.subjectKey);
  if (!course || subject === false || !Array.isArray(scopes)) return false;
  return scopes.some(scope => {
    const scopedCourse = normalizeCourseCode(scope?.courseCode), scopedSubject = optionalSubject(scope?.subjectKey);
    return scopedCourse === course && (scopedSubject === null || scopedSubject === subject);
  });
}

function isFacultyCurrentAssignee(input = {}) {
  const actor = text(input.authenticatedFacultyId), responsibility = input.responsibility, group = input.group, session = input.session;
  if (!actor || !responsibility || !group || !session || responsibility.active !== true || group.active !== true || !['hicc', 'visc'].includes(responsibility.kind)) return false;
  const year = academicYear(session.academicYear);
  if (!year) return false;
  let assignee = input.assignee;
  if (Array.isArray(input.assignees)) {
    try { validateTemporalAssignees(input.assignees); } catch (_) { return false; }
    const active = input.assignees.filter(row => row.academicYear === year && text(row.responsibilityId) === text(responsibility.id) && isCurrentTemporalAssignee({...row, authenticatedFacultyId: actor, asOfDate: input.asOfDate}));
    if (active.length !== 1) return false;
    [assignee] = active;
  }
  if (!assignee || text(assignee.responsibilityId) !== text(responsibility.id) || text(assignee.academicYear) !== year || !isCurrentTemporalAssignee({...assignee, authenticatedFacultyId: actor, asOfDate: input.asOfDate})) return false;
  if (responsibility.kind === 'hicc') {
    return Array.isArray(group.hiccResponsibilityIds) && group.hiccResponsibilityIds.includes(responsibility.id) && packageMatchesForHicc(input.package, session) && exactHiccScope(input.responsibilityScopes, session);
  }
  return group.leaderViscResponsibilityId === responsibility.id && packageMatchesForVisc(input.package, session);
}

function workingSessionOwnership(input = {}) {
  const year = academicYear(input.academicYear), groupId = canonicalId(input.groupId, 'groupId'), hiccResponsibilityId = canonicalId(input.hiccResponsibilityId, 'hiccResponsibilityId'), sessionId = text(input.sessionId);
  if (!year || !sessionId) throw new Error('Working session ownership requires a session and Academic Year.');
  return Object.freeze({sessionId, academicYear: year, groupId, hiccResponsibilityId, packageIdentity: packageIdentity({academicYear: year, groupId, hiccResponsibilityId}), subjectId: input.subjectId ?? null});
}

module.exports = Object.freeze({normalizeSubjectKey, normalizeCourseCode, subjectRecord, responsibilityRecord, packageIdentity, isCurrentTemporalAssignee, validateTemporalAssignees, isSubmittedRevisionFresh, isApprovedRevisionFresh, packageStateIntegrity, isPackageFresh, exactHiccScope, isFacultyCurrentAssignee, workingSessionOwnership});
