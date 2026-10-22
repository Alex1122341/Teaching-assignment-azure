'use strict';
// Deployment readiness for the PAWS Testing environment (PR #125 I4-I8).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
test('Testing deploy stages the accepted artifact at the configured Firebase public directory', () => {
  const hosting = JSON.parse(fs.readFileSync(path.join(root, 'firebase.hosting-only.json'), 'utf8')).hosting.public;
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/paws-testing-deploy.yml'), 'utf8');
  assert.equal(hosting, '.firebase-production/app');
  assert.ok(workflow.includes(`cp -r .azure-testing/app ${hosting}`), 'Testing must publish the accepted artifact, not a different staging tree');
  assert.match(workflow, /--config firebase\.hosting-only\.json/);
});
const { GATE_ENV, createWriteGates } = require('../server/src/data/write-gates');
const { verifyTestingApiEnv, parseEnvFile } = require('../tools/verify-testing-api-env');
const { preflight } = require('../tools/testing-preflight');
const { loadConfig, validateConfig, validatePair, render } = require('../tools/render-environment-config');
const { findEvidence, checkEvidence } = require('../tools/verify-release-evidence');

const production = loadConfig('production');
const testingConfig = {
  environment: 'testing', environmentLabel: 'TESTING ENVIRONMENT — SYNTHETIC DATA ONLY', releaseLabel: 'TESTING — SYNTHETIC DATA',
  apiOrigin: 'https://paws-testing-api.example.org', siteUrl: 'https://paws-testing.web.app', peerSiteUrl: production.siteUrl,
  firebase: { apiKey: 'test-key', authDomain: 'paws-testing.firebaseapp.com', projectId: 'paws-testing', appId: '1:2:web:3' }
};
function configRoot(testing = testingConfig, prod = { ...production, peerSiteUrl: testingConfig.siteUrl }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paws-ready-'));
  fs.mkdirSync(path.join(dir, 'config', 'environments'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'config', 'environments', 'production.json'), JSON.stringify(prod));
  fs.writeFileSync(path.join(dir, 'config', 'environments', 'testing.json'), JSON.stringify(testing));
  return dir;
}
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// ------------------------------------------------------------------ write-gate matrix
test('write-gate matrix lists every gate exactly once with its real variable and enforcing modules', () => {
  const matrix = JSON.parse(read('deploy/testing/write-gate-matrix.json')).gates;
  assert.deepEqual(matrix.map(g => g.gate).sort(), Object.keys(GATE_ENV).sort());
  for (const entry of matrix) {
    assert.equal(entry.env, GATE_ENV[entry.gate], entry.gate);
    assert.ok(entry.modules.length > 0, entry.gate);
    for (const module of entry.modules) {
      const source = read(module);
      assert.ok(source.includes(entry.gate), `${module} enforces ${entry.gate}`);
    }
    assert.equal(entry.testing, true, `${entry.gate} is open for Testing UAT`);
  }
});

test('the Testing API template sets every gate explicitly and matches the matrix; gates open only on exact "true"', () => {
  const template = parseEnvFile(read('deploy/testing/testing-api.env.template'));
  const byName = Object.fromEntries(template.map(e => [e.name, e.value]));
  const matrix = JSON.parse(read('deploy/testing/write-gate-matrix.json')).gates;
  for (const entry of matrix) assert.equal(byName[entry.env], String(entry.testing), entry.env);
  const gates = createWriteGates(byName);
  assert.ok(Object.values(gates).every(Boolean));
  for (const value of ['TRUE', '1', ' true', 'yes']) assert.equal(createWriteGates({ PAWS_TA_DRAFT_WRITE_ENABLED: value }).taDraft, false, value);
  assert.ok(Object.values(createWriteGates({})).every(value => value === false), 'nothing is open by default');
});

