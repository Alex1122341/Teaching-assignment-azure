'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {escape,validDate,filterEntries,groupEntries}=require('../frontend/scripts/ccc-schedule.js');
const read=p=>fs.readFileSync(repositoryPath(process.cwd(),p),'utf8');
test('CCC schedule is available beside Faculty Dashboard with isolated modal',()=>{
 const html=read('index.html');assert.match(html,/faculty-dashboard-btn[^]*ccc-schedule-btn/);
 assert.match(html,/ccc-schedule-overlay/);assert.match(html,/ccc-schedule\.css/);assert.match(html,/ccc-schedule\.js/);
 assert.match(read('timetable.js'),/ccc-schedule-btn'\)\.classList\.toggle\('hidden', !currentUser\)/);
});
test('client and API route remain independent of Calendar activity self-only endpoint',()=>{
 const client=read('paws-data-client.js'),runtime=read('server/src/runtime/swa-sql-runtime.js');
 assert.match(client,/cccSchedule\(academicYear\)/);
 assert.match(runtime,/createCccScheduleFunctions/);
 assert.match(runtime,/pathname==='\/api\/v1\/ccc-schedule'/);
 assert.doesNotMatch(read('ccc-schedule.js'),/listCalendarActivities|firestore|doe|\.collection\(/i);
});
test('search, stable sorting, and markup escape',()=>{
 const rows=[{date:'2026-10-22',facultyName:'Zoe',blockLabel:'Block 6'},{date:'2026-10-21',facultyName:'<Alex>',blockLabel:'Block 5'}];
 assert.equal(filterEntries(rows,'block 5')[0].facultyName,'<Alex>');
 assert.deepEqual(filterEntries(rows,'').map(x=>x.date),['2026-10-21','2026-10-22']);
 assert.equal(escape('<script>"&'), '&lt;script&gt;&quot;&amp;');
 assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2026-10-21'),true);
});
test('schedule rows with matching start date but different end dates stay separate',()=>{
 const rows=[
  {date:'2026-10-21',endDate:'2026-10-21',blockLabel:'Stoney | Block 5',courseCode:'CCC',facultyName:'A'},
  {date:'2026-10-21',endDate:'2026-10-22',blockLabel:'Stoney | Block 5',courseCode:'CCC',facultyName:'B'},
  {date:'2026-10-21',endDate:'2026-10-21',blockLabel:'Stoney | Block 5',courseCode:'CCC',facultyName:'C'}
 ];
 const groups=[...groupEntries(filterEntries(rows,'')).values()];
 assert.equal(groups.length,2);
 assert.deepEqual(groups.map(group=>[group.endDate,group.staff.map(person=>person.facultyName)]),[
  ['2026-10-21',['A','C']],['2026-10-22',['B']]
 ]);
});
test('schedule loader keeps error state distinct from an empty authorized result',()=>{
 const source=read('ccc-schedule.js');
 assert.match(source,/loadError=true;entries=\[\];render\(\)/);
 assert.match(source,/loadError\?'CCC schedule could not be loaded/);
 assert.match(source,/data\.entries\.some\(item=>/);
 assert.match(source,/onAuthStateChanged/);
});
test('viewer does not create availability records, write CCC or calculate DOE',()=>{
 const js=read('ccc-schedule.js');
 assert.match(js,/cccSchedule\(selected\)/);
 assert.doesNotMatch(js,/stageCcc|commitCcc|resolveCalendarActivity|facultyAvailability\(|INSERT|UPDATE|DELETE/);
});

// Behavioural harness: the previous assertions above only read source text, so a
// module that throws during setup still "passed". This drives the real module
// against a minimal DOM and fails if the viewer never becomes usable.
function fakeEnvironment({authThrows=true,entries=[],fail=false}={}){
 const listeners=new Map();
 const element=(id,extra={})=>{
  const node={id,hidden:extra.hidden===true,value:'',isConnected:true,dataset:{},children:[],attrs:{},_text:'',_html:'',
   addEventListener(type,fn){const key=id+':'+type;if(!listeners.has(key))listeners.set(key,[]);listeners.get(key).push(fn);},
   setAttribute(name,value){this.attrs[name]=value;},
   appendChild(child){this.children.push(child);},
   querySelectorAll(){return [];},
   focus(){document.activeElement=this;},
   classList:{toggle(){},add(){},remove(){}}};
  Object.defineProperty(node,'textContent',{get(){return node._text;},set(value){node._text=String(value);node._html='';node.children=[];}});
  Object.defineProperty(node,'innerHTML',{get(){return node._html;},set(value){node._html=String(value);node._text='';}});
  return node;
 };
 const byId=new Map();
 for(const id of ['ccc-schedule-overlay','ccc-schedule-btn','ccc-schedule-close','ccc-schedule-year','ccc-schedule-search','ccc-schedule-refresh','ccc-schedule-status','ccc-schedule-body'])byId.set(id,element(id,{hidden:id==='ccc-schedule-overlay'}));
 const document={activeElement:null,visibilityState:'visible',readyState:'complete',documentElement:element('html'),
  getElementById:id=>byId.get(id)||null,createElement:tag=>element(tag),addEventListener(){},querySelectorAll(){return [];}};
 const calls=[];
 const root={document,firebase:{auth(){if(authThrows)throw Error('No Firebase App');return{onAuthStateChanged(){return()=>{}},currentUser:{uid:'actor'}}}},
  UCVM_PAWS_DATA:{async cccSchedule(year){calls.push(year);if(fail)throw Error('network');return{academicYear:year,entries};}},
  addEventListener(){},clearInterval(){},setInterval(){return 1},CustomEvent:function(){}};
 return{root,document,byId,listeners,calls,fire:(id,type,event={})=>(listeners.get(id+':'+type)||[]).forEach(fn=>fn(event))};
}
function loadViewer(env){
 const vm=require('node:vm');
 const context=vm.createContext({window:env.root,document:env.document,module:undefined,Intl,Date,JSON,Map,Set,String,Number,Array,Object,Error,Boolean,console});
 vm.runInContext(fs.readFileSync(repositoryPath(process.cwd(), 'ccc-schedule.js'),'utf8'),context);
 return env.root.PAWS_CCC_SCHEDULE;
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
// Same May 1 – April 30 rule the viewer applies in America/Edmonton.
function expectedAcademicYear(){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Edmonton',year:'numeric',month:'2-digit'}).formatToParts(new Date());
 const year=Number(parts.find(x=>x.type==='year').value),month=Number(parts.find(x=>x.type==='month').value);
 const start=month<5?year-1:year;
 return start+'-'+String((start+1)%100).padStart(2,'0');
}

test('viewer initialises and renders even when firebase.auth() is not ready yet',async()=>{
 const env=fakeEnvironment({authThrows:true,entries:[
  {date:'2026-10-21',endDate:'2026-10-21',blockLabel:'Block 5',courseCode:'292',facultyName:'Alexandre Ellis',halfDay:true}
 ]});
 const viewer=loadViewer(env);
 assert.ok(viewer&&typeof viewer.open==='function','PAWS_CCC_SCHEDULE must exist even if firebase.auth() throws');
 env.root.firebase={auth(){return{onAuthStateChanged(){},currentUser:{uid:'actor'}}}};
 viewer.open();
 await tick();
 assert.deepEqual(env.calls,[expectedAcademicYear()]);
 assert.match(env.byId.get('ccc-schedule-body').innerHTML,/Alexandre Ellis/);
 assert.match(env.byId.get('ccc-schedule-body').innerHTML,/Half day/);
 assert.equal(env.byId.get('ccc-schedule-overlay').hidden,false);
 viewer.close();
 assert.equal(env.byId.get('ccc-schedule-overlay').hidden,true);
 assert.equal(env.byId.get('ccc-schedule-body').innerHTML,'');
});
test('a failed read shows the error state instead of an empty successful schedule',async()=>{
 const env=fakeEnvironment({authThrows:false,fail:true});
 const viewer=loadViewer(env);
 viewer.open();
 await tick();
 const body=env.byId.get('ccc-schedule-body').innerHTML;
 assert.match(body,/unavailable/);
 assert.doesNotMatch(body,/No CCC assignments match/);
});
