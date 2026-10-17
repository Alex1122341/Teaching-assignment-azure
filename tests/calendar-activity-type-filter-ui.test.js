'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const modulePath=process.env.PAWS_UI_PLAYWRIGHT_MODULE;
test('the real timetable entry point initializes the picker without a startup error',{skip:!modulePath},async t=>{
 const {chromium}=require(modulePath),browser=await chromium.launch({channel:'chrome',headless:true});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const source=require('node:fs').readFileSync('index.html','utf8');
 await page.setContent(source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));
 for(const match of source.matchAll(/<script src="([^"]+)"/g)){if(!match[1].startsWith('https:'))await page.addScriptTag({path:path.resolve(match[1])});}
 assert.deepEqual(errors,[]);
 assert.equal(await page.getByText('All activity types',{exact:true}).count(),1);
 assert.equal(await page.locator('#activity-type-filter input[type=checkbox]').count(),13);
});
test('grouped type picker supports real checkbox events, all, clear, Reset and safe dynamic labels',{skip:!modulePath},async t=>{
 const {chromium}=require(modulePath),browser=await chromium.launch({channel:'chrome',headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<!doctype html><div style="display:flex;justify-content:flex-end"><div id="picker" style="width:185px"></div><button id="reset">Reset</button></div><div id="results"></div>');
 await page.addStyleTag({path:path.resolve('calendar-activities.css')});
 await page.addScriptTag({path:path.resolve('calendar-activities.js')});
 await page.evaluate(()=>{
  const work=[{category:'rotation_participant',label:'Source rotation'},{category:'ccc',label:'Source CCC'}].map(x=>({...x,startDate:'2026-10-14',endDate:'2026-10-19',facultyDisplayName:'Synthetic'}));
  const show=()=>{document.querySelector('#results').innerHTML=window.PAWS_CALENDAR_ACTIVITIES.renderRangeLane(work,{filters:{typeKeys:window.picker.selectedKeys()}});};
  window.picker=window.PAWS_CALENDAR_ACTIVITIES.createActivityTypeFilter({host:document.querySelector('#picker'),onChange:show});
  document.querySelector('#reset').onclick=()=>{window.picker.reset();show();};show();
 });
 await page.getByText('All activity types',{exact:true}).click();
 await page.waitForFunction(()=>{const r=document.querySelector('.activity-type-options').getBoundingClientRect();return r.x>=0&&r.right<=innerWidth;});
 let box=await page.locator('.activity-type-options').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=1280,'desktop picker stays within viewport '+JSON.stringify(box));
 assert.equal(await page.getByRole('group',{name:'Work activities',exact:true}).getByRole('checkbox').count(),7);
 assert.equal(await page.getByLabel('Remote work',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Clear types',exact:true}).click();
 assert.match(await page.locator('#results').innerText(),/No working activities/);
 await page.getByLabel('Rotation participant',{exact:true}).check();
 assert.match(await page.locator('#results').innerText(),/Source rotation/);assert.doesNotMatch(await page.locator('#results').innerText(),/Source CCC/);
 await page.getByRole('button',{name:'Select all types',exact:true}).click();assert.match(await page.locator('#results').innerText(),/Source CCC/);
 await page.getByRole('button',{name:'Clear types',exact:true}).click();
 await page.getByText('No activity types',{exact:true}).click();
 await page.getByRole('button',{name:'Reset',exact:true}).click();
 await page.getByText('All activity types',{exact:true}).click();
 assert.equal(await page.getByLabel('CCC',{exact:true}).isChecked(),true);
 await page.evaluate(()=>window.picker.setSessionTypes(['<img src=x onerror=alert(1)>']));
 assert.equal(await page.locator('#picker img').count(),0);assert.match(await page.locator('#picker').innerText(),/<img src=x onerror=alert\(1\)>/);
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>{const r=document.querySelector('.activity-type-options').getBoundingClientRect();return r.x>=0&&r.right<=innerWidth;});box=await page.locator('.activity-type-options').boundingBox();
 assert.ok(box.x>=0&&box.x+box.width<=390,'mobile picker stays within viewport');
 assert.deepEqual(errors,[]);
});
