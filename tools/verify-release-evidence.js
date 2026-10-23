'use strict';
// Release evidence checks for Production release paths (PR #125 I4/I5).
//
// GitHub Environment "Required reviewers" are not available for this private, personally owned
// repository, so the release gates are evidence produced by workflows that only run from `main`:
//
//   Build       Azure Beta Build (push, main) for the exact SHA                    -> artifact azure-beta-<sha>
//   Deployment  PAWS Testing Deploy, job deploy_testing succeeded for the SHA      -> artifact paws-testing-deploy-<sha>
//   Acceptance  PAWS Release Approval by a listed approver, UAT outcome "passed"   -> artifact paws-release-approval-<sha>
//
// A run counts only if: same repository; workflow file path is exact; the workflow definition came from
// main (head_branch == main), so a branch with an edited workflow cannot mint evidence; the run and the
// named job concluded "success"; and the evidence file inside the artifact names the same SHA and result.
//
//   node tools/verify-release-evidence.js find --kind testing|approval --sha <sha>      -> prints {runId, artifactId}
//   node tools/verify-release-evidence.js check --kind testing|approval --sha <sha> --run <runId> --file <evidence.json> [--approvers a,b]
//
// Environment: GH_TOKEN (actions:read), GITHUB_REPOSITORY, optional GITHUB_API_URL.
const fs = require('node:fs');
const path = require('node:path');
const {canonicalDigest,validateRuntimeAttestation}=require('./testing-runtime-attestation');
const {BASELINE_COMMIT}=require('./beta-freeze');

const SHA = /^[0-9a-f]{40}$/;
const KINDS = Object.freeze({
  testing: { workflow: '.github/workflows/paws-testing-deploy.yml', job: 'deploy_testing', artifact: sha => `paws-testing-deploy-${sha}`, file: 'testing-deploy-evidence.json' },
  approval: { workflow: '.github/workflows/paws-release-approval.yml', job: 'record_approval', artifact: sha => `paws-release-approval-${sha}`, file: 'release-approval-evidence.json' }
});
const BUILD_WORKFLOW = '.github/workflows/azure-beta-build.yml';

class EvidenceError extends Error { constructor(code, message) { super(message); this.code = code; } }
const fail = (code, message) => { throw new EvidenceError(code, message); };

