'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {renderHistoryExport,COLUMNS}=require('../src/history/change-history-export');
test('CSV quotes Unicode/newlines and neutralizes formula prefixes including leading whitespace',async()=>{
 const out=await renderHistoryExport([{changeDate:'2026-10-16T00:00:00Z',previousValue:' \t=HYPERLINK("bad")',updatedValue:'你好,\nnew',field:'Room'}],'csv');
 const csv=out.bytes.toString('utf8');assert.match(csv,/"' \t=HYPERLINK\(""bad""\)"/);assert.match(csv,/"你好,\nnew"/);assert.equal(out.contentType,'text/csv; charset=utf-8');
});
test('real XLSX preserves all 202 rows, same columns, string values and no formulas',async()=>{
 const rows=Array.from({length:202},(_,i)=>({field:'Topic',previousValue:'=2+2',updatedValue:'中文 '+i,changeDate:'2026-10-16T00:00:00Z'}));
 const out=await renderHistoryExport(rows,'xlsx');assert.equal(out.bytes.subarray(0,2).toString(),'PK');
 const ExcelJS=require('exceljs'),wb=new ExcelJS.Workbook();await wb.xlsx.load(out.bytes);const ws=wb.worksheets[0];assert.equal(ws.rowCount,203);assert.equal(ws.columnCount,COLUMNS.length);assert.equal(ws.getCell(1,1).value,'Time (UTC)');
 const oldColumn=COLUMNS.findIndex(c=>c.key==='previousValue')+1;assert.equal(ws.getCell(2,oldColumn).value,"'=2+2");assert.equal(typeof ws.getCell(2,oldColumn).value,'string');
 assert.equal(ws.getCell(203,COLUMNS.findIndex(c=>c.key==='updatedValue')+1).value,'中文 201');
});
test('oversized cells and unsupported formats fail explicitly, never cut data silently',async()=>{
 await assert.rejects(()=>renderHistoryExport([{updatedValue:'x'.repeat(32768)}],'xlsx'),{code:'HISTORY_LIMIT'});
 await assert.rejects(()=>renderHistoryExport([],'xls'),{code:'INVALID_FORMAT'});
});
