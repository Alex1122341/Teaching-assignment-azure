'use strict';
const crypto=require('node:crypto');
const {assertTarget}=require('./db/university-admin');
const {GATE_ENV}=require('../../server/src/data/write-gates');
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
 return value;
}
const canonicalDigest=value=>crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function makeRuntimeAttestation(profile,manifest){
 return {version:1,kind:'operator-runtime-attestation',status:'READY',repository:manifest.repository,commitSha:manifest.commitSha,
  sourceRunId:manifest.sourceRun,sourceArtifactId:manifest.artifactId,sourceArtifactDigest:manifest.artifactDigest,
  trustAnchor:manifest.baselineCommit,targetProfile:'university-testing',target:Object.fromEntries(['profile','host','physicalServer','database','environmentId'].map(key=>[key,profile.target[key]])),firebaseProjectId:profile.firebaseProjectId,
  apiOrigin:manifest.apiOrigin,siteUrl:profile.allowedOrigin,gates:profile.gateMap,gateFingerprint:canonicalDigest(profile.gateMap),
  stagedManifestDigest:profile.releaseManifestSha256,nodeMajor:22,sqlDriver:'msnodesqlv8',strictTls:true};
}
const KEYS=['version','kind','status','repository','commitSha','sourceRunId','sourceArtifactId','sourceArtifactDigest','trustAnchor','targetProfile','target','firebaseProjectId','apiOrigin','siteUrl','gates','gateFingerprint','stagedManifestDigest','nodeMajor','sqlDriver','strictTls'];
function validateRuntimeAttestation(value,{commitSha,testing,trustAnchor,expectedGates}){
 if(!value||JSON.stringify(Object.keys(value).sort())!==JSON.stringify([...KEYS].sort())||value.version!==1||value.kind!=='operator-runtime-attestation'||value.status!=='READY')throw Error('Testing runtime attestation is incomplete or contains unsupported fields');
 if(value.repository!=='Alex1122341/Teaching-assignment-azure'||value.commitSha!==commitSha||value.trustAnchor!==trustAnchor||value.targetProfile!=='university-testing'||value.nodeMajor!==22||value.sqlDriver!=='msnodesqlv8'||value.strictTls!==true)throw Error('Testing runtime attestation source/profile mismatch');
 assertTarget(value.target);
 if(JSON.stringify(Object.keys(value.target).sort())!==JSON.stringify(['profile','host','physicalServer','database','environmentId'].sort()))throw Error('Testing target attestation contains unsupported fields');
 if(value.firebaseProjectId!==testing.firebase?.projectId||value.apiOrigin!==testing.apiOrigin||value.siteUrl!==testing.siteUrl||!/^[a-f0-9]{64}$/.test(value.stagedManifestDigest||''))throw Error('Testing runtime attestation origin/project/digest mismatch');
 if(!value.gates||JSON.stringify(Object.keys(value.gates).sort())!==JSON.stringify(Object.keys(GATE_ENV).sort())||Object.values(value.gates).some(on=>typeof on!=='boolean')||value.gateFingerprint!==canonicalDigest(value.gates)||canonicalDigest(value.gates)!==canonicalDigest(expectedGates))throw Error('Testing runtime attestation gate fingerprint mismatch');
 if(!Number.isSafeInteger(value.sourceRunId)||value.sourceRunId<1||!Number.isSafeInteger(value.sourceArtifactId)||value.sourceArtifactId<1||!/^sha256:[a-f0-9]{64}$/.test(value.sourceArtifactDigest||''))throw Error('Testing runtime attestation has no official source artifact binding');
 return value;
}
module.exports={canonicalDigest,makeRuntimeAttestation,validateRuntimeAttestation};
