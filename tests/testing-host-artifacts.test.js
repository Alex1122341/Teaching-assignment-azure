'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const file=path.resolve(__dirname,'../tools/testing-host/artifact-attestation.js'),api=fs.existsSync(file)?require(file):{};
const REPO='Alex1122341/Teaching-assignment-azure',SHA='1'.repeat(40),MERGE='2'.repeat(40),TREE='3'.repeat(40);
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'paws-host-artifact-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const artifactRoot=path.join(root,'artifact-api'),checkout=path.join(root,'checkout'),archivePath=path.join(root,'official.zip');
 fs.mkdirSync(artifactRoot);fs.mkdirSync(checkout);fs.writeFileSync(path.join(artifactRoot,'artifact-inventory.json'),'["index.js"]');fs.writeFileSync(path.join(artifactRoot,'index.js'),'// accepted fixture\n');fs.writeFileSync(archivePath,'official fixture archive');
 const digest='sha256:'+crypto.createHash('sha256').update(fs.readFileSync(archivePath)).digest('hex');
 const run={id:987,repository:{full_name:REPO},head_sha:MERGE,head_branch:'feat/paws-testing-environment',status:'completed',conclusion:'success',event:'pull_request',path:'.github/workflows/azure-beta-build.yml',pull_requests:[{number:125,head:{sha:SHA}}]};
 const metadata={id:654,name:'azure-beta-'+MERGE,expired:false,digest,workflow_run:{id:987,head_sha:MERGE}};
 const calls=[];
 const input={repository:REPO,commitSha:SHA,sourceRun:987,artifact:{id:654,archivePath,apiPath:artifactRoot},checkout};
 const deps={async fetchMetadata(){return {run,artifact:metadata,pullRequest:{head:{sha:SHA}},main:{sha:SHA}};},git(args){calls.push(args);
  if(args[0]==='remote')return 'https://github.com/'+REPO+'.git';
  if(args[0]==='status')return '';
  if(args[1]==='HEAD')return SHA;
  return TREE;
 },verifyFreeze(){return {ok:true,baselineCommit:'4'.repeat(40),protected:5};}};
 return {root,artifactRoot,input,deps,run,metadata,calls};
}
function verify(){assert.equal(typeof api.verifySourceArtifact,'function','artifact attestation must implement accepted CI source boundary');return api.verifySourceArtifact;}
test('attestation binds accepted API bytes to exact PR source tree run artifact and raw archive digest',async t=>{
 const h=fixture(t),result=await verify()(h.input,h.deps);
 assert.equal(result.commitSha,SHA);assert.equal(result.provenance,'candidate-only');assert.equal(result.sourceRun,987);assert.equal(result.artifactId,654);
 assert.equal(result.artifactDigest,h.metadata.digest);assert.equal(result.files.length,1);assert.ok(!JSON.stringify(result).includes(h.root));
});
test('artifact rejects wrong repository source SHA merge tree digest and incomplete CI',async t=>{
 const fn=verify();
 for(const change of ['repository','sha','tree','digest','run','workflow','pr','artifact','freeze','dirty']){
  const h=fixture(t);
  if(change==='repository')h.input.repository='some/other';
  if(change==='sha')h.input.commitSha='5'.repeat(40);
  if(change==='tree')h.deps.git=args=>args[0]==='remote'?'https://github.com/'+REPO+'.git':args[0]==='status'?'':args[1]==='HEAD'?SHA:args[1].startsWith(MERGE)?'a'.repeat(40):TREE;
  if(change==='digest')h.metadata.digest='sha256:'+'a'.repeat(64);
  if(change==='run')h.run.conclusion='failure';
  if(change==='workflow')h.run.path='.github/workflows/other.yml';
  if(change==='pr')h.run.pull_requests=[];
  if(change==='artifact')h.metadata.workflow_run.id=456;
  if(change==='freeze')h.deps.verifyFreeze=()=>({ok:false});
  if(change==='dirty'){const old=h.deps.git;h.deps.git=args=>args[0]==='status'?' M server/src/runtime/environment.js':old(args);}
  await assert.rejects(fn(h.input,h.deps),/artifact|repository|source|tree|digest|CI|freeze|checkout|PR/i,change);
 }
});
test('artifact rejects traversal duplicate inventory raw source and links',async t=>{
 const fn=verify();
 for(const inventory of [['../outside'],['C:\\secret'],['index.js','index.js'],['server/../../secret']]){
  const h=fixture(t);fs.writeFileSync(path.join(h.artifactRoot,'artifact-inventory.json'),JSON.stringify(inventory));await assert.rejects(fn(h.input,h.deps),/inventory|path|artifact/i);
 }
 const h=fixture(t);h.input.artifact.apiPath=h.input.checkout;await assert.rejects(fn(h.input,h.deps),/inventory|artifact|source/i);
 const linked=fixture(t),link=path.join(linked.root,'linked-api');fs.symlinkSync(linked.artifactRoot,link,process.platform==='win32'?'junction':'dir');linked.input.artifact.apiPath=link;
 await assert.rejects(fn(linked.input,linked.deps),/link|path|artifact/i);
});
