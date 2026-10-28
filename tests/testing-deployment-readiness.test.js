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
  const publisher=fs.readFileSync(path.join(root,'tools/testing/publish-testing-hosting.js'),'utf8');
  assert.match(workflow,/publish-testing-hosting\.js/);
  assert.ok(publisher.includes("path.join(ROOT,'.azure-testing/app')")&&publisher.includes("path.join(ROOT,'.firebase-production/app')"));
  assert.match(publisher,/['"]--config['"],['"]firebase\.hosting-only\.json['"]/);
});
const { GATE_ENV, createWriteGates } = require('../server/src/data/write-gates');
const { verifyTestingApiEnv, parseEnvFile } = require('../tools/testing/verify-testing-api-env');
const { preflight } = require('../tools/testing/testing-preflight');
const { loadConfig, validateConfig, validatePair, render } = require('../tools/render-environment-config');
const { findEvidence, checkEvidence } = require('../tools/verify-release-evidence');
const publishModule=fs.existsSync(path.join(root,'tools/testing/publish-testing-hosting.js'))?require('../tools/testing/publish-testing-hosting'):{};

test('Testing Hosting remains fixed to its own site and independent Testing identity', () => {
  const { resolveTestingHostingProject } = publishModule;
  const labTesting = { environment: 'testing', siteUrl: 'https://paws-testing-ucvm-20261022.web.app', firebase: { projectId: 'paws-testing-ucvm-20261022' } };
  assert.equal(resolveTestingHostingProject(labTesting), 'paws-testing-ucvm-20261022');
  for (const siteUrl of ['https://tester-teaching.web.app', 'https://vista-teaching-lab.web.app', null]) {
    assert.throws(() => resolveTestingHostingProject({ ...labTesting, siteUrl }));
  }
  assert.throws(() => resolveTestingHostingProject({ ...labTesting, environment: 'production' }));
  assert.throws(() => resolveTestingHostingProject({ ...labTesting, firebase: { projectId: 'tester-teaching' } }));
  assert.throws(() => resolveTestingHostingProject({ ...labTesting, firebase: { projectId: 'vista-teaching-lab' } }));
  const publisher = fs.readFileSync(path.join(root, 'tools/testing/publish-testing-hosting.js'), 'utf8');
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/paws-testing-deploy.yml'), 'utf8');
  assert.match(publisher, /'--project',resolveTestingHostingProject\(testing\)/);
  assert.match(workflow, /key\.project_id!==resolveTestingHostingProject\(testing\)/);
});

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
  fs.mkdirSync(path.join(dir, 'tools', 'testing', 'config'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'tools', 'testing', 'config', 'environment.json'), JSON.stringify(testing));
  fs.mkdirSync(path.join(dir,'tools/testing/config'),{recursive:true});fs.copyFileSync(path.join(root,'tools/testing/config/write-gate-matrix.json'),path.join(dir,'tools/testing/config/write-gate-matrix.json'));
  return dir;
}
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// ------------------------------------------------------------------ write-gate matrix
test('write-gate matrix lists every gate exactly once with its real variable and enforcing modules', () => {
  const matrix = JSON.parse(read('tools/testing/config/write-gate-matrix.json')).gates;
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
  const template = parseEnvFile(read('tools/testing/config/testing-api.env.template'));
  const byName = Object.fromEntries(template.map(e => [e.name, e.value]));
  const matrix = JSON.parse(read('tools/testing/config/write-gate-matrix.json')).gates;
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

const universityEnv=()=>withEnv({PAWS_TESTING_SQL_PROFILE:'university-testing',PAWS_TESTING_DATABASE:'VetMed-Ops-Testing',
 PAWS_TESTING_SQL_SERVER:'itappvetopsdb01',PAWS_SQL_CONNECTION_STRING:'Server=ITAPPVETOPSDB01;Database=VetMed-Ops-Testing;Encrypt=true;TrustServerCertificate=false',
 PAWS_SQL_MI_CLIENT_ID:undefined,PAWS_SQL_DRIVER:'msnodesqlv8',PAWS_API_HOST:'127.0.0.1',PAWS_API_PORT:'18788',PAWS_API_ALLOW_NON_LOOPBACK:undefined});
test('University preflight needs no Azure identity',()=>{
 const dir=configRoot(),options={root:dir,profile:'university-testing'};
 assert.deepEqual(verifyTestingApiEnv(universityEnv(),options).errors,[]);
 for(const patch of [{PAWS_TESTING_SQL_PROFILE:undefined},{PAWS_TESTING_DATABASE:undefined},{PAWS_SQL_CONNECTION_STRING:'Server=ITAPPVETOPSDB01;Database=VetMed-Ops-Testing;Encrypt=false'},
  {PAWS_SQL_MI_CLIENT_ID:'1b2c3d4e-5f60-4718-9a0b-1c2d3e4f5a6b'},{PAWS_TA_DRAFT_WRITE_ENABLED:undefined}]){
  assert.ok(verifyTestingApiEnv(withEnv(patch,universityEnv()),options).errors.length>0);
 }
});
test('malformed private env lines never echo credential content',()=>{
 assert.throws(()=>parseEnvFile('DO_NOT_LOG_SECRET'),error=>!error.message.includes('DO_NOT_LOG_SECRET'));
});
test('preflight CLI sanitizes malformed private JSON',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paws-private-preflight-')),file=path.join(dir,'private.json');fs.writeFileSync(file,'DO_NOT_LOG_SECRET');
 const result=require('node:child_process').spawnSync(process.execPath,[path.join(root,'tools/testing/testing-preflight.js'),'--api-env',file,'--profile','university-testing'],{encoding:'utf8'});
 assert.notEqual(result.status,0);assert.ok(!(result.stdout+result.stderr).includes('DO_NOT_LOG_SECRET'));
});
test('publisher verifies bytes from the Testing artifact rather than the working repository',()=>{
 assert.equal(typeof publishModule.verifyTestingStaticArtifact,'function');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paws-static-probe-')),source=path.join(dir,'artifact');fs.mkdirSync(source);
 fs.writeFileSync(path.join(dir,'index.html'),'repository bytes');fs.writeFileSync(path.join(source,'index.html'),'artifact bytes');
 const freeze={protectedPaths:()=>['index.html'],verifyFreeze(options){assert.equal(options.readWorking({file:'index.html'}).toString(),'artifact bytes');return {ok:true};}};
 assert.equal(publishModule.verifyTestingStaticArtifact({root:dir,source,freeze}).ok,true);
 fs.writeFileSync(path.join(source,'unlisted-private.txt'),'must not publish');assert.throws(()=>publishModule.verifyTestingStaticArtifact({root:dir,source,freeze}),/artifact|inventory/i);
});
test('Testing publication verifies every served artifact byte including binary files',async()=>{
 assert.equal(typeof publishModule.verifyServedArtifacts,'function');
 const source=fs.mkdtempSync(path.join(os.tmpdir(),'paws-served-proof-'));fs.writeFileSync(path.join(source,'index.html'),'accepted html');fs.writeFileSync(path.join(source,'guide.pdf'),Buffer.from([0,1,2,255]));
 const files=['index.html','guide.pdf'],seen=[];
 const fetchImpl=async url=>{const name=new URL(url).pathname.slice(1);seen.push(name);return {status:200,arrayBuffer:async()=>fs.readFileSync(path.join(source,name))};};
 await publishModule.verifyServedArtifacts({source,files,siteUrl:testingConfig.siteUrl,commitSha:'a'.repeat(40),fetchImpl});assert.deepEqual(seen.sort(),files.sort());
 await assert.rejects(publishModule.verifyServedArtifacts({source,files,siteUrl:testingConfig.siteUrl,commitSha:'a'.repeat(40),fetchImpl:async()=>({status:200,arrayBuffer:async()=>Buffer.from('old response')})}),/served|artifact|byte/i);
});

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

test('Testing API environment: an unprovisioned configuration is reported, not assumed', () => {
  const unprovisioned = configRoot({ ...testingConfig, firebase: null, siteUrl: null }, { ...production, peerSiteUrl: null });
  const { errors } = verifyTestingApiEnv(goodEnv(), { root: unprovisioned });
  assert.ok(errors.some(error => /environment\.json is not provisioned/.test(error)));
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
  const template = JSON.parse(read('tools/testing/config/testing.template.json'));
  const errors = validateConfig(template, { environment: 'testing' });
  assert.ok(errors.some(error => /placeholder/.test(error)));
});

// ------------------------------------------------------------------ preflight
test('preflight recognizes the Testing Firebase app and site but fails closed without the API', async () => {
  const result = await preflight({ root });
  assert.equal(result.ok, false);
  assert.equal(result.provisioned, false);
  assert.equal(result.checks.find(item => item.id === 'config.testing.firebase').status, 'pass');
  assert.equal(loadConfig('testing').firebase.projectId, 'paws-testing-ucvm-20261022');
  assert.equal(result.checks.find(item => item.id === 'config.testing.siteUrl').status, 'pass');
  assert.equal(loadConfig('testing').siteUrl, 'https://paws-testing-ucvm-20261022.web.app');
  for (const id of ['config.testing.apiOrigin']) {
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

test('offline staged API cannot publish Hosting',async()=>{
 assert.equal(typeof publishModule.publishTesting,'function','Publishing must be guarded by a testable probe boundary');
 const gates=Object.fromEntries(Object.keys(GATE_ENV).map(key=>[key,true])),anchor=require('../tools/beta-freeze').BASELINE_COMMIT;
 const attestation={version:1,kind:'operator-runtime-attestation',status:'READY',repository:'Alex1122341/Teaching-assignment-azure',commitSha:'a'.repeat(40),sourceRunId:202,
  sourceArtifactId:777,sourceArtifactDigest:'sha256:'+'c'.repeat(64),trustAnchor:anchor,targetProfile:'university-testing',
  target:{profile:'university-testing',host:'itappvetopsdb01',physicalServer:'ITAPPVETOPSDB01',database:'VetMed-Ops-Testing',environmentId:'7e570000-0000-4000-8000-00000000c0de'},
  firebaseProjectId:testingConfig.firebase.projectId,apiOrigin:testingConfig.apiOrigin,siteUrl:testingConfig.siteUrl,gates,
  gateFingerprint:publishModule.canonicalDigest(gates),stagedManifestDigest:'d'.repeat(64),nodeMajor:22,sqlDriver:'msnodesqlv8',strictTls:true};
 const build={id:202,repository:{full_name:attestation.repository},path:'.github/workflows/azure-beta-build.yml',event:'push',head_branch:'main',head_sha:attestation.commitSha,status:'completed',conclusion:'success'};
 const sourceArtifact={id:777,name:'azure-beta-'+attestation.commitSha,expired:false,digest:attestation.sourceArtifactDigest,workflow_run:{id:202,head_sha:attestation.commitSha}};
 const dir=configRoot(),runtime={status:'ok',service:'paws-university-api',authority:'vetmed-ops-sql',environment:'testing',releaseSha:attestation.commitSha,runtimeTrustAnchor:anchor,writeGates:gates};
 for(const patch of [{offline:true},{runtime:{...runtime,releaseSha:'b'.repeat(40)}},{runtime:{...runtime,writeGates:{}}},{me:200},{foreignCors:204},
  {attestation:{...attestation,targetProfile:'azure'}},{attestation:{...attestation,stagedManifestDigest:'wrong'}},{attestationDigest:'0'.repeat(64)}]){
  const calls=[],a=patch.attestation||attestation;
  await assert.rejects(publishModule.publishTesting({root:dir,commitSha:attestation.commitSha,build,sourceArtifact,attestation:a,attestationDigest:patch.attestationDigest||publishModule.canonicalDigest(a),
   fetchImpl:patch.offline?async()=>{throw Error('offline');}:fakeFetch({runtime,...patch}),deployHosting:async()=>calls.push('hosting')}),/Testing|attestation|API|probe|gate|runtime/i);
  assert.deepEqual(calls,[]);
 }
 const calls=[];const result=await publishModule.publishTesting({root:dir,commitSha:attestation.commitSha,build,sourceArtifact,attestation,attestationDigest:publishModule.canonicalDigest(attestation),fetchImpl:fakeFetch({runtime}),deployHosting:async()=>calls.push('hosting')});
 assert.deepEqual(calls,['hosting']);assert.equal(result.status,'success');assert.equal(result.targetProfile,'university-testing');
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
    if(p==='/repos/'+REPO+'/actions/runs/202/artifacts?per_page=100')return {artifacts:[{id:777,name:'azure-beta-'+SHA,expired:false,digest:'sha256:'+'c'.repeat(64),workflow_run:{id:202,head_sha:SHA}}]};
    const jobs = /\/runs\/(\d+)\/jobs/.exec(p);
    if (jobs) return { jobs: [{ name: jobs[1] === '303' ? 'record_approval' : 'deploy_testing', conclusion: jobs[1] === '303' ? 'success' : job }] };
    const run = /\/runs\/(\d+)$/.exec(p);
    if (run) return runs[run[1]];
    throw new Error('unexpected ' + p);
  };
}
const evidenceGates=Object.fromEntries(Object.keys(GATE_ENV).map(key=>[key,true])),evidenceAnchor=require('../tools/beta-freeze').BASELINE_COMMIT;
const evidenceAttestation={version:1,kind:'operator-runtime-attestation',status:'READY',repository:REPO,commitSha:SHA,sourceRunId:202,sourceArtifactId:777,sourceArtifactDigest:'sha256:'+'c'.repeat(64),trustAnchor:evidenceAnchor,targetProfile:'university-testing',
 target:{profile:'university-testing',host:'itappvetopsdb01',physicalServer:'ITAPPVETOPSDB01',database:'VetMed-Ops-Testing',environmentId:'7e570000-0000-4000-8000-00000000c0de'},firebaseProjectId:testingConfig.firebase.projectId,apiOrigin:testingConfig.apiOrigin,siteUrl:testingConfig.siteUrl,
 gates:evidenceGates,gateFingerprint:publishModule.canonicalDigest(evidenceGates),stagedManifestDigest:'d'.repeat(64),nodeMajor:22,sqlDriver:'msnodesqlv8',strictTls:true};
const testingEvidence = { environment: 'testing', commitSha: SHA, sourceRunId: '202', status: 'success',runId:101,targetProfile:'university-testing',runtimeAttestation:evidenceAttestation,runtimeAttestationDigest:publishModule.canonicalDigest(evidenceAttestation),sourceArtifactDigest:evidenceAttestation.sourceArtifactDigest,trustAnchor:evidenceAnchor,gateFingerprint:evidenceAttestation.gateFingerprint,apiOrigin:testingConfig.apiOrigin,siteUrl:testingConfig.siteUrl };
const approvalEvidence = { kind: 'release-approval', commitSha: SHA, approver: 'Alex1122341', uatOutcome: 'passed', decision: 'approved', uatReference: 'PR #125 comment', testingRunId: '101' };

test('Testing-pass evidence: a main-defined successful deploy of the same SHA from a main build qualifies', async () => {
  const api = evidenceApi();
  const found = await findEvidence({ api, repository: REPO, kind: 'testing', sha: SHA });
  assert.equal(found.runId, 101);
  assert.equal((await checkEvidence({ api, repository: REPO, kind: 'testing', sha: SHA, evidence: testingEvidence, found })).ok, true);
});

test('Testing evidence rejects missing runtime proof changed digest and another source artifact',async()=>{
 const api=evidenceApi(),found=await findEvidence({api,repository:REPO,kind:'testing',sha:SHA});
 for(const patch of [{runtimeAttestation:undefined},{runtimeAttestationDigest:'0'.repeat(64)},
  {sourceArtifactDigest:'sha256:'+'f'.repeat(64)},{gateFingerprint:'f'.repeat(64)},{trustAnchor:'f'.repeat(40)},{runId:999}]){
  await assert.rejects(checkEvidence({api,repository:REPO,kind:'testing',sha:SHA,evidence:{...testingEvidence,...patch},found}),/attestation|digest|source|gate|anchor|run/i);
 }
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

test('approval cannot substitute another Testing run',async()=>{
 const api=evidenceApi(),found=await findEvidence({api,repository:REPO,kind:'approval',sha:SHA});
 await assert.rejects(checkEvidence({api,repository:REPO,kind:'approval',sha:SHA,evidence:{...approvalEvidence,testingRunId:'999'},found,approvers:['alex1122341']}),/Testing.*run|accepted.*Testing|mismatch/i);
});

test('University Testing deployment workflow has no Azure mutation or automatic publish path',()=>{
 const text=workflow('paws-testing-deploy.yml');
 assert.ok(!text.includes('azure/login'));
 assert.doesNotMatch(text,/workflow_run:|az containerapp|az acr|id-token: write/);
 assert.match(text,/runtime_attestation_json:/);assert.match(text,/runtime_attestation_sha256:/);
 assert.match(text,/refs\/heads\/main/);assert.match(text,/publish-testing-hosting\.js/);
 const retired=workflow('paws-testing-db-reset.yml');
 assert.doesNotMatch(retired,/azure\/login|az (?:containerapp|acr|sql)|reset-testing-db\.js|docker (?:build|push)/i);
 assert.match(retired,/retired/i);
 for (const obsolete of ['azure-beta-aca-deploy.yml', 'azure-beta-acr-publish.yml']) {
   assert.equal(fs.existsSync(path.join(root,'.github','workflows',obsolete)),false, obsolete+' must remain removed');
 }
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

test('retired cloud reset cannot mutate SQL and live reset stays in guarded University tooling', () => {
  const text = workflow('paws-testing-db-reset.yml');
  assert.match(text,/RETIRED_OPERATION/);assert.doesNotMatch(text,/azure\/login|az sql|reset-testing-db\.js|id-token: write/);
  const local=read('tools/testing/db/university-admin.js');assert.match(local,/RESET-TESTING/);assert.match(local,/backupTesting/);assert.match(local,/withExclusiveReset/);
  for (const name of ['paws-testing-deploy.yml', 'paws-testing-db-reset.yml', 'paws-release-approval.yml']) {
    assert.doesNotMatch(workflow(name), /FIREBASE_SERVICE_ACCOUNT_TESTER_TEACHING/, `${name} never uses the Production Firebase credential`);
  }
});

test('ordinary Testing deploys never reset or seed the database', () => {
  const text = workflow('paws-testing-deploy.yml');
  assert.doesNotMatch(text, /reset-testing-db|seed-base|seed-workflows|provision-test-accounts/);
});
