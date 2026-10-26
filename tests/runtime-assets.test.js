const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root=repositoryPath(__dirname,'..'),read=name=>fs.readFileSync(repositoryPath(root,name),'utf8');

test('runtime pages omit the undeployed Functions SDK',()=>{
 for(const name of ['index.html','faculty-admin.html','user-management.html'])assert.doesNotMatch(read(name),/firebase-functions-compat/);
});

test('retired faculty assets are absent from disk, manifest and all runtime links',()=>{
 const manifest=JSON.parse(read('tools/static-assets.json'));
 for(const name of ['faculty-dashboard.html','faculty-dashboard.js']){
  assert.equal(fs.existsSync(repositoryPath(root,name)),false,name);
  assert.equal(manifest.includes(name),false,name);
 }
 const runtime=manifest.filter(name=>/\.(html|js|css)$/.test(name)).map(read).join('\n');
 assert.doesNotMatch(runtime,/faculty-dashboard\.(?:html|js)/);
});

test('production manifest contains the complete static dependency graph and no stale visible names',()=>{
 const manifest=JSON.parse(read('tools/static-assets.json'));
  assert.equal(manifest.length,93);
 for(const name of ['schedule-filter-view.js','workspace-navigation.js','office-workspace.js','faculty-route-access.js'])assert.ok(manifest.includes(name),name);
 for(const name of ['faculty-availability.js','faculty-availability.css','faculty-admin-trainees.js','faculty-admin-trainees.css','ccc-schedule.js','ccc-schedule.css','leadership-directory.js','leadership-directory.css'])assert.ok(manifest.includes(name),name);
 for(const name of ['change-history.js','change-history.css','approval-scheduling.js','afc-form-values.js','afc-form-state.js','afc-timetable-panel.js','audit-details.js','derived-index-health.js','faculty-account-planner.js','faculty-doe.js','faculty-swap-handoff.js','faculty-swap-safe.js','index-maintenance.js','paws-auth-continuity.js','paws-login-performance.js','scheduling-core.js','timetable-selection.js','user-management.css'])assert.ok(manifest.includes(name),name);
 const runtime=manifest.filter(name=>/\.(html|js)$/.test(name)).map(read).join('\n');
 assert.doesNotMatch(runtime,/Faculty Directory|Faculty Admin Dashboard|Open Faculty Dashboard/);
 for(const page of manifest.filter(name=>name.endsWith('.html'))){
  const html=read(page),references=[...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match=>match[1].split(/[?#]/)[0]).filter(value=>value&&!/^(?:https?:|#|mailto:|tel:)/.test(value));
  for(const reference of references)assert.ok(manifest.includes(reference),`${page} -> ${reference}`);
 }
 // The search module must be published and loaded before the page that wires it,
 // and the page must actually call the binding. A silently unloaded module would
 // fall back to one render per keystroke without failing anything else.
 const calendarPage=read('index.html'),calendarModule=calendarPage.indexOf('calendar-search.js');
 assert.ok(manifest.includes('calendar-search.js'));
 assert.ok(calendarModule>=0&&calendarModule<calendarPage.indexOf('src="timetable.js"'),'calendar-search.js loads before timetable.js');
 assert.match(read('timetable.js'),/^\s*bindCalendarSearchInput\(\);$/m);
});

test('scheduling core loads before approval bootstrap and timetable consumers',()=>{
 const html=read('index.html');
 assert.ok(html.includes('<script src="scheduling-core.js"></script>'));
 assert.ok(html.includes('<script src="faculty-access.js"></script>'));
 assert.ok(html.indexOf('scheduling-core.js')<html.indexOf('faculty-access.js'));
 assert.ok(html.indexOf('scheduling-core.js')<html.indexOf('timetable-selection.js'));
 assert.ok(html.indexOf('scheduling-core.js')<html.indexOf('timetable.js'));
});

test('Spark AFC client and its PDF template remain deployable',()=>{
 const manifest=JSON.parse(read('tools/static-assets.json'));
 for(const name of ['afc-actions.js','afc-pdf-browser.js','afc-timetable-panel.js','absence-from-campus-app.pdf'])assert.ok(manifest.includes(name),name);
});

test('undeployed callable implementation and completed migration are removed',()=>{
 for(const name of ['functions/index.js','functions/afc-pdf.js','functions/bootstrap-general.js','tools/migrate_assigned_ad_rest.js'])assert.equal(fs.existsSync(repositoryPath(root,name)),false,name);
 const deployed=JSON.parse(read('tools/static-assets.json')).map(read).join('\n');
 assert.doesNotMatch(deployed,/httpsCallable|bootstrapGeneral|replaceGroupAssignment/);
});
