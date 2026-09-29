'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createSqlTeachingAssignmentRepository } = require('../foundation/sql-teaching-assignment-repository');

function capture() {
  let seen = [];
  const query = async (sql, params) => { seen.push({sql, params}); return []; };
  return {repository: createSqlTeachingAssignmentRepository({query}), seen};
}

test('repository exposes only read methods and parameterizes actor scope', async () => {
  const {repository, seen} = capture();
  await repository.getActorResponsibilities({facultyId: 'faculty-1', academicYear: '2026-27', asOfDate: '2026-09-08'});
  assert.equal(seen.length, 1);
  assert.match(seen[0].sql, /FROM paws\.TeachingResponsibility/);
  assert.match(seen[0].sql, /@facultyId/);
  assert.doesNotMatch(seen[0].sql, /faculty-1/);
  assert.deepEqual(seen[0].params, {facultyId: 'faculty-1', academicYear: '2026-27', asOfDate: '2026-09-08'});
});

test('repository methods read only paws authority objects and never staging', async () => {
  const {repository, seen} = capture();
  await repository.getResponsibility('r1');
  await repository.getResponsibilityScopes('r1');
  await repository.getResponsibilityAssignees('r1', '2026-27');
  await repository.getGroupsForResponsibility('r1');
  await repository.getPackage('2026-27', 'g1', 'r1');
  await repository.listPackagesForActor('faculty-1', '2026-27', '2026-09-08');
  await repository.getWorkingSessionOwnership('s1');
  assert.equal(seen.length, 7);
  for (const row of seen) {
    assert.doesNotMatch(row.sql, /\b(INSERT|UPDATE|DELETE|MERGE|EXEC|CREATE|ALTER|DROP)\b/i);
    assert.doesNotMatch(row.sql, /staging\./i);
    assert.doesNotMatch(row.sql, /\b(FirebaseUid|BaseRole)\b/i);
    assert.match(row.sql, /paws\./);
  }
});

test('repository stays dormant and is not mounted into API runtime', () => {
  const repoSource = fs.readFileSync(path.join(__dirname, '../foundation/sql-teaching-assignment-repository.js'), 'utf8');
  assert.doesNotMatch(repoSource, /\b(INSERT|UPDATE|DELETE|MERGE|EXEC|CREATE|ALTER|DROP)\b/i);
  const serverSource = fs.readFileSync(path.join(__dirname, '../src/runtime/swa-sql-runtime.js'), 'utf8');
  assert.doesNotMatch(serverSource, /sql-teaching-assignment-repository/);
  assert.doesNotMatch(repoSource, /staging\./i);
});
