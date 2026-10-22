'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
// BETA-R4D-10C — source-contract extraction must be line-ending agnostic.
//
// Repository sources are stored LF (git `i/lf`) but a Windows checkout with
// core.autocrlf=true materialises them as CRLF. The original faculty-swap
// contract anchors searched for the LF-only literal
// '\n }\n\n async function createRequest', which resolves on an LF checkout and
// silently fails on a CRLF one — turning a healthy runtime into a red test.
//
// These tests pin the portability of test-support/source-contract.js and prove
// the same behavioural contract is still asserted against the real source.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { functionBody } = require('../test-support/source-contract.js');

const root = repositoryPath(__dirname, '..');
const read = name => fs.readFileSync(repositoryPath(root, name), 'utf8');
const toLf = text => text.replace(/\r\n/g, '\n');
const toCrlf = text => text.replace(/\r?\n/g, '\r\n');

const FIXTURE_LF = [
  'function alpha(s){',
  ' const x=1;',
  ' return x;',
  '}',
  '',
  ' async function beta(p){',
  ' return p;',
  '}',
  ''
].join('\n');

test('the extraction helper returns identical bodies for LF and CRLF input', () => {
  const lf = functionBody(FIXTURE_LF, 'function alpha(s)');
  const crlf = functionBody(toCrlf(FIXTURE_LF), 'function alpha(s)');
  assert.ok(lf && crlf, 'both newline styles must extract');
  assert.equal(toLf(crlf.body), lf.body, 'the extracted body must be newline-style independent');
  assert.equal(lf.body.includes('beta'), false, 'the boundary must exclude the following function');
  assert.match(lf.body, /return x;/);
});

test('the extraction helper does not depend on blank-line or indentation shape', () => {
  const tight = 'function alpha(s){\n const x=1;\n}\nasync function beta(p){\n return p;\n}\n';
  const spaced = 'function alpha(s){\r\n const x=1;\r\n}\r\n\r\n    async function beta(p){\r\n return p;\r\n}\r\n';
  const a = functionBody(tight, 'function alpha(s)');
  const b = functionBody(spaced, 'function alpha(s)');
  assert.ok(a && b, 'both shapes must extract');
  assert.equal(toLf(b.body), a.body);
  assert.equal(toLf(a.body).includes('beta'), false);
  assert.equal(toLf(b.body).includes('beta'), false);
});

test('a missing signature returns null instead of a bogus slice', () => {
  assert.equal(functionBody(FIXTURE_LF, 'function doesNotExist('), null);
  assert.equal(functionBody(toCrlf(FIXTURE_LF), 'function doesNotExist('), null);
});

test('the retired LF-only literal is no longer relied upon anywhere', () => {
  const literal = '\\n }\\n\\n async function createRequest';
  for (const file of ['tests/faculty-swap-direct-session.test.js', 'tests/faculty-swap-integration.test.js']) {
    assert.equal(read(file).includes(literal), false, `${file} must not depend on the LF-only anchor`);
  }
});

test('the real approval-workflow.js contract extracts identically under both newline styles', () => {
  const source = read('approval-workflow.js');
  const fromCheckout = functionBody(source, 'function openFacultySession(s)');
  const fromLf = functionBody(toLf(source), 'function openFacultySession(s)');
  assert.ok(fromCheckout, 'the checkout must extract');
  assert.ok(fromLf, 'the LF form must extract');
  assert.equal(toLf(fromCheckout.body), fromLf.body, 'the contract body must be identical');
  assert.equal(fromCheckout.body.includes('async function createRequest'), false, 'the boundary must stop before createRequest');
});

test('the extracted body still proves the original faculty-swap source contract', () => {
  const source = read('approval-workflow.js');
  for (const view of [source, toLf(source), toCrlf(toLf(source))]) {
    const slice = functionBody(view, 'function openFacultySession(s)');
    assert.ok(slice, 'extraction must succeed for every newline style');
    const body = slice.body;
    assert.match(body, /window\.UCVM_SAFE_SWAP\?\.openSelfReplacement/);
    assert.match(body, /openSelfReplacement\(s\)/);
    assert.match(body, /own\.length/);
    assert.match(body, /const openSelfReplacement=window\.UCVM_SAFE_SWAP\?\.openSelfReplacement/);
    assert.match(body, /if\(own\.length&&typeof openSelfReplacement==='function'\)return openSelfReplacement\(s\)/);
    assert.match(body, /return openSelfSwap\(s\)/);
  }
});
