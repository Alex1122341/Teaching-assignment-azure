'use strict';

const SUBJECT_KEY = /^[a-z][a-z0-9_-]{0,63}$/;
const RESPONSIBILITY_ID = /^[a-z][a-z0-9_-]{0,63}$/;
const COURSE_CODE = /^[A-Z]{2,10} [0-9]{3,4}[A-Z]?$/;
const ACADEMIC_YEAR = /^(\d{4})-(\d{2})$/;

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function normalizeSubjectKey(value) { const key = text(value).toLowerCase(); return SUBJECT_KEY.test(key) ? key : ''; }
function normalizeCourseCode(value) { const code = text(value).replace(/\s+/g, ' ').toUpperCase(); return COURSE_CODE.test(code) ? code : ''; }

function subjectRecord(input = {}) {
  const subjectKey = normalizeSubjectKey(input.subjectKey), label = text(input.label);
  if (!subjectKey || !label || label.length > 100 || typeof input.active !== 'boolean') throw new Error('Invalid Subject record.');
  return Object.freeze({subjectKey, label, active: input.active});
}

function responsibilityRecord(input = {}) {
  const id = text(input.id), kind = text(input.kind).toLowerCase(), label = text(input.label);
  if (!RESPONSIBILITY_ID.test(id) || !['hicc', 'visc'].includes(kind) || !label || label.length > 120 || typeof input.active !== 'boolean') throw new Error('Invalid Teaching Responsibility record.');
  return Object.freeze({id, kind, label, active: input.active});
}

function academicYear(value) {
  const year = text(value), match = ACADEMIC_YEAR.exec(year);
  return match && Number(match[2]) === (Number(match[1]) + 1) % 100 ? year : '';
}
function canonicalId(value, field) {
  const id = text(value);
  if (!RESPONSIBILITY_ID.test(id)) throw new Error(`${field} must be a canonical identifier.`);
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
  const windows = rows.map(row => {
    const start = dateMs(row?.activeDate), end = dateMs(row?.expirationDate);
    if (start === null || end === null || end <= start) throw new Error('Temporal assignee expiration must be later than active date.');
    return {start, end};
  }).sort((a, b) => a.start - b.start || a.end - b.end);
  for (let index = 1; index < windows.length; index += 1) if (windows[index].start < windows[index - 1].end) throw new Error('Temporal assignee windows overlap.');
  return true;
}
function isPackageFresh(record = {}) {
  const approvedRevision = record.viscApprovedWorkingRevision, approvedFingerprint = text(record.viscApprovedFingerprint);
  if (approvedRevision === null || approvedRevision === undefined || approvedFingerprint === '') return true;
  return Number.isInteger(record.workingRevision) && Number.isInteger(approvedRevision) && record.workingRevision === approvedRevision && text(record.reviewFingerprint) === approvedFingerprint;
}
function packageMatches(record, session) {
  if (!record || !session || !isPackageFresh(record)) return false;
  const year = academicYear(session.academicYear);
  if (!year || record.academicYear !== year || record.groupId !== session.groupId || record.hiccResponsibilityId !== session.hiccResponsibilityId) return false;
  return record.packageIdentity === packageIdentity({academicYear: year, groupId: session.groupId, hiccResponsibilityId: session.hiccResponsibilityId});
}
function exactHiccScope(scopes, session) {
  const course = normalizeCourseCode(session?.courseCode);
  if (!course || !Array.isArray(scopes)) return false;
  const hasSubject = session.subjectKey !== null && session.subjectKey !== undefined && text(session.subjectKey) !== '';
  const subject = hasSubject ? normalizeSubjectKey(session.subjectKey) : null;
  if (hasSubject && !subject) return false;
  return scopes.some(scope => {
    const scopedCourse = normalizeCourseCode(scope?.courseCode), scopedHasSubject = scope?.subjectKey !== null && scope?.subjectKey !== undefined && text(scope.subjectKey) !== '';
    const scopedSubject = scopedHasSubject ? normalizeSubjectKey(scope.subjectKey) : null;
    return scopedCourse === course && scopedSubject === subject;
  });
}
function isFacultyCurrentAssignee(input = {}) {
  const actor = text(input.authenticatedFacultyId), responsibility = input.responsibility, group = input.group, session = input.session;
  if (!actor || !responsibility || !group || !session || responsibility.active !== true || group.active !== true) return false;
  let assignee = input.assignee;
  if (Array.isArray(input.assignees)) {
    try { validateTemporalAssignees(input.assignees); } catch (_) { return false; }
    const active = input.assignees.filter(row => isCurrentTemporalAssignee({...row, authenticatedFacultyId: actor, asOfDate: input.asOfDate}));
    if (active.length !== 1) return false;
    [assignee] = active;
  }
  if (!assignee || text(assignee.responsibilityId) !== text(responsibility.id) || !isCurrentTemporalAssignee({...assignee, authenticatedFacultyId: actor, asOfDate: input.asOfDate})) return false;
  if (!packageMatches(input.package, session)) return false;
  if (responsibility.kind === 'hicc') return Array.isArray(group.hiccResponsibilityIds) && group.hiccResponsibilityIds.includes(responsibility.id) && exactHiccScope(input.responsibilityScopes, session);
  if (responsibility.kind === 'visc') return group.leaderViscResponsibilityId === responsibility.id && Array.isArray(group.hiccResponsibilityIds) && group.hiccResponsibilityIds.includes(session.hiccResponsibilityId) && (!Array.isArray(input.responsibilityScopes) || input.responsibilityScopes.length === 0);
  return false;
}
function workingSessionOwnership(input = {}) {
  const year = academicYear(input.academicYear), groupId = canonicalId(input.groupId, 'groupId'), hiccResponsibilityId = canonicalId(input.hiccResponsibilityId, 'hiccResponsibilityId'), sessionId = text(input.sessionId);
  if (!year || !sessionId) throw new Error('Working session ownership requires a session and Academic Year.');
  return Object.freeze({sessionId, academicYear: year, groupId, hiccResponsibilityId, packageIdentity: packageIdentity({academicYear: year, groupId, hiccResponsibilityId}), subjectId: input.subjectId ?? null});
}

module.exports = Object.freeze({normalizeSubjectKey, normalizeCourseCode, subjectRecord, responsibilityRecord, packageIdentity, isCurrentTemporalAssignee, validateTemporalAssignees, isPackageFresh, isFacultyCurrentAssignee, workingSessionOwnership});
