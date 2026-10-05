'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseAfcCsv,
  normalizeFacultyName,
  resolveFacultyName,
  reconcileAfcRows
} = require('../tools/afc-source-import');

const HEADERS = 'Faculty Member,Start,End,Purpose';
const faculty = [
  { facultyId: 'faculty-a', displayName: 'Anne Example', preferredFirstName: 'Anne', preferredLastName: 'Example', active: true },
  { facultyId: 'faculty-b', displayName: 'Alex Sample', preferredFirstName: 'Alex', preferredLastName: 'Sample', active: true }
];

test('CSV parser preserves exact Purpose and handles escaped commas, quotes, and quoted line breaks', () => {
  const csv = `${HEADERS}\r\n"Example, Anne",2026-01-01,2026-01-02,"RSL, approved ""remote"" work"\r\n"Example, Anne",2026-01-03,2026-01-04,"Two-line\nPurpose"\r\n`;
  const parsed = parseAfcCsv(csv);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].sourceRowNumber, 2);
  assert.equal(parsed.rows[0].facultySourceName, 'Example, Anne');
  assert.equal(parsed.rows[0].purpose, 'RSL, approved "remote" work');
  assert.equal(parsed.rows[1].purpose, 'Two-line\nPurpose');
  assert.deepEqual(parsed.rows.map(row => row.issues), [[], []]);
});

test('parser isolates missing fields, invalid and reversed dates, and duplicate source rows with source row numbers', () => {
  const csv = [
    HEADERS,
    '"Example, Anne",2026-01-01,2026-01-02,Retreat',
    '"Example, Anne",2026-01-01,2026-01-02,Retreat',
    ',2026-01-01,2026-01-02,Retreat',
    '"Example, Anne",2026-02-01,2026-02-03,',
    '"Example, Anne",not-a-date,2026-02-03,Trip',
    '"Example, Anne",2026-03-02,2026-03-01,Trip'
  ].join('\n');
  const parsed = parseAfcCsv(csv);
  assert.equal(parsed.rows.length, 6);
  assert.deepEqual(parsed.rows[1].issues, ['DUPLICATE_SOURCE_BUSINESS_ROW']);
  assert.deepEqual(parsed.rows[2].issues, ['MISSING_FACULTY']);
  assert.deepEqual(parsed.rows[3].issues, ['MISSING_PURPOSE']);
  assert.deepEqual(parsed.rows[4].issues, ['INVALID_START_DATE']);
  assert.deepEqual(parsed.rows[5].issues, ['END_BEFORE_START']);
  assert.equal(parsed.summary.sourceRows, 6);
  assert.equal(parsed.summary.duplicateGroups, 1);
  assert.equal(parsed.summary.duplicateExtraRows, 1);
});

test('name resolution uses deterministic canonical order, aliases, and explicit mappings without fuzzy guesses', () => {
  assert.equal(normalizeFacultyName('  EXAMPLE, Anne-Marie  '), 'anne marie example');
  const aliases = [{ facultyId: 'faculty-b', aliasName: 'A. Sample', targetPreferredSourceName: 'Alex Sample', targetDisplayName: 'Alex Sample', active: true }];
  const directory = { faculty, aliases, mappings: [{ sourceName: 'Historical Alias', facultyId: 'faculty-b' }] };
  assert.deepEqual(resolveFacultyName('Example, Anne', directory), { status: 'MATCHED', facultyId: 'faculty-a', method: 'CANONICAL_NAME' });
  assert.deepEqual(resolveFacultyName('A. Sample', directory), { status: 'MATCHED', facultyId: 'faculty-b', method: 'FACULTY_ALIAS' });
  assert.deepEqual(resolveFacultyName('Historical Alias', directory), { status: 'MATCHED', facultyId: 'faculty-b', method: 'EXPLICIT_IMPORT_MAPPING' });
  assert.deepEqual(resolveFacultyName('Ann Example', directory), { status: 'NO_MATCH', facultyId: null, method: null });
  assert.deepEqual(resolveFacultyName('Unknown Person', { ...directory, mappings: {} }), { status: 'NO_MATCH', facultyId: null, method: null });
  assert.equal(resolveFacultyName('Example, Anne', { ...directory, faculty: [...faculty, { ...faculty[0], facultyId: 'faculty-c' }] }).status, 'AMBIGUOUS');
});

