'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
 const sourceFunction=require('../test-support/source-function'),placement=require('../frontend/scripts/calendar-activity-placement'),search=require('../frontend/scripts/calendar-search');
const rotation={id:'activity:a:2026-10-01',date:'2026-10-01',week:6,semester:'fall',year:null,course:'Rotation',type:'Rotation',activityCategory:'rotation_participant',isWorkingActivity:true,readOnlyActivity:true,sourceActivity:{category:'rotation_participant',startDate:'2026-10-01',endDate:'2026-10-02'},start:'08:30',end:'16:30',timeDefaulted:true,topic:'Rotation',instructor:'Example, Alex'};
function filterHarness(year){
 const fields={'search-input':{value:''},'filter-month':{value:'all'}},ctx={window:{PAWS_ACTIVITY_PLACEMENT:placement},selectedYear:year,selectedSemester:'fall',courseFilterActive:false,selectedCourses:new Set(),myTimetableOnly:false,currentUser:{uid:'u'},parseYmd:s=>new Date(s),$ :id=>fields[id],sessions:[],activityTypeFilter:{setSessionTypes(){},matchesSession:()=>true,matchesActivity:()=>true}};
 vm.createContext(ctx);vm.runInContext(sourceFunction('timetable.js','filteredSessions'),ctx);return ctx;
}
test('shipped Year filter makes Rotation exclusive and leaves Year4 teaching separate',()=>{
 const rows=[rotation,{...rotation,id:'ccc',activityCategory:'ccc',sourceActivity:{category:'ccc'}},{id:'teaching',year:4,semester:'fall',date:'2026-10-01',type:'LAB'}];
 assert.deepEqual(Array.from(filterHarness('rotation').filteredSessions(rows),r=>r.id),[rotation.id]);
 assert.deepEqual(Array.from(filterHarness('rotation').filteredSessions(rows,{ignorePeriod:true}),r=>r.id),[rotation.id],'list/all-date readers must not ignore exclusive Rotation');
 assert.deepEqual(Array.from(filterHarness('4').filteredSessions(rows),r=>r.id),['teaching']);
});
test('scheduled projections follow work-category filters rather than adding teaching types',()=>{
 const ctx=filterHarness('all');let types;
 ctx.activityTypeFilter.setSessionTypes=rows=>{types=rows;};ctx.activityTypeFilter.matchesActivity=()=>false;
 assert.equal(ctx.filteredSessions([rotation]).length,0);assert.deepEqual(Array.from(types),[]);
});
test('Calendar finds a projected activity by displayed surname and independent keyword words',()=>{
 const ctx=filterHarness('rotation');ctx.displayFacultyList=require('../frontend/scripts/faculty-name').formatList;
 ctx.$('search-input').value='Example Alex Rotation';
 assert.equal(ctx.filteredSessions([{...rotation,instructor:'Alex Example'}]).length,1);
 ctx.$('search-input').value='Example nonexistent';assert.equal(ctx.filteredSessions([rotation]).length,0);
});
test('Month keeps every matching activity accessible through a native overflow disclosure',()=>{
 const body={innerHTML:''},label={textContent:''},rows=Array.from({length:5},(_,i)=>({...rotation,id:'rotation-'+i,date:'2026-10-19'}));
 const ctx={selectedWeek:9,selectedSemester:'fall',weekStart:()=>new Date(2026,9,19),$:id=>id==='filter-month'?{value:'all'}:id==='calendar-body'?body:label,addDays:(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n),ymd:d=>d.toISOString().slice(0,10),calendarSourceSessions:()=>rows,filteredSessions:r=>r,DAYS:['Mon','Tue','Wed','Thu','Fri'],colorsOn:false,escapeHtml:String,sessionTypeClass:()=>'',bindSessionBlocks(){}};
 vm.createContext(ctx);vm.runInContext(sourceFunction('timetable.js','renderMonth'),ctx);ctx.renderMonth();
 for(const row of rows)assert.match(body.innerHTML,new RegExp('data-session-id="'+row.id+'"'));
 assert.match(body.innerHTML,/<details[^>]*class="cal-more"/);assert.match(body.innerHTML,/<summary[^>]*>1 more/);
});
test('Calendar type picker can restrict working categories to only its two scheduled domains',()=>{
 const filter=require('../frontend/scripts/calendar-activities').createActivityTypeFilter({activityCategories:['ccc','rotation_participant']});
 assert.equal(filter.matchesActivity({category:'clinical_day'}),false);assert.equal(filter.matchesActivity({category:'ccc'}),true);assert.equal(filter.matchesActivity({category:'rotation_participant'}),true);
});
test('visible projected dates do not disappear at a daylight-saving week boundary',()=>{
 const node={innerHTML:'',textContent:''},ctx={selectedWeek:11,selectedSemester:'winter',weekStart:()=>new Date(2027,2,15),addDays:(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n),formatDate:()=>'',filteredSessions:r=>r,calendarSourceSessions:()=>[{...rotation,date:'2027-03-15',week:10}],CALENDAR_DAY_START:450,CALENDAR_DAY_END:1020,DAYS:['Mon','Tue','Wed','Thu','Fri'],ymd:d=>d.toISOString().slice(0,10),layoutDaySessions:()=>[],escapeHtml:String,window:{PAWS_TASKS:{}},bindSessionBlocks(){},$:()=>node};vm.createContext(ctx);vm.runInContext(sourceFunction('timetable.js','renderWeek'),ctx);ctx.renderWeek();assert.equal(ctx.renderedSessions.length,1);
});
test('My Timetable accepts only the activity scope already loaded for this exact identity and faculty',()=>{
 const ctx={currentUser:{uid:'u',profile:{facultyId:'f'}},swapNameKey:()=>'',splitInstructorNames:()=>[]};vm.createContext(ctx);vm.runInContext(sourceFunction('timetable.js','sessionBelongsToCurrentFaculty'),ctx);
 assert.equal(ctx.sessionBelongsToCurrentFaculty({...rotation,activityOwnerUid:'u',activityFacultyId:'f'}),true);
 assert.equal(ctx.sessionBelongsToCurrentFaculty({...rotation,activityOwnerUid:'old',activityFacultyId:'f'}),false);
});
test('a same-UID role change cannot reuse a broader activity cache entry',async()=>{
 const cache=search.createActivityCache(),scope={uid:'u',start:'2026-10-01',end:'2026-10-03',role:'administrator'};
 await cache.get(scope,{load:async()=>['admin rows']});
 assert.equal(cache.peek({...scope,role:'faculty'}),null);
 assert.deepEqual(await cache.get({...scope,role:'faculty'},{load:async()=>['own rows']}),['own rows']);
});
test('auth or confirmed-data reset clears the projection and invalidates pending activity paints',()=>{
 let invalidated=0,cleared=0;const ctx={workingCalendarRows:[rotation],workingCalendarScope:'old',workingActivityRenderToken:1,workingActivityCache:{invalidate:()=>{invalidated++;}},window:{PAWS_CALENDAR_ACTIVITIES:{clear:()=>{cleared++;}}}};
 let body='';try{body=sourceFunction('timetable.js','resetWorkingCalendar');}catch{}assert.ok(body,'missing resetWorkingCalendar');vm.createContext(ctx);vm.runInContext(body,ctx);ctx.resetWorkingCalendar();assert.equal(ctx.workingCalendarRows.length,0);assert.equal(ctx.workingCalendarScope,'');assert.equal(ctx.workingActivityRenderToken,2);assert.equal(invalidated,1);assert.equal(cleared,1);
});
test('read-only activity detail labels default time and offers no edit, assignment or SWAP writes',()=>{
 let html='';const ctx={displayFacultyList:require('../frontend/scripts/faculty-name').formatList,renderedSessions:[rotation],sessions:[],sessionCache:new Map(),canEditExistingSqlSession:()=>true,currentUser:{uid:'u'},scheduleSource:'vetmed-ops',window:{PAWS_SWAP:{isPending:()=>false},UCVM_PAWS_DATA:{sessionEditEnabled:()=>true}},showModal:value=>{html=value;},escapeHtml:value=>String(value??'').replace(/</g,'&lt;').replace(/>/g,'&gt;'),formatLongDate:()=>'',parseYmd:s=>new Date(s),detailField:(k,v)=>k+': '+v,detailFieldMultiline:(k,v)=>k+': '+v,instructorDisplayText:()=>rotation.instructor,closeModal(){},$:()=>({})};
 vm.createContext(ctx);vm.runInContext(sourceFunction('timetable.js','openSessionDetail'),ctx);
 ctx.openSessionDetail(rotation.id);assert.doesNotMatch(html,/Edit Session|Manage Instructors|SWAP request/);assert.match(html,/default/i);assert.match(html,/08:30.*16:30/);assert.match(html,/2026-10-01.*2026-10-02/);
});
test('delegated selection rejects projected work rather than submitting synthetic IDs',()=>{
 let toggled=0,rejected='';const row={...rotation};
 const controller=search.createSessionBlockController({host:{addEventListener(){},querySelectorAll:()=>[]},getRows:()=>[row],getSelectionMode:()=>true,onToggle:()=>{toggled++;},onRejected:value=>{rejected=value;}});
 controller.refresh();controller.activate(row.id);assert.equal(toggled,0);assert.match(rejected,/read.only/i);
});

