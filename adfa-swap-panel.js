(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PAWS_ADFA_SWAP=api;
})(typeof window==='object'?window:this,function(){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const percent=value=>typeof value==='number'&&Number.isFinite(value)?value.toFixed(2)+'%':'Not provided';
  const delta=value=>typeof value==='number'&&Number.isFinite(value)?`Change ${value>0?'+':''}${value.toFixed(2)} percentage points`:'Change not provided';
  const doe=value=>value?.status==='calculated'?percent(value.currentDoe):'Needs Review';
  function createController({host,api,session,assignments,candidates,isCurrent=()=>true,onSelect=()=>{},onReload=()=>{}}){
    let assignment='',outgoing=null,rows=new Map(),generation=0,selected='',selectionVersion=0,query='',page=0,previewError='';
    const matching=()=>outgoing&&assignments.some(row=>row.assignmentId===assignment&&row.canReplace===true)?candidates.filter(row=>String(row.displayName||'').toLowerCase().includes(query.toLowerCase())):[];
    const visible=()=>matching().slice(page*6,page*6+6);
    const valid=token=>generation===token&&isCurrent();
    const read=candidateKey=>api.swapFacultyPreview({sessionId:session.sessionId,assignmentId:assignment,snapshotToken:session.snapshotToken,...(candidateKey?{candidateKey}:{})});
    function clearSelection(){selected='';selectionVersion++;onSelect('');if(outgoing?.outgoing)outgoing={...outgoing,outgoing:{...outgoing.outgoing,projected:null,deltaDoe:null}};}
    function failPreview(error){
      previewError=error?.status===409?'The session changed. Reload the session before checking again.':error?.status===401||error?.status===403?'Your permission must be checked again. Reload the session.':'The preview service is unavailable. Try Check availability again.';
      clearSelection();outgoing=null;rows=new Map();generation++;
    }
    function render(){
      if(!isCurrent())return;
      const info=outgoing?.assignment;
      const searchFocused=typeof document==='object'&&document.activeElement===host.querySelector('[data-adfa-search]');
      host.innerHTML=`<section class="adfa-swap-current"><h3>Current assignment being removed</h3>${info?`<strong>${esc(info.displayName)}</strong><span>Role: ${esc(info.teachingRole||'Not provided')}</span><span>Persisted DOE credit: <b>${percent(info.persistedDoeCredit)}</b></span><span>Current DOE: <b>${doe(outgoing.outgoing?.current)}</b></span>${outgoing.outgoing?.projected?`<span>Projected DOE: <b>${doe(outgoing.outgoing.projected)}</b> · ${delta(outgoing.outgoing.deltaDoe)}</span>`:''}`:'Select a current faculty assignment to preview.'}</section><div class="adfa-swap-heading"><h3>Find replacement faculty</h3><button type="button" data-adfa-refresh>Check availability</button></div><label class="sql-swap-field"><span>Search faculty name</span><input data-adfa-search type="search" value="${esc(query)}" placeholder="Search faculty name…"></label>${selected?`<p class="adfa-swap-selection" role="status">Selected replacement: <strong>${esc(candidates.find(row=>row.candidateKey===selected)?.displayName)}</strong>. Submit the request below for approval. <button type="button" data-adfa-clear>Clear selection</button></p>`:''}<p class="sql-swap-muted">Checks AFC, live teaching and Calendar work activities for the saved session. Missing time is Needs Review. DOE values come from the server; preview does not change an assignment.</p><div class="adfa-swap-table-wrap"><table class="adfa-swap-table"><thead><tr><th>Faculty</th><th>Availability</th><th>Current DOE</th><th>Projected DOE</th><th>Action</th></tr></thead><tbody>${visible().map(candidate=>{
        const item=rows.get(candidate.candidateKey),value=item?.preview,status=value?.availability?.status||'Checking…';
        return `<tr class="${selected===candidate.candidateKey?'adfa-swap-selected':''}"><td><strong>${esc(candidate.displayName)}</strong></td><td><span class="adfa-swap-status" data-adfa-status="${esc(status)}">${esc(item?.error?'Check unavailable':status)}</span>${(value?.availability?.conflicts||[]).map(row=>`<small>${esc(row.courseCode)} · ${esc(String(row.startTime||'').slice(0,5))}–${esc(String(row.endTime||'').slice(0,5))}</small>`).join('')}</td><td>${value?doe(value.incoming?.current):item?.error?'Preview unavailable':'Loading…'}</td><td>${value?doe(value.incoming?.projected):item?.error?'Preview unavailable':'Loading…'}${value?`<small>${delta(value.incoming?.deltaDoe)}</small><small>Target ${percent(value.incoming?.projected?.targetDoe)} · Remaining ${percent(value.incoming?.projected?.remainingDoe)}</small>`:''}</td><td><button type="button" data-adfa-select="${esc(candidate.candidateKey)}" aria-pressed="${selected===candidate.candidateKey}" ${!value||!['Available','Unavailable'].includes(status)?'disabled':''}>${selected===candidate.candidateKey?'Selected':'SWAP'}</button></td></tr>`;
      }).join('')||'<tr><td colspan="5">No matching faculty.</td></tr>'}</tbody></table></div><div class="adfa-swap-pager"><button type="button" data-adfa-prev ${page===0?'disabled':''}>Previous</button><span>${matching().length?`${page*6+1}–${Math.min(page*6+6,matching().length)} of ${matching().length}`:'0 results'}</span><button type="button" data-adfa-next ${(page+1)*6>=matching().length?'disabled':''}>Next</button></div>`;
      if(previewError)host.innerHTML=`<p class="sql-swap-warning" role="alert">${esc(previewError)} <button type="button" data-adfa-reload>Reload session</button></p>`+host.innerHTML;
      const reload=host.querySelector('[data-adfa-reload]');if(reload)reload.onclick=onReload;
      const refresh=host.querySelector('[data-adfa-refresh]');if(refresh)refresh.onclick=()=>open(assignment);
      const search=host.querySelector('[data-adfa-search]');if(search){search.oninput=event=>filter(event.target.value);if(searchFocused){search.focus?.();search.setSelectionRange?.(query.length,query.length);}}
      const previous=host.querySelector('[data-adfa-prev]'),next=host.querySelector('[data-adfa-next]');if(previous)previous.onclick=()=>filter(query,page-1);if(next)next.onclick=()=>filter(query,page+1);
      const clear=host.querySelector('[data-adfa-clear]');if(clear)clear.onclick=()=>{clearSelection();render();};
      host.onclick=event=>{const button=event.target.closest?.('[data-adfa-select]');if(button&&!button.disabled)select(button.dataset.adfaSelect);};
    }
    async function open(id){
      assignment=id;outgoing=null;rows=new Map();previewError='';clearSelection();const token=++generation;render();
      if(!assignments.some(row=>row.assignmentId===id&&row.canReplace===true))return;
      try{const value=await read();if(!valid(token))return;outgoing=value;render();}catch(error){if(valid(token)){failPreview(error);render();}return;}
      await loadVisible(token);
    }
    async function loadVisible(token){
      for(const candidate of visible()){
        if(!valid(token))return;
        if(rows.has(candidate.candidateKey))continue;
        try{const preview=await read(candidate.candidateKey);if(!valid(token))return;rows.set(candidate.candidateKey,{preview});}
        catch(error){if(!valid(token))return;if([401,403,409].includes(error?.status)){failPreview(error);render();return;}rows.set(candidate.candidateKey,{error});}
        render();
      }
    }
    async function filter(value,pageNumber=0){if(!outgoing)return;query=String(value||'').slice(0,120);page=Math.max(0,Math.min(Number.isInteger(pageNumber)?pageNumber:0,Math.max(0,Math.ceil(matching().length/6)-1)));const token=++generation;render();if(assignment)await loadVisible(token);}
    async function select(key){
      if(!isCurrent()||!outgoing||!candidates.some(row=>row.candidateKey===key)||!assignment)return false;
      const token=generation,pick=++selectionVersion;
      try{
        const preview=await read(key);if(!valid(token)||pick!==selectionVersion)return false;
        rows.set(key,{preview});
        if(!['Available','Unavailable'].includes(preview.availability?.status)){clearSelection();render();return false;}
        selected=key;outgoing=preview;onSelect(key,preview);render();return true;
      }catch(error){if(valid(token)&&pick===selectionVersion){if([401,403,409].includes(error?.status))failPreview(error);else{rows.set(key,{error});clearSelection();}render();}return false;}
    }
    async function verifySelection(key){if(!key)return true;if(selected!==key)return false;return select(key);}
    return Object.freeze({open,select,verifySelection,filter});
  }
  return Object.freeze({createController});
});
