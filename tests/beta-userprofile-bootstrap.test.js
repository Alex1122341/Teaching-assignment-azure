'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function manifest() {
  return {
    profiles: [
      { firebaseUid: 'hicc1', email: 'h1@example.test', displayName: 'HICC 1', baseRole: 'hicc', facultyId: '11111111-1111-4111-8111-111111111111', active: true, mustChangePassword: false, officeName: null, bootstrapClass: 'hicc_faculty' },
      { firebaseUid: 'dvm', email: 'd@example.test', displayName: 'DVM', baseRole: 'viewer', facultyId: null, active: true, mustChangePassword: false, officeName: 'DVM', bootstrapClass: 'dvm_non_faculty' },
      { firebaseUid: 'lab', email: 'l@example.test', displayName: 'LAB', baseRole: 'viewer', facultyId: null, active: true, mustChangePassword: false, officeName: 'LAB', bootstrapClass: 'lab_non_faculty' },
      { firebaseUid: 'a1', email: 'a1@example.test', displayName: 'A1', baseRole: 'adfa_general', facultyId: null, active: true, mustChangePassword: false, officeName: null, bootstrapClass: 'global_admin' },
      { firebaseUid: 'a2', email: 'a2@example.test', displayName: 'A2', baseRole: 'adfa_general', facultyId: null, active: true, mustChangePassword: false, officeName: null, bootstrapClass: 'global_admin' },
      { firebaseUid: 'a3', email: 'a3@example.test', displayName: 'A3', baseRole: 'administrator', facultyId: null, active: true, mustChangePassword: false, officeName: null, bootstrapClass: 'global_admin' }
    ],
    exclusions: [{ firebaseUid: 'hicc2', label: 'HICC-2', reason: 'HUMAN_CONFIRMED_DELETE_ACCOUNT' }]
  };
}

test('bootstrap preview validates the deterministic six-row plan and never applies it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paws-beta-bootstrap-'));
  const input = path.join(dir, 'manifest.json');
  const output = path.join(dir, 'apply.sql');
  fs.writeFileSync(input, JSON.stringify(manifest()));
  const run = spawnSync(process.execPath, ['tools/preview_beta_userprofile_bootstrap.js', '--manifest', input, '--private-sql-output', output], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const summary = JSON.parse(run.stdout);
  assert.equal(summary.writesPerformed, false);
  assert.equal(summary.profileRows, 6);
  assert.equal(summary.excludedRows, 1);
  const sql = fs.readFileSync(output, 'utf8');
  assert.equal((sql.match(/INSERT INTO paws\.UserProfile/g) || []).length, 6);
  assert.doesNotMatch(sql, /hicc2/);
});

test('bootstrap preview rejects a non-Faculty viewer linked to FacultyId', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paws-beta-bootstrap-'));
  const input = path.join(dir, 'manifest.json');
  const bad = manifest();
  bad.profiles[1].facultyId = '22222222-2222-4222-8222-222222222222';
  fs.writeFileSync(input, JSON.stringify(bad));
  const run = spawnSync(process.execPath, ['tools/preview_beta_userprofile_bootstrap.js', '--manifest', input], { encoding: 'utf8' });
  assert.notEqual(run.status, 0);
});
