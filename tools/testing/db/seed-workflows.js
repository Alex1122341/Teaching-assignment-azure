'use strict';
// Workflow fixtures for the PAWS Testing database (run by reset-testing-db.js after the base seed).
//
// The base seed (seed-base.sql / seed-ta.sql) loads reference data directly. Workflow states (AFC
// requests at each stage, a pending swap, a submitted Teaching Assignment package) are instead created
// through the REAL PAWS API code in-process, as the synthetic personas, so every row, revision and audit
// event is exactly what the application itself writes. Nothing here is served to a browser.
//
// Safety: the in-process runtime is the normal createSwaSqlRuntime, so it refuses to run unless
// PAWS_ENVIRONMENT=testing and the database carries this Testing marker. Firebase verification is
// replaced by a local verifier that accepts only "syn-fixture:<uid>" tokens for seeded synthetic users.
const { randomUUID, createHash } = require('node:crypto');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const SYNTHETIC_UIDS = Object.freeze(['syn-admin', 'syn-hicc', 'syn-visc', 'syn-faculty-a', 'syn-faculty-b', 'syn-faculty-reportee', 'syn-adc', 'syn-lab']);
const TA_PACKAGE_SUBMITTED = '7a000000-0000-4000-8000-000000000200';
const TERMS = Object.freeze({ termsAccepted: true, termsVersion: 'ucvm-afc-terms-page2-v1', termsSource: 'absence-from-campus-app.pdf#page=2' });

function fixtureAdmin(projectId) {
  return { credential: { cert: () => ({}) }, initializeApp: () => ({}), auth: () => ({ async verifyIdToken(token) {
    const uid = String(token).startsWith('syn-fixture:') ? String(token).slice(12) : '';
    if (!SYNTHETIC_UIDS.includes(uid)) throw new Error('invalid fixture token');
    return { uid, aud: projectId, iss: `https://securetoken.google.com/${projectId}` };
  } }) };
}

// Every gate open for the fixture run only; this never changes the deployed Testing API's own gates.
function fixtureEnv(env) {
  const { GATE_ENV } = require(path.join(ROOT, 'server/src/data/write-gates'));
  const out = { ...env };
  for (const name of Object.values(GATE_ENV)) out[name] = 'true';
  return out;
}

const signature = (name, uid, salt) => ({ mode: 'typed', name, uid, signedAt: '2026-10-15T15:00:00.000Z', fingerprint: createHash('sha256').update(`synthetic|${uid}|${salt}`).digest('hex'), attested: true });