test('exact database history deterministically repairs only uniquely corroborated missing faculty, purpose, and reversed dates', () => {
  const parsed = parseAfcCsv([
    HEADERS,
    ',2026-01-02,2026-01-03,Retreat',
    '"Example, Anne",2026-02-04,2026-02-05,',
    '"Example, Anne",2026-03-09,2026-03-01,Trip'
  ].join('\n'));
  const existing = [
    { afcRecordId: 'record-a', facultyId: 'faculty-a', startDate: '2026-01-02', endDate: '2026-01-03', purpose: 'Retreat', active: true },
    { afcRecordId: 'record-b', facultyId: 'faculty-a', startDate: '2026-02-04', endDate: '2026-02-05', purpose: 'Clinic', active: true },
    { afcRecordId: 'record-c', facultyId: 'faculty-a', startDate: '2026-03-01', endDate: '2026-03-09', purpose: 'Trip', active: true }
  ];
  const result = reconcileAfcRows(parsed.rows, { faculty, aliases: [], mappings: {}, existingRecords: existing });
  assert.deepEqual(result.rows.map(row => row.status), [
    'SOURCE_ERROR_DETERMINISTICALLY_RESOLVED',
    'SOURCE_ERROR_DETERMINISTICALLY_RESOLVED',
    'SOURCE_ERROR_DETERMINISTICALLY_RESOLVED'
  ]);
  assert.deepEqual(result.rows.map(row => row.correction), ['FACULTY_FROM_EXACT_HISTORY', 'PURPOSE_FROM_EXACT_HISTORY', 'REVERSED_DATES_FROM_EXACT_HISTORY']);
  assert.deepEqual(result.rows.map(row => row.writeAction), ['NONE', 'NONE', 'NONE']);
});

test('ambiguous identity and uncorroborated anomalies remain unresolved, never guessed', () => {
  const parsed = parseAfcCsv([
    HEADERS,
    'Unknown Person,2026-01-01,2026-01-02,Retreat',
    ',2026-04-01,2026-04-02,Unmatched'
  ].join('\n'));
  const result = reconcileAfcRows(parsed.rows, { faculty, aliases: [], mappings: {}, existingRecords: [] });
  assert.deepEqual(result.rows.map(row => row.status), ['SOURCE_ROW_REQUIRES_REVIEW', 'SOURCE_ROW_REQUIRES_REVIEW']);
  assert.deepEqual(result.rows.map(row => row.writeAction), ['NONE', 'NONE']);
  assert.equal(result.summary.unresolved, 2);
});

test('reconciliation is idempotent, reports changed history, and never inserts exact source duplicates', () => {
  const parsed = parseAfcCsv([
    HEADERS,
    '"Example, Anne",2026-05-01,2026-05-02,OPA',
    '"Example, Anne",2026-05-01,2026-05-02,OPA',
    '"Example, Anne",2026-06-01,2026-06-02,CCC Day',
    '"Example, Anne",2026-07-01,2026-07-02,Study Leave'
  ].join('\n'));
  const existing = [
    { afcRecordId: 'record-old', facultyId: 'faculty-a', startDate: '2026-06-01', endDate: '2026-06-02', purpose: 'CCC day', active: true },
    { afcRecordId: 'record-history', facultyId: 'faculty-b', startDate: '2024-01-01', endDate: '2024-01-02', purpose: 'Old', active: true }
  ];
  const first = reconcileAfcRows(parsed.rows, { faculty, aliases: [], mappings: {}, existingRecords: existing });
  assert.deepEqual(first.rows.map(row => row.status), [
    'SOURCE_NEW',
    'SOURCE_ROW_REQUIRES_REVIEW',
    'SOURCE_CHANGED',
    'SOURCE_NEW'
  ]);
  assert.deepEqual(first.rows.map(row => row.writeAction), ['INSERT', 'NONE', 'INSERT', 'INSERT']);
  assert.equal(first.summary.sourceRows, 4);
  assert.equal(first.summary.validRows, 3);
  assert.equal(first.summary.sourceNew, 2);
  assert.equal(first.summary.sourceChanged, 1);
  assert.equal(first.summary.duplicateExtraRows, 1);
  assert.equal(first.summary.dbOnlyHistory, 2);
  const after = [...existing, ...first.rows.filter(row => row.writeAction === 'INSERT').map((row, i) => ({
    afcRecordId: `record-new-${i}`, facultyId: row.facultyId, startDate: row.startDate, endDate: row.endDate, purpose: row.purpose, active: true
  }))];
  const second = reconcileAfcRows(parsed.rows, { faculty, aliases: [], mappings: {}, existingRecords: after });
  assert.equal(second.summary.inserts, 0);
  assert.equal(second.rows[0].status, 'SOURCE_CURRENT');
  assert.equal(second.rows[3].status, 'SOURCE_CURRENT');
});

test('represented counts include only valid source rows, not duplicate review rows', () => {
  const parsed = parseAfcCsv([
    HEADERS,
    '"Example, Anne",2026-08-01,2026-08-02,OPA',
    '"Example, Anne",2026-08-01,2026-08-02,OPA'
  ].join('\n'));
  const existing = [{ afcRecordId: 'record-a', facultyId: 'faculty-a', startDate: '2026-08-01', endDate: '2026-08-02', purpose: 'OPA', active: true }];
  const result = reconcileAfcRows(parsed.rows, { faculty, aliases: [], mappings: {}, existingRecords: existing });
  assert.equal(result.summary.validRows, 1);
  assert.equal(result.summary.represented, 1);
  assert.equal(result.summary.duplicateExtraRows, 1);
});
