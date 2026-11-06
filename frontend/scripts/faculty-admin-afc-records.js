(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.UCVM_AFC_RECORDS=api;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text=value=>String(value??'').trim();
  const norm=value=>String(value??'').trim().toLowerCase();
  const unconfirmedMessage='Save unconfirmed. Check the AFC list before reloading or submitting again.';
  const doeCategories = ['teaching', 'service', 'research'];
  const yearsForLeave = (start='', end='') => {
    const startYear = Number(start.slice(0,4)) - (start.slice(5,7) < '05' ? 1 : 0);
    const endYear = Number(end.slice(0,4)) - (end.slice(5,7) < '05' ? 1 : 0);
    return /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end &&
      startYear >= 1000 && endYear - startYear <= 10
      ? Array.from({ length:endYear-startYear+1 }, (_, i) => `${startYear+i}-${String((startYear+i+1)%100).padStart(2,'0')}`) : [];
  };
  const amount = value => value == null ? 'Not recorded' : value;
  const allocationInput = (year, values={}, source={}) => `<fieldset data-leave-year="${esc(year)}"><legend>${esc(year)}</legend>
    ${doeCategories.map(category => `<label class="field"><span class="field-label">${category[0].toUpperCase()+category.slice(1)} DOE · contract ${esc(amount(source.doe?.[category]))}</span>
    <input class="input" type="number" step="0.0001" min="0" data-leave-category="${category}" value="${esc(values[category] ?? '')}"></label>`).join('')}</fieldset>`;
  function readDeduction(container) {
    return { fteDeduction:container?.querySelector('[data-leave-fte]')?.value ?? '',
      allocationsByYear:Object.fromEntries(Array.from(container?.querySelectorAll('[data-leave-year]') || [], group =>
        [group.dataset.leaveYear, Object.fromEntries(doeCategories.map(category =>
          [category, group.querySelector('[data-leave-category="'+category+'"]')?.value ?? '']))])) };
  }
  function createLeaveFields(api, $, getUser) {
    const form = $('afc-record-form'), host = $('afc-special-deduction');
    let generation = 0, lastFaculty = '';
    const active = () => api.afcSpecialLeaveEnabled?.() === true && $('afc-reason')?.value === 'special';
    async function refresh() {
      if (!host) return;
      const request = ++generation, uid = getUser?.()?.uid;
      const available = active() && $('afc-special-availability')?.value === 'available';
      $('afc-special-options')?.classList.toggle('hidden', !active());
      host.classList.toggle('hidden', !available);
      if (!available) return;
      const facultyId = $('afc-faculty')?.value;
      const years = yearsForLeave(text($('afc-start-date')?.value), text($('afc-end-date')?.value));
      const previous = facultyId === lastFaculty ? readDeduction(host).allocationsByYear : {};
      if (facultyId !== lastFaculty && host.querySelector('[data-leave-fte]')) host.querySelector('[data-leave-fte]').value = '';
      lastFaculty = facultyId;
      const sources = $('afc-special-years');
      if (!facultyId || !years.length) { sources.innerHTML = '<p class="aux-note">Select a faculty member and valid leave dates.</p>'; return; }
      sources.textContent = 'Loading recorded contract FTE and DOE…';
      try {
        const values = await Promise.all(years.map(year => api.specialLeaveSource(facultyId, year)));
        if (request !== generation || getUser?.()?.uid !== uid) return;
        const missing = values.some(source => source.fte == null || doeCategories.some(category => source.doe?.[category] == null));
        sources.innerHTML = `<p class="aux-note">Contract FTE ${esc(amount(values[0]?.fte))} · DOE deductions must add up to FTE deduction × 100.${missing ? ' Missing source data leaves the deduction pending for administrator review.' : ''}</p>` +
          years.map((year, index) => allocationInput(year, previous[year] || previous[years[index-1]], values[index])).join('');
      } catch {
        if (request === generation && getUser?.()?.uid === uid) sources.textContent = 'Contract data could not be loaded. Review the faculty and dates before saving.';
      }
    }
    form?.addEventListener?.('change', event => {
      if (['afc-reason','afc-special-availability','afc-faculty','afc-start-date','afc-end-date'].includes(event.target.id)) refresh();
    });
    form?.addEventListener?.('input', event => {
      const field = event.target;
      const group = field.closest?.('[data-leave-year]');
      if (!group || !field.dataset.leaveCategory) return;
      const following = Array.from(host.querySelectorAll('[data-leave-year]'));
      for (const other of following.slice(following.indexOf(group)+1)) {
        const input = other.querySelector('[data-leave-category="'+field.dataset.leaveCategory+'"]');
        if (input.value === '') input.value = field.value;
      }
    });
    return {
      refresh,
      values: () => active() && $('afc-special-availability')?.value === 'available'
        ? { availability:'available', specialLeave:readDeduction(host) } : {}
    };
  }
  function updateWriteControls(api, $, afcSubmitInFlight, unconfirmed=false) {
    const single = api.afcSingleWriteEnabled?.() === true;
    const batch = api.afcBatchWriteEnabled?.() === true;
    $('afc-special-options')?.classList.toggle('hidden', api.afcSpecialLeaveEnabled?.() !== true || $('afc-reason')?.value !== 'special');
    if ($('afc-submit')) $('afc-submit').disabled = !single || afcSubmitInFlight || unconfirmed;
    if ($('afc-form-status')) $('afc-form-status').textContent = unconfirmed ? unconfirmedMessage : single ? '' : 'AFC creation is unavailable. Your administrator permissions must be verified by the server.';
    if (!batch && $('afc-batch-submit')) $('afc-batch-submit').disabled = true;
    if ($('afc-batch-status')) $('afc-batch-status').textContent = batch ? '' : 'AFC batch creation is unavailable. Your administrator permissions must be verified by the server.';
  }
  function createSingleActions({api,$,reasonLabels,normalizeDate,isBusy,setBusy,refreshRecords,refreshDashboard,attachment=null,getUser=null}) {
    let unconfirmed=false;
    const leave = createLeaveFields(api, $, getUser);
    if (typeof document !== 'undefined') document.addEventListener?.('change', event => {
      const date = event.target?.matches?.('[data-leave-as-of]') ? event.target : null;
      if (date) showEffectiveLeave(api, date);
    });
    function status(message,error=false) {
      const node=$('afc-form-status');if(!node)return;
      node.textContent=message;node.classList.toggle('error',error);
    }
    function values() {
      return {facultyId:text($('afc-faculty')?.value),startDate:text($('afc-start-date')?.value),endDate:text($('afc-end-date')?.value),reasonCode:text($('afc-reason')?.value),notes:text($('afc-notes')?.value),...leave.values()};
    }
    function validate(input) {
      if(!input.facultyId)return 'Select an active faculty member.';
      const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!normalizeDate(value,'Date').error;
      if(!validDate(input.startDate)||!validDate(input.endDate))return 'Enter valid start and end dates.';
      if(input.endDate<input.startDate)return 'End date cannot be before start date.';
      if(!Object.prototype.hasOwnProperty.call(reasonLabels,input.reasonCode))return 'Select a recognised AFC reason.';
      if((input.reasonCode==='special'||input.reasonCode==='other')&&!input.notes)return 'Notes are required for Special and Other reasons.';
      if(input.notes.length>1000)return 'Notes must be 1,000 characters or fewer.';
      if(input.availability==='available' && (!input.specialLeave.fteDeduction ||
        yearsForLeave(input.startDate,input.endDate).some(year => !input.specialLeave.allocationsByYear[year]))) return 'Enter the FTE deduction and wait for the yearly DOE fields to load.';
      return '';
    }
    async function submit(event) {
      event?.preventDefault?.();if(isBusy()||unconfirmed)return;
      const input=values(),error=validate(input);if(error){status(error,true);return;}
      const formSnapshot=JSON.stringify(input),owner=getUser?.()?.uid,current=()=>!getUser||getUser()?.uid===owner;
      const button=$('afc-submit');setBusy(true);if(button){button.disabled=true;button.textContent='Saving…';}
      status('Saving AFC record…');
      let createSent=false;
      try {
        const documentId=await attachment?.prepare(input.facultyId);
        if(!current())return;
        if(JSON.stringify(values())!==formSnapshot)throw Object.assign(Error('AFC fields changed. Review again; any archived PDF remains available.'),{status:409,code:'AFC_CONTEXT_CHANGED'});
        if(documentId)input.documentId=documentId;
        createSent=true;
        const created=await api.createDashboardAfcRecord(input);
        if(!current())return;
        if(!created?.afcRecordId)throw Object.assign(Error('AFC save response incomplete.'),{code:'OUTCOME_UNCONFIRMED'});
        let confirmed=false;
        for(let attempt=0;attempt<2&&!confirmed;attempt++)confirmed=(await refreshRecords())?.some(row=>String(row.afcRecordId)===String(created.afcRecordId)&&(!documentId||row.documentId===documentId));
        if(!current())return;
        if(!confirmed)throw Object.assign(Error('AFC readback incomplete.'),{code:'OUTCOME_UNCONFIRMED'});
        $('afc-record-form')?.reset();leave.refresh();attachment?.clear?.();await attachment?.open?.();await refreshDashboard();status('AFC record created and confirmed in the AFC list.');
      } catch(error) {
        if(!current())return;
        unconfirmed=createSent&&!(error?.code==='WRITE_DISABLED'&&Number(error.status)===503)&&(error?.code==='OUTCOME_UNCONFIRMED'||!Number(error?.status)||Number(error.status)>=500);
        status(unconfirmed?unconfirmedMessage:error?.message||'AFC record could not be created.',true);
      } finally {setBusy(false);if(button){button.disabled=unconfirmed||api.afcSingleWriteEnabled?.()!==true;button.textContent='Create AFC Record';}}
    }
    return {submit,isUnconfirmed:()=>unconfirmed};
  }
  function renderRows(rows,{facultyName,canCancel:allowed=false,canEdit:editAllowed=false,editingKey='',busy=()=>false,renderPdf=()=>'<span class="muted">N/A</span>'}={}) {
    return rows.map(row => {
      const key = `${row.sourceKind}:${row.afcRecordId}`;
      const editable = row.active !== false && /^[0-9a-f]{16}$/i.test(row.versionToken || '');
      const canCancel = allowed && editable;
      const canEdit = editAllowed && editable;
      const leave = row.specialLeave;
      const leaveKey = 'leave:' + key;
      const canApply = canEdit && row.availability === 'available' && !!leave;
      const buttons = [
        canEdit ? `<button class="btn" type="button" data-afc-edit="${esc(key)}" ${busy(key) ? 'disabled' : ''}>Edit dates</button>` : '',
        canApply ? `<button class="btn" type="button" data-afc-edit="${esc(leaveKey)}" ${busy(key) ? 'disabled' : ''}>Edit / Apply DOE</button>` : '',
        canCancel ? `<button class="btn" type="button" data-afc-cancel="${esc(key)}" ${busy(key) ? 'disabled' : ''}>${busy(key) ? 'Withdrawing…' : 'Withdraw'}</button>` : ''
      ].filter(Boolean).join(' ');
      const action = buttons || (row.active === false ? 'Withdrawn' : 'Unavailable');
      // UX-07: the ADFA office changes the dates directly; Change History keeps old and new dates.
      const editor = canEdit && editingKey === key ? `<tr class="afc-date-edit" data-afc-edit-row="${esc(key)}"><td colspan="9"><div class="afc-date-edit-form"><label>New start date<input type="date" data-afc-edit-start value="${esc(row.startDate || '')}"></label><label>New end date<input type="date" data-afc-edit-end value="${esc(row.endDate || '')}"></label><button class="btn btn-primary" type="button" data-afc-edit-save="${esc(key)}" ${busy(key) ? 'disabled' : ''}>${busy(key) ? 'Saving…' : 'Save dates'}</button><button class="btn" type="button" data-afc-edit-cancel="${esc(key)}">Cancel</button><span class="muted">Was ${esc(row.startDate || '—')} to ${esc(row.endDate || '—')}. The change is recorded in Change History.</span></div></td></tr>` : '';
      const leaveEditor = canApply && editingKey === leaveKey ? `<tr data-afc-edit-row="${esc(key)}"><td colspan="9"><div class="afc-date-edit-form">
        <label class="field">FTE deduction<input class="input" type="number" min="0" step="0.0001" data-leave-fte value="${esc(leave.fteDeduction)}"></label>
        ${yearsForLeave(row.startDate,row.endDate).map(year => allocationInput(year,leave.allocationsByYear?.[year])).join('')}
        <button class="btn btn-primary" type="button" data-afc-leave-apply="${esc(key)}" ${busy(key) ? 'disabled' : ''}>Validate and Apply</button>
        <button class="btn" type="button" data-afc-edit-cancel="1">Cancel</button></div></td></tr>` : '';
      const availability = row.active === false ? 'Withdrawn' : row.reasonCode !== 'special' ? 'Active'
        : row.availability !== 'available' ? 'Unavailable'
          : 'Available' + (Object.values(leave?.confirmedYears || {}).includes(false) ? ' · Pending deduction' : leave?.suspendedIntervals?.length ? ' · Partial adjustment required' : '');
      return `<tr><td><button type="button" class="btn-link" data-afc-person="${esc(row.facultyId)}">${esc(facultyName(row, 'Name unavailable'))}</button></td><td>${esc(row.startDate || '—')}</td><td>${esc(row.endDate || '—')}</td><td>${esc(row.reason || row.legacyPurpose || row.reasonCode || '—')}</td><td>${esc(row.notes || row.legacyPurpose || '—')}</td><td>${esc(norm(row.sourceKind) === 'manual' ? 'Manual' : 'Imported')}</td><td>${esc(availability)}</td><td>${renderPdf(row)}</td><td>${action}</td></tr>${editor}${leaveEditor}`;
    }).join('') || '<tr><td colspan="9" class="empty">No AFC records match the current filters.</td></tr>';
  }
  async function showEffectiveLeave(api, date) {
    const panel = date.closest('[data-leave-faculty]');
    const host = panel?.querySelector('[data-leave-summary]');
    if (!host || !date.value) return;
    const selected = date.value;
    const request = {};
    host.leaveRequest = request;
    host.textContent = 'Loading effective FTE and DOE…';
    const current = () => host.isConnected && host.leaveRequest === request;
    try {
      const data = await api.specialLeaveEvaluation(panel.dataset.leaveFaculty, selected);
      if (!current()) return;
      const row = (label, ...values) => `<tr><th scope="row">${esc(label)}</th>${values.map(value => '<td>'+esc(amount(value))+'</td>').join('')}</tr>`;
      const rows = row('FTE',data.originalFte,data.deductionFte,data.effectiveFte) +
        doeCategories.map(key => row(key[0].toUpperCase()+key.slice(1)+' DOE',data.originalDoe[key],data.deductionDoe[key],data.effectiveDoe[key])).join('');
      const flags = data.flags.map(flag => flag==='FTE_DOE_MISMATCH' ? 'Contract FTE / DOE mismatch' : flag);
      host.innerHTML = `<p class="aux-note">${esc(data.academicYear)} · ${data.availability==='available'?'Available':'Unavailable'}${flags.length?' · '+flags.map(esc).join(' · '):''}</p>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Category</th><th>Original</th><th>Deduction</th><th>Effective</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      if (data.applied?.length && data.effectiveDoe.teaching != null) {
        const worksheet = await api.doeWorksheet?.({ facultyId:panel.dataset.leaveFaculty, academicYear:data.academicYear }).catch(() => null);
        const assigned = worksheet?.totals?.assignedTeachingDoe;
        if (current() && assigned != null && assigned > data.effectiveDoe.teaching) {
          host.insertAdjacentHTML('beforeend','<p class="aux-note">Assigned Teaching DOE exceeds the effective teaching allocation for this date.</p>');
        }
      }
    } catch {
      if (current()) host.textContent = 'Effective FTE and DOE could not be loaded.';
    }
  }
  function specialLeaveProfile(facultyId) {
    const api = typeof window !== 'undefined' && window.UCVM_PAWS_DATA;
    if (!facultyId || api?.afcSpecialLeaveEnabled?.() !== true) return '';
    const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Edmonton',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    setTimeout(() => {
      const date = document.querySelector('[data-leave-as-of]');
      if (date?.closest('[data-leave-faculty]')?.dataset.leaveFaculty === facultyId) showEffectiveLeave(api,date);
    },0);
    return `<section class="section wide" data-leave-faculty="${esc(facultyId)}"><div class="section-title">Special Leave · Effective FTE / DOE</div>
      <label class="field">As of date <input class="input" type="date" data-leave-as-of value="${esc(today)}"></label>
      <div data-leave-summary aria-live="polite"></div></section>`;
  }
  function profileAfc(records,{selfMode=false,facultyId,renderPdf=()=>'<span class="muted">N/A</span>'}={}) {
    // Render only the record set authorized and returned by the detail API.
    if (!Array.isArray(records)) return '';
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dateOnly = value => /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(text(value)) ? text(value).slice(0, 10) : '';
    const archived = record => record.active === false || (dateOnly(record.endDate) && dateOnly(record.endDate) < today);
    const upcoming = records.filter(record => !archived(record)).sort((a,b) => text(a.startDate).localeCompare(text(b.startDate)));
    const past = records.filter(archived).sort((a,b) => text(b.endDate).localeCompare(text(a.endDate)));
    const table = rows => rows.length?'<div class="table-wrap"><table class="data-table"><thead><tr>'+['Start','End','Availability status','Reason','Notes','Source','PDF'].map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(record => {
      const start = dateOnly(record.startDate), end = dateOnly(record.endDate);
      const status = record.active === false ? 'Withdrawn' : !start || !end ? 'Dates need review' : end < today ? 'Past' : start <= today ? 'Current' : 'Upcoming';
      const values=[record.startDate,record.endDate,status,record.reason||record.reasonCode||record.purpose,record.notes||record.legacyPurpose,record.sourceKind||'Source unavailable'];return '<tr>'+values.map(v=>'<td>'+esc(v??'—')+'</td>').join('')+'<td>'+renderPdf(record)+'</td></tr>';
    }).join('')+'</tbody></table></div>':'<div class="afc-none">No records in this group.</div>';
    const fold = (label, rows, open = false) => `<details class="afc-fold" ${open ? 'open' : ''}><summary><span>${label}</span><span>${rows.length} record${rows.length === 1 ? '' : 's'}</span></summary>${table(rows)}</details>`;
    return (selfMode ? '' : specialLeaveProfile(facultyId)) + `<section class="section wide"><div class="section-title">Away from Campus · Availability & HR Archive</div><div class="afc-wrap">${fold('Current / Upcoming', upcoming, true)}${fold('Past / Withdrawn · HR Archive', past)}<div class="afc-privacy">${selfMode ? 'Your private Away from Campus / availability records.' : 'Confidential availability and HR records. Detailed reasons follow your Dashboard permissions.'} PDF: N/A means no original was archived, including legacy records.</div></div></section><section id="faculty-afc-originals" class="section wide"></section>`;
  }

  function createActions({api,facultyName,canCancel,canEdit=()=>false,getRecords,render,refresh,refreshRecords,notify,confirm}) {
    const afcCancelInFlight=new Set();
    let editingKey='';
    const findRow=key=>getRecords().find(record => `${record.sourceKind}:${record.afcRecordId}` === key);
    const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
    function startEdit(key){ if(!canEdit()||afcCancelInFlight.has(key.replace(/^leave:/,'')))return; const row=findRow(key.replace(/^leave:/,'')); if(!row||row.active===false)return; editingKey=key; render(); }
    function cancelEdit(){ editingKey=''; render(); }
    async function applyLeave(key, container) {
      const row = findRow(key);
      if (!canEdit() || !row?.specialLeave || !container || afcCancelInFlight.has(key)) return;
      const specialLeave = readDeduction(container);
      afcCancelInFlight.add(key);
      render();
      try {
        await api.updateDashboardAfcSpecialLeave(row.afcRecordId, { expectedVersion:row.versionToken, specialLeave });
        editingKey = '';
        await refresh();
        notify('Special Leave deduction reviewed. Check the date-specific outcome in Lookup.');
      } catch (error) {
        notify(error?.message || 'Special Leave could not be applied.', true);
        if (error?.status === 409 || error?.status === 404) await refreshRecords();
      } finally {
        afcCancelInFlight.delete(key);
        render();
      }
    }
    async function saveDates(key,startDate,endDate) {
      if (!canEdit() || afcCancelInFlight.has(key)) return false;
      const row = findRow(key);
      if (!row || row.active === false || !/^[0-9a-f]{16}$/i.test(row.versionToken || '')) return false;
      if (!validDate(startDate) || !validDate(endDate)) { notify('Choose a valid start and end date.', true); return false; }
      if (endDate < startDate) { notify('End date must be on or after start date.', true); return false; }
      if (startDate === row.startDate && endDate === row.endDate) { notify('The new dates are the same as the current dates.', true); return false; }
      afcCancelInFlight.add(key); render();
      try {
        await api.updateDashboardAfcRecordDates(row.afcRecordId, { sourceKind: row.sourceKind, expectedVersion: row.versionToken, startDate, endDate });
        editingKey='';
        await refresh();
        notify(`AFC dates changed from ${row.startDate} – ${row.endDate} to ${startDate} – ${endDate}. The change is in Change History.`);
        return true;
      } catch (error) {
        notify(error?.message || 'AFC dates could not be changed.', true);
        if (error?.status === 409 || error?.status === 404) await refreshRecords();
        return false;
      } finally { afcCancelInFlight.delete(key); render(); }
    }
    async function cancel(key) {
    if (!canCancel() || afcCancelInFlight.has(key)) return;
    const row = getRecords().find(record => `${record.sourceKind}:${record.afcRecordId}` === key);
    if (!row || row.active === false || !/^[0-9a-f]{16}$/i.test(row.versionToken || '')) return;
    if (!confirm(`Withdraw the AFC record for ${facultyName(row, 'this faculty member')} (${row.startDate} to ${row.endDate})?\n\nIt will stop affecting availability. Its history and audit record will be retained.`)) return;
    afcCancelInFlight.add(key); render();
    try {
      await api.cancelDashboardAfcRecord(row.afcRecordId, { sourceKind: row.sourceKind, expectedVersion: row.versionToken });
      await refresh();
      notify('AFC record withdrawn. It no longer affects availability; its history is kept.');
    } catch (error) {
      notify(error?.message || 'AFC record could not be withdrawn.', true);
      if (error?.status === 409 || error?.status === 404) await refreshRecords();
    } finally { afcCancelInFlight.delete(key); render(); }
  }
    // Click wiring for the inline office date editor; returns true when handled.
    function handleEditClick(event){
      const target=event?.target;
      const apply = target?.closest?.('[data-afc-leave-apply]');
      if (apply) { applyLeave(apply.dataset.afcLeaveApply,apply.closest('[data-afc-edit-row]')); return true; }
      const edit=target?.closest?.('[data-afc-edit]');if(edit){startEdit(edit.dataset.afcEdit);return true;}
      if(target?.closest?.('[data-afc-edit-cancel]')){cancelEdit();return true;}
      const save=target?.closest?.('[data-afc-edit-save]');if(!save)return false;
      const row=save.closest?.('[data-afc-edit-row]');
      saveDates(save.dataset.afcEditSave,row?.querySelector?.('[data-afc-edit-start]')?.value||'',row?.querySelector?.('[data-afc-edit-end]')?.value||'');
      return true;
    }
    return {cancel,startEdit,cancelEdit,saveDates,handleEditClick,canEdit,editingKey:()=>editingKey,isBusy:key=>afcCancelInFlight.has(key)};
  }
  function facultyLabel(row, rows, facultyName) {
    const label = text(facultyName(row, 'Name unavailable'));
    const duplicates = rows.filter(other => text(facultyName(other, 'Name unavailable')) === label);
    return duplicates.length > 1 && (row.rank || row.stream) ? `${label} — ${[row.rank, row.stream].filter(Boolean).join(' / ')}` : label;
  }
  function resolveFaculty(value, rows, facultyName) {
    const input = text(value);
    const exact = rows.find(row => text(row.facultyId).toLowerCase() === input.toLowerCase());
    if (exact) return exact;
    const labelMatches = rows.filter(row => facultyLabel(row, rows, facultyName) === input);
    if (labelMatches.length === 1) return labelMatches[0];
    const nameMatches = rows.filter(row => text(row.displayName) === input);
    if (nameMatches.length === 1) return nameMatches[0];
    const parts = input.split(/,\s*/);
    if (parts.length === 2 && parts[0] && parts[1]) {
      const swapped = parts[1] + ' ' + parts[0];
      const transformed = rows.filter(row => text(row.displayName) === swapped);
      if (transformed.length === 1) return transformed[0];
    }
    return null;
  }
  return Object.freeze({updateWriteControls,createSingleActions,renderRows,profileAfc,createActions,facultyLabel,resolveFaculty});
});
