'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPawsDataClient}=require('../frontend/scripts/paws-data-client');
test('report transport authenticates read-only query, page and export without broadening fields',async()=>{
 const calls=[],client=createPawsDataClient({tokenProvider:async()=>'verified',fetchImpl:async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>({sources:[],fileName:'paws-reports-2026-27-workload.csv',contentType:'text/csv; charset=utf-8',fileBase64:Buffer.from('Faculty\r\n').toString('base64'),rowCount:0,rowCounts:{workload:0}})};}});
 await client.reportCatalog();await client.reportQuery({academicYear:'2026-27',datasets:[{source:'roles',columns:['facultyName']}]});await client.reportPage('opaque','roles',50);const file=await client.reportExport('opaque','csv','workload');
 assert.match(calls[0].url,/\/reports\/catalog$/);assert.equal(calls[1].init.method,'POST');assert.equal(JSON.parse(calls[1].init.body).academicYear,'2026-27');assert.match(calls[2].url,/snapshot=opaque&source=roles&offset=50/);assert.equal(calls.every(c=>c.init.headers.Authorization==='Bearer verified'),true);assert.equal(file.rowCount,0);
});
test('report exports reject malformed filenames, MIME, base64 and row counts',async()=>{
 const valid={fileName:'paws-reports-2026-27.xlsx',contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',fileBase64:'ZmlsZQ==',rowCount:2,rowCounts:{roles:2}};
 for(const patch of [{fileName:'../../private.xlsx'},{fileBase64:'!!!'},{contentType:'text/html'},{rowCount:3},{rowCounts:{private:2}}]){const client=createPawsDataClient({tokenProvider:async()=>'t',fetchImpl:async()=>({ok:true,json:async()=>({...valid,...patch})})});await assert.rejects(client.reportExport('opaque','xlsx'),{code:'INVALID_REPORT_ARTIFACT'});}
});
