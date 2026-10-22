'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {createCalendarActivityView}=require('../frontend/scripts/calendar-activities.js');
const row={activityId:'private-id',facultyKey:'public-key',facultyDisplayName:'Synthetic Faculty',category:'ccc',label:'CCC Day',startDate:'2026-04-29',endDate:'2026-05-03',timeStatus:'not_provided',timeEvidence:[]};
test('academic context supports the existing short year and full year without assigning an activity year',()=>{
 const {academicRange}=require('../frontend/scripts/calendar-activities.js');
 assert.deepEqual(academicRange('2026-27'),{start:'2026-05-01',end:'2027-05-01'});
 assert.deepEqual(academicRange('2026-2027'),academicRange('2026-27'));
 assert.equal(academicRange('2026-28'),null);assert.equal(academicRange(''),null);
});
test('date-only ranges keep source dates and weekends without invented clocks or session actions',()=>{
 const view=createCalendarActivityView({api:{},getUser:()=>({uid:'synthetic'})});const html=view.renderRangeLane([row],{start:'2026-05-01',end:'2026-05-08',filters:{}});
 assert.match(html,/2026-04-29/);assert.match(html,/2026-05-03/);assert.match(html,/Not provided/);assert.match(html,/Needs Review/);assert.doesNotMatch(html,/07:30|17:00|data-session-id=|Edit Session|Manage Instructors|SWAP request|private-id|public-key/);
 assert.match(view.renderRangeLane([{...row,startDate:'2026-05-02',endDate:'2026-05-03'}],{start:'2026-05-01',end:'2026-05-04',filters:{}}),/2026-05-02/);
});
test('range/category intersection and source escaping preserve only public display fields',()=>{
 const view=createCalendarActivityView({api:{},getUser:()=>({uid:'synthetic'})});const malicious={...row,label:'<img src=x onerror=alert(1)>',facultyDisplayName:'=HYPERLINK("x") <script>bad</script>',evidenceNote:'private secret',timeEvidence:[{date:'2026-05-01',startTime:'09:00',endTime:'10:00',evidenceNote:'private'}]};
 const html=view.renderRangeLane([malicious],{start:'2026-05-01',end:'2026-05-03',filters:{category:'ccc'}});assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<script|<img|private/);assert.match(html,/2026-05-01.*09:00.*10:00/s);
 assert.doesNotMatch(view.renderRangeLane([row],{start:'2026-05-04',end:'2026-05-08',filters:{}}),/CCC Day/);
 assert.doesNotMatch(view.renderRangeLane([row],{start:'2026-05-01',end:'2026-05-03',filters:{category:'clinical_day'}}),/CCC Day/);
});
test('paging loads the authorized range and rejects a repeated cursor',async()=>{
 const calls=[];let count=0;const view=createCalendarActivityView({getUser:()=>({uid:'synthetic'}),api:{listCalendarActivities:async args=>{calls.push(args);return ++count===1?{activities:[row],nextCursor:'next'}:{activities:[{...row,label:'Other'}],nextCursor:null};}}});
 assert.equal((await view.loadRange({start:'2026-05-01',end:'2026-05-08'})).length,2);assert.equal(calls[1].cursor,'next');
 const bad=createCalendarActivityView({getUser:()=>({uid:'synthetic'}),api:{listCalendarActivities:async()=>({activities:[],nextCursor:'repeat'})}});await assert.rejects(()=>bad.loadRange({start:'2026-05-01',end:'2026-05-08'}),/cursor|paging/i);
});
test('logout and a newer range discard stale responses',async()=>{
 let uid='first',finish;const view=createCalendarActivityView({getUser:()=>({uid}),api:{listCalendarActivities:()=>new Promise(resolve=>{finish=resolve;})}});
 const pending=view.loadRange({start:'2026-05-01',end:'2026-05-08'});uid='second';finish({activities:[row],nextCursor:null});assert.deepEqual(await pending,[]);
 const pending2=view.loadRange({start:'2026-05-01',end:'2026-05-08'});view.clear();finish({activities:[row],nextCursor:null});assert.deepEqual(await pending2,[]);
});
test('faculty loading uses self scope or an administrator-only mapping and sanitized candidate key',async()=>{
 const calls=[];const view=createCalendarActivityView({getUser:()=>({uid:'synthetic'}),api:{listCalendarActivities:async args=>{calls.push(args);return args.includeFacultyKeys?{activities:[],facultyKeys:[{facultyId:'canonical',facultyKey:'public-key'}],nextCursor:null}:{activities:[row],nextCursor:null};}}});
 const range={start:'2026-05-01',end:'2026-05-08'};await view.loadFacultyRange('canonical',range,{self:true});assert.equal(calls.length,1);assert.equal(calls[0].facultyKey,undefined);
 calls.length=0;await view.loadFacultyRange('canonical',range,{self:false});assert.equal(calls[0].includeFacultyKeys,true);assert.equal(calls[1].facultyKey,'public-key');assert.equal(calls[1].facultyId,undefined);
});
