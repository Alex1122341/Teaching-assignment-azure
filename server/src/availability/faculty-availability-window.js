'use strict';

const DAY = 86400;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const clockText = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const statusLabels = Object.freeze({
  unavailable: 'Unavailable', busy: 'Busy', tentative: 'Tentative', unknown: 'Unknown',
  clear: 'No PAWS Conflict Found', ongoing: 'Ongoing Responsibility', informational: 'Informational'
});
const priority = ['unavailable', 'busy', 'tentative', 'unknown', 'clear'];
const types = Object.freeze({
  ccc: 'CCC', rotation_participant: 'Rotation', clinical_day: 'Clinical day / PPVM',
  vetm581_rounds: 'VETM 581 rounds', vetm571_clinical_pharmacology: 'VETM 571 clinical pharmacology',
  vetm591_presentations: 'VETM 591 presentations', teaching_excellence: 'Teaching excellence', remote_work: 'Remote work'
});
const kinds = new Set(['teaching', 'work', 'afc', 'pending', 'role']);
const dateTime = date => Date.parse(date + 'T00:00:00Z');
const validDate = value => typeof value === 'string' && DATE.test(value) && value >= '0001-01-01' &&
  Number.isFinite(dateTime(value)) && new Date(dateTime(value)).toISOString().slice(0, 10) === value;
const daysBetween = (start, end) => (dateTime(end) - dateTime(start)) / (DAY * 1000);
const offsetDate = (start, days) => new Date(dateTime(start) + days * DAY * 1000).toISOString().slice(0, 10);
const clockSeconds = value => {
  if (!clockText.test(value ?? '')) return null;
  const [hour, minute, second = 0] = value.split(':').map(Number);
  return hour * 3600 + minute * 60 + second;
};
function formatClock(seconds) {
  const two = value => String(value).padStart(2, '0');
  const remainder = seconds % 60;
  return two(Math.floor(seconds / 3600)) + ':' + two(Math.floor(seconds / 60) % 60) + (remainder ? ':' + two(remainder) : '');
}
const statusOf = (statuses, uncertain = false) =>
  priority.find(status => statuses.includes(status) || (status === 'unknown' && uncertain)) || 'clear';
const overlaps = (start, end, otherStart, otherEnd) => start < otherEnd && otherStart < end;
const compareNames = new Intl.Collator('en-CA', { sensitivity: 'base', numeric: true }).compare;

function cleanEvent(row, facultyId) {
  if (!row || !kinds.has(row.kind) || typeof row.eventKey !== 'string' || !row.eventKey ||
      !validDate(row.startDate) || (row.endDate != null && (!validDate(row.endDate) || row.endDate < row.startDate)) ||
      (row.kind !== 'role' && row.endDate == null)) throw Error('Invalid availability event');
  const { kind, eventKey, startDate, endDate } = row;
  const projected = { facultyId, eventKey, kind, startDate, endDate: endDate ?? null, startTime: null, endTime: null };
  if (kind === 'afc' || kind === 'pending') {
    const pending = kind === 'pending';
    return { ...projected, type: pending ? 'Pending AFC' : 'AFC', label: pending ? 'Pending AFC request' : 'AFC / Leave',
      availability: pending ? 'tentative' : 'unavailable' };
  }
  if (kind === 'role') return { ...projected, type: 'Appointment', label: row.label || 'Role / appointment',
    detail: row.detail ?? null, availability: 'ongoing' };
  if (kind === 'work') {
    const type = Object.hasOwn(types, row.type) ? types[row.type] : 'Work beyond teaching';
    return { ...projected, type, label: type, courseCode: row.courseCode ?? null,
      availability: row.type === 'remote_work' ? 'informational' : 'busy' };
  }
  const type = row.type || 'Teaching';
  return { ...projected, type, label: row.courseCode ? row.courseCode + ' · ' + type : type,
    detail: row.detail ?? null, courseCode: row.courseCode ?? null, sessionId: UUID.test(row.sessionId ?? '') ? row.sessionId : null,
    startTime: row.startTime ?? null, endTime: row.endTime ?? null, availability: 'busy' };
}

function validEvidence(row) {
  if (!Array.isArray(row.timeEvidence)) throw Error('Work time coverage was not supplied');
  const evidence = new Map();
  for (const { date, startTime, endTime } of row.timeEvidence) {
    const start = clockSeconds(startTime), end = clockSeconds(endTime);
    if (!validDate(date) || date < row.startDate || date > row.endDate || start === null || end === null || start >= end || evidence.has(date)) {
      throw Error('Invalid work time evidence');
    }
    evidence.set(date, [start, end]);
  }
  return evidence;
}

