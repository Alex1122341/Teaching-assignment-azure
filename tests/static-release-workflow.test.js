'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workflow = () => fs.readFileSync(path.join(root, '.github/workflows/azure-beta-static-deploy.yml'), 'utf8');

test('static release remains dispatch-only and accepts only source run and exact commit identity', () => {
  const text = workflow();
  assert.match(text, /workflow_dispatch:/);
  for (const input of ['source_run_id', 'commit_sha']) {
    const block = text.slice(text.indexOf(`      ${input}:`));
    assert.match(block, /required:\s*true/);
    assert.match(block, /type:\s*string/);
  }
  assert.doesNotMatch(text, /expected_live_aca_revision|expected_live_api_digest/);
  assert.match(text, /permissions:\s*[\s\S]*contents:\s*read/);
  assert.match(text, /permissions:\s*[\s\S]*actions:\s*read/);
  assert.doesNotMatch(text, /id-token:\s*write/);
  assert.doesNotMatch(text, /\npush:/);
  assert.doesNotMatch(text, /\npull_request:/);
  assert.doesNotMatch(text, /\n    environment:\s*\n/);
});

test('static release verifies exact main and successful exact-main build artifact before use', () => {
  const text = workflow();
  assert.match(text, /test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(text, /test "\$GITHUB_SHA" = "\$COMMIT_SHA"/);
  assert.match(text, /git rev-parse HEAD/);
  assert.match(text, /git rev-parse origin\/main/);
  assert.match(text, /azure-beta-build\.yml/);
  assert.match(text, /\.event.*push/);
  assert.match(text, /\.head_branch.*main/);
  assert.match(text, /\.head_sha.*COMMIT_SHA/);
  assert.match(text, /\.status.*completed/);
  assert.match(text, /\.conclusion.*success/);
  assert.match(text, /azure-beta-\$\{\{ inputs\.commit_sha \}\}/);
  assert.match(text, /node tools\/beta-freeze\.js/);
  assert.match(text, /node tools\/beta-api-freeze\.js/);
  assert.match(text, /beta-freeze\.js --artifact \.azure-production\/app/);
  assert.match(text, /beta-api-freeze\.js --artifact \.azure-production\/api/);
});

test('static release derives and validates the exact HTTPS University API origin from repository input', () => {
  const text = workflow();
  assert.match(text, /paws-api-origin\.js/);
  assert.match(text, /https:/);
  assert.match(text, /API_ORIGIN/);
  assert.match(text, /no path|pathname/);
  assert.doesNotMatch(text, /ACA_FQDN|ACA_APP_NAME|az containerapp|expected_live_aca/);
});

test('SQL health and runtime attestation are verified before and after static upload', () => {
  const text = workflow();
  assert.match(text, /api\/health\/sql/);
  assert.match(text, /api\/health\/runtime/);
  assert.match(text, /runtimeTrustAnchor/);
  assert.match(text, /releaseSha/);
  assert.match(text, /TRUST_ANCHOR/);
  assert.match(text, /afcSingle/);
  assert.match(text, /afcBatch/);
  assert.match(text, /sessionEdit/);
  assert.match(text, /afcRequest/);
  assert.match(text, /afcDecision/);
  assert.match(text, /afcArtifact/);
  assert.match(text, /false/);
  assert.match(text, /predeploy_sql/);
  assert.match(text, /postdeploy_sql/);
  assert.match(text, /predeploy_runtime/);
  assert.match(text, /postdeploy_runtime/);
  const upload = text.indexOf('Azure/static-web-apps-deploy@');
  for (const marker of ['/api/health/sql', '/api/health/runtime']) assert.ok(text.indexOf(marker) < upload, `${marker} must be checked before upload`);
  assert.match(text.slice(upload), /api\/health\/runtime/);
  assert.match(text.slice(upload), /api\/health\/sql/);
});

test('static release checks anonymous auth and exact CORS preflight before and after upload', () => {
  const text = workflow();
  for (const route of ['/api/v1/me', '/api/v1/dashboard/summary', '/api/v1/dashboard/faculty', '/api/v1/dashboard/teaching-summary', '/api/v1/dashboard/roles', '/api/v1/dashboard/doe-overview']) {
    assert.match(text, new RegExp(route.replaceAll('/', '\\/')));
  }
  assert.match(text, /401/);
  assert.match(text, /OPTIONS/);
  assert.match(text, /Access-Control-Allow-Origin|access-control-allow-origin/);
  assert.match(text, /Access-Control-Allow-Methods|access-control-allow-methods/);
  assert.match(text, /Access-Control-Allow-Headers|access-control-allow-headers/);
  assert.match(text, /204/);
  assert.match(text, /credentials/);
  const upload = text.indexOf('Azure/static-web-apps-deploy@');
  assert.ok(text.indexOf('/api/v1/me') < upload);
  assert.ok(text.indexOf('OPTIONS') < upload);
  assert.match(text.slice(upload), /401/);
  assert.match(text.slice(upload), /204/);
});

test('static release uploads the exact tested artifact only and checks all public convergence bytes', () => {
  const text = workflow();
  const uploadAt = text.indexOf('Azure/static-web-apps-deploy@');
  assert.ok(uploadAt > 0);
  const upload = text.slice(uploadAt);
  assert.match(upload, /app_location:\s*\.azure-production\/app/);
  assert.match(upload, /skip_app_build:\s*true/);
  assert.match(upload, /production_branch:\s*main/);
  assert.doesNotMatch(upload, /api_location:/);
  for (const file of ['index.html', 'asset-loader.js', 'paws-api-origin.js', 'paws-data-client.js', 'afc-workflow.js', 'afc-workflow-sql.js', 'approval-workflow.js']) {
    assert.match(text, new RegExp(file.replaceAll('.', '\\.')));
  }
  assert.match(text, /STATIC_ASSET_CONVERGENCE_BLOCKER/);
});

test('static release evidence is nonsecret and contains release authority and pre/post acceptance results', () => {
  const text = workflow();
  assert.match(text, /static-deploy-evidence\.json/);
  assert.match(text, /static-deploy-\$\{\{ inputs\.commit_sha \}\}/);
  for (const field of ['repository', 'commitSha', 'sourceRunId', 'siteUrl', 'apiOrigin', 'runtimeTrustAnchor', 'releaseSha', 'writeGates', 'sqlHealthPre', 'sqlHealthPost', 'authBoundaryPre', 'authBoundaryPost', 'corsPre', 'corsPost', 'staticHashesPassed', 'deployedAtUtc']) {
    assert.match(text, new RegExp(field));
  }
  assert.doesNotMatch(text, /echo\s+\$\{\{\s*secrets\.|printenv|(^|\n)\s*env\s*$/i);
});
