'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workflowPath = path.join(root, '.github/workflows/azure-beta-static-deploy.yml');
const readWorkflow = () => fs.readFileSync(workflowPath, 'utf8');

test('B0D static release workflow is dispatch-only with explicit release identity inputs', () => {
  const workflow = readWorkflow();
  assert.match(workflow, /workflow_dispatch:/);
  for (const input of [
    'source_run_id',
    'commit_sha',
    'expected_live_aca_revision',
    'expected_live_api_digest',
  ]) {
    const block = workflow.slice(workflow.indexOf(`      ${input}:`));
    assert.match(block, /required:\s*true/);
    assert.match(block, /type:\s*string/);
  }
  assert.match(workflow, /permissions:\s*[\s\S]*contents:\s*read/);
  assert.match(workflow, /permissions:\s*[\s\S]*actions:\s*read/);
  assert.match(workflow, /permissions:\s*[\s\S]*id-token:\s*write/);
  assert.doesNotMatch(workflow, /\npush:/);
  assert.doesNotMatch(workflow, /\npull_request:/);
});

test('B0D proves exact main and exact successful push build before artifact use', () => {
  const workflow = readWorkflow();
  assert.match(workflow, /test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(workflow, /test "\$GITHUB_SHA" = "\$COMMIT_SHA"/);
  assert.match(workflow, /git rev-parse HEAD/);
  assert.match(workflow, /git rev-parse origin\/main/);
  assert.match(workflow, /azure-beta-build\.yml/);
  assert.match(workflow, /\.event.*push/);
  assert.match(workflow, /\.head_branch.*main/);
  assert.match(workflow, /\.head_sha.*COMMIT_SHA/);
  assert.match(workflow, /\.status.*completed/);
  assert.match(workflow, /\.conclusion.*success/);
  assert.match(workflow, /azure-beta-\$\{\{ inputs\.commit_sha \}\}/);
});

test('B0D freezes repository and downloaded static/API artifacts independently', () => {
  const workflow = readWorkflow();
  assert.match(workflow, /node tools\/beta-freeze\.js/);
  assert.match(workflow, /node tools\/beta-api-freeze\.js/);
  assert.match(workflow, /beta-freeze\.js --artifact \.azure-production\/app/);
  assert.match(workflow, /beta-api-freeze\.js --artifact \.azure-production\/api/);
  for (const file of [
    '.azure-production/app/index.html',
    '.azure-production/app/staticwebapp.config.json',
    '.azure-production/api/index.js',
    '.azure-production/api/package-lock.json',
    '.azure-production/api/artifact-inventory.json',
  ]) {
    assert.match(workflow, new RegExp(`test -f ${file.replaceAll('.', '\\.')}`));
  }
});

test('B0D verifies read-only ACA identity and exact digest before static upload', () => {
  const workflow = readWorkflow();
  assert.match(workflow, /az containerapp show/);
  assert.match(workflow, /az containerapp revision list/);
  assert.match(workflow, /ACA_FQDN: paws-sql-beta-api-260926\.wonderfulglacier-ff8c7a3b\.eastus2\.azurecontainerapps\.io/);
  assert.match(workflow, /EXPECTED_REVISION_MODE: Single/);
  assert.match(workflow, /active_count.*1/);
  assert.match(workflow, /expected_live_aca_revision/);
  assert.match(workflow, /expected_live_api_digest/);
  assert.match(workflow, /expected_image="\$ACR_NAME\.azurecr\.io\/\$IMAGE_REPOSITORY@\$EXPECTED_API_DIGEST"/);
  assert.match(workflow, /Healthy/);
  assert.match(workflow, /Provisioned|Succeeded/);
  assert.doesNotMatch(workflow, /--image\s/);
  assert.doesNotMatch(workflow, /--revision-suffix/);
});

test('B0D requires SQL health and anonymous auth gates before static upload', () => {
  const workflow = readWorkflow();
  assert.match(workflow, /\/api\/health\/sql/);
  assert.match(workflow, /status.*200/);
  assert.match(workflow, /\.status.*ok/);
  assert.match(workflow, /\.service.*paws-beta-sql-runtime/);
  assert.match(workflow, /seq 1 12/);
  assert.match(workflow, /\/api\/v1\/me/);
  for (const route of [
    '/api/v1/dashboard/summary',
    '/api/v1/dashboard/faculty',
    '/api/v1/dashboard/teaching-summary',
    '/api/v1/dashboard/roles',
    '/api/v1/dashboard/doe-overview',
  ]) {
    assert.match(workflow, new RegExp(route.replaceAll('/', '\\/')));
  }
  assert.match(workflow, /401/);
  const uploadAt = workflow.indexOf('Azure/static-web-apps-deploy@');
  assert.ok(uploadAt > 0, 'static upload action must exist');
  assert.ok(workflow.indexOf('/api/health/sql') < uploadAt, 'SQL health must precede static upload');
  assert.ok(workflow.indexOf('/api/v1/me') < uploadAt, 'auth boundary must precede static upload');
});

test('B0D uploads only the tested static app and verifies exact public bytes afterward', () => {
  const workflow = readWorkflow();
  const uploadAt = workflow.indexOf('Azure/static-web-apps-deploy@');
  assert.ok(uploadAt > 0, 'static upload action must exist');
  const upload = workflow.slice(uploadAt);
  assert.match(upload, /app_location:\s*\.azure-production\/app/);
  assert.match(upload, /skip_app_build:\s*true/);
  assert.match(upload, /production_branch:\s*main/);
  assert.doesNotMatch(upload, /api_location:/);
  assert.match(upload, /b0d=|sha256/i);
  for (const file of ['asset-loader.js', 'approval-workflow.js', 'afc-workflow.js', 'paws-data-client.js']) {
    assert.match(upload, new RegExp(file.replaceAll('-', '\\-')));
  }
  assert.match(upload, /STATIC_ASSET_CONVERGENCE_BLOCKER/);
  assert.match(upload, /staticHashesPassed/);
});

test('B0D forbids API, ACA, ACR, traffic, environment, scale, and RBAC mutations', () => {
  const workflow = readWorkflow();
  for (const forbidden of [
    'docker push',
    'az acr repository delete',
    'az acr import',
    'az acr build',
    'az containerapp update',
    'az containerapp create',
    'revision activate',
    'revision deactivate',
    'traffic mutation',
    'env var mutation',
    'scale mutation',
    'RBAC mutation',
  ]) {
    assert.doesNotMatch(workflow, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `forbidden operation: ${forbidden}`);
  }
});

test('B0D writes token-free evidence and proves post-deploy API invariance', () => {
  const workflow = readWorkflow();
  assert.match(workflow, /static-deploy-evidence\.json/);
  assert.match(workflow, /static-deploy-\$\{\{ inputs\.commit_sha \}\}/);
  assert.match(workflow, /postdeploy|post-deploy/i);
  assert.match(workflow, /expected_live_aca_revision/);
  assert.match(workflow, /expected_live_api_digest/);
  assert.match(workflow, /sqlHealth/);
  assert.match(workflow, /authBoundary/);
  assert.doesNotMatch(workflow, /client-secret|password|token.*echo/i);
});
