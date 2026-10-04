'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.UCVM_AFC_SQL=api.createSqlAfcWorkflow({root});
})(typeof window==='undefined'?globalThis:window,function(){
  const TERMS_VERSION='ucvm-afc-terms-page2-v1';
  const TERMS_SOURCE='absence-from-campus-app.pdf#page=2';
  const SELF_ROLES=new Set(['faculty','hicc','visc']);
  const ADMIN_ROLES=new Set(['owner','administrator','adfa_general','adfa_regular','admin']);

  function normalizeRole(value){
    return String(value??'').trim().toLowerCase().replace(/[\s-]+/g,'_');
  }

  function requestActions(request,{uid='',role=''}={}){
    const actor=String(uid??'').trim(),normalizedRole=normalizeRole(role),isAdmin=ADMIN_ROLES.has(normalizedRole);
    const status=String(request?.status??'').trim();
    const requester=String(request?.requesterFirebaseUid??'').trim();
    const reportTo=String(request?.reportToFirebaseUid??'').trim();
    const canWithdraw=SELF_ROLES.has(normalizedRole)&&requester===actor&&['pending_report_to','pending_admin'].includes(status);
    const canRecommend=status==='pending_report_to'&&(isAdmin||(SELF_ROLES.has(normalizedRole)&&reportTo===actor));
    const canApprove=status==='pending_admin'&&isAdmin;
    const canReject=canRecommend||canApprove;
    return{canWithdraw,canRecommend,canReject,canApprove};
  }

  function createSqlAfcWorkflow(options={}){
    const root=options.root||(typeof window==='undefined'?globalThis:window);
    const doc=options.document||root.document;
    const getClient=options.dataClient?()=>options.dataClient:()=>root.UCVM_PAWS_DATA;
    const getAuth=options.auth?()=>options.auth:()=>root.firebase?.auth?.()||{};
    let mode='dashboard';
    const getProfile=options.profile||(()=>{const source=mode==='timetable'?root.UCVM_PAGE_DATA:root.UCVM_FACULTY_DATA;return source?.profile?.()||{}});
    const roleResolver=options.roleResolver||(value=>{try{return root.UCVM?.role?.(value)??value}catch(_){return value}});
    const signatureCapture=options.signatureCapture||((input)=>root.UCVM_SIGNATURE?.capture?.(input));
    const ask=options.prompt||((message)=>root.prompt?.(message));
    const FormDataCtor=options.FormData||root.FormData||globalThis.FormData;
    const escape=options.escapeHtml||((value)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
    let requests=[],loaded=false,busy=false,panelId='afc-panel',applicantSignature=null,submitInFlight=false,submitOutcomeUnconfirmed=false;
    const panel=()=>doc?.getElementById?.(panelId)||null;
    function syncSubmitButton(){const currentForm=doc?.getElementById?.('afc-sql-form'),button=currentForm?.querySelector?.('button[type="submit"]');if(button)button.disabled=submitInFlight||submitOutcomeUnconfirmed;}
    const profile=()=>getProfile()||{};
    const actorRole=()=>normalizeRole(roleResolver(profile().role??profile().baseRole??''));
    const user=()=>getAuth()?.currentUser||null;
    const uid=()=>String(user()?.uid??'').trim();
    const client=()=>{const value=getClient();if(!value)throw Error('The PAWS University API is unavailable.');return value};
    const e=escape;

    function actionsFor(request){return requestActions(request,{uid:uid(),role:actorRole()})}
    function statusLabel(value){return({pending_report_to:'Pending Reports To approval',pending_admin:'Pending ADMIN approval',approved:'Approved',rejected:'Rejected',withdrawn:'Withdrawn'}[value]||value||'Unknown')}
    function formHtml(){
      if(!SELF_ROLES.has(actorRole()))return'';
      const displayName=profile().displayName||user()?.displayName||user()?.email||'Signed-in account';
      return '<details class="afc-new"><summary>New AFC request</summary><form id="afc-sql-form">'+
        '<p class="afc-autofill">Submitting as '+e(displayName)+'. The University API determines faculty identity and workflow routing.</p>'+
        '<div class="afc-grid"><label>Start date<input type="date" name="startDate" required></label>'+
        '<label>End date<input type="date" name="endDate" required></label>'+
        '<label>Reason<select name="reason" required><option value="vacation">Vacation</option><option value="business_other">Business / Other</option></select></label></div>'+
        '<label>Contact address<textarea name="contactAddress" required maxlength="500"></textarea></label>'+
        '<label>Phone number<input type="tel" name="contactPhone" required maxlength="50"></label>'+
        '<label id="afc-sql-purpose-wrap" hidden>Purpose and destination<textarea name="purposeDestination" maxlength="1000"></textarea></label>'+
        '<label>Coverage arrangements (required when the server finds teaching during this period)<textarea name="coverage" maxlength="2000"></textarea></label>'+
        '<label class="afc-terms"><input type="checkbox" name="termsAccepted" required> I have reviewed and accept the <a href="absence-from-campus-app.pdf#page=2" target="_blank" rel="noopener">AFC Terms &amp; Conditions (page 2)</a>.</label>'+
        '<div class="afc-signature-control"><button class="btn btn-secondary" type="button" id="afc-sql-sign">Choose signature</button><span><strong id="afc-sql-signature-status">Not signed</strong><small>Type, draw, or upload a signature image.</small></span></div>'+
        '<div class="afc-submit-row"><button class="btn btn-primary" type="submit">Submit AFC request</button><span id="afc-sql-submit-status" role="status"></span></div>'+
      '</form></details>';
    }

    function card(request){
      const id=String(request.afcRequestId??''),a=actionsFor(request),status=String(request.status??'');
      const details=['<p>'+e(request.startDate)+' – '+e(request.endDate)+' · '+e(request.workDays)+' workday(s) · '+e(request.reason==='vacation'?'Vacation':'Business / Other')+'</p>'];
      if(request.purposeDestination)details.push('<p><b>Purpose/destination:</b> '+e(request.purposeDestination)+'</p>');
      if(request.coverage)details.push('<p><b>Coverage:</b> '+e(request.coverage)+'</p>');
      if(request.rejectionReason)details.push('<p class="error"><b>Rejected:</b> '+e(request.rejectionReason)+'</p>');
      if(status==='approved')details.push('<p class="afc-note" role="status">Approved. PDF delivery is pending the separate secure artifact service.</p>');
      const controls=[];
      if(a.canWithdraw)controls.push('<button type="button" data-afc-withdraw="'+e(id)+'">Withdraw request</button>');
      if(a.canRecommend)controls.push('<button type="button" data-afc-action="recommend" data-afc-id="'+e(id)+'">Sign &amp; recommend</button>');
      if(a.canApprove)controls.push('<button type="button" data-afc-action="approve" data-afc-id="'+e(id)+'">Sign &amp; approve</button>');
      if(a.canReject)controls.push('<button type="button" data-afc-action="reject" data-afc-id="'+e(id)+'">Sign &amp; reject</button>');
      if(a.canRecommend&&ADMIN_ROLES.has(actorRole()))details.push('<p class="afc-note">An administrator may sign on behalf of Reports To; the server remains authoritative.</p>');
      return '<article class="afc-card"><header><strong>'+e(request.facultyName)+'</strong><span class="afc-status '+e(status)+'">'+e(statusLabel(status))+'</span></header>'+
        details.join('')+(controls.length?'<div class="afc-review">'+controls.join('')+'</div>':'')+'</article>';
    }

    function render(){
      const target=panel();if(!target)return;
      target.innerHTML='<div class="dashboard-heading"><div><h2>Absence from Campus</h2><p>Requests and approvals are stored in VetMed-Ops.</p></div><button type="button" id="afc-sql-refresh">Refresh</button></div>'+
        formHtml()+'<div class="afc-list">'+(requests.map(card).join('')||'<p>No AFC requests are visible to this account.</p>')+'</div>';
      bind();
    }

    function findRequest(id){return requests.find(row=>String(row.afcRequestId??'')===String(id??''))}
    function requireAction(id,action){
      const row=findRequest(id);if(!row)throw Error('This AFC request is not in the current server-scoped list. Refresh the list before acting.');
      const allowed=actionsFor(row);
      if(action==='withdraw'&&allowed.canWithdraw)return row;
      if(action==='recommend'&&allowed.canRecommend)return row;
      if(action==='approve'&&allowed.canApprove)return row;
      if(action==='reject'&&allowed.canReject)return row;
      if(action==='approve')throw Error('Only an administrator can approve a pending Admin-stage request.');
      if(action==='withdraw')throw Error('Only the requester may withdraw a request in a pending state.');
      throw Error('This account cannot make that decision at the current workflow stage.');
    }

    async function load(force=false){
      if((loaded&&!force)||busy)return requests;
      busy=true;const target=panel();if(target)target.innerHTML='<p class="afc-loading">Loading AFC requests…</p>';
      try{const rows=await client().listAfcRequests();requests=Array.isArray(rows)?rows:[];loaded=true;if(force&&submitOutcomeUnconfirmed)submitOutcomeUnconfirmed=false;render();return requests}
      catch(error){if(target)target.innerHTML='<p class="error">'+e(error?.message||'AFC requests could not be loaded.')+'</p>';throw error}
      finally{busy=false}
    }

    async function performWrite(send,description){
      let result;
      try{result=await send()}
      catch(cause){
        if(typeof cause?.status==='number'||['UNAUTHENTICATED','TOKEN_REFRESH_FAILED'].includes(cause?.code))throw cause;
        const error=Error('The '+description+' outcome could not be confirmed. Refresh the request list before trying again.');
        error.code='OUTCOME_UNCONFIRMED';error.cause=cause;throw error;
      }
      if(!result?.afcRequestId){
        const error=Error('The server response could not confirm the '+description+'. Refresh the request list before trying again.');
        error.code='OUTCOME_UNCONFIRMED';throw error;
      }
      try{await load(true)}
      catch(_){
        const target=panel();
        if(target)target.innerHTML='<p class="error" role="status">'+e('The '+description+' was accepted, but the request list could not refresh. Use Refresh before acting again.')+'</p>';
      }
      return result;
    }

    async function submit(payload){
      if(!SELF_ROLES.has(actorRole()))throw Error('Only Faculty, HICC, or VISC accounts may submit an AFC request.');
      const result=await performWrite(()=>client().submitAfcRequest(payload),'submission');
      applicantSignature=null;
      return result;
    }

    async function withdraw(id){
      requireAction(id,'withdraw');
      return performWrite(()=>client().withdrawAfcRequest(id),'withdrawal');
    }

    async function decide(id,action,signature,rejectionReason=''){
      requireAction(id,action);
      if(!signature||typeof signature!=='object')throw Error('A signature is required for this decision.');
      const payload=action==='reject'?{signature,rejectionReason:String(rejectionReason??'').trim()}:{signature};
      if(action==='reject'&&!payload.rejectionReason)throw Error('A rejection reason is required.');
      const method={recommend:'recommendAfcRequest',reject:'rejectAfcRequest',approve:'approveAfcRequest'}[action];
      if(!method)throw Error('Unsupported AFC decision.');
      return performWrite(()=>client()[method](id,payload),action);
    }

    async function captureDecision(id,action){
      requireAction(id,action);
      const activeUser=user(),signer=profile().displayName||activeUser?.displayName||activeUser?.email||uid();
      const signature=await signatureCapture({name:signer,email:activeUser?.email||'',uid:uid(),title:'Sign AFC '+action});
      if(!signature)return null;
      let rejectionReason='';
      if(action==='reject'){rejectionReason=String(ask('Reason for rejection:')??'').trim();if(!rejectionReason)return null}
      return decide(id,action,signature,rejectionReason);
    }

    function formPayload(form){
      if(!FormDataCtor)throw Error('Form submission is unavailable in this browser.');
      const values=new FormDataCtor(form),startDate=String(values.get('startDate')||'').trim(),endDate=String(values.get('endDate')||'').trim(),reason=String(values.get('reason')||'').trim();
      if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||endDate<startDate)throw Error('Choose a valid start and end date.');
      if(!['vacation','business_other'].includes(reason))throw Error('Select Vacation or Business / Other.');
      if(values.get('termsAccepted')!=='on')throw Error('Review and accept the current AFC terms.');
      if(!applicantSignature)throw Error('Choose and confirm an electronic signature.');
      const purposeDestination=String(values.get('purposeDestination')||'').trim();
      if(reason==='business_other'&&!purposeDestination)throw Error('Purpose and destination are required.');
      return{
        startDate,endDate,reason,purposeDestination,
        coverage:String(values.get('coverage')||'').trim(),
        contactAddress:String(values.get('contactAddress')||'').trim(),
        contactPhone:String(values.get('contactPhone')||'').trim(),
        termsAccepted:true,termsVersion:TERMS_VERSION,termsSource:TERMS_SOURCE,
        applicantSignature
      };
    }

    function updateForm(){
      const form=doc?.getElementById?.('afc-sql-form');if(!form)return;
      const fields=new FormDataCtor(form),purpose=doc.getElementById('afc-sql-purpose-wrap');
      if(purpose)purpose.hidden=String(fields.get('reason')||'')!=='business_other';
    }

    function bind(){
      const form=doc?.getElementById?.('afc-sql-form');
      if(form){
        form.onchange=updateForm;
        syncSubmitButton();
        form.onsubmit=async event=>{
          event.preventDefault();
          if(submitInFlight||submitOutcomeUnconfirmed)return;
          submitInFlight=true;syncSubmitButton();
          const status=doc.getElementById('afc-sql-submit-status');if(status)status.textContent='Submitting…';
          try{
            await submit(formPayload(form));form.reset();
            const signatureStatus=doc.getElementById('afc-sql-signature-status');if(signatureStatus)signatureStatus.textContent='Not signed';
            const current=doc.getElementById('afc-sql-submit-status');if(current)current.textContent='Request submitted.';
          }catch(error){
            if(error?.code==='OUTCOME_UNCONFIRMED')submitOutcomeUnconfirmed=true;
            const current=doc.getElementById('afc-sql-submit-status');if(current)current.textContent=error?.message||'The request could not be submitted.';
          }finally{submitInFlight=false;syncSubmitButton()}
        };
        const sign=doc.getElementById('afc-sql-sign');
        if(sign)sign.onclick=async()=>{const status=doc.getElementById('afc-sql-signature-status'),activeUser=user();try{if(typeof signatureCapture!=='function')throw Error('The signature chooser did not load.');applicantSignature=await signatureCapture({name:profile().displayName||activeUser?.displayName||activeUser?.email||'',email:activeUser?.email||'',uid:uid(),title:'Sign AFC request'});if(status)status.textContent=applicantSignature?applicantSignature.mode+' signature ready · '+new Date(applicantSignature.signedAt).toLocaleString('en-CA'):'Not signed'}catch(error){if(status)status.textContent=error?.message||'Signature capture failed.'}};
      }
      const target=panel();if(!target?.querySelectorAll)return;
      const refresh=doc.getElementById('afc-sql-refresh');if(refresh)refresh.onclick=()=>load(true);
      target.querySelectorAll('[data-afc-withdraw]').forEach(button=>button.onclick=()=>withdraw(button.dataset.afcWithdraw).catch(error=>root.alert?.(error.message)));
      target.querySelectorAll('[data-afc-action]').forEach(button=>button.onclick=()=>captureDecision(button.dataset.afcId,button.dataset.afcAction).catch(error=>root.alert?.(error.message)));
    }

    function mount(configuration={}){
      const nextPanel=String(configuration.panelId||'afc-panel'),nextMode=configuration.mode==='timetable'?'timetable':'dashboard';
      if(nextPanel!==panelId||nextMode!==mode)loaded=false;
      panelId=nextPanel;mode=nextMode;return api;
    }

    const api={mount,load,submit,withdraw,recommend:(id,signature)=>decide(id,'recommend',signature),reject:(id,signature,reason)=>decide(id,'reject',signature,reason),approve:(id,signature)=>decide(id,'approve',signature),decide,actionsFor,formPayload,getRequests:()=>[...requests],teachingListHtml:()=>'',unavailable:false};
    return api;
  }

  return{createSqlAfcWorkflow,requestActions,TERMS_VERSION,TERMS_SOURCE};
});
