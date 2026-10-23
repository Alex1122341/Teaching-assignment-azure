'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync,spawn}=require('node:child_process');
const {GATE_ENV}=require('../../server/src/data/write-gates');
const {assertNoLinks,safeRelative,verifySourceArtifact}=require('./artifact-attestation');
const {validateHostProfile}=require('./host-policy');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const normalize=bytes=>Buffer.from(bytes).toString('utf8').replace(/\r\n/g,'\n');
const stable=value=>JSON.stringify(value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,JSON.parse(stable(value[key]))])):value);
const samePath=(a,b)=>typeof a==='string'&&typeof b==='string'&&path.win32.resolve(a).toLowerCase()===path.win32.resolve(b).toLowerCase();
function matchesCommandLine(command,exe,entry){
 const parts=String(command||'').match(/"[^"]*"|\S+/g)?.map(part=>part.replace(/^"|"$/g,''));
 return Boolean(parts?.length===2&&samePath(parts[0],exe)&&samePath(parts[1],entry));
}
function cleanOsEnvironment(base=process.env){
 const allowed=new Set(['path','systemroot','windir','temp','tmp','localappdata','appdata','userprofile','username','userdomain','programfiles','programfiles(x86)','programdata','comspec','pathext','systemdrive']);
 return Object.fromEntries(Object.entries(base).filter(([key])=>allowed.has(key.toLowerCase())));
}
function buildRuntimeEnvironment(profile,manifest,secrets,base=process.env){
 if(!secrets||Object.keys(secrets).some(key=>key!=='firebaseServiceAccount')||secrets.firebaseServiceAccount?.project_id!==profile.firebaseProjectId||
  typeof secrets.firebaseServiceAccount.private_key!=='string'||typeof secrets.firebaseServiceAccount.client_email!=='string')throw Error('Testing credential configuration is invalid');
 const env=cleanOsEnvironment(base);
 Object.assign(env,{PAWS_ENVIRONMENT:'testing',PAWS_API_HOST:'127.0.0.1',PAWS_API_PORT:String(profile.apiPort),PAWS_API_ALLOWED_ORIGINS:profile.allowedOrigin,
  PAWS_TESTING_SQL_PROFILE:'university-testing',PAWS_TESTING_SQL_SERVER:profile.target.host,PAWS_TESTING_DATABASE:profile.target.database,PAWS_TESTING_ENVIRONMENT_ID:profile.target.environmentId,
  PAWS_SQL_DRIVER:'msnodesqlv8',PAWS_SQL_CONNECTION_STRING:`Server=tcp:${profile.target.host},1433;Database=${profile.target.database};Encrypt=true;TrustServerCertificate=false`,
  FIREBASE_PROJECT_ID:profile.firebaseProjectId,FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify(secrets.firebaseServiceAccount),
  PAWS_RELEASE_SHA:manifest.commitSha,PAWS_RUNTIME_TRUST_ANCHOR:manifest.baselineCommit});
 for(const [gate,key]of Object.entries(GATE_ENV))env[key]=profile.gateMap[gate]===true?'true':'false';
 return env;
}
function ps(script){return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000}).replace(/^\uFEFF/,'').trim()||'null');}
function processInfo(pid){
 if(!Number.isSafeInteger(pid)||pid<1)return null;
 const value=ps(`$p=Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" -ErrorAction Stop;if($p){[pscustomobject]@{pid=[int]$p.ProcessId;startTime=$p.CreationDate.ToUniversalTime().ToString('o');executable=$p.ExecutablePath;commandLine=$p.CommandLine}|ConvertTo-Json -Compress}`);
 if(!value?.executable)return null;
 try{return {...value,executableSha256:sha(assertNoLinks(value.executable))};}catch{return null;}
}
function readJson(file){return JSON.parse(fs.readFileSync(assertNoLinks(file),'utf8'));}
function atomicJson(file,value){
 assertNoLinks(path.dirname(file));if(fs.existsSync(file))assertNoLinks(file);
 const next=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(next,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});fs.renameSync(next,file);
}
function privatePath(profile,relative){
 if(!safeRelative(relative))throw Error('Unsafe Testing private path');
 const result=path.resolve(profile.privateRoot,...relative.split('/'));
 if(path.relative(path.resolve(profile.privateRoot),result).startsWith('..'))throw Error('Testing private path escaped its root');
 return result;
}
function usage(directory){
 if(!fs.existsSync(directory))return 0;assertNoLinks(directory);let total=0;
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name),stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw Error('Testing private paths contain links');
  total+=stat.isDirectory()?usage(file):stat.size;
 }return total;
}
function hashTree(root){
 const files=[];function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name),stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw Error('Testing staged files contain links');
  if(stat.isDirectory())walk(file);else if(stat.isFile())files.push({path:path.relative(root,file).replaceAll('\\','/'),sha256:sha(file)});else throw Error('Testing staged path is not a regular file');
 }}walk(root);return files.sort((a,b)=>a.path.localeCompare(b.path));
}
function verifyStaged(profile){
 try{
  if(!/^[a-f0-9]{64}$/.test(profile.releaseManifestSha256||'')||sha(assertNoLinks(profile.releaseManifestPath))!==profile.releaseManifestSha256)return null;
  const manifest=readJson(profile.releaseManifestPath);
  if(!/^[a-f0-9]{40}$/.test(manifest.commitSha||'')||!Array.isArray(manifest.stagedFiles)||manifest.stagedFiles.some(row=>!safeRelative(row.path)||!/^[a-f0-9]{64}$/.test(row.sha256||'')))return null;
  if(stable(manifest.target)!==stable(profile.target)||stable(manifest.gateMap)!==stable(profile.gateMap)||manifest.firebaseProjectId!==profile.firebaseProjectId||manifest.allowedOrigin!==profile.allowedOrigin||manifest.nodeSha256!==profile.nodeSha256||!Array.isArray(manifest.supervisorFiles)||manifest.supervisorFiles.length!==9)return null;
  const version=privatePath(profile,'versions/'+manifest.commitSha);
  const actual=hashTree(assertNoLinks(version));
  if(JSON.stringify(actual)!==JSON.stringify(manifest.stagedFiles))return null;
  if(!samePath(process.execPath,profile.nodeExe)||sha(profile.nodeExe)!==profile.nodeSha256)return null;
  // Check the supervisor that is actually running, not just its staged copy.
  for(const row of manifest.supervisorFiles||[]){if(!safeRelative(row.path)||sha(path.resolve(__dirname,'../..',row.path))!==row.sha256)return null;}
  return manifest;
 }catch{return null;}
}
async function health(origin){
 try{const response=await fetch(origin+'/api/health/runtime',{signal:AbortSignal.timeout(3000)});if(!response.ok)return null;return await response.json();}catch{return null;}
}
async function observe(profile){
 const identity=ps("[pscustomobject]@{computerName=$env:COMPUTERNAME;windowsIdentity=[Security.Principal.WindowsIdentity]::GetCurrent().Name;localAppData=$env:LOCALAPPDATA}|ConvertTo-Json -Compress");
 let unsafePaths=false;
 try{
  assertNoLinks(profile.privateRoot);assertNoLinks(path.dirname(profile.releaseManifestPath));
  for(let directory=path.resolve(profile.privateRoot);;directory=path.dirname(directory)){
   if(fs.existsSync(path.join(directory,'.git')))throw Error('Testing host storage has a Git ancestor');
   if(path.dirname(directory)===directory)break;
  }
  for(const relative of ['secrets','secrets/credentials.json']){const file=privatePath(profile,relative);if(fs.existsSync(file))assertNoLinks(file);}
  const quoted=profile.privateRoot.replace(/'/g,"''");
  const safeAcl=ps(`$me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$allowed=@($me,'S-1-5-18','S-1-5-32-544');$safe=$true;foreach($p in @('${quoted}','${quoted}\\secrets','${quoted}\\secrets\\credentials.json')){if(Test-Path -LiteralPath $p){$a=Get-Acl -LiteralPath $p -ErrorAction Stop;foreach($r in $a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){if($r.AccessControlType -eq 'Allow' -and $allowed -notcontains $r.IdentityReference.Value){$safe=$false}}}};$safe|ConvertTo-Json -Compress`);
  if(safeAcl!==true)unsafePaths=true;
 }catch{unsafePaths=true;}
 const stats=fs.statfsSync(path.parse(path.resolve(profile.privateRoot)).root),manifest=verifyStaged(profile);
 let recordedProcess=null,actualProcess=null;
 try{recordedProcess=readJson(privatePath(profile,'api-process.json'));const native=processInfo(recordedProcess.pid);
  if(native&&matchesCommandLine(native.commandLine,recordedProcess.executable,recordedProcess.entrypoint))actualProcess={...native,entrypoint:recordedProcess.entrypoint};
 }catch{}
 const listeners=ps("@(Get-NetTCPConnection -LocalPort 18788 -State Listen -ErrorAction SilentlyContinue|ForEach-Object{[pscustomobject]@{host=$_.LocalAddress;port=[int]$_.LocalPort;pid=[int]$_.OwningProcess}})|ConvertTo-Json -Compress");
 const list=Array.isArray(listeners)?listeners:listeners?[listeners]:[],listener=list.find(row=>row.host!=='127.0.0.1')||list[0];
 let port=null;if(listener)port={host:listener.host,port:listener.port,process:listener.pid===actualProcess?.pid?actualProcess:processInfo(listener.pid)};
 let actualTunnelOrigin=null;
 try{
  const tunnel=readJson(privatePath(profile,'tunnel-state.json')),native=processInfo(tunnel.pid);
  if(native&&native.startTime===tunnel.startTime&&native.executableSha256===tunnel.executableSha256&&/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(tunnel.origin)&&
   native.commandLine.includes('http://127.0.0.1:18788')){
   const logfile=privatePath(profile,'tunnel-origin.log');
   if(fs.statSync(assertNoLinks(logfile)).size<=100*1024**2){const fd=fs.openSync(logfile,'r');try{const size=fs.fstatSync(fd).size,buffer=Buffer.alloc(Math.min(size,65536));fs.readSync(fd,buffer,0,buffer.length,Math.max(0,size-buffer.length));actualTunnelOrigin=[...buffer.toString('utf8').matchAll(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g)].at(-1)?.[0]||null;}finally{fs.closeSync(fd);}}
  }
 }catch{}
 const local=port&&actualProcess?await health('http://127.0.0.1:18788'):null;
 let sqlHealthy=false;
 if(local?.environment==='testing')try{sqlHealthy=(await fetch('http://127.0.0.1:18788/api/health/sql',{signal:AbortSignal.timeout(5000)})).ok;}catch{}
 // Readiness additionally needs the published ingress to reach this release.
 if(local&&actualTunnelOrigin){const remote=await health(actualTunnelOrigin);if(remote?.releaseSha!==local.releaseSha||remote?.environment!=='testing')actualTunnelOrigin=null;}
 return {...identity,freeBytes:Number(stats.bavail)*Number(stats.bsize),unsafePaths,
  resetActive:fs.existsSync(privatePath(profile,'reset.lock')),manifestVerified:Boolean(manifest),dependenciesVerified:Boolean(manifest),nodeMajor:Number(process.versions.node.split('.')[0]),
  manifest,recordedProcess,actualProcess,port,actualTunnelOrigin,
  health:local?{environment:local.environment,releaseSha:local.releaseSha,sqlHealthy,gates:local.writeGates}:null};
}
async function stage(profile,descriptor,observed,configPath){
 validateHostProfile(profile,observed);
 if(observed.resetActive!==false||observed.freeBytes<8*1024**3||usage(profile.privateRoot)>2*1024**3)throw Error('Testing host capacity/reset preflight failed');
 if(Number(process.versions.node.split('.')[0])!==22||!samePath(process.execPath,profile.nodeExe)||sha(assertNoLinks(profile.nodeExe))!==profile.nodeSha256)throw Error('Testing staging requires the pinned Node22 runtime');
 const accepted=await verifySourceArtifact(descriptor);
 const config=readJson(path.join(descriptor.checkout,'config/environments/testing.json'));
 if(config.environment!=='testing'||config.firebase?.projectId!==profile.firebaseProjectId||config.siteUrl!==profile.allowedOrigin||!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(config.apiOrigin||'')||config.apiOrigin!==observed.actualTunnelOrigin)throw Error('Testing committed configuration/tunnel is not ready');
 const version=privatePath(profile,'versions/'+accepted.commitSha);
 if(fs.existsSync(version))throw Error('Testing version already exists; never overwrite an unknown or accepted version');
 const parent=path.dirname(version);fs.mkdirSync(parent,{recursive:true});assertNoLinks(parent);fs.mkdirSync(version);
 const api=path.join(version,'api');fs.mkdirSync(api);
 for(const file of [...accepted.files.map(row=>row.path),'artifact-inventory.json']){
  const source=path.join(descriptor.artifact.apiPath,...file.split('/')),destination=path.join(api,...file.split('/'));
  assertNoLinks(source);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(source,destination,fs.constants.COPYFILE_EXCL);
 }
 const repositoryInputs=[];
 for(const file of ['server/package.json','server/package-lock.json']){
  const source=path.join(descriptor.checkout,file),destination=path.join(api,file);
  fs.copyFileSync(assertNoLinks(source),destination,fs.constants.COPYFILE_EXCL);repositoryInputs.push({path:file,sha256:sha(source)});
 }
 const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');assertNoLinks(npm);
 execFileSync(process.execPath,[npm,'ci','--omit=dev','--no-audit','--no-fund','--prefix',path.join(api,'server')],{cwd:version,env:cleanOsEnvironment(),stdio:['ignore','pipe','pipe'],timeout:300000,maxBuffer:2*1024**2,windowsHide:true});
 const supervisorFiles=[];
 for(const file of ['tools/testing-host/host-cli.js','tools/testing-host/host-platform.js','tools/testing-host/host-policy.js','tools/testing-host/artifact-attestation.js','tools/testing-host/Invoke-PawsTestingHost.ps1','tools/testing-runtime-attestation.js','tools/testing-db/university-admin.js','server/src/runtime/sql-environment-target.js','server/src/data/write-gates.js']){
  const source=path.join(descriptor.checkout,file),blob=execFileSync('git',['cat-file','blob',accepted.commitSha+':'+file],{cwd:descriptor.checkout,stdio:['ignore','pipe','pipe']});
  if(normalize(fs.readFileSync(assertNoLinks(source)))!==normalize(blob))throw Error('Testing supervisor source differs from accepted commit');
  const destination=path.join(version,'supervisor',file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(source,destination,fs.constants.COPYFILE_EXCL);supervisorFiles.push({path:file,sha256:sha(source)});
 }
 if(usage(profile.privateRoot)>2*1024**3)throw Error('Testing artifact retention exceeds quota; preserve active/rollback/evidence and resolve explicitly');
 const manifest={...accepted,apiOrigin:config.apiOrigin,target:profile.target,gateMap:profile.gateMap,firebaseProjectId:profile.firebaseProjectId,
  allowedOrigin:profile.allowedOrigin,nodeSha256:profile.nodeSha256,repositoryInputs,supervisorFiles,stagedFiles:hashTree(version)};
 const manifestPath=privatePath(profile,'releases/'+accepted.commitSha+'.json');fs.mkdirSync(path.dirname(manifestPath),{recursive:true});
 if(fs.existsSync(manifestPath))throw Error('Testing release manifest already exists');atomicJson(manifestPath,manifest);
 atomicJson(configPath,{...profile,releaseManifestPath:manifestPath,releaseManifestSha256:sha(manifestPath)});
 return {status:'STAGED',action:'Stage',commitSha:accepted.commitSha,provenance:accepted.provenance,utc:new Date().toISOString()};
}
async function start(profile,manifest){
 const lock=privatePath(profile,'host-start.lock'),fd=fs.openSync(lock,'wx',0o600);
 try{
  const fresh=await observe(profile);validateHostProfile(profile,fresh);
  if(fresh.resetActive||fresh.port||fresh.actualProcess||!fresh.manifestVerified||fresh.manifest?.commitSha!==manifest.commitSha)throw Error('Testing start observation changed');
  const version=privatePath(profile,'versions/'+manifest.commitSha),entrypoint=path.join(version,'api/server/src/runtime/university-api.js');
  const env=buildRuntimeEnvironment(profile,manifest,readJson(privatePath(profile,'secrets/credentials.json')));
  // Keep raw runtime output out of public tools and unbounded log files.
  // Sanitized Check receipts provide bounded diagnostics; the real API owns
  // SQL retry and shutdown behavior. This is not an unattended service.
  const child=spawn(profile.nodeExe,[entrypoint],{cwd:path.join(version,'api/server'),env,detached:true,windowsHide:true,stdio:'ignore'});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();
  const native=processInfo(child.pid);
  if(!native||!matchesCommandLine(native.commandLine,profile.nodeExe,entrypoint))throw Error('Testing API process ownership could not be recorded');
  atomicJson(privatePath(profile,'api-process.json'),{pid:child.pid,startTime:native.startTime,executable:native.executable,executableSha256:native.executableSha256,entrypoint,commitSha:manifest.commitSha});
 }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
async function stop(pid,recorded,profile){
 const native=processInfo(pid);
 if(!native||native.startTime!==recorded.startTime||native.executableSha256!==recorded.executableSha256||!samePath(native.executable,recorded.executable)||!matchesCommandLine(native.commandLine,recorded.executable,recorded.entrypoint))throw Error('Testing process identity changed; termination refused');
 process.kill(pid,'SIGTERM');
 let exited=false;
 for(let attempt=0;attempt<8;attempt++){
  const current=processInfo(pid);if(!current||current.startTime!==recorded.startTime){exited=true;break;}
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 if(!exited)throw Error('Testing API stop did not verify');
 const count=ps("@(Get-NetTCPConnection -LocalPort 18788 -State Listen -ErrorAction SilentlyContinue).Count | ConvertTo-Json -Compress");
 let resetInhibited=false;
 try{const lock=readJson(privatePath(profile,'reset.lock'));resetInhibited=lock.target?.database===profile.target.database&&lock.target?.environmentId===profile.target.environmentId;}catch{}
 return {listenerFree:count===0,resetInhibited};
}
module.exports={buildRuntimeEnvironment,matchesCommandLine,observe,stage,start,stop,readJson,privatePath,cleanOsEnvironment};
