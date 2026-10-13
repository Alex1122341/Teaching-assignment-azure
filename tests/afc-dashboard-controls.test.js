'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const nameContext = { window: {} };
vm.runInNewContext(fs.readFileSync('faculty-name.js','utf8'),nameContext);
const name = nameContext.window.PAWS_FACULTY_NAME;
const ID = '11111111-1111-4111-8111-111111111111';
async function dashboard({ enabled = true, confirm = true } = {}) {
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
    cancelDashboardAfcRecord: async (id, payload) => { cancellations.push({id,...payload}); records[0].active=false; return records[0]; }
  };
  const auth = { setPersistence: async()=>{}, onAuthStateChanged: fn => { auth.changed=fn; } };
  const authFn = () => auth; authFn.Auth = { Persistence: { LOCAL: 'local' } };
  const context = {
    document: { getElementById: element, querySelectorAll:selector=>selector==='.tab'?[element('afc-records-tab')]:[], querySelector:()=>null, activeElement:null, body:{classList:{add(){},remove(){}}} },
    firebase: { apps:[{}], auth:authFn }, UCVM_PAWS_DATA:api, console, setTimeout, clearTimeout, performance,
    location:{href:'https://local/faculty-admin.html'}, history:{length:1},
    window: { UCVM_AFC_RECORDS:require('../faculty-admin-afc-records'), confirm:()=>confirm, setTimeout:()=>0, PAWS_FACULTY_NAME:name, UCVM_AFC_BATCH:require('../faculty-admin-afc-batch'),
      UCVM_FACULTY_DOE_RENDERER:{create:()=>({})}, UCVM_FACULTY_DOE_WORKSHEET:{create:()=>({bindList(){}})},
      UCVM_FACULTY_ADMIN_MANAGEMENT:{create:()=>({bind(){},editAction:()=>''})},
      PAWS_ROLE_PERIODS:{today:()=> '2026-10-13',create:()=>({})} }
  };
  element('afc-records-tab').dataset={tab:'afc-records'};
  element('afc-active-filter').value='true';
  vm.runInNewContext(fs.readFileSync('faculty-admin.js','utf8'),context);
  await auth.changed({uid:'user',email:'admin@example.test'});
  await new Promise(resolve=>setImmediate(resolve));
  return {element, api, cancellations};
}
test('Dashboard refreshes AFC capabilities after authentication and enables the create form', async()=>{
  const {element}=await dashboard();
  assert.equal(element('afc-submit').disabled,false);
  assert.doesNotMatch(element('afc-form-status').textContent,/disabled/);
});
test('Dashboard keeps AFC creation closed when the server denies its capability', async()=>{
  const {element}=await dashboard({enabled:false});
  assert.equal(element('afc-submit').disabled,true);
});
test('AFC faculty labels expose names while retaining canonical IDs as values', async()=>{
  const {element}=await dashboard();
  assert.match(element('afc-faculty').innerHTML,new RegExp(`value="${ID}">Ada One</option>`));
  assert.doesNotMatch(element('afc-faculty').innerHTML,new RegExp(`>[^<]*${ID}`));
});
test('AFC row deletion confirms, cancels the exact version, and refreshes the active list', async()=>{
  const {element,cancellations}=await dashboard();
  element('afc-records-tab').listeners.click(); await new Promise(resolve=>setImmediate(resolve));
  assert.match(element('afc-records-body').innerHTML,/data-afc-cancel/);
  assert.doesNotMatch(element('afc-records-body').innerHTML,/person-meta/);
  await element('afc-records-body').listeners.click({target:{closest:()=>({dataset:{afcCancel:`manual:${ID}`}})}});
  assert.equal(cancellations.length,1);
  assert.equal(cancellations[0].id,ID);
  assert.equal(cancellations[0].expectedVersion,'00000000000000AB');
  assert.doesNotMatch(element('afc-records-body').innerHTML,/data-afc-cancel/);
});
test('Rejecting the row deletion confirmation preserves the AFC record', async()=>{
  const {element,cancellations}=await dashboard({confirm:false});
  element('afc-records-tab').listeners.click(); await new Promise(resolve=>setImmediate(resolve));
  assert.match(element('afc-records-body').innerHTML,/data-afc-cancel/);
  await element('afc-records-body').listeners.click({target:{closest:()=>({dataset:{afcCancel:`manual:${ID}`}})}});
  assert.equal(cancellations.length,0);
});
