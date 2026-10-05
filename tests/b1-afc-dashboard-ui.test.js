'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const afcBatch = require('../faculty-admin-afc-batch');

const html = fs.readFileSync('faculty-admin.html', 'utf8');
const js = fs.readFileSync('faculty-admin.js', 'utf8');

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
  assert.match(js, /UCVM_PAWS_DATA\.createDashboardAfcRecord\(/);
  assert.match(js, /Saving…/);
  assert.match(js, /facultyId/);
  assert.match(js, /afcSubmitInFlight/);
  assert.match(js, /reasonCode/);
  assert.doesNotMatch(js, /db\.collection\(/);
});

test('AFC multi-input UI supports Excel paste, canonical searchable Faculty, row review, and batch submit', () => {
  assert.match(html, /id="afc-batch-paste"/);
  assert.match(html, /id="afc-faculty-options"/);
  assert.match(html, /id="afc-batch-rows"/);
  assert.match(html, /id="afc-batch-validate"/);
  assert.match(html, /id="afc-batch-clear"/);
  assert.match(html, /Faculty Member.*Start.*End.*Purpose/);
  assert.ok(html.indexOf('faculty-admin-afc-batch.js') < html.indexOf('faculty-admin.js'), 'batch helper loads before the dashboard controller');
  assert.match(js, /UCVM_PAWS_DATA\.createDashboardAfcManualBatch\(/);
  assert.match(js, /A batch can contain at most 20 rows/);
  assert.match(js, /function reviewAfcBatch/);
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
