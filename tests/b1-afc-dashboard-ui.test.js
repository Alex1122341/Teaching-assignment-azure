'use strict';

const { repositoryPath } = require('../tools/build/frontend-paths');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const afcBatch = require('../frontend/scripts/faculty-admin-afc-batch.js');

const html = fs.readFileSync(repositoryPath(process.cwd(), 'faculty-admin.html'), 'utf8');
const js = fs.readFileSync(repositoryPath(process.cwd(), 'faculty-admin.js'), 'utf8');
const recordsJs = fs.readFileSync(repositoryPath(process.cwd(), 'faculty-admin-afc-records.js'), 'utf8');

test('B1 admin dashboard exposes an isolated AFC Records tab and create form', () => {
  assert.match(html, /data-tab="afc-records"/);
  assert.match(html, /id="afc-records-view"/);
  assert.match(html, /id="afc-record-form"/);
  assert.match(html, /id="afc-faculty"/);
  assert.match(html, /id="afc-reason"/);
  assert.match(html, /value="university_travel"/);
  assert.match(html, /value="vacation"/);
  assert.match(html, /value="rsl"/);
  assert.match(html, /value="medical"/);
  assert.match(html, /value="mat"/);
  assert.match(html, /value="special"/);
  assert.match(html, /value="other"/);
});

