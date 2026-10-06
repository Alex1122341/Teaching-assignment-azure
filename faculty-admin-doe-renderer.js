(() => {
  'use strict';

  function create({ esc, number, formatDoe, display, effectiveRoleDoe, groupTeachingAssignments }) {
    function renderContractDoe(contractDoe, faculty = {}) {
      const data = contractDoe && typeof contractDoe === 'object' ? contractDoe : {};
      const categoryLabels = {
        scholarly_activity: 'Scholarly Activity', ppvm_cost_share: 'PPVM Cost Share',
        clinical_unsorted: 'Clinical - To Be Sorted', clinical_teaching: 'Clinical Teaching',
        clinical_activity_ppvm: 'Clinical Activity / PPVM', research: 'Research',
        contract_admin: 'Contract Admin', service_admin: 'Service / Admin', other: 'Other', onboarding: 'Onboarding'
      };
      const teaching = number(data.teachingDoe), fte = number(faculty?.fte), supplied = [];
      const rows = [`<tr><th scope="row">Teaching</th><td>${teaching === null ? 'Teaching DOE unavailable' : formatDoe(teaching)}</td></tr>`];
      if (teaching !== null) supplied.push(teaching);
      for (const [categoryCode, label] of Object.entries(categoryLabels)) {
        const allocation = (Array.isArray(data.allocations) ? data.allocations : []).find(item => item && item.categoryCode === categoryCode);
        const value = allocation ? number(allocation.allocationDoe) : null;
        if (value === null) continue;
        supplied.push(value); rows.push(`<tr><th scope="row">${esc(label)}</th><td>${formatDoe(value)}</td></tr>`);
      }
      const total = supplied.length ? supplied.reduce((sum, value) => sum + value, 0) : null;
      const source = data.policyVersionLabel || data.source || 'Faculty Master List DOE snapshot';
      const sourceLine = `Source: ${source}${data.sourceReference ? ` · ${data.sourceReference}` : ''}`;
      const totalLine = total === null ? 'DOE unavailable' : formatDoe(total);
      const fteReference = faculty?.fteSourceReference ? `FTE source: ${faculty.fteSourceReference}` : 'FTE source: not recorded';
      return `<section class="section wide contract-doe-allocation"><div class="section-title">Workload / Contract · ${esc(data.academicYear || 'Academic year unavailable')}</div><div class="doe-profile-source"><strong>FTE:</strong> ${fte === null ? 'Unavailable' : esc(fte.toFixed(2))} · ${esc(fteReference)}</div><div class="doe-profile-source">Contract DOE source: ${esc(sourceLine)}</div><div class="table-wrap"><table class="data-table"><tbody>${rows.join('')}<tr class="contract-doe-total"><th scope="row">Total Contract DOE</th><td>${esc(totalLine)}</td></tr></tbody></table></div>${teaching === null ? '<div class="doe-note warn-box">Teaching contract target is unavailable; displayed total includes only supplied allocations.</div>' : ''}</section>`;
    }

    function renderDoeRuleBook(ruleBook) {
      const data = ruleBook && typeof ruleBook === 'object' ? ruleBook : {};
      const rules = Array.isArray(data.rules) ? data.rules : [];
      const rows = rules.map(rule => `<tr><td>${esc(rule.category || '—')}</td><td>${esc(rule.ruleLabel || '—')}</td><td>${esc(rule.academicYearOrStage || 'All applicable years')}</td><td>${esc(rule.rateOrTierPct || 'Reference only')}</td><td>${esc(rule.basis || '—')}</td><td>${esc(rule.requiredInput || '—')}</td><td>${esc(rule.calculationOrNote || '—')}</td></tr>`).join('');
      const source = data.sourceReference || 'UCVM Workload Guidelines', version = data.policyVersionLabel || 'No active policy version';
      const body = rows ? `<div class="table-wrap"><table class="data-table doe-rule-reference-table"><thead><tr><th>Category</th><th>Rule</th><th>Year / Stage</th><th>Value / Tier</th><th>Basis</th><th>Required input</th><th>Application / limits</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">No DOE rule references for this year.</div>';
      return `<section class="section wide doe-rule-book"><div class="section-title">DOE Rule Reference · ${esc(data.academicYear || 'Academic year unavailable')}</div><div class="doe-profile-source">Policy: ${esc(version)} · Source: ${esc(source)}</div>${body}<div class="doe-note">do not infer individual Research, PPVM, Service/Admin or supervision DOE.</div></section>`;
    }

    function doeEvidenceStatus(summary) {
      const lineCount = Number(summary.teachingLineCount || 0) + Number(summary.roleLineCount || 0);
      const recorded = Number(summary.teachingRecordedCount || 0) + Number(summary.roleRecordedCount || 0);
      if (!lineCount) return 'Recorded';
      if (!recorded) return 'DOE unavailable / Needs Review';
      if (summary.partial) return 'Partial / Needs Review';
      return 'Recorded';
    }

    function renderDoeEvidence(assignments, roles) {
      const teachingRows = (Array.isArray(assignments) ? assignments : []).map(assignment => `<tr><td>${esc(assignment.courseCode || '—')}</td><td>${esc(assignment.topic || '—')}</td><td>${esc(assignment.date || '—')}</td><td>${esc(assignment.sessionType || '—')}</td><td>${esc(assignment.teachingRole || '—')}</td><td>${formatDoe(assignment.doeCredit)}</td><td>${formatDoe(assignment.doeRate)}</td><td>${display(assignment.doeQuantity)}</td><td>${esc(assignment.doeUnit || '—')}</td><td>${esc(assignment.doeStatus || (number(assignment.doeCredit) === null ? 'Needs Review' : 'Recorded'))}</td></tr>`).join('');
      const roleRows = (Array.isArray(roles) ? roles : []).map(role => { const effective = effectiveRoleDoe(role); return `<tr><td>${esc(role.roleType || '—')}</td><td>${esc(role.courseOrSubjectOrRotation || role.courseName || '—')}</td><td>${formatDoe(effective.mapped)}</td><td>${formatDoe(effective.override)}</td><td>${formatDoe(effective.effective)}</td><td>${esc(role.effectiveDate || '—')}</td><td>${esc(role.expirationDate || '—')}</td><td>${esc(role.doeOverrideReason || '—')}</td><td>${esc(role.specialNotes || '—')}</td></tr>`; }).join('');
      if (!teachingRows && !roleRows) return '';
      const teaching = teachingRows ? `<details class="doe-evidence-group"><summary>Teaching evidence · ${assignments.length} stored assignment lines</summary><div class="table-wrap"><table class="data-table doe-evidence-table"><thead><tr><th>Course</th><th>Topic / Activity</th><th>Date</th><th>Session Type</th><th>Teaching Role</th><th>Stored DOE</th><th>Rate</th><th>Quantity</th><th>Unit</th><th>DOE Status</th></tr></thead><tbody>${teachingRows}</tbody></table></div></details>` : '';
      const role = roleRows ? `<details class="doe-evidence-group"><summary>Role evidence · ${roles.length} stored role lines</summary><div class="table-wrap"><table class="data-table doe-evidence-table"><thead><tr><th>Role Type</th><th>Assignment</th><th>Mapped DOE</th><th>Override DOE</th><th>Effective DOE</th><th>Effective</th><th>Expires</th><th>Override Reason</th><th>Special Notes</th></tr></thead><tbody>${roleRows}</tbody></table></div></details>` : '';
      return `<div class="doe-evidence"><div class="doe-evidence-title">DOE Evidence · VetMed-Ops</div><div class="doe-evidence-copy">Stored DOE and overrides are shown as received; no client-side recalculation is applied.</div>${teaching}${role}</div>`;
    }

    function renderDoeSummary(summary, academicYear, assignments, roles, contractDoe = {}) {
      const teaching = number(summary.teachingDoe), role = number(summary.roleDoe), target = number(contractDoe?.teachingDoe);
      const teachingMissing = Math.max(0, Number(summary.teachingLineCount || 0) - Number(summary.teachingRecordedCount || 0));
      const roleMissing = Math.max(0, Number(summary.roleLineCount || 0) - Number(summary.roleRecordedCount || 0));
      const knownValues = [teaching, role].filter(value => value !== null);
      const totalKnown = knownValues.length ? knownValues.reduce((sum, value) => sum + value, 0) : null;
      const status = summary.partial || teachingMissing || roleMissing ? 'Needs Review' : target === null ? 'Target unavailable' : 'Complete';
      const statusClass = status === 'Complete' ? 'doe-within' : 'doe-under';
      const card = (label, value, subline = '', className = '') => `<div class="doe-summary-card ${className}"><div class="doe-summary-label">${esc(label)}</div><div class="doe-summary-value">${esc(value)}</div>${subline ? `<div class="doe-summary-subline">${esc(subline)}</div>` : ''}</div>`;
      const totalSubline = [teachingMissing ? `${teachingMissing} teaching line(s) unresolved` : '', roleMissing ? `${roleMissing} role line(s) unresolved` : ''].filter(Boolean).join(' · ') || 'Sum of recorded teaching and role values';
      const difference = target !== null && teaching !== null ? target - teaching : null;
      return `<section class="section wide doe-profile-summary doe-worksheet"><div class="section-title">DOE Summary · ${esc(`${academicYear || 'Teaching'} · VetMed-Ops recorded evidence`)}</div><div class="doe-worksheet-boundary"><span class="available">RECORDED VALUES</span> Teaching and Role / Service DOE are displayed separately. Rule references do not assign DOE.</div><div class="doe-summary-grid">${card('Contract / Teaching Target DOE', target === null ? 'Unavailable' : formatDoe(target), target === null ? 'No authoritative target recorded' : `${contractDoe.policyVersionLabel || contractDoe.source || 'Source recorded'}`)}${card('Assigned Teaching DOE', formatDoe(teaching), `${teachingMissing} unresolved of ${Number(summary.teachingLineCount || 0)} lines`)}${card('Role / Service DOE', formatDoe(role), `${roleMissing} unresolved of ${Number(summary.roleLineCount || 0)} lines`)}${card('Total Known DOE', formatDoe(totalKnown), totalSubline)}${target !== null && difference !== null ? card('Teaching Target Remaining / Difference', formatDoe(difference), 'Target minus assigned teaching DOE') : card('Teaching Target Remaining / Difference', 'Unavailable', 'Requires an authoritative teaching target and recorded teaching DOE')}</div><div class="doe-note">DOE is read-only. Missing values remain unavailable; no rule-based estimates or inferred tenure are applied.</div><div class="doe-evidence-status ${statusClass}">DOE status: ${esc(status)}</div>${renderDoeEvidence(assignments, roles)}</section>`;
    }

    function renderTeachingCourses(assignments) {
      const years = groupTeachingAssignments(assignments);
      const body = years.map(year => `<section class="year-section"><h3 class="year-title">${esc(year.curriculumYear)} · ${year.sessionCount ?? year.assignmentCount ?? 0} sessions · ${Number(year.creditedHours || 0).toFixed(2)} credited hours</h3>${year.courses.map(course => `<details class="course-group"><summary><div><div class="course-group-title">${esc(course.courseCode)}</div><div class="course-group-meta">${esc(course.courseName || 'Course name unavailable')} · ${course.assignmentCount} sessions · ${course.creditedHours.toFixed(2)} credited hours · ${formatDoe(course.doeTotal)} stored DOE</div></div><span class="course-group-meta">${course.doeStatus === 'complete' ? 'DOE recorded' : 'Needs Review'} ▾</span></summary><div class="table-wrap"><table class="activity-table"><thead><tr><th>Date</th><th>Start</th><th>End</th><th>Session Type</th><th>Teaching Role</th><th>Topic / Activity</th><th>Room</th><th>Credited Hours</th><th>DOE Rate</th><th>DOE Quantity</th><th>DOE Unit</th><th>DOE Credit</th><th>DOE Status</th></tr></thead><tbody>${course.assignments.map(assignment => `<tr data-session-id="${esc(assignment.sessionId || '')}"><td>${esc(assignment.date || '—')}</td><td>${esc(assignment.startTime || '—')}</td><td>${esc(assignment.endTime || '—')}</td><td>${esc(assignment.sessionType || '—')}</td><td>${esc(assignment.teachingRole || '—')}</td><td class="session-topic">${esc(assignment.topic || '—')}</td><td>${esc(assignment.room || '—')}</td><td>${display(assignment.creditedHours)}</td><td>${formatDoe(assignment.doeRate)}</td><td>${display(assignment.doeQuantity)}</td><td>${esc(assignment.doeUnit || '—')}</td><td>${formatDoe(assignment.doeCredit)}</td><td>${esc(assignment.doeStatus || 'Needs Review')}</td></tr>`).join('')}</tbody></table></div></details>`).join('')}</section>`).join('') || '<div class="empty">No teaching assignments recorded for this academic year.</div>';
      return `<section class="section wide"><div class="section-title">Teaching / Courses</div>${body}</section>`;
    }

    return Object.freeze({ renderContractDoe, renderDoeRuleBook, renderDoeSummary, renderTeachingCourses });
  }

  window.UCVM_FACULTY_DOE_RENDERER = Object.freeze({ create });
})();
