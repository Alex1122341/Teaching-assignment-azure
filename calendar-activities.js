(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PAWS_CALENDAR_ACTIVITIES=api.createCalendarActivityView({api:root.UCVM_PAWS_DATA,getUser:()=>root.firebase?.auth?.().currentUser});})(typeof window==='undefined'?null:window,function(root){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 const validTime=value=>typeof value==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
 const labels={ccc:'CCC',rotation_participant:'Fourth-year rotation',clinical_day:'Clinical day',vetm581_rounds:'VETM 581 rounds',vetm571_clinical_pharmacology:'VETM 571',vetm591_presentations:'VETM 591',teaching_excellence:'Teaching excellence',remote_work:'Remote work'};
 function times(row){const unique=new Map();for(const entry of Array.isArray(row.timeEvidence)?row.timeEvidence:[]){if(validDate(entry.date)&&entry.date>=row.startDate&&entry.date<=row.endDate&&validTime(entry.startTime)&&validTime(entry.endTime)&&entry.startTime<entry.endTime)unique.set(entry.date,{date:entry.date,startTime:entry.startTime,endTime:entry.endTime});}return [...unique.values()].sort((a,b)=>a.date.localeCompare(b.date));}
 function renderRangeLane(activities,{start,end,filters={}}={}){
  const rows=(Array.isArray(activities)?activities:[]).filter(row=>validDate(row.startDate)&&validDate(row.endDate)&&(!start||row.endDate>=start)&&(!end||row.startDate<end)
   &&(!filters.category||filters.category==='all'||row.category===filters.category)&&(!filters.facultyKey||row.facultyKey===filters.facultyKey)
   &&(row.category==='ccc'?filters.showCcc!==false:filters.showWorking!==false)
   &&(!filters.search||[row.label,row.facultyDisplayName,row.courseCode].join(' ').toLowerCase().includes(String(filters.search).toLowerCase())))
   .sort((a,b)=>a.startDate.localeCompare(b.startDate)||String(a.facultyDisplayName).localeCompare(String(b.facultyDisplayName)));
  const body=rows.map(row=>{
   const evidence=times(row),dayCount=(Date.parse(row.endDate)-Date.parse(row.startDate))/86400000+1,verified=evidence.length===dayCount;
   const name=root?.PAWS_FACULTY_NAME?.format?.({displayName:row.facultyDisplayName})||row.facultyDisplayName||'Not provided';
   return `<tr><td><strong>${esc(row.label||labels[row.category]||'Working activity')}</strong><span class="activity-category">${esc(labels[row.category]||'Working activity')}</span></td><td>${esc(name)}</td><td class="activity-source-dates">${esc(row.startDate)}<span>to ${esc(row.endDate)}</span><small>Original inclusive range</small></td><td><span class="activity-state ${verified?'activity-verified':'activity-review'}">${verified?'Time verified':'Needs Review'}</span>${evidence.length?evidence.map(value=>`<span class="activity-time">${esc(value.date)} · ${esc(value.startTime)}–${esc(value.endTime)}</span>`).join(''):'<span class="activity-time">Time: Not provided</span>'}${!verified&&evidence.length?'<small>Other dates: Not provided</small>':''}</td><td><span>Course: ${esc(row.courseCode||'Not provided')}</span><small>Room: Not provided · Group: Not provided</small></td></tr>`;
  }).join('');
  return `<section class="working-activity-section" aria-label="Working activities"><header><div><span class="activity-eyebrow">WORKING ACTIVITIES</span><h3>Work recorded beyond teaching sessions</h3></div><span class="activity-count">${rows.length} ${rows.length===1?'range':'ranges'}</span></header><p class="activity-note">Source date ranges are preserved, including weekends. Unconfirmed times remain Needs Review for SWAP.</p>${rows.length?`<div class="activity-table-wrap"><table class="activity-table"><thead><tr><th>Activity</th><th>Faculty</th><th>Source dates</th><th>Verified time</th><th>Details</th></tr></thead><tbody>${body}</tbody></table></div>`:'<p class="activity-empty">No working activities match this range and filter.</p>'}</section>`;
 }
 function createCalendarActivityView({api,getUser=()=>null}){
  let generation=0;
  const user=()=>String(getUser()?.uid||'');
  async function loadRange(range){
   const token=++generation,uid=user();if(!uid)return[];
   const result=[],seen=new Set();let cursor=null;
   do{
    const page=await api.listCalendarActivities({...range,...(cursor?{cursor}:{})});if(token!==generation||uid!==user())return[];
    if(!Array.isArray(page.activities))throw Error('Working activities could not be read. Teaching sessions remain available.');
    result.push(...page.activities);if(result.length>5000)throw Error('Working activity paging limit exceeded. Choose a smaller date range.');
    cursor=page.nextCursor||null;if(cursor){if(seen.has(cursor)||seen.size>=50)throw Error('Working activity paging cursor repeated.');seen.add(cursor);}
   }while(cursor);
   return result;
  }
  async function loadFacultyRange(facultyId,range,{self=false}={}){
   if(self)return loadRange(range);
   const token=++generation,uid=user();if(!uid)return[];
   const mapping=await api.listCalendarActivities({...range,limit:1,includeFacultyKeys:true});if(token!==generation||uid!==user())return[];
   const key=(mapping.facultyKeys||[]).find(value=>String(value.facultyId).toLowerCase()===String(facultyId).toLowerCase())?.facultyKey;
   if(!key)return[];
   return loadRange({...range,facultyKey:key});
  }
  return Object.freeze({loadRange,loadFacultyRange,renderRangeLane,renderFacultyActivities:activities=>renderRangeLane(activities),clear(){generation++;}});
 }
 return {createCalendarActivityView,renderRangeLane};
});
