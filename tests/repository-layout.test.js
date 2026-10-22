'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const assets = require('../tools/static-assets.json');
const checkpoint = '8249a331a2069d2172db304cc7dff586a7f8df02';
const folders = { '.html': 'pages', '.js': 'scripts', '.css': 'styles', '.pdf': 'assets' };
const source = asset => path.join(root, 'frontend', folders[path.extname(asset)], asset);

test('browser source files live in frontend folders, not repository root', () => {
  for (const asset of assets) {
    assert.ok(fs.existsSync(source(asset)), `missing organized source: ${asset}`);
    assert.equal(fs.existsSync(path.join(root, asset)), false, `root source duplicate: ${asset}`);
  }
});

test('source relocation preserves every published byte from accepted PR133 checkpoint', () => {
  const normalize = bytes => bytes.toString('binary').replace(/\r\n/g, '\n');
  for (const asset of assets) {
    assert.ok(fs.existsSync(source(asset)), `missing source: ${asset}`);
    const before = execFileSync('git', ['show', `${checkpoint}:${asset}`], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
    assert.equal(normalize(fs.readFileSync(source(asset))), normalize(before), asset);
  }
});

test('both builds share one implementation rather than duplicate asset copying', () => {
  const standalone = fs.readFileSync(path.join(root, 'tools/build-static.js'), 'utf8');
  const combined = fs.readFileSync(path.join(root, 'tools/build-beta-release.js'), 'utf8');
  assert.match(standalone, /buildStaticBundle/);
  assert.match(combined, /buildStaticBundle/);
  assert.doesNotMatch(standalone + combined, /copyFileSync/);
});

test('root has a repository guide and no loose frontend application files', () => {
  assert.ok(fs.existsSync(path.join(root, 'README.md')));
  assert.ok(fs.existsSync(path.join(root, 'frontend/README.md')));
  assert.deepEqual(fs.readdirSync(root).filter(file => /\.(?:html|js|css|pdf)$/.test(file)), []);
});