// ------------------------------------------------------------------ Testing API environment
const goodEnv = () => [
  { name: 'PAWS_ENVIRONMENT', value: 'testing' },
  { name: 'PAWS_TESTING_ENVIRONMENT_ID', value: '3f0c9a52-7d1e-4b6a-9c2f-0a1b2c3d4e5f' },
  { name: 'PAWS_TESTING_SQL_SERVER', value: 'paws-testing-sql.database.windows.net' },
  { name: 'PAWS_SQL_CONNECTION_STRING', value: 'Server=tcp:paws-testing-sql.database.windows.net,1433;Database=VetMed-Ops;Encrypt=true' },
  { name: 'PAWS_SQL_MI_CLIENT_ID', value: '1b2c3d4e-5f60-4718-9a0b-1c2d3e4f5a6b' },
  { name: 'PAWS_SQL_DRIVER', value: 'tedious' },
  { name: 'FIREBASE_PROJECT_ID', value: 'paws-testing' },
  { name: 'PAWS_API_HOST', value: '0.0.0.0' }, { name: 'PAWS_API_PORT', value: '8080' },
  { name: 'PAWS_API_ALLOW_NON_LOOPBACK', value: 'true' },
  { name: 'PAWS_API_ALLOWED_ORIGINS', value: 'https://paws-testing.web.app' },
  { name: 'PAWS_RELEASE_SHA', value: 'a'.repeat(40) },
  ...Object.values(GATE_ENV).map(name => ({ name, value: 'true' }))
];
const withEnv = (patch, base = goodEnv()) => { const map = new Map(base.map(e => [e.name, e])); for (const [k, v] of Object.entries(patch)) { if (v === undefined) map.delete(k); else map.set(k, typeof v === 'object' ? { name: k, ...v } : { name: k, value: v }); } return [...map.values()]; };

test('Testing API environment: the reviewed profile is accepted and reports its gate map', () => {
  const { errors, gates } = verifyTestingApiEnv(goodEnv(), { root: configRoot() });
  assert.deepEqual(errors, []);
  assert.equal(Object.keys(gates).length, Object.keys(GATE_ENV).length);
});

test('Testing API environment: unsafe or incomplete settings are rejected with actionable messages', () => {
  const dir = configRoot();
  const cases = [
    [{ PAWS_ENVIRONMENT: 'production' }, /not valid in production|PAWS_ENVIRONMENT must be testing/],
    [{ PAWS_SQL_CONNECTION_STRING: 'Server=ITAPPVETOPSDB01;Database=VetMed-Ops', PAWS_TESTING_SQL_SERVER: 'itappvetopsdb01' }, /production SQL server/],
    [{ PAWS_SQL_CONNECTION_STRING: { secretRef: 'sql' } }, /must be a plain value/],
    [{ PAWS_SQL_CONNECTION_STRING: 'Server=tcp:paws-testing-sql.database.windows.net;Database=VetMed-Ops;Password=x' }, /must not contain a password/],
    [{ FIREBASE_PROJECT_ID: 'tester-teaching' }, /production Firebase project|not the committed Testing Firebase project/],
    [{ FIREBASE_PROJECT_ID: 'another-project' }, /not the committed Testing Firebase project/],
    [{ PAWS_API_ALLOWED_ORIGINS: 'https://paws-testing.web.app,https://tester-teaching.web.app' }, /exactly the committed Testing siteUrl|references Production/],
    [{ PAWS_TA_DRAFT_WRITE_ENABLED: undefined }, /PAWS_TA_DRAFT_WRITE_ENABLED must be set explicitly/],
    [{ PAWS_TA_DRAFT_WRITE_ENABLED: 'TRUE' }, /must be exactly true or false/],
    [{ PAWS_TA_DRAFT_WRTIE_ENABLED: 'true' }, /not a PAWS setting/],
    [{ FIREBASE_SERVICE_ACCOUNT_JSON: '{"private_key":"x"}' }, /secret reference/],
    [{ PAWS_SQL_MI_CLIENT_ID: '<client id>' }, /placeholder/],
    [{ PAWS_API_HOST: '127.0.0.1' }, /0\.0\.0\.0/],
    [{ PAWS_SQL_ALLOW_SELF_SIGNED: 'true' }, /SELF_SIGNED/]
  ];
  for (const [patch, pattern] of cases) {
    const { errors } = verifyTestingApiEnv(withEnv(patch), { root: dir });
    assert.ok(errors.some(error => pattern.test(error)), `${JSON.stringify(patch)} -> ${errors.join(' | ')}`);
  }
  assert.ok(verifyTestingApiEnv(withEnv({ FIREBASE_SERVICE_ACCOUNT_JSON: { secretRef: 'firebase' } }), { root: dir }).errors.length === 0, 'a secret reference is fine');
});

