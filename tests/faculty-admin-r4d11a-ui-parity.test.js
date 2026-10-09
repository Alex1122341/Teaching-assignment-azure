'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('faculty-admin.html', 'utf8');
const source = fs.readFileSync('faculty-admin.js', 'utf8');
const doeRenderer = fs.readFileSync('faculty-admin-doe-renderer.js', 'utf8');
const profileSource = `${source}\n${doeRenderer}`;
const client = fs.readFileSync('paws-data-client.js', 'utf8');

test('admin exposes the read-only parity tabs and gated Annual DOE Rule Book', () => {
  for (const [id, label] of [['lookup', 'Lookup'], ['summary', 'Teaching Summary'], ['roles', 'Roles & Appointments'], ['doe-overview', 'DOE Overview']]) {
    assert.match(html, new RegExp(`data-tab="${id}"`));
    const labelPattern = label.replace('&', '(?:&|&amp;)');
    assert.match(html, new RegExp(labelPattern));
  }
  for (const retired of ['Faculty Database', 'JSON import', 'CSV import', 'Change History', 'import-afc-btn', 'save-edit']) {
    assert.doesNotMatch(html, new RegExp(retired, 'i'), retired);
  }
  assert.match(html, /data-tab="doe-rules" id="doe-rules-tab"/);
  assert.match(html, /id="doe-rules-content"/);
  assert.match(html, /faculty-admin-doe-policy\.js/);
  const policy = fs.readFileSync('faculty-admin-doe-policy.js', 'utf8') + fs.readFileSync('faculty-admin-doe-rulebook.js', 'utf8');
  for (const label of ['Academic Year', 'Policy Version', 'Course Mapping', 'VISC Subjects', 'Preview &amp; Validate', 'History', 'Publish', 'Recalculate']) assert.ok(policy.includes(label), label);
  assert.match(policy, /api\.validateDoePolicyDraft/);
  assert.match(policy, /api\.previewDoePolicyImpact/);
  assert.match(policy, /api\.publishDoePolicyDraft/);
});

test('rich profile uses the API view model for DOE and year/course/session expansion', () => {
  assert.match(html, /dashboard-view-model\.js/);
  assert.match(profileSource, /groupTeachingAssignments\(/);
  const worksheet = fs.readFileSync('faculty-admin-doe-worksheet.js', 'utf8');
  assert.match(source, /doeWorksheetView\?\.loadDetail/);
  assert.match(worksheet, /api\.doeWorksheet\(/);
  assert.match(worksheet, /server-authoritative/i);
  assert.match(profileSource, /<details class="course-group"/);
  for (const label of ['DOE Summary', 'Teaching \/ Courses', 'Roles & Appointments', 'Away from Campus', 'Professional Profile']) {
    assert.match(profileSource, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(profileSource, /Joint appointment/);
  for (const field of ['Stored DOE', 'Calculated DOE', 'Effective DOE', 'DOE Status', 'Teaching Role', 'Topic', 'Room']) {
    assert.match(profileSource, new RegExp(field));
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

test('DOE summary and evidence groups are honest about VetMed-Ops and Calculator coverage', () => {
  for (const label of ['Contract / Teaching Target DOE', 'Assigned Teaching DOE', 'Role / Service DOE', 'Total Effective DOE', 'Teaching Target Remaining / Difference', 'Teaching / Courses', 'Roles & Appointments', 'DOE Rule Reference', 'Policy:', 'EFFECTIVE DOE', 'DOE Evidence', 'Teaching evidence', 'Role evidence']) {
    assert.match(profileSource, new RegExp(label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')), label);
  }
  assert.match(profileSource, /VetMed-Ops \+ Calculator evidence/);
  assert.match(profileSource, /No authoritative target recorded/);
  assert.match(profileSource, /Server-side Calculator results are shown separately/);
  assert.match(profileSource, /Stored DOE and overrides remain authoritative/);
  assert.match(source, /Teaching Review/);
  assert.match(source, /Role Review/);
  assert.match(profileSource, /DOE unavailable \/ Needs Review/);
  assert.match(profileSource, /Partial \/ Needs Review/);
});

test('11A2 aggregate faculty names navigate to cached Lookup detail without fanout', () => {
  assert.match(source, /data-summary-person/);
  assert.match(source, /function openFacultyFromAggregate\(/);
  assert.match(source, /selectedId = id/);
  assert.match(source, /selectTab\('lookup'\)/);
  assert.match(source, /detailCache/);
  assert.doesNotMatch(source, /dashboardFacultyById\(row\.facultyId\)/);
});


test('aggregate DOE UI labels effective totals and calculator provenance explicitly', () => {
  assert.match(html, /Effective DOE Total/);
  assert.doesNotMatch(html, />Recorded DOE Total</);
  assert.match(html, /deterministic DOE Calculator fallback/);
  assert.match(html, /Calculated DOE/);
  assert.match(html, /DOE Source/);
  assert.match(source, /effectiveDoeTotal/);
  assert.match(source, /teachingCalculatedCount/);
  assert.match(source, /roleCalculatedCount/);
  assert.match(source, /recorded \+ .*calculated/);
});
