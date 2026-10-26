'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const modulePath=process.env.PAWS_UI_PLAYWRIGHT_MODULE;
test('real history component handles initial auth, filters, pages, export, responsive layout and sign-out',{skip:!modulePath},async t=>{
 const {chromium}=require(modulePath),browser=await chromium.launch({channel:'chrome',headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<!doctype html><title>PAWS History · Synthetic UI Acceptance</title><main style="max-width:1280px;margin:24px auto;padding:0 12px"><div id="history"></div></main>');
 await page.addStyleTag({path:path.resolve('change-history.css')});await page.addScriptTag({path:path.resolve('faculty-name.js')});
 await page.addStyleTag({path:path.resolve('change-history.css')});await page.addScriptTag({path:path.resolve('change-history.js')});
 await page.evaluate(()=>{
  const rows=Array.from({length:202},(_,i)=>({rowId:'synthetic-'+i,changeDate:'2026-10-16T12:00:00Z',changeType:'session_updated',domain:'Teaching',course:i%2?'206':'207',session:'Synthetic lab '+i,field:'Room',previousValue:'Room A',updatedValue:i===0?'<img src=x onerror=bad()>':'Room B',status:'Recorded',academicYear:'2026-27',affectedFaculty:'Synthetic Teacher'}));
  window.historyCalls=[];window.authCallback=null;
  const auth={currentUser:{uid:'synthetic'},onAuthStateChanged(cb){window.authCallback=cb;queueMicrotask(()=>cb(auth.currentUser));return()=>{};}};
  window.firebase={auth:()=>auth};
  window.UCVM_PAWS_DATA={
   changeHistory:async filters=>{window.historyCalls.push({method:'query',filters});const selected=rows.filter(r=>!filters.course||r.course===filters.course);return {snapshot:'synthetic-snapshot',rows:selected.slice(0,100),total:selected.length,offset:0,pageSize:100,facets:{academicYears:['2026-27'],changeTypes:['session_updated'],faculties:[],viscSubjects:[]},coverage:['Synthetic source: no real business data.']};},
   changeHistoryPage:async(snapshot,offset)=>{window.historyCalls.push({method:'page',snapshot,offset});return {snapshot,rows:rows.slice(offset,offset+100),total:202,offset,pageSize:100};},
   changeHistoryExport:async(snapshot,format)=>{window.historyCalls.push({method:'export',snapshot,format});return {rowCount:202,contentType:'text/csv; charset=utf-8',fileBase64:btoa('Change Date,Room\r\n2026-10-16,Room B\r\n')};}
  };
  window.historyView=window.PAWS_CHANGE_HISTORY.mount(document.querySelector('#history'),{api:window.UCVM_PAWS_DATA,scope:'timetable'});
 });
 await page.getByRole('button',{name:'Download CSV',exact:true}).waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('[data-history-export="csv"]').disabled,{},{timeout:3000});
 assert.match(await page.locator('[data-history-status]').innerText(),/202/);assert.equal(await page.locator('tbody tr').count(),100);assert.equal(await page.locator('tbody img').count(),0);
 await page.getByRole('button',{name:'Next',exact:true}).click();assert.match(await page.locator('[data-history-page]').innerText(),/101–200 of 202/);
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download CSV',exact:true}).click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'paws-change-history.csv');
 await page.getByText('More filters',{exact:true}).click();await page.getByLabel('Course number',{exact:true}).fill('206');assert.equal(await page.getByRole('button',{name:'Download CSV',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Search',exact:true}).click();assert.match(await page.locator('[data-history-status]').innerText(),/101 filtered/);
 await page.getByRole('button',{name:'Reset',exact:true}).click();assert.match(await page.locator('[data-history-status]').innerText(),/202 filtered/);
 await page.evaluate(()=>window.scrollTo(0,0));
 if(process.env.PAWS_HISTORY_SCREENSHOT_DIR){fs.mkdirSync(process.env.PAWS_HISTORY_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.PAWS_HISTORY_SCREENSHOT_DIR,'history-desktop.png')});}
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 if(process.env.PAWS_HISTORY_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.PAWS_HISTORY_SCREENSHOT_DIR,'history-mobile.png')});
 await page.evaluate(()=>window.authCallback(null));assert.equal(await page.getByRole('button',{name:'Download CSV',exact:true}).isDisabled(),true);assert.equal(await page.locator('tbody tr').count(),1);assert.match(await page.locator('tbody').innerText(),/No recorded/);
 assert.deepEqual(errors,[]);
});
