'use strict';
// Regression tests for read-only HICC/CC directory projection and LAB Calendar blocks.
// These exercise the shipped browser modules and the real timetable render functions.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const lab=require('../frontend/scripts/lab-session-detail');
const directory=require('../frontend/scripts/leadership-directory');
const sourceFunction=require('../test-support/source-function');

const labRow=(id,start,end,extra={})=>({
 id,date:'2026-10-26',academicYear:'2026-27',year:2,course:'306',
 type:'LAB',topic:'Clinical Skills',start,end,room:'Room '+id,instructor:'Faculty '+id,...extra
});
const directoryRow=(roleType,scope,facultyName,status='active',extra={})=>({
 roleType,scope,facultyName,status,startDate:'2026-07-01',endDate:'2027-06-30',...extra
});

test('three overlapping/adjacent VTMD 306 LAB source sessions create one 08:00–10:00 visual block',()=>{
 const raw=[labRow('s1','08:00','09:00'),labRow('s2','09:00','10:00'),labRow('s3','08:30','09:30')];
 const before=JSON.stringify(raw),visible=lab.calendarBlocks(raw,{gridOnly:true});
 assert.equal(visible.length,1);
 assert.deepEqual({id:visible[0].id,start:visible[0].start,end:visible[0].end,count:visible[0].labDisplayCount},
  {id:'s1',start:'08:00',end:'10:00',count:3});
 assert.equal(JSON.stringify(raw),before,'grouping must not mutate underlying SQL sessions');
 const detail=lab.buildModel(raw.find(row=>row.id===visible[0].id),raw);
 assert.deepEqual(detail.stations.map(row=>row.id),['s1','s3','s2'],'existing detail retains actual source records');
 const html=lab.render(detail,{actions:row=>'<button data-session-id="'+row.id+'">Edit</button>'});
 for(const row of raw)assert.match(html,new RegExp('data-session-id="'+row.id+'"'));
});

test('matching LAB periods with a real time gap stay in separate Calendar blocks',()=>{
 const rows=[labRow('s1','08:00','09:00'),labRow('s2','10:00','11:00'),labRow('s3','11:00','12:00')];
 const blocks=lab.calendarBlocks(rows);
 assert.deepEqual(blocks.map(row=>[row.start,row.end,row.labDisplayCount||1]),
 [['08:00','09:00',1],['10:00','12:00',2]]);
});

test('different topics, courses, dates, curricula, years and non-LAB rows stay independent',()=>{
 const base=labRow('a','08:00','09:00');
 const rows=[base,labRow('topic','09:00','10:00',{topic:'Other'}),
  labRow('course','09:00','10:00',{course:'307'}),
  labRow('date','09:00','10:00',{date:'2026-10-27'}),
  labRow('academic','09:00','10:00',{academicYear:'2027-28'}),
  labRow('year','09:00','10:00',{year:3}),
  labRow('srl','09:00','10:00',{type:'SRL'}),
  labRow('ccc','09:00','10:00',{isCcc:true}),
  labRow('activity','09:00','10:00',{readOnlyActivity:true})];
 const blocks=lab.calendarBlocks(rows);
 assert.equal(blocks.length,rows.length);
 assert.deepEqual(blocks.map(row=>row.id),rows.map(row=>row.id));
});

test('invalid and missing source times are kept separately, without fabricating a display interval',()=>{
 const rows=[labRow('bad1','',''),labRow('bad2','09:00','08:00'),
  labRow('unknown','08:00','09:00',{timeUnknown:true}),labRow('correct','08:00','09:00')];
 const blocks=lab.calendarBlocks(rows,{gridOnly:true});
 assert.equal(blocks.length,rows.length);
 for(const id of ['bad1','bad2','unknown'])assert.equal(blocks.find(row=>row.id===id).labDisplayCount,undefined);
 assert.equal(blocks.find(row=>row.id==='bad1').start,'');
});

test('separate visible user scopes never become one LAB group',()=>{
 const all=[labRow('a','08:00','09:00'),labRow('b','09:00','10:00')];
 assert.equal(lab.calendarBlocks([all[0]]).length,1);
 assert.equal(lab.calendarBlocks([all[0]])[0].end,'09:00');
 assert.equal(lab.calendarBlocks(all).length,1);
 assert.equal(lab.calendarBlocks(all)[0].end,'10:00');
});