test('B1 AFC UI uses explicit Azure client methods and protects submit state', () => {
  assert.match(js, /UCVM_PAWS_DATA\.dashboardAfcRecords\(/);
  assert.match(js, /UCVM_AFC_RECORDS\.createSingleActions\(\{\s*api: UCVM_PAWS_DATA/);
  assert.match(recordsJs, /api\.createDashboardAfcRecord\(/);
  assert.match(recordsJs, /Saving…/);
  assert.match(recordsJs, /facultyId/);
  assert.match(js, /afcSubmitInFlight/);
  assert.match(recordsJs, /reasonCode/);
  assert.doesNotMatch(js, /db\.collection\(/);
  assert.doesNotMatch(recordsJs, /db\.collection\(/);
  const helperAt=html.indexOf('faculty-admin-afc-records.js'),controllerAt=html.indexOf('faculty-admin.js');
  assert.ok(helperAt>=0&&controllerAt>=0&&helperAt<controllerAt);
});

test('AFC multi-input UI supports Excel paste, canonical searchable Faculty, row review, and batch submit', () => {
  assert.match(html, /id="afc-batch-paste"/);
  assert.match(html, /id="afc-faculty-options"/);
  assert.match(html, /id="afc-batch-rows"/);
  assert.match(html, /id="afc-batch-validate"/);
  assert.match(html, /id="afc-batch-clear"/);
  assert.match(html, /Faculty Member.*Start.*End.*Purpose/);
  assert.match(html, /YYYY-MM-DD or YYYY\/M\/D/);
  assert.ok(html.indexOf('faculty-admin-afc-batch.js') < html.indexOf('faculty-admin.js'), 'batch helper loads before the dashboard controller');
  assert.match(js, /UCVM_PAWS_DATA\.createDashboardAfcManualBatch\(/);
  assert.match(js, /A batch can contain at most 20 rows/);
  assert.match(js, /function reviewAfcBatch/);
  assert.match(js, /UCVM_AFC_BATCH\.canSubmitRows\(rows, afcSubmitInFlight\)/);
  assert.match(js, /row\.errors\?\.length \? esc\(row\.status \+ ': ' \+ row\.errors\.join\(' '\)\)/);
  assert.match(js, /type="date"[^]*?value="' \+ esc\(row\.startDate\)/);
  assert.match(js, /UCVM_AFC_BATCH\.toApiRows\(afcBatchRows\)/);
  assert.match(js, /UCVM_AFC_BATCH\.parsePaste\(/);
  assert.match(js, /crypto\.randomUUID\(\)/);
  assert.doesNotMatch(js, /db\.collection\(/);
});

test('AFC batch success summary distinguishes created rows from an idempotent replay', () => {
  assert.equal(afcBatch.successMessage({ idempotentReplay: false, rows: [{ status: 'NEW' }, { status: 'NEW' }] }), 'Created 2 AFC record(s).');
  assert.equal(afcBatch.successMessage({ idempotentReplay: true, rows: [{ status: 'ALREADY_APPLIED' }, { status: 'ALREADY_APPLIED' }] }), 'This batch was already applied; no additional AFC records were created (2 rows).');
});

test('AFC Excel paste parser preserves descriptive Purpose and rejects empty or over-20-row input', () => {
  const facultyByName = new Map([['Example, Anne', { facultyId: 'f-1' }]]);
  const resolve = name => facultyByName.get(name) || null;
  const parsed = afcBatch.parsePaste('Faculty Member\tStart\tEnd\tPurpose\r\nExample, Anne\t2026-10-01\t2026-10-02\tClinical Day / PPVM (external)', resolve);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].facultyId, 'f-1');
  assert.equal(parsed.rows[0].purpose, 'Clinical Day / PPVM (external)');
  assert.equal(afcBatch.parsePaste(' \r\n', resolve).error, 'Paste at least one AFC row.');
  const tooMany = Array.from({ length: 21 }, () => 'Example, Anne\t2026-10-01\t2026-10-02\tVacation').join('\n');
  assert.equal(afcBatch.parsePaste(tooMany, resolve).error, 'Paste no more than 20 rows.');
});

test('AFC pasted year-first dates normalize to canonical values for date inputs and Review', () => {
  const resolve = name => ({ facultyId: name === 'Example, Anne' ? 'f-1' : 'f-2' });
  const parsed = afcBatch.parsePaste([
    'Example, Anne\t2027/2/3\t2027/02/05\tClinical Day',
    'Example, Ben\t 2027-02-03 \t 2028/2/29 \t Vacation',
    'Example, Cy\t2027/02/03\t2027/2/05\tResearch'
  ].join('\n'), resolve);

  assert.equal(parsed.rows.length, 3);
  const reviewed = afcBatch.validateRows(parsed.rows, resolve);
  assert.deepEqual(reviewed.map(row => [row.startDate, row.endDate]), [
    ['2027-02-03', '2027-02-05'],
    ['2027-02-03', '2028-02-29'],
    ['2027-02-03', '2027-02-05']
  ]);
  assert.ok(reviewed.every(row => row.errors.length === 0));
  assert.deepEqual(afcBatch.toApiRows(reviewed.slice(0, 1)), [{ facultyId: 'f-1', startDate: '2027-02-03', endDate: '2027-02-05', purpose: 'Clinical Day' }]);
});

test('AFC pasted invalid and ambiguous dates remain visible as row validation errors', () => {
  const parsed = afcBatch.parsePaste([
    'Example, Anne\t2027/2/30\t2027/2/5\tClinical Day',
    'Example, Ben\t2027/2/3\t03/02/2027\tVacation'
  ].join('\n'), () => ({ facultyId: 'f-1' }));

  assert.equal(parsed.rows[0].startDate, '');
  assert.deepEqual(parsed.rows[0].dateErrors, { startDate: 'Invalid Start Date: "2027/2/30". Use YYYY-MM-DD or YYYY/M/D.', endDate: '' });
  assert.deepEqual(parsed.rows[1].dateErrors, { startDate: '', endDate: 'Invalid End Date: "03/02/2027". Use YYYY-MM-DD or YYYY/M/D.' });
  assert.ok(parsed.rows.every(row => row.status === 'INVALID' && row.errors.length));
});

test('AFC paste keeps genuinely blank dates distinguishable from malformed non-empty dates', () => {
  const parsed = afcBatch.parsePaste('Example, Anne\t\t\tClinical Day\nExample, Ben\t2027/13/1\t\tVacation', () => ({ facultyId: 'f-1' }));
  assert.equal(parsed.rows[0].startDate, '');
  assert.equal(parsed.rows[0].endDate, '');
  assert.deepEqual(parsed.rows[0].dateErrors, { startDate: '', endDate: '' });
  assert.deepEqual(parsed.rows[1].dateErrors, { startDate: 'Invalid Start Date: "2027/13/1". Use YYYY-MM-DD or YYYY/M/D.', endDate: '' });
});

test('AFC paste normalizes mixed formats across the maximum 20-row batch without changing Purpose', () => {
  const purpose = 'Clinical Day / PPVM (external)';
  const rows = Array.from({ length: 20 }, (_, index) => `Example, Anne\t2027/${index % 2 ? '02/03' : '2/3'}\t2027-02-05\t${purpose}`).join('\n');
  const parsed = afcBatch.parsePaste(rows, () => ({ facultyId: 'f-1' }));
  assert.equal(parsed.rows.length, 20);
  assert.ok(parsed.rows.every(row => row.startDate === '2027-02-03' && row.endDate === '2027-02-05' && row.purpose === purpose));
});

test('AFC pasted Gregorian dates accept the specified forms and reject impossible or ambiguous forms', () => {
  for (const [input, expected] of [
    ['2027-02-03', '2027-02-03'], ['2027/2/3', '2027-02-03'], ['2027/02/03', '2027-02-03'],
    ['2027/2/05', '2027-02-05'], ['2028/2/29', '2028-02-29'], [' 2027/2/3 ', '2027-02-03']
  ]) assert.deepEqual(afcBatch.normalizePastedDate(input, 'Start Date'), { value: expected, error: '' }, input);
  for (const input of ['2027/2/29', '2027/2/30', '2027/4/31', '2027/13/1', '2027/0/1', '2027/abc/1', 'abc', '2/3/2027', '03/02/2027']) {
    assert.match(afcBatch.normalizePastedDate(input, 'Start Date').error, /^Invalid Start Date:/, input);
  }
});

test('AFC batch validation keeps malformed pasted rows blocked while the other rows remain valid', () => {
  const pasted = Array.from({ length: 20 }, (_, index) => `Example ${index}\t${index === 7 ? '2027/2/30' : '2027/2/3'}\t2027/2/5\tPurpose ${index}`).join('\n');
  const parsed = afcBatch.parsePaste(pasted, name => ({ facultyId: name.replace('Example ', 'f-') }));
  const rows = afcBatch.validateRows(parsed.rows, name => ({ facultyId: name.replace('Example ', 'f-') }));
  assert.equal(rows.length, 20);
  assert.equal(rows.filter(row => row.errors.length).length, 1);
  assert.equal(rows[7].status, 'INVALID');
  assert.match(rows[7].errors.join(' '), /Invalid Start Date: "2027\/2\/30"/);
  assert.ok(rows.filter((_, index) => index !== 7).every(row => row.status === 'NEW'));
  assert.ok(rows.some(row => row.startDate === '2027-02-03' && row.endDate === '2027-02-05'));
  assert.equal(afcBatch.canSubmitRows(rows), false);
  assert.equal(afcBatch.canSubmitRows(rows, true), false);
  assert.equal(afcBatch.canSubmitRows(rows.filter((_, index) => index !== 7)), true);
  assert.equal(afcBatch.canSubmitRows([], false), false);
});

test('AFC batch validation preserves reversed-date rejection and permits the existing equal-date boundary', () => {
  const rows = afcBatch.parsePaste([
    'Example, Anne\t2027/2/5\t2027/2/3\tReversed',
    'Example, Ben\t2027/2/3\t2027/2/3\tSame day'
  ].join('\n'), name => ({ facultyId: name === 'Example, Anne' ? 'f-1' : 'f-2' })).rows;
  const validated = afcBatch.validateRows(rows, name => ({ facultyId: name === 'Example, Anne' ? 'f-1' : 'f-2' }));
  assert.ok(validated[0].errors.includes('End date is before start date.'));
  assert.deepEqual(validated[1].errors, []);
});
