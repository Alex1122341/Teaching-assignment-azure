'use strict';

const WRITE_DISABLED = Object.freeze({
  status: 503,
  body: { error: { code: 'WRITE_DISABLED', message: 'This write operation is currently disabled.' } }
});

// Each business write gate and the environment variable that opens it. A gate is open only when its
// variable is exactly 'true'. Production and Testing set these independently on their own API hosts.
const GATE_ENV = Object.freeze({
  schedulingTaskReview: 'PAWS_SCHEDULING_TASK_REVIEW_ENABLED',
  calendarActivityStage: 'PAWS_CALENDAR_ACTIVITY_STAGE_ENABLED',
  calendarActivityCommit: 'PAWS_CALENDAR_ACTIVITY_COMMIT_ENABLED',
  calendarActivityTime: 'PAWS_CALENDAR_ACTIVITY_TIME_ENABLED',
  swapRequest: 'PAWS_SWAP_REQUEST_WRITE_ENABLED',
  swapDecision: 'PAWS_SWAP_DECISION_WRITE_ENABLED',
  swapApply: 'PAWS_SWAP_APPLY_WRITE_ENABLED',
  afcSingle: 'PAWS_AFC_SINGLE_WRITE_ENABLED',
  afcBatch: 'PAWS_AFC_BATCH_WRITE_ENABLED',
  afcCancel: 'PAWS_AFC_CANCEL_WRITE_ENABLED',
  sessionEdit: 'PAWS_SESSION_EDIT_WRITE_ENABLED',
  sessionCreate: 'PAWS_SESSION_CREATE_WRITE_ENABLED',
  afcRequest: 'PAWS_AFC_REQUEST_WRITE_ENABLED',
  afcDecision: 'PAWS_AFC_DECISION_WRITE_ENABLED',
  afcArtifact: 'PAWS_AFC_ARTIFACT_WRITE_ENABLED',
  afcFormUpload: 'PAWS_AFC_FORM_UPLOAD_ENABLED',
  cccReplaceStage: 'PAWS_CCC_REPLACE_STAGE_ENABLED',
  cccReplaceCommit: 'PAWS_CCC_REPLACE_COMMIT_ENABLED',
  taDraft: 'PAWS_TA_DRAFT_WRITE_ENABLED',
  taReview: 'PAWS_TA_REVIEW_WRITE_ENABLED',
  taFinal: 'PAWS_TA_FINAL_WRITE_ENABLED',
  taPublish: 'PAWS_TA_PUBLISH_WRITE_ENABLED',
  facultyAdmin: 'PAWS_FACULTY_ADMIN_WRITE_ENABLED',
  doeAdmin: 'PAWS_DOE_ADMIN_WRITE_ENABLED',
  doeManualAssignment: 'PAWS_DOE_MANUAL_ASSIGNMENT_WRITE_ENABLED',
  doePolicyPublish: 'PAWS_DOE_POLICY_PUBLISH_ENABLED',
  doeRecalculate: 'PAWS_DOE_RECALC_WRITE_ENABLED'
});

function createWriteGates(env = {}) {
  return Object.freeze(Object.fromEntries(Object.entries(GATE_ENV).map(([gate, name]) => [gate, env[name] === 'true'])));
}

function writeDisabled() {
  return { status: WRITE_DISABLED.status, body: { error: { ...WRITE_DISABLED.body.error } } };
}

module.exports = { createWriteGates, writeDisabled, GATE_ENV };
