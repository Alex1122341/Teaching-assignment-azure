(function(root,factory){
 'use strict';const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.PAWS_TESTED_CALENDAR=api;
})(typeof window==='undefined'?null:window,function(root){
 'use strict';
 // Current AFC policy dates; parity tested against server policy.
 const names=[
 ['2026-01-01',"New Year's Day"],['2026-02-16','Family Day'],['2026-04-03','Good Friday'],['2026-04-06','Easter Monday'],['2026-05-18','Victoria Day'],['2026-07-01','Canada Day'],['2026-08-03','Heritage Day'],['2026-09-07','Labour Day'],['2026-09-30','National Day for Truth and Reconciliation'],['2026-10-12','Thanksgiving Day'],['2026-11-11','Remembrance Day'],['2026-12-25','Christmas Day'],
 ...['28','29','30','31'].map(d=>['2026-12-'+d,'Holiday Observance - University Closed']),
 ['2027-01-01',"New Year's Day"],['2027-02-15','Family Day'],['2027-03-26','Good Friday'],['2027-03-29','Easter Monday'],['2027-05-24','Victoria Day'],['2027-07-01','Canada Day'],['2027-08-02','Heritage Day'],['2027-09-06','Labour Day'],['2027-09-30','National Day for Truth and Reconciliation'],['2027-10-11','Thanksgiving Day'],['2027-11-11','Remembrance Day'],
 ...['27','28','29','30','31'].map(d=>['2027-12-'+d,'Holiday Observance - University Closed'])
 ];
 const closures=Object.freeze(names.map(([date,name])=>Object.freeze({date,name})));
 const valid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 function withClosures(rows,range,enabled){
  if(!enabled||!valid(range?.start)||!valid(range?.end)||range.start>=range.end)return rows;
  return [...rows,...closures.filter(r=>r.date>=range.start&&r.date<range.end).map(({date,name})=>{
   const year=Number(date.slice(0,4))-(Number(date.slice(5,7))<5?1:0);
   return {id:'university-closure:'+date,date,academicYear:year+'-'+String(year+1).slice(-2),year:null,course:'University Closed',type:'Closure',topic:name,room:'',instructor:'',assignments:[],start:'07:30',end:'17:00',timeUnknown:false,isUniversityClosure:true,isWorkingActivity:true,readOnlyActivity:true};
  })];
 }
 function notices(user,afc,swaps,isAdmin){
  const uid=String(user?.uid||'');if(!uid)return [];
  const rows=[],add=(key,count,label,target)=>{if(count)rows.push({key,count,label,target});},count=(items,pred)=>(Array.isArray(items)?items:[]).filter(pred).length;
  if(isAdmin===true)add('afc-admin',count(afc,r=>r.status==='pending_admin'),'AFC requests awaiting office review','afc-request-btn');
  add('afc-report-to',count(afc,r=>r.status==='pending_report_to'&&r.reportToFirebaseUid===uid),'AFC requests awaiting your Reports To review','afc-request-btn');
  add('afc-decided',count(afc,r=>r.requesterFirebaseUid===uid&&['approved','rejected'].includes(r.status)),'Your AFC requests with a decision','afc-request-btn');
  add('swap-pending',count(swaps,r=>r.status==='pending'&&r.canDecide===true),'SWAP requests awaiting your decision','swap-inbox-btn');
  return rows;
 }
 let generation=0,shownUid='',panel=null;
 function clearNotifications(){generation++;shownUid='';if(panel)panel.remove();panel=null;}
 async function showNotifications(user,{getUser,api,isAdmin=false}={}){
  if(!root||!user?.uid||typeof getUser!=='function'||!api)return;
  const uid=String(user.uid);if(shownUid===uid)return;
  clearNotifications();shownUid=uid;
  const token=generation,key='paws-workflow-notice-dismissed:'+uid;
  try{if(root.sessionStorage.getItem(key)==='1')return;}catch(_){}
  const results=await Promise.allSettled([Promise.resolve().then(()=>api.listAfcRequests()),Promise.resolve().then(()=>api.swapQueue())]);
  if(generation!==token||getUser()?.uid!==uid)return;
  const rows=notices(user,results[0].status==='fulfilled'?results[0].value:[],results[1].status==='fulfilled'?results[1].value?.requests:[],isAdmin);
  if(!rows.length)return;
  const doc=root.document;
  panel=doc.createElement('aside');panel.className='paws-workflow-notice';panel.setAttribute('aria-label','Workflow notifications');
  const h=doc.createElement('h2');h.textContent='Workflow notifications';panel.append(h);
  const list=doc.createElement('ul');
  function dismiss(){if(generation!==token)return;panel?.remove();panel=null;try{root.sessionStorage.setItem(key,'1');}catch(_){}}
  for(const row of rows){const item=doc.createElement('li'),label=doc.createElement('span'),open=doc.createElement('button');
   label.textContent=row.count+' '+row.label;open.type='button';open.className='btn btn-secondary';open.textContent='Open';open.setAttribute('aria-label','Open '+row.label);
   open.onclick=()=>{if(generation!==token||getUser()?.uid!==uid)return;const target=doc.getElementById(row.target);if(target){dismiss();target.click();}};
   item.append(label,open);list.append(item);
  }
  panel.append(list);const close=doc.createElement('button');close.type='button';close.className='btn btn-secondary';close.textContent='Dismiss';close.onclick=dismiss;panel.append(close);doc.body.append(panel);
 }
 return Object.freeze({closures,withClosures,notices,showNotifications,clearNotifications});
});
