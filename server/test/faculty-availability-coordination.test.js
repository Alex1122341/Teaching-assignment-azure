'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createFacultyAvailabilityApi } = require('../src/availability/faculty-availability-api');
const { createFacultyAvailabilityFunctions } = require('../src/runtime/swa-faculty-availability-functions');
const { buildSchedule, commonTimes } = require('../src/availability/faculty-availability-window');

const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
const date = '2027-01-11';
const day = { mode: 'day', startDate: date, endDate: date, startTime: '08:00', endTime: '16:00' };
const roster = ids.map((facultyId, i) => ({ facultyId, name: ['A, Anne', 'B, Blake', 'C, Chris'][i], active: true, undatedSessions: 0, undatedRoles: 0 }));
const event = (facultyId, eventKey, extra = {}) => ({
  facultyId, eventKey, kind: 'teaching', type: 'LEC', label: 'VTMD 101 · LEC',
  startDate: date, endDate: date, startTime: '09:00', endTime: '10:00', availability: 'busy',
  ...extra
});
const seconds = time => Number(time.slice(0, 2)) * 3600 + Number(time.slice(3, 5)) * 60;

test('half-open intervals allow adjacent sessions, while pending and missing daily evidence block common time', () => {
  const rows = [
    event(ids[0], 'lecture'),
    event(ids[0], 'lecture'),
    event(ids[1], 'pending', { kind: 'pending', type: 'Pending AFC', availability: 'tentative', startTime: null, endTime: null }),
    event(ids[2], 'ccc', { kind: 'work', type: 'CCC', endDate: '2027-01-12', startTime: null, endTime: null,
      timeEvidence: [{ date, startTime: '10:00', endTime: '11:00' }] })
  ];
  const schedule = buildSchedule({ faculty: roster, rows, window: { ...day, mode: 'range', endDate: '2027-01-12' }, today: date, complete: true });
  assert.deepEqual(schedule.summaries.map(row => [row.status, row.conflictCount]), [['busy', 1], ['tentative', 1], ['busy', 1]]);
  assert.deepEqual(schedule.summaries[2].days, ['busy', 'unknown']);
  const { matches } = commonTimes(schedule, { duration: 60, minCount: 2, requiredIds: [ids[2]], step: 30 });
  assert.ok(matches.some(row => row.date === date && row.start === seconds('08:00') && row.end === seconds('09:00')));
  assert.ok(matches.some(row => row.date === date && row.start === seconds('11:00')));
  assert.ok(matches.every(row => row.date === date && row.count === 2));
});

test('cross-day timed activity splits at local midnight and all-day records retain original dates', () => {
  const schedule = buildSchedule({ faculty: roster, rows: [
    event(ids[0], 'overnight', { endDate: '2027-01-12', startTime: '23:00', endTime: '01:00' }),
    event(ids[1], 'away', { kind: 'afc', availability: 'away', startDate: '2027-01-01', endDate: '2027-01-12', startTime: null, endTime: null }),
    event(ids[2], 'role', { kind: 'role', availability: 'ongoing', endDate: null, startTime: null, endTime: null })
  ], window: { ...day, mode: 'range', endDate: '2027-01-12', startTime: null, endTime: null }, today: date, complete: true });
  assert.deepEqual(schedule.events.find(row => row.eventKey === 'overnight').segments.map(({ date, start, end }) => [date, start, end]), [
    ['2027-01-11', seconds('23:00'), 86400], ['2027-01-12', 0, seconds('01:00')]
  ]);
  assert.equal(schedule.events.find(row => row.eventKey === 'away').startDate, '2027-01-01');
  assert.deepEqual(schedule.summaries.map(row => row.status), ['busy', 'unavailable', 'clear']);
});

test('incomplete reads and unconfirmed evidence cannot certify an open time', () => {
  const schedule = buildSchedule({ faculty: roster, rows: [], window: day, today: date, complete: false });
  assert.ok(schedule.summaries.every(row => row.status === 'unknown'));
  assert.equal(commonTimes(schedule, { duration: 30, minCount: 1, requiredIds: [], step: 0 }).matches.length, 0);
  const self = buildSchedule({ faculty: [{ ...roster[0], undatedSessions: 1 }], rows: [], window: day, today: date, complete: true });
  assert.equal(self.summaries[0].status, 'unknown');
  assert.equal(commonTimes(self, { duration: 30, minCount: 1, requiredIds: [], step: 0 }).matches.length, 0);
});

