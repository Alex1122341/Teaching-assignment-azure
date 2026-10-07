(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const text = value => String(value ?? '').trim();
  const collections = [
    ['rules','DOE Rules · Rule Book','Rules are stored as relational Rule, Selector, Parameter, Tier, and Required Input rows. Each rule keeps its declared facts and calculation configuration.'],
    ['references','Structured References','Authoritative source title, section, table, page, effective date, source link, and notes.'],
    ['courseMappings','Course Mapping','Canonical course code and approved unit/stage/HICC facts. Missing units remain missing.'],
    ['subjectMappings','VISC Subjects','Canonical Subject keys and annual stage/development facts; Topic text is not a Subject.'],
    ['exceptions','Approved Exceptions','Scoped annual exceptions with explicit source evidence and review status.']
  ];
  function create({api, getAcademicYear, canAdmin=()=>false, canPublish=()=>false, canRecalculate=()=>false}={}) {
    if(!api) throw new TypeError('The authenticated PAWS data client is required.');
    let host=null, policy=null, history=[];
    const node=(id)=>host?.querySelector(`#${id}`);
    const say=(message,error=false)=>{const target=node('doe-policy-status');if(target){target.textContent=message;target.classList.toggle('error',error);}};
    const currentYear=()=>text(node('doe-policy-year')?.value || getAcademicYear?.());
    const currentId=()=>text(policy?.version?.policyVersionId);
    const revision=()=>Number(policy?.version?.revision||0);
    const asJson=(value)=>JSON.stringify(value??[],null,2);
    function render(){
      if(!host)return;
      const version=policy?.version||{}, draft=text(version.status).toLowerCase()==='draft';
      node('doe-policy-version-label').value=version.versionLabel||'';
      node('doe-policy-source').value=version.sourceReference||'';
      node('doe-policy-meta').textContent=policy?`${version.status||'unknown'} · ${version.academicYear||'year unavailable'} · revision ${revision()} · ${version.policyVersionId}`:'No policy selected.';
      for(const [key] of collections){const input=node(`doe-policy-${key}`);if(input)input.value=asJson(policy?.[key]);}
      const reserve=node('doe-policy-reserve');if(reserve)reserve.value=JSON.stringify(policy?.reservePolicy||{},null,2);
      host.querySelectorAll('[data-draft-only]').forEach(button=>button.disabled=!draft||!canAdmin());
      const publish=node('doe-policy-publish');if(publish){const validated=Number(version.validatedRevision)===revision(),impacted=Number(version.impactRevision)===revision();publish.disabled=!draft||!validated||!impacted||!canPublish();publish.title=publish.disabled&&draft?'Validate and run Impact Preview for this exact Draft revision before publishing.':'';}
      const archive=node('doe-policy-archive');if(archive)archive.disabled=!draft||!canPublish();
      const recalc=node('doe-policy-recalculate');if(recalc)recalc.disabled=!canRecalculate();
      node('doe-policy-new-draft').disabled=!canAdmin();
      node('doe-policy-copy').disabled=!canAdmin();
      node('doe-policy-save').disabled=!draft||!canAdmin();
      node('doe-policy-validate').disabled=!draft||!canAdmin();
      node('doe-policy-impact').disabled=!draft||!canAdmin();
    }
    function mount(root){
      host=root;
      host.innerHTML=`<div class="section doe-policy-header"><div><div class="section-title">Annual DOE Rule Book</div><p class="aux-note">Normalized annual policy lifecycle · server-authoritative preview · VetMed-Ops SQL. Draft edits are revision-checked. Publishing and recalculation remain separately gated.</p></div><div class="doe-policy-meta" id="doe-policy-meta">No policy selected.</div></div>
        <div class="doe-policy-toolbar"><label class="field"><span class="field-label">Academic Year</span><input class="input" id="doe-policy-year" value="${esc(text(getAcademicYear?.()))}" placeholder="2026-27"></label><label class="field"><span class="field-label">Policy Version</span><select class="select" id="doe-policy-history"><option value="">Select a policy version…</option></select></label><button class="btn" type="button" id="doe-policy-history-load">History</button><button class="btn" type="button" id="doe-policy-load-active">Load Active</button></div>
        <div class="doe-policy-toolbar"><label class="field"><span class="field-label">Version Label</span><input class="input" id="doe-policy-version-label" maxlength="128"></label><label class="field"><span class="field-label">Source / Provenance</span><input class="input" id="doe-policy-source" maxlength="1000" placeholder="UCVM Workload Guidelines, effective date…"></label><button class="btn" type="button" id="doe-policy-new-draft">New Policy Year</button><button class="btn" type="button" id="doe-policy-copy">Copy from Previous Year</button></div>
        <nav class="doe-policy-sections" aria-label="DOE Rule Book sections">${collections.map(([key,label])=>`<a href="#doe-policy-section-${key}">${esc(label.split(' · ')[0])}</a>`).join('')}<a href="#doe-policy-section-reserve">Reserve Logic</a><a href="#doe-policy-section-preview">Preview &amp; Validate</a><a href="#doe-policy-section-history">History</a><a href="#doe-policy-section-actions">Actions</a></nav>
        <div class="doe-policy-fields">${collections.map(([key,label,help])=>`<section class="section wide doe-policy-editor" id="doe-policy-section-${key}"><div class="section-title">${esc(label)}</div><p class="aux-note">${esc(help)}</p><label class="field"><span class="field-label">${esc(label)} normalized rows</span><textarea class="input doe-policy-json" id="doe-policy-${key}" rows="7" spellcheck="false" aria-label="${esc(label)} normalized rows"></textarea></label></section>`).join('')}
          <section class="section wide doe-policy-editor" id="doe-policy-section-reserve"><div class="section-title">Reserve Logic</div><p class="aux-note">These parameters are stored on the normalized Reserve rule and are required for authoritative reserve calculations. Do not substitute manual Reserve DOE.</p><label class="field"><span class="field-label">Reserve parameters</span><textarea class="input doe-policy-json" id="doe-policy-reserve" rows="5" spellcheck="false" aria-label="Reserve policy parameters"></textarea></label></section></div>
        <section class="section wide" id="doe-policy-section-preview"><div class="section-title">Preview &amp; Validate</div><div class="form-actions"><button class="btn" id="doe-policy-save" data-draft-only type="button">Save Draft</button><button class="btn" id="doe-policy-validate" data-draft-only type="button">Validate Rule Book</button><button class="btn" id="doe-policy-impact" data-draft-only type="button">Impact Preview</button></div><pre class="doe-policy-result" id="doe-policy-result" aria-live="polite"></pre></section>
        <section class="section wide" id="doe-policy-section-history"><div class="section-title">History</div><div id="doe-policy-history-list" class="doe-policy-history-list"><div class="empty">Load History for this Academic Year.</div></div></section>
        <section class="section wide" id="doe-policy-section-actions"><div class="section-title">Actions</div><div class="form-actions"><button class="btn btn-primary" id="doe-policy-publish" type="button">Publish</button><button class="btn" id="doe-policy-archive" type="button">Archive Draft</button><label class="field"><span class="field-label">Recalculate batch size (max 250)</span><input class="input" id="doe-policy-limit" type="number" min="1" max="250" value="100"></label><button class="btn" id="doe-policy-recalculate" type="button">Recalculate</button><span id="doe-policy-status" class="toolbar-note" role="status" aria-live="polite"></span></div></section>`;
      node('doe-policy-year').addEventListener('change',()=>{policy=null;render();});
      node('doe-policy-load-active').addEventListener('click',async()=>{try{policy=await api.doeActivePolicy({academicYear:currentYear()});render();say('Active Rule Book loaded.');}catch(e){say(e.message||'Active Rule Book could not load.',true);}});
      node('doe-policy-history-load').addEventListener('click',loadHistory);
      node('doe-policy-history').addEventListener('change',async()=>{const id=node('doe-policy-history').value;if(!id)return;try{policy=await api.doePolicyVersion({policyVersionId:id});render();say('Policy version loaded.');}catch(e){say(e.message||'Policy version could not load.',true);}});
      node('doe-policy-new-draft').addEventListener('click',async()=>{if(!canAdmin())return say('DOE Draft writes are disabled.',true);try{policy=await api.createDoePolicyDraft({academicYear:currentYear(),versionLabel:text(node('doe-policy-version-label').value),sourceReference:text(node('doe-policy-source').value)});render();await loadHistory();say('Draft created. Add normalized Rule Book rows and Save Draft.');}catch(e){say(e.message||'Draft could not be created.',true);}});
      node('doe-policy-copy').addEventListener('click',async()=>{if(!canAdmin())return say('DOE Draft writes are disabled.',true);const sourcePolicyVersionId=currentId()||node('doe-policy-history').value;if(!sourcePolicyVersionId)return say('Load the previous year Active policy first.',true);try{policy=await api.copyDoePolicy({sourcePolicyVersionId,academicYear:currentYear()});render();await loadHistory();say('Copied to a new Draft. The source version remains unchanged.');}catch(e){say(e.message||'Rule Book copy failed.',true);}});
      node('doe-policy-save').addEventListener('click',saveDraft);
      node('doe-policy-validate').addEventListener('click',async()=>{try{const result=await api.validateDoePolicyDraft(currentId(),{expectedRevision:revision()});node('doe-policy-result').textContent=JSON.stringify(result,null,2);say(result.valid?'Rule Book validation passed.':'Rule Book validation found issues.',!result.valid);policy=await api.doePolicyVersion({policyVersionId:currentId()});render();}catch(e){say(e.message||'Validation failed.',true);}});
      node('doe-policy-impact').addEventListener('click',async()=>{try{const result=await api.previewDoePolicyImpact(currentId(),{expectedRevision:revision()});node('doe-policy-result').textContent=JSON.stringify(result,null,2);say('Impact Preview recorded without changing current calculations.');policy=await api.doePolicyVersion({policyVersionId:currentId()});render();}catch(e){say(e.message||'Impact Preview failed.',true);}});
      node('doe-policy-publish').addEventListener('click',async()=>{if(!canPublish())return say('Policy publishing is disabled.',true);try{const result=await api.publishDoePolicyDraft(currentId(),{expectedRevision:revision()});node('doe-policy-result').textContent=JSON.stringify(result,null,2);policy=await api.doePolicyVersion({policyVersionId:currentId()});render();await loadHistory();say('Policy published.');}catch(e){say(e.message||'Policy publish failed.',true);}});
      node('doe-policy-archive').addEventListener('click',async()=>{if(!canPublish())return say('Policy archive is disabled.',true);try{policy=await api.archiveDoePolicy(currentId(),{expectedRevision:revision()});render();await loadHistory();say('Draft archived.');}catch(e){say(e.message||'Draft archive failed.',true);}});
      node('doe-policy-recalculate').addEventListener('click',async()=>{if(!canRecalculate())return say('Recalculation is disabled.',true);try{const result=await api.recalculateDoe({academicYear:currentYear(),limit:Number(node('doe-policy-limit').value)});node('doe-policy-result').textContent=JSON.stringify(result,null,2);say(`Recalculation created ${result.recordsCreated||0} records; ${result.remaining||0} remain.`);}catch(e){say(e.message||'Recalculation failed.',true);}});
      render();
    }
    async function saveDraft(){
      if(!policy||!currentId())return say('Load or create a Draft before saving.',true);
      const patch={versionLabel:text(node('doe-policy-version-label').value),sourceReference:text(node('doe-policy-source').value)};
      try{
        for(const [key] of collections){const value=JSON.parse(node(`doe-policy-${key}`).value||'[]');if(!Array.isArray(value))throw new Error(`${key} must be a JSON array.`);patch[key]=value;}
        const reserve=JSON.parse(node('doe-policy-reserve').value||'{}');if(!reserve||typeof reserve!=='object'||Array.isArray(reserve))throw new Error('Reserve parameters must be a JSON object.');patch.reservePolicy=reserve;
        policy=await api.saveDoePolicyDraft(currentId(),{expectedRevision:revision(),patch});
        if(policy.version)policy.version={...policy.version};
        await loadHistory();render();say('Draft saved. Validate again before Impact Preview and Publish.');
      }catch(e){say(e.message||'Draft JSON is invalid or could not be saved.',true);}
    }
    async function loadHistory(){try{history=await api.doePolicyHistory({academicYear:currentYear()});node('doe-policy-history').innerHTML='<option value="">Select a policy version…</option>'+history.map(row=>`<option value="${esc(row.policyVersionId)}">${esc(row.versionLabel||row.policyVersionId)} · ${esc(row.status)} · r${Number(row.revision)||0}</option>`).join('');node('doe-policy-history-list').innerHTML=history.map(row=>`<button class="btn btn-small" type="button" data-policy-history-id="${esc(row.policyVersionId)}">${esc(row.versionLabel||row.policyVersionId)} · ${esc(row.status)} · r${Number(row.revision)||0}${row.publishedAtUtc?` · published ${esc(row.publishedAtUtc)}`:''}</button>`).join('')||'<div class="empty">No policy versions recorded for this Academic Year.</div>';node('doe-policy-history-list').querySelectorAll('[data-policy-history-id]').forEach(button=>button.addEventListener('click',()=>{node('doe-policy-history').value=button.dataset.policyHistoryId;node('doe-policy-history').dispatchEvent(new Event('change'));}));}catch(e){say(e.message||'Policy history could not load.',true);}}
    return Object.freeze({mount,loadHistory});
  }
  window.UCVM_FACULTY_DOE_POLICY=Object.freeze({create});
})();
