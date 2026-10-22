'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { classifyAcrTagLookup } = require('../tools/beta-acr-tag-guard');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
// Preserve dated Azure governance assertions at their accepted historical
// source; current retirement is enforced by azure-deployment.test.js.
const historicalAzure=file=>require('node:child_process').execFileSync('git',['cat-file','blob','099d6b809f9bf3618e77bb5f5a139043b28d10e4:'+file],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});

test('ACR tag guard refuses an existing exact-SHA tag', () => {
  assert.equal(classifyAcrTagLookup({ status: 0, stderr: '' }), 'EXISTS');
});

test('ACR tag guard accepts Azure CLI exact absence response', () => {
  assert.equal(
    classifyAcrTagLookup({ status: 1, stderr: 'Error: the specified tag does not exist' }),
    'ABSENT',
  );
});

test('ACR tag guard keeps legacy manifest absence wording compatible', () => {
  assert.equal(
    classifyAcrTagLookup({ status: 1, stderr: 'MANIFEST_UNKNOWN: manifest unknown' }),
    'ABSENT',
  );
});

test('ACR tag guard fails closed for unexpected lookup errors', () => {
  assert.equal(
    classifyAcrTagLookup({ status: 1, stderr: 'ERROR: authentication failed' }),
    'UNKNOWN_ERROR',
  );
});

test('dual-runtime candidate verifier checks static and API surfaces', () => {
  const verifier = read('tools/verify-beta-candidate.js');
  assert.match(verifier, /beta-api-freeze/);
  assert.match(verifier, /static:/);
  assert.match(verifier, /api:/);
  assert.match(verifier, /staticResult\.ok&&apiResult\.ok/);
});

test('Azure Beta Build verifies repository and artifact freezes for both runtimes', () => {
  const workflow = read('.github/workflows/azure-beta-build.yml').replace(/\r\n/g, '\n');
  assert.match(workflow, /node tools\/verify-beta-candidate\.js/);
  assert.match(workflow, /node tools\/beta-freeze\.js --artifact \.azure-production\/app/);
  assert.match(workflow, /node tools\/beta-api-freeze\.js/);
  assert.match(workflow, /node tools\/beta-api-freeze\.js --artifact \.azure-production\/api/);
  assert.match(workflow, /name: azure-beta-\$\{\{ github\.sha \}\}/);
});

test('Azure Beta Build installs the locked server dependencies before server tests', () => {
  const workflow = read('.github/workflows/azure-beta-build.yml').replace(/\r\n/g, '\n');
  const rootInstall = workflow.indexOf('- run: npm ci\n');
  const serverInstall = workflow.indexOf('npm ci --prefix server');
  const swaInstall = workflow.indexOf('npm ci --prefix swa-api');
  const rootTests = workflow.indexOf('- run: npm test\n');
  const serverTests = workflow.indexOf('npm test --prefix server');
  assert.ok(rootInstall >= 0 && rootInstall < serverInstall, 'root dependencies must be installed first');
  assert.ok(serverInstall >= 0, 'server dependencies must be installed from server/package-lock.json');
  assert.ok(serverInstall < swaInstall, 'server dependencies must be installed before SWA dependencies');
  assert.ok(swaInstall < rootTests, 'all workspace dependencies must be installed before root tests');
  assert.ok(serverInstall < serverTests, 'server dependencies must be installed before server tests run');
});