test('a repeated source ID does not multiply the displayed LAB count',()=>{
 const a=labRow('a','08:00','09:00'),b=labRow('b','09:00','10:00');
 const blocks=lab.calendarBlocks([a,a,b]);
 assert.equal(blocks.length,1);
 assert.equal(blocks[0].labDisplayCount,2);
});

test('HICC suppresses Course Coordinator with the same normalized title and current active status',()=>{
 const raw=[directoryRow('HICC','VTMD 306','Smith, Alex'),
  directoryRow('Course Coordinator','  VTMD--306 ','Lee, Chris'),
  directoryRow('Course Coordinator','VTMD 307','Kim, Pat')];
 const projected=directory.projectedRows(raw,{kind:'hicc-cc'});
 assert.deepEqual(projected.map(row=>row.facultyName),['Smith, Alex','Kim, Pat']);
 assert.equal(raw.length,3,'source records must remain untouched');
 assert.equal(directory.viewRows(raw,{query:'lee',kind:'hicc-cc'}).length,0,'search cannot resurface a suppressed CC');
});

test('multiple legitimate HICCs remain; lone CC stays; VISC never changes',()=>{
 const raw=[directoryRow('HICC','306','Hicc A'),directoryRow('HICC','306','Hicc B'),
  directoryRow('Course Coordinator','306','CC'),
  directoryRow('Course Coordinator','307','Lone CC')];
 const projected=directory.projectedRows(raw);
 assert.deepEqual(projected.map(row=>row.facultyName),['Hicc A','Hicc B','Lone CC']);
 assert.equal(directory.projectedRows(raw,{kind:'visc'}).length,raw.length);
});

test('future or inactive HICC cannot hide an active Course Coordinator',()=>{
 const hFuture=directoryRow('HICC','306','Future HICC','upcoming',{startDate:'2027-01-01'});
 const hInactive=directoryRow('HICC','307','Past HICC','inactive',{endDate:'2026-05-01'});
 const ccActive306=directoryRow('Course Coordinator','306','Current CC');
 const ccActive307=directoryRow('Course Coordinator','307','Current CC 307');
 const raw=[hFuture,hInactive,ccActive306,ccActive307];
 assert.deepEqual(directory.projectedRows(raw).map(row=>row.facultyName),['Current CC','Current CC 307']);
 assert.equal(directory.projectedRows(raw,{showAll:true}).length,4);
});

test('overlapping future HICC and CC suppress duplicate future CC only in Show All',()=>{
 const raw=[directoryRow('HICC','306','HICC','upcoming',{startDate:'2027-01-01',endDate:'2027-06-30'}),
  directoryRow('Course Coordinator','306','CC','upcoming',{startDate:'2027-02-01',endDate:'2027-05-01'})];
 assert.equal(directory.projectedRows(raw).length,0);
 assert.deepEqual(directory.projectedRows(raw,{showAll:true}).map(row=>row.facultyName),['HICC']);
});

test('Dates needed precedence requires matching visible dates; missing scope is never guessed',()=>{
 const raw=[directoryRow('HICC','306','HICC','dates-needed',{startDate:null,endDate:null}),
 directoryRow('Course Coordinator','306','CC same','dates-needed',{startDate:null,endDate:null}),
 directoryRow('Course Coordinator','306','CC different','dates-needed',{startDate:null,endDate:'2027-06-30'}),
 directoryRow('Course Coordinator',null,'CC unknown','active')];
 assert.deepEqual(directory.projectedRows(raw).map(row=>row.facultyName),
 ['HICC','CC different','CC unknown']);
});

test('counts represent the actual deduplicated population, not hidden duplicate rows',()=>{
 const raw=[directoryRow('HICC','306','HICC'),directoryRow('Course Coordinator','306','CC'),
 directoryRow('Course Coordinator','307','CC 307')];
 const total=directory.projectedRows(raw,{showAll:true}).length;
 const displayed=directory.viewRows(raw,{showAll:false}).length;
 assert.equal(total,2);assert.equal(displayed,2);
 assert.match(directory.countText(displayed,total,false),/^2 of 2 appointments/);
});

