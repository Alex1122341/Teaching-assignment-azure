'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createActivityTypeFilter,renderRangeLane}=require('../frontend/scripts/calendar-activities.js');
const vm=require('node:vm'),sourceFunction=require('../test-support/source-function');

test('owner revision excludes Remote work from work filters and selection',()=>{
 const filter=createActivityTypeFilter();assert.equal(filter.options().filter(x=>x.group==='work').length,7);
 assert.equal(filter.options().some(x=>x.key==='work:remote_work'),false);
 assert.equal(filter.matchesActivity({category:'remote_work'}),false);
 filter.setSelected(['work:remote_work']);assert.deepEqual(filter.selectedKeys(),[]);
});

test('all teaching and all seven source work categories are visible by default',()=>{
 const filter=createActivityTypeFilter();
 assert.equal(filter.summary(),'All activity types');
 assert.deepEqual(filter.options().filter(x=>x.group==='work').map(x=>x.label),[
  'CCC','Rotation participant','Clinical day / PPVM','VETM 581 clinical rounds',
  'VETM 571 clinical pharmacology','VETM 591 IM presentations','Teaching excellence'
 ]);
 assert.equal(filter.options().length,13);
 assert.equal(filter.matchesSession({type:'LAB'}),true);
 assert.equal(filter.matchesActivity({category:'ccc'}),true);
 assert.equal(filter.matchesActivity({category:'rotation_participant'}),true);
});

test('the shipped timetable and ordinary export filter use the same mixed type selection',()=>{
 const activityTypeFilter=createActivityTypeFilter();activityTypeFilter.setSelected(['teaching:LAB','work:ccc']);
 const rows=['LAB','LEC','CCC'].map(type=>({id:type,type,semester:'fall',year:'2026',course:'206'}));
 const fields={'search-input':{value:''},'filter-month':{value:'all'},'filter-type':{value:'all'}};
 const context={window:{PAWS_ACTIVITY_PLACEMENT:require("../frontend/scripts/calendar-activity-placement")},activityTypeFilter,sessions:rows,$:id=>fields[id],selectedYear:'all',selectedSemester:'fall',courseFilterActive:false,myTimetableOnly:false,showCcc:false};
 vm.createContext(context);vm.runInContext(sourceFunction('timetable.js','filteredSessions'),context);
 assert.deepEqual(Array.from(context.filteredSessions(),x=>x.id),['LAB','CCC']);
 activityTypeFilter.clear();assert.equal(context.filteredSessions().length,0);
 activityTypeFilter.reset();assert.equal(context.filteredSessions().length,3);
});

test('mixed selection applies to teaching, legacy CCC and source activity ranges',()=>{
 const filter=createActivityTypeFilter();
 filter.setSelected(['teaching:LAB','work:rotation_participant','work:clinical_day']);
 assert.equal(filter.summary(),'3 of 13 activity types');
 assert.equal(filter.matchesSession({type:'LAB'}),true);
 assert.equal(filter.matchesSession({type:'LEC'}),false);
 assert.equal(filter.matchesSession({type:'CCC'}),false);
 assert.equal(filter.matchesActivity({category:'rotation_participant'}),true);
 const base={facultyDisplayName:'Synthetic',startDate:'2026-10-14',endDate:'2026-10-19'};
 const html=renderRangeLane([{...base,category:'rotation_participant',label:'Rotation range'},{...base,category:'ccc',label:'CCC range'}],{start:'2026-10-16',end:'2026-10-17',filters:{typeKeys:filter.selectedKeys()}});
 assert.match(html,/Rotation range/);assert.doesNotMatch(html,/CCC range/);
 assert.match(html,/2026-10-14/);assert.match(html,/Default time: 08:30–16:30/);
 filter.setSelected(['work:ccc']);assert.equal(filter.matchesSession({type:'CCC'}),true);
});

test('clear is an empty selection, Reset restores all and newly observed teaching types are selectable',()=>{
 const filter=createActivityTypeFilter();filter.clear();
 assert.equal(filter.summary(),'No activity types');assert.deepEqual(filter.selectedKeys(),[]);
 assert.equal(filter.matchesSession({type:'LAB'}),false);assert.equal(filter.matchesActivity({category:'clinical_day'}),false);
 filter.setSessionTypes(['LEC','Workshop','CCC','<img src=x>','']);
 assert.equal(filter.options().filter(x=>x.key==='work:ccc').length,1);
 assert.equal(filter.matchesSession({type:'Workshop'}),false);
 filter.reset();assert.equal(filter.summary(),'All activity types');assert.equal(filter.matchesSession({type:'Workshop'}),true);
 assert.equal(filter.matchesSession({type:' Workshop '}),true);
 filter.setSelected(['work:ccc']);filter.setSessionTypes(['Workshop','Seminar']);
 assert.equal(filter.matchesSession({type:'Seminar'}),false);
 filter.selectAll();assert.equal(filter.matchesSession({type:'Seminar'}),true);
 const options=filter.options();options[0].label='changed';assert.equal(filter.options()[0].label,'LEC');
});

test('All dates filtering discovers later and missing teaching types without silently losing export rows',()=>{
 const activityTypeFilter=createActivityTypeFilter();
 const fields={'search-input':{value:''},'filter-month':{value:'all'}};
 const context={window:{PAWS_ACTIVITY_PLACEMENT:require("../frontend/scripts/calendar-activity-placement")},activityTypeFilter,$:id=>fields[id],selectedYear:'all',selectedSemester:'fall',courseFilterActive:false,myTimetableOnly:false};
 vm.createContext(context);vm.runInContext(sourceFunction('timetable.js','filteredSessions'),context);
 const rows=['LAB','Workshop',''].map((type,i)=>({id:i,type,semester:'fall'}));
 assert.deepEqual(Array.from(context.filteredSessions(rows),x=>x.id),[0,1,2]);
 assert.ok(activityTypeFilter.options().some(x=>x.label==='Teaching type not provided'));
 activityTypeFilter.setSelected(['teaching:LAB']);assert.deepEqual(Array.from(context.filteredSessions(rows),x=>x.id),[0]);
 activityTypeFilter.reset();assert.equal(context.filteredSessions(rows).length,3);
});

test('changing account removes dynamically discovered types and the previous user selection',()=>{
 const filter=createActivityTypeFilter();filter.setSessionTypes(['Private source type']);filter.setSelected(['teaching:Private source type']);
 filter.resetForUser();assert.equal(filter.options().length,13);assert.equal(filter.summary(),'All activity types');
 assert.equal(filter.options().some(x=>x.label==='Private source type'),false);
});
