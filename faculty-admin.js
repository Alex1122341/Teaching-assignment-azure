(() => {
  'use strict';

  const FIREBASE_CONFIG = { apiKey: 'AIzaSyDS9VE2zTXv0656_Mh0uDXB67-mZ5Y_LkY', authDomain: 'tester-teaching.firebaseapp.com', projectId: 'tester-teaching', storageBucket: 'tester-teaching.firebasestorage.app', messagingSenderId: '566638053186', appId: '1:566638053186:web:90e04b52251c4b859baadb', measurementId: 'G-F7HW5XX4JE' };
  const VIEW = window.PAWS_DASHBOARD_VIEW_MODEL || {};
  const number = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
  const normalizeCurriculumYear = VIEW.normalizeCurriculumYear || (value => text(value) || 'Unassigned year');
  const groupTeachingAssignments = VIEW.groupTeachingAssignments || (() => []);
  const effectiveRoleDoe = VIEW.effectiveRoleDoe || (() => ({ mapped: null, override: null, effective: null, status: 'needs-review' }));
  const summarizeDoe = VIEW.summarizeDoe || (() => ({}));
  const formatDoe = VIEW.formatDoe || (() => 'DOE unavailable');
  const $ = id => document.getElementById(id);
  const on = (element, event, handler) => {
    if (!element) return;
    if (typeof element.addEventListener === 'function') element.addEventListener(event, handler);
    else element[`on${event}`] = handler;
  };
  const present = value => !(value === undefined || value === null || value === '');
  const text = value => present(value) ? String(value).trim() : '';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
  const norm = value => text(value).toLowerCase();
  function pawsTimingEnabled() { return window.__pawsDashboardTiming === true; }
  function pawsTimingLog(label, started) { if (pawsTimingEnabled() && typeof performance?.now === 'function') console.log(`[PAWS dashboard timing] ${label}=${Math.round(performance.now() - started)}ms`); }

  let auth = null;
  let currentUser = null;
  let faculty = [];
  let activeFaculty = [];
  let selectedId = null;
  let selectedDetail = null;
  let selfMode = false;
  let facultyStatus = 'active';
  let facultyAdminWriteEnabled = false;
  let dashboardSummary = null;
  let activeTab = 'lookup';
  let afcRecords = [];
  let afcLoaded = false;
  let afcSubmitInFlight = false;
  let afcBatchRows = [{ facultyId: '', facultyEntry: '', startDate: '', endDate: '', purpose: '', dateErrors: {}, errors: [], status: 'EDIT' }];
  let afcBatchRequestId = '';
  let afcBatchReviewed = false;
  let detailLoadToken = 0;
  const detailCache = new Map();
  const detailPending = new Set();
  const aggregateCache = { teachingSummary: null, roles: null, doeOverview: null };

  function rosterRecord(row) {
    const r = row && typeof row === 'object' ? row : {};
    const first = text(r.preferredFirstName), last = text(r.preferredLastName), id = text(r.facultyId);
    return { __id: id, facultyId: id, preferredFirstName: first, preferredLastName: last,
      preferredFullName: text(r.displayName) || [first, last].filter(Boolean).join(' '), displayName: text(r.displayName) || [first, last].filter(Boolean).join(' '),
      ucid: text(r.ucid), email: text(r.email), recordType: text(r.recordType), stream: text(r.stream), rank: text(r.rank), fte: present(r.fte) ? r.fte : undefined,
      reportsToFacultyId: text(r.reportsToFacultyId), reportsToName: text(r.reportsToName), active: r.active !== false, teachingArea: text(r.teachingArea), professionalCategory: text(r.professionalCategory),
      updatedAtUtc: text(r.updatedAtUtc),
      sessionCount: Number(r.sessionCount) || 0, roleCount: Number(r.roleCount) || 0, afcCount: Number(r.afcCount) || 0, jointAppointmentCount: Number(r.jointAppointmentCount) || 0 };
  }

  async function loadAdminDashboard() {
    const started = typeof performance?.now === 'function' ? performance.now() : 0;
    setDashboardLoading(true);
    try {
      const [summary, rows, activeRows, canWrite] = await Promise.all([
        UCVM_PAWS_DATA.dashboardSummary(),
        UCVM_PAWS_DATA.dashboardFaculty({ status: facultyStatus }),
        facultyStatus === 'active' ? Promise.resolve(null) : UCVM_PAWS_DATA.dashboardFaculty({ status: 'active' }),
        UCVM_PAWS_DATA.refreshFacultyAdminWriteCapabilities?.() ?? false
      ]);
      dashboardSummary = summary && typeof summary === 'object' && !Array.isArray(summary) ? summary : {};
      facultyAdminWriteEnabled = canWrite === true;
      faculty = (Array.isArray(rows) ? rows : []).map(rosterRecord);
      activeFaculty = facultyStatus === 'active' ? faculty : (Array.isArray(activeRows) ? activeRows : []).map(rosterRecord);
      if ($('faculty-status-filter')) $('faculty-status-filter').value = facultyStatus;
      afcLoaded = false;
      updateFilters(); populateAfcFacultyOptions(); updateKpis(); updateStatus(); renderActiveTab();
      pawsTimingLog('summary+faculty', started);
    } catch (error) { console.error(error); markDashboardUnavailable(dashboardAuthFailureMessage(error)); }
  }

  function dashboardRawRole(value) { return String((value && typeof value === 'object' ? value.role : value) || '').toLowerCase(); }
  function dashboardRole(value) { return ({ owner: 'adfa_general', administrator: 'adfa_regular', other_office: 'other_office', adfa_general: 'adfa_general', adfa_regular: 'adfa_regular', admin: 'adfa_regular', editor: 'faculty', viewer: 'faculty' }[dashboardRawRole(value)] || dashboardRawRole(value)); }
  function dashboardAdmin(profile) { return ['adfa_general', 'adfa_regular'].includes(dashboardRole(profile && profile.role)); }
  function dashboardGeneral(profile) { return dashboardRole(profile && profile.role) === 'adfa_general'; }
  function dashboardRoleLabel(value) { return ({ owner: 'ADFAD Owner', adfa_general: 'ADFAD Owner', administrator: 'ADFAD Admin', adfa_regular: 'ADFAD Admin', admin: 'ADFAD Admin', other_office: 'Other Office', hicc: 'HICC', visc: 'VISC', faculty: 'Faculty', editor: 'Faculty', viewer: 'Faculty' }[dashboardRawRole(value)] || dashboardRawRole(value)); }
  function isSelfServiceProfile(p){return ['faculty','hicc','visc'].includes(String(p?.role||'').toLowerCase())}

  async function loadSelfFaculty(facultyId) {
    if (!facultyId) throw new Error('Your account is not linked to a faculty profile. Please contact ADFA.');
    const rows = await UCVM_PAWS_DATA.dashboardFaculty();
    const own = (Array.isArray(rows) ? rows : []).map(r => rosterRecord(r)).find(r => String(r.facultyId).toLowerCase()===String(facultyId).toLowerCase());
    if (!own) throw new Error('Your linked faculty profile could not be found. Please contact ADFA.');
    faculty = [own]; selectedId = own.__id;
    const cached = detailCache.get(String(facultyId));
    if (cached) { selectedDetail = cached; renderApiDetail(cached); return; }
    const detail = await UCVM_PAWS_DATA.dashboardFacultyById(facultyId);
    detailCache.set(String(facultyId), detail); selectedDetail = detail; renderApiDetail(detail);
  }

  async function enterSelfMode(user, profile) {
    selfMode = true; document.body.classList.add('faculty-self-mode'); installSelfModeStyles();
    currentUser = { uid: user.uid, email: user.email || '', name: profile.displayName || profile.name || user.displayName || user.email || 'Faculty', role: profile.role };
    $('admin-chip').textContent = `${currentUser.name} · ${dashboardRoleLabel(profile.role)}`; $('user-management-link')?.classList.add('hidden'); $('afc-records-tab')?.classList.add('hidden');
    const heading = document.querySelector('.headline h1'), copy = document.querySelector('.headline p');
    if (heading) heading.textContent = 'My Faculty Profile';
    if (copy) copy.textContent = 'Your teaching, roles, appointments, availability, and stored DOE evidence.';
    unlock(); await loadSelfFaculty(profile.facultyId);
  }

  function enterAdminMode(user, profile) {
    selfMode = false; document.body.classList.remove('faculty-self-mode');
    currentUser = { uid: user.uid, email: user.email || '', name: profile.displayName || profile.name || user.displayName || user.email || 'Administrator', role: profile.role };
    $('faculty-status-filter')?.classList.remove('hidden');
    $('admin-chip').textContent = `${currentUser.name} · ${dashboardRoleLabel(profile.role)}`; $('user-management-link')?.classList.toggle('hidden', !dashboardGeneral(profile)); $('afc-records-tab')?.classList.toggle('hidden', !dashboardAdmin(profile));
    unlock(); loadAdminDashboard();
  }

  function init() {
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      auth = firebase.auth(); if (window.UCVMSessionGuard) window.UCVMSessionGuard.start(auth);
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {}); bindUI();
      if(cameFromTimetable())lock('Opening Dashboard…');
      auth.onAuthStateChanged(async user => {
        if (!user) { currentUser = null; lock('You are not signed in. Return to the timetable and sign in.'); return; }
        try {
          lock('Checking Dashboard access…'); const meStarted = typeof performance?.now === 'function' ? performance.now() : 0; const profile = await UCVM_PAWS_DATA.currentUser(); pawsTimingLog('me', meStarted);
          if (!profile || profile.active !== true) { lock('This Dashboard requires an active UCVM account.'); return; }
          if (profile.mustChangePassword === true) { location.replace('password.html'); return; }
          if (isSelfServiceProfile(profile) && !profile.facultyId) { lock('Your account requires a linked faculty profile. Please contact ADFA.'); return; }
          if (isSelfServiceProfile(profile)) { window.UCVMSessionGuard?.clearNotice?.(); await enterSelfMode(user, profile); return; }
          if (dashboardAdmin(profile)) { window.UCVMSessionGuard?.clearNotice?.(); enterAdminMode(user, profile); return; }
          lock('This account does not have Faculty Dashboard access.');
        } catch (error) { console.error(error); if (error?.code === 'PASSWORD_CHANGE_REQUIRED') location.replace('password.html'); else lock(dashboardAuthFailureMessage(error)); }
      });
    } catch (error) { console.error(error); lock('Firebase could not initialize.'); }
  }

  function bindUI() {
    on($('lookup-search'), 'input', debounce(renderLookup)); on($('filter-rank'), 'change', renderLookup);
    on($('faculty-status-filter'), 'change', async () => { facultyStatus = $('faculty-status-filter').value || 'active'; detailCache.clear(); selectedId = null; await loadAdminDashboard(); });
    facultyManagement.bind();
    on($('lookup-reset'), 'click', () => { $('lookup-search').value = ''; $('filter-rank').value = ''; renderLookup(); });
    document.querySelectorAll('.tab').forEach(tab => on(tab, 'click', () => selectTab(tab.dataset.tab)));
    on($('summary-search'), 'input', renderTeachingSummary); on($('roles-search'), 'input', renderRoles);
    on($('role-type-filter'), 'change', renderRoles);
    on($('afc-search'), 'input', debounce(renderAfcRecords));
    on($('afc-reason-filter'), 'change', renderAfcRecords); on($('afc-active-filter'), 'change', renderAfcRecords); on($('afc-source-filter'), 'change', renderAfcRecords);
    on($('afc-record-form'), 'submit', submitAfcRecord);
    on($('afc-single-mode'), 'click', () => setAfcMode(false));
    on($('afc-batch-mode'), 'click', () => { setAfcMode(true); renderAfcBatchRows(); });
    on($('afc-batch-add-row'), 'click', () => { if (afcBatchRows.length >= 20) return setAfcBatchStatus('A batch can contain at most 20 rows.', true); afcBatchRows.push({ facultyId: '', facultyEntry: '', startDate: '', endDate: '', purpose: '', dateErrors: {}, errors: [], status: 'EDIT' }); invalidateAfcBatch(); renderAfcBatchRows(); });
    on($('afc-batch-rows'), 'input', updateAfcBatchField);
    on($('afc-batch-rows'), 'change', updateAfcBatchField);
    on($('afc-batch-rows'), 'click', event => { const button = event.target?.closest?.('[data-afc-batch-remove]'); if (!button) return; afcBatchRows.splice(Number(button.dataset.afcBatchRemove), 1); invalidateAfcBatch(); renderAfcBatchRows(); });
    on($('afc-batch-import-paste'), 'click', loadAfcBatchPaste);
    on($('afc-batch-clear'), 'click', () => { afcBatchRows = [{ facultyId: '', facultyEntry: '', startDate: '', endDate: '', purpose: '', dateErrors: {}, errors: [], status: 'EDIT' }]; $('afc-batch-paste').value = ''; invalidateAfcBatch(); renderAfcBatchRows(); setAfcBatchStatus('Batch cleared.'); });
    on($('afc-batch-validate'), 'click', () => { reviewAfcBatch(); renderAfcBatchRows(); });
    on($('afc-batch-submit'), 'click', submitAfcBatch);
    const singleWriteEnabled = UCVM_PAWS_DATA.afcSingleWriteEnabled?.() === true;
    const batchWriteEnabled = UCVM_PAWS_DATA.afcBatchWriteEnabled?.() === true;
    if (!singleWriteEnabled) {
      const submit = $('afc-submit'); if (submit) submit.disabled = true;
      const status = $('afc-form-status'); if (status) status.textContent = 'AFC single-record writes are disabled until the server write gate is explicitly enabled.';
    }
    if (!batchWriteEnabled) {
      const submit = $('afc-batch-submit'); if (submit) submit.disabled = true;
      const status = $('afc-batch-status'); if (status) status.textContent = 'AFC batch writes are disabled until the server write gate is explicitly enabled.';
    }
  }

  function selectTab(tabName) {
    if (selfMode) return;
    activeTab = tabName || 'lookup';
    document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === activeTab));
    ['lookup', 'summary', 'roles', 'doe-overview', 'afc-records'].forEach(name => $(name + '-view')?.classList.toggle('hidden', name !== activeTab));
    renderActiveTab();
  }

  function renderActiveTab() {
    if (activeTab === 'summary') return loadTeachingSummary();
    if (activeTab === 'roles') return loadRoles();
    if (activeTab === 'doe-overview') return loadDoeOverview();
    if (activeTab === 'afc-records') return loadAfcRecords();
    renderLookup();
  }

  async function loadTeachingSummary() {
    if (aggregateCache.teachingSummary) { renderTeachingSummary(); return; }
    const body = $('summary-body'); if (body) body.innerHTML = '<tr><td colspan="12" class="empty">Loading teaching summary…</td></tr>';
    try { aggregateCache.teachingSummary = await UCVM_PAWS_DATA.dashboardTeachingSummary(); renderTeachingSummary(); }
    catch (error) { if (body) body.innerHTML = `<tr><td colspan="12" class="empty">${esc(detailFailureMessage(error))}</td></tr>`; }
  }

  async function loadRoles() {
    if (aggregateCache.roles) { renderRoles(); return; }
    const body = $('roles-body'); if (body) body.innerHTML = '<tr><td colspan="11" class="empty">Loading roles…</td></tr>';
    try { aggregateCache.roles = await UCVM_PAWS_DATA.dashboardRoles(); fillRoleFilter(); renderRoles(); }
    catch (error) { if (body) body.innerHTML = `<tr><td colspan="11" class="empty">${esc(detailFailureMessage(error))}</td></tr>`; }
  }

  async function loadDoeOverview() {
    if (aggregateCache.doeOverview) { renderDoeOverview(); return; }
    const body = $('doe-overview-body'); if (body) body.innerHTML = '<div class="empty">Loading DOE overview…</div>';
    try { aggregateCache.doeOverview = await UCVM_PAWS_DATA.dashboardDoeOverview(); renderDoeOverview(); }
    catch (error) { if (body) body.innerHTML = `<div class="empty">${esc(detailFailureMessage(error))}</div>`; }
  }

  const AFC_REASON_LABELS = Object.freeze({ university_travel: 'University Travel', vacation: 'Vacation', rsl: 'RSL', medical: 'Medical', mat: 'MAT', special: 'Special', other: 'Other' });

  async function loadAfcRecords(force = false) {
    const body = $('afc-records-body');
    if (!force && afcLoaded) { renderAfcRecords(); return; }
    if (body) body.innerHTML = '<tr><td colspan="7" class="empty">Loading AFC records…</td></tr>';
    try {
      afcRecords = await UCVM_PAWS_DATA.dashboardAfcRecords({ limit: 2000 });
      afcRecords = Array.isArray(afcRecords) ? afcRecords : [];
      afcLoaded = true;
      renderAfcRecords();
      const note = $('afc-load-note'); if (note) note.textContent = `Unified AFC view · ${afcRecords.length} record${afcRecords.length === 1 ? '' : 's'} loaded · maximum 2,000.`;
    } catch (error) {
      afcLoaded = false;
      if (body) body.innerHTML = `<tr><td colspan="7" class="empty">${esc(detailFailureMessage(error))}</td></tr>`;
    }
  }

  function populateAfcFacultyOptions() {
    const element = $('afc-faculty'); if (!element) return;
    const old = element.value;
    const rows = faculty.filter(row => row.active !== false).sort((a, b) => String(a.displayName || a.facultyId).localeCompare(String(b.displayName || b.facultyId)));
    element.innerHTML = '<option value="">Select active faculty…</option>' + rows.map(row => `<option value="${esc(row.facultyId)}">${esc(row.displayName || row.facultyId)} · ${esc(row.facultyId)}</option>`).join('');
    if (rows.some(row => row.facultyId === old)) element.value = old;
  }

  function fillAfcReasonFilter() {
    const list = $('afc-faculty-options');
    if (list) list.innerHTML = afcFacultyRows().map(row => '<option value="' + esc(afcFacultyLabel(row)) + '"></option>').join('');
    const element = $('afc-reason-filter'); if (!element) return;
    const old = element.value;
    element.innerHTML = '<option value="">All reasons</option>' + Object.entries(AFC_REASON_LABELS).map(([code, label]) => `<option value="${code}">${label}</option>`).join('');
    if (Object.prototype.hasOwnProperty.call(AFC_REASON_LABELS, old)) element.value = old;
  }

  function renderAfcRecords() {
    fillAfcReasonFilter();
    const body = $('afc-records-body'); if (!body) return;
    const query = norm($('afc-search')?.value);
    const reason = $('afc-reason-filter')?.value || '';
    const active = $('afc-active-filter')?.value || '';
    const source = $('afc-source-filter')?.value || '';
    const rows = afcRecords.filter(row => {
      const haystack = norm([row.facultyName, row.facultyId, row.notes, row.legacyPurpose, row.reason, row.reasonCode].filter(present).join(' '));
      return (!query || haystack.includes(query)) && (!reason || row.reasonCode === reason || (!row.reasonCode && norm(row.reason) === norm(AFC_REASON_LABELS[reason]))) && (!active || String(row.active !== false) === active) && (!source || norm(row.sourceKind || 'manual') === source);
    });
    body.innerHTML = rows.map(row => `<tr><td><button type="button" class="btn-link" data-afc-person="${esc(row.facultyId)}">${esc(row.facultyName || row.facultyId || '—')}</button><div class="person-meta">${esc(row.facultyId || '')}</div></td><td>${esc(row.startDate || '—')}</td><td>${esc(row.endDate || '—')}</td><td>${esc(row.reason || row.legacyPurpose || row.reasonCode || '—')}</td><td>${esc(row.notes || row.legacyPurpose || '—')}</td><td>${esc(norm(row.sourceKind) === 'manual' ? 'Manual' : 'Imported')}</td><td>${row.active === false ? 'No' : 'Yes'}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No AFC records match the current filters.</td></tr>';
    document.querySelectorAll('[data-afc-person]').forEach(node => on(node, 'click', () => openFacultyFromAggregate(node.dataset.afcPerson)));
  }

  function afcFormValues() {
    return { facultyId: text($('afc-faculty')?.value), startDate: text($('afc-start-date')?.value), endDate: text($('afc-end-date')?.value), reasonCode: text($('afc-reason')?.value), notes: text($('afc-notes')?.value) };
  }

  function validateAfcForm(values) {
    if (!values.facultyId) return 'Select an active faculty member.';
    const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
    if (!validDate(values.startDate) || !validDate(values.endDate)) return 'Enter valid start and end dates.';
    if (values.endDate < values.startDate) return 'End date cannot be before start date.';
    if (!Object.prototype.hasOwnProperty.call(AFC_REASON_LABELS, values.reasonCode)) return 'Select a recognised AFC reason.';
    if ((values.reasonCode === 'special' || values.reasonCode === 'other') && !values.notes) return 'Notes are required for Special and Other reasons.';
    if (values.notes.length > 1000) return 'Notes must be 1,000 characters or fewer.';
    return '';
  }

  function setAfcFormStatus(message, error = false) {
    const status = $('afc-form-status'); if (!status) return;
    status.textContent = message; status.classList.toggle('error', error);
  }

  async function submitAfcRecord(event) {
    event?.preventDefault?.();
    if (afcSubmitInFlight) return;
    const values = afcFormValues(); const validation = validateAfcForm(values);
    if (validation) { setAfcFormStatus(validation, true); return; }
    const submit = $('afc-submit');
    afcSubmitInFlight = true; if (submit) { submit.disabled = true; submit.textContent = 'Saving…'; }
    setAfcFormStatus('Saving AFC record…');
    try {
      await UCVM_PAWS_DATA.createDashboardAfcRecord(values);
      $('afc-record-form')?.reset();
      setAfcFormStatus('AFC record created.');
      await loadAdminDashboard();
      await loadAfcRecords(true);
    } catch (error) { setAfcFormStatus(error?.message || 'AFC record could not be created.', true); }
    finally { afcSubmitInFlight = false; if (submit) { submit.disabled = false; submit.textContent = 'Create AFC Record'; } }
  }

  function updateFilters() { fillSelect('filter-rank', unique('rank'), 'All ranks'); }
  function updateStatus() { const summary = dashboardSummary || {}, show = key => present(summary[key]) ? summary[key] : '—'; const status = $('sync-status'); if (status) status.textContent = `Faculty ${faculty.length} · sessions ${show('sessionCount')} · assignments ${show('assignmentCount')} · roles ${show('roleAssignmentCount')} · HICC ${show('hiccCount')} · VISC ${show('viscCount')} · AFC ${show('afcRecordCount')} · check needed ${show('checkNeededCount')}`; const note = $('summary-load-note'); if (note) note.textContent = `VetMed-Ops summary · academic year ${summary.academicYear || 'current'}`; }
  function updateKpis() { const summary = dashboardSummary || {}; const set = (id, key) => { const node = $(id); if (node) node.textContent = present(summary[key]) ? String(summary[key]) : '—'; }; [['kpi-total', 'activeFacultyCount'], ['kpi-sessions', 'sessionCount'], ['kpi-assignments', 'assignmentCount'], ['kpi-courses', 'courseCount'], ['kpi-roles', 'roleAssignmentCount'], ['kpi-hicc', 'hiccCount'], ['kpi-visc', 'viscCount'], ['kpi-afc', 'afcRecordCount'], ['kpi-grid', 'gridPositionableCount'], ['kpi-check', 'checkNeededCount']].forEach(([id, key]) => set(id, key)); }

  function renderLookup() {
    const rows = filteredLookup(); const count = $('result-count'); if (count) count.textContent = rows.length;
    if (selectedId && !rows.some(row => row.__id === selectedId)) selectedId = null;
    const list = $('result-list'); if (list) list.innerHTML = rows.map(row => `<div class="person-row ${row.__id === selectedId ? 'active' : ''}" data-id="${esc(row.__id)}"><div class="person-name">${esc(row.preferredFullName || row.__id)}${row.active === false ? ' <span class="faculty-inactive-badge">Inactive</span>' : ''}</div><div class="person-meta">${esc(row.rank)}${row.teachingArea ? ' · ' + esc(row.teachingArea) : ''}</div><div class="person-meta">${row.sessionCount} sessions · ${row.roleCount} roles · ${row.afcCount} AFC</div>${facultyManagement.editAction(row.facultyId)}</div>`).join('') || '<div class="empty">No matching faculty.</div>';
    document.querySelectorAll('.person-row').forEach(node => on(node, 'click', () => { selectedId = node.dataset.id; renderLookup(); }));
    const selected = faculty.find(row => row.__id === selectedId); if (!selected) { selectedDetail = null; renderApiDetail(null); return; }
    if (detailCache.has(selected.__id)) { selectedDetail = detailCache.get(selected.__id); renderApiDetail(selectedDetail); return; }
    renderDetailPending(selected); selectFacultyDetail(selected.__id);
  }

  function teachingSummaryDoeStatus(row = {}) {
    const teachingMissing = Math.max(0, Number(row.teachingMissingCount || 0));
    const roleMissing = Math.max(0, Number(row.roleMissingCount || 0));
    const notApplicable = Math.max(0, Number(row.teachingNotApplicableCount || 0));
    if (!teachingMissing && !roleMissing) return { label: 'Complete', className: 'doe-within', title: notApplicable ? `${notApplicable} teaching line(s) not applicable to DOE` : 'All applicable DOE lines resolved' };
    if (teachingMissing && roleMissing) return { label: `Teaching + Role Review (${teachingMissing + roleMissing})`, className: 'doe-under', title: `${teachingMissing} teaching and ${roleMissing} role line(s) unresolved` };
    if (teachingMissing) return { label: `Teaching Review (${teachingMissing})`, className: 'doe-under', title: `${teachingMissing} applicable teaching line(s) unresolved` };
    return { label: `Role Review (${roleMissing})`, className: 'doe-under', title: `${roleMissing} role line(s) unresolved` };
  }

  function renderTeachingSummary() {
    const body = $('summary-body'); if (!body) return; const query = norm($('summary-search')?.value); const rows = (aggregateCache.teachingSummary || []).filter(row => !query || norm(`${row.displayName} ${row.facultyId}`).includes(query));
    body.innerHTML = rows.map(row => { const status = teachingSummaryDoeStatus(row); const effectiveTotal = row.effectiveDoeTotal ?? row.recordedDoeTotal; return `<tr><td><button type="button" class="btn-link summary-person" data-summary-person="${esc(row.facultyId)}">${esc(row.displayName || row.facultyId)}</button>${facultyManagement.editAction(row.facultyId)}</td><td>${formatDoe(row.assignedTeachingDoe)}</td><td>${formatDoe(row.roleDoe)}</td><td>${formatDoe(effectiveTotal)}</td><td>${row.year1Assignments ?? 0}</td><td>${row.year2Assignments ?? 0}</td><td>${row.year3Assignments ?? 0}</td><td>${row.year4Assignments ?? 0}</td><td>${display(row.creditedHours)}</td><td>${row.courseCount ?? 0}</td><td>${row.sessionCount ?? 0}</td><td><span class="doe-status ${status.className}" title="${esc(status.title)}">${esc(status.label)}</span></td></tr>`; }).join('') || '<tr><td colspan="12" class="empty">No teaching summary rows.</td></tr>';
    document.querySelectorAll('[data-summary-person]').forEach(node => on(node, 'click', () => openFacultyFromAggregate(node.dataset.summaryPerson)));
  }

  function fillRoleFilter() { fillSelect('role-type-filter', [...new Set((aggregateCache.roles || []).map(row => text(row.roleType)).filter(Boolean))].sort(), 'All role types'); }
  function renderRoles() {
    const body = $('roles-body'); if (!body) return; const query = norm($('roles-search')?.value), type = $('role-type-filter')?.value || '';
    const rows = (aggregateCache.roles || []).filter(row => (!query || norm(`${row.displayName} ${row.roleType} ${row.courseOrSubjectOrRotation} ${row.courseName}`).includes(query)) && (!type || row.roleType === type));
    body.innerHTML = rows.map(row => { const doe = effectiveRoleDoe(row); return `<tr><td><button type="button" class="btn-link summary-person" data-summary-person="${esc(row.facultyId)}">${esc(row.displayName || row.facultyId)}</button></td><td><span class="role-chip">${esc(row.roleType || 'Other')}</span></td><td>${esc(row.courseOrSubjectOrRotation || '—')}</td><td>${esc(row.courseName || '—')}</td><td>${esc(row.details || '—')}</td><td>${esc(row.effectiveDate || '—')}</td><td>${esc(row.expirationDate || '—')}</td><td>${formatDoe(doe.mapped)}</td><td>${formatDoe(doe.override)}</td><td>${formatDoe(doe.effective)}</td><td>${esc(row.doeOverrideReason || '—')}</td><td>${esc(row.specialNotes || '—')}</td></tr>`; }).join('') || '<tr><td colspan="12" class="empty">No role assignments.</td></tr>';
    document.querySelectorAll('[data-summary-person]').forEach(node => on(node, 'click', () => openFacultyFromAggregate(node.dataset.summaryPerson)));
  }

  function openFacultyFromAggregate(facultyId) {
    const id = text(facultyId);
    if (!id || selfMode || !faculty.some(row => row.__id === id)) return;
    selectedId = id;
    selectTab('lookup');
  }

  function renderDoeOverview() {
    const overview = aggregateCache.doeOverview || {}; const coverage = overview.contractTargetCoverage || {}; const cards = $('doe-overview-cards');
    if (cards) cards.innerHTML = [
      ['Contract Teaching target coverage', `${display(coverage.teachingTargetCount)} / ${display(coverage.activeFacultyCount)}`],
      ['Contract Teaching targets missing', coverage.missingTeachingTargetCount],
      ['Contract target coverage', coverage.coveragePercent === null || coverage.coveragePercent === undefined ? '—' : `${Number(coverage.coveragePercent).toFixed(1)}%`],
      ['Assigned Teaching DOE', formatDoe(overview.teachingDoe)],
      ['Role DOE', formatDoe(overview.roleDoe)],
      ['Effective DOE Total', formatDoe(overview.effectiveDoeTotal ?? overview.recordedDoeTotal)]
    ].map(([label, value]) => `<div class="doe-summary-card"><div class="doe-summary-label">${esc(label)}</div><div class="doe-summary-value">${esc(value)}</div></div>`).join('');
    const categories = Array.isArray(coverage.allocationCategories) ? coverage.allocationCategories : [];
    const categoryRows = categories.map(row => `<tr><td>${esc(row.categoryCode)}</td><td>${display(row.facultyCount)}</td><td>${display(row.allocationRowCount)}</td></tr>`).join('');
    const body = $('doe-overview-body'); if (body) body.innerHTML = `<div class="doe-note ${overview.partial ? 'warn-box' : ''}">Stored SessionAssignment DOE and RoleAssignment override/mapped DOE remain authoritative. The server-side DOE Calculator fills only deterministic gaps; missing required inputs remain review items.</div><div class="recon-grid"><div class="recon-card"><div class="recon-label">Assigned Teaching DOE lines unresolved</div><div class="recon-value">${display(overview.teachingMissingCount)}</div><div>${display(overview.teachingRecordedCount)} recorded + ${display(overview.teachingCalculatedCount)} calculated = ${display(overview.teachingResolvedCount)} / ${display(overview.teachingLineCount)} applicable lines resolved · ${display(overview.teachingNotApplicableCount)} not applicable</div></div><div class="recon-card"><div class="recon-label">Role DOE lines unresolved</div><div class="recon-value">${display(overview.roleMissingCount)}</div><div>${display(overview.roleRecordedCount)} recorded + ${display(overview.roleCalculatedCount)} calculated = ${display(overview.roleResolvedCount)} / ${display(overview.roleLineCount)} resolved</div></div><div class="recon-card"><div class="recon-label">Zero overrides preserved</div><div class="recon-value">${display(overview.overrideZeroCount)}</div></div><div class="recon-card"><div class="recon-label">Negative overrides preserved</div><div class="recon-value">${display(overview.overrideNegativeCount)}</div></div></div>${categoryRows ? `<div class="section-title">Non-Teaching Contract DOE category coverage</div><div class="table-wrap"><table class="data-table"><thead><tr><th>Category</th><th>Faculty with source</th><th>Allocation rows</th></tr></thead><tbody>${categoryRows}</tbody></table></div>` : '<div class="empty">No non-Teaching contract DOE allocations are recorded for this academic year.</div>'}`;
  }

  function renderApiDetail(detail) {
    const pane = $('profile-pane'); if (!pane) return; const data = detail && typeof detail === 'object' ? detail : null; const facultyRecord = data?.faculty && typeof data.faculty === 'object' ? data.faculty : null;
    if (!facultyRecord) { pane.innerHTML = '<div class="empty">Select a faculty member to view their profile.</div>'; return; }
    const profile = data.professionalProfile && typeof data.professionalProfile === 'object' ? data.professionalProfile : null;
    const roles = Array.isArray(data.roles) ? data.roles : []; const assignments = Array.isArray(data.teachingAssignments) ? data.teachingAssignments : [];
    const doe = summarizeDoe({ teachingAssignments: assignments, roles });
    const badges = [facultyRecord.rank, present(facultyRecord.fte) ? `FTE ${facultyRecord.fte}` : '', facultyRecord.stream, facultyRecord.recordType].filter(Boolean).map(value => `<span class="badge">${esc(value)}</span>`).join('');
    const identity = field('Display name', facultyRecord.displayName) + field('UCID', facultyRecord.ucid) + field('Email', facultyRecord.email) + field('Rank', facultyRecord.rank) + field('Stream', facultyRecord.stream) + field('FTE', facultyRecord.fte) + field('Reports to', facultyRecord.reportsToName) + field('Active', facultyRecord.active === false ? 'No' : 'Yes');
    const professional = profile ? field('Teaching area', profile.teachingArea, true) + field('Professional category', profile.professionalCategory) + field('Service date', profile.serviceDate) + field('Prior years experience', profile.priorYearsExperience) + field('DVM earned', profile.dvmEarnedDate) + field('DVM type', profile.dvmType) + field('Masters earned', profile.mastersEarnedDate) + field('Masters area', profile.mastersArea, true) + field('PhD earned', profile.phdEarnedDate) + field('PhD area', profile.phdArea, true) + field('Board certification', profile.boardCertification, true) + field('ABVMA member type', profile.abvmaMemberType) : '';
    const joints = (Array.isArray(data.jointAppointments) ? data.jointAppointments : []).map((joint, index) => section(`Joint appointment ${index + 1}`, field('Home faculty', joint.homeFaculty) + field('Joint faculty', joint.jointFaculty) + field('FTE UCVM', joint.fteUcvm) + field('FTE other faculty', joint.fteOtherFaculty) + field('Expiry date', joint.expiryDate) + field('Notes', joint.notes, true))).join('');
    const rolesHtml = apiSection('Roles & Appointments', apiTable(['Role Type', 'Assignment', 'Course Name', 'Details', 'Effective', 'Expires', 'Mapped DOE', 'Override DOE', 'Effective DOE', 'Override Reason', 'Special Notes'], roles.map(role => { const effective = effectiveRoleDoe(role); return [role.roleType, role.courseOrSubjectOrRotation, role.courseName, role.details, role.effectiveDate, role.expirationDate, formatDoe(effective.mapped), formatDoe(effective.override), formatDoe(effective.effective), role.doeOverrideReason, role.specialNotes]; })));
    const afcHtml = apiSection('Away from Campus', apiTable(['Start', 'End', 'Active', 'Reason', 'Notes', 'Source'], (Array.isArray(data.afcRecords) ? data.afcRecords : []).map(record => [record.startDate, record.endDate, record.active === false ? 'No' : 'Yes', record.reason || record.reasonCode || record.purpose, record.notes || record.legacyPurpose, record.sourceKind || 'import'])));
    const scope = section('Identity / appointment metadata', field('Academic year', data.academicYear) + field('Teaching assignments', data.sessionCount) + field('Assignments needing time review', data.checkNeededCount), true);
    const canManage = !selfMode && dashboardAdmin(currentUser) && facultyAdminWriteEnabled;
    const linked = data.linkedRecords || {};
    const actions = facultyManagement.actions(facultyRecord);
    const relationshipNote = canManage && facultyRecord.active !== false ? facultyManagement.relationshipWarning(linked) : '';
    pane.innerHTML = `<div class="profile-header"><div><div class="profile-name">${esc(facultyRecord.displayName || facultyRecord.facultyId || '')}</div><div class="profile-sub">${esc(facultyRecord.email || '')}${facultyRecord.ucid ? ' · UCID ' + esc(facultyRecord.ucid) : ''}</div><div class="badges">${badges}</div></div>${actions}</div>${relationshipNote}<div class="profile-sections">${renderDoeSummary(doe, data.academicYear, assignments, roles, data.contractDoe)}${renderContractDoe(data.contractDoe, facultyRecord)}${renderDoeRuleBook(data.doeRuleBook)}${renderTeachingCourses(assignments)}${rolesHtml}${afcHtml}${profile ? section('Professional Profile', professional, true) : ''}${joints}${scope}${section('Identity', identity)}</div>`;
  }

  function afcFacultyRows() { return activeFaculty.filter(row => row.active !== false).sort((a, b) => String(a.displayName || a.facultyId).localeCompare(String(b.displayName || b.facultyId))); }
  function afcFacultyLabel(row) { return text(row.displayName || row.facultyId) + ' · ' + text(row.facultyId); }
  function resolveAfcFaculty(value) {
    const input = text(value);
    const rows = afcFacultyRows();
    const exact = rows.find(row => text(row.facultyId).toLowerCase() === input.toLowerCase() || afcFacultyLabel(row) === input);
    if (exact) return exact;
    const nameMatches = rows.filter(row => text(row.displayName) === input);
    if (nameMatches.length === 1) return nameMatches[0];
    const parts = input.split(/,\s*/);
    if (parts.length === 2 && parts[0] && parts[1]) {
      const swapped = parts[1] + ' ' + parts[0];
      const transformed = rows.filter(row => text(row.displayName) === swapped);
      if (transformed.length === 1) return transformed[0];
    }
    return null;
  }
  function setAfcMode(multi) {
    $('afc-record-form')?.classList.toggle('hidden', multi);
    $('afc-batch-form')?.classList.toggle('hidden', !multi);
    $('afc-single-mode')?.setAttribute('aria-pressed', String(!multi));
    $('afc-batch-mode')?.setAttribute('aria-pressed', String(multi));
  }
  function invalidateAfcBatch() { afcBatchReviewed = false; afcBatchRequestId = ''; const button = $('afc-batch-submit'); if (button) button.disabled = true; }
  function setAfcBatchStatus(message, isError = false) { const status = $('afc-batch-status'); if (status) { status.textContent = message; status.classList.toggle('error', isError); } }
  function updateAfcBatchField(event) {
    const input = event.target?.closest?.('[data-afc-batch-field]'); if (!input) return;
    const index = Number(input.dataset.rowIndex), field = input.dataset.afcBatchField, row = afcBatchRows[index]; if (!row) return;
    row.importError = '';
    if (field === 'facultyEntry') { row.facultyEntry = input.value; const match = resolveAfcFaculty(input.value); row.facultyId = match ? match.facultyId : ''; }
    else row[field] = input.value;
    if (field === 'startDate' || field === 'endDate') {
      row.dateErrors = { ...(row.dateErrors || {}), [field]: '' };
      row.errors = Object.values(row.dateErrors).filter(Boolean);
      row.status = row.errors.length ? 'INVALID' : 'EDIT';
    }
    invalidateAfcBatch();
    document.querySelectorAll('#afc-batch-rows tr').forEach(tr => { if (tr.children[4]) tr.children[4].textContent = 'Not reviewed'; });
    setAfcBatchStatus('Changes made. Validate and review all rows before submitting.');
    if (afcBatchReviewed) { reviewAfcBatch(); renderAfcBatchRows(); }
  }
  function validateAfcBatchRows() {
    return UCVM_AFC_BATCH.validateRows(afcBatchRows, resolveAfcFaculty);
  }
  function reviewAfcBatch() {
    const rows = validateAfcBatchRows(); afcBatchReviewed = true;
    const invalid = rows.filter(row => row.errors.length).length, valid = UCVM_AFC_BATCH.canSubmitRows(rows, afcSubmitInFlight);
    const button = $('afc-batch-submit'); if (button) button.disabled = !valid || afcSubmitInFlight;
    setAfcBatchStatus(invalid ? invalid + ' row(s) need review; nothing was submitted.' : rows.length + ' row(s) ready. Review all values before submitting.');
    return valid;
  }
  function renderAfcBatchRows() {
    const body = $('afc-batch-rows'); if (!body) return;
    body.innerHTML = afcBatchRows.map((row, index) => '<tr><td><input class="input" list="afc-faculty-options" data-afc-batch-field="facultyEntry" data-row-index="' + index + '" value="' + esc(row.facultyEntry || '') + '" aria-label="Faculty member row ' + (index + 1) + '" placeholder="Search active Faculty…"></td><td><input class="input" type="date" data-afc-batch-field="startDate" data-row-index="' + index + '" value="' + esc(row.startDate) + '" aria-label="Start date row ' + (index + 1) + '"></td><td><input class="input" type="date" data-afc-batch-field="endDate" data-row-index="' + index + '" value="' + esc(row.endDate) + '" aria-label="End date row ' + (index + 1) + '"></td><td><input class="input" maxlength="1000" data-afc-batch-field="purpose" data-row-index="' + index + '" value="' + esc(row.purpose) + '" aria-label="Purpose row ' + (index + 1) + '"></td><td>' + (row.errors?.length ? esc(row.status + ': ' + row.errors.join(' ')) : afcBatchReviewed ? esc(row.status) : 'Not reviewed') + '</td><td><button class="btn" type="button" data-afc-batch-remove="' + index + '" aria-label="Remove row ' + (index + 1) + '">Remove</button></td></tr>').join('') || '<tr><td colspan="6" class="empty">Add or paste rows to begin.</td></tr>';
  }
  function loadAfcBatchPaste() {
    const parsed = UCVM_AFC_BATCH.parsePaste($('afc-batch-paste')?.value || '', resolveAfcFaculty);
    if (parsed.error) return setAfcBatchStatus(parsed.error, true);
    afcBatchRows = parsed.rows;
    invalidateAfcBatch(); renderAfcBatchRows();
    setAfcBatchStatus(parsed.rows.length + ' pasted row(s) loaded. Validate and review before submit.');
  }
  async function submitAfcBatch() {
    if (afcSubmitInFlight || !reviewAfcBatch()) return;
    if (!afcBatchRequestId) afcBatchRequestId = crypto.randomUUID();
    const submit = $('afc-batch-submit'); afcSubmitInFlight = true; if (submit) submit.disabled = true;
    setAfcBatchStatus('Submitting the complete batch…');
    try {
      const outcome = await UCVM_PAWS_DATA.createDashboardAfcManualBatch({ requestId: afcBatchRequestId, rows: UCVM_AFC_BATCH.toApiRows(afcBatchRows) });
      afcBatchRows = []; afcBatchRequestId = ''; afcBatchReviewed = false;
      setAfcBatchStatus(UCVM_AFC_BATCH.successMessage(outcome));
      await loadAdminDashboard(); await loadAfcRecords(true); renderAfcBatchRows();
    } catch (error) {
      if (Array.isArray(error?.rows)) {
        for (const outcome of error.rows) {
          const row = afcBatchRows[Number(outcome.rowIndex)]; if (!row) continue;
          row.status = outcome.status || outcome.rowStatus || 'CONFLICT';
          row.errors = [row.status === 'ALREADY_EXISTS' ? 'Matching AFC record already exists.' : 'This row was not created. Review the batch conflict.'];
        }
        afcBatchReviewed = true; renderAfcBatchRows();
      }
      setAfcBatchStatus((error?.message || 'Batch could not be submitted.') + ' Resolve row conflicts and validate before retrying.', true);
    }
    finally {
      afcSubmitInFlight = false;
      if (afcBatchRows.length) reviewAfcBatch();
      else { const button = $('afc-batch-submit'); if (button) button.disabled = true; }
      renderAfcBatchRows();
    }
  }

  const DOE_PROFILE_RENDERER = window.UCVM_FACULTY_DOE_RENDERER.create({ esc, number, formatDoe, display, effectiveRoleDoe, groupTeachingAssignments });
  const { renderContractDoe, renderDoeRuleBook, renderDoeSummary, renderTeachingCourses } = DOE_PROFILE_RENDERER;
  function renderDetailPending(row) { const pane = $('profile-pane'); if (pane) pane.innerHTML = row ? `<div class="empty">Loading ${esc(row.preferredFullName || row.__id)}…</div>` : '<div class="empty">Select a faculty member to view their profile.</div>'; }
  async function selectFacultyDetail(facultyId) { const started = typeof performance?.now === 'function' ? performance.now() : 0; const id = String(facultyId ?? '').trim(); if (!id || detailPending.has(id)) return; if (detailCache.has(id)) { selectedDetail = detailCache.get(id); renderApiDetail(selectedDetail); return; } detailPending.add(id); const token = ++detailLoadToken; try { const detail = await UCVM_PAWS_DATA.dashboardFacultyById(id); if (token !== detailLoadToken) return; detailCache.set(id, detail); selectedDetail = detail; renderApiDetail(detail); pawsTimingLog(`detail`, started); } catch (error) { if (token !== detailLoadToken) return; const pane = $('profile-pane'); if (pane) pane.innerHTML = `<div class="empty">${esc(detailFailureMessage(error))}</div>`; } finally { detailPending.delete(id); } }

  function apiTable(headers, rows) { if (!rows.length) return ''; return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(header => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(cells => `<tr>${cells.map(cell => `<td>${esc(display(cell))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
  function apiSection(title, table) { return table ? `<section class="section wide"><div class="section-title">${esc(title)}</div>${table}</section>` : ''; }
  function display(value) { if (!present(value)) return '—'; if (typeof value === 'object') return JSON.stringify(value); return String(value); }
  function field(label, value, full = false) { return present(value) ? `<div class="field ${full ? 'full' : ''}"><div class="field-label">${esc(label)}</div><div class="field-value">${esc(display(value))}</div></div>` : ''; }
  function section(title, body, wide = false) { return body.trim() ? `<section class="section ${wide ? 'wide' : ''}"><div class="section-title">${esc(title)}</div><div class="field-grid">${body}</div></section>` : ''; }
  function detailFailureMessage(error) { const status = Number(error?.status) || 0, code = String(error?.code || ''); if (status === 404 || code === 'FACULTY_NOT_FOUND') return 'This faculty record was not found in the Dashboard data source.'; if (status === 401 || code === 'UNAUTHENTICATED') return 'Your Dashboard session could not be verified. Your sign-in is still active.'; if (status === 403 || ['ROLE_DENIED', 'PROFILE_REQUIRED', 'FACULTY_LINK_REQUIRED'].includes(code)) return error?.message || 'This account cannot read that faculty record.'; if (status === 503 || code === 'SQL_UNAVAILABLE' || status === 0) return 'Faculty data is temporarily unavailable. Your sign-in is still active.'; return error?.message || 'Faculty detail could not be loaded.'; }
  function cameFromTimetable(){
    try{const ref=new URL(document.referrer||'',location.href);return ref.origin===location.origin&&(ref.pathname.endsWith('/')||ref.pathname.endsWith('/index.html'))}catch(_){return false}
  }
  function returnToTimetable(){
    if(cameFromTimetable()&&history.length>1){history.back();return}
    location.href='index.html';
  }
  function dashboardAuthFailureMessage(error) { const status = Number(error?.status) || 0, code = String(error?.code || ''); if (status === 503 || code === 'SQL_UNAVAILABLE' || status === 0) return 'Faculty Dashboard is temporarily unavailable. Your sign-in is still active. Refresh this page to retry.'; if (status === 401 || code === 'UNAUTHENTICATED') return 'Your Dashboard session could not be verified. Your sign-in is still active. Refresh this page to retry.'; if (status === 403) return error?.message || 'This account does not have Faculty Dashboard access.'; return error?.message || 'Could not verify Faculty Dashboard access.'; }
  function setDashboardLoading(loading) { if (!loading) return; const status = $('sync-status'); if (status) status.textContent = 'Loading Dashboard…'; document.querySelectorAll('.kpi-value').forEach(node => { node.textContent = '…'; }); const list = $('result-list'); if (list) list.innerHTML = '<div class="empty">Loading faculty…</div>'; }
  function markDashboardUnavailable(message) { const status = $('sync-status'); if (status) status.textContent = message; document.querySelectorAll('.kpi-value').forEach(node => { node.textContent = '—'; }); const list = $('result-list'); if (list) list.innerHTML = `<div class="empty">${esc(message)}</div>`; const pane = $('profile-pane'); if (pane) pane.innerHTML = '<div class="empty">Faculty data is currently unavailable.</div>'; }
  function unique(key) { return [...new Set(faculty.map(row => text(row[key])).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
  function fillSelect(id, values, label) { const element = $(id); if (!element) return; const old = element.value; element.innerHTML = `<option value="">${esc(label)}</option>` + values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join(''); if (values.includes(old)) element.value = old; }
  function searchBlob(row) { return [row.displayName, row.preferredFullName, row.preferredFirstName, row.preferredLastName, row.ucid, row.email, row.rank, row.stream, row.teachingArea, row.professionalCategory, row.reportsToName].filter(present).join(' ').toLowerCase(); }
  function filteredLookup() { const query = norm($('lookup-search')?.value), rank = $('filter-rank')?.value || ''; return faculty.filter(row => (!query || searchBlob(row).includes(query)) && (!rank || row.rank === rank)); }
  function showToast(message, isError = false) { const node = $('toast'); if (!node) return; node.textContent = String(message || ''); node.classList.toggle('error', isError); node.classList.add('show'); window.setTimeout(() => node.classList.remove('show'), 4500); }
  const facultyManagement = window.UCVM_FACULTY_ADMIN_MANAGEMENT.create({
    canWrite: () => !selfMode && dashboardAdmin(currentUser) && facultyAdminWriteEnabled,
    getFaculty: () => faculty,
    getSelectedDetail: () => selectedDetail,
    getFacultyDetail: facultyId => UCVM_PAWS_DATA.dashboardFacultyById(facultyId),
    notify: showToast,
    onChanged: async (id, requestedStatus) => {
      if (requestedStatus === 'inactive' && facultyStatus === 'active') facultyStatus = 'inactive';
      else if (requestedStatus === 'active' && facultyStatus === 'inactive') facultyStatus = 'active';
      if ($('faculty-status-filter')) $('faculty-status-filter').value = facultyStatus;
      selectedId = id; detailCache.clear(); await loadAdminDashboard(); await selectFacultyDetail(id);
    }
  });
  function installSelfModeStyles() { if ($('faculty-self-mode-style')) return; const style = document.createElement('style'); style.id = 'faculty-self-mode-style'; style.textContent = 'body.faculty-self-mode .tabs,body.faculty-self-mode .kpis,body.faculty-self-mode .summary-source-banner,body.faculty-self-mode #lookup-view > .toolbar,body.faculty-self-mode .result-pane,body.faculty-self-mode #sync-status{display:none!important}body.faculty-self-mode .lookup-grid{display:block;min-height:0}body.faculty-self-mode .profile-pane{width:100%;min-width:0;padding:18px}'; document.head.appendChild(style); }
  function lock(message) { $('auth-gate').classList.remove('hidden'); $('gate-status').textContent = message; }
  function unlock() { $('auth-gate').classList.add('hidden'); }
  function debounce(fn, wait = 160) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); }; }

  $('gate-back').onclick = $('back-btn').onclick = returnToTimetable;
  $('signout-btn').onclick = async () => { if (auth) await auth.signOut(); location.href = 'index.html'; };
  init();
})();
