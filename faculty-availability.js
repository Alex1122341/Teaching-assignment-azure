(function(root){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const kinds={all:'All records',teaching:'Teaching',work:'Work beyond teaching',afc:'AFC / Leave',pending:'Pending absence',role:'Roles / Appointments'};
 const labels={busy:'Busy',away:'Away / Unavailable',tentative:'Tentative',ongoing:'Ongoing responsibility',time_unconfirmed:'Time unconfirmed'};
 function createFacultyAvailability({api,host,getSelfMode=()=>false}={}){
  if(!api||!host)throw Error('Availability host and data API required.');
  let generation=0,selected='',cursor=null,items=[],loading=false,coverage=null;
  host.innerHTML='<div class="section-title">Faculty Availability</div><p class="aux-note">Read-only PAWS commitments, not a guarantee of open calendar time.</p>'+
   '<div class="availability-controls"><label>Faculty member<input id="availability-faculty" class="input" list="availability-faculty-options" autocomplete="off" placeholder="Search a faculty name"></label><datalist id="availability-faculty-options"></datalist>'+
   '<label>Dates<select id="availability-mode" class="select"><option value="upcoming">Ongoing and upcoming (default)</option><option value="from">From date onward</option><option value="range">Custom historical range</option></select></label>'+
   '<label id="availability-start-wrap" hidden>Start date<input id="availability-start" type="date" class="input"></label><label id="availability-end-wrap" hidden>End date<input id="availability-end" type="date" class="input"></label>'+
   '<label>Show<select id="availability-kind" class="select">'+Object.entries(kinds).map(([k,v])=>'<option value="'+esc(k)+'">'+esc(v)+'</option>').join('')+'</select></label>'+
   '<button type="button" class="btn btn-primary" id="availability-search">Search availability</button></div>'+
   '<div id="availability-status" class="aux-note" role="status" aria-live="polite">Select a faculty member.</div>'+
   '<div id="availability-summary"></div><div id="availability-events" class="availability-events"></div>'+
   '<button id="availability-more" class="btn" type="button" hidden>Load more records</button>';
  const $=id=>host.querySelector('#'+id);
  const picker=$('availability-faculty'),options=$('availability-faculty-options');
  const showModes=()=>{const mode=$('availability-mode').value;$('availability-start-wrap').hidden=mode==='upcoming';$('availability-end-wrap').hidden=mode!=='range';};
  $('availability-mode').addEventListener('change',showModes);
  const state=message=>{$('availability-status').textContent=message;};
  const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v:'';
  function viewLine(event){
   const start=esc(event.startDate),end=event.endDate&&event.endDate!==event.startDate?' – '+esc(event.endDate):'';
   const clock=event.startTime&&event.endTime?' · '+esc(event.startTime)+'–'+esc(event.endTime):'';
   const kind=kinds[event.kind]||'Record';
   const detail=event.detail?' · '+esc(event.detail):'';
   const evidence=Array.isArray(event.timeEvidence)?event.timeEvidence:[];
   const time=evidence.length?'<details><summary>Verified work times ('+evidence.length+')</summary>'+evidence.map(x=>'<div>'+esc(x.date)+' · '+esc(x.startTime)+'–'+esc(x.endTime)+'</div>').join('')+'</details>':'';
   return '<article class="availability-event"><div class="availability-event-top"><strong>'+esc(event.label)+'</strong><span class="availability-pill">'+esc(labels[event.availability]||'Needs review')+'</span></div>'+
    '<div class="availability-meta">'+start+end+clock+' · '+esc(kind)+detail+'</div>'+time+'</article>';
  }
  function render(){
   const counts=items.reduce((m,x)=>(m[x.kind]=(m[x.kind]||0)+1,m),{});
   $('availability-summary').innerHTML='<div class="availability-summary">'+Object.entries(counts).map(([k,n])=>'<span>'+esc(kinds[k]||k)+': <strong>'+n+'</strong></span>').join('')+'</div>'+
     ((coverage?.undatedSessions||coverage?.undatedRoles)?'<p class="availability-warning">Coverage warning: '+Number(coverage.undatedSessions||0)+' session(s) and '+Number(coverage.undatedRoles||0)+' role(s) lack usable dates; inspect source records separately.</p>':'');
   $('availability-events').innerHTML=items.map(viewLine).join('')||'<p class="empty">No PAWS commitments found in the selected interval. This does not confirm free time.</p>';
   $('availability-more').hidden=!cursor;
  }
  let roster=[];
  async function loadRoster(){
   const token=++generation;
   state('Loading authorized faculty…');
   try{
    const value=await api.dashboardFaculty();
    if(token!==generation)return;
    roster=Array.isArray(value)?value:[];
    options.innerHTML=roster.map(r=>'<option value="'+esc(r.displayName||'Name unavailable')+'"></option>').join('');
    if(getSelfMode()&&roster.length===1){selected=String(roster[0].facultyId||'');picker.value=roster[0].displayName||'Name unavailable';}
    state(roster.length?'Select one faculty and search.':'No authorized faculty records available.');
   }catch(error){if(token===generation)state('Faculty list unavailable. Retry after signing in.');}
  }
  async function search(more=false){
   if(loading)return;
   const matches=roster.filter(r=>String(r.displayName||'').toLowerCase()===picker.value.trim().toLowerCase());
   if(more){if(!cursor)return;}else{
    if(matches.length!==1){state('Choose one unique faculty name from the list.');return;}
    selected=String(matches[0].facultyId||'');
   }
   const mode=$('availability-mode').value,startDate=date($('availability-start').value),endDate=date($('availability-end').value);
   if(!more&&((mode!=='upcoming'&&!startDate)||(mode==='range'&&(!endDate||endDate<startDate)))){state('Choose a valid start date and date range.');return;}
   loading=true;$('availability-search').disabled=true;const token=more?generation:++generation;
   if(!more){items=[];cursor=null;render();}
   state('Checking authorized SQL availability…');
   try{
    const result=await api.facultyAvailability({facultyId:selected,mode,startDate:mode==='upcoming'?null:startDate,endDate:mode==='range'?endDate:null,kind:$('availability-kind').value,cursor:more?cursor:null,limit:50});
    if(token!==generation)return;
    const seen=new Set(items.map(r=>r.eventKey));
    for(const row of result.items||[])if(!seen.has(row.eventKey)){items.push(row);seen.add(row.eventKey);}
    cursor=result.nextCursor||null;coverage=result.coverage||null;render();
    state('Showing '+items.length+' of '+result.total+' records. '+(cursor?'More records available.':'Query complete.')+' PAWS does not include external calendar meetings.');
   }catch(error){if(token===generation)state('Availability unavailable ('+String(error?.code||'read failed')+'). No free-time conclusion can be made.');}
   finally{loading=false;$('availability-search').disabled=false;}
  }
  $('availability-search').addEventListener('click',()=>search(false));
  $('availability-more').addEventListener('click',()=>search(true));
  picker.addEventListener('change',()=>{selected='';});
  return Object.freeze({open:()=>loadRoster(),clear:()=>{generation++;items=[];cursor=null;roster=[];render();}});
 }
 root.PAWS_FACULTY_AVAILABILITY={createFacultyAvailability};
 if(root.document&&root.UCVM_PAWS_DATA){
   const host=root.document.getElementById('availability-view');
   const tab=root.document.querySelector('[data-tab="availability"]');
   if(host&&tab){
     const view=createFacultyAvailability({api:root.UCVM_PAWS_DATA,host});
     tab.addEventListener('click',()=>view.open());
     root.document.getElementById('signout-btn')?.addEventListener('click',()=>view.clear());
   }
 }
})(typeof window!=='undefined'?window:globalThis);
