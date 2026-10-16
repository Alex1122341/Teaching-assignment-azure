'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const page = fs.readFileSync(path.join(root, 'user-management.js'), 'utf8');

test('legacy User Management needs a compatibility profile and remains below SQL authority', () => {
  assert.match(page, /doc\(`users\/\$\{u\.uid\}`\)\.get\(\)/);
  assert.match(page, /UCVM\.general\(me\)/);
  assert.match(rules, /function general\(\)\{return ready\(\) && profile\(\)\.role in \['owner','adfa_general'\]/);
  assert.match(rules, /function explicitRole\(r\)\{return r in \['owner','administrator','other_office','adfa_general','adfa_regular','admin','editor','viewer','hicc','visc','faculty'\]/);
  assert.doesNotMatch(rules, /\bdeveloper\b/i);
});

test('Firestore rules do not create or expand a Developer business-authority role', () => {
  assert.doesNotMatch(rules, /function ready\(\)[^\n]*developer/i);
  assert.doesNotMatch(rules, /function admin\(\)[^\n]*developer/i);
  assert.doesNotMatch(rules, /function general\(\)[^\n]*developer/i);
  assert.doesNotMatch(rules, /function explicitRole\(r\)[^\n]*developer/i);
});
