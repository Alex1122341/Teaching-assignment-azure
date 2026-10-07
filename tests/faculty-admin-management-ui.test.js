'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('Faculty dashboard exposes gated edit and Active/Inactive/All views through the SQL API', () => {
  const html = read('faculty-admin.html');
  const js = read('faculty-admin.js');
  const management = read('faculty-admin-management.js');
  const client = read('paws-data-client.js');
  assert.match(html, /id="faculty-status-filter"[\s\S]*value="active"[\s\S]*value="inactive"[\s\S]*value="all"/);
  assert.match(html, /id="faculty-record-editor"/);
  assert.match(js, /refreshFacultyAdminWriteCapabilities/);
  assert.match(management, /UCVM_PAWS_DATA\.updateDashboardFaculty/);
  assert.match(management, /UCVM_PAWS_DATA\.deactivateDashboardFaculty/);
  assert.match(management, /UCVM_PAWS_DATA\.restoreDashboardFaculty/);
  assert.match(management, /dataset\.expectedProfileVersion = p\.profileVersion/);
  assert.match(management, /expectedProfileVersion: form\.dataset\.expectedProfileVersion \|\| null/);
  assert.match(js, /UCVM_PAWS_DATA\.dashboardFaculty\(\{ status: facultyStatus \}\)/);
  assert.match(js, /facultyManagement\.editAction\(row\.facultyId\)/);
  assert.match(js, /data-summary-person/);
  assert.match(management, /does not delete linked records, disable user accounts/);
  assert.match(client, /facultyAdminWriteEnabled:.*facultyAdminWriteCapability===true/);
  assert.match(client, /query\.set\('status',String\(status\)\)/);
  assert.doesNotMatch(js, /db\.collection\(/);
});
