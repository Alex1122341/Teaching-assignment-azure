'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('dual-runtime candidate verifier checks static and API surfaces', () => {
  const verifier = read('tools/verify-beta-candidate.js');
  assert.match(verifier, /beta-api-freeze/);
  assert.match(verifier, /static:/);
  assert.match(verifier, /api:/);
  assert.match(verifier, /staticResult\.ok&&apiResult\.ok/);
});

test('Azure Beta Build verifies repository and artifact freezes for both runtimes', () => {
  const workflow = read('.github/workflows/azure-beta-build.yml');
  assert.match(workflow, /node tools\/verify-beta-candidate\.js/);
  assert.match(workflow, /node tools\/beta-freeze\.js --artifact \.azure-production\/app/);
  assert.match(workflow, /node tools\/beta-api-freeze\.js/);
  assert.match(workflow, /node tools\/beta-api-freeze\.js --artifact \.azure-production\/api/);
  assert.match(workflow, /name: azure-beta-\$\{\{ github\.sha \}\}/);
});

test('ACR Publish consumes the tested artifact and remains publish-only', () => {
  const workflow = read('.github/workflows/azure-beta-acr-publish.yml');
  assert.match(workflow, /source_run_id:/);
  assert.match(workflow, /commit_sha:/);
  assert.match(workflow, /actions\/runs\/\$\{SOURCE_RUN_ID\}/);
  assert.match(workflow, /azure-beta-\$\{\{ inputs\.commit_sha \}\}/);
  assert.match(workflow, /beta-api-freeze\.js --artifact \.azure-production\/api/);
  assert.match(workflow, /docker build -f deploy\/aca\/Dockerfile/);
  assert.match(workflow, /aca-image-\$\{\{ inputs\.commit_sha \}\}/);
  assert.doesNotMatch(workflow, /node tools\/build-beta-release\.js/);
  assert.doesNotMatch(workflow, /az containerapp update/);
  assert.doesNotMatch(workflow, /contents:\s*write/);
});

test('ACA Deploy gates exact runs, digest activation, health, and anonymous route smoke', () => {
  const workflow = read('.github/workflows/azure-beta-aca-deploy.yml');
  assert.match(workflow, /source_run_id:/);
  assert.match(workflow, /publish_run_id:/);
  assert.match(workflow, /commit_sha:/);
  assert.match(workflow, /origin\/main/);
  assert.match(workflow, /azure-beta-acr-publish\.yml/);
  assert.match(workflow, /aca-image-\$\{\{ inputs\.commit_sha \}\}/);
  assert.match(workflow, /--image "\$image"/);
  assert.match(workflow, /--revision-suffix/);
  assert.match(workflow, /api\/health\/sql/);
  assert.match(workflow, /api\/v1\/me/);
  assert.match(workflow, /dashboard\/teaching-summary/);
  assert.match(workflow, /dashboard\/roles/);
  assert.match(workflow, /dashboard\/doe-overview/);
  assert.match(workflow, /aca-deploy-\$\{\{ inputs\.commit_sha \}\}/);
  assert.match(workflow, /ACA_RESOURCE_GROUP: rg-ucvm-teaching-lab/);
  assert.match(workflow, /EXPECTED_REVISION_MODE: Single/);
  assert.match(workflow, /if: always\(\)/);
  assert.doesNotMatch(workflow, /Azure\/static-web-apps-deploy/);
  assert.doesNotMatch(workflow, /ROLLBACK_AUTOMATED\s*=\s*true/);
});

test('Static Deploy requires successful ACA evidence before upload', () => {
  const workflow = read('.github/workflows/azure-beta-deploy.yml');
  const uploadAt = workflow.indexOf('Azure/static-web-apps-deploy');
  assert.ok(uploadAt > 0);
  const before = workflow.slice(0, uploadAt);
  assert.match(workflow, /aca_deploy_run_id:/);
  assert.match(before, /azure-beta-aca-deploy\.yml/);
  assert.match(before, /aca-deploy-\$\{\{ inputs\.commit_sha \}\}/);
  assert.match(before, /sqlHealthPassed/);
  assert.match(before, /authBoundaryPassed/);
  assert.match(before, /newRoutesPassed/);
  assert.match(before, /beta-api-freeze\.js --artifact \.azure-production\/api/);
});

test('ACA Dockerfile base image remains explicitly unpinned for governance reporting', () => {
  const dockerfile = read('deploy/aca/Dockerfile');
  assert.match(dockerfile, /mcr\.microsoft\.com\/azure-functions\/node:4-node22/);
  assert.doesNotMatch(dockerfile, /@sha256:/);
});