test('Testing API environment: an unprovisioned repository configuration is reported, not assumed', () => {
  const { errors } = verifyTestingApiEnv(goodEnv(), { root });
  assert.ok(errors.some(error => /testing\.json is not provisioned/.test(error)));
});

// ------------------------------------------------------------------ configuration validation
test('Testing configuration rejects placeholders, IPs, localhost, Production hosts on other ports and shared Firebase values', () => {
  const bad = [
    [{ apiOrigin: 'https://<testing container app>.azurecontainerapps.io' }, /placeholder|bare HTTPS origin/],
    [{ firebase: { ...testingConfig.firebase, apiKey: 'REPLACE_WITH_KEY' } }, /placeholder/],
    [{ apiOrigin: 'https://10.0.0.4' }, /public DNS name/],
    [{ siteUrl: 'https://localhost' }, /public DNS name/],
    [{ apiOrigin: testingConfig.siteUrl }, /different hosts/]
  ];
  for (const [patch, pattern] of bad) {
    const errors = validateConfig({ ...testingConfig, ...patch }, { environment: 'testing' });
    assert.ok(errors.some(error => pattern.test(error)), `${JSON.stringify(patch)} -> ${errors.join(' | ')}`);
  }
  const prodHost = new URL(production.apiOrigin).hostname;
  const pairs = [
    [{ apiOrigin: `https://${prodHost}:8443` }, /Production host/],
    [{ siteUrl: 'https://preview.tester-teaching.web.app' }, /Production host/],
    [{ apiOrigin: 'https://tester-teaching.firebaseapp.com' }, /Production host/],
    [{ firebase: { ...testingConfig.firebase, appId: production.firebase.appId } }, /appId/],
    [{ firebase: { ...testingConfig.firebase, messagingSenderId: production.firebase.messagingSenderId } }, /messagingSenderId/],
    [{ firebase: { ...testingConfig.firebase, authDomain: 'tester-teaching.firebaseapp.com.example' } }, /auth domain/]
  ];
  for (const [patch, pattern] of pairs) {
    const errors = validatePair({ ...production, peerSiteUrl: testingConfig.siteUrl }, { ...testingConfig, ...patch });
    assert.ok(errors.some(error => pattern.test(error)), `${JSON.stringify(patch)} -> ${errors.join(' | ')}`);
  }
  assert.deepEqual(validatePair({ ...production, peerSiteUrl: testingConfig.siteUrl }, testingConfig), []);
  assert.deepEqual(validateConfig(production, { environment: 'production' }), [], 'Production configuration still valid');
});

test('the committed template is never deployable as-is', () => {
  const template = JSON.parse(read('config/environments/testing.template.json'));
  const errors = validateConfig(template, { environment: 'testing' });
  assert.ok(errors.some(error => /placeholder/.test(error)));
});

// ------------------------------------------------------------------ preflight
test('preflight (offline) names each missing resource with its next step and never passes an unprovisioned repo', async () => {
  const result = await preflight({ root });
  assert.equal(result.ok, false);
  assert.equal(result.provisioned, false);
  for (const id of ['config.testing.firebase', 'config.testing.siteUrl', 'config.testing.apiOrigin']) {
    const check = result.checks.find(item => item.id === id);
    assert.equal(check.status, 'fail', id);
    assert.match(check.action, /03-setup-and-deployment\.md/);
  }
  assert.equal(result.checks.find(item => item.id === 'config.isolation').status, 'pass');
});

test('preflight requires the Production peer link once Testing has a site, and checks the Container App environment', async () => {
  const unlinked = await preflight({ root: configRoot(testingConfig, production) });
  assert.equal(unlinked.checks.find(item => item.id === 'config.production.peer').status, 'fail');
  const linked = await preflight({ root: configRoot(), apiEnv: goodEnv() });
  assert.deepEqual(linked.checks.filter(item => item.status === 'fail'), []);
  assert.equal(linked.ok, true);
  const badEnv = await preflight({ root: configRoot(), apiEnv: withEnv({ PAWS_ENVIRONMENT: 'production' }) });
  assert.equal(badEnv.checks.find(item => item.id === 'api.environment').status, 'fail');
});

