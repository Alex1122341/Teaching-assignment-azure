'use strict';

const { randomUUID } = require('node:crypto');
const { format } = require('../domain/person-name');
const { spreadsheetBytes, safeText } = require('../reports/report-export');
const { UUID, validDate, daysBetween, clockSeconds, formatClock, statusLabels, buildSchedule, commonTimes,
  describeTime, filterSummaries } = require('./faculty-availability-window');

const MAX_FACULTY = 500;
const MAX_EVENTS = 15000;
const PAGE_SIZE = 800;
const MAX_SNAPSHOT_BYTES = 12 * 1024 * 1024;
const SNAPSHOT_TTL = 10 * 60 * 1000;
const SUMMARY_FILTERS = ['all', 'clear', 'conflicts', 'unknown'];
const SUMMARY_SORT = ['name', 'status'];
const success = body => ({ status: 200, body });
const failure = (status, code, message) => ({ status, body: { error: { code, message } } });
const invalid = () => failure(400, 'INVALID_QUERY', 'Check your Faculty selection, dates and time range.');
const denied = () => failure(403, 'ROLE_DENIED', 'This Faculty Availability query is outside your authorized scope.');
const expired = () => failure(409, 'AVAILABILITY_REFRESH_REQUIRED', 'This result has expired. Search availability again.');
const unavailable = () => failure(503, 'SERVICE_UNAVAILABLE', 'Availability cannot be verified. Try again.');
const tooMany = () => failure(413, 'AVAILABILITY_LIMIT', 'This query exceeds the available result limit. Narrow the dates or Faculty selection.');
const unsigned = value => typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) ? Number(value) : NaN;
const validId = value => typeof value === 'string' && UUID.test(value);
const closed = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).every(key => keys.includes(key));
const idList = list => Array.isArray(list) && list.length <= MAX_FACULTY && list.every(validId) ? list.map(id => id.toLowerCase()) : null;

function normalizeQuery(input) {
  if (!closed(input, ['selection', 'facultyIds', 'includeInactive', 'mode', 'startDate', 'endDate', 'startTime', 'endTime'])) return null;
  const { selection, includeInactive = false, mode = 'upcoming', startDate = null, endDate = null, startTime = null, endTime = null } = input;
  const facultyIds = idList(input.facultyIds);
  if (!facultyIds || new Set(facultyIds).size !== facultyIds.length || typeof includeInactive !== 'boolean' ||
      !['selected', 'allActive'].includes(selection) || (selection === 'selected' && !facultyIds.length) ||
      (selection === 'allActive' && (facultyIds.length || includeInactive)) || !['upcoming', 'from', 'day', 'range'].includes(mode) ||
      (mode === 'upcoming' ? startDate !== null : !validDate(startDate)) ||
      (mode === 'range' ? !validDate(endDate) || daysBetween(startDate, endDate) < 0 || daysBetween(startDate, endDate) > 30 : endDate !== null)) return null;
  if (['day', 'range'].includes(mode) && (startDate < '0001-01-02' || (endDate ?? startDate) > '9999-12-30')) return null;
  if ((startTime === null) !== (endTime === null) || (startTime !== null && (
    typeof startTime !== 'string' || typeof endTime !== 'string' || startTime.length !== 5 || endTime.length !== 5 ||
    clockSeconds(startTime) === null || clockSeconds(endTime) === null || startTime >= endTime))) return null;
  return { selection, facultyIds, includeInactive, mode, startDate, endDate, startTime, endTime };
}

function projectFaculty(value, auth, { includeInactive, ids, coverage = false } = {}) {
  if (!Array.isArray(value) || value.length > MAX_FACULTY) throw Error('Invalid availability roster');
  const seen = new Set();
  return value.map(record => {
    const facultyId = validId(record?.facultyId) ? record.facultyId.toLowerCase() : null;
    if (!facultyId || seen.has(facultyId) || typeof record.active !== 'boolean' || (!includeInactive && !record.active) ||
        (!auth.admin && facultyId !== auth.facultyId) || (ids && !ids.has(facultyId))) throw Error('Invalid availability faculty scope');
    seen.add(facultyId);
    const row = { facultyId, name: format(record, 'Name unavailable'), active: record.active };
    if (!coverage) return row;
    const { undatedSessions, undatedRoles } = record;
    if (![undatedSessions, undatedRoles].every(n => Number.isInteger(n) && n >= 0)) throw Error('Incomplete availability source coverage');
    return { ...row, undatedSessions, undatedRoles };
  });
}

function sqlError(error) {
  const number = Number(error?.number ?? error?.originalError?.info?.number);
  if (number === 55603) return denied();
  if (number === 55604) return failure(404, 'FACULTY_NOT_FOUND', 'A selected Faculty is inactive or no longer exists. Refresh Faculty.');
  if (number === 55601) return invalid();
  if (number === 57205) return tooMany();
  return unavailable();
}

