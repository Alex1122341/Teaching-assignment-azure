'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('retired Azure Static Web Apps deployment entrypoints and routing config are absent',()=>{
  for(const file of [
    '.github/workflows/azure-beta-deploy.yml',
    '.github/workflows/azure-beta-static-deploy.yml',
    'tools/deploy_azure_static_web.ps1',
    'staticwebapp.config.json',
    'tests/static-release-workflow.test.js'
  ])assert.equal(fs.existsSync(path.join(root,file)),false,file);
  const combined=fs.readdirSync(path.join(root,'.github/workflows')).filter(f=>f.endsWith('.yml')).map(f=>read('.github/workflows/'+f)).join('\n');
  assert.doesNotMatch(combined,/Azure\/static-web-apps-deploy|AZURE_STATIC_WEB_APPS_API_TOKEN|\.azurestaticapps\.net/);
});

test('Beta Build still runs tests and creates frozen static and API artifacts without deployment',()=>{
  const workflow=read('.github/workflows/azure-beta-build.yml');
  assert.match(workflow,/pull_request:/);
  assert.match(workflow,/push:\s*\n\s*branches:\s*\[main\]/);
  assert.match(workflow,/permissions:\s*\n\s*contents:\s*read/);
  for(const clause of [/npm ci/,/npm ci --prefix swa-api/,/npm test/,/npm run test:emulator/,/node tools\/build-beta-release\.js/,/node tools\/verify-beta-candidate\.js/,/node tools\/beta-freeze\.js --artifact \.azure-production\/app/,/node tools\/beta-api-freeze\.js --artifact \.azure-production\/api/,/name:\s*azure-beta-\$\{\{ github\.sha \}\}/])assert.match(workflow,clause);
  assert.doesNotMatch(workflow,/Azure\/static-web-apps-deploy|firebase deploy|AZURE_STATIC_WEB_APPS_API_TOKEN/);
  assert.match(read('tools/build-beta-release.js'),/build-swa-api\.js/,'combined artifact must retain the current University API package');
  assert.doesNotMatch(read('tools/build-beta-release.js'),/staticwebapp\.config\.json/);
});

test('Firebase Hosting is the only active static site deployment workflow',()=>{
  const workflow=read('.github/workflows/firebase-hosting-deploy.yml');
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/source_run_id:/);
  assert.match(workflow,/commit_sha:/);
  assert.match(workflow,/azure-beta-build\.yml/);
  assert.match(workflow,/name:\s*azure-beta-\$\{\{ inputs\.commit_sha \}\}/);
  assert.match(workflow,/path:\s*\.firebase-production/);
  assert.match(workflow,/Verify P4 static artifact/);
  assert.match(workflow,/test -f \.firebase-production\/app\/index\.html/);
  assert.match(workflow,/cmp -s \"\$expected\" \"\$target\"/);
  assert.match(workflow,/firebase deploy/);
  assert.match(workflow,/--only hosting/);
  assert.match(workflow,/tester-teaching\.web\.app/);
  assert.doesNotMatch(workflow,/Azure\/static-web-apps-deploy|AZURE_STATIC_WEB_APPS_API_TOKEN|--only functions|--only firestore/);
  const firebase=JSON.parse(read('firebase.json'));
  assert.equal(firebase.hosting.public,'.deploy-static');
  assert.deepEqual(firebase.hosting.redirects.find(x=>x.source==='/faculty-dashboard.html'),{source:'/faculty-dashboard.html',destination:'/index.html',type:301});
});

test('Azure SQL and optional Container Apps API packaging/deployment remain separately protected',()=>{
  for(const file of [
    '.github/workflows/azure-beta-acr-publish.yml',
    '.github/workflows/azure-beta-aca-deploy.yml',
    '.github/workflows/azure-sql-migration-test.yml',
    'tools/build-swa-api.js',
    'server/src/runtime/swa-sql-runtime.js',
    'server/src/runtime/university-api.js',
    'deploy/aca/Dockerfile'
  ])assert.ok(fs.existsSync(path.join(root,file)),file);
  const acap=read('.github/workflows/azure-beta-acr-publish.yml');
  assert.match(acap,/azure-beta-build\.yml/);
  assert.match(acap,/beta-api-freeze\.js --artifact \.azure-production\/api/);
  assert.doesNotMatch(acap,/staticwebapp\.config\.json|Azure\/static-web-apps-deploy/);
  const aca=read('.github/workflows/azure-beta-aca-deploy.yml');
  assert.match(aca,/azure-beta-acr-publish\.yml/);
  assert.doesNotMatch(aca,/Azure\/static-web-apps-deploy/);
});

test('frozen release verification covers all manifest files, not a retired Azure SWA config sentinel',()=>{
  const freeze=read('tools/beta-freeze.js');
  const manifest=JSON.parse(read('tools/static-assets.json'));
  assert.ok(manifest.length>=81);
  assert.equal(manifest.includes('staticwebapp.config.json'),false);
  assert.match(freeze,/protectedPaths/);
  assert.match(freeze,/readBaselineFile/);
  assert.match(freeze,/verifyFreeze/);
  assert.doesNotMatch(freeze,/staticwebapp\.config\.json/);
});

test('normal CI retains exact frozen baseline checks on pull request and main',()=>{
  const workflow=read('.github/workflows/azure-beta-build.yml');
  assert.doesNotMatch(workflow,/github\.event_name/);
  assert.match(workflow,/name:\s*Verify frozen Beta runtime baseline \(repository\)/);
  assert.match(workflow,/name:\s*Verify frozen Beta runtime baseline \(built artifact\)/);
  assert.match(workflow,/node tools\/verify-beta-candidate\.js/);
  assert.match(workflow,/node tools\/beta-freeze\.js --artifact \.azure-production\/app/);
  const verifier=read('tools/verify-beta-candidate.js');
  assert.match(verifier,/verifyFreeze/);
  assert.match(verifier,/process\.exit\(1\)/);
});