function fakeFetch({ runtime = { status: 'ok', environment: 'testing', releaseSha: 'a'.repeat(40), writeGates: { taDraft: true } }, me = 401, foreignCors = 403, served = render(testingConfig) } = {}) {
  return async (url, init = {}) => {
    const u = new URL(url);
    const headers = new Map();
    const reply = (status, body, extra = {}) => ({ status, ok: status < 400, headers: { get: name => extra[name.toLowerCase()] ?? null }, json: async () => body, text: async () => body });
    if (init.method === 'OPTIONS') {
      const origin = init.headers.Origin;
      return origin === testingConfig.siteUrl ? reply(204, '', { 'access-control-allow-origin': origin }) : reply(foreignCors, '');
    }
    if (u.pathname === '/api/health/runtime') return reply(200, runtime);
    if (u.pathname === '/api/health/sql') return reply(200, { status: 'ok' });
    if (u.pathname === '/api/v1/me') return reply(me, {});
    if (u.pathname === '/paws-api-origin.js') return reply(200, served);
    void headers;
    return reply(404, {});
  };
}

test('preflight --live passes only when the deployed API and site are the Testing environment', async () => {
  const dir = configRoot();
  const ok = await preflight({ root: dir, apiEnv: goodEnv(), live: true, fetchImpl: fakeFetch() });
  assert.deepEqual(ok.checks.filter(item => item.status === 'fail'), []);
  const scenarios = [
    [{ runtime: { status: 'ok', environment: 'production', writeGates: {} } }, 'live.api.runtime'],
    [{ me: 200 }, 'live.api.anonymous'],
    [{ foreignCors: 204 }, 'live.api.cors'],
    [{ served: render(production) }, 'live.site.config']
  ];
  for (const [options, id] of scenarios) {
    const result = await preflight({ root: dir, apiEnv: goodEnv(), live: true, fetchImpl: fakeFetch(options) });
    assert.equal(result.checks.find(item => item.id === id).status, 'fail', id);
    assert.equal(result.ok, false, id);
  }
});

// ------------------------------------------------------------------ release evidence
const REPO = 'Alex1122341/Teaching-assignment-azure';
const SHA = 'b'.repeat(40);
function evidenceApi({ testingRun = {}, job = 'success', build = {}, approvalRun = {}, extraArtifacts = [] } = {}) {
  const runs = {
    101: { id: 101, repository: { full_name: REPO }, path: '.github/workflows/paws-testing-deploy.yml', head_branch: 'main', status: 'completed', conclusion: 'success', event: 'workflow_run', ...testingRun },
    202: { id: 202, repository: { full_name: REPO }, path: '.github/workflows/azure-beta-build.yml', head_branch: 'main', status: 'completed', conclusion: 'success', event: 'push', head_sha: SHA, ...build },
    303: { id: 303, repository: { full_name: REPO }, path: '.github/workflows/paws-release-approval.yml', head_branch: 'main', status: 'completed', conclusion: 'success', event: 'workflow_dispatch', triggering_actor: { login: 'Alex1122341' }, ...approvalRun },
    404: { id: 404, repository: { full_name: REPO }, path: '.github/workflows/paws-testing-deploy.yml', head_branch: 'feature/forged', status: 'completed', conclusion: 'success', event: 'workflow_dispatch' }
  };
  return async p => {
    if (p.includes('/actions/artifacts?name=paws-testing-deploy-')) return { artifacts: [...extraArtifacts, { id: 1, name: `paws-testing-deploy-${SHA}`, expired: false, created_at: '2026-10-20T01:00:00Z', workflow_run: { id: 101 } }] };
    if (p.includes('/actions/artifacts?name=paws-release-approval-')) return { artifacts: [{ id: 3, name: `paws-release-approval-${SHA}`, expired: false, created_at: '2026-10-20T02:00:00Z', workflow_run: { id: 303 } }] };
    const jobs = /\/runs\/(\d+)\/jobs/.exec(p);
    if (jobs) return { jobs: [{ name: jobs[1] === '303' ? 'record_approval' : 'deploy_testing', conclusion: jobs[1] === '303' ? 'success' : job }] };
    const run = /\/runs\/(\d+)$/.exec(p);
    if (run) return runs[run[1]];
    throw new Error('unexpected ' + p);
  };
}
const testingEvidence = { environment: 'testing', commitSha: SHA, sourceRunId: '202', status: 'success' };
const approvalEvidence = { kind: 'release-approval', commitSha: SHA, approver: 'Alex1122341', uatOutcome: 'passed', decision: 'approved', uatReference: 'PR #125 comment', testingRunId: '101' };