function pageOf(snapshot, item, offset) {
  const items = item.schedule.events.slice(offset, offset + PAGE_SIZE);
  return { snapshot, offset, items, total: item.schedule.events.length,
    nextCursor: offset + PAGE_SIZE < item.schedule.events.length ? String(offset + PAGE_SIZE) : null };
}

function exportTable(schedule, filter, sort) {
  const dateWindow = schedule.window.endDate ? schedule.window.startDate + ' to ' + schedule.window.endDate : 'From ' + schedule.window.startDate;
  const hours = schedule.window.startTime ? `${schedule.window.startTime}–${schedule.window.endTime}` : 'All Day';
  const headers = ['Faculty', 'Status', 'Conflict', 'Time', 'Overlapping records', 'Undated sessions', 'Undated appointments',
    'Date window', 'Daily Calgary hours', 'Scope'];
  const values = filterSummaries(schedule, filter, sort).map(row => [
    row.name, statusLabels[row.status], row.conflict ?? '—', row.time, row.conflictCount, row.undatedSessions, row.undatedRoles,
    dateWindow, hours, 'PAWS only. External calendar meetings are excluded.'
  ].map(value => typeof value === 'number' ? value : safeText(value)));
  return { label: 'Availability Summary', headers, values,
    columns: headers.map((_, i) => ({ type: i >= 4 && i <= 6 ? 'number' : 'text' })) };
}

