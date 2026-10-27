'use strict';
// Testing runs every root test except explicitly documented immutable Production
// commit/delta assertions. Those assertions run unchanged against Beta main in CI.
// This runner never suppresses newly failing tests or edits the Production freeze.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const register = require('./production-only-assertions.json');
const metacharacters = new Set(['\\', '.', '^', '$', '*', '+', '?', '(', ')', '[', ']', '{', '}', '|']);
const escapeRegex = value => [...value].map(char => metacharacters.has(char) ? '\\' + char : char).join('');
if (!Array.isArray(register.assertions) || register.assertions.length !== 46) {
  throw Error('Expected exactly 46 independently identified historical Production-only assertions');
}
const files = fs.readdirSync(path.join(root, 'tests'))
  .filter(name => name.endsWith('.test.js'))
  .sort()
  .map(name => path.join('tests', name));
const names = new Set();
for (const assertion of register.assertions) {
  if (!files.includes(assertion.file) || !assertion.name || names.has(assertion.name)) {
    throw Error('Invalid or ambiguous legacy Production assertion: ' + JSON.stringify(assertion));
  }
  const contents = fs.readFileSync(path.join(root, assertion.file), 'utf8');
  if (!contents.includes(assertion.name)) {
    throw Error('Historical assertion changed or disappeared; reassess the Testing exception: ' + assertion.file + ': ' + assertion.name);
  }
  names.add(assertion.name);
}
const pattern = '^(?:' + [...names].map(escapeRegex).join('|') + ')$';
console.log('PAWS_TESTING_ROOT_SUITE: ' + files.length + ' test files; ' + names.size
  + ' exact immutable Production-only assertions checked separately on main. All other tests execute.');
const result = spawnSync(process.execPath,
  ['--test', '--test-skip-pattern=' + pattern, ...files],
  { cwd: root, stdio: 'inherit', env: process.env, windowsHide: true });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
