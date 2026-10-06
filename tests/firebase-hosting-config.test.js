const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const firebase = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'firebase.json'), 'utf8')
);
const cacheControl = 'no-cache, max-age=0, must-revalidate';

function headerValue(rule, key) {
  return rule.headers.find((header) => header.key === key)?.value;
}

test('Firebase Hosting config keeps the static build and cache policies', () => {
  assert.equal(firebase.hosting.public, '.deploy-static');
  assert.deepEqual(firebase.hosting.predeploy, ['node tools/build-static.js']);

  const rootRule = firebase.hosting.headers.find((rule) => rule.source === '/');
  assert.ok(rootRule, 'the exact root request path has an explicit header rule');
  assert.equal(headerValue(rootRule, 'Cache-Control'), cacheControl);

  const assetRule = firebase.hosting.headers.find(
    (rule) => rule.source === '**/*.@(html|js|css)'
  );
  assert.ok(assetRule, 'the existing HTML/JS/CSS rule remains configured');
  assert.equal(headerValue(assetRule, 'Cache-Control'), cacheControl);

  assert.deepEqual(
    firebase.hosting.redirects?.find((rule) => rule.source === '/faculty-dashboard.html'),
    { source: '/faculty-dashboard.html', destination: '/index.html', type: 301 }
  );

  assert.deepEqual(firebase.firestore, {
    rules: 'firestore.rules',
    indexes: 'firestore.indexes.json'
  });
});