test('activity projection paints the main calendar, removes its duplicate lane, and cannot survive identity/range change',()=>{
 let renders=0;const range={start:'2026-10-01',end:'2026-10-03'},host={innerHTML:'Loading'},ctx={window:{PAWS_ACTIVITY_PLACEMENT:placement},sessions:[{id:'teaching'}],currentUser:{uid:'u',profile:{}},myTimetableOnly:false,roleIsFaculty:()=>false,workingActivityRange:()=>range,workingCalendarRows:[],workingCalendarScope:'',parseYmd:s=>new Date(s),academicPositionForDate:()=>({semester:'fall',week:6}),renderCalendarView:()=>{renders++;},$:()=>host};
 vm.createContext(ctx);
 for(const name of ['workingActivityScope','setCalendarActivityRows','calendarSourceSessions']){
  let body='';try{body=sourceFunction('timetable.js',name);}catch{}assert.ok(body,'missing shipped function '+name);vm.runInContext(body,ctx);
 }
 const scope=ctx.workingActivityScope(range),source={activityId:'a',category:'rotation_participant',label:'Rotation',facultyDisplayName:'Example, Alex',startDate:range.start,endDate:'2026-10-02'};
 ctx.setCalendarActivityRows([source],{range,scope});assert.equal(host.innerHTML,'');assert.equal(renders,1);
 assert.equal(ctx.calendarSourceSessions().length,3);assert.equal(ctx.workingCalendarRows[0].academicYear,'2026-27');
 ctx.currentUser={uid:'other',profile:{}};assert.equal(ctx.calendarSourceSessions().length,1,'old authorized projection is excluded immediately');
 ctx.currentUser={uid:'u',profile:{}};ctx.workingActivityRange=()=>({start:'2026-11-01',end:'2026-11-03'});assert.equal(ctx.calendarSourceSessions().length,1);
});
