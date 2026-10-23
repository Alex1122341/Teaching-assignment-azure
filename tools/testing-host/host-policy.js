'use strict';
const path=require('node:path');
const {assertTarget}=require('../testing-db/university-admin');
const {GATE_ENV}=require('../../server/src/data/write-gates');
const PROJECT='paws-testing-ucvm-20261022';
const samePath=(a,b)=>typeof a==='string'&&typeof b==='string'&&path.win32.resolve(a).toLowerCase()===path.win32.resolve(b).toLowerCase();
function validateHostProfile(profile,observed){
 if(!profile||!observed||profile.computerName!=='VET-C31293'||observed.computerName!==profile.computerName||
  typeof profile.windowsIdentity!=='string'||!profile.windowsIdentity.trim()||profile.windowsIdentity.toLowerCase()!==String(observed.windowsIdentity).toLowerCase())throw Error('Testing host machine/user identity mismatch');
 assertTarget(profile.target);
 if(profile.apiPort!==18788||profile.firebaseProjectId!==PROJECT)throw Error('Testing host profile port/project mismatch');
 if(!['https://'+PROJECT+'.web.app','https://'+PROJECT+'.firebaseapp.com'].includes(profile.allowedOrigin))throw Error('Testing host allowed origin mismatch');
 if(typeof observed.localAppData!=='string'||!path.win32.isAbsolute(observed.localAppData)||
  !samePath(profile.privateRoot,path.win32.join(observed.localAppData,'PAWS','Testing'))||observed.unsafePaths!==false)throw Error('Testing host private paths are unsafe');
 const relative=path.win32.relative(profile.privateRoot,profile.releaseManifestPath||'');
 if(!relative||relative.startsWith('..')||path.win32.isAbsolute(relative)||!relative.toLowerCase().startsWith('releases\\'))throw Error('Testing host manifest must remain in private releases');
 const keys=Object.keys(GATE_ENV).sort();
 if(!profile.gateMap||JSON.stringify(Object.keys(profile.gateMap).sort())!==JSON.stringify(keys)||keys.some(key=>typeof profile.gateMap[key]!=='boolean'))throw Error('Testing host requires an explicit complete gate map');
 return structuredClone(profile);
}
function ownsRecordedProcess(observed){
 const actual=observed.actualProcess||observed.port?.process,recorded=observed.recordedProcess;
 return Boolean(actual&&recorded&&Number.isSafeInteger(recorded.pid)&&recorded.pid>0&&actual.pid===recorded.pid&&
  typeof recorded.startTime==='string'&&actual.startTime===recorded.startTime&&
  samePath(actual.executable,recorded.executable)&&/^[a-f0-9]{64}$/i.test(recorded.executableSha256||'')&&
  actual.executableSha256===recorded.executableSha256&&typeof recorded.entrypoint==='string'&&actual.entrypoint===recorded.entrypoint);
}
function ownsProcess(observed){return ownsRecordedProcess(observed)&&observed.port?.process?.pid===observed.recordedProcess.pid&&observed.port.host==='127.0.0.1'&&observed.port.port===18788;}
const gateMatch=(a,b)=>Boolean(a&&Object.keys(b).length===Object.keys(a).length&&Object.keys(b).every(key=>a[key]===b[key]));
const validManifest=value=>Boolean(value&&/^[a-f0-9]{40}$/.test(value.commitSha||'')&&['candidate-only','main'].includes(value.provenance)&&/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(value.apiOrigin||''));
function readiness(profile,observed){
 if(observed.resetActive!==false)return 'RESET_IN_PROGRESS';
 if(observed.manifestVerified!==true||observed.dependenciesVerified!==true||observed.nodeMajor!==22||!validManifest(observed.manifest))return 'ARTIFACT_NOT_VERIFIED';
 if(!ownsProcess(observed))return 'PROCESS_NOT_OWNED';
 if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(observed.manifest?.apiOrigin||'')||observed.actualTunnelOrigin!==observed.manifest.apiOrigin)return 'TUNNEL_ORIGIN_DRIFT';
 const health=observed.health;
 if(health?.environment!=='testing'||health.releaseSha!==observed.manifest.commitSha||health.sqlHealthy!==true||!gateMatch(health.gates,profile.gateMap))return 'HEALTH_NOT_VERIFIED';
 return null;
}
async function runHostAction(action,profile,dependencies){
 if(!['Check','Start','Stop'].includes(action))throw Error('Unsupported Testing host action');
 const observed=await dependencies.observe(profile);validateHostProfile(profile,observed);
 const receipt=(status,reason)=>({status,action,...(reason?{reason}:{}),utc:new Date().toISOString(),computerName:profile.computerName,
  target:Object.fromEntries(['profile','host','physicalServer','database','environmentId'].map(key=>[key,profile.target[key]])),
  provenance:['candidate-only','main'].includes(observed.manifest?.provenance)?observed.manifest.provenance:'unverified'});
 if(action==='Stop'){
  if(!ownsRecordedProcess(observed))return receipt('NOT_READY','PROCESS_NOT_OWNED');
  // Pass the entire observation so the platform adapter can recheck PID,
  // creation time and binary identity immediately before termination.
  const result=await dependencies.stop(observed.recordedProcess.pid,observed.recordedProcess,profile);
  return {...receipt('STOPPED'),listenerFree:result?.listenerFree===true,resetInhibited:result?.resetInhibited===true};
 }
 if(action==='Check'){
  const reason=readiness(profile,observed);return receipt(reason?'NOT_READY':'READY',reason);
 }
 if(observed.resetActive!==false)return receipt('NOT_READY','RESET_IN_PROGRESS');
 if(observed.manifestVerified!==true||observed.dependenciesVerified!==true||observed.nodeMajor!==22||!validManifest(observed.manifest))return receipt('NOT_READY','ARTIFACT_NOT_VERIFIED');
 if(!Number.isSafeInteger(observed.freeBytes)||observed.freeBytes<8*1024**3)return receipt('NOT_READY','INSUFFICIENT_CAPACITY');
 if(observed.port){const reason=readiness(profile,observed);return receipt(reason?'NOT_READY':'READY',reason);}
 if(observed.actualTunnelOrigin!==observed.manifest?.apiOrigin)return receipt('NOT_READY','TUNNEL_ORIGIN_DRIFT');
 await dependencies.start(profile,observed.manifest);
 return receipt('STARTED');
}
module.exports={validateHostProfile,runHostAction,ownsProcess,readiness};
