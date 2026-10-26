'use strict';

const { repositoryPath } = require('../tools/build/frontend-paths');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const root = repositoryPath(__dirname, '..');
const originConfig = require('../frontend/scripts/paws-api-origin.js');

test('P3 Beta API origin is one explicitly temporary, replaceable HTTPS configuration', () => {
  const parsed = new URL(originConfig.apiOrigin);
  assert.equal(parsed.protocol, 'https:');
  assert.equal(parsed.pathname, '/');
  assert.equal(parsed.search, '');
  assert.equal(parsed.hash, '');
  assert.equal(originConfig.releaseLabel, 'TEMPORARY BETA INGRESS');

  const shippedFiles = require('../tools/static-assets.json');
  const references = shippedFiles.filter(file => {
    const source = fs.readFileSync(repositoryPath(root, file), 'utf8');
    return source.includes(new URL(originConfig.apiOrigin).hostname);
  });
  assert.deepEqual(references, ['paws-api-origin.js']);
});

test('the combined timetable loads the API-origin configuration before the shared data client', () => {
  for (const file of ['index.html', 'faculty-admin.html']) {
    const html = fs.readFileSync(repositoryPath(root, file), 'utf8');
    const originScript = html.indexOf('<script src="paws-api-origin.js"></script>');
    const clientScript = html.indexOf('<script src="paws-data-client.js"></script>');
    assert.ok(originScript >= 0, `${file}: the central API-origin file is loaded`);
    assert.ok(clientScript > originScript, `${file}: API origin must exist before client initialization`);
  }
});

test('the data client sends Firebase-authenticated API calls to the configured Beta origin', async () => {
  const { createPawsDataClient } = require('../frontend/scripts/paws-data-client.js');
  const requests = [];
  const client = createPawsDataClient({
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return { ok: true, json: async () => ({ profile: { role: 'faculty' }, sessions: [] }) };
    },
    tokenProvider: async () => 'synthetic-test-token'
  });

  await client.currentUser();
  assert.equal(new URL(requests[0].url).origin, originConfig.apiOrigin);
  assert.equal(requests[0].init.headers.Authorization, 'Bearer synthetic-test-token');
  assert.equal(requests[0].init.credentials, 'omit');
});
