'use strict';
const {endpoint}=require('./history-year');

const COLUMNS=Object.freeze([
 ['changeDate','Time (UTC)'],['changeType','Type'],['domain','Domain'],
 ['course','Course'],['session','Session'],['field','Field'],
 ['previousValue','From'],['start','Start'],['end','End'],['updatedValue','To value'],['actor','By whom'],
 ['academicYear','Academic year'],['affectedFaculty','Affected faculty']
].map(([key,header])=>Object.freeze({key,header})));
const limit=()=>Object.assign(Error('Narrow the history filters before exporting.'),{code:'HISTORY_LIMIT'});
function safeCell(value){
 const text=value===null||value===undefined?'':String(value);
 if(text.length>32767)throw limit();
 // Also catches prefixes after whitespace/control characters used to hide formulas.
 return /^[\s\x00-\x1f]*[=+@-]/u.test(text)?"'"+text:text;
}
async function renderHistoryExport(rows,format){
 if(!['csv','xlsx'].includes(format))throw Object.assign(Error('Unsupported format.'),{code:'INVALID_FORMAT'});
 if(!Array.isArray(rows)||rows.length>10000)throw limit();
 const values=rows.map(row=>COLUMNS.map(column=>safeCell(column.key==='start'?endpoint(row):column.key==='end'?endpoint(row,true):row[column.key]??'N/A')));
 let bytes,contentType;
 if(format==='csv'){
  const quote=value=>'"'+value.replaceAll('"','""')+'"';
  bytes=Buffer.from('\uFEFF'+[COLUMNS.map(c=>c.header),...values].map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n','utf8');
  contentType='text/csv; charset=utf-8';
 }else{
  // Preserve deferred loading: opening the timetable never loads ExcelJS.
  const ExcelJS=require('exceljs');
  const book=new ExcelJS.Workbook();
  book.creator='PAWS';
  const sheet=book.addWorksheet('Change History',{views:[{state:'frozen',ySplit:1}]});
  sheet.addRow(COLUMNS.map(c=>c.header));
  sheet.addRows(values);
  sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
  sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF263650'}};
  for(let i=1;i<=COLUMNS.length;i++)sheet.getColumn(i).width=[7,8].includes(i)?55:24;
  sheet.autoFilter={from:{row:1,column:1},to:{row:values.length+1,column:COLUMNS.length}};
  sheet.eachRow(row=>{row.alignment={vertical:'top',wrapText:true};});
  bytes=Buffer.from(await book.xlsx.writeBuffer());
  contentType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 }
 if(bytes.length>6*1024*1024)throw limit();
 return {bytes,contentType,fileName:'paws-change-history.'+format};
}
module.exports={COLUMNS,renderHistoryExport};
