'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBatchPdfController } = require('../frontend/scripts/faculty-admin-afc-forms');

const facultyId = '716c892e-0c87-4550-9372-000000000001';
const recordA = '716c892e-0c87-4550-9372-000000000002';
const recordB = '716c892e-0c87-4550-9372-000000000003';
const docId = '716c892e-0c87-4550-9372-000000000004';
const makeFile = (name='original.pdf') => ({name,type:'application/pdf',size:4,arrayBuffer:async()=>new Uint8Array(4).buffer});
function fixture(overrides={}) {
  const rows = [], uploads = [], links = [];
  let active = 'user-a';
  const tbody = {insertRow() {
    const cells = [];
    rows.push(cells);
    return {dataset:{},insertCell() {
      const inputs = new Map();
      const cell = {querySelector(selector) {
        if (!inputs.has(selector)) inputs.set(selector, {});
        return inputs.get(selector);
      }};
      cells.push(cell);
      return cell;
    }};
  }};
  const retry = {};
  const host = {innerHTML:'', replaceChildren(){this.innerHTML='';rows.length=0;}, querySelector(selector){
    if (!this.innerHTML) return null;
    return selector === '[data-retry-upload-access]' ? retry : tbody;
  }};
  const api = {
    afcFormCapabilities: async()=>({upload:true}),
    uploadAfcForm: async input=>{
      uploads.push(input);
      return {document:{documentId:docId, facultyId, fileName:input.fileName, byteLength:4}};
    },
    linkAfcBatchPdf: async input=>{links.push(input);return input;},
    ...overrides
  };
  const controller = createBatchPdfController({host,api,getUser:()=>({uid:active}),randomUUID:()=>recordB});
  const show = () => controller.show([recordA,recordB].map(afcRecordId=>({afcRecordId,facultyId,facultyName:'Sample, Faculty',startDate:'2027-03-01',endDate:'2027-03-02',purpose:'Vacation'})));
  return {controller,show,uploads,links,rows,api,retry,switchAccount:()=>{active='user-b';}};
}

test('the selected saved row gets its own PDF, even when another row has the same faculty and dates',async()=>{
  const f = fixture();
  await f.show();
  f.controller.select(recordB,makeFile());
  await f.controller.attach(recordB);
  assert.deepEqual(f.links,[{afcRecordId:recordB,facultyId,documentId:docId,requestId:recordB}]);
  assert.match(f.rows[1][3].innerHTML,/Download PDF/);
  assert.doesNotMatch(f.rows[0][3].innerHTML,/Download PDF/);
  await f.controller.attach(recordB);
  await f.show();
  assert.equal(f.uploads.length,1);
  assert.equal(f.links.length,1);
  assert.equal(f.rows.length,2);
});

test('an uncertain upload retries with the same key and a failed link retries without uploading again',async()=>{
  const f = fixture();
  const upload = f.api.uploadAfcForm, link = f.api.linkAfcBatchPdf;
  const keys = [];
  f.api.uploadAfcForm = async input=>{
    keys.push(input.requestId);
    if(keys.length===1)throw Error('Network interrupted');
    return upload(input);
  };
  let linkAttempts=0;
  f.api.linkAfcBatchPdf = async input=>{if(++linkAttempts===1)throw Error('Network interrupted');return link(input);};
  await f.show();
  f.controller.select(recordA,makeFile());
  await f.controller.attach(recordA);
  f.controller.select(recordA,makeFile('different.pdf'));
  await f.controller.attach(recordA);
  await f.controller.attach(recordA);
  assert.deepEqual(keys,[recordB,recordB]);
  assert.equal(f.uploads[0].fileName,'original.pdf');
  assert.equal(f.uploads.length,1);
  assert.equal(linkAttempts,2);
  assert.match(f.rows[0][3].innerHTML,/Download PDF/);
});

test('read-only access, a changed identity, and a mismatched link receipt cannot confirm an attachment',async()=>{
  const denied = fixture({afcFormCapabilities:async()=>({upload:false})});
  await denied.show();denied.controller.select(recordA,makeFile());await denied.controller.attach(recordA);
  assert.equal(denied.uploads.length,0);
  const f = fixture();
  const upload = f.api.uploadAfcForm;
  f.api.uploadAfcForm = async input=>{const result=await upload(input);f.switchAccount();return result;};
  await f.show();f.controller.select(recordA,makeFile());await f.controller.attach(recordA);
  assert.equal(f.links.length,0);
  const mismatch = fixture({linkAfcBatchPdf:async input=>({...input,afcRecordId:recordB})});
  await mismatch.show();mismatch.controller.select(recordA,makeFile());await mismatch.controller.attach(recordA);
  assert.doesNotMatch(mismatch.rows[0][3].innerHTML,/Download PDF/);
  assert.match(mismatch.rows[0][3].innerHTML,/not be confirmed/);
});

test('an unreadable local PDF can be reselected without a server request or a batch replay',async()=>{
  const f = fixture();
  await f.show();
  f.controller.select(recordA, {...makeFile('moved.pdf'), arrayBuffer: async()=>{throw Error('Not readable');}});
  await f.controller.attach(recordA);
  assert.equal(f.uploads.length,0);
  assert.match(f.rows[0][3].innerHTML,/select the PDF again/i);
  f.controller.select(recordA,makeFile('replacement.pdf'));
  await f.controller.attach(recordA);
  assert.equal(f.uploads[0].fileName,'replacement.pdf');
  assert.equal(f.links[0].afcRecordId,recordA);
});

test('a transient capability error can be retried on the existing receipt',async()=>{
  let attempts = 0;
  const f = fixture({afcFormCapabilities:async()=>{
    if(++attempts===1) throw Error('Offline');
    return {upload:true};
  }});
  await f.show();
  assert.equal(f.retry.hidden,false);
  assert.match(f.rows[0][3].innerHTML,/could not be checked/i);
  await f.retry.onclick();
  assert.equal(f.retry.hidden,true);
  assert.equal(f.rows.length,2);
  f.controller.select(recordA,makeFile());
  await f.controller.attach(recordA);
  assert.equal(f.uploads.length,1);
  assert.equal(f.links[0].afcRecordId,recordA);
});
