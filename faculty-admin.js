(() => {
  'use strict';

  const FIREBASE_CONFIG = { apiKey: 'AIzaSyDS9VE2zTXv0656_Mh0uDXB67-mZ5Y_LkY', authDomain: 'tester-teaching.firebaseapp.com', projectId: 'tester-teaching', storageBucket: 'tester-teaching.firebasestorage.app', messagingSenderId: '566638053186', appId: '1:566638053186:web:90e04b52251c4b859baadb', measurementId: 'G-F7HW5XX4JE' };
  const VIEW = window.PAWS_DASHBOARD_VIEW_MODEL || {};
  const number = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
  const normalizeCurriculumYear = VIEW.normalizeCurriculumYear || (value => {
    const raw = text(value);
    if (!raw) return 'Unassigned year';
    const match = raw.match(/^(?:year\s*)?([1-4])$/i);
    return match ? `Year ${match[1]}` : raw;
  });
  const groupTeachingAssignments = VIEW.groupTeachingAssignments || (assignments => {
    const groups = new Map();
    (Array.isArray(assignments) ? assignments : []).forEach(item => {
      const row = item && typeof item === 'object' ? item : {};
      const year = normalizeCurriculumYear(row.curriculumYear || row.year);
      const code = text(row.courseCode || row.course || 'Unassigned');
      const key = `${year}::${code}`;
      if (!groups.has(key)) groups.set(key, { curriculumYear: year, courses: [{ courseCode: code, courseName: text(row.courseName), assignments: [], assignmentCount: 0, recordedDoeCount: 0, missingDoeCount: 0, creditedHours: 0, doeTotal: null, doeStatus: 'none' }] });
      const course = groups.get(key).courses[0];
      course.assignments.push(row); course.assignmentCount += 1; course.creditedHours += Number(row.creditedHours) || 0;
      const doe = number(row.doeCredit);
      if (doe === null) course.missingDoeCount += 1;
      else { course.recordedDoeCount += 1; course.doeTotal = (course.doeTotal === null ? 0 : course.doeTotal) + doe; }
    });
    return [...groups.values()].sort((a, b) => String(a.curriculumYear).localeCompare(String(b.curriculumYear))).map(group => { group.courses.sort((a, b) => String(a.courseCode).localeCompare(String(b.courseCode))); group.courses.forEach(course => { course.doeStatus = course.assignmentCount === 0 ? 'none' : (course.missingDoeCount ? 'needs-review' : 'complete'); }); group.assignmentCount = group.courses.reduce((sum, course) => sum + course.assignmentCount, 0); group.sessionCount = group.assignmentCount; group.creditedHours = group.courses.reduce((sum, course) => sum + course.creditedHours, 0); return group; });
  });
  const effectiveRoleDoe = VIEW.effectiveRoleDoe || (role => { const mapped = number(role?.doeMappedValue), override = role?.doeOverrideValue === null || role?.doeOverrideValue === undefined ? null : number(role.doeOverrideValue); const effective = Object.prototype.hasOwnProperty.call(role || {}, 'effectiveDoe') ? number(role.effectiveDoe) : (override !== null ? override : mapped); return { mapped, override, effective, status: effective === null ? 'needs-review' : 'stored' }; });
  const summarizeDoe = VIEW.summarizeDoe || ((input = {}) => {
    const teaching = Array.isArray(input.teachingAssignments) ? input.teachingAssignments : [];
    const roles = Array.isArray(input.roles) ? input.roles : [];
    const teachingValues = teaching.map(row => number(row?.doeCredit)).filter(value => value !== null);
    const roleValues = roles.map(row => effectiveRoleDoe(row).effective).filter(value => value !== null);
    const teachingMissingCount = teaching.length - teachingValues.length;
    const roleMissingCount = roles.length - roleValues.length;
    const sum = values => values.reduce((total, value) => total + value, 0);
    const teachingDoe = teaching.length && !teachingValues.length ? null : sum(teachingValues);
    const roleDoe = roles.length && !roleValues.length ? null : sum(roleValues);
    return {
      teachingDoe, roleDoe,
      recordedDoeTotal: (teaching.length + roles.length) && !(teachingValues.length + roleValues.length) ? null : sum([...teachingValues, ...roleValues]),
      teachingLineCount: teaching.length, teachingRecordedCount: teachingValues.length, teachingMissingCount,
      roleLineCount: roles.length, roleRecordedCount: roleValues.length, roleMissingCount,
      partial: teachingMissingCount > 0 || roleMissingCount > 0
    };
  });
  const formatDoe = VIEW.formatDoe || (value => number(value) === null ? 'DOE unavailable' : `${Number(value).toFixed(2)}%`);
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
  let selectedId = null;
  let selectedDetail = null;
  let selfMode = false;
  let dashboardSummary = null;
  let activeTab = 'lookup';
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
      sessionCount: Number(r.sessionCount) || 0, roleCount: Number(r.roleCount) || 0, afcCount: Number(r.afcCount) || 0, jointAppointmentCount: Number(r.jointAppointmentCount) || 0 };
  }

  async function loadAdminDashboard() {
    const started = typeof performance?.now === 'function' ? performance.now() : 0;
    setDashboardLoading(true);
    try {
      const [summary, rows] = await Promise.all([UCVM_PAWS_DATA.dashboardSummary(), UCVM_PAWS_DATA.dashboardFaculty()]);
      dashboardSummary = summary && typeof summary === 'object' && !Array.isArray(summary) ? summary : {};
      faculty = (Array.isArray(rows) ? rows : []).map(rosterRecord);
      updateFilters(); updateKpis(); updateStatus(); renderActiveTab();
      pawsTimingLog('summary+faculty', started);
    } catch (error) { console.error(error); markDashboardUnavailable(dashboardAuthFailureMessage(error)); }
  }

  function dashboardRawRole(value) { return String((value && typeof value === 'object' ? value.role : value) || '').toLowerCase(); }
  function dashboardRole(value) { return ({ owner: 'adfa_general', administrator: 'adfa_regular', other_office: 'other_office', adfa_general: 'adfa_general', adfa_regular: 'adfa_regular', admin: 'adfa_regular', editor: 'faculty', viewer: 'faculty' }[dashboardRawRole(value)] || dashboardRawRole(value)); }
  function dashboardAdmin(profile) { return ['adfa_general', 'adfa_regular'].includes(dashboardRole(profile && profile.role)); }
  function dashboardGeneral(profile) { return dashboardRole(profile && profile.role) === 'adfa_general'; }
  function dashboardRoleLabel(value) { return ({ owner: 'Owner', adfa_general: 'Owner', administrator: 'Administrator', adfa_regular: 'Administrator', admin: 'Administrator', other_office: 'Other Office', hicc: 'HICC', visc: 'VISC', faculty: 'Faculty', editor: 'Faculty', viewer: 'Faculty' }[dashboardRawRole(value)] || dashboardRawRole(value)); }
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
    $('admin-chip').textContent = `${currentUser.name} · ${dashboardRoleLabel(profile.role)}`; $('user-management-link')?.classList.add('hidden');
    const heading = document.querySelector('.headline h1'), copy = document.querySelector('.headline p');
    if (heading) heading.textContent = 'My Faculty Profile';
    if (copy) copy.textContent = 'Your teaching, roles, appointments, availability, and stored DOE evidence.';
    unlock(); await loadSelfFaculty(profile.facultyId);
  }

  function enterAdminMode(user, profile) {
    selfMode = false; document.body.classList.remove('faculty-self-mode');
    currentUser = { uid: user.uid, email: user.email || '', name: profile.displayName || profile.name || user.displayName || user.email || 'Administrator', role: profile.role };
    $('admin-chip').textContent = `${currentUser.name} · ${dashboardRoleLabel(profile.role)}`; $('user-management-link')?.classList.toggle('hidden', !dashboardGeneral(profile));
    unlock(); loadAdminDashboard();
  }

  function init() {
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      auth = firebase.auth(); if (window.UCVMSessionGuard) window.UCVMSessionGuard.start(auth);
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {}); bindUI();
      auth.onAuthStateChanged(async user => {
        if (!user) { currentUser = null; lock('You are not signed in. Return to the timetable and sign in.'); return; }
        try {
          lock('Checking Dashboard access…'); const meStarted = typeof performance?.now === 'function' ? performance.now() : 0; const profile = await UCVM_PAWS_DATA.currentUser(); pawsTimingLog('me', meStarted);
          if (!profile || profile.active !== true) { lock('This Dashboard requires an active UCVM account.'); return; }
          if (profile.mustChangePassword === true) { location.replace('password.html'); return; }
          if (isSelfServiceProfile(profile) && !profile.facultyId) { lock('Your account requires a linked faculty profile. Please contact ADFA.'); return; }
          if (isSelfServiceProfile(profile)) { await enterSelfMode(user, profile); return; }
          if (dashboardAdmin(profile)) { enterAdminMode(user, profile); return; }
          lock('This account does not have Faculty Dashboard access.');
        } catch (error) { console.error(error); if (error?.code === 'PASSWORD_CHANGE_REQUIRED') location.replace('password.html'); else lock(dashboardAuthFailureMessage(error)); }
      });
    } catch (error) { console.error(error); lock('Firebase could not initialize.'); }
  }

  function bindUI() {
    on($('lookup-search'), 'input', debounce(renderLookup)); on($('filter-rank'), 'change', renderLookup);
    on($('lookup-reset'), 'click', () => { $('lookup-search').value = ''; $('filter-rank').value = ''; renderLookup(); });
    document.querySelectorAll('.tab').forEach(tab => on(tab, 'click', () => selectTab(tab.dataset.tab)));
    on($('summary-search'), 'input', renderTeachingSummary); on($('roles-search'), 'input', renderRoles);
    on($('role-type-filter'), 'change', renderRoles);
  }

  function selectTab(tabName) {
    if (selfMode) return;
    activeTab = tabName || 'lookup';
    document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === activeTab));
    ['lookup', 'summary', 'roles', 'doe-overview'].forEach(name => $(name + '-view')?.classList.toggle('hidden', name !== activeTab));
    renderActiveTab();
  }

  function renderActiveTab() {
    if (activeTab === 'summary') return loadTeachingSummary();
    if (activeTab === 'roles') return loadRoles();
    if (activeTab === 'doe-overview') return loadDoeOverview();
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

  function updateFilters() { fillSelect('filter-rank', unique('rank'), 'All ranks'); }
  function updateStatus() { const summary = dashboardSummary || {}, show = key => present(summary[key]) ? summary[key] : '—'; const status = $('sync-status'); if (status) status.textContent = `Faculty ${faculty.length} · sessions ${show('sessionCount')} · assignments ${show('assignmentCount')} · roles ${show('roleAssignmentCount')} · HICC ${show('hiccCount')} · VISC ${show('viscCount')} · AFC ${show('afcRecordCount')} · check needed ${show('checkNeededCount')}`; const note = $('summary-load-note'); if (note) note.textContent = `Azure SQL summary · academic year ${summary.academicYear || 'current'}`; }
  function updateKpis() { const summary = dashboardSummary || {}; const set = (id, key) => { const node = $(id); if (node) node.textContent = present(summary[key]) ? String(summary[key]) : '—'; }; [['kpi-total', 'activeFacultyCount'], ['kpi-sessions', 'sessionCount'], ['kpi-assignments', 'assignmentCount'], ['kpi-courses', 'courseCount'], ['kpi-roles', 'roleAssignmentCount'], ['kpi-hicc', 'hiccCount'], ['kpi-visc', 'viscCount'], ['kpi-afc', 'afcRecordCount'], ['kpi-grid', 'gridPositionableCount'], ['kpi-check', 'checkNeededCount']].forEach(([id, key]) => set(id, key)); }

  function renderLookup() {
    const rows = filteredLookup(); const count = $('result-count'); if (count) count.textContent = rows.length;
    if (selectedId && !rows.some(row => row.__id === selectedId)) selectedId = null;
    const list = $('result-list'); if (list) list.innerHTML = rows.map(row => `<div class="person-row ${row.__id === selectedId ? 'active' : ''}" data-id="${esc(row.__id)}"><div class="person-name">${esc(row.preferredFullName || row.__id)}</div><div class="person-meta">${esc(row.rank)}${row.teachingArea ? ' · ' + esc(row.teachingArea) : ''}</div><div class="person-meta">${row.sessionCount} sessions · ${row.roleCount} roles · ${row.afcCount} AFC</div></div>`).join('') || '<div class="empty">No matching faculty.</div>';
    document.querySelectorAll('.person-row').forEach(node => on(node, 'click', () => { selectedId = node.dataset.id; renderLookup(); }));
    const selected = faculty.find(row => row.__id === selectedId); if (!selected) { selectedDetail = null; renderApiDetail(null); return; }
    if (detailCache.has(selected.__id)) { selectedDetail = detailCache.get(selected.__id); renderApiDetail(selectedDetail); return; }
    renderDetailPending(selected); selectFacultyDetail(selected.__id);
  }

  function renderTeachingSummary() {
    const body = $('summary-body'); if (!body) return; const query = norm($('summary-search')?.value); const rows = (aggregateCache.teachingSummary || []).filter(row => !query || norm(`${row.displayName} ${row.facultyId}`).includes(query));
    body.innerHTML = rows.map(row => `<tr><td><button type="button" class="btn-link summary-person" data-summary-person="${esc(row.facultyId)}">${esc(row.displayName || row.facultyId)}</button></td><td>${formatDoe(row.assignedTeachingDoe)}</td><td>${formatDoe(row.roleDoe)}</td><td>${formatDoe(row.recordedDoeTotal)}</td><td>${row.year1Assignments ?? 0}</td><td>${row.year2Assignments ?? 0}</td><td>${row.year3Assignments ?? 0}</td><td>${row.year4Assignments ?? 0}</td><td>${display(row.creditedHours)}</td><td>${row.courseCount ?? 0}</td><td>${row.sessionCount ?? 0}</td><td><span class="doe-status ${row.doeComplete ? 'doe-within' : 'doe-under'}">${row.doeComplete ? 'Complete' : 'Needs Review'}</span></td></tr>`).join('') || '<tr><td colspan="12" class="empty">No teaching summary rows.</td></tr>';
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
    const overview = aggregateCache.doeOverview || {}; const cards = $('doe-overview-cards'); if (cards) cards.innerHTML = [['Teaching DOE', overview.teachingDoe], ['Role / Appointment DOE', overview.roleDoe], ['Recorded DOE Total', overview.recordedDoeTotal], ['Teaching lines', overview.teachingLineCount], ['Role lines', overview.roleLineCount], ['Overrides', overview.overrideCount]].map(([label, value]) => `<div class="doe-summary-card"><div class="doe-summary-label">${esc(label)}</div><div class="doe-summary-value">${label.includes('DOE') ? formatDoe(value) : display(value)}</div></div>`).join('');
    const body = $('doe-overview-body'); if (body) body.innerHTML = `<div class="doe-note ${overview.partial ? 'warn-box' : ''}">${overview.partial ? 'PARTIAL / NEEDS REVIEW: one or more stored DOE lines are missing.' : 'Stored DOE lines are complete for the current aggregate.'}</div><div class="recon-grid"><div class="recon-card"><div class="recon-label">Missing teaching DOE lines</div><div class="recon-value">${display(overview.teachingMissingCount)}</div></div><div class="recon-card"><div class="recon-label">Missing role DOE lines</div><div class="recon-value">${display(overview.roleMissingCount)}</div></div><div class="recon-card"><div class="recon-label">Zero overrides preserved</div><div class="recon-value">${display(overview.overrideZeroCount)}</div></div><div class="recon-card"><div class="recon-label">Negative overrides preserved</div><div class="recon-value">${display(overview.overrideNegativeCount)}</div></div></div>`; }

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
    const afcHtml = apiSection('Away from Campus', apiTable(['Start', 'End', 'Active', 'Purpose'], (Array.isArray(data.afcRecords) ? data.afcRecords : []).map(record => [record.startDate, record.endDate, record.active === false ? 'No' : 'Yes', record.purpose])));
    const scope = section('Identity / appointment metadata', field('Academic year', data.academicYear) + field('Teaching assignments', data.sessionCount) + field('Assignments needing time review', data.checkNeededCount), true);
    pane.innerHTML = `<div class="profile-header"><div><div class="profile-name">${esc(facultyRecord.displayName || facultyRecord.facultyId || '')}</div><div class="profile-sub">${esc(facultyRecord.email || '')}${facultyRecord.ucid ? ' · UCID ' + esc(facultyRecord.ucid) : ''}</div><div class="badges">${badges}</div></div></div><div class="profile-sections">${renderDoeSummary(doe, data.academicYear, assignments, roles)}${renderTeachingCourses(assignments)}${rolesHtml}${afcHtml}${profile ? section('Professional Profile', professional, true) : ''}${joints}${scope}${section('Identity', identity)}</div>`;
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
    return `<div class="doe-evidence"><div class="doe-evidence-title">DOE Evidence · read-only stored Azure records</div><div class="doe-evidence-copy">Stored credits and mapped/override values are shown as received; no rate × quantity or browser recalculation is applied.</div>${teaching}${role}</div>`;
  }

  function renderDoeSummary(summary, academicYear, assignments, roles) {
    const status = doeEvidenceStatus(summary);
    const statusClass = status === 'Recorded' ? 'doe-within' : 'doe-under';
    const card = (label, value, subline = '', className = '') => `<div class="doe-summary-card ${className}"><div class="doe-summary-label">${esc(label)}</div><div class="doe-summary-value">${esc(value)}</div>${subline ? `<div class="doe-summary-subline">${esc(subline)}</div>` : ''}</div>`;
    return `<section class="section wide doe-profile-summary doe-worksheet"><div class="section-title">DOE Summary · ${esc(`${academicYear || 'Teaching'} Teaching DOE · Azure recorded evidence`)}</div><div class="doe-worksheet-boundary"><span class="available">AVAILABLE NOW</span> Stored / recorded Azure SQL DOE evidence <span class="unavailable">NOT YET AVAILABLE</span> Full authoritative DOE policy Worksheet engine</div><div class="doe-summary-grid">${card('Recorded Assigned DOE', formatDoe(summary.recordedDoeTotal), status, statusClass)}${card('Scheduled Teaching', formatDoe(summary.teachingDoe))}${card('Roles / Appointments', formatDoe(summary.roleDoe))}${card('Applied Supervision', 'Not available in Azure Beta', 'Full DOE policy worksheet not yet migrated')}${card('Effective Target', 'Not available in Azure Beta')}${card('Remaining / Over', 'Unavailable', 'Target unavailable')}${card('Policy Version', 'Not migrated', 'Unavailable in Azure Beta')}${card('Reserve', 'Not available in Azure Beta')}</div><div class="doe-note">The Azure Beta currently displays authoritative stored DOE evidence from teaching assignments and role assignments. Effective Target, Reserve, policy version, supervision allocation and full rule/calculation provenance require the DOE policy engine and are not inferred in the browser.</div><div class="doe-evidence-status ${statusClass}">DOE status: ${esc(status)}</div>${renderDoeEvidence(assignments, roles)}</section>`;
  }

  function renderTeachingCourses(assignments) {
    const years = groupTeachingAssignments(assignments); const body = years.map(year => `<section class="year-section"><h3 class="year-title">${esc(year.curriculumYear)} · ${year.sessionCount ?? year.assignmentCount ?? 0} sessions · ${Number(year.creditedHours || 0).toFixed(2)} credited hours</h3>${year.courses.map(course => `<details class="course-group"><summary><div><div class="course-group-title">${esc(course.courseCode)}</div><div class="course-group-meta">${esc(course.courseName || 'Course name unavailable')} · ${course.assignmentCount} sessions · ${course.creditedHours.toFixed(2)} credited hours · ${formatDoe(course.doeTotal)} stored DOE</div></div><span class="course-group-meta">${course.doeStatus === 'complete' ? 'DOE recorded' : 'Needs Review'} ▾</span></summary><div class="table-wrap"><table class="activity-table"><thead><tr><th>Date</th><th>Start</th><th>End</th><th>Session Type</th><th>Teaching Role</th><th>Topic / Activity</th><th>Room</th><th>Credited Hours</th><th>DOE Rate</th><th>DOE Quantity</th><th>DOE Unit</th><th>DOE Credit</th><th>DOE Status</th></tr></thead><tbody>${course.assignments.map(assignment => `<tr data-session-id="${esc(assignment.sessionId || '')}"><td>${esc(assignment.date || '—')}</td><td>${esc(assignment.startTime || '—')}</td><td>${esc(assignment.endTime || '—')}</td><td>${esc(assignment.sessionType || '—')}</td><td>${esc(assignment.teachingRole || '—')}</td><td class="session-topic">${esc(assignment.topic || '—')}</td><td>${esc(assignment.room || '—')}</td><td>${display(assignment.creditedHours)}</td><td>${formatDoe(assignment.doeRate)}</td><td>${display(assignment.doeQuantity)}</td><td>${esc(assignment.doeUnit || '—')}</td><td>${formatDoe(assignment.doeCredit)}</td><td>${esc(assignment.doeStatus || 'Needs Review')}</td></tr>`).join('')}</tbody></table></div></details>`).join('')}</section>`).join('') || '<div class="empty">No teaching assignments recorded for this academic year.</div>';
    return `<section class="section wide"><div class="section-title">Teaching / Courses</div>${body}</section>`;
  }

  function renderDetailPending(row) { const pane = $('profile-pane'); if (pane) pane.innerHTML = row ? `<div class="empty">Loading ${esc(row.preferredFullName || row.__id)}…</div>` : '<div class="empty">Select a faculty member to view their profile.</div>'; }
  async function selectFacultyDetail(facultyId) { const started = typeof performance?.now === 'function' ? performance.now() : 0; const id = String(facultyId ?? '').trim(); if (!id || detailPending.has(id)) return; if (detailCache.has(id)) { selectedDetail = detailCache.get(id); renderApiDetail(selectedDetail); return; } detailPending.add(id); const token = ++detailLoadToken; try { const detail = await UCVM_PAWS_DATA.dashboardFacultyById(id); if (token !== detailLoadToken) return; detailCache.set(id, detail); selectedDetail = detail; renderApiDetail(detail); pawsTimingLog(`detail`, started); } catch (error) { if (token !== detailLoadToken) return; const pane = $('profile-pane'); if (pane) pane.innerHTML = `<div class="empty">${esc(detailFailureMessage(error))}</div>`; } finally { detailPending.delete(id); } }

  function apiTable(headers, rows) { if (!rows.length) return ''; return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(header => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(cells => `<tr>${cells.map(cell => `<td>${esc(display(cell))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
  function apiSection(title, table) { return table ? `<section class="section wide"><div class="section-title">${esc(title)}</div>${table}</section>` : ''; }
  function display(value) { if (!present(value)) return '—'; if (typeof value === 'object') return JSON.stringify(value); return String(value); }
  function field(label, value, full = false) { return present(value) ? `<div class="field ${full ? 'full' : ''}"><div class="field-label">${esc(label)}</div><div class="field-value">${esc(display(value))}</div></div>` : ''; }
  function section(title, body, wide = false) { return body.trim() ? `<section class="section ${wide ? 'wide' : ''}"><div class="section-title">${esc(title)}</div><div class="field-grid">${body}</div></section>` : ''; }
  function detailFailureMessage(error) { const status = Number(error?.status) || 0, code = String(error?.code || ''); if (status === 404 || code === 'FACULTY_NOT_FOUND') return 'This faculty record was not found in the Dashboard data source.'; if (status === 401 || code === 'UNAUTHENTICATED') return 'Your Dashboard session could not be verified. Your sign-in is still active.'; if (status === 403 || ['ROLE_DENIED', 'PROFILE_REQUIRED', 'FACULTY_LINK_REQUIRED'].includes(code)) return error?.message || 'This account cannot read that faculty record.'; if (status === 503 || code === 'SQL_UNAVAILABLE' || status === 0) return 'Faculty data is temporarily unavailable. Your sign-in is still active.'; return error?.message || 'Faculty detail could not be loaded.'; }
  function dashboardAuthFailureMessage(error) { const status = Number(error?.status) || 0, code = String(error?.code || ''); if (status === 503 || code === 'SQL_UNAVAILABLE' || status === 0) return 'Faculty Dashboard is temporarily unavailable. Your sign-in is still active. Refresh this page to retry.'; if (status === 401 || code === 'UNAUTHENTICATED') return 'Your Dashboard session could not be verified. Your sign-in is still active. Refresh this page to retry.'; if (status === 403) return error?.message || 'This account does not have Faculty Dashboard access.'; return error?.message || 'Could not verify Faculty Dashboard access.'; }
  function setDashboardLoading(loading) { if (!loading) return; const status = $('sync-status'); if (status) status.textContent = 'Loading Dashboard…'; document.querySelectorAll('.kpi-value').forEach(node => { node.textContent = '…'; }); const list = $('result-list'); if (list) list.innerHTML = '<div class="empty">Loading faculty…</div>'; }
  function markDashboardUnavailable(message) { const status = $('sync-status'); if (status) status.textContent = message; document.querySelectorAll('.kpi-value').forEach(node => { node.textContent = '—'; }); const list = $('result-list'); if (list) list.innerHTML = `<div class="empty">${esc(message)}</div>`; const pane = $('profile-pane'); if (pane) pane.innerHTML = '<div class="empty">Faculty data is currently unavailable.</div>'; }
  function unique(key) { return [...new Set(faculty.map(row => text(row[key])).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
  function fillSelect(id, values, label) { const element = $(id); if (!element) return; const old = element.value; element.innerHTML = `<option value="">${esc(label)}</option>` + values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join(''); if (values.includes(old)) element.value = old; }
  function searchBlob(row) { return [row.displayName, row.preferredFullName, row.preferredFirstName, row.preferredLastName, row.ucid, row.email, row.rank, row.stream, row.teachingArea, row.professionalCategory, row.reportsToName].filter(present).join(' ').toLowerCase(); }
  function filteredLookup() { const query = norm($('lookup-search')?.value), rank = $('filter-rank')?.value || ''; return faculty.filter(row => row.active !== false && (!query || searchBlob(row).includes(query)) && (!rank || row.rank === rank)); }
  function installSelfModeStyles() { if ($('faculty-self-mode-style')) return; const style = document.createElement('style'); style.id = 'faculty-self-mode-style'; style.textContent = 'body.faculty-self-mode .tabs,body.faculty-self-mode .kpis,body.faculty-self-mode .summary-source-banner,body.faculty-self-mode #lookup-view > .toolbar,body.faculty-self-mode .result-pane,body.faculty-self-mode #sync-status{display:none!important}body.faculty-self-mode .lookup-grid{display:block;min-height:0}body.faculty-self-mode .profile-pane{width:100%;min-width:0;padding:18px}'; document.head.appendChild(style); }
  function lock(message) { $('auth-gate').classList.remove('hidden'); $('gate-status').textContent = message; }
  function unlock() { $('auth-gate').classList.add('hidden'); }
  function debounce(fn, wait = 160) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); }; }

  $('gate-back').onclick = $('back-btn').onclick = () => { location.href = 'index.html'; };
  $('signout-btn').onclick = async () => { if (auth) await auth.signOut(); location.href = 'index.html'; };
  init();
})();
