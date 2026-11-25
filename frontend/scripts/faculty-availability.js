(function (root) {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const kinds = { all: 'All activity types', teaching: 'Teaching', work: 'Work beyond teaching', ccc: 'CCC', rotation: 'Rotation',
    afc: 'AFC / Leave', pending: 'Pending absence', role: 'Roles / Appointments' };
  const statuses = { unavailable: 'Unavailable', busy: 'Busy', tentative: 'Tentative', unknown: 'Unknown',
    clear: 'No PAWS Conflict Found', ongoing: 'Ongoing Responsibility', informational: 'Informational' };
  const statusOrder = ['unavailable', 'busy', 'tentative', 'unknown', 'clear'];
  const sortNames = new Intl.Collator('en-CA', { sensitivity: 'base', numeric: true }).compare;
  const searchText = text => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const dateName = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
  const dayLabel = date => dateName.format(new Date(date + 'T12:00:00Z'));
  const badge = status => '<span class="availability-state" data-state="' + esc(status) + '">' + esc(statuses[status] || 'Unknown') + '</span>';
  const option = (id, label) => '<option value="' + esc(id) + '">' + esc(label) + '</option>';
  const table = (heads, rows, attributes = '') => '<table class="data-table" ' + attributes +
    '><thead><tr>' + heads.map(head => '<th scope="col">' + head + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table>';
  const scroll = (body, css = '') => '<div class="table-wrap availability-scroll ' + css + '">' + body + '</div>';
  const button = (attributes, label, css = 'btn') => '<button type="button" class="' + css + '" ' + attributes + '>' + label + '</button>';
  function clock(seconds) {
    const two = n => String(n).padStart(2, '0');
    return two(Math.floor(seconds / 3600)) + ':' + two(Math.floor(seconds / 60) % 60) + (seconds % 60 ? ':' + two(seconds % 60) : '');
  }
  const briefClock = value => String(value).replace(/^(\d\d:\d\d):00$/, '$1');
  const segmentTime = part => part.timing === 'all_day' ? 'All Day' : part.timing === 'unconfirmed' ? 'Time unconfirmed' :
    clock(part.actualStart) + '–' + clock(part.actualEnd);
  const check = (attribute, name, checked = false) => '<label class="availability-check"><input type="checkbox" ' +
    attribute + (checked ? ' checked' : '') + '><span>' + name + '</span></label>';
  const datesMarkup = '<label>Dates<select id="availability-mode" class="select"><option value="upcoming">Ongoing and Upcoming</option>' +
    '<option value="from">From Date Onward</option><option value="day">Single Day</option><option value="range">Date Range</option></select></label>' +
    '<label id="availability-start-wrap" hidden><span id="availability-start-label">Start date</span><input id="availability-start" type="date" class="input"></label>' +
    '<label id="availability-end-wrap" hidden>End date<input id="availability-end" type="date" class="input"></label>' +
    '<label>Daily time (Calgary)<select id="availability-time-mode" class="select"><option value="all">All Day</option><option value="custom">Custom Time Range</option></select></label>' +
    '<label id="availability-from-wrap" hidden>Start time<input id="availability-from-time" type="time" class="input" value="08:30"></label>' +
    '<label id="availability-to-wrap" hidden>End time<input id="availability-to-time" type="time" class="input" value="16:30"></label>';
  const markup = [
    '<div class="section-title">Faculty Availability</div>',
    '<p class="aux-note">PAWS does not include external calendar meetings. “No PAWS Conflict Found” applies to the PAWS sources checked for the selected dates and Calgary hours.</p>',
    '<form id="availability-search-form"><div class="availability-selection"><div class="availability-actions"><h3>Faculty</h3>',
    '<strong id="availability-selected-count">0 selected</strong>',
    button('id="availability-all" hidden', 'Select All Authorized Active Faculty', 'btn btn-small'),
    button('id="availability-clear"', 'Clear All', 'btn btn-small'),
    '<label id="availability-inactive-label" class="availability-check" hidden><input id="availability-inactive" type="checkbox"> Include inactive Faculty</label></div>',
    '<div id="availability-chips" class="availability-chips" aria-label="Selected Faculty"></div>',
    '<details class="availability-picker" id="availability-picker"><summary>Find and select Faculty</summary>',
    '<label for="availability-faculty">Search Faculty</label><input id="availability-faculty" class="input" type="search" autocomplete="off" placeholder="Search by name">',
    '<div id="availability-faculty-options" class="availability-options" role="group" aria-label="Faculty search results"></div></details>',
    '<div id="availability-roster-status" class="aux-note" role="status"></div>',
    button('id="availability-retry-roster" hidden', 'Retry Faculty list', 'btn btn-small'), '</div>',
    '<div class="availability-controls">', datesMarkup,
    '<button type="submit" class="btn btn-primary" id="availability-search" disabled>Search availability</button></div></form>',
    '<div id="availability-status" class="aux-note" role="status" aria-live="polite">Select Faculty and search.</div>',
    '<div id="availability-result" hidden><p id="availability-window" class="availability-window"></p>',
    '<p id="availability-coverage" class="availability-warning" hidden></p>',
    '<div class="availability-actions" role="group" aria-label="Availability view">',
    button('data-av-view="summary" aria-pressed="true"', 'Summary'),
    button('data-av-view="timeline" aria-pressed="false"', 'Timeline'),
    button('data-av-view="agenda" aria-pressed="false"', 'Agenda'), '</div>',
    '<section id="availability-summary-view" aria-label="Availability summary"><div id="availability-summary" class="availability-summary"></div>',
    '<div class="availability-toolbar"><label>Show<select id="availability-filter" class="select"><option value="all">All statuses</option><option value="clear">Show No Conflict Only</option><option value="conflicts">Show Conflicts Only</option><option value="unknown">Show Unknown Only</option></select></label>',
    '<label>Sort by<select id="availability-sort" class="select"><option value="name">Name</option><option value="status">Status</option></select></label>',
    button('data-av-export="csv"', 'Download CSV'), button('data-av-export="xlsx"', 'Download Excel'),
    '</div><div id="availability-summary-table"></div></section>',
    '<section id="availability-timeline-view" aria-label="Availability timeline" hidden><div id="availability-matrix"></div><div id="availability-day"></div></section>',
    '<section id="availability-agenda-view" aria-label="Availability agenda" hidden><div class="availability-toolbar">',
    '<label>Activity type<select id="availability-kind" class="select">' + Object.entries(kinds).map(([id, label]) => option(id, label)).join('') + '</select></label>',
    '<label>Group by<select id="availability-group" class="select"><option value="date">Date</option><option value="faculty">Faculty</option></select></label>',
    '<label>Faculty in Agenda<select id="availability-agenda-faculty" class="select">' + option('', 'All selected Faculty') + '</select></label>',
    '</div><div id="availability-events" class="availability-events"></div><div class="availability-actions" id="availability-pages"></div></section>',
    '<details class="availability-common"><summary>Find Common Time</summary><p id="availability-common-help" class="aux-note"></p>',
    '<form id="availability-common-form" hidden><div class="availability-toolbar">',
    '<label>Minimum duration (min)<input id="availability-duration" class="input" type="number" min="15" max="720" step="1" value="60" required list="availability-duration-options"></label>',
    '<datalist id="availability-duration-options"><option value="30"><option value="60"><option value="90"><option value="120"></datalist>',
    '<label>Start-time step<select id="availability-step" class="select"><option value="0">Activity boundaries</option><option value="15">15 min</option><option value="30">30 min</option></select></label>',
    '<label>Minimum Faculty<input id="availability-min-count" class="input" type="number" min="1" step="1" value="1" required></label>',
    check('id="availability-require-all"', 'Require all selected Faculty', true), '</div>',
    '<details><summary id="availability-required-title">Required Faculty</summary><div id="availability-required" class="availability-options" role="group" aria-label="Required Faculty"></div></details>',
    '<button id="availability-find" type="submit" class="btn btn-primary">Find common time</button></form>',
    '<div id="availability-common-status" class="aux-note" role="status"></div><div id="availability-common-results"></div></details>',
    '<div id="availability-action-status" class="aux-note" role="status"></div></div>',
    '<dialog id="availability-detail" class="availability-detail-dialog" aria-labelledby="availability-detail-title"><header><h3 id="availability-detail-title">Availability details</h3>',
    button('id="availability-close"', 'Close'), '</header><div id="availability-detail-body" class="availability-detail-body"></div></dialog>'
  ].join('');

  function renderEvent(event, person = '') {
    const dates = event.startDate + (event.endDate && event.endDate !== event.startDate ? ' – ' + event.endDate : '');
    const hours = event.startTime && event.endTime ? briefClock(event.startTime) + '–' + briefClock(event.endTime) : '';
    const meta = [dates, hours, kinds[event.kind], event.kind !== 'teaching' ? event.courseCode : '', person].filter(Boolean).join(' · ');
    const evidence = event.kind === 'work' ? event.segments.map(part =>
      '<li>' + esc(part.date + ' · ' + segmentTime(part)) + '</li>').join('') : '';
    return '<article class="availability-event"><div class="availability-event-top"><strong>' + esc(event.label) + '</strong>' +
      badge(event.availability) + '</div><div class="availability-meta">' + esc(meta) + '</div>' +
      (event.detail ? '<div>' + esc(event.detail) + '</div>' : '') +
      (event.availability === 'unknown' && !evidence ? '<p class="aux-note">Time unconfirmed</p>' : '') +
      (evidence ? '<details><summary>Daily time evidence</summary><ul>' + evidence + '</ul></details>' : '') + '</article>';
  }

  function downloadFile(file, format) {
    const mime = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (!file || !/^paws-availability-\d{4}-\d{2}-\d{2}\.(csv|xlsx)$/.test(file.fileName) ||
        !file.fileName.endsWith('.' + format) || file.contentType?.split(';')[0] !== mime ||
        typeof file.fileBase64 !== 'string' || !file.fileBase64.length || file.fileBase64.length > 4 * 1024 * 1024) {
      throw Error('The export could not be verified.');
    }
    const bytes = Uint8Array.from(root.atob(file.fileBase64), char => char.charCodeAt(0));
    const url = root.URL.createObjectURL(new Blob([bytes], { type: file.contentType }));
    const link = root.document.createElement('a');
    link.href = url;
    link.download = file.fileName;
    root.document.body.appendChild(link);
    link.click();
    link.remove();
    root.setTimeout(() => root.URL.revokeObjectURL(url), 1000);
  }

  function indexResults(result) {
    const people = new Map(result.faculty.map(person => [person.facultyId, person]));
    const byPerson = new Map(result.faculty.map(person => [person.facultyId, []]));
    const byDate = new Map(result.dates.map(date => [date, new Map()]));
    const byKey = new Map();
    result.items.forEach((event, index) => {
      byPerson.get(event.facultyId).push(index);
      byKey.set(event.facultyId + ':' + event.eventKey, event);
      for (const segment of event.segments) {
        const day = byDate.get(segment.date);
        if (!day) continue;
        if (!day.has(event.facultyId)) day.set(event.facultyId, []);
        day.get(event.facultyId).push({ ...segment, index });
      }
    });
    return { people, byPerson, byDate, byKey };
  }

  function createFacultyAvailability({ api, host, getSelfMode = () => false, download = downloadFile } = {}) {
    if (!api || !host) throw Error('Availability host and data API required.');
    host.innerHTML = markup;
    const $ = id => host.querySelector('#availability-' + id);
    const listen = (id, event, handler) => $(id).addEventListener(event, handler);
    const set = (id, value) => { $(id).textContent = value; };
    let roster = [], selected = new Set(), canSelectAll = false, allActive = false, rosterLoaded = false;
    let activeTotal = 0, rosterPaged = false, rosterTimer = null, pendingRead = null;
    let generation = 0, rosterGeneration = 0, commonGeneration = 0, detailGeneration = 0;
    let result = null, lookup = null, view = 'summary', agendaPage = 0, timelineDay = '', candidates = [];
    let lastDetailTrigger = null, loading = false, exporting = false;
    const pageSize = 40;

    function closeDetail() {
      detailGeneration++;
      if ($('detail').open) $('detail').close();
      set('detail-title', 'Availability details');
      $('detail-body').innerHTML = '';
    }
    function clearCommon() {
      commonGeneration++;
      closeDetail();
      candidates = [];
      $('common-results').innerHTML = '';
      set('common-status', '');
      $('find').disabled = false;
    }
    function clearResult(message) {
      generation++;
      clearCommon();
      result = null;
      lookup = null;
      loading = false;
      exporting = false;
      agendaPage = 0;
      timelineDay = '';
      $('result').hidden = true;
      for (const id of ['summary', 'summary-table', 'matrix', 'day', 'events', 'pages', 'required', 'action-status', 'window', 'coverage']) $(id).innerHTML = '';
      $('agenda-faculty').innerHTML = option('', 'All selected Faculty');
      $('search').disabled = !selected.size;
      set('status', message || (selected.size ? 'Filters changed. Search availability.' : 'Select Faculty and search.'));
    }
    function renderPicker() {
      const words = searchText($('faculty').value).split(/[\s,]+/).filter(Boolean);
      $('faculty-options').innerHTML = roster.map((person, index) => ({ person, index }))
        .filter(({ person }) => words.every(word => searchText(person.name).includes(word)))
        .map(({ person, index }) => check('data-av-pick="' + index + '"', esc(person.choice) + (person.active ? '' : ' <small>Inactive</small>'),
          selected.has(person.facultyId))).join('') || '<p class="aux-note">No matching Faculty.</p>';
    }
    function renderSelection() {
      $('chips').innerHTML = roster.map((person, index) => selected.has(person.facultyId) ?
        button('data-av-remove="' + index + '" aria-label="' + esc('Remove ' + person.choice) + '"',
          esc(person.choice) + ' <span aria-hidden="true">×</span>', 'btn btn-small availability-chip') : '').join('');
      set('selected-count', selected.size + ' selected');
      $('all').hidden = $('inactive-label').hidden = !canSelectAll;
      $('all').disabled = activeTotal < 1 || activeTotal > 500;
      $('all').title = activeTotal > 500 ? 'More than 500 active Faculty. Use name search to narrow the selection.' : '';
      $('clear').disabled = !selected.size;
      $('search').disabled = loading || !selected.size;
      renderPicker();
    }
    function withLabels(people) {
      const counts = new Map(), seen = new Map();
      for (const person of people) {
        const key = person.name.toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      return people.slice().sort((a, b) => sortNames(a.name, b.name) || a.facultyId.localeCompare(b.facultyId)).map(person => {
        const key = person.name.toLowerCase(), index = (seen.get(key) || 0) + 1;
        seen.set(key, index);
        const distinction = person.reference ? 'Ref ' + person.reference : 'Faculty ' + index;
        return { ...person, choice: counts.get(key) > 1 ? person.name + ' · ' + distinction : person.name };
      });
    }
    const sessionError = error => [401, 403].includes(error?.status) ||
      ['SESSION_REAUTH_REQUIRED', 'UNAUTHENTICATED', 'TOKEN_REFRESH_FAILED', 'ACCESS_CONTEXT_CHANGED'].includes(error?.code);
    function cancelRoster() {
      rosterGeneration++;
      if (rosterTimer !== null) { root.clearTimeout(rosterTimer); rosterTimer = null; }
    }
    async function loadRoster(force = false, query = '') {
      if (rosterLoaded && !force) return;
      cancelRoster();
      const marker = rosterGeneration;
      const includeInactive = !getSelfMode() && $('inactive').checked;
      set('roster-status', 'Loading authorized Faculty…');
      $('retry-roster').hidden = true;
      try {
        const data = await api.facultyAvailabilityRoster(includeInactive, query);
        if (marker !== rosterGeneration) return;
        canSelectAll = data.canSelectAll === true && !getSelfMode();
        activeTotal = data.activeTotal ?? data.faculty.filter(person => person.active).length;
        if (!query) rosterPaged = Boolean(data.nextCursor);
        const kept = roster.filter(person => selected.has(person.facultyId) && (includeInactive || person.active));
        if (!query && !rosterPaged) kept.length = 0;
        roster = withLabels([...new Map([...kept, ...data.faculty].map(person => [person.facultyId, person])).values()]);
        selected = new Set(roster.filter(person => (allActive && person.active) || selected.has(person.facultyId)).map(person => person.facultyId));
        if (!canSelectAll && roster.length === 1) selected.add(roster[0].facultyId);
        rosterLoaded = true;
        set('roster-status', data.nextCursor ? 'Showing the first 500 matches. Search by name to find other Faculty.' :
          data.faculty.length ? '' : 'No authorized Faculty match this search.');
        renderSelection();
      } catch (error) {
        if (marker !== rosterGeneration) return;
        rosterLoaded = false;
        if (sessionError(error)) clear();
        set('roster-status', sessionError(error) ? 'Sign in again to see authorized Faculty.' : 'Faculty list unavailable. Try again.');
        $('retry-roster').hidden = false;
      }
    }
    function togglePerson(index, checked) {
      const person = roster[index];
      if (!person) return;
      allActive = false;
      if (checked) selected.add(person.facultyId);
      else selected.delete(person.facultyId);
      clearResult();
      renderSelection();
    }
    function updateDateFields() {
      const mode = $('mode').value, custom = $('time-mode').value === 'custom';
      $('start-wrap').hidden = mode === 'upcoming';
      set('start-label', mode === 'day' ? 'Date' : 'Start date');
      $('end-wrap').hidden = mode !== 'range';
      $('from-wrap').hidden = $('to-wrap').hidden = !custom;
    }
    function makeQuery() {
      const mode = $('mode').value, startDate = $('start').value, endDate = $('end').value;
      const custom = $('time-mode').value === 'custom', startTime = $('from-time').value, endTime = $('to-time').value;
      if (mode !== 'upcoming' && !startDate) throw Error('Choose a date.');
      if (mode === 'range' && (!endDate || endDate < startDate || Date.parse(endDate) - Date.parse(startDate) > 30 * 86400000))
        throw Error('Choose a date range of up to 31 days.');
      if (custom && (!startTime || !endTime || startTime >= endTime)) throw Error('Choose an end time after the start time.');
      return { selection: allActive ? 'allActive' : 'selected', facultyIds: allActive ? [] : [...selected],
        includeInactive: !allActive && canSelectAll && $('inactive').checked, mode, startDate: mode === 'upcoming' ? null : startDate,
        endDate: mode === 'range' ? endDate : null, startTime: custom ? startTime : null, endTime: custom ? endTime : null };
    }
    function failed(error, output) {
      if (sessionError(error)) {
        clear();
        set('status', 'Your PAWS access changed or the session expired. Sign in again.');
      } else if (error?.code === 'AVAILABILITY_REFRESH_REQUIRED') {
        clearResult('This result expired. Search availability again.');
      } else output.textContent = (error?.status && error.status < 500 && error.message) || 'Availability could not be verified. Try again.';
    }
    function verifyPage(page, first, offset) {
      if (!page?.snapshot || page.snapshot !== first.snapshot || page.offset !== offset || page.total !== first.total ||
          !Array.isArray(page.items) || !Number.isInteger(page.total) || page.total < 0 || page.total > 15000 ||
          page.items.length > 800 || offset + page.items.length > page.total ||
          (page.nextCursor === null ? offset + page.items.length !== page.total :
            page.nextCursor !== String(offset + page.items.length) || !page.items.length || offset + page.items.length >= page.total)) {
        throw Error('Incomplete availability page');
      }
    }
    async function search(event) {
      event.preventDefault();
      if (loading || !selected.size) return;
      let query;
      try { query = makeQuery(); } catch (error) { set('status', error.message); return; }
      clearResult('Checking PAWS commitments…');
      loading = $('search').disabled = true;
      const marker = generation;
      let first, loaded = [];
      try {
        // Finish the prior bulk read before submitting the latest filters.
        if (pendingRead) {
          set('status', 'Finishing the previous read…');
          await pendingRead.catch(() => {});
          if (marker !== generation) return;
        }
        set('status', 'Checking PAWS commitments…');
        const request = api.facultyAvailabilityQuery(query);
        pendingRead = request;
        try { first = await request; } finally { if (pendingRead === request) pendingRead = null; }
        if (marker !== generation) return;
        verifyPage(first, first, 0);
        if (!Array.isArray(first.faculty) || !Array.isArray(first.summaries) || !Array.isArray(first.dates) || !first.window ||
            typeof first.complete !== 'boolean' || first.faculty.length !== first.summaries.length) throw Error('Invalid availability response');
        loaded = first.items.slice();
        let cursor = first.nextCursor;
        while (cursor !== null) {
          set('status', 'Loading ' + loaded.length + ' of ' + first.total + ' commitments…');
          const next = await api.facultyAvailabilityPage(first.snapshot, cursor);
          if (marker !== generation) return;
          verifyPage(next, first, loaded.length);
          loaded.push(...next.items);
          cursor = next.nextCursor;
        }
        const keys = new Set(loaded.map(row => row.facultyId + ':' + row.eventKey));
        if (keys.size !== loaded.length) throw Error('Duplicate availability page');
        showResult(first, loaded, first.complete);
      } catch (error) {
        if (marker !== generation) return;
        if (!sessionError(error) && error?.code !== 'AVAILABILITY_REFRESH_REQUIRED' && first && loaded.length) {
          showResult(first, loaded, false);
        } else failed(error, $('status'));
      } finally {
        if (marker === generation) { loading = false; $('search').disabled = !selected.size; }
      }
    }
    function showResult(first, items, complete) {
      const labels = new Map(withLabels(first.faculty).map(person => [person.facultyId, person.choice]));
      const previous = new Map(roster.map(person => [person.facultyId, person]));
      result = { ...first, items, complete, faculty: first.faculty.map(person => {
        const known = previous.get(person.facultyId), label = labels.get(person.facultyId);
        const choice = label === person.name && known?.name === person.name ? known.choice : label;
        return { ...person, choice };
      }) };
      lookup = indexResults(result);
      if (allActive && complete) {
        const active = new Set(result.faculty.map(person => person.facultyId));
        const inactive = $('inactive').checked ? roster.filter(person => !active.has(person.facultyId)).map(person => ({ ...person, active: false })) : [];
        roster = withLabels([...result.faculty, ...inactive]);
        selected = active;
        activeTotal = active.size;
        renderSelection();
      }
      const { startDate, endDate, startTime, endTime } = result.window;
      const dates = endDate ? startDate + (startDate === endDate ? '' : ' – ' + endDate) : 'From ' + startDate;
      set('window', dates + ' · ' + (startTime ? startTime + '–' + endTime : 'All Day') + ' Calgary time · ' + result.faculty.length + ' Faculty');
      const unresolved = result.unresolvedTeaching;
      $('coverage').hidden = !(unresolved?.undated || unresolved?.days.length);
      set('coverage', unresolved?.undated ? 'An unresolved teaching assignment has no confirmed date. The query cannot certify clear time.' :
        'Unresolved teaching assignments affect ' + (unresolved?.days.length ?? 0) + ' day(s). The affected intervals are treated as unknown.');
      set('status', complete ? items.length + ' PAWS commitment' + (items.length === 1 ? '' : 's') + ' loaded.' :
        'Partial results. Some records could not be checked. Narrow the dates or Faculty selection and search again.');
      $('result').hidden = false;
      timelineDay = result.dates[0] || '';
      $('agenda-faculty').innerHTML = option('', 'All selected Faculty') + result.faculty.map((person, i) => option(i, person.choice)).join('');
      $('required').innerHTML = result.faculty.map((person, i) => check('data-av-required="' + i + '"', esc(person.choice))).join('');
      set('required-title', 'Required Faculty');
      $('min-count').max = String(result.faculty.length);
      $('min-count').value = '1';
      $('min-count').disabled = $('require-all').checked;
      $('common-form').hidden = !complete || !result.dates.length || !result.faculty.length;
      set('common-help', $('common-form').hidden ? 'Search a complete Single Day or Date Range to find a shared time.' :
        'Uses the dates and Calgary hours above. Pending or unknown time cannot count toward a match.');
      renderView();
    }
    const effectiveStatus = status => !result.complete && status === 'clear' ? 'unknown' : status;
    function coverage(person) {
      const counts = person.undatedSessions || person.undatedRoles ?
        person.undatedSessions + ' session(s) and ' + person.undatedRoles + ' appointment(s) lack usable dates.' : '';
      return [counts, !result.complete ? 'Some availability records could not be checked.' : ''].filter(Boolean).join(' ');
    }
    function renderSummary() {
      const counts = Object.fromEntries(statusOrder.map(status => [status, 0]));
      const rows = result.summaries.map((row, index) => ({ ...row, index, status: effectiveStatus(row.status), person: lookup.people.get(row.facultyId) }));
      for (const row of rows) counts[row.status]++;
      $('summary').innerHTML = statusOrder.map(status => '<span class="availability-count">' + badge(status) + '<strong>' + counts[status] + '</strong></span>').join('');
      const filter = $('filter').value;
      const cleaned = rows.filter(row => filter === 'all' || (filter === 'conflicts' ? ['busy', 'unavailable', 'tentative'].includes(row.status) : row.status === filter)).sort((a, b) =>
        ($('sort').value === 'status' ? statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status) : 0) ||
        sortNames(a.person.name, b.person.name) || a.facultyId.localeCompare(b.facultyId));
      const body = cleaned.map(row => '<tr><td><details data-av-person="' + row.index + '"><summary>' + esc(row.person.choice) +
        (row.person.active ? '' : ' <small>Inactive</small>') + '</summary><div></div></details></td><td>' + badge(row.status) + '</td><td>' +
        esc(row.conflict || (coverage(row.person) ? 'Coverage needs review' : row.status === 'unknown' ? 'Time unconfirmed' : '—')) +
        (row.conflictCount > 1 ? ' <small>· ' + row.conflictCount + ' records</small>' : '') + '</td><td>' + esc(row.time) + '</td></tr>').join('');
      $('summary-table').innerHTML = scroll(table(['Faculty', 'Status', 'Conflict', 'Time'],
        body || '<tr><td colspan="4" class="empty">No Faculty match this status filter.</td></tr>'));
      host.querySelectorAll('[data-av-export]').forEach(control => { control.disabled = !result.complete || exporting; });
    }
    function expandPerson(node) {
      const row = result?.summaries[Number(node.dataset.avPerson)];
      if (!node.open || !row) return;
      const person = lookup.people.get(row.facultyId), refs = lookup.byPerson.get(row.facultyId);
      node.querySelector('div').innerHTML = (coverage(person) ? '<p class="availability-warning">' + esc(coverage(person)) + '</p>' : '') +
        refs.slice(0, 8).map(index => renderEvent(result.items[index])).join('') +
        (refs.length > 8 ? button('data-av-agenda-person="' + result.faculty.indexOf(person) + '"', 'See all ' + refs.length + ' in Agenda') : '') +
        (!refs.length ? '<p class="aux-note">No matching records.</p>' : '');
    }
    function renderTimeline() {
      $('matrix').innerHTML = '';
      if (!result.dates.length) {
        $('day').innerHTML = '<p class="empty">Choose Single Day or Date Range to compare a timeline.</p>';
        return;
      }
      if (result.dates.length > 1) {
        const headers = ['Faculty', ...result.dates.map(date => button('data-av-date="' + date + '"', esc(dayLabel(date)), 'btn btn-small'))];
        const rows = result.summaries.map(row => '<tr><th scope="row">' + esc(lookup.people.get(row.facultyId).choice) + '</th>' +
          row.days.map((status, i) => '<td>' + button('data-av-date="' + result.dates[i] + '"', badge(effectiveStatus(status)), 'availability-cell') + '</td>').join('') + '</tr>').join('');
        $('matrix').innerHTML = scroll(table(headers, rows), 'availability-sticky');
      }
      renderDay();
    }
    function renderDay() {
      const date = timelineDay, i = result.dates.indexOf(date), { start, end } = result.window;
      const placements = lookup.byDate.get(date);
      const percent = seconds => (seconds / (end - start) * 100).toFixed(4) + '%';
      const ticks = [start];
      for (let tick = Math.ceil((start + 1) / 3600) * 3600; tick < end; tick += 3600) {
        if (tick - start >= 1800 && end - tick >= 1800) ticks.push(tick);
      }
      ticks.push(end);
      const axis = ticks.map(tick => '<span style="--position:' + percent(tick - start) + '">' + clock(tick) + '</span>').join('');
      const transition = (result.clockChanges || []).find(change => change.date === date);
      const unresolved = result.unresolvedTeaching?.days.find(day => day.date === date);
      const clockBand = transition ? '<span aria-hidden="true" class="availability-clock-band" style="--position:' +
        percent(transition.start - start) + ';--span:' + percent(transition.end - transition.start) + '"></span>' : '';
      const tracks = result.summaries.map(row => {
        const person = lookup.people.get(row.facultyId), lanes = [], markers = [];
        const spans = (placements.get(person.facultyId) || []).slice().sort((a, b) => a.start - b.start || a.end - b.end);
        const blocks = spans.map(part => {
          const event = result.items[part.index], time = segmentTime(part), action = 'data-av-event="' + part.index + '"';
          if (part.timing === 'unconfirmed') {
            markers.push(button(action, esc(event.type + ' · ' + time), 'btn btn-small'));
            return '';
          }
          let lane = lanes.findIndex(value => value <= part.start);
          if (lane === -1) lane = lanes.length;
          lanes[lane] = part.end;
          const title = esc(event.label + ' · ' + time + ' · ' + statuses[part.status]);
          return button(action + ' data-state="' + part.status + '" title="' + title + '" aria-label="' + title +
            '" style="--position:' + percent(part.start - start) + ';--span:' + percent(part.end - part.start) + ';--lane:' + lane + '"',
            esc(event.type + ' · ' + time), 'availability-block');
        }).join('');
        return '<tr><th scope="row">' + esc(person.choice) + '<br>' + badge(effectiveStatus(row.days[i])) + '</th><td><div class="availability-track" style="--lanes:' +
          Math.max(1, lanes.length) + '">' + clockBand + blocks + '</div>' + (markers.length ? '<div class="availability-actions availability-unconfirmed">' +
          markers.join('') + '</div>' : '') + '</td></tr>';
      }).join('');
      $('day').innerHTML = '<h3 tabindex="-1" id="availability-day-heading">' + esc(dayLabel(date) + ' · ' + date) + '</h3>' +
        (transition ? '<p class="availability-warning">Calgary clock change · ' + clock(transition.start) + '–' + clock(transition.end) + ' · Unknown</p>' : '') +
        (unresolved ? '<p class="availability-warning">Unresolved teaching assignment time · ' +
          unresolved.intervals.map(part => clock(part.start) + '–' + clock(part.end)).join(', ') + ' · Unknown</p>' : '') +
        '<div class="availability-scroll availability-sticky availability-timeline-scroll" tabindex="0" aria-label="Daily Faculty timeline">' +
        table(['Faculty', '<div class="availability-axis">' + axis + '</div><span class="availability-axis-caption">Calgary time</span>'],
          tracks, 'data-availability-timeline') + '</div>';
    }
    function renderAgenda() {
      const kind = $('kind').value, group = $('group').value, index = $('agenda-faculty').value;
      const facultyId = index === '' ? null : result.faculty[Number(index)]?.facultyId;
      const items = result.items.filter(event => {
        if (facultyId && event.facultyId !== facultyId) return false;
        const type = event.type === 'CCC' ? 'ccc' : event.type === 'Rotation' ? 'rotation' : event.kind;
        return kind === 'all' || kind === event.kind || type === kind;
      });
      if (group === 'faculty') items.sort((a, b) =>
        sortNames(lookup.people.get(a.facultyId).name, lookup.people.get(b.facultyId).name) || a.facultyId.localeCompare(b.facultyId));
      agendaPage = Math.min(agendaPage, Math.max(0, Math.ceil(items.length / pageSize) - 1));
      const start = agendaPage * pageSize;
      let last = '';
      $('events').innerHTML = items.slice(start, start + pageSize).map(event => {
        const person = lookup.people.get(event.facultyId);
        const date = event.agendaDate || event.segments[0]?.date || event.startDate;
        const key = group === 'faculty' ? event.facultyId : date;
        const heading = key === last ? '' : '<h3 class="availability-agenda-group">' + esc(group === 'faculty' ? person.choice : date) + '</h3>';
        last = key;
        return heading + renderEvent(event, group === 'faculty' ? '' : person.choice);
      }).join('') || '<p class="empty">' + (result.complete && result.summaries.every(row => row.status !== 'unknown') ?
        'No PAWS commitments found for this activity filter.' : 'No matching records in the loaded results.') + '</p>';
      $('pages').innerHTML = items.length ? button('data-av-page="prev"' + (agendaPage ? '' : ' disabled'), 'Previous') +
        '<span>' + (start + 1) + '–' + Math.min(start + pageSize, items.length) + ' of ' + items.length + '</span>' +
        button('data-av-page="next"' + (start + pageSize < items.length ? '' : ' disabled'), 'Next') : '';
    }
    function renderView() {
      for (const key of ['summary', 'timeline', 'agenda']) $(key + '-view').hidden = view !== key;
      host.querySelectorAll('[data-av-view]').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.avView === view)));
      if (view === 'summary') renderSummary();
      else if (view === 'timeline') renderTimeline();
      else renderAgenda();
    }
    async function exportSummary(format) {
      if (!result?.complete || exporting) return;
      const marker = generation;
      exporting = true;
      renderSummary();
      set('action-status', 'Preparing complete filtered summary…');
      try {
        const file = await api.facultyAvailabilityExport(result.snapshot, format, $('filter').value, $('sort').value);
        if (marker !== generation) return;
        download(file, format);
        set('action-status', 'Downloaded ' + file.rowCount + ' Faculty record(s).');
      } catch (error) {
        if (marker === generation) failed(error, $('action-status'));
      } finally {
        if (marker === generation) { exporting = false; renderSummary(); }
      }
    }
    function requiredIds() {
      return Array.from($('required').querySelectorAll('[data-av-required]:checked'))
        .map(box => result.faculty[Number(box.dataset.avRequired)].facultyId);
    }
    async function findCommon(event) {
      event.preventDefault();
      if ($('common-form').hidden || $('find').disabled) return;
      clearCommon();
      const marker = commonGeneration, requireAll = $('require-all').checked;
      $('find').disabled = true;
      set('common-status', 'Finding shared time…');
      try {
        const answer = await api.facultyAvailabilityCommon({ snapshot: result.snapshot, duration: Number($('duration').value),
          minCount: requireAll ? 1 : Number($('min-count').value), requireAll, step: Number($('step').value), requiredIds: requiredIds() });
        if (marker !== commonGeneration) return;
        candidates = answer.matches;
        const rows = candidates.map((slot, i) => '<tr><td>' + esc(slot.date) + '</td><td>' + clock(slot.start) + '</td><td>' + clock(slot.end) +
          '</td><td>' + Math.floor((slot.end - slot.start) / 60) + ' min</td><td>' + slot.count + ' / ' + result.faculty.length + '</td><td>' +
          button('data-av-slot="' + i + '"', 'View', 'btn btn-small') + '</td></tr>').join('');
        $('common-results').innerHTML = rows ? scroll(table(['Date', 'Start', 'End', 'Duration', 'No PAWS Conflict Found', 'Faculty'], rows)) : '';
        set('common-status', rows ? 'Showing ' + candidates.length + ' of ' + answer.total + ' matches.' :
          'No verified PAWS match met these requirements. Pending and unknown time were excluded.');
      } catch (error) {
        if (marker === commonGeneration) failed(error, $('common-status'));
      } finally { if (marker === commonGeneration) $('find').disabled = false; }
    }
    function showDetail(title, body, trigger) {
      lastDetailTrigger = trigger;
      set('detail-title', title);
      $('detail-body').innerHTML = body;
      if (!$('detail').open) $('detail').showModal();
    }
    async function openSlot(i, trigger) {
      const slot = candidates[i];
      if (!slot) return;
      const marker = ++detailGeneration;
      showDetail(slot.date + ' · ' + clock(slot.start) + '–' + clock(slot.end), '<p>Loading Faculty and conflicts…</p>', trigger);
      try {
        const answer = await api.facultyAvailabilityCommonDetail(result.snapshot, slot.date, slot.start, slot.end);
        if (marker !== detailGeneration) return;
        const rows = answer.faculty.map(row => {
          const person = lookup.people.get(row.facultyId);
          const conflicts = row.events.map(part => {
            const event = lookup.byKey.get(row.facultyId + ':' + part.key);
            return (event?.type || 'Activity') + ' · ' + segmentTime({ ...part, actualStart: part.start, actualEnd: part.end });
          });
          const descriptions = [...conflicts, coverage(person), row.clockUnconfirmed ? 'Calgary clock change' : '',
            row.unresolvedTeaching ? 'Unresolved teaching assignment' : ''].filter(Boolean);
          return '<tr><th scope="row">' + esc(person.choice) + '</th><td>' + badge(row.status) + '</td><td>' +
            (descriptions.length ? descriptions.map(esc).join('<br>') : '—') + '</td></tr>';
        }).join('');
        $('detail-body').innerHTML = scroll(table(['Faculty', 'Status', 'Conflicts and coverage'], rows));
      } catch (error) {
        if (marker === detailGeneration) failed(error, $('detail-body'));
      }
    }
    listen('search-form', 'submit', search);
    listen('faculty', 'input', () => {
      renderPicker();
      if (!rosterPaged) return;
      cancelRoster();
      rosterTimer = root.setTimeout(() => {
        rosterTimer = null;
        loadRoster(true, $('faculty').value.trim().slice(0, 128));
      }, 250);
    });
    listen('faculty-options', 'change', event => {
      const index = event.target.dataset.avPick;
      if (index === undefined) return;
      togglePerson(Number(index), event.target.checked);
      $('faculty-options').querySelector('[data-av-pick="' + Number(index) + '"]')?.focus();
    });
    listen('chips', 'click', event => {
      const control = event.target.closest('[data-av-remove]');
      if (!control) return;
      togglePerson(Number(control.dataset.avRemove), false);
      if ($('clear').disabled) $('picker').querySelector('summary')?.focus();
      else $('clear').focus();
    });
    listen('all', 'click', async () => {
      if (!canSelectAll || activeTotal < 1 || activeTotal > 500) return;
      if (roster.filter(person => person.active).length !== activeTotal) {
        const identity = rosterGeneration, selectionVersion = generation;
        try {
          const data = await api.facultyAvailabilityRoster(false);
          if (identity !== rosterGeneration || selectionVersion !== generation) return;
          if (data.nextCursor) { set('roster-status', 'More than 500 active Faculty. Search by name to narrow the selection.'); return; }
          activeTotal = data.activeTotal;
          roster = withLabels([...roster.filter(person => !person.active), ...data.faculty]);
        } catch (error) {
          if (identity === rosterGeneration) failed(error, $('roster-status'));
          return;
        }
      }
      allActive = true;
      selected = new Set(roster.filter(person => person.active).map(person => person.facultyId));
      clearResult();
      renderSelection();
    });
    listen('clear', 'click', () => { allActive = false; selected.clear(); clearResult(); renderSelection(); });
    listen('inactive', 'change', () => {
      if (!$('inactive').checked) selected = new Set(roster.filter(person => person.active && selected.has(person.facultyId)).map(person => person.facultyId));
      clearResult();
      renderSelection();
      return loadRoster(true);
    });
    listen('retry-roster', 'click', () => loadRoster(true));
    for (const id of ['mode', 'start', 'end', 'time-mode', 'from-time', 'to-time']) {
      listen(id, 'input', () => { updateDateFields(); clearResult(); });
      listen(id, 'change', () => { updateDateFields(); clearResult(); });
    }
    for (const id of ['filter', 'sort']) listen(id, 'change', () => { if (result) renderSummary(); });
    for (const id of ['kind', 'group', 'agenda-faculty']) listen(id, 'change', () => { agendaPage = 0; if (result) renderAgenda(); });
    listen('common-form', 'submit', findCommon);
    listen('common-form', 'change', () => {
      clearCommon();
      $('min-count').disabled = $('require-all').checked;
      const count = requiredIds().length;
      set('required-title', 'Required Faculty' + (count ? ' · ' + count : ''));
    });
    listen('close', 'click', closeDetail);
    listen('detail', 'close', () => { detailGeneration++; lastDetailTrigger?.focus(); lastDetailTrigger = null; });
    host.addEventListener('toggle', event => { if (event.target.dataset?.avPerson !== undefined) expandPerson(event.target); }, true);
    host.addEventListener('click', event => {
      if (!result) return;
      const data = event.target.closest('button')?.dataset;
      if (!data) return;
      if (data.avView) { view = data.avView; renderView(); }
      if (data.avExport) exportSummary(data.avExport);
      if (data.avDate) { timelineDay = data.avDate; renderDay(); $('day-heading')?.focus(); }
      if (data.avPage) {
        agendaPage += data.avPage === 'next' ? 1 : -1;
        renderAgenda();
        $('pages').querySelector('button:not([disabled])')?.focus();
      }
      if (data.avAgendaPerson !== undefined) {
        view = 'agenda';
        $('agenda-faculty').value = data.avAgendaPerson;
        $('kind').value = 'all';
        agendaPage = 0;
        renderView();
        $('agenda-faculty').focus();
      }
      if (data.avEvent !== undefined) {
        const item = result.items[Number(data.avEvent)];
        showDetail(lookup.people.get(item.facultyId).choice, renderEvent(item), event.target.closest('button'));
      }
      if (data.avSlot !== undefined) openSlot(Number(data.avSlot), event.target.closest('button'));
    });
    function clear() {
      cancelRoster();
      roster = [];
      rosterLoaded = false;
      rosterPaged = false;
      activeTotal = 0;
      selected.clear();
      allActive = false;
      canSelectAll = false;
      view = 'summary';
      $('inactive').checked = false;
      $('faculty').value = '';
      set('roster-status', '');
      $('retry-roster').hidden = true;
      clearResult();
      renderSelection();
    }
    return Object.freeze({ open: () => loadRoster(), clear });
  }

  root.PAWS_FACULTY_AVAILABILITY = { createFacultyAvailability };
  if (root.document && root.UCVM_PAWS_DATA) {
    const host = root.document.getElementById('availability-view');
    const tab = root.document.querySelector('[data-tab="availability"]');
    if (host && tab) {
      const view = createFacultyAvailability({ api: root.UCVM_PAWS_DATA, host,
        getSelfMode: () => root.document.body.classList.contains('faculty-self-mode') });
      tab.addEventListener('click', () => view.open());
      root.document.getElementById('signout-btn')?.addEventListener('click', () => view.clear());
      root.firebase?.auth?.().onAuthStateChanged(() => view.clear());
      root.addEventListener('paws-access-invalidated', () => view.clear());
      let identity = '';
      root.addEventListener('paws-profile', event => {
        const p = event.detail?.profile;
        const key = JSON.stringify([p?.uid, p?.facultyId, p?.role, p?.baseRole, p?.active, p?.mustChangePassword, event.detail?.support]);
        if (key === identity) return;
        identity = key;
        view.clear();
        if (!host.classList.contains('hidden') && p?.active) view.open();
      });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
