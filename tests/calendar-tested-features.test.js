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

// Run the actual notification module in a minimal browser-like document.
// Real authorization policies are used separately from DOM fixture data.
function notificationFixture(){
 const fs=require('node:fs'),vm=require('node:vm');
 const node=tag=>({tag,children:[],textContent:'',removed:false,append(...children){this.children.push(...children);},setAttribute(){},remove(){this.removed=true;}});
 const body=node('body'),targets={'afc-request-btn':{clicks:0,click(){this.clicks++;}},'swap-inbox-btn':{clicks:0,click(){this.clicks++;}}};
 const storage=new Map(),root={document:{body,createElement:node,getElementById:id=>targets[id]},sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}};
 vm.runInNewContext(fs.readFileSync('frontend/scripts/calendar-tested-features.js','utf8'),{window:root});
 return {feature:root.PAWS_TESTED_CALENDAR,body,targets,storage,visible:()=>body.children.filter(item=>!item.removed)};
}
const noticeUser=(role,options={})=>({uid:'synthetic',role,profile:{role,active:true,mustChangePassword:false,facultyId:['faculty','hicc','visc'].includes(role)?'synthetic-faculty':null,...options}});
const noticeAfc=[{status:'pending_admin',requesterFirebaseUid:'other',reason:'PRIVATE'},{status:'pending_report_to',reportToFirebaseUid:'synthetic'},{status:'approved',requesterFirebaseUid:'synthetic'},{status:'approved',requesterFirebaseUid:'other'}];
const noticeSwaps=[{status:'pending',canDecide:true,note:'PRIVATE'},{status:'pending',canDecide:false}];
const noticeText=element=>[element.textContent,...element.children.flatMap(noticeText)].filter(Boolean);
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

test('notification source dispatch matches the actual AFC and SWAP read contracts',async()=>{
 const {createAfcRequestApi}=require('../server/src/afc/afc-request-api');
 const {createSwapApi}=require('../server/src/swap/swap-api');
 for(const user of [
  ...['developer','adfa_general','adfa_regular','faculty','hicc','visc','adc','lab','owner','administrator','admin'].map(role=>noticeUser(role)),
  noticeUser('faculty',{facultyId:null}),noticeUser('adc',{active:false}),noticeUser('lab',{mustChangePassword:true}),
  {...noticeUser('developer'),profile:null}
 ]){
  const h=notificationFixture(),calls=[];
  const auth={verifyToken:async()=>({uid:user.uid}),findUser:async()=>user.profile?{...user.profile,baseRole:user.profile.role}:null};
  const afc=createAfcRequestApi({...auth,repository:{listRequests:async()=>[]}});
  const swap=createSwapApi({...auth,repository:{queue:async()=>({requests:[],notifications:[]})}});
  const afcAllowed=(await afc.list('valid')).status===200,swapAllowed=(await swap.queue('valid')).status===200;
  await h.feature.showNotifications(user,{getUser:()=>user,api:{
   async listAfcRequests(){calls.push('afc');return noticeAfc;},
   async swapQueue(){calls.push('swap');return {requests:noticeSwaps};}
  },isAdmin:['developer','adfa_general','adfa_regular','owner','administrator','admin'].includes(user.role)});
  assert.deepEqual(calls,[...(afcAllowed?['afc']:[]),...(swapAllowed?['swap']:[])],user.role);
  const visible=h.visible();
  if(!afcAllowed&&!swapAllowed){assert.equal(visible.length,0);continue;}
  assert.equal(visible.length,1);
  const words=noticeText(visible[0]).join(' ');
  assert.equal(words.includes('AFC requests'),afcAllowed,user.role);
  assert.equal(words.includes('SWAP requests'),swapAllowed,user.role);
  assert.doesNotMatch(words,/PRIVATE/);
  if(!afcAllowed){assert.equal(visible[0].children[1].children.length,1);assert.match(words,/1 SWAP requests awaiting your decision/);}
 }
});

