'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { applyTeachingReserve, rollingAverageCount } = require('../src/doe/doe-reserve-service');

const policy = {
  splitThreshold: 35,
  splitRatio: 0.5,
  highTeachingTraineeCeiling: 15,
  teachingFocusedTraineeCeiling: 7.5,
  rollingAverageYears: 3
};

test('reserve splits a low-target stream and caps applied supervision by remaining target', () => {
  const result = applyTeachingReserve({
    teachingTarget: 30, stream: 'clinical', rawSupervision: 20,
    assignedTeaching: 10, policy
  });
  assert.equal(result.initialTraineeReserve, 15);
  assert.equal(result.initialAssignedTeachingReserve, 15);
  assert.equal(result.appliedSupervision, 20);
  assert.equal(result.unappliedSupervision, 0);
  assert.equal(result.totalAppliedTeaching, 30);
  assert.equal(result.remainingToTarget, 0);
});

test('reserve applies teaching-focused and high-target ceilings from policy', () => {
  assert.equal(applyTeachingReserve({ teachingTarget: 50, stream: 'teaching_focused', rawSupervision: 20, assignedTeaching: 0, policy }).initialTraineeReserve, 7.5);
  assert.equal(applyTeachingReserve({ teachingTarget: 50, stream: 'clinical', rawSupervision: 20, assignedTeaching: 0, policy }).initialTraineeReserve, 15);
});

test('reserve rejects missing or invalid policy and input instead of inventing a result', () => {
  assert.throws(() => applyTeachingReserve({ teachingTarget: 50, stream: 'clinical', rawSupervision: 2, assignedTeaching: 2, policy: {} }), { code: 'RESERVE_POLICY_INVALID' });
  assert.throws(() => applyTeachingReserve({ teachingTarget: null, stream: 'clinical', rawSupervision: 2, assignedTeaching: 2, policy }), { code: 'RESERVE_INPUT_INVALID' });
});

test('rolling average uses complete available window or the current count when history is incomplete', () => {
  assert.equal(rollingAverageCount({ currentCount: 8, historyCounts: [4, 6, 8], years: 3 }), 6);
  assert.equal(rollingAverageCount({ currentCount: 8, historyCounts: [4, 6], years: 3 }), 8);
  assert.throws(() => rollingAverageCount({ currentCount: 8, historyCounts: [], years: 0 }), { code: 'RESERVE_POLICY_INVALID' });
});

test('annual MASTER mode caps supervision at the initial contract reserve', () => {
  const result = applyTeachingReserve({ teachingTarget: 10, contractTeachingTarget: 10,
    stream: 'clinical', rawSupervision: 25, assignedTeaching: 0,
    policy: { ...policy, contractReserveCap: 1 } });
  assert.equal(result.appliedSupervision, 5);
  assert.equal(result.unappliedSupervision, 20);
  assert.equal(result.remainingToTarget, 5);
});

test('annual MASTER mode keeps contract basis separate from effective target and assigned teaching', () => {
  const result = applyTeachingReserve({ teachingTarget: 7.5, contractTeachingTarget: 15,
    stream: 'clinical', rawSupervision: 24.5, assignedTeaching: 10,
    policy: { ...policy, contractReserveCap: 1 } });
  assert.equal(result.initialTraineeReserve, 7.5);
  assert.equal(result.appliedSupervision, 7.5);
  assert.equal(result.totalAppliedTeaching, 17.5);
  assert.equal(result.remainingToTarget, -10);
});

test('annual MASTER mode requires an actual contract and rejects invalid mode values', () => {
  assert.throws(() => applyTeachingReserve({ teachingTarget: 5, contractTeachingTarget: null,
    stream: 'clinical', rawSupervision: 3, assignedTeaching: 0,
    policy: { ...policy, contractReserveCap: 1 } }), { code: 'RESERVE_CONTRACT_UNAVAILABLE' });
  for (const value of [-1, 2, null, '', 'unknown']) assert.throws(() => applyTeachingReserve({
    teachingTarget: 10, contractTeachingTarget: 10, stream: 'clinical', rawSupervision: 5,
    assignedTeaching: 0, policy: { ...policy, contractReserveCap: value }
  }), { code: 'RESERVE_POLICY_INVALID' });
});

test('absent or disabled annual MASTER mode preserves flexible-transfer results', () => {
  for (const config of [policy, { ...policy, contractReserveCap: 0 }]) {
    assert.equal(applyTeachingReserve({ teachingTarget: 10, contractTeachingTarget: 5,
      stream: 'clinical', rawSupervision: 25, assignedTeaching: 0, policy: config }).appliedSupervision, 10);
  }
});
