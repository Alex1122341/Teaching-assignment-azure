(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PAWS_ACTIVITY_IMPORT=api;})(typeof window==='undefined'?null:window,function(root){
 'use strict';
 const SOURCE='4FDB517FE0B6CDF26678643E6B606D9F8388701AAF7EA540206BEF8A5733E2DF';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const year=date=>{const value=String(date||'');return Number(value.slice(0,4))-(value.slice(5,7)<'05'?1:0);};
 async function hashFile(bytes){const digest=await (root?.crypto||globalThis.crypto).subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('').toUpperCase();}
 function base64(bytes){if(typeof Buffer!=='undefined')return Buffer.from(bytes).toString('base64');let text='';const array=new Uint8Array(bytes);for(let index=0;index<array.length;index+=32768)text+=String.fromCharCode(...array.subarray(index,index+32768));return btoa(text);}
 function createController({api,host,notify=()=>{},onCommitted=()=>{},hashFile:hash=hashFile,randomUUID=()=> (root?.crypto||globalThis.crypto).randomUUID(),getUser=()=>root?.firebase?.auth?.().currentUser}){
  let generation=0,gates={},preview=null,busy=false,stale=false,message='',receipt=null,commitKey=null,stageKey=null,sourceFile=null,initialized=false,initializedUid='';
  const user=()=>String(getUser()?.uid||''),current=(token,uid)=>token===generation&&uid===user();
  function render(){
   const counts=preview?.counts||{},cross=(preview?.items||[]).filter(row=>row.startDate&&row.endDate&&year(row.startDate)!==year(row.endDate)).length;
   const expired=preview?.expiresAtUtc&&Date.parse(preview.expiresAtUtc)<=Date.now();
   host.innerHTML=`<section class="activity-import"><header><span class="activity-eyebrow">REVIEWED SOURCE IMPORT</span><h3>Move work activities into Calendar</h3></header><p>University travel, vacation, RSL, leave and OPA remain in AFC. Only exact matched work records are moved.</p><label class="activity-file-label">Approved AFC workbook<input type="file" accept=".xlsx" data-activity-file ${busy||gates.calendarActivityStage!==true?'disabled':''}></label><p class="activity-note">Maximum 512 KiB. The approved source hash is checked again by the server.</p>${gates.calendarActivityStage!==true?'<p class="activity-notice">Import staging is currently disabled.</p>':''}${message?`<p role="status" class="activity-notice">${esc(message)}</p>`:''}${preview?`<div class="activity-preview-stats"><span><strong>${Number(counts.accepted)||0}</strong> Matched work records</span><span><strong>${Number(counts.retained)||0}</strong> Preserved AFC</span><span><strong>${Number(counts.excluded)||0}</strong> Departed / excluded</span><span><strong>${Number(counts.quarantined)||0}</strong> Quarantined</span></div><p>Original dates: <strong>${esc(preview.startDate||'Not provided')} to ${esc(preview.endDate||'Not provided')}</strong> · ${cross} cross-academic-year ranges</p><p class="activity-note">Preview version ${esc(preview.previewVersion)} · expires ${esc(preview.expiresAtUtc||'Not provided')}</p><div class="activity-table-wrap activity-preview-rows"><table class="activity-table"><thead><tr><th>Source row</th><th>Faculty</th><th>Original dates</th><th>Treatment</th><th>Exact targets / issues</th></tr></thead><tbody>${(preview.items||[]).map(row=>`<tr><td>${esc(row.sourceRow)}</td><td>${esc(row.displayName||'Not provided')}</td><td>${esc(row.startDate||'Not provided')} to ${esc(row.endDate||'Not provided')}</td><td>${esc(({accepted:'Move matched work',retained:'Preserved in AFC',excluded:'Departed / excluded',quarantined:'Quarantined — no change'})[row.status]||'Quarantined — no change')}</td><td>${row.status==='accepted'?esc(row.targetCount):esc((row.issues||[]).join(', ')||'No change')}</td></tr>`).join('')}</tbody></table></div><div class="activity-import-confirm"><label><input type="checkbox" data-activity-confirm ${busy||stale||expired||receipt?'disabled':''}> I confirm moving ${Number(counts.accepted)||0} matched work records into Calendar and permanently deleting only their exact AFC counterparts. Other rows stay unchanged.</label></div><div class="activity-import-actions"><button type="button" data-activity-refresh ${busy||receipt||gates.calendarActivityStage!==true?'disabled':''}>Refresh preview</button><button type="button" class="btn btn-primary" data-activity-commit ${busy||stale||expired||receipt||!counts.accepted||gates.calendarActivityCommit!==true?'disabled':''}>${busy?'Working…':receipt?'Import completed':'Confirm exact migration'}</button></div>${gates.calendarActivityCommit!==true?'<p class="activity-notice">Migration commit is currently disabled.</p>':''}`:''}</section>`;
   const file=host.querySelector('[data-activity-file]');if(file)file.onchange=()=>stageFile(file.files?.[0]);
   const refresh=host.querySelector('[data-activity-refresh]');if(refresh)refresh.onclick=refreshPreview;
   const button=host.querySelector('[data-activity-commit]'),confirmation=host.querySelector('[data-activity-confirm]');
   if(button){button.disabled=true;button.onclick=()=>commit(confirmation?.checked===true);}
   if(confirmation)confirmation.onchange=()=>{if(button)button.disabled=confirmation.checked!==true||busy||stale||expired||receipt!==null||!counts.accepted||gates.calendarActivityCommit!==true;};
  }
  async function open(){const uid=user();if(initialized&&uid===initializedUid){render();return;}if(initializedUid!==uid)clear();const token=++generation;try{const result=await api.calendarActivityCapabilities();if(!current(token,uid))return;gates=result.writeCapabilities||{};initialized=true;initializedUid=uid;render();}catch(error){if(current(token,uid)){message=error.message||'Activity import is unavailable.';gates={};render();}}}
  async function stageFile(file){
   if(busy||gates.calendarActivityStage!==true||!file)return;
   const token=generation,uid=user();busy=true;preview=null;receipt=null;commitKey=null;stale=false;message='Validating approved workbook…';render();
   try{
    if(!/\.xlsx$/i.test(file.name)||file.size<1||file.size>524288)throw Error('Choose the approved .xlsx workbook, up to 512 KiB.');
    const bytes=await file.arrayBuffer();if(bytes.byteLength!==file.size||bytes.byteLength>524288)throw Error('Workbook size changed. Select the file again.');
    const sourceSha256=(await hash(bytes)).toUpperCase();if(sourceSha256!==SOURCE)throw Error('This workbook does not match the approved source version.');
    if(!current(token,uid))return;
    if(sourceFile!==file){stageKey=randomUUID();sourceFile=file;}
    const result=await api.stageCalendarActivityImport({requestId:stageKey,sourceSha256,fileName:file.name,fileBase64:base64(bytes)});if(!current(token,uid))return;
    preview=result;receipt=null;commitKey=randomUUID();stale=false;message='Preview ready. Review every treatment before confirming.';
   }catch(error){if(current(token,uid)){message=error.message||'Workbook staging failed.';notify(message,true);}}
   finally{if(current(token,uid)){busy=false;render();}}
  }
  async function refreshPreview(){if(busy||!preview||receipt||gates.calendarActivityStage!==true)return;const token=generation,uid=user();busy=true;render();try{const result=await api.previewCalendarActivityImport(preview.batchId,{expectedVersion:preview.previewVersion});if(current(token,uid)){preview=result;stale=false;commitKey=randomUUID();message='Preview refreshed. Review and confirm again.';}}catch(error){if(current(token,uid))message=error.message||'Preview could not be refreshed.';}finally{if(current(token,uid)){busy=false;render();}}}
  async function commit(confirmed){
   if(confirmed!==true||busy||stale||receipt||!preview||!preview.counts?.accepted||gates.calendarActivityCommit!==true)return;
   const token=generation,uid=user();busy=true;message='Applying the exact confirmed migration…';render();
   try{const result=await api.commitCalendarActivityImport(preview.batchId,{expectedVersion:preview.previewVersion,manifestSha256:preview.manifestSha256,sourceSha256:preview.sourceSha256,idempotencyKey:commitKey,confirm:true});if(!current(token,uid))return;receipt=result;message=`Completed: ${Number(result.insertedCount)||0} Calendar activities, ${Number(result.deletedAfcCount)||0} exact AFC counterparts removed.`;await onCommitted(result);}
   catch(error){if(current(token,uid)){stale=error.status===409;message=stale?'The preview changed or expired. Refresh it before confirming again.':(error.message||'Response unavailable. Retry with the same request key.');notify(message,true);}}
   finally{if(current(token,uid)){busy=false;render();}}
  }
  function clear(){generation++;preview=null;receipt=null;sourceFile=null;commitKey=null;stageKey=null;busy=false;stale=false;gates={};message='';initialized=false;initializedUid='';host.innerHTML='';}
  return Object.freeze({open,stageFile,refreshPreview,commit,clear});
 }
 function createAdminEntry(options){let controller=null;return Object.freeze({open(){const host=options.host;if(!host)return;const authorized=options.canAdmin();host.classList.toggle('hidden',!authorized);if(!authorized){controller?.clear();return;}if(!controller)controller=createController(options);return controller.open();},clear(){controller?.clear();options.host?.classList.add('hidden');}});}
 return {createController,createAdminEntry};
});
