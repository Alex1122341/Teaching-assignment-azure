'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
let lib={};try{lib=require('../frontend/scripts/calendar-activity-placement');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
const range={start:'2026-10-01',end:'2026-10-04'};
const activity=(overrides={})=>({activityId:'11111111-1111-4111-8111-111111111111',category:'rotation_participant',label:'Clinical Rotation',facultyKey:'opaque-person',facultyDisplayName:'Example, Alex',startDate:'2026-09-30',endDate:'2026-10-04',timeStatus:'unconfirmed',timeEvidence:[],...overrides});

test('only dated CCC and Rotation are scheduled; named other work is not missing-faculty work',()=>{
 assert.equal(typeof lib.isScheduledActivity,'function');
 assert.equal(lib.isScheduledActivity(activity()),true);assert.equal(lib.isScheduledActivity(activity({category:'ccc',staffingKind:'unassigned',staffingLabel:'Locum'})),true);
 for(const category of ['clinical_day','vetm581_rounds','vetm591_presentations','vetm571_clinical_pharmacology','teaching_excellence','unknown'])assert.equal(lib.isScheduledActivity(activity({category})),false);
 assert.deepEqual(lib.otherActivities([activity(),activity({category:'ccc'}),activity({category:'clinical_day'})]).map(r=>r.category),['clinical_day']);
});
test('inclusive source ranges are clipped to the exclusive window, with labelled default times',()=>{
 assert.equal(typeof lib.projectSessions,'function');const original=activity(),copy=JSON.stringify(original),rows=lib.projectSessions([original],range);
 assert.deepEqual(rows.map(row=>row.date),['2026-10-01','2026-10-02','2026-10-03']);
 for(const row of rows){assert.equal(row.start,'08:30');assert.equal(row.end,'16:30');assert.equal(row.timeDefaulted,true);assert.equal(row.readOnlyActivity,true);assert.equal(row.isWorkingActivity,true);assert.equal(row.sourceActivity.timeStatus,'unconfirmed');assert.equal(row.sourceActivity,original);assert.equal(row.year,null);assert.equal(row.id,'activity:'+original.activityId+':'+row.date);}
 assert.equal(JSON.stringify(original),copy,'no date/time evidence is rewritten');
});
test('explicit verified evidence wins per day; partial and invalid intervals use the default',()=>{
 assert.equal(typeof lib.projectSessions,'function');const rows=lib.projectSessions([activity({timeEvidence:[{date:'2026-10-01',startTime:'09:15',endTime:'12:00'},{date:'2026-10-02',startTime:'17:00',endTime:'08:00'},{date:'2026-10-03',startTime:'09:00'}]})],range);
 assert.deepEqual(rows.map(r=>[r.start,r.end,r.timeDefaulted]),[['09:15','12:00',false],['08:30','16:30',true],['08:30','16:30',true]]);
});
test('Rotation selection excludes teaching/CCC; Year1–4 never includes Rotation',()=>{
 assert.equal(typeof lib.matchesYear,'function');const rotation={isWorkingActivity:true,activityCategory:'rotation_participant',year:null},ccc={isWorkingActivity:true,activityCategory:'ccc',year:null};
 assert.equal(lib.matchesYear(rotation,'rotation'),true);assert.equal(lib.matchesYear(ccc,'rotation'),false);assert.equal(lib.matchesYear({year:4},'rotation'),false);
 for(const year of ['1','2','3','4']){assert.equal(lib.matchesYear(rotation,year),false);assert.equal(lib.matchesYear({year:Number(year)},year),true);}
 for(const row of [rotation,ccc,{year:1}])assert.equal(lib.matchesYear(row,'all'),true);
});
test('out-of-window ranges are empty, weekends preserved and malformed ranges rejected',()=>{
 assert.equal(typeof lib.projectSessions,'function');assert.deepEqual(lib.projectSessions([activity({endDate:'2026-09-30'})],range),[]);
 assert.equal(lib.projectSessions([activity()],range).at(-1).date,'2026-10-03','Saturday is not silently removed from source');
 assert.throws(()=>lib.projectSessions([activity({startDate:'2026-02-30'})],range),/date|range/i);
 assert.throws(()=>lib.projectSessions([activity({startDate:'2026-10-03',endDate:'2026-10-01'})],range),/date|range/i);
 assert.throws(()=>lib.projectSessions([activity()],{start:'2026-10-01',end:'2026-10-01'}),/date|range/i);
});
test('expansion is bounded and duplicate responses cannot duplicate a stable activity/day',()=>{
 assert.equal(typeof lib.projectSessions,'function');assert.throws(()=>lib.projectSessions([activity()],{...range,maxRows:2}),/limit|range|narrow/i);
 assert.equal(lib.projectSessions([activity(),activity()],range).length,3);
});