test('historical ACR Publish at099d6b8 consumes the tested artifact and remains publish-only', () => {
  const workflow = historicalAzure('.github/workflows/azure-beta-acr-publish.yml');
  assert.match(workflow, /source_run_id:/);
  assert.match(workflow, /commit_sha:/);
  assert.match(workflow, /actions\/runs\/\$\{SOURCE_RUN_ID\}/);
  assert.match(workflow, /azure-beta-\$\{\{ inputs\.commit_sha \}\}/);
  assert.match(workflow, /beta-api-freeze\.js --artifact \.azure-production\/api/);
  assert.match(workflow, /docker build -f deploy\/aca\/Dockerfile/);
  assert.match(workflow, /aca-image-\$\{\{ inputs\.commit_sha \}\}/);
  assert.match(workflow, /test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(workflow, /test "\$GITHUB_SHA" = "\$COMMIT_SHA"/);
  assert.match(workflow, /az acr repository show --name "\$ACR_NAME" --image "\$IMAGE_REPOSITORY:\$COMMIT_SHA"/);
  assert.match(workflow, /beta-acr-tag-guard\.js/);
  assert.match(workflow, /SHA_TAG_ALREADY_EXISTS_REVIEW_REQUIRED/);
  assert.doesNotMatch(workflow, /contains\(@, '\$COMMIT_SHA'\)/);
  assert.ok(workflow.indexOf('Refuse an existing process tag before build or push') < workflow.indexOf('Build image from the downloaded tested API artifact'));
  assert.doesNotMatch(workflow, /node tools\/build-beta-release\.js/);
  assert.doesNotMatch(workflow, /az containerapp update/);
  assert.doesNotMatch(workflow, /contents:\s*write/);
});

test('historical ACA Deploy at099d6b8 gates exact runs, digest activation, health, and anonymous route smoke', () => {
  const workflow = historicalAzure('.github/workflows/azure-beta-aca-deploy.yml');
  assert.match(workflow, /source_run_id:/);
  assert.match(workflow, /publish_run_id:/);
  assert.match(workflow, /commit_sha:/);
  assert.match(workflow, /origin\/main/);
  assert.match(workflow, /test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(workflow, /test "\$GITHUB_SHA" = "\$COMMIT_SHA"/);
  assert.match(workflow, /azure-beta-acr-publish\.yml/);
  assert.match(workflow, /jq -r '\.head_branch' <<< "\$publish_json"\)" = "main"/);
  assert.match(workflow, /aca-image-\$\{\{ inputs\.commit_sha \}\}/);
  assert.match(workflow, /--image "\$image"/);
  assert.match(workflow, /--revision-suffix/);
  assert.match(workflow, /revision list --name "\$ACA_APP_NAME"/);
  assert.match(workflow, /active_count/);
  assert.match(workflow, /conflict/);
  assert.match(workflow, /imageDigest.*current/);
  assert.doesNotMatch(workflow, /show-manifests[\s\S]*contains\(@/);
  assert.match(workflow, /api\/health\/sql/);
  assert.match(workflow, /api\/v1\/me/);
  assert.match(workflow, /dashboard\/teaching-summary/);
  assert.match(workflow, /dashboard\/roles/);
  assert.match(workflow, /dashboard\/doe-overview/);
  assert.match(workflow, /\.status \/\/ empty/);
  assert.match(workflow, /paws-beta-sql-runtime/);
  assert.match(workflow, /authBoundaryPassed=true/);
  assert.match(workflow, /newRoutesPassed=true/);
  assert.match(workflow, /previousHealthState/);
  assert.match(workflow, /newProvisioningState/);
  assert.match(workflow, /aca-deploy-\$\{\{ inputs\.commit_sha \}\}/);
  assert.match(workflow, /ACA_RESOURCE_GROUP: rg-ucvm-teaching-lab/);
  assert.match(workflow, /EXPECTED_REVISION_MODE: Single/);
  assert.match(workflow, /if: always\(\)/);
  assert.doesNotMatch(workflow, /Azure\/static-web-apps-deploy/);
  assert.doesNotMatch(workflow, /ROLLBACK_AUTOMATED\s*=\s*true/);
});

test('retired Azure deployments cannot mutate; Firebase workflow stays gated',()=>{
  assert.equal(fs.existsSync(path.join(root,'.github/workflows/azure-beta-deploy.yml')),false);
  const aca=read('.github/workflows/azure-beta-aca-deploy.yml');
  assert.match(aca,/RETIRED_OPERATION/);
  assert.doesNotMatch(aca,/az containerapp|azure\/login|Azure\/static-web-apps-deploy/);
  const hosting=read('.github/workflows/firebase-hosting-deploy.yml');
  assert.match(hosting,/workflow_dispatch:/);
  assert.match(hosting,/source_run_id:/);
  assert.match(hosting,/commit_sha:/);
  assert.match(hosting,/azure-beta-build\.yml/);
  assert.match(hosting,/name:\s*azure-beta-\$\{\{ inputs\.commit_sha \}\}/);
  assert.match(hosting,/path:\s*\.firebase-production/);
  assert.match(hosting,/firebase deploy/);
  assert.match(hosting,/--only hosting/);
});

test('ACA Dockerfile base image remains explicitly unpinned for governance reporting', () => {
  const dockerfile = read('deploy/aca/Dockerfile');
  assert.match(dockerfile, /mcr\.microsoft\.com\/azure-functions\/node:4-node22/);
  assert.doesNotMatch(dockerfile, /@sha256:/);
});
