'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
// Browser plugin is not available. Use the existing bundled Playwright runtime,
// supplied explicitly for the browser lane; do not add a product dependency.
const modulePath=process.env.PAWS_UI_PLAYWRIGHT_MODULE;
async function harness(t){
 const {chromium}=require(modulePath);const browser=await chromium.launch({channel:'chrome',headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<!doctype html><title>PAWS Tasks synthetic acceptance</title><body><header class="timetable-top-actions"></header><main class="main-view"><h1>PAWS Calendar</h1><p>Synthetic schedule</p><output id="opened"></output></main></body>');
 await page.addStyleTag({path:path.resolve(__dirname,'../workspace.css')});
 await page.evaluate(()=>{
  const facultyA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',facultyB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const tasks=Array.from({length:55},(_,index)=>({issueKey:index.toString(16).toUpperCase().padStart(64,'A'),facultyKey:index%2?facultyA:facultyB,displayName:index%2?'Faculty Alpha':'Faculty Beta',courseCode:index%2?'207':'206',sessionId:'session-'+index,date:index===1?null:'2026-11-05',startTime:index===1?null:'09:00',endTime:index===1?null:'10:00',type:index===1?'missing_schedule':'instructor_overlap',severity:index===1?'Needs Review':'Conflict',reviewStatus:index===0?'Reviewed':'Unreviewed',evidenceVersion:'B'.repeat(64),reviewVersion:'0000000000000001',canReview:true,relatedSessions:index===1?[]:[{id:'related-'+index,courseCode:'208',date:'2026-11-05',startTime:'09:30',endTime:'10:30'}]}));
  window.fixture={tasks,calls:[],reviews:[],loggedIn:true,identity:'synthetic-a',fail:false,defer:false,canReview:true};
  window.UCVM_PAWS_DATA={
   async schedulingTasks(query){
    const f=window.fixture;f.calls.push({...query});
    if(f.fail)throw Error('PRIVATE failure');
    if(query.cursor&&f.stalePage){f.stalePage=false;throw Object.assign(Error('stale'),{code:'SCHEDULING_TASK_STALE'});}
    if(f.defer)return new Promise(resolve=>{f.resolve=resolve;});
    const filtered=f.tasks.filter(row=>(!query.type||row.type===query.type)&&(!query.facultyKey||row.facultyKey===query.facultyKey)&&(!query.courseCode||row.courseCode===query.courseCode)&&(!query.reviewStatus||row.reviewStatus===query.reviewStatus)&&(query.undated!=='only'||!row.date)&&(query.undated!=='exclude'||row.date));
    const offset=query.cursor?50:0;
    return {tasks:filtered.slice(offset,offset+50).map(row=>({...row,canReview:f.canReview})),total:filtered.length,nextCursor:filtered.length>offset+50?'C'.repeat(64)+':50':null,snapshotVersion:'C'.repeat(64),academicYears:[{academicYear:'2026-27'}],filters:{faculty:[{facultyKey:facultyA,displayName:'Faculty Alpha'},{facultyKey:facultyB,displayName:'Faculty Beta'}],courses:[{courseCode:'206'},{courseCode:'207'}]},capabilities:{canReview:f.canReview}};
   },
   async reviewSchedulingTask(key,body){const f=window.fixture;f.reviews.push({key,body});if(f.reviewStale)throw Object.assign(Error('stale'),{code:'SCHEDULING_TASK_STALE'});const row=f.tasks.find(row=>row.issueKey===key);row.reviewStatus=body.reviewStatus;return {...row};},
   async swapQueue(){return {requests:[{requestId:'request-one',courseCode:'209',status:'pending',nextStage:'adfa'}]};}
  };
  window.PAWS_SWAP={openDetail:id=>{document.getElementById('opened').textContent=id;}};
 });
 await page.addScriptTag({path:path.resolve(__dirname,'../workspace-tasks.js')});
 await page.evaluate(()=>{
  window.PAWS_TASKS.configure({hasUser:()=>window.fixture.loggedIn,identity:()=>window.fixture.identity,academicYear:()=> '2026-27',allSessions:async()=>[{id:'undated',academicYear:'2026-27',date:null},{id:'early',academicYear:'2026-27',course:'206',date:'2026-11-05',start:'06:00',end:'07:00'}],disposition:s=>({disposition:s.id==='undated'?'invalid':'before'}),reason:()=> 'Outside calendar display hours',openSession:id=>{document.getElementById('opened').textContent=id;}});
  return window.PAWS_TASKS.refresh();
 });
 return {page,errors};
}
test('Tasks sidebar shows current issues, filters, both session links and durable review without hiding unresolved work',{skip:!modulePath},async t=>{
 const {page,errors}=await harness(t);
 assert.equal(await page.getByLabel('Academic year',{exact:true}).count(),1);
 assert.equal(await page.getByRole('button',{name:'Load more issues',exact:true}).count(),1);
 assert.match(await page.locator('.workspace-task-list').innerText(),/Reviewed.*Conflict remains/s);
 await page.getByRole('button',{name:'Load more issues',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-issue-key]').length===55);
 assert.equal(await page.locator('[data-issue-key]').count(),55);
 await page.locator('[data-issue-key]').first().getByRole('button',{name:'Open session',exact:true}).click();assert.equal(await page.locator('#opened').innerText(),'session-0');
 await page.locator('[data-issue-key]').first().getByRole('button',{name:'Open conflicting session',exact:true}).click();assert.equal(await page.locator('#opened').innerText(),'related-0');
 await page.locator('[data-issue-key]').first().getByRole('button',{name:'Reopen review',exact:true}).click();
 await page.waitForFunction(()=>window.fixture.reviews.length===1);
 assert.equal(await page.evaluate(()=>window.fixture.reviews[0].body.reviewStatus),'Unreviewed');
 assert.equal(await page.getByRole('button',{name:/delete|dismiss/i}).count(),0);
 await page.locator('summary').filter({hasText:'Schedule filters'}).click();
 await page.getByLabel('Conflict type',{exact:true}).selectOption('missing_schedule');
 await page.waitForFunction(()=>document.querySelectorAll('[data-issue-key]').length===1);
 assert.match(await page.locator('.workspace-task-list').innerText(),/Needs Review/);
 assert.equal(await page.locator('[data-id="undated"]').count(),0);
 assert.deepEqual(errors,[]);
});

test('reviewed incomplete data stays Needs Review and conflicting course/time are visible without hover',{skip:!modulePath},async t=>{
 const {page}=await harness(t);
 assert.match(await page.locator('[data-issue-key]').first().innerText(),/208.*2026-11-05.*09:30.*10:30/s);
 await page.evaluate(async()=>{window.fixture.tasks[1].reviewStatus='Reviewed';await window.PAWS_TASKS.refresh();});
 const text=await page.locator('[data-issue-key]').nth(1).innerText();
 assert.match(text,/Needs Review/);assert.doesNotMatch(text,/Conflict remains/);
});

test('Tasks clears failed/late data, keeps independent requests and resets filters when identity changes',{skip:!modulePath},async t=>{
 const {page}=await harness(t);
 await page.evaluate(async()=>{window.fixture.fail=true;await window.PAWS_TASKS.refresh();});
 assert.equal(await page.locator('[data-issue-key]').count(),0);
 assert.equal(await page.getByRole('button',{name:'Retry',exact:true}).count(),1);
 assert.match(await page.locator('.workspace-task-list').innerText(),/SWAP.*209/s);
 assert.doesNotMatch(await page.locator('.workspace-task-list').innerText(),/PRIVATE/);
 await page.evaluate(()=>{window.fixture.fail=false;window.fixture.defer=true;window.oldRefresh=window.PAWS_TASKS.refresh();});
 await page.waitForFunction(()=>typeof window.fixture.resolve==='function');
 await page.evaluate(async()=>{window.fixture.loggedIn=false;await window.PAWS_TASKS.refresh();window.fixture.resolve({tasks:window.fixture.tasks,total:55});await window.oldRefresh;});
 assert.equal(await page.locator('#workspace-tasks').isHidden(),true);assert.equal(await page.locator('[data-issue-key]').count(),0);
 await page.evaluate(async()=>{window.fixture.loggedIn=true;window.fixture.identity='synthetic-b';window.fixture.defer=false;window.fixture.canReview=false;await window.PAWS_TASKS.refresh();});
 assert.equal(await page.locator('[data-review-issue]').count(),0);
 await page.getByLabel('Search loaded tasks',{exact:true}).fill('Faculty Alpha');
 await page.evaluate(async()=>{window.fixture.identity='synthetic-c';await window.PAWS_TASKS.refresh();});
 assert.equal(await page.getByLabel('Search loaded tasks',{exact:true}).inputValue(),'');
});

test('a load-more attempt while refresh is pending cannot invalidate the current queue',{skip:!modulePath},async t=>{
 const {page}=await harness(t);
 await page.evaluate(()=>{window.fixture.defer=true;window.pendingRefresh=window.PAWS_TASKS.refresh();});
 await page.waitForFunction(()=>typeof window.fixture.resolve==='function');
 await page.evaluate(async()=>{await window.PAWS_TASKS.refresh({append:true});window.fixture.defer=false;window.fixture.resolve({tasks:window.fixture.tasks.slice(0,50),total:55,nextCursor:'C'.repeat(64)+':50'});await window.pendingRefresh;});
 assert.equal(await page.locator('[data-issue-key]').count(),50);
 assert.doesNotMatch(await page.locator('.workspace-task-caption').innerText(),/Loading/);
});

test('stale page and review refresh safely; mobile filters and keyboard navigation stay usable',{skip:!modulePath},async t=>{
 const {page,errors}=await harness(t);
 await page.evaluate(()=>{window.fixture.stalePage=true;});
 await page.getByRole('button',{name:'Load more issues',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent.includes('queue was refreshed'));
 assert.equal(await page.locator('[data-issue-key]').count(),50);
 await page.evaluate(()=>{window.fixture.reviewStale=true;});
 await page.locator('[data-issue-key]').first().getByRole('button',{name:'Reopen review',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent.includes('before reviewing again'));
 assert.match(await page.locator('[data-issue-key]').first().innerText(),/Reviewed/);
 await page.setViewportSize({width:390,height:844});
 await page.locator('summary').filter({hasText:'Schedule filters'}).click();
 await page.getByLabel('Faculty',{exact:true}).focus();await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Course');
 for(const label of ['From date','Before date','Faculty','Course','Conflict type','Review status','Undated records'])assert.equal(await page.getByLabel(label,{exact:true}).count(),1);
 assert.equal(await page.locator('#workspace-tasks').evaluate(node=>node.scrollWidth<=node.clientWidth+1),true);
 assert.deepEqual(errors,[]);
 if(process.env.PAWS_UI_SCREENSHOT_DIR){require('node:fs').mkdirSync(process.env.PAWS_UI_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.PAWS_UI_SCREENSHOT_DIR,'tasks-mobile.png')});await page.setViewportSize({width:1280,height:900});await page.locator('summary').filter({hasText:'Schedule filters'}).click();await page.screenshot({path:path.join(process.env.PAWS_UI_SCREENSHOT_DIR,'tasks-desktop.png')});}
});
