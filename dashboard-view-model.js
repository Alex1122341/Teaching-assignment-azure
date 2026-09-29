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

function effectiveRoleDoe(role = {}) {
  const mapped = number(role.doeMappedValue);
  const override = role.doeOverrideValue === null || role.doeOverrideValue === undefined
    ? null
    : number(role.doeOverrideValue);
  const effective = Object.prototype.hasOwnProperty.call(role, 'effectiveDoe')
    ? number(role.effectiveDoe)
    : (override !== null ? override : mapped);
  return { mapped, override, effective, status: effective === null ? 'needs-review' : 'stored' };
}

function groupTeachingAssignments(assignments) {
  const years = new Map();
  for (const original of Array.isArray(assignments) ? assignments : []) {
    const assignment = original && typeof original === 'object' ? { ...original } : {};
    const curriculumYear = text(assignment.curriculumYear) || 'Unassigned year';
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
    .map(year => ({
      ...year,
      courses: year.courses.sort((left, right) => compareText(left.courseCode, right.courseCode)).map(course => {
        const assignmentsSorted = course.assignments.sort(compareAssignment);
        const creditedHours = assignmentsSorted.reduce((sum, assignment) => {
          const value = number(assignment.creditedHours);
          return value === null ? sum : sum + value;
        }, 0);
        const doeValues = assignmentsSorted.map(assignment => number(assignment.doeCredit)).filter(value => value !== null);
        const missing = assignmentsSorted.length - doeValues.length;
        return {
          ...course,
          assignments: assignmentsSorted,
          assignmentCount: assignmentsSorted.length,
          creditedHours,
          doeTotal: doeValues.reduce((sum, value) => sum + value, 0),
          doeStatus: missing ? 'needs-review' : 'complete',
          missingDoeCount: missing
        };
      })
    }));
}

function summarizeDoe(detail = {}) {
  const teachingAssignments = Array.isArray(detail.teachingAssignments) ? detail.teachingAssignments : [];
  const roles = Array.isArray(detail.roles) ? detail.roles : [];
  const teachingValues = teachingAssignments.map(assignment => number(assignment?.doeCredit));
  const roleValues = roles.map(role => effectiveRoleDoe(role));
  const teachingPresent = teachingValues.filter(value => value !== null);
  const rolePresent = roleValues.map(item => item.effective).filter(value => value !== null);
  const teachingMissingCount = teachingValues.length - teachingPresent.length;
  const roleMissingCount = roleValues.length - rolePresent.length;
  const teachingDoe = teachingPresent.reduce((sum, value) => sum + value, 0);
  const roleDoe = rolePresent.reduce((sum, value) => sum + value, 0);
  return {
    teachingDoe,
    roleDoe,
    recordedDoeTotal: teachingDoe + roleDoe,
    teachingMissingCount,
    roleMissingCount,
    partial: teachingMissingCount > 0 || roleMissingCount > 0
  };
}

function formatDoe(value) {
  const parsed = number(value);
  return parsed === null ? 'DOE unavailable' : `${parsed.toFixed(2)}%`;
}

  return { groupTeachingAssignments, effectiveRoleDoe, summarizeDoe, formatDoe };
});
