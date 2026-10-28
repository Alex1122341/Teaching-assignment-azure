'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {loadConfig,validatePair}=require('../render-environment-config');
const {liveChecks}=require('./testing-preflight');
const {canonicalDigest,validateRuntimeAttestation}=require('./testing-runtime-attestation');
const {BASELINE_COMMIT}=require('../beta-freeze');
const ROOT=path.resolve(__dirname,'../..');
// Testing Hosting/Auth and the lab Firestore backend are isolated projects.
// Pin the publishing target independently so it cannot drift to another site.
function resolveTestingHostingProject(testing){
 if(testing?.environment!=='testing'||testing.siteUrl!=='https://paws-testing-ucvm-20261022.web.app'||testing.firebase?.projectId!=='paws-testing-ucvm-20261022')throw Error('Testing Hosting target rejected');
 return 'paws-testing-ucvm-20261022';
}
function verifyTestingStaticArtifact({root=ROOT,source,freeze=require('../beta-freeze')}){
 const {assertNoLinks}=require('./host/artifact-attestation'),actual=[];assertNoLinks(source);
 function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);assertNoLinks(file);
  if(entry.isDirectory())walk(file);else if(entry.isFile())actual.push(path.relative(source,file).replaceAll('\\','/'));else throw Error('Testing artifact has an unsafe path');
 }}walk(source);
 if(JSON.stringify(actual.sort())!==JSON.stringify(freeze.protectedPaths({root}).sort()))throw Error('Testing static artifact inventory is not the complete frozen surface');
 const proof=freeze.verifyFreeze({root,environment:'testing',readWorking:({file})=>fs.readFileSync(path.join(source,file))});
 if(!proof.ok)throw Error('Testing static artifact freeze failed');return proof;
}
async function verifyServedArtifacts({source,siteUrl,commitSha,files=require('../beta-freeze').protectedPaths(),fetchImpl=fetch}){
 for(let start=0;start<files.length;start+=4){
  await Promise.all(files.slice(start,start+4).map(async file=>{
   const response=await fetchImpl(siteUrl+'/'+file.split('/').map(encodeURIComponent).join('/')+'?paws_release='+commitSha,{redirect:'manual',signal:AbortSignal.timeout(15000)});
   if(response.status!==200||!Buffer.from(await response.arrayBuffer()).equals(fs.readFileSync(path.join(source,file))))throw Error('Testing served artifact bytes differ from the accepted package');
  }));
 }
 return {ok:true,files:files.length};
}
async function publishTesting({root=ROOT,commitSha,build,sourceArtifact,attestation,attestationDigest,fetchImpl=fetch,deployHosting,probeOnly=false}){
 const testing=loadConfig('testing',root),production=loadConfig('production',root);
 if(validatePair(production,testing).length||!/^[a-f0-9]{40}$/.test(commitSha||''))throw Error('Testing Hosting configuration/source is incomplete');
 const matrix=JSON.parse(fs.readFileSync(path.join(root,'tools/testing/config/write-gate-matrix.json'),'utf8')).gates;
 const gates=Object.fromEntries(matrix.map(row=>[row.gate,row.testing]));
 if(canonicalDigest(attestation)!==attestationDigest)throw Error('Testing runtime attestation digest mismatch');
 validateRuntimeAttestation(attestation,{commitSha,testing,trustAnchor:BASELINE_COMMIT,expectedGates:gates});
 if(build?.repository?.full_name!==attestation.repository||build.path!=='.github/workflows/azure-beta-build.yml'||build.id!==attestation.sourceRunId||build.head_sha!==commitSha||build.head_branch!=='main'||build.event!=='push'||build.status!=='completed'||build.conclusion!=='success')throw Error('Testing source build must be exact successful main push');
 if(sourceArtifact?.id!==attestation.sourceArtifactId||sourceArtifact.name!=='azure-beta-'+commitSha||sourceArtifact.expired!==false||sourceArtifact.digest!==attestation.sourceArtifactDigest||sourceArtifact.workflow_run?.id!==build.id||sourceArtifact.workflow_run?.head_sha!==commitSha)throw Error('Testing source artifact differs from staged API attestation');
 const probes=await liveChecks({production,testing,fetchImpl,expectedSha:commitSha,expectedGates:gates,trustAnchor:BASELINE_COMMIT,skipSite:true});
 if(probes.length!==4||probes.some(probe=>probe.status!=='pass'))throw Error('Testing staged API probes failed; Hosting was not published');
 if(probeOnly)return {status:'API_ACCEPTED',commitSha,targetProfile:'university-testing'};
 if(typeof deployHosting!=='function')throw Error('Testing Hosting deployment adapter is missing');
 await deployHosting({root,testing,commitSha});
 const postflight=await liveChecks({production,testing,fetchImpl,expectedSha:commitSha,expectedGates:gates,trustAnchor:BASELINE_COMMIT});
 if(postflight.some(probe=>probe.status!=='pass'))throw Error('Testing post-deploy probes failed; no successful release evidence can be emitted');
 return {environment:'testing',commitSha,sourceRunId:build.id,status:'success',targetProfile:'university-testing',siteUrl:testing.siteUrl,apiOrigin:testing.apiOrigin,
  runtimeAttestationDigest:attestationDigest,runtimeAttestation:attestation,sourceArtifactDigest:sourceArtifact.digest,trustAnchor:BASELINE_COMMIT,
  gateFingerprint:canonicalDigest(gates),deployedAtUtc:new Date().toISOString()};
}
async function main(argv){
 const arg=name=>{const i=argv.indexOf(name);return i>=0?argv[i+1]:undefined;},read=name=>JSON.parse(fs.readFileSync(arg(name),'utf8'));
 const commitSha=arg('--sha');
 const result=await publishTesting({commitSha,build:read('--build'),sourceArtifact:read('--source-artifact'),attestation:read('--attestation'),attestationDigest:arg('--attestation-digest'),probeOnly:argv.includes('--probe-only'),
  deployHosting:async({testing})=>{
   const source=path.join(ROOT,'.azure-testing/app'),target=path.join(ROOT,'.firebase-production/app');
   const {assertNoLinks}=require('./host/artifact-attestation');assertNoLinks(source);
   verifyTestingStaticArtifact({root:ROOT,source});
   fs.mkdirSync(path.dirname(target),{recursive:true});assertNoLinks(path.dirname(target));if(fs.existsSync(target))assertNoLinks(target);
   fs.rmSync(target,{recursive:true,force:true});fs.cpSync(source,target,{recursive:true,dereference:false});
   execFileSync(process.execPath,[require.resolve('firebase-tools/lib/bin/firebase.js'),'deploy','--only','hosting','--project',resolveTestingHostingProject(testing),'--config','firebase.hosting-only.json','--non-interactive','--message','Verified University Testing '+commitSha],{cwd:ROOT,stdio:['ignore','pipe','pipe'],timeout:300000,maxBuffer:4*1024**2});
   await verifyServedArtifacts({source:target,siteUrl:testing.siteUrl,commitSha});
  }});
 if(!argv.includes('--probe-only'))fs.writeFileSync('testing-deploy-evidence.json',JSON.stringify({...result,runId:process.env.GITHUB_RUN_ID},null,2)+'\n');
 console.log(JSON.stringify({status:result.status,commitSha:result.commitSha,targetProfile:result.targetProfile}));
}
if(require.main===module)main(process.argv.slice(2)).catch(()=>{console.error('TESTING_HOSTING_NOT_ACCEPTED');process.exitCode=1;});
module.exports={publishTesting,canonicalDigest,verifyTestingStaticArtifact,verifyServedArtifacts,resolveTestingHostingProject};
