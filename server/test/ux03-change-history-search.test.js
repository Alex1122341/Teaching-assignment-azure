'use strict';
// UX-03: Change History academic-year filter, keyword search and six columns.
// Names are shown as "Last, First" (PAWS constitution), so a search typed the
// way the table shows a name must find it, as must the source "First Last" form.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createChangeHistoryApi } = require('../src/history/change-history-api');
const { filterHistoryRows } = require('../src/history/change-history-projection');

const F = '11111111-1111-4111-8111-111111111111';
const event = (i, at, year, before, after) => ({
  source: 'audit', eventId: 'e' + i, eventType: 'session_updated', entityType: 'session', entityId: 's' + i, occurredAtUtc: at,
  beforeJson: JSON.stringify({ ...before, academicYear: year }), afterJson: JSON.stringify({ ...after, academicYear: year }), metadataJson: null,
  contextJson: JSON.stringify({ affectedFaculty: [{ facultyId: F, displayName: 'Avery Lindqvist' }], courseCode: 'VTMD 200', topic: 'Case discussion', academicYear: year }),
  actorName: 'Mira Okonkwo'
});
const events = [
  event(1, '2026-10-20T16:00:00Z', '2026-27', { room: 'A' }, { room: 'B' }),
  event(2, '2026-10-21T16:00:00Z', '2025-26', { room: 'C' }, { room: 'D' })
];
const api = createChangeHistoryApi({
  verifyToken: async () => ({ uid: 'u' }),
  findUser: async () => ({ active: true, mustChangePassword: false, baseRole: 'administrator', facultyId: F, displayName: 'Admin' }),
  repository: { list: async () => events },
  clock: () => Date.parse('2026-10-29T18:00:00Z')
});
const query = async filters => (await api.query('t', { scope: 'timetable', ...filters })).body;

test('academic-year filter keeps only the selected year and lists every recorded year', async () => {
  const current = await query({});
  assert.equal(current.total, 1);
  assert.equal(current.rows[0].previousValue, 'A');
  assert.equal(current.rows[0].academicYear, '2026-27');
  const older = await query({ academicYear: '2025-26' });
  assert.equal(older.total, 1);
  assert.equal(older.rows[0].previousValue, 'C');
  assert.deepEqual(current.facets.academicYears, ['2025-26', '2026-27']);
});

test('keyword search finds a name typed as shown ("Last, First") or as recorded ("First Last")', async () => {
  for (const keyword of ['Lindqvist, Avery', 'Avery Lindqvist', 'lindqvist', 'Okonkwo, Mira', 'Mira Okonkwo', 'LINDQVIST,AVERY']) {
    const result = await query({ keyword });
    assert.equal(result.total, 1, keyword);
  }
  assert.equal((await query({ keyword: 'Weiss, Jonas' })).total, 0);
});

test('keyword search still matches course, topic, field, values and change type', async () => {
  for (const keyword of ['VTMD 200', 'case discussion', 'room', 'B', 'session updated']) assert.equal((await query({ keyword })).total, 1, keyword);
  assert.equal((await query({ keyword: 'VTMD 999' })).total, 0);
});

test('every row carries the six column values', async () => {
  const [row] = (await query({})).rows;
  for (const key of ['changeDate', 'changeType', 'domain', 'course', 'session', 'affectedFaculty', 'field', 'previousValue', 'updatedValue', 'actor']) assert.ok(row[key] !== undefined && row[key] !== '', key);
  assert.equal(row.actor, 'Mira Okonkwo');
});

test('filterHistoryRows treats commas as separators without loosening other terms', () => {
  const rows = [{ rowId: 'r1', changeDate: '2026-10-20T16:00:00.000Z', changeType: 'session_updated', domain: 'Teaching', affectedFaculty: ['Avery Lindqvist'], field: 'Room', previousValue: 'A', updatedValue: 'B', actor: 'Mira Okonkwo', _years: ['2026-27'], _ranges: [], _courseValues: [], _topicValues: [], _facultyKeys: [], _subjects: [] }];
  assert.equal(filterHistoryRows(rows, { keyword: 'Lindqvist, Avery' }).length, 1);
  assert.equal(filterHistoryRows(rows, { keyword: 'Lindqvist, Jonas' }).length, 0);
  assert.equal(filterHistoryRows(rows, { keyword: ',' }).length, 1);
});
