'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const allowed=/\.(?:md|txt|yml|yaml|js|cjs|mjs|ts|ps1|py|sql|html|css|json)$/i;
const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean).filter(s=>allowed.test(s));
const findings=[];
for(const file of files){
  const full=path.join(root,file);
  if(!fs.existsSync(full))continue;
  const lines=fs.readFileSync(full,'utf8').split(/\r?\n/);
  const hits=[];
  for(let i=0;i<lines.length;i++){
    if(/[\u3400-\u9fff]/u.test(lines[i]))hits.push({line:i+1,excerpt:lines[i].trim().slice(0,160)});
  }
  if(hits.length)findings.push({file,kind:/\.md$/i.test(file)?'documentation':'code-or-config',count:hits.length,lines:hits});
}
const report={scanned:files.length,documents:files.filter(s=>/\.md$/i.test(s)).length,filesWithCjk:findings.length,findings};
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(report,null,2)+'\n');
else {
 console.log('Tracked text files:',report.scanned,'Markdown:',report.documents,'Files with CJK:',report.filesWithCjk);
 for(const item of findings)console.log(item.file+': '+item.count+' line(s)');
}
if(process.argv.includes('--fail-on-cjk')&&findings.length)process.exitCode=1;