test('start-time steps, required people and Calgary clock-change hours produce conservative windows', () => {
  const spring = '2027-03-14';
  const dayOfChange = { ...day, startDate: spring, endDate: spring, startTime: '01:00', endTime: '04:00' };
  const schedule = buildSchedule({ faculty: roster, rows: [], window: dayOfChange, today: spring, complete: true,
    clockChanges: [{ date: spring, start: 7200, end: 10800 }] });
  assert.ok(schedule.summaries.every(person => person.status === 'unknown'));
  const { matches } = commonTimes(schedule, { duration: 45, minCount: 3, requiredIds: [ids[0]], step: 15 });
  assert.deepEqual(matches, [
    { date: spring, start: 3600, end: 7200, count: 3 },
    { date: spring, start: 10800, end: 14400, count: 3 }
  ]);
  assert.equal(commonTimes(schedule, { duration: 90, minCount: 3, requiredIds: [], step: 0 }).total, 0);
  const skipped = buildSchedule({ faculty: roster, rows: [event(ids[0], 'skipped', { startDate: spring, endDate: spring,
    startTime: '02:15', endTime: '02:45' })], window: dayOfChange, today: spring, complete: true,
    clockChanges: [{ date: spring, start: 7200, end: 10800 }] });
  assert.equal(skipped.events[0].availability, 'unknown');
  assert.ok(skipped.events[0].segments.every(part => part.timing === 'unconfirmed'));
});

test('common time counts the same people across the whole interval', () => {
  const schedule = buildSchedule({ faculty: roster, rows: [
    event(ids[0], 'a', { startTime: '08:00', endTime: '12:00' }),
    event(ids[1], 'b', { startTime: '12:00', endTime: '16:00' })
  ], window: day, today: date, complete: true });
  assert.equal(commonTimes(schedule, { duration: 300, minCount: 2, requiredIds: [], step: 30 }).total, 0);
  const short = commonTimes(schedule, { duration: 30, minCount: 2, requiredIds: [ids[1]], step: 15 });
  assert.ok(short.matches.length > 0);
  assert.ok(short.matches.every(match => match.end <= 43200));
});

test('finds both a higher-attendance slot and a longer qualifying window at the same start', () => {
  const schedule = buildSchedule({ faculty: roster, rows: [event(ids[0], 'busy late', { startTime: '10:00', endTime: '12:00' })],
    window: { ...day, endTime: '12:00' }, today: date, complete: true });
  const { matches } = commonTimes(schedule, { duration: 60, minCount: 2, requiredIds: [ids[1]], step: 0 });
  assert.deepEqual(matches.slice(0, 2), [
    { date, start: 28800, end: 36000, count: 3 }, { date, start: 28800, end: 43200, count: 2 }
  ]);
});

test('open-ended Agenda places missing days in order and preserves informational time evidence', () => {
  const nextDate = '2027-01-12';
  const timeEvidence = [{ date: nextDate, startTime: '09:30', endTime: '11:00' }];
  const schedule = buildSchedule({ faculty: roster, rows: [
    event(ids[0], 'ccc', { kind: 'work', type: 'ccc', label: 'Staffed CCC shift', endDate: nextDate, timeEvidence }),
    event(ids[1], 'informational', { kind: 'work', type: 'remote_work', endDate: nextDate, timeEvidence })
  ], window: { ...day, mode: 'from', endDate: null }, today: date, complete: true });
  const ccc = schedule.events.find(row => row.eventKey === 'ccc');
  assert.equal(ccc.agendaDate, date);
  assert.equal(ccc.label, 'CCC');
  assert.deepEqual(ccc.segments.map(part => part.status), ['unknown', 'busy']);
  assert.equal(schedule.events.find(row => row.eventKey === 'informational').segments[0].timing, 'verified');
  assert.equal(schedule.summaries[1].status, 'clear');
});

test('anonymous unresolved teaching coverage excludes only the affected periods from common time', () => {
  const schedule = buildSchedule({ faculty: roster, rows: [], window: day, today: date, complete: true,
    unlinkedTeaching: [{ date, startTime: '10:00', endTime: '11:00' }] });
  assert.ok(schedule.summaries.every(person => person.status === 'unknown'));
  assert.ok(schedule.summaries.every(person => person.conflict === 'Unresolved teaching assignment'));
  const result = commonTimes(schedule, { duration: 60, minCount: 3, requiredIds: [], step: 0 });
  assert.deepEqual(result.matches.map(slot => [slot.start, slot.end]), [[28800, 36000], [39600, 57600]]);
});

test('the open-ended Agenda respects clock changes and excludes timed informational records outside the hours', () => {
  const spring = '2026-03-08';
  const schedule = buildSchedule({ faculty: roster, rows: [
    event(ids[0], 'skipped', { startDate: spring, endDate: spring, startTime: '02:15', endTime: '02:45' }),
    event(ids[1], 'remote', { kind: 'work', type: 'remote_work', startDate: spring, endDate: spring,
      timeEvidence: [{ date: spring, startTime: '17:00', endTime: '18:00' }] })
  ], window: { ...day, mode: 'from', startDate: spring, endDate: null, startTime: '01:00', endTime: '04:00' },
  today: spring, complete: true, clockChanges: [{ date: spring, start: 7200, end: 10800 }] });
  assert.equal(schedule.events.length, 1);
  assert.equal(schedule.events[0].availability, 'unknown');
});

