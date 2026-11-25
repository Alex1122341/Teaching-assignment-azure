'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const feature=require('../frontend/scripts/calendar-tested-features.js');
const {CLOSURES}=require('../server/src/afc/afc-policy.js');
test('catalog matches accepted AFC policy',()=>{
 assert.deepEqual(feature.closures.map(r=>r.date),[...CLOSURES]);
});
test('bounded display-only overlay does not modify teaching records',()=>{
 const source=[{id:'s'}],range={start:'2027-03-26',end:'2027-03-30'};
 assert.equal(feature.withClosures(source,range,false),source);
 const rows=feature.withClosures(source,range,true);
 assert.equal(source.length,1);
 assert.deepEqual(rows.slice(1).map(r=>r.date),['2027-03-26','2027-03-29']);
 for(const r of rows.slice(1)){assert.equal(r.readOnlyActivity,true);assert.equal(r.isUniversityClosure,true);assert.deepEqual(r.assignments,[]);assert.equal(r.start,'07:30');assert.equal(r.end,'17:00');assert.equal(r.instructor,'');}
 assert.equal(feature.withClosures(source,{start:'2027-02-30',end:'2027-03-30'},true),source);
});
test('notifications expose only authorized actionable counts and own decisions',()=>{
 const afc=[{status:'pending_admin',requesterFirebaseUid:'other',reason:'PRIVATE'},{status:'pending_report_to',reportToFirebaseUid:'me'},{status:'pending_report_to',reportToFirebaseUid:'other'},{status:'approved',requesterFirebaseUid:'me'},{status:'rejected',requesterFirebaseUid:'other'}],swaps=[{status:'pending',canDecide:true},{status:'pending',canDecide:false},{status:'applied',canDecide:true}];
 const rows=feature.notices({uid:'me'},afc,swaps,false);
 assert.deepEqual(rows.map(r=>[r.key,r.count]),[['afc-report-to',1],['afc-decided',1],['swap-pending',1]]);
 assert.equal(JSON.stringify(rows).includes('PRIVATE'),false);
 assert.deepEqual(feature.notices({uid:'me'},afc,swaps,true).map(r=>r.key),['afc-admin','afc-report-to','afc-decided','swap-pending']);
 assert.deepEqual(feature.notices(null,afc,swaps,true),[]);
});
test('calendar and login integration is explicitly wired',()=>{
 const fs=require('node:fs'),js=fs.readFileSync('frontend/scripts/timetable.js','utf8'),html=fs.readFileSync('frontend/pages/index.html','utf8');
 assert.match(html,/id="show-university-closures"/);
 assert.ok(html.indexOf('calendar-tested-features.js')<html.indexOf('src="timetable.js"'));
 assert.match(js,/PAWS_TESTED_CALENDAR.*withClosures/);
 assert.match(js,/if\(s\.isUniversityClosure\)return true/);
 assert.match(js,/PAWS_TESTED_CALENDAR\?\.showNotifications/);
 assert.match(js,/PAWS_TESTED_CALENDAR\?\.clearNotifications/);
});
