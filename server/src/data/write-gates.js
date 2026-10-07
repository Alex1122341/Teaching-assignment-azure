'use strict';

const WRITE_DISABLED = Object.freeze({
  status: 503,
  body: { error: { code: 'WRITE_DISABLED', message: 'This write operation is currently disabled.' } }
});

function createWriteGates(env = {}) {
  return Object.freeze({
    afcSingle: env.PAWS_AFC_SINGLE_WRITE_ENABLED === 'true',
    afcBatch: env.PAWS_AFC_BATCH_WRITE_ENABLED === 'true',
    sessionEdit: env.PAWS_SESSION_EDIT_WRITE_ENABLED === 'true',
    sessionCreate: env.PAWS_SESSION_CREATE_WRITE_ENABLED === 'true',
    afcRequest: env.PAWS_AFC_REQUEST_WRITE_ENABLED === 'true',
    afcDecision: env.PAWS_AFC_DECISION_WRITE_ENABLED === 'true',
    afcArtifact: env.PAWS_AFC_ARTIFACT_WRITE_ENABLED === 'true',
    taDraft: env.PAWS_TA_DRAFT_WRITE_ENABLED === 'true',
    taReview: env.PAWS_TA_REVIEW_WRITE_ENABLED === 'true',
    taFinal: env.PAWS_TA_FINAL_WRITE_ENABLED === 'true',
    taPublish: env.PAWS_TA_PUBLISH_WRITE_ENABLED === 'true',
    facultyAdmin: env.PAWS_FACULTY_ADMIN_WRITE_ENABLED === 'true'
  });
}

function writeDisabled() {
  return { status: WRITE_DISABLED.status, body: { error: { ...WRITE_DISABLED.body.error } } };
}

module.exports = { createWriteGates, writeDisabled };
