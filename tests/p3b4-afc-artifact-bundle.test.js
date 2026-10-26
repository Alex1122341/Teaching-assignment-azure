'use strict';

const { repositoryPath } = require('../tools/build/frontend-paths');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const buildScriptPath = repositoryPath(__dirname, '..', 'tools', 'build-swa-api.js');

test('SWA API builder copies locked package inputs, server source, and reviewed PDF into only its root bundle path', (t) => {
  const buildScript = fs.readFileSync(buildScriptPath, 'utf8');
  assert.match(buildScript, /module\.exports\s*=\s*\{\s*buildSwaApi\s*\}/);
  const { buildSwaApi } = require(buildScriptPath);
  assert.equal(typeof buildSwaApi, 'function');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p3b4-swa-api-bundle-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const sourceDir = repositoryPath(root, 'swa-api');
  const serverSourceDir = repositoryPath(root, 'server', 'src');
  const templateRelativePath = path.join('afc', 'assets', 'absence-from-campus-app.pdf');
  fs.mkdirSync(path.join(serverSourceDir, 'afc', 'assets'), { recursive: true });
  fs.mkdirSync(path.join(serverSourceDir, 'runtime'), { recursive: true });
  fs.mkdirSync(sourceDir, { recursive: true });

  fs.writeFileSync(path.join(sourceDir, 'package.json'), '{"name":"fixture-api"}\n');
  fs.writeFileSync(path.join(sourceDir, 'package-lock.json'), '{"name":"fixture-api","lockfileVersion":3}\n');
  fs.writeFileSync(path.join(sourceDir, 'host.json'), '{"version":"2.0"}\n');
  fs.writeFileSync(path.join(sourceDir, 'index.js'), 'module.exports = {};\n');
  fs.writeFileSync(path.join(serverSourceDir, 'runtime', 'fixture.js'), 'module.exports = "copied";\n');
  const templateBytes = Buffer.from('%PDF-1.7 fixture template bytes');
  fs.writeFileSync(path.join(serverSourceDir, templateRelativePath), templateBytes);

  const expectedOutput = repositoryPath(root, '.azure-production', 'api');
  const result = buildSwaApi({ root });
  assert.equal(path.resolve(result.output), path.resolve(expectedOutput));
  assert.equal(fs.readFileSync(path.join(expectedOutput, 'package.json'), 'utf8'), '{"name":"fixture-api"}\n');
  assert.equal(fs.readFileSync(path.join(expectedOutput, 'package-lock.json'), 'utf8'), '{"name":"fixture-api","lockfileVersion":3}\n');
  assert.equal(fs.readFileSync(path.join(expectedOutput, 'server', 'src', 'runtime', 'fixture.js'), 'utf8'), 'module.exports = "copied";\n');

  const copiedTemplate = fs.readFileSync(path.join(expectedOutput, 'server', 'src', templateRelativePath));
  assert.deepEqual(copiedTemplate, templateBytes);
  assert.equal(
    crypto.createHash('sha256').update(copiedTemplate).digest('hex'),
    crypto.createHash('sha256').update(templateBytes).digest('hex'),
  );
  assert.equal(fs.existsSync(repositoryPath(root, '.azure-production', 'unexpected-output')), false);

  const cliOverride = spawnSync(process.execPath, [buildScriptPath, '--output', repositoryPath(root, 'unexpected-output')], {
    cwd: path.dirname(buildScriptPath),
    encoding: 'utf8',
  });
  assert.notEqual(cliOverride.status, 0);
  assert.match(cliOverride.stderr, /SWA API output must be \.azure-production\/api/);
  assert.equal(fs.existsSync(repositoryPath(root, 'unexpected-output')), false);
});
