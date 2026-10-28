const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root=repositoryPath(__dirname,'..');
const read=f=>fs.readFileSync(repositoryPath(root,f),'utf8');

test('main dashboard loads information centre, availability lookup, and lazy AFC approval dependencies',()=>{
 const html=read('index.html');
 for(const file of ['information-center.js','availability-lookup.js','signature-capture.js','asset-loader.js'])assert.match(html,new RegExp(file.replace('.','\\.')));
 assert.doesNotMatch(html,/afc-actions\.js/);
 assert.doesNotMatch(html,/afc-pdf-browser\.js/);
 assert.match(html,/Information Center/i);
});

test('signature chooser supports typed, drawn, and uploaded signatures with evidence',()=>{
 const js=read('signature-capture.js');
 for(const mode of ['typed','drawn','uploaded'])assert.match(js,new RegExp(mode));
 for(const evidence of ['signedAt','email','fingerprint'])assert.match(js,new RegExp(evidence));
});

test('AFC queue requires the SQL API and the disabled legacy approval module contains no browser request writer',()=>{
 const queue=read('approval-workflow.js'),lookup=read('availability-lookup.js'),admin=read('faculty-admin.html');
 assert.match(queue,/approval application is disabled/);
 assert.doesNotMatch(read('faculty-access.js'),/approval-workflow\.js/);
 assert.match(queue,/db\.collection\(['"]afc_requests['"]\)/,'legacy source is retained but is no longer loaded by a Beta page');
 assert.match(read('paws-data-client.js'),/api\/v1\/afc-requests/);
 assert.match(admin,/href="index\.html#approvals"/);
 assert.match(lookup,/createFacultyAvailability/);assert.match(lookup,/PAWS_FACULTY_AVAILABILITY/);assert.doesNotMatch(lookup,/awayFromCampusRecords|db\.collection/);
});

test('the API-only Dashboard exposes no bulk import control and keeps the rules contract',()=>{
 const html=read('faculty-admin.html'),js=read('faculty-admin.js');
 assert.equal(html.includes('data-general-only'),false,'no bulk import control may ship on the API-only Dashboard');
 assert.equal(js.includes('requireGeneralImport'),false,'the read-only Dashboard has no bulk-import gate');
 const rules=read('firestore.rules');
 assert.match(rules,/bulkFacultyImportChange/);
 assert.match(rules,/public_info/);
});