test('Testing-pass evidence: a main-defined successful deploy of the same SHA from a main build qualifies', async () => {
  const api = evidenceApi();
  const found = await findEvidence({ api, repository: REPO, kind: 'testing', sha: SHA });
  assert.equal(found.runId, 101);
  assert.equal((await checkEvidence({ api, repository: REPO, kind: 'testing', sha: SHA, evidence: testingEvidence, found })).ok, true);
});

test('Testing-pass evidence cannot be forged by a branch workflow, a skipped job, a wrong file or another build', async () => {
  await assert.rejects(findEvidence({ api: evidenceApi({ testingRun: { head_branch: 'feature/x' } }), repository: REPO, kind: 'testing', sha: SHA }), /TESTING_PASS_REQUIRED|not main/);
  await assert.rejects(findEvidence({ api: evidenceApi({ testingRun: { conclusion: 'failure' } }), repository: REPO, kind: 'testing', sha: SHA }), /concluded failure/);
  await assert.rejects(findEvidence({ api: evidenceApi({ job: 'skipped' }), repository: REPO, kind: 'testing', sha: SHA }), /deploy_testing is skipped/);
  await assert.rejects(findEvidence({ api: evidenceApi({ testingRun: { path: '.github/workflows/other.yml' } }), repository: REPO, kind: 'testing', sha: SHA }), /expected/);
  await assert.rejects(findEvidence({ api: evidenceApi({ testingRun: { repository: { full_name: 'someone/fork' } } }), repository: REPO, kind: 'testing', sha: SHA }), /not from/);
  // A forged branch run listed first is skipped; the genuine run still qualifies.
  const mixed = evidenceApi({ extraArtifacts: [{ id: 9, name: `paws-testing-deploy-${SHA}`, expired: false, created_at: '2026-10-21T00:00:00Z', workflow_run: { id: 404 } }] });
  assert.equal((await findEvidence({ api: mixed, repository: REPO, kind: 'testing', sha: SHA })).runId, 101);
  const api = evidenceApi();
  const found = await findEvidence({ api, repository: REPO, kind: 'testing', sha: SHA });
  await assert.rejects(checkEvidence({ api, repository: REPO, kind: 'testing', sha: SHA, evidence: { ...testingEvidence, commitSha: 'c'.repeat(40) }, found }), /SHA|names/);
  await assert.rejects(checkEvidence({ api, repository: REPO, kind: 'testing', sha: SHA, evidence: { ...testingEvidence, status: 'failure' }, found }), /status=failure/);
  await assert.rejects(checkEvidence({ api, repository: REPO, kind: 'testing', sha: SHA, evidence: { ...testingEvidence, environment: 'production' }, found }), /environment=production/);
  await assert.rejects(checkEvidence({ api: evidenceApi({ build: { head_sha: 'd'.repeat(40) } }), repository: REPO, kind: 'testing', sha: SHA, evidence: testingEvidence, found }), /build/);
  await assert.rejects(checkEvidence({ api: evidenceApi({ build: { event: 'pull_request' } }), repository: REPO, kind: 'testing', sha: SHA, evidence: testingEvidence, found }), /build/);
  await assert.rejects(findEvidence({ api, repository: REPO, kind: 'testing', sha: 'not-a-sha' }), /SHA/);
});

