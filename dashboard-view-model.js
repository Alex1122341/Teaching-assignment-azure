(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PAWS_DASHBOARD_VIEW_MODEL = api;
})(typeof window === 'undefined' ? globalThis : window, function() {
  'use strict';

function number(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeCurriculumYear(value) {
  const raw = text(value);
  if (!raw) return 'Unassigned year';
  const match = raw.match(/^(?:year\s*)?([1-4])$/i);
  return match ? `Year ${match[1]}` : raw;
}

function yearSortValue(value) {
  const match = text(value).match(/(\d{1,4})/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function compareText(left, right) {
  return text(left).localeCompare(text(right), undefined, { numeric: true, sensitivity: 'base' });
}

function compareAssignment(left, right) {
  return compareText(left.date, right.date)
    || compareText(left.startTime, right.startTime)
    || compareText(left.sessionId, right.sessionId)
    || compareText(left.sessionAssignmentId, right.sessionAssignmentId);
}

function teachingDoeEvidence(assignment = {}) {
  const applicable = assignment.doeApplicable === false ? false : true;
  const stored = number(assignment.doeCredit);
  const calculated = number(assignment.calculatedDoeCredit);
  const effective = Object.prototype.hasOwnProperty.call(assignment, 'effectiveDoeCredit')
    ? number(assignment.effectiveDoeCredit)
    : stored;
  return {
    applicable,
    stored,
    calculated,
    effective,
    status: text(assignment.doeCalculationStatus || assignment.doeStatus) || (applicable ? (effective === null ? 'needs-review' : 'stored') : 'not-applicable'),
    reviewReason: text(assignment.doeReviewReason) || null
  };
}

function effectiveRoleDoe(role = {}) {
  const mapped = number(role.doeMappedValue);
  const override = role.doeOverrideValue === null || role.doeOverrideValue === undefined
    ? null
    : number(role.doeOverrideValue);
  const calculated = number(role.calculatedDoe);
  const effective = Object.prototype.hasOwnProperty.call(role, 'effectiveDoe')
    ? number(role.effectiveDoe)
    : (override !== null ? override : mapped !== null ? mapped : calculated);
  return {
    mapped,
    override,
    calculated,
    effective,
    source: text(role.doeSource) || (override !== null ? 'override' : mapped !== null ? 'mapped' : calculated !== null ? 'calculator' : 'missing'),
    status: text(role.doeCalculationStatus) || (effective === null ? 'needs-review' : 'stored'),
    reviewReason: text(role.doeReviewReason) || null
  };
}

function groupTeachingAssignments(assignments) {
  const years = new Map();
  for (const original of Array.isArray(assignments) ? assignments : []) {
    const assignment = original && typeof original === 'object' ? { ...original } : {};
    const curriculumYear = normalizeCurriculumYear(assignment.curriculumYear);
    const courseCode = text(assignment.courseCode) || 'Course unavailable';
    let year = years.get(curriculumYear);
    if (!year) {
      year = { curriculumYear, courses: [] };
      years.set(curriculumYear, year);
    }
    let course = year.courses.find(item => item.courseCode === courseCode);
    if (!course) {
      course = { courseCode, courseName: text(assignment.courseName), assignments: [] };
      year.courses.push(course);
    }
    if (!course.courseName && text(assignment.courseName)) course.courseName = text(assignment.courseName);
    course.assignments.push(assignment);
  }

  return [...years.values()]
    .sort((left, right) => yearSortValue(left.curriculumYear) - yearSortValue(right.curriculumYear) || compareText(left.curriculumYear, right.curriculumYear))
    .map(year => {
      const courses = year.courses.sort((left, right) => compareText(left.courseCode, right.courseCode)).map(course => {
        const assignmentsSorted = course.assignments.sort(compareAssignment);
        const creditedHours = assignmentsSorted.reduce((sum, assignment) => {
          const value = number(assignment.creditedHours);
          return value === null ? sum : sum + value;
        }, 0);
        const evidence = assignmentsSorted.map(teachingDoeEvidence);
        const applicableEvidence = evidence.filter(item => item.applicable);
        const resolvedEvidence = applicableEvidence.filter(item => item.effective !== null);
        const storedDoeCount = evidence.filter(item => item.stored !== null).length;
        const notApplicableDoeCount = evidence.filter(item => !item.applicable).length;
        const missing = applicableEvidence.length - resolvedEvidence.length;
        const doeTotal = applicableEvidence.length === 0
          ? 0
          : resolvedEvidence.length === 0
            ? null
            : resolvedEvidence.reduce((sum, item) => sum + item.effective, 0);
        return {
          ...course,
          assignments: assignmentsSorted,
          assignmentCount: assignmentsSorted.length,
          creditedHours,
          doeTotal,
          recordedDoeCount: storedDoeCount,
          resolvedDoeCount: resolvedEvidence.length,
          notApplicableDoeCount,
          doeStatus: assignmentsSorted.length === 0 ? 'none' : missing ? 'needs-review' : applicableEvidence.length === 0 ? 'not-applicable' : 'complete',
          missingDoeCount: missing
        };
      });
      return {
        ...year,
        courses,
        assignmentCount: courses.reduce((sum, course) => sum + course.assignmentCount, 0),
        sessionCount: courses.reduce((sum, course) => sum + course.assignmentCount, 0),
        creditedHours: courses.reduce((sum, course) => sum + course.creditedHours, 0)
      };
    });
}

function summarizeDoe(detail = {}) {
  const teachingAssignments = Array.isArray(detail.teachingAssignments) ? detail.teachingAssignments : [];
  const roles = Array.isArray(detail.roles) ? detail.roles : [];
  const teachingEvidence = teachingAssignments.map(teachingDoeEvidence);
  const teachingApplicable = teachingEvidence.filter(item => item.applicable);
  const teachingResolved = teachingApplicable.filter(item => item.effective !== null);
  const teachingRecorded = teachingEvidence.filter(item => item.stored !== null);
  const roleEvidence = roles.map(role => effectiveRoleDoe(role));
  const roleResolved = roleEvidence.filter(item => item.effective !== null);
  const roleRecorded = roleEvidence.filter(item => item.mapped !== null || item.override !== null);
  const teachingLineCount = teachingEvidence.length;
  const teachingNotApplicableCount = teachingEvidence.filter(item => !item.applicable).length;
  const teachingApplicableCount = teachingApplicable.length;
  const roleLineCount = roleEvidence.length;
  const teachingMissingCount = teachingApplicableCount - teachingResolved.length;
  const roleMissingCount = roleLineCount - roleResolved.length;
  const teachingDoe = teachingApplicableCount === 0 ? 0 : (teachingResolved.length === 0 ? null : teachingResolved.reduce((sum, item) => sum + item.effective, 0));
  const roleDoe = roleLineCount === 0 ? 0 : (roleResolved.length === 0 ? null : roleResolved.reduce((sum, item) => sum + item.effective, 0));
  const effectiveValues = [...teachingResolved.map(item => item.effective), ...roleResolved.map(item => item.effective)];
  const reviewRelevantLineCount = teachingApplicableCount + roleLineCount;
  const effectiveDoeTotal = reviewRelevantLineCount === 0
    ? 0
    : effectiveValues.length === 0 ? null : effectiveValues.reduce((sum, value) => sum + value, 0);
  return {
    teachingDoe,
    roleDoe,
    recordedDoeTotal: effectiveDoeTotal,
    effectiveDoeTotal,
    teachingLineCount,
    teachingApplicableCount,
    teachingNotApplicableCount,
    teachingRecordedCount: teachingRecorded.length,
    teachingResolvedCount: teachingResolved.length,
    roleLineCount,
    roleRecordedCount: roleRecorded.length,
    roleResolvedCount: roleResolved.length,
    teachingMissingCount,
    roleMissingCount,
    partial: teachingMissingCount > 0 || roleMissingCount > 0,
    reviewReasons: [
      ...teachingEvidence.filter(item => item.applicable && item.effective === null && item.reviewReason).map(item => item.reviewReason),
      ...roleEvidence.filter(item => item.effective === null && item.reviewReason).map(item => item.reviewReason)
    ]
  };
}

function formatDoe(value) {
  const parsed = number(value);
  return parsed === null ? 'DOE unavailable' : `${parsed.toFixed(2)}%`;
}

  return { groupTeachingAssignments, teachingDoeEvidence, effectiveRoleDoe, summarizeDoe, formatDoe, normalizeCurriculumYear };
});
