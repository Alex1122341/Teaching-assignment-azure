const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root=repositoryPath(__dirname,'..');
const read=name=>fs.readFileSync(repositoryPath(root,name),'utf8');
const maintenance=require('../frontend/scripts/index-maintenance.js');
const {functionBody}=require('../test-support/source-contract.js');

test('index maintenance exposes swap-index writers and safe AFC range patching',()=>{
 assert.equal(typeof maintenance.writeFacultySwapIndexes,'function');
 assert.equal(typeof maintenance.addFacultySwapUnavailableRange,'function');
 const next=maintenance.addFacultySwapUnavailableRange(
  {schemaVersion:'ucvm-faculty-swap-index-v1',entries:[{key:'k1',name:'Jane',aliases:['Jane'],unavailableRanges:[]}]},
  {schemaVersion:'ucvm-faculty-swap-map-v1',entries:[{key:'k1',facultyId:'f1'}]},
  'f1','2026-10-05','2026-10-07'
 );
 assert.deepEqual(next.entries[0].unavailableRanges,[{startDate:'2026-10-05',endDate:'2026-10-07'}]);
});

test('faculty self swap uses sanitized directory with availability and special targets',()=>{
 const src=read('faculty-swap-safe.js');
 for(const token of ['faculty_swap_index','candidateKey','Sessional','Other','assessSwapCandidate','swapCandidateDisplay'])assert.match(src,new RegExp(token));
 assert.match(src,/Reason \/ note is required for Sessional or Other/);
 assert.match(src,/reason\.required=special/);
 assert.doesNotMatch(src,/Search name, specialty, teaching area, UCID/i);
});

test('faculty session modal routes assigned replacements directly to the privacy-safe picker',()=>{
 const src=read('approval-workflow.js');
 const slice=functionBody(src,'function openFacultySession(s)');
 assert.ok(slice,'openFacultySession must exist');
 const body=slice.body;
 assert.match(body,/const openSelfReplacement=window\.UCVM_SAFE_SWAP\?\.openSelfReplacement/);
 assert.match(body,/if\(own\.length&&typeof openSelfReplacement==='function'\)return openSelfReplacement\(s\)/);
 assert.match(body,/return openSelfSwap\(s\)/);
});

test('legacy faculty swap handoff remains a non-intercepting compatibility asset',()=>{
 const handoffPath=repositoryPath(root,'faculty-swap-handoff.js');
 assert.equal(fs.existsSync(handoffPath),true,'faculty-swap-handoff.js must remain deployable');
 const src=fs.readFileSync(handoffPath,'utf8');
 assert.match(src,/UCVM_SAFE_SWAP_HANDOFF=\{mode:'direct-session-modal'\}/);
 assert.doesNotMatch(src,/#workflow-self-swap/);
 assert.doesNotMatch(src,/stopImmediatePropagation/);
 assert.doesNotMatch(src,/db\.collection\(SESSIONS\)/);
});

test('approval resolves opaque candidate keys through admin-only mapping and supports special categories',()=>{
 const src=read('faculty-swap-safe.js');
 assert.match(src,/faculty_swap_map/);
 assert.match(src,/candidateKey/);
 assert.match(src,/specialReplacement/);
 assert.match(src,/category:resolved\.special\?specialLabel/);
 assert.match(src,/liveIncomingWarnings/);
});

test('Firestore swap indexes are readable only for the sanitized view and browser writes are denied',()=>{
 const rules=read('firestore.rules');
 assert.match(rules,/id == 'faculty_swap_index'/);
 assert.match(rules,/allow read: if ready\(\) && id == 'faculty_swap_index'/);
 assert.match(rules,/allow write: if false/);
});

test('AFC decisions and derived availability projections have no browser writer',()=>{
 const actions=read('afc-actions.js'),maintenanceSrc=read('index-maintenance.js');
 assert.match(actions,/direct Firestore mutation is disabled/);
 assert.match(maintenanceSrc,/function writeDerivedIndexes/);
 assert.match(read('firestore.rules'),/allow write: if false/);
});

test('legacy swap artifacts may remain packaged but are not loaded by the Beta runtime',()=>{
 const manifest=JSON.parse(read('tools/static-assets.json')),loader=read('asset-loader.js'),admin=read('faculty-admin.html'),safeSrc=read('faculty-swap-safe.js');
 assert.ok(manifest.includes('faculty-swap-safe.js'));
 assert.ok(manifest.includes('faculty-swap-handoff.js'));
 assert.ok(manifest.includes('approval-workflow.js'));
 assert.match(loader,/function ensureApprovalWorkflow\(\)\{[\s\S]*?return false/);
 assert.doesNotMatch(loader,/loadScriptOnce\('(approval-workflow|faculty-swap-safe|faculty-swap-handoff)\.js'/);
 assert.equal(admin.includes('src="faculty-swap-safe.js"'),false,'the API-only Dashboard must not load the swap runtime');
 assert.match(safeSrc,/faculty-admin\.html/);
});
