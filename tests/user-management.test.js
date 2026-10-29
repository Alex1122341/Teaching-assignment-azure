'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root=repositoryPath(__dirname,'..');
const read=name=>fs.readFileSync(repositoryPath(root,name),'utf8');

test('access editor uses canonical faculty choices without editable source identity or required administrative link',()=>{
 const html=read('user-management.html'),source=read('user-management.js');
 assert.match(html,/id="account-faculty"/);
 assert.match(html,/id="edit-identity"/);
 assert.doesNotMatch(html,/id="account-name"[^>]*required/);
 assert.doesNotMatch(html,/id="account-email"[^>]*required/);
 assert.doesNotMatch(html,/id="account-uid"[^>]*required/);
 assert.match(source,/api\.accessCatalog\(\)/);
 assert.match(source,/facultyId:\$\('account-faculty'\)\.value\|\|null/);
});

test('role editor does not provision authentication accounts or pretend to clear password requirements',()=>{
 const html=read('user-management.html'),source=read('user-management.js');
 assert.doesNotMatch(html,/faculty-account-planner\.js|account-password-change|account-password/);
 assert.doesNotMatch(source,/secondaryAuth|createUserWithEmailAndPassword|mustChangePassword\s*:/);
 assert.match(html,/Account creation and password policies use their separate support process/);
});

test('existing account changes require reason, server preview and persisted confirmation, with no bulk grant path',()=>{
 const html=read('user-management.html'),source=read('user-management.js');
 assert.doesNotMatch(html,/account-bulk/);
 assert.match(html,/id="account-reason"[^>]*required/);
 assert.match(source,/api\.previewAccountAccess\(/);
 assert.match(source,/api\.commitAccountAccess\(operation\)/);
 assert.match(source,/Saved access confirmed from the current account profile/);
 assert.doesNotMatch(source,/console\.(?:log|error)\([^\n]*password/i);
});

test('account and group role labels reuse the shared helper without inventing workload grants',()=>{
 const source=read('user-management.js');
 assert.match(source,/root\.UCVM\.label\(/);
 assert.doesNotMatch(source,/UCVM_ACCOUNT_PLANNER|facultyRoles\s*:/);
 assert.match(source,/state\.access\?\.canManageAccounts!==true/);
});

test('account role choices come from the trusted supported-role catalog rather than hardcoded broader roles',()=>{
 const html=read('user-management.html'),source=read('user-management.js');
 assert.match(html,/id="account-role"/);
 assert.match(source,/state\.catalog\?\.roles/);
 assert.doesNotMatch(html,/<option value="(?:owner|other_office|developer)"/);
});

test('provisioned accounts receive a readable Change History action label',()=>{
 assert.match(read('faculty-access.js'),/account_provisioned:'Account provisioned'/);
});

test('setup guide distinguishes the SQL-backed Beta from legacy Firebase/Firestore setup',()=>{
 const setup=read('SETUP.md');
 assert.match(setup,/Firebase Authentication supplies identity only/);
 assert.match(setup,/`VetMed-Ops`/);
 assert.match(setup,/Legacy Spark \/ Firestore setup \(historical\)/);
 assert.match(setup,/not instructions for this Azure Beta repository/);
 assert.doesNotMatch(setup,/ucvm2026/i);
});
