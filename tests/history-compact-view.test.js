'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {renderRows}=require('../change-history');
const {createPawsAzureDataClient}=require('../paws-data-client');
test('history keyword and selected year reach the authenticated API without accepting hidden identity filters',async()=>{
 let url;const api=createPawsAzureDataClient({tokenProvider:async()=>'token',fetchImpl:async u=>{url=u;return {ok:true,json:async()=>({rows:[]})};}});
 await api.changeHistory({scope:'timetable',academicYear:'2026-27',keyword:'wet lab 206',actorFirebaseUid:'hidden'});
 const q=new URL(url).searchParams;assert.equal(q.get('keyword'),'wet lab 206');assert.equal(q.get('academicYear'),'2026-27');assert.equal(q.has('actorFirebaseUid'),false);
});
test('compact history rows combine type/domain and course/session into six cells without dropping zero or hidden full values',()=>{
 const html=renderRows([{changeDate:'2026-10-17T12:00:00Z',changeType:'session_updated',domain:'Teaching',course:'206',session:'Spinal Cord',field:'Room',previousValue:0,updatedValue:'<unsafe>'+('long '.repeat(200)),startDate:'2026-11-01',endDate:'2026-11-01',startTime:'08:30',endTime:'09:30',actor:'Avery'}]);
 assert.equal((html.match(/<td[ >]/g)||[]).length,6);assert.match(html,/206/);assert.match(html,/Spinal Cord/);assert.match(html,/N\/A|08:30/);assert.match(html,/>0</);assert.match(html,/<details/);assert.match(html,/long long/);assert.doesNotMatch(html,/<unsafe>/);
});
