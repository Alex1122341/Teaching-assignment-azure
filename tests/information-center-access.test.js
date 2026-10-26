'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
let createInformationCenter;
try{({createInformationCenter}=require('../frontend/scripts/information-center'));}catch(error){if(!(error instanceof ReferenceError))throw error;}
function harness(api){assert.equal(typeof createInformationCenter,'function');const states=[];return {states,controller:createInformationCenter({api,onChange:state=>states.push(state)})};}
test('information center shows only server announcements and respects the effective publish capability',async()=>{
 const calls=[],h=harness({announcements:async()=>({version:'1.000000001',messages:[],canPublish:false}),publishAnnouncement:async input=>{calls.push(input);return {version:'1.000000002',messages:[{title:input.title}],canPublish:true};}});
 await h.controller.load();assert.deepEqual(h.states.at(-1).messages,[]);assert.equal(h.states.at(-1).canPublish,false);await assert.rejects(h.controller.publish({title:'No',body:'No'}),/publish/i);assert.equal(calls.length,0);
 const owner=harness({announcements:async()=>({version:'1.000000001',messages:[{title:'Original'}],canPublish:true}),publishAnnouncement:async input=>{calls.push(input);return {version:'1.000000002',messages:[{title:input.title}],canPublish:true};}});
 await owner.controller.load();await owner.controller.publish({title:'New',body:'Message'});assert.deepEqual(calls[0],{expectedVersion:'1.000000001',title:'New',body:'Message'});assert.equal(owner.states.at(-1).messages[0].title,'New');
});
test('identity change clears announcements and discards an older pending response',async()=>{
 let done;const h=harness({announcements:()=>new Promise(resolve=>done=resolve)});const pending=h.controller.load();h.controller.clear();done({version:'1.000000001',messages:[{body:'PRIVATE-OLD'}],canPublish:true});await pending;
 assert.deepEqual(h.states.at(-1).messages,[]);assert.equal(h.states.at(-1).canPublish,false);assert.doesNotMatch(JSON.stringify(h.states.at(-1)),/PRIVATE-OLD/);
});
test('failed load and ambiguous publish keep an explicit error and require reload before another publish',async()=>{
 const broken=harness({announcements:async()=>{throw Error('Offline');}});await broken.controller.load();assert.equal(broken.states.at(-1).error,'Offline');assert.deepEqual(broken.states.at(-1).messages,[]);
 let writes=0;const owner=harness({announcements:async()=>({version:'1.000000001',messages:[],canPublish:true}),publishAnnouncement:async()=>{writes++;throw Error('Outcome unknown. Reload.');}});await owner.controller.load();await assert.rejects(owner.controller.publish({title:'New',body:'Message'}),/Outcome unknown/);assert.equal(owner.states.at(-1).canPublish,false);await assert.rejects(owner.controller.publish({title:'Retry',body:'Message'}),/publish/i);assert.equal(writes,1);
});
