'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assessFirestoreTestingReadiness, REQUIRED, SOURCE_IMPLEMENTED } = require('../tools/testing/firestore-release-readiness');

test('Firestore release remains blocked until all PAWS workflows and UAT evidence exist', () => {
  const report = assessFirestoreTestingReadiness();
  assert.equal(report.ready,false);
  assert.ok(report.blockers.includes('FIRESTORE_BACKEND_NOT_FEATURE_COMPLETE'));
  assert.ok(report.blockers.includes('SAME_SITE_CONFIG_UNPROVISIONED'));
  assert.ok(report.blockers.includes('LIVE_ADMIN_BROWSER_ISOLATION_AND_PRIVACY_UAT_MISSING'));
  assert.equal(report.fixtures.paws_testing_faculty,31);
  assert.ok(report.fixtures.paws_testing_sessions>=300);
  assert.ok(report.requiredRoutes > report.implementedRoutes);
  for (const group of Object.values(REQUIRED)) for (const route of group) assert.ok(/^(GET|POST|PATCH|PUT|DELETE) \/api\/v1\//.test(route));
});

test('read-only Testing backend cannot be mistaken for completed DOE, AFC, TA or writes', () => {
  for (const group of ['doe','afc','teachingAssignments']) {
    const found = assessFirestoreTestingReadiness().groups.find(x=>x.name===group);
    assert.ok(found.missing.length>0,group);
  }
  assert.equal(SOURCE_IMPLEMENTED.has('PATCH /api/v1/sessions/:id'),true, 'Testing-only source route is gated off until the API host explicitly enables writes');
  assert.equal(SOURCE_IMPLEMENTED.has('GET /api/v1/dashboard/doe-overview'),false);
});

test('even a completed endpoint list requires live admin, isolation, Auth-domain and privacy evidence', () => {
  const report = assessFirestoreTestingReadiness({ liveEvidence: {
    browserUatPassed:true,adminAccountVerified:true,productionIsolationPassed:false,
    privacyRulesPassed:true,firestoreBackendDeployed:true,sameSiteAuthDomainVerified:true
  } });
  assert.equal(report.ready,false);
  assert.ok(report.blockers.includes('LIVE_ADMIN_BROWSER_ISOLATION_AND_PRIVACY_UAT_MISSING'));
});
