'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'timetable.js'), 'utf8');

test('SQL existing-session edit capability does not expose Firestore create or multi-edit controls', () => {
  assert.match(source, /const sessionWritesEnabled\s*=\s*Boolean\(window\.UCVM_PAWS_DATA\s*&&\s*window\.UCVM_PAWS_DATA\.sessionWritesEnabled\(\)\)/);
  assert.match(source, /\$\('add-session-btn'\)\.classList\.toggle\('hidden',\s*!canEdit\(\)\s*\|\|\s*!sessionWritesEnabled\)/);
  assert.match(source, /\$\('bulk-add-session-btn'\)\.classList\.toggle\('hidden',\s*!UCVM\.admin\(currentUser\)\s*\|\|\s*!sessionWritesEnabled\)/);
  assert.match(source, /\$\('selection-controls'\)\.classList\.toggle\('hidden',\s*!canEdit\(\)\s*\|\|\s*!sessionWritesEnabled\)/);
  assert.match(source, /sessionEditEnabled\?\.\(\)/);
});

test('unsupported Firestore faculty reassignment stays hidden while SQL session editing is available', () => {
  assert.match(source, /const swap\s*=\s*!s\.isCcc\s*&&\s*isAdmin\(\)\s*&&\s*window\.UCVM_PAWS_DATA\?\.sessionWritesEnabled\?\.\(\)/);
  assert.match(source, /This timetable action is not available on the current VetMed-Ops API\./);
  assert.match(source, /Only session fields are editable\. Faculty assignments and DOE values remain unchanged\./);
});
