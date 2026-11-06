'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDashboardApi } = require('../src/data/dashboard-api');
const { createDashboardFunctions } = require('../src/runtime/swa-dashboard-functions');

const facultyId = '11111111-1111-4111-8111-111111111111';
const deduction = { fteDeduction:'0.25', allocationsByYear:{'2026-27':{teaching:'15',service:'5',research:'5'}} };
const input = {facultyId,startDate:'2026-11-10',endDate:'2026-11-14',reasonCode:'special',
  notes:'Approved synthetic leave',availability:'available',specialLeave:deduction};
function harness(role='owner', afcSingle=true) {
  const calls=[];
  const repository={
    createAfcRecord:async values=>{calls.push(['standard',values]);return values;},
    createAvailableSpecialLeave:async values=>{calls.push(['special',values]);return {...values,availability:'available'};},
    applySpecialLeave:async values=>{calls.push(['apply',values]);return {afcRecordId:values.afcRecordId};},
    specialLeaveSource:async (...args)=>{calls.push(['source',args]);return {fte:1,doe:{teaching:40,service:null,research:20}};},
    specialLeaveOnDate:async (...args)=>{calls.push(['evaluation',args]);return {availability:'available'};}
  };
  const api=createDashboardApi({ verifyToken:async()=>({uid:'authenticated'}),
    findUser:async()=>({active:true,baseRole:role,facultyId,displayName:'Synthetic Actor'}),
    repository,writeGates:{afcSingle,afcEdit:true} });
  return {api,calls,app:createDashboardFunctions({api})};
}
test('administrator routes Available Special Leave to the atomic repository and retains legacy behavior',async()=>{
  const {api,calls}=harness();
  assert.equal((await api.createAfcRecord('token',input)).status,201);
  assert.deepEqual(calls[0][1].specialLeave,{fteDeduction:.25,allocationsByYear:{'2026-27':{teaching:15,service:5,research:5}}});
  assert.equal(calls[0][1].actorFirebaseUid,'authenticated');
  const {availability,specialLeave,...ordinary}=input;
  assert.equal((await api.createAfcRecord('token',ordinary)).status,201);
  assert.deepEqual(calls.map(([action])=>action),['special','standard']);
  for(const bad of [{...input,reasonCode:'vacation'}, {...input,endDate:'2027-05-01'},
    {...input,specialLeave:{...deduction,fteDeduction:'0.05'}}]) {
    assert.equal((await api.createAfcRecord('token',bad)).status,400);
  }
  assert.equal(calls.length,2);
});
test('private source, evaluation and Apply are admin-only and require fresh AFC versions',async()=>{
  const request=(path,method='GET',body)=>({url:'https://paws.invalid/api/v1/dashboard'+path,method,headers:{get:()=> 'Bearer test'},json:async()=>body});
  for(const role of ['faculty','owner']){
    const {api,app,calls}=harness(role);
    const expected=role==='owner'?200:403;
    const source=await app(request('/faculty/'+facultyId+'/special-leave/source?academicYear=2026-27'));
    assert.equal(source.status,expected);
    assert.equal(source.headers['Cache-Control'],'private, no-store');
    assert.equal((await app(request('/faculty/'+facultyId+'/special-leave/evaluation?date=2026-11-11'))).status,expected);
    assert.equal((await app(request('/afc-records/'+facultyId+'/special-leave','POST',{expectedVersion:'0102030405060708',specialLeave:deduction}))).status,expected);
    assert.equal((await api.applyAfcSpecialLeave('token',facultyId,{expectedVersion:'stale',specialLeave:deduction})).status,role==='owner'?400:403);
    assert.equal(calls.length,role==='owner'?3:0);
  }
  assert.equal((await harness('owner',false).api.createAfcRecord('token',input)).status,503);
});
