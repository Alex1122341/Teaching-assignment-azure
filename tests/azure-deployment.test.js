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
  assert.match(workflow,/npm test/);
  assert.match(workflow,/npm run test:emulator/);
  assert.match(workflow,/node tools\/build-static\.js/);
  assert.match(workflow,/cp staticwebapp\.config\.json \.deploy-static\/staticwebapp\.config\.json/);
  assert.match(workflow,/name:\s*azure-beta-\$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflow,/AZURE_STATIC_WEB_APPS_API_TOKEN/);
  assert.doesNotMatch(workflow,/Azure\/static-web-apps-deploy/);
  assert.doesNotMatch(workflow,/deploy_production:/);
});

test('beta repository has no GitHub Pages or duplicate generic CI workflow',()=>{
  assert.equal(fs.existsSync(path.join(root,'.github/workflows/github-pages-test.yml')),false);
  assert.equal(fs.existsSync(path.join(root,'.github/workflows/test.yml')),false);
});

test('setup docs describe Pages testing followed by gated Azure production',()=>{
  const setup=read('SETUP.md');
  assert.match(setup,/AZURE_STATIC_WEB_APPS_API_TOKEN/);
  assert.match(setup,/pull request/i);
  assert.match(setup,/GitHub Pages/i);
  assert.match(setup,/merge.*`main`|merge.*main/i);
  assert.match(setup,/Approve and deploy/i);
  assert.match(setup,/firestore:rules/);
  assert.match(setup,/manual fallback|emergency\/manual fallback/i);
  assert.match(setup,/Firebase Hosting is not used|Firebase Hosting stays out/i);
  assert.doesNotMatch(setup,/Azure PR preview|temporary Azure PR preview/i);
});