function createClient(handler) {
  return async function call(uid, method, url, body) {
    const headers = { authorization: `Bearer syn-fixture:${uid}` };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const result = await handler(new Request('http://fixtures.local' + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
    return { status: result.status, data: result.jsonBody || null };
  };
}

function expect(step, response, statuses) {
  if (!statuses.includes(response.status)) {
    const code = response.data && response.data.error ? `${response.data.error.code}: ${response.data.error.message}` : JSON.stringify(response.data).slice(0, 300);
    throw new Error(`fixture step "${step}" returned ${response.status} (${code})`);
  }
  return response.data;
}

async function seedWorkflows({ handler, log = () => {} }) {
  const call = createClient(handler);
  const created = [];
  const me = expect('faculty profile', await call('syn-faculty-a', 'GET', '/api/v1/me'), [200]);
  const name = me.profile.displayName;

  // AFC self-service requests in every lifecycle state.
  const afc = async (label, startDate, endDate) => {
    const body = { startDate, endDate, reason: 'vacation', coverage: 'Synthetic colleague covers teaching', contactAddress: '1 Synthetic Way', contactPhone: '403-555-0100',
      ...TERMS, applicantSignature: signature(name, 'syn-faculty-a', label) };
    const data = expect(`AFC request ${label}`, await call('syn-faculty-a', 'POST', '/api/v1/afc-requests', body), [200, 201]);
    return data.afcRequest.afcRequestId;
  };
  const decide = async (uid, action, id, extra = {}) => {
    const actor = expect(`${uid} profile`, await call(uid, 'GET', '/api/v1/me'), [200]).profile.displayName;
    return expect(`AFC ${action} by ${uid}`, await call(uid, 'POST', `/api/v1/afc-requests/${id}/${action}`, { signature: signature(actor, uid, `${action}|${id}`), ...extra }), [200]);
  };
  const pendingReportTo = await afc('pending-report-to', '2027-02-01', '2027-02-02');
  created.push({ fixture: 'afc.pending_report_to', id: pendingReportTo });
  const approved = await afc('approved', '2027-02-15', '2027-02-16');
  await decide('syn-hicc', 'recommend', approved);
  await decide('syn-admin', 'approve', approved);
  created.push({ fixture: 'afc.approved', id: approved });
  const pendingAdmin = await afc('pending-admin', '2027-03-01', '2027-03-02');
  await decide('syn-hicc', 'recommend', pendingAdmin);
  created.push({ fixture: 'afc.pending_admin', id: pendingAdmin });
  const rejected = await afc('rejected', '2027-03-15', '2027-03-16');
  await decide('syn-hicc', 'reject', rejected, { rejectionReason: 'Synthetic: clinical coverage not confirmed' });
  created.push({ fixture: 'afc.rejected', id: rejected });
  const withdrawn = await afc('withdrawn', '2027-03-29', '2027-03-30');
  expect('AFC withdraw', await call('syn-faculty-a', 'POST', `/api/v1/afc-requests/${withdrawn}/withdraw`), [200]);
  created.push({ fixture: 'afc.withdrawn', id: withdrawn });
  log('workflow fixtures: AFC requests in five states');

  // A pending faculty self-replacement swap on one of syn-faculty-a's future VTMD 200 lectures.
  const sessions = expect('faculty timetable', await call('syn-faculty-a', 'GET', '/api/v1/sessions?start=2026-11-16&end=2027-04-30'), [200]).sessions || [];
  const lecture = sessions.find(s => s.courseCode === 'VTMD 200' && s.sessionType === 'LEC');
  if (!lecture) throw new Error('fixture step "swap" found no future VTMD 200 lecture for syn-faculty-a');
  const context = expect('swap context', await call('syn-faculty-a', 'GET', `/api/v1/swaps/context?sessionId=${lecture.id}`), [200]);
  const assignment = (context.assignments || []).find(a => a.canReplace) || (context.assignments || [])[0];
  const candidate = (context.candidates || []).find(c => c.available) || (context.candidates || [])[0];
  if (!assignment || !candidate || !context.session || !context.session.snapshotToken) throw new Error('fixture step "swap" has no replaceable assignment or candidate');
  const swap = expect('swap request', await call('syn-faculty-a', 'POST', '/api/v1/swaps', {
    requestId: randomUUID(), sessionId: lecture.id, assignmentId: assignment.assignmentId, snapshotToken: context.session.snapshotToken,
    changes: { replacementCandidateKey: candidate.candidateKey }, notifyReplacement: false, note: 'Synthetic swap awaiting decision'
  }), [200, 201]);
  created.push({ fixture: 'swap.pending', id: (swap.request && swap.request.requestId) || swap.requestId || null });
  log('workflow fixtures: pending swap');

  // Teaching Assignment: VTMD 200 submitted for VISC review; VTMD 202 stays in draft.
  const pkg = expect('TA package', await call('syn-hicc', 'GET', `/api/v1/teaching-assignments/packages/${TA_PACKAGE_SUBMITTED}`), [200]);
  const current = Number((pkg.package && (pkg.package.workingRevision ?? pkg.package.revision)) ?? pkg.workingRevision ?? 0);
  const draft = expect('TA draft', await call('syn-hicc', 'POST', `/api/v1/teaching-assignments/packages/${TA_PACKAGE_SUBMITTED}/draft`, { expectedWorkingRevision: current, sessions: [], revisionNote: 'Synthetic draft' }), [200, 201]);
  const revision = Number((draft.package && draft.package.workingRevision) ?? draft.workingRevision ?? current + 1);
  expect('TA submit', await call('syn-hicc', 'POST', `/api/v1/teaching-assignments/packages/${TA_PACKAGE_SUBMITTED}/submit`, { expectedWorkingRevision: revision }), [200, 201]);
  created.push({ fixture: 'ta.submitted', id: TA_PACKAGE_SUBMITTED });
  log('workflow fixtures: Teaching Assignment package submitted');
  return created;
}

module.exports = { seedWorkflows, fixtureAdmin, fixtureEnv, SYNTHETIC_UIDS, TA_PACKAGE_SUBMITTED };
