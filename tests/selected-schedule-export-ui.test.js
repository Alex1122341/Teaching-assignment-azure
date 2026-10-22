'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sourceFunction=require('../test-support/source-function');
const modulePath=process.env.PAWS_UI_PLAYWRIGHT_MODULE;
async function harness(t){
 const {chromium}=require(modulePath),browser=await chromium.launch({channel:'chrome',headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<!doctype html><title>Selected schedule synthetic acceptance</title><div id="modal" class="modal-container"></div><div id="toast"></div>');
 await page.addStyleTag({path:repositoryPath(__dirname,'../timetable.css')});
 for(const file of ['scheduling-core.js','timetable-selection.js'])await page.addScriptTag({path:repositoryPath(__dirname,'..',file)});
 await page.evaluate(()=>{
  window.fixture={rows:[{id:'late',course:'206',courseName:'Course Six',date:'2026-11-06',start:'10:00',end:'11:00',topic:'Later',type:'LAB',instructor:'Faculty Beta',room:'B',email:'PRIVATE EMAIL',assignments:[{ucid:'PRIVATE UID'}]},
   {id:'early',course:'206',courseName:'Course Six',date:'2026-11-05',start:'09:00',end:'10:00',topic:'Earlier',type:'LEC',instructor:'Faculty Alpha',room:'A'},
   {id:'other',course:'207',date:'2026-11-04',start:'13:00',end:'14:00',topic:'Another course',type:'SRL',instructor:'Faculty Gamma'}],calls:[],fail:false};
  window.currentUser={uid:'synthetic-user'};window.$=id=>document.getElementById(id);
  window.pageDataSubscribers=new Set();
  window.selectedSemester='fall';window.selectedYear='all';window.selectedCourses=new Set();window.WEEK_COUNT=22;
  window.clearRecaptcha=()=>{};window.toast=(text)=>{document.getElementById('toast').textContent=text;};
  window.ensureAllSessions=async options=>{window.fixture.calls.push(options);if(window.fixture.fail)throw Error('PRIVATE BACKEND');if(window.fixture.defer)return new Promise(resolve=>{window.fixture.resolve=resolve;});return window.fixture.rows;};
 });
 const names=['escapeHtml','input','select','pad','ymd','showModal','closeModal','downloadFile','publishPageData','openExportDialog'];
 for(const optional of ['openSelectedScheduleExport']){try{sourceFunction('timetable.js',optional);names.push(optional);}catch(_){}}
 await page.addScriptTag({content:names.map(name=>sourceFunction('timetable.js',name)).join('\n')});
 await page.evaluate(()=>openExportDialog('csv'));
 return {page,errors};
}
test('CSV window selects multiple courses and individual sessions, previews exact public rows and downloads them',{skip:!modulePath},async t=>{
 const {page,errors}=await harness(t);
 const choose=page.getByRole('button',{name:'Choose courses / sessions',exact:true});assert.equal(await choose.count(),1);await choose.click();
 await page.getByLabel('Select course 206',{exact:true}).check();
 await page.getByLabel(/Select session.*Earlier/).uncheck();
 await page.getByLabel('Select course 207',{exact:true}).check();
 assert.match(await page.locator('#export-selection-count').innerText(),/^2 selected/);
 await page.getByRole('button',{name:'Preview selected',exact:true}).click();
 const preview=page.locator('#export-selection-preview');assert.equal(await preview.locator('tbody tr').count(),2);
 assert.match(await preview.innerText(),/Another course.*Later/s);assert.doesNotMatch(await preview.innerText(),/Earlier|PRIVATE|UCID|Email|DOE/);
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download selected CSV',exact:true}).click();const download=await event;
 assert.equal(download.suggestedFilename(),'ucvm-selected-timetable.csv');
 const csv=fs.readFileSync(await download.path(),'utf8');assert.match(csv,/Another course[\s\S]*Later/);assert.doesNotMatch(csv,/Earlier|PRIVATE|Assignments JSON/);
 assert.equal(await page.evaluate(()=>window.fixture.calls[0].refresh),true);assert.equal(await page.evaluate(()=>window.fixture.calls[0].notify),false);assert.deepEqual(errors,[]);
});
test('account scope changes clear the open export and close removes its subscriber',{skip:!modulePath},async t=>{
 const {page}=await harness(t);
 await page.getByRole('button',{name:'Choose courses / sessions',exact:true}).click();await page.getByRole('button',{name:'Select all sessions',exact:true}).click();await page.getByRole('button',{name:'Preview selected',exact:true}).click();
 await page.evaluate(()=>{window.currentUser={uid:'synthetic-user',role:'faculty',profile:{facultyId:'different-scope'}};publishPageData();});
 assert.match(await page.locator('#export-selection-body').innerText(),/account changed/i);assert.doesNotMatch(await page.locator('#modal').innerText(),/Faculty Alpha|Faculty Beta/);
 assert.equal(await page.getByRole('button',{name:'Download selected CSV',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.evaluate(()=>window.pageDataSubscribers.size),0);
});
test('download revalidates the authorized snapshot and refuses changed source data',{skip:!modulePath},async t=>{
 const {page}=await harness(t);const downloads=[];page.on('download',file=>downloads.push(file));
 await page.getByRole('button',{name:'Choose courses / sessions',exact:true}).click();
 await page.getByLabel('Select course 206',{exact:true}).check();await page.getByRole('button',{name:'Preview selected',exact:true}).click();
 await page.evaluate(()=>{window.fixture.rows[0].topic='Changed after preview';});
 await page.getByRole('button',{name:'Download selected CSV',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.fixture.calls.length),2);
 assert.match(await page.locator('#export-selection-body').innerText(),/schedule changed/i);
 assert.equal(await page.getByRole('button',{name:'Download selected CSV',exact:true}).isDisabled(),true);
 assert.doesNotMatch(await page.locator('#export-selection-body').innerText(),/Faculty Alpha|Faculty Beta/);assert.equal(downloads.length,0);
});
test('failed reads show an accessible safe error and late results cannot reopen a closed export',{skip:!modulePath},async t=>{
 const {page}=await harness(t);
 await page.evaluate(()=>{window.fixture.fail=true;});await page.getByRole('button',{name:'Choose courses / sessions',exact:true}).click();
 assert.equal(await page.getByRole('alert').count(),1);assert.match(await page.getByRole('alert').innerText(),/could not be loaded/i);assert.doesNotMatch(await page.locator('#modal').innerText(),/PRIVATE/);
 assert.equal(await page.getByRole('button',{name:'Download selected CSV',exact:true}).isDisabled(),true);
 await page.evaluate(()=>{window.fixture.fail=false;window.fixture.defer=true;window.pending=openSelectedScheduleExport();});
 await page.waitForFunction(()=>typeof window.fixture.resolve==='function');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(async()=>{window.fixture.resolve(window.fixture.rows);await window.pending;});
 assert.equal(await page.locator('#modal').innerText(),'');assert.equal(await page.evaluate(()=>window.pageDataSubscribers.size),0);
});

test('selected export fits desktop and mobile, supports keyboard choice and invalidates an old preview',{skip:!modulePath},async t=>{
 const {page,errors}=await harness(t);
 await page.getByRole('button',{name:'Choose courses / sessions',exact:true}).click();
 assert.ok((await page.locator('.selected-export-modal').boundingBox()).width>900,'desktop uses a readable report width');
 await page.setViewportSize({width:390,height:844});
 const modal=page.locator('.selected-export-modal'),bounds=await modal.boundingBox();
 assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391,'mobile modal stays inside the viewport');
 assert.equal(await modal.evaluate(node=>node.scrollWidth<=node.clientWidth),true,'tables scroll inside their own container');
 const course=page.getByLabel('Select course 206',{exact:true});await course.focus();await page.keyboard.press('Space');
 assert.match(await page.locator('#export-selection-count').innerText(),/^2 selected/);
 await page.getByRole('button',{name:'Preview selected',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Download selected CSV',exact:true}).isEnabled(),true);
 assert.equal(await modal.evaluate(node=>node.scrollWidth<=node.clientWidth),true,'the mobile preview also contains horizontal scrolling');
 await page.getByRole('button',{name:'Clear selection',exact:true}).click();
 assert.match(await page.locator('#export-selection-count').innerText(),/^0 selected/);
 assert.equal(await page.locator('#export-selection-preview').isVisible(),false);
 assert.equal(await page.getByRole('button',{name:'Download selected CSV',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Select all sessions',exact:true}).click();
 assert.match(await page.locator('#export-selection-count').innerText(),/^3 selected/);
 if(process.env.PAWS_EXPORT_DEBUG_DIR){fs.mkdirSync(process.env.PAWS_EXPORT_DEBUG_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.PAWS_EXPORT_DEBUG_DIR,'selected-export-mobile.png')});await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:'Preview selected',exact:true}).click();await page.screenshot({path:path.join(process.env.PAWS_EXPORT_DEBUG_DIR,'selected-export-desktop.png')});}
 assert.deepEqual(errors,[]);
});

test('same-slot LAB reselection downloads successfully even when fresh source order changes',{skip:!modulePath},async t=>{
 const {page,errors}=await harness(t);
 await page.evaluate(()=>{window.fixture.rows=window.fixture.rows.slice(0,2).map(row=>({...row,date:'2026-11-05',start:'09:00',end:'10:00'}));});
 await page.getByRole('button',{name:'Choose courses / sessions',exact:true}).click();
 await page.getByRole('button',{name:'Select all sessions',exact:true}).click();
 await page.getByLabel(/Select session.*Earlier/).uncheck();await page.getByLabel(/Select session.*Earlier/).check();
 await page.getByRole('button',{name:'Preview selected',exact:true}).click();
 assert.match(await page.locator('#export-selection-preview').innerText(),/Earlier.*Later/s);
 await page.evaluate(()=>{window.fixture.rows.reverse();});
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download selected CSV',exact:true}).click();
 const csv=fs.readFileSync(await (await event).path(),'utf8');assert.match(csv,/Earlier[\s\S]*Later/);assert.deepEqual(errors,[]);
});

test('course selection includes sessions beyond the first page and clear resets the entire selection',{skip:!modulePath},async t=>{
 const {page,errors}=await harness(t);
 await page.evaluate(()=>{window.fixture.rows=Array.from({length:103},(_,i)=>({id:`page-${String(i).padStart(3,'0')}`,course:'206',date:'2026-11-05',start:'09:00',end:'10:00',topic:`Station ${i}`}));});
 await page.getByRole('button',{name:'Choose courses / sessions',exact:true}).click();
 assert.equal(await page.locator('#export-selection-rows tr').count(),100);
 await page.getByLabel('Select course 206',{exact:true}).check();
 assert.match(await page.locator('#export-selection-count').innerText(),/^103 selected/);
 await page.getByRole('button',{name:'Show more sessions',exact:true}).click();
 assert.equal(await page.locator('#export-selection-rows tr').count(),103);
 assert.equal(await page.getByLabel(/Select session.*Station 102$/).isChecked(),true);
 await page.getByRole('button',{name:'Preview selected',exact:true}).click();
 assert.equal(await page.locator('#export-selection-preview tbody tr').count(),103);
 await page.getByRole('button',{name:'Clear selection',exact:true}).click();
 assert.equal(await page.locator('#export-selection-rows input:checked').count(),0);
 assert.equal(await page.getByRole('button',{name:'Download selected CSV',exact:true}).isDisabled(),true);assert.deepEqual(errors,[]);
});

test('overflow is visible and leaves the earlier valid selection intact',{skip:!modulePath},async t=>{
 const {page,errors}=await harness(t);
 await page.evaluate(()=>{window.fixture.rows=[{id:'chosen',course:'207',date:'2026-11-05',topic:'Selected'},...Array.from({length:5000},(_,i)=>({id:`limit-${i}`,course:'206',date:'2026-11-05',topic:`Station ${i}`}))];});
 await page.getByRole('button',{name:'Choose courses / sessions',exact:true}).click();
 await page.getByLabel('Select course 207',{exact:true}).check();
 await page.getByRole('button',{name:'Select all sessions',exact:true}).click();
 assert.match(await page.locator('#export-selection-error').innerText(),/5,000-session limit/);
 assert.match(await page.locator('#export-selection-count').innerText(),/^1 selected/);
 assert.equal(await page.getByLabel('Select course 207',{exact:true}).isChecked(),true);
 assert.equal(await page.getByLabel('Select course 206',{exact:true}).isChecked(),false);
 await page.getByRole('button',{name:'Preview selected',exact:true}).click();assert.equal(await page.locator('#export-selection-preview tbody tr').count(),1);assert.deepEqual(errors,[]);
});

test('changing selection or signing out during download revalidation never downloads an old preview',{skip:!modulePath},async t=>{
 const {page,errors}=await harness(t);let downloads=0;page.on('download',()=>downloads++);
 await page.getByRole('button',{name:'Choose courses / sessions',exact:true}).click();
 await page.getByLabel('Select course 206',{exact:true}).check();await page.getByRole('button',{name:'Preview selected',exact:true}).click();
 await page.evaluate(()=>{window.fixture.defer=true;window.pendingDownload=document.getElementById('export-selection-download').onclick();});
 await page.waitForFunction(()=>typeof window.fixture.resolve==='function');
 await page.getByLabel(/Select session.*Earlier/).uncheck();
 await page.evaluate(async()=>{window.fixture.resolve(window.fixture.rows);await window.pendingDownload;window.fixture.defer=false;});
 assert.equal(downloads,0);assert.match(await page.locator('#export-selection-error').innerText(),/Selection changed/);
 assert.equal(await page.getByRole('button',{name:'Download selected CSV',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Preview selected',exact:true}).click();
 await page.evaluate(()=>{window.fixture.defer=true;window.fixture.resolve=null;window.pendingDownload=document.getElementById('export-selection-download').onclick();});
 await page.waitForFunction(()=>typeof window.fixture.resolve==='function');
 await page.evaluate(async()=>{window.currentUser=null;publishPageData();window.fixture.resolve(window.fixture.rows);await window.pendingDownload;});
 assert.match(await page.locator('#export-selection-body').innerText(),/account changed/i);assert.doesNotMatch(await page.locator('#modal').innerText(),/Faculty Alpha|Faculty Beta/);assert.equal(downloads,0);assert.deepEqual(errors,[]);
});
