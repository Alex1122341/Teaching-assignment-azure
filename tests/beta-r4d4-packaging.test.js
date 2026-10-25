'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('ACA Dockerfile uses the official Node 22 Functions image and deterministic artifact', () => {
  const dockerfile = read('deploy/aca/Dockerfile');
  assert.match(dockerfile, /^FROM mcr\.microsoft\.com\/azure-functions\/node:4-node22/m);
  assert.doesNotMatch(dockerfile, /node:4-node22-appservice/);
  assert.match(dockerfile, /COPY \.azure-production\/api\//);
  assert.match(dockerfile, /npm ci --omit=dev/);
  assert.match(dockerfile, /\/home\/site\/wwwroot/);
  assert.match(dockerfile, /AzureWebJobsScriptRoot/);
});

test('packaging documentation requires the existing deterministic API build helper', () => {
  assert.match(read('docs/beta-r4d4-aca-packaging.md'), /node tools\/build-swa-api\.js/);
  assert.match(read('docs/beta-r4d4-aca-packaging.md'), /\.azure-production\/api/);
});

test('Beta build does not build or publish retired ACA images', () => {
  const workflow = read('.github/workflows/azure-beta-build.yml');
  assert.doesNotMatch(workflow, /docker (build|login|push)|az (acr|containerapp)/);
  assert.match(workflow, /node tools\/build-beta-release\.js/);
});

test('Docker ignore excludes credentials and local/private artifacts', () => {
  const ignore = read('.dockerignore');
  for (const entry of ['.git', '.firebase', '.env', 'activation-private', 'node_modules', 'agent.Ai', 'docs', 'tests']) {
    assert.match(ignore, new RegExp(`^${entry.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'm'));
  }
  assert.match(ignore, /^service-account\*\.json$/m);
});

test('R4D-4 architecture documentation is explicitly not deployed', () => {
  assert.match(read('docs/beta-r4d4-aca-packaging.md'), /NOT YET DEPLOYED/);
  assert.match(read('docs/beta-r4d4-aca-packaging.md'), /No SQL password/);
  assert.match(read('docs/beta-r4d4-aca-packaging.md'), /paws-function-host-mi/);
});