function eventInterval(event, date, evidence, teachingTime) {
  if (event.kind === 'work') {
    const times = evidence.get(date);
    return times ? [times[0], times[1], 'busy', 'verified'] : [0, DAY, 'unknown', 'unconfirmed'];
  }
  if (event.kind === 'teaching') {
    const [start, end] = teachingTime;
    if (start === null || end === null || (event.startDate === event.endDate && start >= end)) return [0, DAY, 'unknown', 'unconfirmed'];
    return [date === event.startDate ? start : 0, date === event.endDate ? end : DAY, 'busy', 'verified'];
  }
  return [0, DAY, event.availability, 'all_day'];
}

function timeSegments(event, row, dates, window) {
  if (['ongoing', 'informational'].includes(event.availability)) return [];
  let first = event.startDate > window.startDate ? event.startDate : window.startDate;
  const last = window.endDate && window.endDate < event.endDate ? window.endDate : event.endDate;
  if (first === window.today && window.now >= window.end) {
    if (first === last) return [];
    first = offsetDate(first, 1);
  }
  const evidence = event.kind === 'work' ? validEvidence(row) : null;
  const teachingTime = [clockSeconds(event.startTime), clockSeconds(event.endTime)];
  const segment = date => {
    const [start, end, status, timing] = eventInterval(event, date, evidence, teachingTime);
    const lower = Math.max(start, window.start, date === window.today ? window.now : 0);
    const upper = Math.min(end, window.end);
    return lower < upper ? { date, start: lower, end: upper, status, timing, actualStart: start, actualEnd: end } : null;
  };
  if (dates.length) return dates.filter(date => date >= first && date <= last).map(segment).filter(Boolean);
  // Open-ended Agenda and Summary queries do not expand long records into per-day objects.
  if (evidence) {
    const confirmedDays = [...evidence.keys()].filter(date => date >= first && date <= last).sort();
    const matches = confirmedDays.map(segment).filter(Boolean);
    if (confirmedDays.length < daysBetween(first, last) + 1) {
      const known = new Set(confirmedDays);
      let missing = first;
      while (known.has(missing)) missing = offsetDate(missing, 1);
      const unknown = segment(missing);
      if (unknown) matches.push(unknown);
    }
    return matches;
  }
  const samples = new Set([first, last]);
  if (daysBetween(first, last) > 1) samples.add(offsetDate(first, 1));
  return [...samples].map(segment).filter(Boolean);
}

function compareEvents(left, right) {
  const a = left.segments[0], b = right.segments[0];
  const byDate = (a?.date ?? left.startDate).localeCompare(b?.date ?? right.startDate);
  return byDate || (a?.start ?? 0) - (b?.start ?? 0) || left.kind.localeCompare(right.kind) || left.eventKey.localeCompare(right.eventKey);
}

function buildSchedule({ faculty, rows, window, today, localTime, complete, clockChanges = [] }) {
  const startDate = window.mode === 'upcoming' ? today : window.startDate;
  const endDate = window.mode === 'day' ? startDate : window.endDate;
  const dates = endDate ? Array.from({ length: daysBetween(startDate, endDate) + 1 }, (_, index) => offsetDate(startDate, index)) : [];
  const interval = { startDate, endDate, start: clockSeconds(window.startTime) ?? 0, end: clockSeconds(window.endTime) ?? DAY,
    today: window.mode === 'upcoming' ? today : null, now: clockSeconds(localTime) ?? 0 };
  const transitions = new Map();
  const facultyEvents = new Map(faculty.map(person => [person.facultyId, []]));
  const events = [], seen = new Map();
  for (const row of rows) {
    const id = String(row?.facultyId || '').toLowerCase(), owned = facultyEvents.get(id);
    if (!owned) throw Error('Unexpected faculty in availability events');
    const event = cleanEvent(row, id);
    if (event.startDate > (endDate ?? '9999-12-31') || (event.endDate && event.endDate < startDate)) continue;
    const segments = timeSegments(event, row, dates, interval);
    if (!segments.length && !['ongoing', 'informational'].includes(event.availability)) continue;
    const key = id + ':' + event.eventKey, evidence = JSON.stringify([event, segments]);
    if (seen.has(key)) {
      if (seen.get(key) !== evidence) throw Error('Conflicting evidence for one availability event');
      continue;
    }
    seen.set(key, evidence);
    const result = { ...event, availability: segments.length ? statusOf(segments.map(part => part.status)) : event.availability, segments };
    owned.push(result);
    events.push(result);
  }
  events.sort(compareEvents);
  for (const { date, start, end } of clockChanges) {
    if (!dates.includes(date) || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > DAY || start >= end) {
      throw Error('Invalid Calgary clock-change coverage');
    }
    if (overlaps(start, end, interval.start, interval.end)) {
      transitions.set(date, { start: Math.max(start, interval.start), end: Math.min(end, interval.end) });
    }
  }

  const byFaculty = new Map();
  const summaries = faculty.map(person => {
    const owned = facultyEvents.get(person.facultyId).sort(compareEvents);
    const conflicts = owned.filter(event => event.segments.length);
    const incomplete = !complete || person.undatedSessions > 0 || person.undatedRoles > 0;
    const byDay = new Map(dates.map(date => [date, []]));
    for (const event of conflicts) for (const segment of event.segments) {
      byDay.get(segment.date)?.push({ ...segment, eventKey: event.eventKey });
    }
    byFaculty.set(person.facultyId, { incomplete, byDay });
    const days = dates.map(date => statusOf(byDay.get(date).map(segment => segment.status), incomplete || transitions.has(date)));
    const status = statusOf([...conflicts.map(item => item.availability), ...days], incomplete);
    const first = conflicts.find(event => event.availability === status);
    const segment = first?.segments.find(part => part.status === status);
    const time = !segment || segment.timing === 'unconfirmed' ? '—' : segment.timing === 'all_day' ? 'All Day' :
      segment.date + ' ' + formatClock(segment.actualStart) + '–' + formatClock(segment.actualEnd);
    return { facultyId: person.facultyId, status, days, conflictCount: conflicts.length, conflict: first?.type ?? null, time };
  });
  return { faculty, events, summaries, dates, window: { ...window, startDate, endDate, start: interval.start, end: interval.end },
    today, complete, byFaculty, transitions };
}

