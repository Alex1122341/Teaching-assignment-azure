'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('Azure Static Web Apps routing config is committed at repository root',()=>{
  const config=JSON.parse(read('staticwebapp.config.json'));
  assert.deepEqual(config.routes,[{
    route:'/faculty-dashboard.html',
    redirect:'/index.html',
    statusCode:301
  }]);
});

test('manual Azure fallback copies the canonical config instead of generating a second copy',()=>{
  const script=read('tools/deploy_azure_static_web.ps1');
  assert.match(script,/Join-Path \$SitePath 'staticwebapp\.config\.json'/);
  assert.match(script,/Copy-Item .*staticwebapp\.config\.json/);
  assert.doesNotMatch(script,/\$azureConfig\s*=\s*@\{/);
});

test('beta CI tests and builds but cannot deploy',()=>{
  const workflow=read('.github/workflows/azure-beta-build.yml');
  assert.match(workflow,/pull_request:/);
  assert.match(workflow,/push:\s*\n\s+branches:\s*\[main\]/);
  assert.match(workflow,/permissions:\s*\n\s+contents:\s*read/);
  assert.match(workflow,/npm ci/);
  assert.match(workflow,/npm ci --prefix swa-api/);
  assert.match(workflow,/npm test/);
  assert.match(workflow,/npm run test:emulator/);
  assert.match(workflow,/node tools\/build-beta-release\.js/);
  assert.match(workflow,/node tools\/verify-beta-candidate\.js/);
  assert.match(workflow,/node tools\/beta-freeze\.js --artifact \.azure-production\/app/);
  assert.match(workflow,/name:\s*azure-beta-\$\{\{ github\.sha \}\}/);
  assert.match(workflow,/path:\s*\.azure-production/);
  assert.doesNotMatch(workflow,/AZURE_STATIC_WEB_APPS_API_TOKEN/);
  assert.doesNotMatch(workflow,/Azure\/static-web-apps-deploy/);
  assert.doesNotMatch(workflow,/deploy_production:/);
});

test('beta repository has no GitHub Pages or duplicate generic CI workflow',()=>{
  assert.equal(fs.existsSync(path.join(root,'.github/workflows/github-pages-test.yml')),false);
  assert.equal(fs.existsSync(path.join(root,'.github/workflows/test.yml')),false);
});

test('beta deployment is manual exact-main and reuses a successful build artifact',()=>{
  const workflow=read('.github/workflows/azure-beta-deploy.yml');
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/source_run_id:/);
  assert.match(workflow,/commit_sha:/);
  assert.doesNotMatch(workflow,/\npush:/);
  assert.doesNotMatch(workflow,/\npull_request:/);
  assert.match(workflow,/environment:\s*\n\s+name:\s*beta/);
  assert.match(workflow,/https:\/\/red-cliff-04871ca0f\.5\.azurestaticapps\.net/);
  assert.match(workflow,/git rev-parse origin\/main/);
  assert.match(workflow,/\.github\/workflows\/azure-beta-build\.yml/);
  assert.match(workflow,/\.head_sha/);
  assert.match(workflow,/\.head_branch/);
  assert.match(workflow,/\.status/);
  assert.match(workflow,/\.conclusion/);
  assert.match(workflow,/name:\s*azure-beta-\$\{\{ inputs\.commit_sha \}\}/);
  assert.match(workflow,/secrets\.AZURE_STATIC_WEB_APPS_API_TOKEN/);
  assert.match(workflow,/Azure\/static-web-apps-deploy@4d27395796ac319302594769cfe812bd207490b1/);
  assert.doesNotMatch(workflow,/api_location\s*:/);
  assert.doesNotMatch(workflow,/skip_api_build\s*:\s*false/);
  const deploy=workflow.slice(workflow.indexOf('Deploy tested beta artifact'));
  assert.doesNotMatch(workflow,/npm ci|npm test|node tools\/build-beta-release\.js|build-static\.js/);
});

