'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.azure-production');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):path.relative(out,path.join(dir,e.name)).replaceAll('\\','/'));}
function digest(){const h=crypto.createHash('sha256');for(const f of files(out).sort()){h.update(f+'\0');h.update(fs.readFileSync(path.join(out,f)));}return h.digest('hex');}
test('combined release artifact is deterministic and contains app plus managed API',()=>{
 execFileSync(process.execPath,['tools/build-beta-release.js'],{cwd:root,stdio:'pipe'});const first=digest();
 execFileSync(process.execPath,['tools/build-beta-release.js'],{cwd:root,stdio:'pipe'});assert.equal(digest(),first);
 for(const f of ['app/index.html','api/host.json','api/package.json','api/package-lock.json','api/index.js','api/server/src/runtime/swa-sql-runtime.js'])assert.ok(fs.existsSync(path.join(out,f)),f);
 assert.equal(fs.existsSync(path.join(out,'app/staticwebapp.config.json')),false);
 const pkg=JSON.parse(fs.readFileSync(path.join(out,'api/package.json'))),lock=JSON.parse(fs.readFileSync(path.join(out,'api/package-lock.json')));assert.deepEqual(lock.packages[''].dependencies,pkg.dependencies);for(const [name,version] of Object.entries(pkg.dependencies))assert.equal(lock.packages[`node_modules/${name}`].version,version,name);
 const entry=fs.readFileSync(path.join(out,'api/index.js'),'utf8');for(const route of ['health/sql','v1/me','v1/sessions','v1/dashboard/summary','v1/dashboard/faculty','v1/dashboard/faculty/{facultyId}','v1/dashboard/teaching-summary','v1/dashboard/roles','v1/dashboard/doe-overview'])assert.ok(entry.includes(route),route);
 assert.match(entry,/DASHBOARD_METHODS\s*=\s*\[[^\]]*'POST'/);
 assert.match(entry,/paws-health-sql'[^}]*methods:\['GET'\]/);
 assert.ok(fs.existsSync(path.join(out,'api/server/src/data/sql-dashboard-repository.js')));
 assert.ok(fs.existsSync(path.join(out,'api/server/src/data/dashboard-api.js')));
 assert.ok(fs.existsSync(path.join(out,'api/server/src/runtime/swa-dashboard-functions.js')));
 for(const file of ['app/calendar-activities.js','app/calendar-activities.css','app/faculty-admin-activity-import.js','api/server/src/calendar/activity-workbook.js','api/server/src/calendar/activity-workbook-worker.js','api/server/src/calendar/activity-import-policy.js','api/server/src/calendar/calendar-activity-api.js','api/server/src/data/sql-calendar-activity-repository.js','api/server/src/runtime/swa-calendar-activity-functions.js'])assert.ok(fs.existsSync(path.join(out,file)),file);
 for(const route of ['v1/calendar-activities','v1/calendar-activity-imports','v1/calendar-activity-imports/{batchId}/commit','v1/calendar-activities/{activityId}/time-evidence'])assert.ok(entry.includes(route),route);
});
test('artifact excludes migration evidence and secrets',()=>{
 const inventory=files(out);assert.equal(inventory.some(f=>/\.(?:xlsx?|paws-import\.jsonl?)$/i.test(f)||/(?:^|\/)(?:database|docs|tools|azure-sql-import-private)(?:\/|$)/i.test(f)),false);
 for(const f of inventory.filter(f=>/\.(?:js|json|html|css|txt|md|yml)$/i.test(f)))assert.doesNotMatch(fs.readFileSync(path.join(out,f),'utf8'),/Server=tcp:|(?:User ID|UID)=[^;\r\n]+;Password=|BEGIN PRIVATE KEY|FIREBASE_SERVICE_ACCOUNT_JSON\s*[:=]\s*["'{]/i,f);
});