function filterSummaries(schedule, filter = 'all', sort = 'name') {
  const people = new Map(schedule.faculty.map(person => [person.facultyId, person]));
  return schedule.summaries.map(summary => ({ ...summary, ...people.get(summary.facultyId) }))
    .filter(row => filter === 'all' || (filter === 'conflicts' ? ['busy', 'unavailable', 'tentative'].includes(row.status) : row.status === filter))
    .sort((a, b) => (sort === 'status' ? priority.indexOf(a.status) - priority.indexOf(b.status) : 0) ||
      compareNames(a.name, b.name) || a.facultyId.localeCompare(b.facultyId));
}

function freeIntervals(schedule, person, date) {
  const { start, end } = schedule.window;
  if (person.incomplete) return [];
  const blocks = [...person.byDay.get(date)];
  if (schedule.transitions.has(date)) blocks.push(schedule.transitions.get(date));
  const free = [];
  let cursor = start;
  for (const block of blocks.sort((a, b) => a.start - b.start)) {
    if (block.start > cursor) free.push([cursor, Math.min(block.start, end)]);
    cursor = Math.max(cursor, block.end);
  }
  if (cursor < end) free.push([cursor, end]);
  return free.filter(([from, to]) => from < to);
}

function commonTimes(schedule, { duration, minCount, requiredIds, step }) {
  if (!schedule.complete || !schedule.dates.length) return { matches: [], total: 0 };
  const span = duration * 60;
  const { start: from, end: to } = schedule.window;
  const matches = [];
  for (const date of schedule.dates) {
    const faculties = [...schedule.byFaculty].map(([id, person]) => ({ id, free: freeIntervals(schedule, person, date) }));
    const origins = step
      ? Array.from({ length: Math.max(0, Math.floor((to - span - from) / (step * 60)) + 1) }, (_, index) => from + index * step * 60)
      : [...new Set(faculties.flatMap(person => person.free.map(([start]) => start)))].sort((a, b) => a - b);
    // A person's free interval must cover the entire window. Presence is never
    // calculated by adding together different people who are free in turn.
    const lastEndByGroup = new Map();
    for (const start of origins) {
      const attending = new Map();
      for (const { id, free } of faculties) {
        const match = free.find(([a, b]) => a <= start && b >= start + span);
        if (match) attending.set(id, match[1]);
      }
      if (attending.size < minCount || requiredIds.some(id => !attending.has(id))) continue;
      const end = Math.min(...attending.values());
      const group = [...attending.keys()].join(',');
      if ((lastEndByGroup.get(group) ?? from) >= end) continue;
      lastEndByGroup.set(group, end);
      matches.push({ date, start, end, count: attending.size });
    }
  }
  matches.sort((a, b) => b.count - a.count || a.date.localeCompare(b.date) || a.start - b.start || b.end - a.end);
  return { matches: matches.slice(0, 200), total: matches.length };
}

function describeTime(schedule, date, start, end) {
  const change = schedule.transitions.get(date);
  return schedule.faculty.map(({ facultyId }) => {
    const { incomplete, byDay } = schedule.byFaculty.get(facultyId);
    const segments = byDay.get(date).filter(part => overlaps(start, end, part.start, part.end));
    const clockUnconfirmed = Boolean(change && overlaps(start, end, change.start, change.end));
    return { facultyId, status: statusOf(segments.map(part => part.status), incomplete || clockUnconfirmed), clockUnconfirmed,
      events: segments.map(part => ({ key: part.eventKey, start: part.actualStart, end: part.actualEnd, status: part.status, timing: part.timing })) };
  });
}

module.exports = { UUID, validDate, daysBetween, clockSeconds, formatClock, statusLabels, buildSchedule, commonTimes, describeTime, filterSummaries };