function createAvailabilityCoordination({ authorize, repository, clock = Date.now, randomId = randomUUID }) {
  const snapshots = new Map(), querying = new Set();
  let exporting = false;
  const binding = auth => JSON.stringify([auth.uid, auth.role, auth.facultyId]);
  const prune = () => {
    for (const [key, item] of snapshots) if (item.expires <= clock()) snapshots.delete(key);
  };
  function retain(auth, schedule) {
    const bytes = Buffer.byteLength(JSON.stringify({ faculty: schedule.faculty, events: schedule.events, summaries: schedule.summaries }));
    if (bytes > MAX_SNAPSHOT_BYTES) return null;
    prune();
    for (const [key, item] of snapshots) if (item.uid === auth.uid) snapshots.delete(key);
    while (snapshots.size >= 4) snapshots.delete(snapshots.keys().next().value);
    const snapshot = randomId();
    if (!validId(snapshot) || snapshots.has(snapshot)) throw Error('Invalid snapshot identifier');
    const item = { uid: auth.uid, binding: binding(auth), expires: clock() + SNAPSHOT_TTL, schedule };
    snapshots.set(snapshot, item);
    return { snapshot, item };
  }

  async function authorizedSnapshot(token, snapshot) {
    const auth = await authorize(token);
    if (auth.response) return auth;
    prune();
    const item = snapshots.get(snapshot);
    if (!item) return { response: expired() };
    if (item.binding !== binding(auth)) return { response: denied() };
    try {
      const ids = item.schedule.faculty.map(row => row.facultyId);
      const checked = await repository.bulk({ actorFirebaseUid: auth.uid,
        action: ids.length ? 'check' : 'roster', selection: 'selected', facultyIds: ids, includeInactive: auth.admin });
      if (ids.length && checked.authorized !== true) return { response: denied() };
      if (snapshots.get(snapshot) !== item || item.expires <= clock()) return { response: expired() };
      return item;
    } catch (error) { return { response: sqlError(error) }; }
  }

  return {
    async roster(token, input) {
      const auth = await authorize(token);
      if (auth.response) return auth.response;
      if (!closed(input, ['includeInactive']) || (input.includeInactive !== undefined && !['0', '1'].includes(input.includeInactive))) return invalid();
      const includeInactive = input.includeInactive === '1';
      if (includeInactive && !auth.admin) return denied();
      try {
        const rows = await repository.bulk({ action: 'roster', actorFirebaseUid: auth.uid, includeInactive });
        return success({ faculty: projectFaculty(rows.faculty, auth, { includeInactive }), canSelectAll: auth.admin });
      } catch (error) { return sqlError(error); }
    },

    async query(token, input) {
      const auth = await authorize(token);
      if (auth.response) return auth.response;
      const definition = normalizeQuery(input);
      if (!definition) return invalid();
      const { facultyIds, includeInactive, selection, mode, startDate, endDate } = definition;
      if (!auth.admin && (selection !== 'selected' || includeInactive || facultyIds.length !== 1 || facultyIds[0] !== auth.facultyId)) return denied();
      if (querying.has(auth.uid) || querying.size >= 3) return failure(429, 'AVAILABILITY_BUSY', 'Availability is still loading. Retry shortly.');
      querying.add(auth.uid);
      try {
        const loaded = await repository.bulk({ action: 'query', actorFirebaseUid: auth.uid, facultyIds, includeInactive, selection,
          mode: mode === 'day' ? 'range' : mode, startDate, endDate: mode === 'day' ? startDate : endDate });
        if (!validDate(loaded.today) || clockSeconds(loaded.localTime) === null || typeof loaded.complete !== 'boolean' || !Array.isArray(loaded.clockChanges) ||
            !Array.isArray(loaded.events) || loaded.events.length > MAX_EVENTS) throw Error('Invalid availability source');
        const ids = selection === 'selected' ? new Set(facultyIds) : null;
        const faculty = projectFaculty(loaded.faculty, auth, { includeInactive, ids, coverage: true });
        if (ids && faculty.length !== ids.size) throw Error('Incomplete faculty selection');
        const schedule = buildSchedule({ faculty, rows: loaded.events, window: definition,
          today: loaded.today, localTime: loaded.localTime, complete: loaded.complete, clockChanges: loaded.clockChanges });
        const current = await authorize(token);
        if (current.response) return current.response;
        if (binding(auth) !== binding(current)) return denied();
        const retained = retain(auth, schedule);
        if (!retained) return tooMany();
        const { snapshot, item } = retained;
        return success({ ...pageOf(snapshot, item, 0), faculty: schedule.faculty, summaries: schedule.summaries,
          dates: schedule.dates, window: schedule.window, complete: schedule.complete,
          expiresAt: new Date(item.expires).toISOString() });
      } catch (error) { return sqlError(error); }
      finally { querying.delete(auth.uid); }
    },

    async page(token, input) {
      if (!closed(input, ['snapshot', 'offset']) || !validId(input.snapshot)) return invalid();
      const offset = unsigned(input.offset);
      if (!Number.isSafeInteger(offset) || offset > MAX_EVENTS || offset % PAGE_SIZE !== 0) return invalid();
      const item = await authorizedSnapshot(token, input.snapshot);
      if (item.response) return item.response;
      if (offset && offset >= item.schedule.events.length) return invalid();
      return success(pageOf(input.snapshot, item, offset));
    },

    async common(token, input) {
      if (!closed(input, ['snapshot', 'duration', 'minCount', 'requiredIds', 'requireAll', 'step']) || !validId(input.snapshot)) return invalid();
      const item = await authorizedSnapshot(token, input.snapshot);
      if (item.response) return item.response;
      const { schedule } = item;
      if (!schedule.dates.length || !schedule.complete) return failure(409, 'AVAILABILITY_INCOMPLETE', 'Choose a complete Single Day or Date Range query first.');
      const { duration, minCount = 1, requireAll = false, step = 0 } = input;
      const requiredIds = idList(input.requiredIds);
      if (!Number.isInteger(duration) || duration < 15 || duration > 720 || !Number.isInteger(minCount) ||
          minCount < 1 || minCount > schedule.faculty.length || typeof requireAll !== 'boolean' || ![0, 15, 30].includes(step) ||
          !requiredIds || new Set(requiredIds).size !== requiredIds.length || requiredIds.some(id => !schedule.byFaculty.has(id))) return invalid();
      return success(commonTimes(schedule, { duration, minCount: requireAll ? schedule.faculty.length : minCount, requiredIds, step }));
    },

    async commonDetail(token, input) {
      if (!closed(input, ['snapshot', 'date', 'start', 'end']) || !validId(input.snapshot)) return invalid();
      const item = await authorizedSnapshot(token, input.snapshot);
      if (item.response) return item.response;
      const { schedule } = item;
      const start = unsigned(input.start), end = unsigned(input.end);
      if (!schedule.complete || !schedule.dates.includes(input.date) || !Number.isInteger(start) || !Number.isInteger(end) ||
          start < schedule.window.start || end > schedule.window.end || start >= end) return invalid();
      return success({ faculty: describeTime(schedule, input.date, start, end) });
    },

    async export(token, input) {
      if (!closed(input, ['snapshot', 'format', 'filter', 'sort']) || !validId(input.snapshot) || !['csv', 'xlsx'].includes(input.format) ||
          (input.filter !== undefined && !SUMMARY_FILTERS.includes(input.filter)) || (input.sort !== undefined && !SUMMARY_SORT.includes(input.sort))) return invalid();
      const item = await authorizedSnapshot(token, input.snapshot);
      if (item.response) return item.response;
      if (!item.schedule.complete) return failure(409, 'AVAILABILITY_INCOMPLETE', 'Narrow this query before exporting complete results.');
      if (exporting) return failure(429, 'AVAILABILITY_BUSY', 'An export is running. Retry shortly.');
      exporting = true;
      try {
        const table = exportTable(item.schedule, input.filter, input.sort);
        const { bytes, contentType } = await spreadsheetBytes([table], input.format);
        const current = await authorizedSnapshot(token, input.snapshot);
        if (current.response) return current.response;
        if (current !== item) return expired();
        return success({ fileName: 'paws-availability-' + item.schedule.window.startDate + '.' + input.format,
          contentType, fileBase64: bytes.toString('base64'), rowCount: table.values.length });
      } catch (_) { return unavailable(); }
      finally { exporting = false; }
    }
  };
}

module.exports = { createAvailabilityCoordination };
