'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createActivityTypeFilter}=require('../frontend/scripts/calendar-activities');
const sourceFunction=require('../test-support/source-function');
const source=fs.readFileSync('frontend/scripts/timetable.js','utf8');
const calendarFilter=()=>createActivityTypeFilter({activityCategories:['ccc','rotation_participant'],defaultGroups:['teaching']});

test('Calendar default and Reset show teaching sessions while CCC and Rotation remain opt-in',()=>{
 const filter=calendarFilter();
 assert.equal(filter.matchesSession({type:'LAB'}),true);
 assert.equal(filter.matchesSession({type:'CCC'}),false);
 assert.equal(filter.matchesActivity({category:'ccc'}),false);
 assert.equal(filter.matchesActivity({category:'rotation_participant'}),false);
 assert.equal(filter.options().filter(row=>row.group==='work').length,2);
 filter.selectAll();assert.equal(filter.matchesActivity({category:'ccc'}),true);
 filter.reset();assert.equal(filter.matchesActivity({category:'ccc'}),false);
 filter.setSessionTypes(['Workshop','']);assert.equal(filter.matchesSession({type:'Workshop'}),true);assert.equal(filter.matchesSession({type:''}),true);
 filter.setSelected(['teaching:LAB']);filter.setSessionTypes(['Seminar']);assert.equal(filter.matchesSession({type:'Seminar'}),false);
 filter.reset();assert.equal(filter.matchesSession({type:'Seminar'}),true);
 filter.resetForUser();assert.equal(filter.matchesActivity({category:'ccc'}),false);assert.equal(filter.options().some(row=>row.key==='teaching:Seminar'),false);
});

test('the shipped Calendar explicitly uses teaching-only defaults',()=>{
 const initialization=source.match(/const activityTypeFilter = [^\n]+/)[0];
 assert.match(initialization,/defaultGroups:\s*\['teaching'\]/);
});

test('Restore all activity types is an explicit opt-in, distinct from Reset defaults',()=>{
 const filter=calendarFilter();filter.clear();
 const context={activityTypeFilter:filter,contentFilterBatch:false,render(){}};
 vm.createContext(context);vm.runInContext(sourceFunction('timetable.js','changeContentFilter'),context);
 context.changeContentFilter('restore-types');
 assert.equal(filter.matchesActivity({category:'ccc'}),true);
 assert.equal(filter.matchesActivity({category:'rotation_participant'}),true);
 filter.reset();assert.equal(filter.matchesActivity({category:'ccc'}),false);
});

test('explicit Year Rotation selection makes Rotation visible and remains exclusive',()=>{
 const filter=calendarFilter();let click;
 const start=source.indexOf("$('year-btn-row').addEventListener('click'");
 const end=source.indexOf("$('semester-btn-row').addEventListener",start);
 const context={activityTypeFilter:filter,selectedYear:'all',render(){},document:{querySelectorAll:()=>[]},$:()=>({addEventListener:(event,handler)=>{click=handler;}})};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 const button={dataset:{year:'rotation'}};click({target:{closest:()=>button}});
 assert.equal(filter.matchesActivity({category:'rotation_participant'}),true);
 const fields={'search-input':{value:''},'filter-month':{value:'all'}};
 Object.assign(context,{$:id=>fields[id],window:{PAWS_ACTIVITY_PLACEMENT:require('../frontend/scripts/calendar-activity-placement')},selectedSemester:'fall',courseFilterActive:false,myTimetableOnly:false});
 vm.runInContext(sourceFunction('timetable.js','filteredSessions'),context);
 const rows=[{id:'rotation',isWorkingActivity:true,activityCategory:'rotation_participant',sourceActivity:{category:'rotation_participant'},semester:'fall'}, {id:'lab',type:'LAB',year:4,semester:'fall'}];
 assert.deepEqual(Array.from(context.filteredSessions(rows),row=>row.id),['rotation']);
 filter.reset();assert.equal(filter.matchesActivity({category:'rotation_participant'}),false);
});
