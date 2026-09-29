'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

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
