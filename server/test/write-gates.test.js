'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createWriteGates } = require('../src/data/write-gates');

test('write gate environment is per-domain and fail-closed for missing, false, and non-exact values', () => {
  assert.deepEqual(createWriteGates({}), {
    afcSingle: false, afcBatch: false, sessionEdit: false,
    afcRequest: false, afcDecision: false, afcArtifact: false
  });
  assert.deepEqual(createWriteGates({
    PAWS_AFC_SINGLE_WRITE_ENABLED: 'true',
    PAWS_AFC_BATCH_WRITE_ENABLED: 'false',
    PAWS_SESSION_EDIT_WRITE_ENABLED: 'TRUE',
    PAWS_UNRELATED_WRITE_ENABLED: 'true'
  }), {
    afcSingle: true, afcBatch: false, sessionEdit: false,
    afcRequest: false, afcDecision: false, afcArtifact: false
  });
});
