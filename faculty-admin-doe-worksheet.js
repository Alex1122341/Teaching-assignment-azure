(() => {
  'use strict';

  function create({ api, escapeHtml, formatDoe, finiteDoe, getFaculty, getAcademicYear, editAction, onView } = {}) {
    if (!api || !escapeHtml || !formatDoe || !finiteDoe || !getFaculty || !getAcademicYear || !editAction || !onView) {
      throw new TypeError('DOE Worksheet module dependencies are required.');
    }
    let worksheets = null;
    const esc = escapeHtml;

    function renderWorksheet(worksheet) {
      const target = worksheet.target || {}, totals = worksheet.totals || {}, reserve = worksheet.reserve || {};
      const missingData = (worksheet.errors || []).some(error => ['SUPERVISION_DATA_UNAVAILABLE', 'DOE_TARGET_UNAVAILABLE', 'RESERVE_POLICY_INVALID'].includes(error.code));
      const statusLabel = worksheet.status === 'calculated' ? (worksheet.calculationBasis === 'recorded_sources' ? 'Calculated from recorded sources' : 'Calculated') : worksheet.status === 'not_found' ? 'Not found' : missingData ? 'Awaiting data / policy' : 'Needs Review';
      const cards = [
        ['Contract Teaching target', target.contractTeachingDoe], ['Effective target', target.effectiveTargetDoe],
        ['Scheduled / assigned teaching', totals.scheduledTeachingDoe], ['Role DOE', totals.roleDoe],
        ['Raw supervision DOE', totals.rawSupervisionDoe], ['Applied supervision DOE', totals.appliedSupervisionDoe],
        ['Other approved adjustments', totals.adjustmentDoe], ['Total assigned teaching DOE', totals.assignedTeachingDoe],
        ['Remaining / Overage', totals.remainingDoe]
      ].map(([label, value]) => `<div class="p4-doe-worksheet-card"><span>${esc(label)}</span><strong>${esc(finiteDoe(value) === null && missingData ? 'Pending data / policy' : formatDoe(value))}</strong></div>`).join('');
      const provenance = (worksheet.lines || []).map(line => {
        const reference = line.reference || {};
        const source = [line.ruleKey, reference.title, reference.section, reference.table, reference.page ? `p. ${reference.page}` : '', line.calculationId].filter(Boolean).join(' · ');
        const legacy = finiteDoe(line.resultDoe) === null && line.legacyResultDoe !== null && line.legacyResultDoe !== undefined ? ` · legacy stored ${formatDoe(line.legacyResultDoe)}` : '';
        return `<tr><td>${esc(line.category || '—')}</td><td>${esc(line.roleType || line.activityType || line.sourceEntityType || '—')}</td><td>${esc(line.scopeText || line.courseCode || line.subjectKey || '—')}</td><td>${esc(line.applicable === false && finiteDoe(line.resultDoe) === null ? 'Not applicable' : formatDoe(line.resultDoe))}${esc(legacy)}</td><td>${esc(line.status || 'Needs Review')}${line.errorCode ? ` · ${esc(line.errorCode)}` : ''}</td><td>${esc(source || line.sourceEntityId || '—')}</td></tr>`;
      }).join('');
      const issues = (worksheet.errors || []).map(error => `<li><strong>${esc(error.code || 'Needs Review')}</strong>: ${esc(error.message || 'Calculation evidence is incomplete.')}</li>`).join('');
      const reserveSummary = reserve && Object.keys(reserve).length ? `<p class="aux-note">Reserve · ${esc(reserve.stream || worksheet.stream || 'stream unavailable')} · applied supervision ${esc(formatDoe(reserve.appliedSupervision))} · unapplied ${esc(formatDoe(reserve.unappliedSupervision))} · remaining to target ${esc(formatDoe(reserve.remainingToTarget))}</p>` : '';
      const targetPolicy = worksheet.targetPolicyVersionLabel || target.policyVersionId;
      const policyText = worksheet.policyVersionId ? `Calculation policy ${worksheet.policyVersionId}` : worksheet.workloadSourceReference ? `Workload policy ${worksheet.workloadSourceReference}` : 'Annual calculation policy not recorded';
      const calculationText = worksheet.lastCalculatedAt ? `latest calculation evidence ${worksheet.lastCalculatedAt}` : 'No annual calculation record; line values retain their recorded source';
      return `<div class="p4-doe-worksheet"><div class="section-title">Faculty DOE Worksheet · ${esc(worksheet.academicYear || 'Academic Year unavailable')}</div><p class="aux-note">Calculation status: <strong>${esc(statusLabel)}</strong> · ${esc(policyText)}${targetPolicy ? ` · Target source ${esc(targetPolicy)}` : ''} · ${esc(calculationText)}</p><div class="p4-doe-worksheet-summary">${cards}</div>${reserveSummary}${issues ? `<ul class="warn-box">${issues}</ul>` : ''}<div class="table-wrap p4-doe-worksheet-lines"><table class="data-table"><thead><tr><th>Category</th><th>Activity</th><th>Course / Subject / Scope</th><th>DOE</th><th>Status</th><th>Rule / Calculation / Reference provenance</th></tr></thead><tbody>${provenance || '<tr><td colspan="6" class="empty">No DOE calculation lines recorded for this year.</td></tr>'}</tbody></table></div></div>`;
    }

    function finite(value) { return value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value); }
    async function loadDetail(facultyId, academicYear, panel, isStillSelected) {
      if (!panel) return;
      if (!academicYear) { panel.innerHTML = '<div class="warn-box">Academic year is unavailable; the server Worksheet cannot be loaded.</div>'; return; }
      try {
        const worksheet = await api.doeWorksheet({ facultyId, academicYear });
        if (!panel.isConnected || !isStillSelected()) return;
        panel.innerHTML = renderWorksheet(worksheet);
      } catch (error) {
        if (panel.isConnected) panel.innerHTML = `<div class="warn-box" role="alert">DOE Worksheet could not be loaded: ${esc(error.message || 'DOE service unavailable.')}</div>`;
      }
    }

    function renderList() {
      const body = document.getElementById('doe-list-body');
      if (!body || !Array.isArray(worksheets)) return;
      const rosterRows = getFaculty() || [];
      const roster = new Map(rosterRows.map(row => [String(row.facultyId).toLowerCase(), row]));
      const rows = worksheets.filter(row => roster.get(String(row.facultyId).toLowerCase())?.active !== false).map(row => {
        const person = roster.get(String(row.facultyId).toLowerCase()) || {};
        const specialty = person.teachingArea || person.professionalCategory || '—';
        const assigned = finite(row.assignedTeachingDoe), target = finite(row.effectiveTargetDoe), remaining = finite(row.remainingDoe);
        const remainingText = remaining === null ? 'Needs Review' : remaining >= 0 ? `${remaining.toFixed(2)}% remaining` : `${Math.abs(remaining).toFixed(2)}% over`;
        const state = row.status === 'calculated' ? 'Calculated' : [...new Set(row.issueCodes || [])].join(', ') || 'Needs Review';
        const action = editAction(row.facultyId);
        return `<tr><td><strong>${esc(row.displayName || person.displayName || row.facultyId)}</strong><div class="muted">${esc(row.facultyId)}</div></td><td>${esc([person.rank, specialty].filter(Boolean).join(' · ') || '—')}</td><td>${esc(formatDoe(target))}</td><td>${esc(formatDoe(row.scheduledTeachingDoe))}</td><td>${esc(formatDoe(row.roleDoe))}</td><td>${esc(formatDoe(row.rawSupervisionDoe))}</td><td>${esc(formatDoe(row.appliedSupervisionDoe))}</td><td>${esc(formatDoe(row.adjustmentDoe))}</td><td><strong>${esc(formatDoe(assigned))}</strong></td><td>${esc(remainingText)}</td><td>${esc(row.policyVersionId || 'unavailable')}</td><td>${esc(state)}${row.missingMappingCount ? ` · ${row.missingMappingCount} mapping issue(s)` : ''}</td><td><button type="button" class="btn btn-small" data-doe-view="${esc(row.facultyId)}">View DOE</button>${action}</td></tr>`;
      });
      body.innerHTML = rows.join('') || '<tr><td colspan="13" class="empty">No Faculty Worksheets are available for the current Academic Year.</td></tr>';
    }

    async function loadList(force = false) {
      const body = document.getElementById('doe-list-body'), note = document.getElementById('doe-list-note');
      if (!body) return;
      const year = getAcademicYear();
      if (!year) { body.innerHTML = '<tr><td colspan="13" class="empty">Academic year is unavailable.</td></tr>'; if (note) note.textContent = 'DOE Worksheet requires an Academic Year.'; return; }
      if (worksheets && !force) return renderList();
      body.innerHTML = '<tr><td colspan="13" class="empty">Loading server-authoritative DOE Worksheets…</td></tr>';
      if (note) note.textContent = `VetMed-Ops DOE Worksheet · Academic Year ${year}`;
      try { worksheets = await api.doeWorksheets({ academicYear: year }); renderList(); }
      catch (error) { worksheets = null; body.innerHTML = `<tr><td colspan="13" class="empty">${esc(error.message || 'DOE List could not be loaded.')}</td></tr>`; if (note) note.textContent = 'The server DOE Worksheet service is unavailable.'; }
    }

    function bindList() {
      document.getElementById('doe-list-body')?.addEventListener('click', event => {
        const button = event.target.closest('[data-doe-view]');
        if (button) onView(button.dataset.doeView);
      });
    }
    return Object.freeze({ loadDetail, loadList, renderList, invalidate() { worksheets = null; }, bindList });
  }

  window.UCVM_FACULTY_DOE_WORKSHEET = Object.freeze({ create });
})();