test('beta build may retain the API artifact for packaging while deploy remains static-only',()=>{
  const build=read('tools/build-beta-release.js');
  assert.match(build,/build-swa-api\.js/);
  const workflow=read('.github/workflows/azure-beta-deploy.yml');
  assert.match(workflow,/test -f \.azure-production\/api\/index\.js/);
  assert.match(workflow,/test -f \.azure-production\/api\/package-lock\.json/);
  assert.doesNotMatch(workflow,/api_location\s*:/);
});

test('beta deploy independently revalidates the frozen runtime before Azure upload',()=>{
  const workflow=read('.github/workflows/azure-beta-deploy.yml');
  const uploadAt=workflow.indexOf('Deploy tested beta artifact');
  assert.ok(uploadAt>0,'the Azure upload step must exist');
  const before=workflow.slice(0,uploadAt);
  const after=workflow.slice(uploadAt);

  // The upload is the only place that may touch Azure, and it must come last.
  assert.match(after,/Azure\/static-web-apps-deploy@4d27395796ac319302594769cfe812bd207490b1/);
  assert.doesNotMatch(after,/node tools\/beta-freeze\.js/);

  // Independent frozen-runtime revalidation happens before that upload.
  assert.match(before,/node tools\/beta-freeze\.js/);
  assert.match(before,/--artifact\s+\.azure-production\/app/);
  assert.match(before,/run:\s*node tools\/beta-freeze\.js\s*(?:\r?\n|$)/);
  assert.match(before,/run:\s*node tools\/beta-freeze\.js --artifact \.azure-production\/app/);
  assert.doesNotMatch(workflow,/--baseline(?:\s+|$)/);
  assert.doesNotMatch(workflow,/2b10aca5b9ab26ffecdffb685bddd33ae4de70f5/);
  assert.match(before,/ref:\s*\$\{\{ inputs\.commit_sha \}\}/);
  // Revalidation must not become a second build.
  assert.doesNotMatch(before,/node tools\/build-beta-release\.js/);
  assert.doesNotMatch(before,/npm run test:emulator/);
});

test('deploy delegates frozen baseline authority to beta-freeze.js',()=>{
  const workflow=read('.github/workflows/azure-beta-deploy.yml');
  const freeze=require('../tools/beta-freeze.js');
  const baseline=require('../tools/beta-baseline.json');
  assert.equal(freeze.BASELINE_COMMIT,baseline.sourceCommit);
  assert.equal(freeze.BASELINE_COMMIT,'0be7e75c483b497cc566c24a3d9366ad32827f8c');
  assert.match(workflow,/run:\s*node tools\/beta-freeze\.js\s*(?:\r?\n|$)/);
  assert.match(workflow,/run:\s*node tools\/beta-freeze\.js --artifact \.azure-production\/app/);
  assert.doesNotMatch(workflow,/--baseline(?:\s+|$)/);
  assert.doesNotMatch(workflow,/2b10aca5b9ab26ffecdffb685bddd33ae4de70f5/);
});

test('legacy Azure static deploy derives the promoted integrated P4 trust anchor and verifies API attestation',()=>{
  const workflow=read('.github/workflows/azure-beta-static-deploy.yml');
  assert.match(workflow,/require\('\.\/tools\/beta-freeze\.js'\)\.BASELINE_COMMIT/);
  assert.match(workflow,/runtimeTrustAnchor/);
  assert.match(workflow,/api\/health\/runtime/);
  // The active evidence derives the trust anchor from the immutable repository authority.
  assert.doesNotMatch(workflow,/65766bcf9fc57e50ff8b4fe7dd7cedcffb6825be/);
  assert.doesNotMatch(workflow,/f2d76449a4881cb24196289ebf63fd4cfaaa7d05/);
  assert.doesNotMatch(workflow,/5a7f8a535caaf42992598c6fc8fe301818075e67/);
  assert.match(workflow,/paws-api-origin\.js/);
});

