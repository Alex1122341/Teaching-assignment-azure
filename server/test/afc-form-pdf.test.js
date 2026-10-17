'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PDFDocument,PDFName,PDFString}=require('pdf-lib');
const file='../src/afc/afc-form-pdf';
async function pdf(pages=1,active=false){const d=await PDFDocument.create();for(let n=0;n<pages;n++)d.addPage();if(active)d.catalog.set(PDFName.of('OpenAction'),d.context.obj({S:PDFName.of('JavaScript'),JS:PDFString.of('app.alert(1)')}));return Buffer.from(await d.save());}
test('AFC form validator exists and preserves original PDF hash and page count',async()=>{
 const {validateAfcFormPdf}=require(file);const b=await pdf();const before=Buffer.from(b);const m=await validateAfcFormPdf(b);
 assert.equal(m.pageCount,1);assert.equal(m.byteLength,b.length);assert.match(m.sha256,/^[a-f0-9]{64}$/);assert.deepEqual(b,before);
});
test('AFC form validator rejects malformed, oversized, active-action and excessive-page PDFs',async()=>{
 const {validateAfcFormPdf}=require(file);
 for(const b of [Buffer.from('%PDF-1.7\nnot a file'),Buffer.alloc(2097153),await pdf(1,true),await pdf(101)])await assert.rejects(validateAfcFormPdf(b),e=>e.code==='INVALID_PDF'||e.code==='PDF_LIMIT');
});
test('compressed PDF action objects are inspected structurally',async()=>{
 const {validateAfcFormPdf}=require(file),d=await PDFDocument.create();d.addPage();
 const action=d.context.register(d.context.obj({S:PDFName.of('Launch'),F:PDFString.of('malicious.exe')}));d.getPage(0).node.set(PDFName.of('AA'),action);
 await assert.rejects(validateAfcFormPdf(Buffer.from(await d.save({useObjectStreams:true}))),{code:'INVALID_PDF'});
});
