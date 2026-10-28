'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const REPOSITORY='Alex1122341/Teaching-assignment-azure';
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function assertNoLinks(value){
 const resolved=path.resolve(value);
 let cursor=path.parse(resolved).root;
 for(const part of path.relative(cursor,resolved).split(path.sep).filter(Boolean)){
  cursor=path.join(cursor,part);
  if(fs.lstatSync(cursor).isSymbolicLink())throw Error('Artifact path contains a symbolic link or junction');
 }
 return resolved;
}
function safeRelative(file){
 return typeof file==='string'&&file.length>0&&!path.posix.isAbsolute(file)&&!path.win32.isAbsolute(file)&&
  !/[\\:\x00-\x1f<>"|?*]/.test(file)&&file.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!/[. ]$/.test(part));
}
function filesIn(root){
 const result=[];
 function walk(directory){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
   const absolute=path.join(directory,entry.name),stat=fs.lstatSync(absolute);
   if(stat.isSymbolicLink())throw Error('Artifact links are forbidden');
   if(stat.isDirectory())walk(absolute);
   else if(stat.isFile())result.push(path.relative(root,absolute).replaceAll('\\','/'));
   else throw Error('Artifact contains a non-file path');
  }
 }
 walk(root);return result.sort();
}
function fetchMetadata(repository,runId,artifactId){
 const read=endpoint=>JSON.parse(execFileSync('gh',['api',endpoint],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:8*1024**2,timeout:30000}));
 try{return {run:read(`repos/${repository}/actions/runs/${runId}`),artifact:read(`repos/${repository}/actions/artifacts/${artifactId}`),pullRequest:read(`repos/${repository}/pulls/125`),main:read(`repos/${repository}/commits/main`)};}
 catch{throw Error('Official CI artifact metadata is unavailable');}
}
async function verifySourceArtifact(input,dependencies={}){
 const {repository,commitSha,sourceRun,artifact,checkout}=input||{};
 if(repository!==REPOSITORY||!/^[a-f0-9]{40}$/.test(commitSha||''))throw Error('Artifact repository/source SHA is not approved');
 if(!Number.isSafeInteger(sourceRun)||sourceRun<1||!Number.isSafeInteger(artifact?.id)||artifact.id<1)throw Error('Official CI run/artifact identifiers are required');
 const git=dependencies.git||(args=>execFileSync('git',args,{cwd:checkout,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}).trim());
 const remote=git(['remote','get-url','origin']).trim().replace(/\.git$/,'');
 if(!['https://github.com/'+REPOSITORY,'git@github.com:'+REPOSITORY].includes(remote))throw Error('Artifact checkout repository mismatch');
 if(git(['rev-parse','HEAD']).trim()!==commitSha||git(['status','--porcelain','--untracked-files=no']).trim())throw Error('Artifact source checkout must be clean at the exact source SHA');
 const metadata=await (dependencies.fetchMetadata||fetchMetadata)(repository,sourceRun,artifact.id);
 const run=metadata.run,official=metadata.artifact;
 if(run?.id!==sourceRun||run.repository?.full_name!==repository||run.status!=='completed'||run.conclusion!=='success'||run.path!=='.github/workflows/azure-beta-build.yml'||!/^[a-f0-9]{40}$/.test(run.head_sha||''))throw Error('Official CI source run is not an accepted Build');
 let provenance;
 if(run.event==='pull_request'&&run.pull_requests?.some(pr=>pr.number===125&&pr.head?.sha===commitSha)){
  if(metadata.pullRequest?.head?.sha!==commitSha)throw Error('Current PR source head differs from accepted candidate');
  provenance='candidate-only';
 }else if(run.event==='push'&&run.head_branch==='main'&&run.head_sha===commitSha){
  if(metadata.main?.sha!==commitSha)throw Error('Current main source differs from accepted release');
  provenance='main';
 }else throw Error('CI must belong to exact PR125 or main source');
 if(git(['rev-parse',run.head_sha+'^{tree}']).trim()!==git(['rev-parse',commitSha+'^{tree}']).trim())throw Error('CI merge/source tree mismatch');
 if(official?.id!==artifact.id||official.expired!==false||official.workflow_run?.id!==sourceRun||official.workflow_run?.head_sha!==run.head_sha||official.name!=='azure-beta-'+run.head_sha||!/^sha256:[a-f0-9]{64}$/.test(official.digest||''))throw Error('Official CI artifact metadata mismatch');
 const archive=assertNoLinks(artifact.archivePath),root=assertNoLinks(artifact.apiPath);
 if(!fs.statSync(archive).isFile()||fs.statSync(archive).size>512*1024**2||fs.statSync(archive).size<1||'sha256:'+digest(fs.readFileSync(archive))!==official.digest)throw Error('Downloaded official artifact archive digest mismatch');
 if(path.resolve(root)===path.resolve(checkout)||!fs.statSync(root).isDirectory())throw Error('Artifact must be a packaged API, not raw source');
 let inventory;
 try{inventory=JSON.parse(fs.readFileSync(path.join(root,'artifact-inventory.json'),'utf8'));}catch{throw Error('API artifact inventory is unavailable');}
 if(!Array.isArray(inventory)||inventory.length===0||inventory.some(file=>!safeRelative(file))||new Set(inventory.map(file=>file.toLowerCase())).size!==inventory.length)throw Error('API artifact inventory contains unsafe or duplicate paths');
 const actual=filesIn(root);
 if(JSON.stringify(actual)!==JSON.stringify([...inventory,'artifact-inventory.json'].sort()))throw Error('API artifact inventory differs from packaged files');
 const verifyFreeze=dependencies.verifyFreeze||require('../../beta-api-freeze').verifyFreeze;
 const freeze=verifyFreeze({root:checkout,artifact:root});
 if(freeze?.ok!==true||!/^[a-f0-9]{40}$/.test(freeze.baselineCommit||''))throw Error('API artifact immutable freeze verification failed');
 const files=inventory.sort().map(file=>({path:file,sha256:digest(fs.readFileSync(path.join(root,...file.split('/'))))}));
 return {version:1,repository,commitSha,sourceRun,sourceRunSha:run.head_sha,artifactId:artifact.id,artifactDigest:official.digest,
  baselineCommit:freeze.baselineCommit,provenance,files,utc:new Date().toISOString()};
}
module.exports={verifySourceArtifact,assertNoLinks,safeRelative};
