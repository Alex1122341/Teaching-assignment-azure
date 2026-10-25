'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const findings=[];
const errors=[];
let scanned=0,documents=0,skippedBinary=0;
for(const file of files){
  const full=path.join(root,file);
  let bytes;
  try { bytes=fs.readFileSync(full); }
  catch(error) { errors.push({file,code:error.code||'READ_ERROR'}); continue; }
  const utf16=bytes[0]===0xff&&bytes[1]===0xfe?'utf-16le':bytes[0]===0xfe&&bytes[1]===0xff?'utf-16be':null;
  if(!utf16&&bytes.includes(0)){skippedBinary++;continue;}
  let content;
  try { content=new TextDecoder(utf16||'utf-8',{fatal:true}).decode(bytes); }
  catch { skippedBinary++;continue; }
  scanned++;
  if(/\.md$/i.test(file))documents++;
  const lines=content.split(/\r?\n/);
  const hits=[];
  for(let i=0;i<lines.length;i++){
    if(/\p{Script=Han}/u.test(lines[i]))hits.push({line:i+1,excerpt:lines[i].trim().slice(0,160)});
  }
  if(hits.length)findings.push({file,kind:/\.md$/i.test(file)?'documentation':'code-or-config',count:hits.length,lines:hits});
}
const report={tracked:files.length,scanned,documents,skippedBinary,filesWithCjk:findings.length,findings,errors};
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(report,null,2)+'\n');
else {
 console.log('Tracked text files:',report.scanned,'Markdown:',report.documents,'Files with CJK:',report.filesWithCjk);
 for(const item of findings)console.log(item.file+': '+item.count+' line(s)');
 for(const error of errors)console.error(error.file+': '+error.code);
}
if(errors.length||(process.argv.includes('--fail-on-cjk')&&findings.length))process.exitCode=1;
