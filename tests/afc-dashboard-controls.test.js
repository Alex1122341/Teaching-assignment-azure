'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const nameContext = { window: {} };
vm.runInNewContext(fs.readFileSync(repositoryPath(process.cwd(), 'faculty-name.js'),'utf8'),nameContext);
const name = nameContext.window.PAWS_FACULTY_NAME;
const ID = '11111111-1111-4111-8111-111111111111';
async function dashboard({ enabled = true, confirm = true, apiOverrides = {} } = {}) {
  const elements = new Map(), caps = {}, cancellations = [];
  const records = [{ afcRecordId: ID, facultyId: ID, facultyName: 'Ada One', startDate: '2026-11-05', endDate: '2026-11-06', active: true, sourceKind: 'manual', versionToken: '00000000000000AB' }];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', innerHTML: '', textContent: '', disabled: false, listeners: {}, classList: { add(){}, remove(){}, toggle(){} }, addEventListener(event, fn){this.listeners[event]=fn;}, setAttribute(){}, reset(){} });
    return elements.get(id);
  };
  const api = {
    currentUser: async () => ({ role: 'administrator', active: true }),
    dashboardSummary: async () => ({ academicYear: '2026-27' }),
    dashboardFaculty: async () => [{ facultyId: ID, preferredFirstName: 'Ada', preferredLastName: 'One', active: true }],
    refreshFacultyAdminWriteCapabilities: async () => false,
    refreshDoeWriteCapabilities: async () => ({}),
    refreshAfcRecordWriteCapabilities: async () => Object.assign(caps, { afcSingle: enabled, afcBatch: enabled, afcCancel: enabled }),
    afcSingleWriteEnabled: () => caps.afcSingle === true,
    afcBatchWriteEnabled: () => caps.afcBatch === true,
    afcCancelWriteEnabled: () => caps.afcCancel === true,
    dashboardAfcRecords: async () => records,
    cancelDashboardAfcRecord: async (id, payload) => { cancellations.push({id,...payload}); records[0].active=false; return records[0]; },
    ...apiOverrides
  };
  const auth = { setPersistence: async()=>{}, onAuthStateChanged: fn => { auth.changed=user=>{auth.currentUser=user;return fn(user);}; } };
  const authFn = () => auth; authFn.Auth = { Persistence: { LOCAL: 'local' } };
  const context = {
    document: { getElementById: element, querySelectorAll:selector=>selector==='.tab'?[element('afc-records-tab')]:[], querySelector:()=>null, activeElement:null, body:{classList:{add(){},remove(){}}} },
    firebase: { apps:[{}], auth:authFn }, UCVM_PAWS_DATA:api, console, setTimeout, clearTimeout, performance,
    location:{href:'https://local/faculty-admin.html'}, history:{length:1},
    window: { UCVM_AFC_RECORDS:require('../frontend/scripts/faculty-admin-afc-records.js'), confirm:()=>confirm, setTimeout:()=>0, PAWS_FACULTY_NAME:name, UCVM_AFC_BATCH:require('../frontend/scripts/faculty-admin-afc-batch.js'),
      UCVM_FACULTY_DOE_RENDERER:{create:()=>({})}, UCVM_FACULTY_DOE_WORKSHEET:{create:()=>({bindList(){}})},
      UCVM_FACULTY_ADMIN_MANAGEMENT:{create:()=>({bind(){},editAction:()=>''})},
      PAWS_ROLE_PERIODS:{today:()=> '2026-10-13',create:()=>({})} }
  };
  element('afc-records-tab').dataset={tab:'afc-records'};
  element('afc-active-filter').value='true';
  vm.runInNewContext(fs.readFileSync(repositoryPath(process.cwd(), 'faculty-admin.js'),'utf8'),context);
  await auth.changed({uid:'user',email:'admin@example.test'});
  await new Promise(resolve=>setImmediate(resolve));
  return {element, api, cancellations};
}
test('Dashboard refreshes AFC capabilities after authentication and enables the create form', async()=>{
  const {element}=await dashboard();
  assert.equal(element('afc-submit').disabled,false);
  assert.doesNotMatch(element('afc-form-status').textContent,/disabled/);
});

function fillAfcForm(element) {
  for (const [key,value] of Object.entries({'afc-faculty':ID,'afc-start-date':'2027-02-01','afc-end-date':'2027-02-02','afc-reason':'vacation','afc-notes':''})) element(key).value=value;
}

test('an incomplete AFC save response preserves the form and prevents a duplicate create', async()=>{
  let posts=0,resets=0;
  const {element}=await dashboard({apiOverrides:{createDashboardAfcRecord:async()=>{posts++;return {};}}});
  fillAfcForm(element);element('afc-record-form').reset=()=>resets++;
  await element('afc-record-form').listeners.submit({preventDefault(){}});
  await element('afc-record-form').listeners.submit({preventDefault(){}});
  assert.equal(posts,1);assert.equal(resets,0);
  assert.equal(element('afc-submit').disabled,true);
  assert.match(element('afc-form-status').textContent,/unconfirmed/i);
});

