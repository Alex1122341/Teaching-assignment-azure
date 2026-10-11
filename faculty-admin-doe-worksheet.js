(() => {
  'use strict';

  function create({ api, escapeHtml, formatDoe, finiteDoe, getFaculty, getAcademicYear, editAction, onView } = {}) {
    if (!api || !escapeHtml || !formatDoe || !finiteDoe || !getFaculty || !getAcademicYear || !editAction || !onView) {
      throw new TypeError('DOE Worksheet module dependencies are required.');
    }
    let worksheets = null;
    let reviewPopover = null, reviewTrigger = null, reviewRequest = 0;
    const reviewDetails = new Map();
    const esc = escapeHtml;
    const referenceBubble = (text, label = 'Reference') => `<details class="reference-bubble"><summary aria-label="${esc(label)} details"><span aria-hidden="true">ⓘ</span> ${esc(label)}</summary><div class="reference-bubble-content">${esc(text || 'Source not recorded')}</div></details>`;

    function reviewButton(facultyId, field = 'DOE', count = 0) {
      return `<button type="button" class="doe-status doe-under doe-review-trigger" data-doe-review="${esc(facultyId)}" aria-label="Needs Review: ${esc(field)} — show reasons" aria-haspopup="dialog">Needs Review${count > 0 ? ` (${count})` : ''}</button>`;
    }

    function balanceBadge(remaining, status, facultyId) {
      if (remaining === null || status !== 'calculated') return reviewButton(facultyId, 'Remaining / Overage');
      const displayed = Number(remaining.toFixed(2));
      const label = displayed === 0 ? 'At DOE' : displayed > 0 ? 'Within DOE' : 'Over DOE';
      const tone = displayed === 0 ? 'doe-at' : displayed > 0 ? 'doe-within' : 'doe-over';
      const amount = displayed === 0 ? '0.00% remaining' : `${Math.abs(displayed).toFixed(2)}% ${displayed > 0 ? 'remaining' : 'over'}`;
      return `<span class="doe-status ${tone}">${label}</span><div class="doe-balance-amount">${esc(amount)}</div>`;
    }

    function policySummary(row) {
      const source = String(row.workloadSourceReference || '').trim();
      const year = row.academicYear || 'Academic year not recorded';
      const title = source ? source.split(/\s[·|]\s/)[0] : row.policyVersionId ? 'Annual DOE policy' : 'Policy source not recorded';
      const updated = source.match(/updated\s+(\d{4}-\d{2}-\d{2})/i)?.[1];
      const basis = row.calculationBasis === 'recorded_sources' ? 'Recorded sources' : row.policyVersionId ? 'Annual calculation' : '';
      const details = [source, row.policyVersionId ? `Calculation policy: ${row.policyVersionId}` : 'No annual calculation policy recorded', row.targetPolicyVersionLabel ? `Target source: ${row.targetPolicyVersionLabel}` : '', row.target?.policyVersionId ? `Target policy ID: ${row.target.policyVersionId}` : ''].filter(Boolean).join(' · ');
      return `<strong class="doe-policy-label">${esc(title)}</strong>${updated ? `<div class="muted">Updated ${esc(updated)}</div>` : ''}<div class="muted">Academic year ${esc(year)}</div>${basis ? `<div class="muted">${esc(basis)}</div>` : ''}${referenceBubble(details, 'Policy & source')}`;
    }

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
        return `<tr><td>${esc(line.category || '—')}</td><td>${esc(line.roleType || line.activityType || line.sourceEntityType || '—')}</td><td>${esc(line.scopeText || line.courseCode || line.subjectKey || '—')}</td><td>${esc(line.applicable === false && finiteDoe(line.resultDoe) === null ? 'Not applicable' : formatDoe(line.resultDoe))}${esc(legacy)}</td><td>${esc(line.status || 'Needs Review')}${line.errorCode ? ` · ${esc(line.errorCode)}` : ''}</td><td>${referenceBubble(source || line.sourceEntityId || '—')}</td></tr>`;
      }).join('');
      const issues = (worksheet.errors || []).map(error => `<li><strong>${esc(error.code || 'Needs Review')}</strong>: ${esc(error.message || 'Calculation evidence is incomplete.')}</li>`).join('');
      const reserveSummary = reserve && Object.keys(reserve).length ? `<p class="aux-note">Reserve · ${esc(reserve.stream || worksheet.stream || 'stream unavailable')} · applied supervision ${esc(formatDoe(reserve.appliedSupervision))} · unapplied ${esc(formatDoe(reserve.unappliedSupervision))} · remaining to target ${esc(formatDoe(reserve.remainingToTarget))}</p>` : '';
      const targetPolicy = worksheet.targetPolicyVersionLabel || target.policyVersionId;
      const policyText = worksheet.policyVersionId ? `Calculation policy ${worksheet.policyVersionId}` : worksheet.workloadSourceReference ? `Workload policy ${worksheet.workloadSourceReference}` : 'Annual calculation policy not recorded';
      const calculationText = worksheet.lastCalculatedAt ? `latest calculation evidence ${worksheet.lastCalculatedAt}` : 'No annual calculation record; line values retain their recorded source';
      return `<div class="p4-doe-worksheet"><div class="section-title">Faculty DOE Worksheet · ${esc(worksheet.academicYear || 'Academic Year unavailable')}</div><p class="aux-note">Calculation status: <strong>${esc(statusLabel)}</strong> ${referenceBubble(policyText + (targetPolicy ? ' · Target source '+targetPolicy : '') + ' · '+calculationText, 'Calculation source')}</p><div class="p4-doe-worksheet-summary">${cards}</div>${reserveSummary}${issues ? `<ul class="warn-box">${issues}</ul>` : ''}<div class="table-wrap p4-doe-worksheet-lines"><table class="data-table"><thead><tr><th>Category</th><th>Activity</th><th>Course / Subject / Scope</th><th>DOE</th><th>Status</th><th>Rule / Calculation / Reference provenance</th></tr></thead><tbody>${provenance || '<tr><td colspan="6" class="empty">No DOE calculation lines recorded for this year.</td></tr>'}</tbody></table></div></div>`;
    }

    function finite(value) { return value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value); }

    function closeReview() {
      if (reviewPopover?.matches(':popover-open')) reviewPopover.hidePopover();
      if (reviewTrigger?.isConnected) reviewTrigger.focus();
    }

    function positionReview() {
      if (!reviewPopover || !reviewTrigger?.isConnected) return;
      const anchor = reviewTrigger.getBoundingClientRect(), box = reviewPopover.getBoundingClientRect();
      const left = Math.max(12, Math.min(anchor.left, window.innerWidth - box.width - 12));
      const below = anchor.bottom + 8;
      const top = below + box.height <= window.innerHeight - 12 ? below : Math.max(12, anchor.top - box.height - 8);
      reviewPopover.style.left = `${left}px`;
      reviewPopover.style.top = `${top}px`;
    }

    function reasonContent(worksheet) {
      const lines = worksheet.lines || [], groups = new Map();
      for (const error of worksheet.errors || []) {
        const message = error.message || 'The server recorded a review issue without a description.';
        const key = `${error.code || ''}|${message}`;
        if (!groups.has(key)) groups.set(key, { code: error.code || '', message, scopes: new Set(), count: 0 });
        const group = groups.get(key);
        group.count++;
        const line = lines.find(item => error.lineId && item.lineId === error.lineId || error.sourceEntityId && item.sourceEntityId === error.sourceEntityId);
        if (line) {
          const scope = [...new Set([line.roleType || line.activityType || line.category, line.courseCode, line.scopeText || line.subjectKey].filter(Boolean))].join(' · ');
          if (scope) group.scopes.add(scope);
        }
      }
      if (!groups.size) return '<p>No current review reasons were returned by the server. Refresh the DOE List to update its status.</p>';
      return `<ul class="doe-review-reasons">${[...groups.values()].map(group => `<li><p>${esc(group.message)}</p>${group.scopes.size ? `<details class="doe-review-items"><summary>Affected items (${group.count})</summary><ul>${[...group.scopes].map(scope => `<li>${esc(scope)}</li>`).join('')}</ul></details>` : ''}${group.code ? `<details class="doe-review-diagnostic"><summary>Diagnostic details</summary><code>${esc(group.code)}</code></details>` : ''}</li>`).join('')}</ul>`;
    }

    async function openReview(button) {
      const facultyId = button.dataset.doeReview, year = getAcademicYear();
      const row = (worksheets || []).find(item => String(item.facultyId).toLowerCase() === String(facultyId).toLowerCase());
      if (!row || !year) return;
      const request = ++reviewRequest;
      reviewTrigger = button;
      if (!reviewPopover) {
        reviewPopover = document.createElement('div');
        reviewPopover.id = 'doe-review-popover';
        reviewPopover.className = 'doe-review-popover';
        reviewPopover.setAttribute('popover', 'auto');
        reviewPopover.setAttribute('role', 'dialog');
        reviewPopover.setAttribute('aria-labelledby', 'doe-review-title');
        document.body.append(reviewPopover);
        reviewPopover.addEventListener('click', event => {
          if (event.target.closest('[data-doe-review-close]')) closeReview();
          if (event.target.closest('[data-doe-review-retry]') && reviewTrigger?.isConnected) openReview(reviewTrigger);
        });
        reviewPopover.addEventListener('toggle', () => { if (reviewPopover.matches(':popover-open')) positionReview(); }, true);
        window.addEventListener('resize', () => { if (reviewPopover.matches(':popover-open')) positionReview(); });
      }
      reviewPopover.innerHTML = `<div class="doe-review-head"><div><h2 id="doe-review-title">DOE review reasons</h2><p>${esc(row.displayName || facultyId)} · ${esc(year)}</p></div><button type="button" class="btn btn-small" data-doe-review-close aria-label="Close DOE review reasons">Close</button></div><div class="doe-review-body" aria-live="polite" aria-busy="true"><p>Loading current review reasons…</p></div>`;
      if (!reviewPopover.matches(':popover-open')) reviewPopover.showPopover({ source: button });
      positionReview();
      reviewPopover.querySelector('[data-doe-review-close]').focus({ preventScroll: true });
      const key = `${year}:${facultyId}`;
      try {
        const worksheet = reviewDetails.get(key) || await api.doeWorksheet({ facultyId, academicYear: year });
        if (request !== reviewRequest || !reviewPopover.matches(':popover-open')) return;
        reviewDetails.set(key, worksheet);
        reviewPopover.querySelector('.doe-review-body').innerHTML = reasonContent(worksheet);
      } catch (error) {
        if (request !== reviewRequest || !reviewPopover.matches(':popover-open')) return;
        reviewPopover.querySelector('.doe-review-body').innerHTML = `<p role="alert">Review reasons could not be loaded: ${esc(error.message || 'DOE service unavailable.')}</p><button type="button" class="btn btn-small" data-doe-review-retry>Retry</button>`;
      }
      reviewPopover.querySelector('.doe-review-body').setAttribute('aria-busy', 'false');
      positionReview();
    }
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
      if (reviewPopover?.matches(':popover-open')) reviewPopover.hidePopover();
      const rosterRows = getFaculty() || [];
      const roster = new Map(rosterRows.map(row => [String(row.facultyId).toLowerCase(), row]));
      const rows = worksheets.filter(row => roster.get(String(row.facultyId).toLowerCase())?.active !== false).map(row => {
        const person = roster.get(String(row.facultyId).toLowerCase()) || {};
        const specialty = person.teachingArea || person.professionalCategory || '—';
        const assigned = finite(row.assignedTeachingDoe), target = finite(row.effectiveTargetDoe), remaining = finite(row.remainingDoe);
        const remainingText = balanceBadge(remaining, row.status, row.facultyId);
        const state = row.status === 'calculated' ? 'Calculated' : reviewButton(row.facultyId, 'Calculation status', row.issueCount);
        const value = (number, label) => finite(number) === null ? reviewButton(row.facultyId, label) : esc(formatDoe(number));
        const action = editAction(row.facultyId);
        return `<tr><td><strong>${esc(row.displayName || person.displayName || row.facultyId)}</strong><div class="muted">${esc(row.facultyId)}</div></td><td>${esc([person.rank, specialty].filter(Boolean).join(' · ') || '—')}</td><td>${value(target, 'Target DOE')}</td><td>${value(row.scheduledTeachingDoe, 'Scheduled teaching DOE')}</td><td>${value(row.roleDoe, 'Role DOE')}</td><td>${value(row.rawSupervisionDoe, 'Raw supervision DOE')}</td><td>${value(row.appliedSupervisionDoe, 'Applied supervision DOE')}</td><td>${value(row.adjustmentDoe, 'Adjustment DOE')}</td><td><strong>${value(assigned, 'Assigned DOE')}</strong></td><td>${remainingText}</td><td>${policySummary(row)}</td><td>${state}</td><td><button type="button" class="btn btn-small" data-doe-view="${esc(row.facultyId)}">View DOE</button>${action}</td></tr>`;
      });
      body.innerHTML = rows.join('') || '<tr><td colspan="13" class="empty">No Faculty Worksheets are available for the current Academic Year.</td></tr>';
    }

    async function loadList(force = false) {
      const body = document.getElementById('doe-list-body'), note = document.getElementById('doe-list-note');
      if (!body) return;
      const year = getAcademicYear();
      if (!year) { body.innerHTML = '<tr><td colspan="13" class="empty">Academic year is unavailable.</td></tr>'; if (note) note.textContent = 'DOE Worksheet requires an Academic Year.'; return; }
      if (worksheets && !force) return renderList();
      reviewDetails.clear();
      reviewRequest++;
      if (reviewPopover?.matches(':popover-open')) reviewPopover.hidePopover();
      body.innerHTML = '<tr><td colspan="13" class="empty">Loading server-authoritative DOE Worksheets…</td></tr>';
      if (note) note.innerHTML = `VetMed-Ops DOE Worksheet · Academic Year ${esc(year)} <span class="doe-status doe-within">Within DOE</span> <span class="doe-status doe-at">At DOE</span> <span class="doe-status doe-over">Over DOE</span>`;
      try { worksheets = await api.doeWorksheets({ academicYear: year }); renderList(); }
      catch (error) { worksheets = null; body.innerHTML = `<tr><td colspan="13" class="empty">${esc(error.message || 'DOE List could not be loaded.')}</td></tr>`; if (note) note.textContent = 'The server DOE Worksheet service is unavailable.'; }
    }

    function bindList() {
      document.getElementById('doe-list-body')?.addEventListener('click', event => {
        const review = event.target.closest('[data-doe-review]');
        if (review) { openReview(review); return; }
        const button = event.target.closest('[data-doe-view]');
        if (button) onView(button.dataset.doeView);
      });
    }
    return Object.freeze({ loadDetail, loadList, renderList, invalidate() { worksheets = null; reviewDetails.clear(); reviewRequest++; if (reviewPopover?.matches(':popover-open')) reviewPopover.hidePopover(); }, bindList });
  }

  window.UCVM_FACULTY_DOE_WORKSHEET = Object.freeze({ create });
})();
