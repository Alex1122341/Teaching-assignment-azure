(() => {
  'use strict';
  const facultyName = (record, fallback = '') => window.PAWS_FACULTY_NAME.format(record, fallback);
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const bind = (node,event,handler) => { if(!node)return; if(typeof node.addEventListener==='function')node.addEventListener(event,handler); else node[`on${event}`]=handler; };
  const DOE_FIELDS = [
    ['contractTeachingDoe', 'Contracted Teaching (%)', 100],
    ['contractClinicalTeachingDoe', 'Contracted Clinical Teaching (%)', 100],
    ['potentialGradTeachingDoe', 'Potential Grad Teaching (%)', 999999.999999]
  ];
  const contractCategories = Object.entries(window.UCVM_FACULTY_DOE_RENDERER?.contractCategories || {});
  const numberField = (form, key) => {
    const value = form.elements.namedItem(key)?.value ?? '';
    return value.trim() === '' ? null : Number(value);
  };
  function create({ canWrite, getFaculty, getSelectedDetail, getFacultyDetail, onChanged, onEditOpen, notify,
    canWriteDoe = () => false, getAcademicYear, getDoeWorksheet }) {
    let editSequence = 0;
    let saving = false;
    let doeInput = null;
    function actions(f) {
      if (!canWrite() || !f?.facultyId || !f.updatedAtUtc) return '';
      return `<div class="faculty-admin-actions"><button type="button" class="btn btn-primary" data-faculty-edit="1">Edit Faculty</button>${(f.administrativeActive === undefined ? f.active === false : f.administrativeActive === false) ? '<button type="button" class="btn" data-faculty-restore="1">Restore Faculty</button>' : '<button type="button" class="btn" data-faculty-deactivate="1">Deactivate Faculty</button>'}</div>`;
    }
    function editAction(facultyId) { return canWrite() && facultyId ? `<button type="button" class="btn btn-small" data-faculty-edit-id="${esc(facultyId)}">Edit Faculty</button>` : ''; }
    function relationshipWarning(linked = {}) {
      const count = key => Number(linked[key]) || 0;
      return `<div class="faculty-link-warning" role="note"><strong>Linked records remain attached:</strong> ${count('activeUserProfileCount')} active login(s), ${count('currentTeachingSessionCount')} future teaching session(s), ${count('currentRoleCount')} current role(s), and ${count('currentTeachingResponsibilityCount')} current teaching responsibility assignment(s). Deactivation will not delete these records or disable linked accounts.</div>`;
    }
    function control(name, label, value, options = {}) {
      const attrs = `${options.max ? ` maxlength="${options.max}"` : ''}${options.step ? ` step="${options.step}"` : ''}${options.numberMax ? ` min="0" max="${options.numberMax}"` : ''}`;
      return `<label class="field ${options.full || options.max >= 4000 ? 'full' : ''}"><span class="field-label">${esc(label)}</span>${options.max >= 4000 ? `<textarea class="textarea" rows="3" name="${esc(name)}"${attrs}>${esc(value ?? '')}</textarea>` : `<input class="input" name="${esc(name)}" type="${options.type || 'text'}" value="${esc(value ?? '')}"${attrs}>`}</label>`;
    }
    function open(f = {}, profile = {}, detail = {}) {
      if (saving || !canWrite() || (f?.facultyId && !f.updatedAtUtc)) return;
      const sequence = ++editSequence;
      doeInput = null;
      const creating = !f?.facultyId;
      f = { recordType: 'faculty', ...f };
      const p = profile || {}, roster = getFaculty();
      const fields = new Map([
        ['preferredFirstName','Preferred first name',f.preferredFirstName,128],['preferredLastName','Preferred last name',f.preferredLastName,128],
        ['displayName','Stored display name',f.storedDisplayName ?? f.displayName,260],['ucid','UCID',f.ucid,64],['email','Email',f.email,256],
        ['recordType','Record type',f.recordType,32],['stream','Stream',f.stream,128],['rank','Rank',f.rank,128]
      ].map(([key,label,value,max]) => [key, control(key,label,value,{max})]));
      fields.set('fte',control('fte','FTE',f.fte,{type:'number',step:'0.0001',numberMax:9.9999}));
      fields.set('activationDate',control('activationDate','Faculty active from (YYYY-MM-DD)',f.activationDate,{type:'date'}));
      fields.set('reportsToFacultyId',`<label class="field"><span class="field-label">Reports to</span><select class="select" name="reportsToFacultyId"><option value="">No supervisor</option>${roster.filter(r => r.facultyId !== f.facultyId).map(r => `<option value="${esc(r.facultyId)}" ${r.facultyId === f.reportsToFacultyId ? 'selected' : ''}>${esc(facultyName(r, r.facultyId))}${r.active === false ? ' · inactive' : ''}</option>`).join('')}${f.reportsToFacultyId && !roster.some(r => r.facultyId === f.reportsToFacultyId) ? `<option selected value="${esc(f.reportsToFacultyId)}">${esc(f.reportsToFacultyId)} · current linked record</option>` : ''}</select></label>`);
      const profileFields = [
        ['teachingArea','Teaching area',512],['professionalCategory','Professional category',256],['serviceDate','Service date'],
        ['priorYearsExperience','Prior years experience',null,'number','0.01'],['dvmEarnedDate','DVM earned date',64],['dvmType','DVM type',256],
        ['mastersEarnedDate','Masters earned date',64],['mastersArea','Masters area',4000],['phdEarnedDate','PhD earned date',64],['phdArea','PhD area',4000],
        ['boardCertifiedDate','Board certified date',64],['boardCertification','Board certification',4000],
        ['boardCertificationCount','Board certification count',null,'number','0.01'],['abvmaLicenseNumber','ABVMA license number',128],['abvmaMemberType','ABVMA member type',512]
      ];
      profileFields.forEach(([key,label,max,type,step]) => fields.set(key,control(key,label,p[key],{max,type,step})));
      const group = (title, content) => `<section class="form-section"><h3 class="form-section-title">${title}</h3><div class="field-grid">${content.join('')}</div></section>`;
      const identityKeys = ['preferredFirstName','preferredLastName','displayName','ucid','email','reportsToFacultyId'];
      const appointmentKeys = ['recordType','stream','rank','activationDate','serviceDate','priorYearsExperience'];
      const specialtyKeys = profileFields.map(([key]) => key).filter(key => !appointmentKeys.includes(key));
      const controls = keys => keys.map(key => fields.get(key));
      const year = getAcademicYear?.();
      const workload = group(year ? `FTE &amp; Contract DOE · ${esc(year)}` : 'FTE &amp; Contract DOE', [
        fields.get('fte'),
        ...(canWriteDoe() && year ? ['<div class="field full" data-faculty-doe-fields>Loading contract DOE…</div>'] : [])
      ]);
      $('faculty-record-fields').innerHTML = group('Identity & contact', [`<div class="field full"><span class="field-label">Faculty ID (immutable)</span><div class="field-value">${creating ? 'Assigned when saved' : esc(f.facultyId)}</div></div>`, ...controls(identityKeys)]) + group('Appointment', controls(appointmentKeys)) + workload + group('Specialty & education', controls(specialtyKeys));
      $('faculty-record-title').textContent = creating ? 'Add New Faculty' : `Edit Faculty · ${facultyName(f, f.facultyId)}`;
      const form = $('faculty-record-form');
      form.dataset.facultyId = creating ? '' : f.facultyId;
      form.dataset.expectedUpdatedAtUtc = creating ? '' : f.updatedAtUtc;
      form.dataset.expectedProfileVersion = creating ? '' : (p.profileVersion || '');
      $('faculty-record-description').textContent = creating
        ? 'Create a canonical Faculty record now. A future start date keeps it inactive until that date.'
        : 'Update the canonical Faculty record and professional profile.';
      $('faculty-record-status').textContent = ''; $('faculty-record-save').disabled = false;
      if (!$('faculty-record-editor').open) $('faculty-record-editor').showModal();
      const container = form.querySelector?.('[data-faculty-doe-fields]');
      if (container) {
        const renderDoeInputs = (target, contract) => {
          if (sequence !== editSequence || !container.isConnected) return;
          const before = Object.fromEntries(DOE_FIELDS.map(([key]) => [key, target[key] ?? null]));
          const allocations = Object.fromEntries(contractCategories.map(([key]) =>
            [key, contract.allocations?.find(row => row.categoryCode === key)?.allocationDoe ?? null]));
          const [teaching, ...references] = DOE_FIELDS;
          const teachingField = ([key, label, max]) => control(key,label,before[key],{type:'number',step:'0.000001',numberMax:max});
          container.className = 'field-grid full';
          container.innerHTML = teachingField(teaching) + contractCategories.map(([key,label]) =>
            control('allocation_'+key,label+' (%)',allocations[key],{type:'number',step:'0.000001',numberMax:100})
          ).join('') + '<output class="aux-note full" data-contract-total aria-live="polite"></output>' +
            references.map(teachingField).join('') +
            '<p class="aux-note full">Contract allocations must total FTE × 100. Contracted Clinical Teaching and Potential Grad Teaching are separate reference fields.</p>';
          doeInput = { academicYear: year, before, allocations, fte: f.fte ?? null };
          showContractTotal(form);
        };
        if (creating) renderDoeInputs({}, {});
        else Promise.all([
          getDoeWorksheet({ facultyId: f.facultyId, academicYear: year }),
          detail.contractDoe?.academicYear === year ? detail : getFacultyDetail(f.facultyId,{academicYear:year})
        ]).then(([worksheet, record]) => {
          if (worksheet?.academicYear !== year || !worksheet.target || record?.contractDoe?.academicYear !== year) throw new Error('DOE inputs unavailable');
          renderDoeInputs(worksheet.target,record.contractDoe);
        }).catch(() => {
          if (sequence === editSequence) container.textContent = 'Teaching DOE could not be loaded. Reopen Edit Faculty to try again.';
        });
      }
      if (!creating && typeof onEditOpen === 'function') onEditOpen(form, f, p, detail);
    }
    function showContractTotal(form) {
      const node = form.querySelector('[data-contract-total]');
      if (!node) return;
      const values = ['contractTeachingDoe',...contractCategories.map(([key])=>'allocation_'+key)].map(key=>numberField(form,key));
      const fte = numberField(form,'fte');
      const total = values.reduce((sum,n)=>sum+(n ?? 0),0);
      node.textContent = `Total Contract DOE ${values.every(n=>n===null) ? 'None' : total.toFixed(2)+'%'} · FTE allocation ${fte===null ? 'None' : (fte*100).toFixed(2)+'%'}`;
    }
    async function editById(facultyId) {
      if (!canWrite() || !facultyId || typeof getFacultyDetail !== 'function') return;
      const sequence = ++editSequence;
      try {
        const detail = await getFacultyDetail(facultyId);
        if (sequence !== editSequence) return;
        if (!detail?.faculty) throw new Error('Faculty detail could not be loaded from the PAWS University API.');
        open(detail.faculty, detail.professionalProfile || {}, detail);
      } catch (error) { if (sequence === editSequence) notify(error?.message || 'Faculty detail could not be loaded.', true); }
    }
    function payload(form) {
      const value = name => form.elements.namedItem(name)?.value ?? '';
      const str = name => String(value(name)).trim() || null;
      const num = name => String(value(name)).trim() === '' ? null : Number(value(name));
      const doeValues = doeInput && Object.fromEntries(DOE_FIELDS.map(([key]) => [key, num(key)]));
      const changedDoe = doeValues && DOE_FIELDS.some(([key]) => doeValues[key] !== doeInput.before[key]);
      const fte = num('fte');
      const allocations = doeInput && Object.fromEntries(contractCategories.map(([key]) => [key,num('allocation_'+key)]));
      const changedContract = allocations && (fte !== doeInput.fte || doeValues.contractTeachingDoe !== doeInput.before.contractTeachingDoe ||
        contractCategories.some(([key]) => allocations[key] !== doeInput.allocations[key]));
      return {
        ...(changedDoe ? { teachingDoe: { academicYear:doeInput.academicYear, before:doeInput.before, values: doeValues } } : {}),
        ...(changedContract ? { contractAllocations: { academicYear:doeInput.academicYear,before:doeInput.allocations,values:allocations } } : {}),
        expectedUpdatedAtUtc: form.dataset.expectedUpdatedAtUtc,
        expectedProfileVersion: form.dataset.expectedProfileVersion || null,
        preferredFirstName: str('preferredFirstName'), preferredLastName: str('preferredLastName'), displayName: String(value('displayName')).trim(),
        ucid: str('ucid'), email: str('email'), recordType: String(value('recordType')).trim(), stream: str('stream'), rank: str('rank'),
        fte, reportsToFacultyId: str('reportsToFacultyId'), activationDate: str('activationDate'), professionalProfile: {
          teachingArea: str('teachingArea'), professionalCategory: str('professionalCategory'), serviceDate: str('serviceDate'),
          priorYearsExperience: num('priorYearsExperience'), dvmEarnedDate: str('dvmEarnedDate'), dvmType: str('dvmType'),
          mastersEarnedDate: str('mastersEarnedDate'), mastersArea: str('mastersArea'), phdEarnedDate: str('phdEarnedDate'), phdArea: str('phdArea'),
          boardCertifiedDate: str('boardCertifiedDate'), boardCertification: str('boardCertification'), boardCertificationCount: num('boardCertificationCount'),
          abvmaLicenseNumber: str('abvmaLicenseNumber'), abvmaMemberType: str('abvmaMemberType')
        }
      };
    }
    async function submit(event) {
      event.preventDefault(); const form = event.currentTarget, button = $('faculty-record-save'), status = $('faculty-record-status');
      if (saving) return;
      const id = form.dataset.facultyId;
      saving = true;
      $('faculty-record-cancel').disabled = true; $('faculty-record-close').disabled = true;
      try {
        button.disabled = true; status.textContent = 'Saving canonical Faculty record…';
        const values = payload(form);
        let finalId = id;
        let saved = null;
        if (id) {
          saved = await UCVM_PAWS_DATA.updateDashboardFaculty(id,values);
        } else {
          const { expectedUpdatedAtUtc, expectedProfileVersion, ...createValues } = values;
          saved = await UCVM_PAWS_DATA.createDashboardFaculty(createValues);
          finalId = saved?.faculty?.facultyId;
          if (!finalId) throw new Error('The Faculty API did not return an identifier; reload Lookup before retrying.');
        }
        $('faculty-record-editor').close();
        notify(id ? 'Faculty record saved.' : 'New Faculty record created.');
        await onChanged(finalId, saved?.faculty?.active === false ? (saved?.faculty?.administrativeActive === false ? 'inactive' : 'pending') : 'active');
      } catch (error) { status.textContent = error?.message || 'Faculty record could not be saved.'; button.disabled = false; }
      finally { saving = false; $('faculty-record-cancel').disabled = false; $('faculty-record-close').disabled = false; }
    }
    async function deactivate(f, linked) {
      const links = [`${Number(linked.activeUserProfileCount)||0} active login(s)`,`${Number(linked.currentTeachingSessionCount)||0} future teaching session(s)`,`${Number(linked.currentRoleCount)||0} current role(s)`,`${Number(linked.currentTeachingResponsibilityCount)||0} current responsibility assignment(s)`].join(', ');
      if (!window.confirm(`Deactivate ${facultyName(f, f.facultyId)}?\n\nThis only marks the Faculty record inactive. It does not delete linked records, disable user accounts, or remove teaching, role, appointment, DOE, or AFC history.\n\nCurrently linked: ${links}.\n\nContinue?`)) return;
      try { await UCVM_PAWS_DATA.deactivateDashboardFaculty(f.facultyId,{expectedUpdatedAtUtc:f.updatedAtUtc,confirm:true}); notify('Faculty record deactivated; linked records were preserved.'); await onChanged(f.facultyId,'inactive'); }
      catch (error) { notify(error?.message || 'Faculty record could not be deactivated.',true); }
    }
    async function restore(f) {
      if (!window.confirm(`Restore ${facultyName(f, f.facultyId)} as the same Faculty record? Its Faculty ID and existing relationships will be preserved.`)) return;
      try { await UCVM_PAWS_DATA.restoreDashboardFaculty(f.facultyId,{expectedUpdatedAtUtc:f.updatedAtUtc}); notify('Existing Faculty record restored.'); await onChanged(f.facultyId,'all'); }
      catch (error) { notify(error?.message || 'Faculty record could not be restored.',true); }
    }
    return Object.freeze({
      actions, editAction, relationshipWarning,
      refreshWriteControls() {
        const btn = $('faculty-create-btn');
        btn?.classList?.toggle('hidden',!canWrite());
        if (btn) btn.disabled = !canWrite();
      },
      bind() {
        const close = () => { if (!saving) { ++editSequence; $('faculty-record-editor')?.close(); } };
        bind($('faculty-record-cancel'),'click',close);
        bind($('faculty-record-close'),'click',close);
        bind($('faculty-record-editor'),'cancel',event => { if (saving) event.preventDefault(); else ++editSequence; });
        bind($('faculty-record-form'),'submit',submit);
        bind($('faculty-record-form'),'input',event=>showContractTotal(event.currentTarget));
        bind($('faculty-create-btn'),'click',() => open({}, {}, {}));
        bind(document,'click',event => {
          const action = event.target?.closest?.('[data-faculty-edit-id]');
          if (!action || !canWrite()) return;
          event.preventDefault(); event.stopPropagation(); editById(action.dataset.facultyEditId);
        });
        bind($('profile-pane'),'click',event => {
          const action = event.target?.closest?.('[data-faculty-edit],[data-faculty-deactivate],[data-faculty-restore]');
          if (!action) return;
          const detail = getSelectedDetail();
          const f = detail?.faculty;
          if (!f || !canWrite()) return;
          if (action.hasAttribute('data-faculty-edit')) open(f,detail.professionalProfile || {}, detail);
          else if (action.hasAttribute('data-faculty-deactivate')) deactivate(f,detail.linkedRecords || {});
          else restore(f);
        });
      }
    });
  }
  window.UCVM_FACULTY_ADMIN_MANAGEMENT = Object.freeze({ create });
})();
