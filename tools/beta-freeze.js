'use strict';
// Frozen PAWS Beta runtime enforcement.
//
// The immutable trust anchor is the frozen baseline Git commit, not any file in
// the working tree. Every shipped application file listed by the static asset
// manifest is compared byte-for-byte against the blob stored in that commit, so
// editing a runtime file together with `tools/beta-baseline.json` (or with the
// manifest itself) can never produce a green result.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');

// Reviewed read-only CCC Schedule is the immutable trust anchor: it adds the
// authenticated cross-faculty CCC reader (SQL 057, API route, client viewer) on
// top of the accepted Faculty Availability + restored Dashboard History product.
// Prior AFC, DOE Rule Book / Lookup UI, Selected Schedule Export, DOE Calculator,
// AUTH-1, P3, P2, P1, W1M and earlier anchors remain immutable historical
// evidence in governance tests.
const BASELINE_COMMIT='5b135dfc91332a6fad29376d1d88d9acd33fd62a';
const MANIFEST_PATH='tools/static-assets.json';

function defaultRoot(){
  return path.resolve(__dirname,'..');
}

// Line-ending canonicalisation: Git stores text with LF while a Windows
// checkout materialises CRLF. Binary assets have no CRLF sequence, so the
// canonical form is identical to the stored blob.
function normalize(buffer){
  const source=Buffer.isBuffer(buffer)?buffer:Buffer.from(String(buffer),'utf8');
  const out=Buffer.allocUnsafe(source.length);
  let length=0;
  for(let i=0;i<source.length;i+=1){
    if(source[i]===0x0d&&source[i+1]===0x0a){
      out[length]=0x0a;
      length+=1;
      i+=1;
      continue;
    }
    out[length]=source[i];
    length+=1;
  }
  return out.subarray(0,length);
}

function sha256Canonical(buffer){
  return crypto.createHash('sha256').update(normalize(buffer),'utf8').digest('hex');
}

function gitBlob(root,ref){
  return execFileSync('git',['cat-file','blob',ref],{cwd:root,maxBuffer:256*1024*1024});
}

function baselineCommitExists(root,baselineCommit){
  try{
    execFileSync('git',['cat-file','-e',`${baselineCommit}^{commit}`],{cwd:root,stdio:'pipe'});
    return true;
  }catch(error){
    return false;
  }
}

function readBaselineFile({root=defaultRoot(),baselineCommit=BASELINE_COMMIT,file}={}){
  return gitBlob(root,`${baselineCommit}:${file}`);
}

function readWorkingFile({root=defaultRoot(),file}={}){
  return fs.readFileSync(path.join(root,file));
}

function readCurrentManifest({root=defaultRoot(),manifestPath=MANIFEST_PATH}={}){
  return JSON.parse(fs.readFileSync(path.join(root,manifestPath),'utf8'));
}

function readBaselineManifest({root=defaultRoot(),baselineCommit=BASELINE_COMMIT,manifestPath=MANIFEST_PATH}={}){
  return JSON.parse(gitBlob(root,`${baselineCommit}:${manifestPath}`).toString('utf8'));
}

// The protected set is the union of the shipped files named by the current
// manifest and by the manifest recorded in the frozen baseline commit. Removing
// a path from the mutable manifest therefore cannot remove it from the freeze.
function protectedPaths(options={}){
  const root=options.root||defaultRoot();
  const baselineCommit=options.baselineCommit||BASELINE_COMMIT;
  const manifestPath=options.manifestPath||MANIFEST_PATH;
  const current=options.readManifest
    ? options.readManifest()
    : readCurrentManifest({root,manifestPath});
  let historical=[];
  try{
    historical=options.readBaselineManifest
      ? options.readBaselineManifest()
      : readBaselineManifest({root,baselineCommit,manifestPath});
  }catch(error){
    historical=[];
  }
  return [...new Set([...current,...historical])].sort();
}

function bytesMatch(expected,actual){
  const a=Buffer.isBuffer(expected)?expected:Buffer.from(expected);
  const b=Buffer.isBuffer(actual)?actual:Buffer.from(actual);
  if(a.equals(b))return true;
  return normalize(a).equals(normalize(b));
}

// Environment-specific artifacts differ from the repository in exactly one file: the rendered
// environment configuration. For a Testing artifact the expected bytes of paws-api-origin.js are
// rendered from config/environments/testing.json AS STORED IN THE FROZEN BASELINE COMMIT, and the
// renderer plus that configuration must themselves be byte-identical to the baseline.
const ENVIRONMENT_FILE='paws-api-origin.js';
const ENVIRONMENT_INPUTS=Object.freeze(['tools/render-environment-config.js','config/environments/production.json','config/environments/testing.json']);

