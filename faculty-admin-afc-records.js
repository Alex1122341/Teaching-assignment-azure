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
  function updateWriteControls(api, $, afcSubmitInFlight, unconfirmed=false) {
    const single = api.afcSingleWriteEnabled?.() === true;
    const batch = api.afcBatchWriteEnabled?.() === true;
    if ($('afc-submit')) $('afc-submit').disabled = !single || afcSubmitInFlight || unconfirmed;
    if ($('afc-form-status')) $('afc-form-status').textContent = unconfirmed ? unconfirmedMessage : single ? '' : 'AFC creation is unavailable. Your administrator permissions must be verified by the server.';
    if (!batch && $('afc-batch-submit')) $('afc-batch-submit').disabled = true;
    if ($('afc-batch-status')) $('afc-batch-status').textContent = batch ? '' : 'AFC batch creation is unavailable. Your administrator permissions must be verified by the server.';
  }
  function createSingleActions({api,$,reasonLabels,normalizeDate,isBusy,setBusy,refreshRecords,refreshDashboard}) {
    let unconfirmed=false;
    function status(message,error=false) {
      const node=$('afc-form-status');if(!node)return;
      node.textContent=message;node.classList.toggle('error',error);
    }
    function values() {
      return {facultyId:text($('afc-faculty')?.value),startDate:text($('afc-start-date')?.value),endDate:text($('afc-end-date')?.value),reasonCode:text($('afc-reason')?.value),notes:text($('afc-notes')?.value)};
    }
    function validate(input) {
      if(!input.facultyId)return 'Select an active faculty member.';
      const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!normalizeDate(value,'Date').error;
      if(!validDate(input.startDate)||!validDate(input.endDate))return 'Enter valid start and end dates.';
      if(input.endDate<input.startDate)return 'End date cannot be before start date.';
      if(!Object.prototype.hasOwnProperty.call(reasonLabels,input.reasonCode))return 'Select a recognised AFC reason.';
      if((input.reasonCode==='special'||input.reasonCode==='other')&&!input.notes)return 'Notes are required for Special and Other reasons.';
      if(input.notes.length>1000)return 'Notes must be 1,000 characters or fewer.';
      return '';
    }
    async function submit(event) {
      event?.preventDefault?.();if(isBusy()||unconfirmed)return;
      const input=values(),error=validate(input);if(error){status(error,true);return;}
      const button=$('afc-submit');setBusy(true);if(button){button.disabled=true;button.textContent='Saving…';}
      status('Saving AFC record…');
      try {
        const created=await api.createDashboardAfcRecord(input);
        if(!created?.afcRecordId)throw Object.assign(Error('AFC save response incomplete.'),{code:'OUTCOME_UNCONFIRMED'});
        let confirmed=false;
        for(let attempt=0;attempt<2&&!confirmed;attempt++)confirmed=(await refreshRecords())?.some(row=>String(row.afcRecordId)===String(created.afcRecordId));
        if(!confirmed)throw Object.assign(Error('AFC readback incomplete.'),{code:'OUTCOME_UNCONFIRMED'});
        $('afc-record-form')?.reset();await refreshDashboard();status('AFC record created and confirmed in the AFC list.');
      } catch(error) {
        unconfirmed=!(error?.code==='WRITE_DISABLED'&&Number(error.status)===503)&&(error?.code==='OUTCOME_UNCONFIRMED'||!Number(error?.status)||Number(error.status)>=500);
        status(unconfirmed?unconfirmedMessage:error?.message||'AFC record could not be created.',true);
      } finally {setBusy(false);if(button){button.disabled=unconfirmed||api.afcSingleWriteEnabled?.()!==true;button.textContent='Create AFC Record';}}
    }
    return {submit,isUnconfirmed:()=>unconfirmed};
  }
  function renderRows(rows,{facultyName,canCancel:allowed=false,busy=()=>false}={}) {
    return rows.map(row => {
      const key = `${row.sourceKind}:${row.afcRecordId}`;
      const canCancel = allowed && row.active !== false && /^[0-9a-f]{16}$/i.test(row.versionToken || '');
      const action = canCancel ? `<button class="btn" type="button" data-afc-cancel="${esc(key)}" ${busy(key) ? 'disabled' : ''}>${busy(key) ? 'Deleting…' : 'Delete'}</button>` : row.active === false ? 'Archived' : 'Unavailable';
      return `<tr><td><button type="button" class="btn-link" data-afc-person="${esc(row.facultyId)}">${esc(facultyName(row, 'Name unavailable'))}</button></td><td>${esc(row.startDate || '—')}</td><td>${esc(row.endDate || '—')}</td><td>${esc(row.reason || row.legacyPurpose || row.reasonCode || '—')}</td><td>${esc(row.notes || row.legacyPurpose || '—')}</td><td>${esc(norm(row.sourceKind) === 'manual' ? 'Manual' : 'Imported')}</td><td>${row.active === false ? 'No' : 'Yes'}</td><td>${action}</td></tr>`;
    }).join('') || '<tr><td colspan="8" class="empty">No AFC records match the current filters.</td></tr>';
  }
  function createActions({api,facultyName,canCancel,getRecords,render,refresh,refreshRecords,notify,confirm}) {
    const afcCancelInFlight=new Set();
    async function cancel(key) {
    if (!canCancel() || afcCancelInFlight.has(key)) return;
    const row = getRecords().find(record => `${record.sourceKind}:${record.afcRecordId}` === key);
    if (!row || row.active === false || !/^[0-9a-f]{16}$/i.test(row.versionToken || '')) return;
    if (!confirm(`Delete the AFC record for ${facultyName(row, 'this faculty member')} (${row.startDate} to ${row.endDate})?\n\nIt will stop affecting availability. Its history and audit record will be retained.`)) return;
    afcCancelInFlight.add(key); render();
    try {
      await api.cancelDashboardAfcRecord(row.afcRecordId, { sourceKind: row.sourceKind, expectedVersion: row.versionToken });
      await refresh();
      notify('AFC record deleted from active availability. History retained.');
    } catch (error) {
      notify(error?.message || 'AFC record could not be deleted.', true);
      if (error?.status === 409 || error?.status === 404) await refreshRecords();
    } finally { afcCancelInFlight.delete(key); render(); }
  }
    return {cancel,isBusy:key=>afcCancelInFlight.has(key)};
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
  return Object.freeze({updateWriteControls,createSingleActions,renderRows,createActions,facultyLabel,resolveFaculty});
});
