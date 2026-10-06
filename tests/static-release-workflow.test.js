'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workflow = () => fs.readFileSync(path.join(root, '.github/workflows/azure-beta-static-deploy.yml'), 'utf8');
const requiredAnonymousRoutes = [
  '/api/v1/me',
  '/api/v1/sessions',
  '/api/v1/afc-requests',
  '/api/v1/afc-requests/write-capabilities',
  '/api/v1/dashboard/summary',
  '/api/v1/dashboard/faculty',
  '/api/v1/dashboard/teaching-summary',
  '/api/v1/dashboard/roles',
  '/api/v1/dashboard/doe-overview'
];

function anonymousAuthStep(text, stepName) {
  const marker = `      - name: ${stepName}`;
  const start = text.indexOf(marker);
  assert.ok(start >= 0, `missing workflow step: ${stepName}`);
  const nextStep = text.indexOf('\n      - name:', start + marker.length);
  const block = text.slice(start, nextStep < 0 ? text.length : nextStep);
  const routes = block.match(/routes=\(\s*([\s\S]*?)\s*\)/);
  assert.ok(routes, `${stepName} must declare an anonymous route list`);
  return { start, block, routes: routes[1].split(/\r?\n/).map(route => route.trim()).filter(Boolean) };
}

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
  const upload = text.indexOf('Azure/static-web-apps-deploy@');
  assert.ok(upload > 0, 'Static upload step must exist');
  const before = anonymousAuthStep(text.slice(0, upload), 'Verify anonymous auth boundary before static release');
  const after = anonymousAuthStep(text.slice(upload), 'Verify anonymous auth boundary after static release');
  assert.deepEqual(before.routes, requiredAnonymousRoutes, 'pre-upload anonymous boundary must contain exactly the full protected route set');
  assert.deepEqual(after.routes, requiredAnonymousRoutes, 'post-upload anonymous boundary must contain exactly the full protected route set');
  assert.match(before.block, /test "\$status" = "401"/, 'pre-upload routes must require HTTP 401');
  assert.match(after.block, /test "\$status" = "401"/, 'post-upload routes must require HTTP 401');
  assert.match(text, /OPTIONS/);
  assert.match(text, /Access-Control-Allow-Origin|access-control-allow-origin/);
  assert.match(text, /Access-Control-Allow-Methods|access-control-allow-methods/);
  assert.match(text, /Access-Control-Allow-Headers|access-control-allow-headers/);
  assert.match(text, /204/);
  assert.match(text, /credentials/);
  assert.ok(before.start < upload);
  assert.ok(text.indexOf('      - name: Verify anonymous auth boundary after static release') >= upload);
  assert.ok(text.indexOf('OPTIONS') < upload);
  assert.match(text.slice(upload), /test "\$status" = "401"/);
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