test('eligible notices remain actionable, dismiss per UID and avoid duplicate requests',async()=>{
 const h=notificationFixture(),user=noticeUser('developer'),calls=[];
 const api={listAfcRequests:async()=>{calls.push('afc');return noticeAfc;},swapQueue:async()=>{calls.push('swap');return {requests:noticeSwaps};}};
 await h.feature.showNotifications(user,{getUser:()=>user,api,isAdmin:true});
 const panel=h.visible()[0],list=panel.children[1];
 assert.equal(list.children.length,4);
 assert.match(noticeText(list).join(' '),/1 AFC requests awaiting office review/);
 assert.match(noticeText(list).join(' '),/1 AFC requests awaiting your Reports To review/);
 assert.match(noticeText(list).join(' '),/1 Your AFC requests with a decision/);
 assert.match(noticeText(list).join(' '),/1 SWAP requests awaiting your decision/);
 await h.feature.showNotifications(user,{getUser:()=>user,api,isAdmin:true});
 assert.deepEqual(calls,['afc','swap']);
 list.children[3].children[1].onclick();
 assert.equal(h.targets['swap-inbox-btn'].clicks,1);assert.equal(h.visible().length,0);
 assert.equal(h.storage.get('paws-workflow-notice-dismissed:synthetic'),'1');
 h.feature.clearNotifications();
 await h.feature.showNotifications(user,{getUser:()=>user,api,isAdmin:true});
 assert.deepEqual(calls,['afc','swap']);
 const next={...noticeUser('adc'),uid:'another-synthetic'};
 await h.feature.showNotifications(next,{getUser:()=>next,api});
 assert.deepEqual(calls,['afc','swap','swap']);
 assert.equal(h.visible().length,1);
});

test('notification reads and rendering are isolated across immediate and in-flight identity changes',async()=>{
 const h=notificationFixture(),first=noticeUser('developer'),next={...noticeUser('adc'),uid:'another-synthetic'};
 let current=first,afcReads=0,swapReads=0;
 const delayed=deferred(),api={listAfcRequests(){afcReads++;return delayed.promise;},swapQueue(){swapReads++;return Promise.resolve({requests:noticeSwaps});}};
 const staleBeforeDispatch=h.feature.showNotifications(first,{getUser:()=>current,api,isAdmin:true});
 current=next;h.feature.clearNotifications();
 await staleBeforeDispatch;
 assert.equal(afcReads,0);assert.equal(swapReads,0);assert.equal(h.visible().length,0);
 current=first;
 const pending=h.feature.showNotifications(first,{getUser:()=>current,api,isAdmin:true});
 await Promise.resolve();
 assert.equal(afcReads,1);assert.equal(swapReads,1);
 current=next;h.feature.clearNotifications();
 await h.feature.showNotifications(next,{getUser:()=>current,api});
 const panel=h.visible()[0];assert.equal(afcReads,1);assert.equal(swapReads,2);
 delayed.resolve(noticeAfc);await pending;
 assert.equal(h.visible().length,1);assert.equal(h.visible()[0],panel);
 assert.doesNotMatch(noticeText(panel).join(' '),/AFC/);
 const open=panel.children[1].children[0].children[1];
 current=null;h.feature.clearNotifications();open.onclick();
 assert.equal(h.targets['swap-inbox-btn'].clicks,0);assert.equal(h.visible().length,0);
});

test('genuine AFC refusal still invalidates the actual data-client guard before notification rendering',async()=>{
 const h=notificationFixture(),user=noticeUser('faculty');
 const {createPawsDataClient}=require('../frontend/scripts/paws-data-client');
 const {createEffectiveAccessGuard}=require('../frontend/scripts/effective-access-guard');
 const events=[];
 const guard=createEffectiveAccessGuard({load:async()=>({allowed:true,status:'ready',role:'faculty',facultyId:'synthetic-faculty',version:'0000000000000001'}),onChange:reason=>{events.push(reason);h.feature.clearNotifications();}});
 const api=createPawsDataClient({accessGuard:guard,tokenProvider:async()=>'synthetic-token',fetchImpl:async url=>{
  if(url.endsWith('/api/v1/afc-requests'))return {ok:false,status:403,json:async()=>({error:{code:'ROLE_DENIED'}})};
  return {ok:true,status:200,json:async()=>({requests:noticeSwaps})};
 }});
 await h.feature.showNotifications(user,{getUser:()=>user,api});
 assert.deepEqual(events,['changed']);assert.equal(guard.current(guard.capture()),false);assert.equal(h.visible().length,0);
});
