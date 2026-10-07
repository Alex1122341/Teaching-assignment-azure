'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const migration = fs.readFileSync(path.join(root, 'database/azure-sql/023_faculty_admin_write.sql'), 'utf8');
const rollback = fs.readFileSync(path.join(root, 'database/azure-sql/rollback_023_faculty_admin_write.sql'), 'utf8');

test('Faculty write migration is narrowly gated, audited, concurrency checked, and reversible without business-data deletion', () => {
  assert.match(migration, /:ON ERROR EXIT/);
  assert.match(migration, /DB_NAME\(\) <> N'VetMed-Ops'/);
  for (const procedure of ['UpdateFaculty', 'DeactivateFaculty', 'RestoreFaculty']) {
    assert.match(migration, new RegExp(`CREATE OR ALTER PROCEDURE paws_api\\.${procedure}`));
    assert.match(migration, new RegExp(`GRANT EXECUTE ON OBJECT::paws_api\\.${procedure}`));
  }
  assert.match(migration, /@Current<>@Expected/);
  assert.match(migration, /ADD ProfileVersion rowversion NOT NULL/);
  assert.match(migration, /@ExpectedProfileVersionBytes binary\(8\)/);
  assert.match(migration, /@Fte decimal\(5,4\)/);
  assert.match(migration, /@PriorYearsExperience decimal\(5,2\)/);
  assert.match(migration, /NOT IN \(N'faculty',N'other_pool',N'sessional_pool',N'vacancy'\)/);
  assert.match(migration, /WITH \(UPDLOCK,HOLDLOCK\)/);
  assert.match(migration, /INSERT paws\.AuditEvent/);
  assert.match(migration, /OPENJSON\(@BeforeJson\)/);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\s+paws\./i);
  assert.doesNotMatch(migration, /GRANT\s+(?:INSERT|UPDATE|DELETE)\s+ON\s+OBJECT::paws\./i);
  assert.match(migration, /paws_runtime_faculty_admin_write/);
  assert.match(rollback, /:ON ERROR EXIT/);
  assert.match(rollback, /DROP PROCEDURE paws_api\.UpdateFaculty/);
  assert.match(rollback, /DROP ROLE \[paws_runtime_faculty_admin_write\]/);
  assert.doesNotMatch(rollback, /\bDELETE\s+FROM\s+paws\./i);
  assert.doesNotMatch(rollback, /\bTRUNCATE\s+TABLE\b/i);
});

test('legacy Faculty dashboard enhancement contains no browser Firestore write path', () => {
  const legacy = fs.readFileSync(path.join(root, 'faculty-admin-enhancements.js'), 'utf8');
  assert.doesNotMatch(legacy, /db\.collection\(['"](?:faculty|faculty_change_log)['"]\)/);
  assert.doesNotMatch(legacy, /firebase\.firestore\(\)\.FieldValue/);
  assert.match(legacy, /All Faculty edits must use the guarded SQL API/);
});