function fixture() {
  let role = 'owner';
  let current = 10;
  const calls = [];
  const records = [{
    ...event(ids[0], 'afc:1'), kind: 'afc', availability: 'away', label: 'PRIVATE MEDICAL', detail: 'PRIVATE NOTE',
    type: 'PRIVATE REASON', notes: 'PRIVATE NOTES', startTime: null, endTime: null
  }];
  const api = createFacultyAvailabilityApi({
    verifyToken: async uid => ({ uid }),
    findUser: async uid => ({ baseRole: uid === 'other' ? 'owner' : role, active: true, facultyId: ids[0] }),
    repository: {
      async bulk(input) {
        calls.push(input);
        if (input.action === 'check') return { authorized: true };
        if (input.action === 'roster') return { faculty: roster, total: roster.length, activeTotal: roster.length, nextCursor: null };
        return { faculty: roster.map(r => ({ ...r, displayName: r.name, email: 'PRIVATE EMAIL' })), events: records, today: date,
          localTime: '08:00:00', complete: true, clockChanges: [], unlinkedTeaching: [] };
      }
    },
    clock: () => current
  });
  return { api, calls, advance: () => { current += 1_000_000; }, setRole: value => { role = value; } };
}

test('batch authorization, shared snapshot and full export preserve identity and privacy', async () => {
  const h = fixture();
  const definition = { ...day, endDate: null, selection: 'allActive', facultyIds: [], includeInactive: false };
  assert.equal((await h.api.query('', definition)).status, 401);
  h.setRole('adc');
  assert.equal((await h.api.query('owner', definition)).status, 403);
  h.setRole('hicc');
  assert.equal((await h.api.query('owner', definition)).status, 403);
  assert.equal((await h.api.query('owner', { ...definition, selection: 'selected', facultyIds: ids.slice(0, 2) })).status, 403);
  assert.equal(h.calls.length, 0);
  h.setRole('owner');
  const { status, body } = await h.api.query('owner', definition);
  assert.equal(status, 200);
  assert.equal(h.calls.filter(c => c.action === 'query').length, 1);
  assert.equal(body.faculty.length, 3);
  assert.equal(body.summaries[0].status, 'unavailable');
  assert.doesNotMatch(JSON.stringify(body), /PRIVATE/);
  const exported = await h.api.export('owner', { snapshot: body.snapshot, format: 'csv', filter: 'clear', sort: 'name' });
  assert.equal(exported.status, 200);
  assert.equal(exported.body.rowCount, 2);
  const csv = Buffer.from(exported.body.fileBase64, 'base64').toString('utf8');
  assert.match(csv, /B, Blake/);
  assert.doesNotMatch(csv, /PRIVATE|A, Anne|11111111/);
  assert.equal((await h.api.export('other', { snapshot: body.snapshot, format: 'csv' })).status, 403);
  h.advance();
  assert.equal((await h.api.page('owner', { snapshot: body.snapshot, offset: '0' })).status, 409);
});

test('batch routes reject ambiguous filters and never cache authorized data', async () => {
  const { api } = fixture();
  const route = createFacultyAvailabilityFunctions({ api });
  const request = (name, { method = 'GET', body = '', type = 'application/json' } = {}) => route({
    method, url: 'https://localhost/api/v1/faculty/availability/' + name,
    headers: { get: field => field === 'authorization' ? 'Bearer owner' : type }, text: async () => body
  });
  const roster = await request('roster');
  assert.equal(roster.status, 200);
  assert.equal(roster.headers['Cache-Control'], 'private, no-store');
  assert.equal((await request('query')).status, 405);
  assert.equal((await request('roster?includeInactive=0&includeInactive=1')).status, 400);
  assert.equal((await request('query', { method: 'POST', body: '{"selection":"allActive","selection":"selected"}' })).status, 400);
  assert.equal((await request('query', { method: 'POST', type: 'text/plain' })).status, 415);
  for (const input of [
    { selection: 'allActive', facultyIds: [], mode: 'range', startDate: date, endDate: '2027-03-01' },
    { selection: 'selected', facultyIds: [ids[0], ids[0]], mode: 'day', startDate: date },
    { selection: 'allActive', facultyIds: [], mode: 'day', startDate: date, startTime: '15:00', endTime: '08:00' }
  ]) assert.equal((await request('query', { method: 'POST', body: JSON.stringify(input) })).status, 400);
});
