'use strict';
const fs=require('node:fs'),path=require('node:path');
const platform=require('./host-platform'),{validateHostProfile,runHostAction}=require('./host-policy');
const {makeRuntimeAttestation,canonicalDigest}=require('../testing-runtime-attestation');
async function main(args){
 const action=args[args.indexOf('--action')+1],configPath=args[args.indexOf('--config')+1];
 if(!['Stage','Start','Check','Stop'].includes(action)||!path.isAbsolute(configPath||''))throw Error('Testing host action/configuration is invalid');
 if(process.platform!=='win32'||Number(process.versions.node.split('.')[0])!==22)throw Error('Testing host needs Windows and Node22');
 const profile=platform.readJson(configPath),observed=await platform.observe(profile);validateHostProfile(profile,observed);
 if(!path.resolve(configPath).toLowerCase().startsWith(path.resolve(profile.privateRoot).toLowerCase()+path.sep))throw Error('Testing host configuration must remain private');
 const receipt=action==='Stage'?await platform.stage(profile,platform.readJson(platform.privatePath(profile,'candidate-input.json')),observed,configPath):await runHostAction(action,profile,{...platform,observe:async()=>observed});
 if(receipt.status==='READY'){
  receipt.runtimeAttestation=makeRuntimeAttestation(profile,observed.manifest);
  receipt.runtimeAttestationDigest=canonicalDigest(receipt.runtimeAttestation);
 }
 // Check is deliberately read-only, including the receipt filesystem.
 if(action!=='Check'){
  const output=platform.privatePath(profile,'last-action.json');if(fs.existsSync(output))platform.readJson(output);
  fs.writeFileSync(output,JSON.stringify(receipt)+'\n',{mode:0o600});
 }
 console.log(JSON.stringify(receipt));return receipt;
}
if(require.main===module)main(process.argv.slice(2)).then(receipt=>{process.exitCode=receipt.status==='NOT_READY'?2:0;}).catch(()=>{console.error('{"status":"NOT_READY","reason":"HOST_CONFIGURATION_INVALID"}');process.exitCode=1;});
module.exports={main};