test('UAT approval evidence: only a listed approver, a passed UAT and a named Testing deploy qualify', async () => {
  const api = evidenceApi();
  const found = await findEvidence({ api, repository: REPO, kind: 'approval', sha: SHA });
  assert.equal(found.actor, 'Alex1122341');
  assert.equal((await checkEvidence({ api, repository: REPO, kind: 'approval', sha: SHA, evidence: approvalEvidence, found, approvers: ['alex1122341'] })).ok, true);
  await assert.rejects(checkEvidence({ api, repository: REPO, kind: 'approval', sha: SHA, evidence: approvalEvidence, found, approvers: [] }), /PAWS_RELEASE_APPROVERS is empty/);
  await assert.rejects(checkEvidence({ api, repository: REPO, kind: 'approval', sha: SHA, evidence: approvalEvidence, found, approvers: ['someone-else'] }), /not a listed approver/);
  await assert.rejects(checkEvidence({ api, repository: REPO, kind: 'approval', sha: SHA, evidence: { ...approvalEvidence, uatOutcome: 'failed', decision: 'rejected' }, found, approvers: ['alex1122341'] }), /decision=rejected/);
  await assert.rejects(checkEvidence({ api, repository: REPO, kind: 'approval', sha: SHA, evidence: { ...approvalEvidence, approver: 'mallory' }, found, approvers: ['alex1122341', 'mallory'] }), /listed approver/);
  await assert.rejects(checkEvidence({ api, repository: REPO, kind: 'approval', sha: SHA, evidence: { ...approvalEvidence, testingRunId: '' }, found, approvers: ['alex1122341'] }), /Testing deploy/);
  await assert.rejects(findEvidence({ api: evidenceApi({ approvalRun: { conclusion: 'failure' } }), repository: REPO, kind: 'approval', sha: SHA }), /RELEASE_APPROVAL_REQUIRED|concluded failure/);
});

// ------------------------------------------------------------------ workflows
const workflow = name => read(path.join('.github', 'workflows', name));

test('release approval workflow: main only, listed approvers, Testing pass required, failed UAT never approves', () => {
  const text = workflow('paws-release-approval.yml');
  assert.match(text, /\[ "\$GITHUB_REF" = "refs\/heads\/main" \]/);
  assert.match(text, /PAWS_RELEASE_APPROVERS: \$\{\{ vars\.PAWS_RELEASE_APPROVERS \}\}/);
  assert.match(text, /APPROVER_NOT_LISTED/);
  assert.match(text, /verify-release-evidence\.js find --kind testing/);
  assert.match(text, /name: paws-release-approval-\$\{\{ inputs\.commit_sha \}\}/);
  assert.match(text, /if: inputs\.uat_outcome != 'passed'[\s\S]*exit 1/);
  assert.match(text, /^\s{2}record_approval:/m, 'job id matches the evidence checker');
  assert.doesNotMatch(text, /\$\{\{ inputs\.uat_reference \}\}"/, 'free-text input is passed through env, never interpolated into a script');
});

test('release evidence helper requires main and checks every requested kind against the selected run', () => {
  const script = read('tools/require-release-evidence.sh');
  assert.match(script, /EVIDENCE_NOT_MAIN/);
  assert.match(script, /REQUIRE_RELEASE_APPROVAL[^\n]*kinds\+=\(testing approval\)/);
  assert.match(script, /check --kind "\$kind" --sha "\$COMMIT_SHA" --run "\$run_id"/);
});

test('Testing database reset: main only, listed operators, runner-only firewall rule removed afterwards, evidence kept', () => {
  const text = workflow('paws-testing-db-reset.yml');
  assert.match(text, /if: inputs\.confirm == 'RESET-TESTING'/);
  assert.match(text, /RESET_NOT_MAIN/);
  assert.match(text, /RESET_OPERATORS: \$\{\{ vars\.PAWS_TESTING_RESET_OPERATORS \}\}/);
  assert.match(text, /RESET_NOT_AUTHORIZED/);
  assert.ok(text.indexOf('RESET_NOT_AUTHORIZED') < text.indexOf('reset-testing-db.js'), 'authorization precedes any SQL connection');
  assert.match(text, /firewall-rule create[\s\S]*--start-ip-address "\$ip" --end-ip-address "\$ip"/);
  assert.match(text, /name: Close the Testing SQL firewall rule\r?\n\s*if: always\(\)/);
  assert.match(text, /paws-testing-reset-\$\{\{ github\.run_id \}\}/);
  assert.doesNotMatch(text, /^\s*environment:\s/m);
  for (const name of ['paws-testing-deploy.yml', 'paws-testing-db-reset.yml', 'paws-release-approval.yml']) {
    assert.doesNotMatch(workflow(name), /FIREBASE_SERVICE_ACCOUNT_TESTER_TEACHING/, `${name} never uses the Production Firebase credential`);
  }
});

test('ordinary Testing deploys never reset or seed the database', () => {
  const text = workflow('paws-testing-deploy.yml');
  assert.doesNotMatch(text, /reset-testing-db|seed-base|seed-workflows|provision-test-accounts/);
});
