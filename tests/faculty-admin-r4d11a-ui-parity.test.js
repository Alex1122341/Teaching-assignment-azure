'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('faculty-admin.html', 'utf8');
const source = fs.readFileSync('faculty-admin.js', 'utf8');
const client = fs.readFileSync('paws-data-client.js', 'utf8');

test('admin exposes only the four read-only parity tabs and no legacy mutation surfaces', () => {
  for (const [id, label] of [['lookup', 'Lookup'], ['summary', 'Teaching Summary'], ['roles', 'Roles & Appointments'], ['doe-overview', 'DOE Overview']]) {
    assert.match(html, new RegExp(`data-tab="${id}"`));
    const labelPattern = label.replace('&', '(?:&|&amp;)');
    assert.match(html, new RegExp(labelPattern));
  }
  for (const retired of ['Faculty Database', 'JSON import', 'CSV import', 'DOE Rule Book', 'Change History', 'import-afc-btn', 'save-edit']) {
    assert.doesNotMatch(html, new RegExp(retired, 'i'), retired);
  }
});

test('rich profile uses the API view model for DOE and year/course/session expansion', () => {
  assert.match(html, /dashboard-view-model\.js/);
  assert.match(source, /groupTeachingAssignments\(/);
  assert.match(source, /summarizeDoe\(/);
  assert.match(source, /<details class="course-group"/);
  for (const label of ['DOE Summary', 'Teaching \/ Courses', 'Roles & Appointments', 'Away from Campus', 'Professional Profile']) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(source, /Joint appointment/);
  for (const field of ['DOE Rate', 'DOE Quantity', 'DOE Unit', 'DOE Credit', 'DOE Status', 'Teaching Role', 'Topic', 'Room']) {
    assert.match(source, new RegExp(field));
  }
});

test('aggregate tabs are lazy and never fan out detail requests', () => {
  assert.match(source, /dashboardTeachingSummary\(\)/);
  assert.match(source, /dashboardRoles\(\)/);
  assert.match(source, /dashboardDoeOverview\(\)/);
  assert.match(source, /detailCache/);
  assert.doesNotMatch(source, /faculty\.map\([^)]*dashboardFacultyById/);
  assert.match(client, /dashboardTeachingSummary/);
  assert.match(client, /dashboardRoles/);
  assert.match(client, /dashboardDoeOverview/);
});

test('Dashboard runtime remains zero-Firestore and self-service stays scoped', () => {
  assert.doesNotMatch(html, /firebase-firestore|faculty-access\.js/);
  assert.doesNotMatch(source, /firebase\.firestore|db\.collection|db\.doc|FieldValue|UCVM\.(?:ready|watch|logs)/);
  assert.doesNotMatch(client, /firestore|\.collection\(|\.doc\(/i);
  assert.match(source, /dashboardFacultyById\(facultyId\)/);
  assert.match(source, /body\.faculty-self-mode/);
});

test('11A2 worksheet cards and evidence groups are honest about Azure coverage', () => {
  for (const label of ['Recorded Assigned DOE', 'Scheduled Teaching', 'Roles / Appointments', 'Applied Supervision', 'Effective Target', 'Remaining / Over', 'Policy Version', 'Reserve', 'AVAILABLE NOW', 'NOT YET AVAILABLE', 'DOE Evidence', 'Teaching evidence', 'Role evidence']) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')), label);
  }
  assert.match(source, /Azure recorded evidence/);
  assert.match(source, /Not available in Azure Beta/);
  assert.match(source, /no rate × quantity/);
  assert.match(source, /DOE unavailable \/ Needs Review/);
  assert.match(source, /Partial \/ Needs Review/);
});

test('11A2 aggregate faculty names navigate to cached Lookup detail without fanout', () => {
  assert.match(source, /data-summary-person/);
  assert.match(source, /function openFacultyFromAggregate\(/);
  assert.match(source, /selectedId = id/);
  assert.match(source, /selectTab\('lookup'\)/);
  assert.match(source, /detailCache/);
  assert.doesNotMatch(source, /dashboardFacultyById\(row\.facultyId\)/);
});