for (const confirmed of [true,false]) test(`AFC save requires an exact record ID in list readback: ${confirmed}`, async()=>{
  let posts=0,reads=0,resets=0;
  const {element}=await dashboard({apiOverrides:{
    createDashboardAfcRecord:async()=>{posts++;return {afcRecordId:ID};},
    dashboardAfcRecords:async()=>{reads++;return [{afcRecordId:confirmed?ID:'different-record',facultyName:'Ada One'}];}
  }});
  fillAfcForm(element);element('afc-record-form').reset=()=>resets++;
  await element('afc-record-form').listeners.submit({preventDefault(){}});
  assert.equal(posts,1);assert.equal(reads,confirmed?1:2);
  assert.equal(resets,confirmed?1:0);assert.equal(element('afc-submit').disabled,!confirmed);
  assert.equal(/created and confirmed/i.test(element('afc-form-status').textContent),confirmed);
});

test('AFC readback retries a transient GET without replaying the accepted POST', async()=>{
  let posts=0,reads=0;
  const {element}=await dashboard({apiOverrides:{
    createDashboardAfcRecord:async()=>{posts++;return {afcRecordId:ID};},
    dashboardAfcRecords:async()=>{if(++reads===1)throw Object.assign(Error('Read unavailable'),{status:503});return [{afcRecordId:ID}];}
  }});
  fillAfcForm(element);await element('afc-record-form').listeners.submit({preventDefault(){}});
  assert.equal(posts,1);assert.equal(reads,2);assert.match(element('afc-form-status').textContent,/created and confirmed/i);
});

for (const [status,code,locked] of [[503,'SQL_UNAVAILABLE',true],[503,'WRITE_DISABLED',false],[400,'VALIDATION_FAILED',false]]) test(`AFC create retry safety for ${status} ${code}`, async()=>{
  let posts=0;
  const {element}=await dashboard({apiOverrides:{createDashboardAfcRecord:async()=>{posts++;throw Object.assign(Error(code),{status,code});}}});
  fillAfcForm(element);await element('afc-record-form').listeners.submit({preventDefault(){}});
  assert.equal(element('afc-submit').disabled,locked);
  await element('afc-record-form').listeners.submit({preventDefault(){}});
  assert.equal(posts,locked?1:2);
});

test('AFC form rejects an impossible Gregorian date before sending a create', async()=>{
  let posts=0;
  const {element}=await dashboard({apiOverrides:{createDashboardAfcRecord:async()=>{posts++;return {afcRecordId:ID};}}});
  fillAfcForm(element);element('afc-start-date').value='2027-02-30';element('afc-end-date').value='2027-03-01';
  await element('afc-record-form').listeners.submit({preventDefault(){}});
  assert.equal(posts,0);assert.match(element('afc-form-status').textContent,/valid start and end dates/i);
});

test('a confirmed AFC save preserves a refreshed closed write capability', async()=>{
  let allowed=true;
  const {element}=await dashboard({apiOverrides:{
    afcSingleWriteEnabled:()=>allowed,
    createDashboardAfcRecord:async()=>{allowed=false;return {afcRecordId:ID};}
  }});
  fillAfcForm(element);await element('afc-record-form').listeners.submit({preventDefault(){}});
  assert.equal(element('afc-submit').disabled,true);
  assert.match(element('afc-form-status').textContent,/created and confirmed/i);
});
test('Dashboard keeps AFC creation closed when the server denies its capability', async()=>{
  const {element}=await dashboard({enabled:false});
  assert.equal(element('afc-submit').disabled,true);
});
test('AFC faculty labels expose names while retaining canonical IDs as values', async()=>{
  const {element}=await dashboard();
  assert.match(element('afc-faculty').innerHTML,new RegExp(`value="${ID}">One, Ada</option>`));
  assert.doesNotMatch(element('afc-faculty').innerHTML,new RegExp(`>[^<]*${ID}`));
});
test('AFC row deletion confirms, cancels the exact version, and refreshes the active list', async()=>{
  const {element,cancellations}=await dashboard();
  element('afc-records-tab').listeners.click(); await new Promise(resolve=>setImmediate(resolve));
  assert.match(element('afc-records-body').innerHTML,/data-afc-cancel/);
  assert.match(element('afc-records-body').innerHTML,/N\/A/,'optional original-PDF helper absence keeps the AFC list usable');
  assert.doesNotMatch(element('afc-records-body').innerHTML,/person-meta/);
  await element('afc-records-body').listeners.click({target:{closest:selector=>selector==='[data-afc-cancel]'?{dataset:{afcCancel:`manual:${ID}`}}:null}});
  assert.equal(cancellations.length,1);
  assert.equal(cancellations[0].id,ID);
  assert.equal(cancellations[0].expectedVersion,'00000000000000AB');
  assert.doesNotMatch(element('afc-records-body').innerHTML,/data-afc-cancel/);
});
test('Rejecting the row deletion confirmation preserves the AFC record', async()=>{
  const {element,cancellations}=await dashboard({confirm:false});
  element('afc-records-tab').listeners.click(); await new Promise(resolve=>setImmediate(resolve));
  assert.match(element('afc-records-body').innerHTML,/data-afc-cancel/);
  await element('afc-records-body').listeners.click({target:{closest:selector=>selector==='[data-afc-cancel]'?{dataset:{afcCancel:`manual:${ID}`}}:null}});
  assert.equal(cancellations.length,0);
});
