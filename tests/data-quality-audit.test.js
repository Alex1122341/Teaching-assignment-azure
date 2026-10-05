'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const audit = fs.readFileSync(path.join(__dirname, '..', 'docs', 'sql', 'paws-beta-stabilization-readonly-audit.sql'), 'utf8');

test('PAWS data-quality audit covers identity links, canonical session references, and duplicate role identities', () => {
  for (const metric of [
    'alias_target_without_faculty_match',
    'active_faculty_without_active_user_profile',
    'profile_with_inactive_faculty',
    'course_code_not_equal_linked_course',
    'duplicate_role_assignment_identity_groups',
    'active_2026_27_rows',
    'RoleDefinitionMatch'
  ]) assert.match(audit, new RegExp(metric));
});

test('PAWS data-quality audit is aggregate-only and contains no write statements', () => {
  assert.match(audit, /COUNT_BIG/);
  assert.doesNotMatch(audit, /^\s*(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE)\b/im);
  assert.doesNotMatch(audit, /SELECT\s+\*|SELECT\s+(?:Email|FirebaseUid|Notes|Details|Purpose)\b/i);
});