function githubApi({ token = process.env.GH_TOKEN, base = process.env.GITHUB_API_URL || 'https://api.github.com', fetchImpl = fetch } = {}) {
  if (!token) fail('EVIDENCE_TOKEN_MISSING', 'GH_TOKEN is required');
  return async path => {
    const response = await fetchImpl(base + path, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
    if (!response.ok) fail('EVIDENCE_API_ERROR', `GitHub API ${path.split('?')[0]} returned ${response.status}`);
    return response.json();
  };
}

function assertRun(run, { repository, workflow, label }) {
  if (!run || run.repository?.full_name !== repository) fail('EVIDENCE_FOREIGN_RUN', `${label} run is not from ${repository}`);
  if (run.path !== workflow) fail('EVIDENCE_WRONG_WORKFLOW', `${label} run ${run.id} is ${run.path}, expected ${workflow}`);
  if (run.head_branch !== 'main') fail('EVIDENCE_NOT_MAIN', `${label} run ${run.id} used the workflow definition from ${run.head_branch}, not main`);
  if (run.status !== 'completed' || run.conclusion !== 'success') fail('EVIDENCE_NOT_SUCCESS', `${label} run ${run.id} concluded ${run.conclusion}`);
}

// Finds the newest qualifying run whose evidence artifact names this SHA.
async function findEvidence({ api, repository, kind, sha }) {
  const spec = KINDS[kind];
  if (!spec) fail('EVIDENCE_KIND', `unknown evidence kind ${kind}`);
  if (!SHA.test(String(sha))) fail('EVIDENCE_SHA', 'a 40-character lowercase commit SHA is required');
  const listing = await api(`/repos/${repository}/actions/artifacts?name=${encodeURIComponent(spec.artifact(sha))}&per_page=100`);
  const artifacts = (listing.artifacts || []).filter(a => a.name === spec.artifact(sha) && !a.expired).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const reasons = [];
  for (const artifact of artifacts) {
    try {
      const run = await api(`/repos/${repository}/actions/runs/${artifact.workflow_run.id}`);
      assertRun(run, { repository, workflow: spec.workflow, label: kind });
      const jobs = await api(`/repos/${repository}/actions/runs/${run.id}/jobs?per_page=100`);
      const job = (jobs.jobs || []).find(item => item.name === spec.job);
      if (!job || job.conclusion !== 'success') fail('EVIDENCE_JOB_NOT_SUCCESS', `${kind} run ${run.id} job ${spec.job} is ${job ? job.conclusion : 'missing'}`);
      return { runId: run.id, artifactId: artifact.id, artifactName: artifact.name, file: spec.file, actor: run.triggering_actor?.login || run.actor?.login || null };
    } catch (error) {
      if (!(error instanceof EvidenceError)) throw error;
      reasons.push(error.message);
    }
  }
  fail(kind === 'testing' ? 'TESTING_PASS_REQUIRED' : 'RELEASE_APPROVAL_REQUIRED',
    `no qualifying ${kind} evidence for ${sha}${reasons.length ? ': ' + reasons.join('; ') : ''}`);
}

// Validates the evidence file downloaded from the run returned by findEvidence.
async function checkEvidence({ api, repository, kind, sha, evidence, found, approvers = [], expectedTestingConfig }) {
  if (!evidence || typeof evidence !== 'object') fail('EVIDENCE_FILE', 'evidence file is missing or not JSON');
  if (evidence.commitSha !== sha) fail('EVIDENCE_SHA_MISMATCH', `evidence names ${evidence.commitSha}, expected ${sha}`);
  if (kind === 'testing') {
    if (evidence.environment !== 'testing' || evidence.status !== 'success') fail('EVIDENCE_RESULT', `Testing evidence reports environment=${evidence.environment} status=${evidence.status}`);
    // The Testing deploy must itself have come from a successful main build of the same SHA.
    const build = await api(`/repos/${repository}/actions/runs/${encodeURIComponent(String(evidence.sourceRunId))}`);
    assertRun(build, { repository, workflow: BUILD_WORKFLOW, label: 'build' });
    if (build.event !== 'push' || build.head_sha !== sha) fail('EVIDENCE_BUILD_MISMATCH', `build ${build.id} is ${build.event} of ${build.head_sha}`);
    if(String(evidence.runId)!==String(found?.runId)||evidence.targetProfile!=='university-testing'||!evidence.runtimeAttestation||canonicalDigest(evidence.runtimeAttestation)!==evidence.runtimeAttestationDigest)fail('EVIDENCE_ATTESTATION','Testing runtime attestation/run digest mismatch');
    const expectedGates=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname,'../deploy/testing/write-gate-matrix.json'),'utf8')).gates.map(row=>[row.gate,row.testing]));
    try{validateRuntimeAttestation(evidence.runtimeAttestation,{commitSha:sha,testing:expectedTestingConfig||{apiOrigin:evidence.apiOrigin,siteUrl:evidence.siteUrl,firebase:{projectId:evidence.runtimeAttestation.firebaseProjectId}},trustAnchor:BASELINE_COMMIT,expectedGates});}
    catch{fail('EVIDENCE_ATTESTATION','Testing runtime attestation source/target/gates are not accepted');}
    const proof=evidence.runtimeAttestation;
    if(proof.sourceRunId!==build.id||proof.sourceArtifactDigest!==evidence.sourceArtifactDigest||evidence.trustAnchor!==BASELINE_COMMIT||proof.trustAnchor!==evidence.trustAnchor||proof.gateFingerprint!==evidence.gateFingerprint)fail('EVIDENCE_ATTESTATION','Testing source artifact/gate/trust anchor digest mismatch');
    const artifacts=await api(`/repos/${repository}/actions/runs/${build.id}/artifacts?per_page=100`);
    const source=(artifacts.artifacts||[]).filter(item=>item.id===proof.sourceArtifactId&&item.name==='azure-beta-'+sha&&!item.expired&&item.digest===proof.sourceArtifactDigest&&item.workflow_run?.id===build.id&&item.workflow_run?.head_sha===sha);
    if(source.length!==1)fail('EVIDENCE_ARTIFACT','Testing source artifact digest is unavailable or mismatched');
    return { ok: true, kind, sha, runId: found && found.runId, sourceRunId: build.id,targetProfile:'university-testing',runtimeAttestationDigest:evidence.runtimeAttestationDigest };
  }
  const list = approvers.map(item => String(item).trim().toLowerCase()).filter(Boolean);
  if (!list.length) fail('RELEASE_APPROVERS_UNSET', 'PAWS_RELEASE_APPROVERS is empty');
  if (evidence.decision !== 'approved' || evidence.uatOutcome !== 'passed') fail('EVIDENCE_RESULT', `approval evidence reports decision=${evidence.decision} uat=${evidence.uatOutcome}`);
  const approver = String(found && found.actor || '').toLowerCase();
  if (!list.includes(approver) || String(evidence.approver || '').toLowerCase() !== approver) fail('EVIDENCE_APPROVER', `approval run was started by ${approver || 'unknown'}, who is not a listed approver`);
  if (!evidence.testingRunId) fail('EVIDENCE_RESULT', 'approval evidence does not name the Testing deploy it accepted');
  const acceptedTesting=await findEvidence({api,repository,kind:'testing',sha});
  if(String(evidence.testingRunId)!==String(acceptedTesting.runId))fail('EVIDENCE_TESTING_RUN_MISMATCH','Approval does not name the currently accepted Testing run');
  return { ok: true, kind, sha, runId: found.runId, approver };
}

async function main(argv, env = process.env) {
  const arg = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const command = argv[0], kind = arg('--kind'), sha = arg('--sha');
  const repository = env.GITHUB_REPOSITORY;
  if (!repository) fail('EVIDENCE_REPOSITORY', 'GITHUB_REPOSITORY is required');
  const api = githubApi({ token: env.GH_TOKEN, base: env.GITHUB_API_URL || 'https://api.github.com' });
  const found = await findEvidence({ api, repository, kind, sha });
  if (command === 'find') return found;
  // `check` must validate the file downloaded from the run `find` selected, not a newer one.
  if (arg('--run') && String(found.runId) !== String(arg('--run'))) fail('EVIDENCE_RUN_CHANGED', `qualifying run changed from ${arg('--run')} to ${found.runId}`);
  if (command !== 'check') fail('EVIDENCE_USAGE', 'usage: find|check --kind testing|approval --sha <sha> [--file <evidence.json>] [--approvers a,b]');
  const evidence = JSON.parse(fs.readFileSync(arg('--file'), 'utf8'));
  return checkEvidence({ api, repository, kind, sha, evidence, found, approvers: String(arg('--approvers') || env.PAWS_RELEASE_APPROVERS || '').split(','),expectedTestingConfig:require('./render-environment-config').loadConfig('testing') });
}

if (require.main === module) {
  main(process.argv.slice(2)).then(result => console.log(JSON.stringify(result)), error => {
    console.error(`${error.code || 'EVIDENCE_FAILED'}: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { findEvidence, checkEvidence, githubApi, assertRun, KINDS, EvidenceError };