function calendarHarness(rows){
 const elements=new Map();
 for(const key of ['calendar-body','cal-label','filter-month']){
  elements.set(key,{innerHTML:'',textContent:'',value:key==='filter-month'?'all':'',querySelectorAll(){return[]}});
 }
 const source=[
  sourceFunction('timetable.js','calendarDisplaySessions'),
  sourceFunction('timetable.js','layoutDaySessions'),
  sourceFunction('timetable.js','renderDay'),
  sourceFunction('timetable.js','renderWeek'),
  sourceFunction('timetable.js','renderMonth')
 ].join('\n');
 const context={
  selectionMode:false,selectedWeek:1,selectedSemester:'fall',selectedDayIndex:0,
  viewMode:'week',colorsOn:true,renderedSessions:[],sessions:rows,
  DAYS:['Mon','Tue','Wed','Thu','Fri'],CALENDAR_DAY_START:450,CALENDAR_DAY_END:1020,
  calendarSourceSessions:()=>rows,filteredSessions:items=>items,
  weekStart:()=>new Date(2026,9,26),
  addDays:(date,n)=>{const next=new Date(date);next.setDate(next.getDate()+n);return next;},
  ymd:date=>date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0'),
  formatDate:date=>String(date.getDate()),
  formatLongDate:date=>date.toDateString(),
  layoutDaySessions:null,unpositionedSessionsHtml:()=>'',bindSessionBlocks:()=>{},
  sessionTypeClass:()=>'',displayFacultyList:value=>String(value),
  escapeHtml:value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;'),
  calendarTimingDisposition:session=>{
   const minute=time=>Number(time.slice(0,2))*60+Number(time.slice(3));
   if(!/^[0-9]{2}:[0-9]{2}$/.test(session.start||'')||!/^[0-9]{2}:[0-9]{2}$/.test(session.end||'')||session.timeUnknown)return {disposition:'invalid'};
   const start=minute(session.start),end=minute(session.end);
   return {disposition:end<=450?'before':start>=1020?'after':'grid',startMinutes:start,endMinutes:end};
  },
  $:key=>elements.get(key),
  window:{UCVM_LAB_DETAIL:lab,PAWS_TASKS:{},PAWS_SWAP:{isPending:()=>false}}
 };
 vm.createContext(context);
 vm.runInContext(source,context);
 return {context,elements};
}

test('real Day and Week renderers paint one full-height 306 LAB block but retain three source sessions',()=>{
 const rows=[labRow('s1','08:00','09:00'),labRow('s2','09:00','10:00'),labRow('s3','08:30','09:30')];
 const {context,elements}=calendarHarness(rows);
 context.renderDay();
 let html=elements.get('calendar-body').innerHTML;
 assert.equal((html.match(/data-session-id="/g)||[]).length,1);
 assert.match(html,/08:00-10:00/);
 assert.match(html,/3 LAB sessions/);
 assert.equal(context.renderedSessions.length,3);
 context.renderWeek();
 html=elements.get('calendar-body').innerHTML;
 assert.equal((html.match(/data-session-id="/g)||[]).length,1);
 assert.match(html,/08:00-10:00/);
 assert.match(html,/3 LAB sessions/);
 assert.equal(context.renderedSessions.length,3);
});

test('real Month renderer shows one grouped LAB event; selection retains three individual rows',()=>{
 const rows=[labRow('s1','08:00','09:00'),labRow('s2','09:00','10:00'),labRow('s3','08:30','09:30')];
 const {context,elements}=calendarHarness(rows);
 context.renderMonth();
 let html=elements.get('calendar-body').innerHTML;
 assert.equal((html.match(/data-session-id="/g)||[]).length,1);
 assert.match(html,/08:00–10:00/);
 context.selectionMode=true;
 context.renderDay();
 html=elements.get('calendar-body').innerHTML;
 assert.equal((html.match(/data-session-id="/g)||[]).length,3);
 assert.equal(context.renderedSessions.length,3);
});