function verifyFreeze(options={}){
  const root=options.root||defaultRoot();
  const baselineCommit=options.baselineCommit||BASELINE_COMMIT;
  const environment=options.environment||'production';
  if(!['production','testing'].includes(environment))throw new Error(`unknown environment ${environment}`);
  if(!options.skipCommitCheck&&!baselineCommitExists(root,baselineCommit)){
    throw new Error(`frozen baseline commit ${baselineCommit} is not available in this repository`);
  }
  const files=options.files||protectedPaths({
    root,
    baselineCommit,
    manifestPath:options.manifestPath,
    readManifest:options.readManifest,
    readBaselineManifest:options.readBaselineManifest
  });
  const readBaselineRaw=options.readBaselineFile||(({file})=>readBaselineFile({root,baselineCommit,file}));
  const readWorking=options.readWorking||(({file})=>readWorkingFile({root,file}));
  const drift=[];
  let readBaseline=readBaselineRaw;
  if(environment==='testing'){
    for(const file of ENVIRONMENT_INPUTS){
      let expected,actual;
      try{expected=readBaselineRaw({root,baselineCommit,file});}catch(error){drift.push({file,reason:'missing-at-baseline'});continue;}
      try{actual=readWorkingFile({root,file});}catch(error){drift.push({file,reason:'missing-in-verified-copy'});continue;}
      if(!bytesMatch(expected,actual))drift.push({file,reason:'content-drift'});
    }
    readBaseline=args=>{
      if(args.file!==ENVIRONMENT_FILE)return readBaselineRaw(args);
      const {render}=require('./render-environment-config');
      const config=JSON.parse(readBaselineRaw({...args,file:'config/environments/testing.json'}).toString('utf8'));
      return Buffer.from(render(config),'utf8');
    };
  }
  for(const file of files){
    let baseline;
    try{
      baseline=readBaseline({root,baselineCommit,file});
    }catch(error){
      drift.push({file,reason:'missing-at-baseline'});
      continue;
    }
    let actual;
    try{
      actual=readWorking({root,baselineCommit,file});
    }catch(error){
      drift.push({file,reason:'missing-in-verified-copy'});
      continue;
    }
    if(!bytesMatch(baseline,actual))drift.push({file,reason:'content-drift'});
  }
  return {
    baselineCommit,
    environment,
    protected:files.length,
    checked:files.length,
    drift,
    ok:drift.length===0
  };
}

module.exports={
  BASELINE_COMMIT,
  ENVIRONMENT_INPUTS,
  MANIFEST_PATH,
  baselineCommitExists,
  bytesMatch,
  normalize,
  protectedPaths,
  readBaselineFile,
  readBaselineManifest,
  readCurrentManifest,
  readWorkingFile,
  sha256Canonical,
  verifyFreeze
};

if(require.main===module){
  const argv=process.argv.slice(2);
  const artifactAt=argv.indexOf('--artifact');
  const baselineAt=argv.indexOf('--baseline');
  const environmentAt=argv.indexOf('--environment');
  const options={};
  if(environmentAt>=0){
    options.environment=argv[environmentAt+1];
    if(!['production','testing'].includes(options.environment)){console.error('--environment must be production or testing');process.exit(1);}
    if(options.environment==='testing'&&artifactAt<0){console.error('--environment testing verifies a built Testing artifact; pass --artifact');process.exit(1);}
  }
  if(baselineAt>=0&&argv[baselineAt+1]){
    options.baselineCommit=argv[baselineAt+1];
    if(options.baselineCommit!==BASELINE_COMMIT){
      console.error(`refusing to use baseline ${options.baselineCommit}: the frozen baseline is ${BASELINE_COMMIT}`);
      process.exit(1);
    }
  }
  if(artifactAt>=0){
    const artifact=path.resolve(argv[artifactAt+1]||'');
    // Frozen artifact verification checks every shipped static asset via protectedPaths().
    // The retired Azure SWA routing config was never a shipped Firebase manifest asset.
    if(!fs.existsSync(artifact)||!fs.statSync(artifact).isDirectory()){
      console.error(`frozen artifact check failed: ${artifact} is not a directory`);
      process.exit(1);
    }
    options.readWorking=({file})=>fs.readFileSync(path.join(artifact,file));
  }
  const result=verifyFreeze(options);
  if(!result.ok){
    console.error('frozen Azure beta baseline check FAILED');
    console.error(JSON.stringify(result,null,2));
    process.exit(1);
  }
  console.log(JSON.stringify({
    ok:true,
    baselineCommit:result.baselineCommit,
    environment:result.environment,
    protected:result.protected
  }));
}
