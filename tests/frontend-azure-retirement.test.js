'use strict';

const { repositoryPath } = require('../tools/build/frontend-paths');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const root = repositoryPath(__dirname, '..');
const publishedAssets = JSON.parse(fs.readFileSync(repositoryPath(root, 'tools', 'static-assets.json'), 'utf8'));
const retiredCloudFrontend = /azure|staticwebapp|static-web-app|azurestaticapps\.net|azurecontainerapps\.io|azurewebsites\.net|@azure\/|\bmsal\b|login\.microsoftonline\.com|\.azure-production/i;

test('Firebase static manifest has no retired Azure frontend references', () => {
  assert.ok(publishedAssets.includes('paws-data-client.js'));
  assert.ok(publishedAssets.includes('timetable.js'));
  for (const asset of publishedAssets) {
    if (/\.pdf$/i.test(asset)) continue;
    const content = fs.readFileSync(repositoryPath(root, asset), 'utf8');
    assert.doesNotMatch(content, retiredCloudFrontend, asset);
  }
});

test('browser API client uses the existing University API contract without Azure exports', () => {
  const source = fs.readFileSync(repositoryPath(root, 'paws-data-client.js'), 'utf8');
  const api = require('../frontend/scripts/paws-data-client.js');
  assert.equal(typeof api.createPawsDataClient, 'function');
  assert.match(source, /root\.UCVM_PAWS_DATA=api\.createPawsDataClient\(\)/);
  assert.match(source, /sessionBackend:\(\)=> 'vetmed-ops'/);
  assert.doesNotMatch(source, /createPawsAzureDataClient|azure-sql/);
});

test('Firebase Hosting configuration and frontend environment origins avoid retired Azure hosting', () => {
  const candidates = [
    'firebase.json',
    'firebase.hosting-only.json',
    'config/environments/production.json',
    'config/environments/testing.json',
    'config/environments/testing.template.json'
  ];
  for (const relative of candidates) {
    const absolute = repositoryPath(root, relative);
    if (!fs.existsSync(absolute)) continue;
    const data = fs.readFileSync(absolute, 'utf8');
    if (relative.startsWith('config/environments/')) {
      const config = JSON.parse(data);
      const urls = [config.apiOrigin, config.siteUrl, config.peerSiteUrl].filter(Boolean);
      for (const url of urls) assert.doesNotMatch(String(url), /azurestaticapps\.net|azurecontainerapps\.io|azurewebsites\.net/i, relative);
    } else {
      assert.doesNotMatch(data, /azurestaticapps\.net|azurecontainerapps\.io|azurewebsites\.net|staticwebapp\.config/i, relative);
    }
  }
});