// G + H. Candidate and main CI contracts: ZERO allowed protected runtime drift.
test('the build workflow enforces zero protected runtime drift on every event',()=>{
  const workflow=read('.github/workflows/azure-beta-build.yml');
  // No event gate may switch verification behaviour between pull_request and push.
  assert.doesNotMatch(workflow,/github\.event_name/);
  assert.doesNotMatch(workflow,/Verify strict frozen main runtime/);
  assert.doesNotMatch(workflow,/Verify explicit Beta-R1 release-candidate drift/);
  // Both the repository runtime and the built artifact are verified against Commit A.
  assert.match(workflow,/name:\s*Verify frozen Beta runtime baseline \(repository\)/);
  assert.match(workflow,/name:\s*Verify frozen Beta runtime baseline \(built artifact\)/);
  assert.match(workflow,/run:\s*node tools\/verify-beta-candidate\.js/);
  assert.match(workflow,/run:\s*node tools\/beta-freeze\.js --artifact \.azure-production\/app/);
});

test('the candidate verifier has no drift whitelist and no Beta-R1 exception',()=>{
  const verifier=read('tools/verify-beta-candidate.js');
  assert.doesNotMatch(verifier,/const\s+allowed\s*=/);
  assert.doesNotMatch(verifier,/new\s+Set\(/);
  // paws-data-client.js may only appear in the historical note, never as an exception
  assert.doesNotMatch(verifier,/allowed\s*\.has\(/);
  assert.doesNotMatch(verifier,/intentionalCandidateDrift/);
  assert.doesNotMatch(verifier,/intentionalCandidateDrift/);
  assert.doesNotMatch(verifier,/86bd5aa2c8a25259f3f708e49b322220ff43a147/);
  assert.match(verifier,/verifyFreeze/);
  // Any drift must fail the run.
  assert.match(verifier,/process\.exit\(1\)/);
});

test('the build workflow triggers on both pull_request and push to main',()=>{
  const workflow=read('.github/workflows/azure-beta-build.yml');
  assert.match(workflow,/pull_request:/);
  assert.match(workflow,/push:\s*\n\s+branches:\s*\[main\]/);
});

// I. Deploy contract.
test('manual deploy still requires exact current main and independently verifies both copies',()=>{
  const workflow=read('.github/workflows/azure-beta-deploy.yml');
  // exact-main gates preserved
  assert.match(workflow,/test "\$\(git rev-parse HEAD\)" = "\$EXPECTED_SHA"/);
  assert.match(workflow,/test "\$\(git rev-parse origin\/main\)" = "\$EXPECTED_SHA"/);
  assert.match(workflow,/'\.repository\.full_name'/);
  assert.match(workflow,/'\.head_sha'/);
  assert.match(workflow,/'\.head_branch'.*= "main"/);
  assert.match(workflow,/'\.event'.*= "push"/);
  assert.match(workflow,/'\.status'.*= "completed"/);
  assert.match(workflow,/'\.conclusion'.*= "success"/);
  assert.match(workflow,/'\.path'.*= "\.github\/workflows\/azure-beta-build\.yml"/);
  // repository and downloaded artifact delegate baseline selection to beta-freeze.js
  assert.match(workflow,/run:\s*node tools\/beta-freeze\.js\s*(?:\r?\n|$)/);
  assert.match(workflow,/run:\s*node tools\/beta-freeze\.js --artifact \.azure-production\/app/);
  assert.doesNotMatch(workflow,/--baseline(?:\s+|$)/);
  assert.doesNotMatch(workflow,/2b10aca5b9ab26ffecdffb685bddd33ae4de70f5/);
  assert.doesNotMatch(workflow,/86bd5aa2c8a25259f3f708e49b322220ff43a147/);
});

test('setup docs label this repository beta and forbid automatic test promotion',()=>{
  const setup=read('SETUP.md');
  assert.match(setup,/Azure beta site/i);
  assert.match(setup,/Teaching-assignment-azure/);
  assert.match(setup,/red-cliff-04871ca0f\.5\.azurestaticapps\.net/);
  assert.match(setup,/successful.*CI.*exact.*SHA|exact.*SHA.*successful.*CI/i);
  assert.match(setup,/manual/i);
  assert.match(setup,/no automatic sync|not automatically sync/i);
  assert.doesNotMatch(setup,/GitHub Pages.*deploy|Pages test site.*this repository/i);
});


