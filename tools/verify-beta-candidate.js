'use strict';
const freeze=require('./beta-freeze');
const allowed=new Set(['firebase-config.js','index.html','paws-data-client.js','timetable.js']);
const result=freeze.verifyFreeze();
const unexpected=result.drift.filter(item=>!allowed.has(item.file));
if(unexpected.length){console.error(JSON.stringify({ok:false,unexpected},null,2));process.exit(1);}
for(const file of allowed)if(!result.drift.some(item=>item.file===file)){console.error(`Expected candidate drift is missing: ${file}`);process.exit(1);}
console.log(JSON.stringify({ok:true,baselineCommit:result.baselineCommit,intentionalCandidateDrift:result.drift},null,2));
