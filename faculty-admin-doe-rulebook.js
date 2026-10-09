(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const text = value => String(value ?? '').trim();
  const clone = value => JSON.parse(JSON.stringify(value));
  const reviews = ['needs_review','approved','updated','new','retired'];
  const modes = ['fixed','per_hour','per_shift','per_week','per_trainee','tiered','minimum','capped','percentage_of_target','prorated','formula'];
  const reserveKeys = ['splitThreshold','splitRatio','highTeachingTraineeCeiling','teachingFocusedTraineeCeiling','rollingAverageYears'];
  const categories = [['all','All categories'],['teaching','Teaching Rules'],['role','Role Rules'],['supervision','Supervision & Complex'],['target','Target Rules'],['exceptions','Exceptions']];
  const groups = [['all','All groups'],['assigned','Assigned Teaching'],['coordination','Course Coordination'],['clinical','Clinical Rotations'],['supervision','Supervision'],['hicc','HICC / VISC'],['reserve','Reserve Logic'],['other','Other / Approved Activities']];
  const field = (key,label,type='text',options=null,required=false) => ({key,label,type,options,required});
  const common = [field('reviewStatus','Annual review','select',reviews),field('enabled','Enabled','checkbox')];
  const referenceField = field('referenceId','Linked reference','reference');
  const schemas = {
    rules: [field('ruleKey','Stable rule key','text',null,true),field('ruleLabel','Rule title','text',null,true),field('category','Category','select',['teaching','assigned_teaching','course_coordination','rotation','supervision','hicc','visc','reserve','adjustment','exception','approved_activity','target','other']),field('activityType','Activity type'),field('calculationMode','Calculation mode','select',modes),field('priority','Match priority','number'),field('resultKind','Result kind','select',['credit','target','reserve']),field('tierStrategy','Tier strategy','select',['','progressive','lookup']),field('mappingRequirement','Required mapping','select',['','course','subject']),field('formulaText','Formula','textarea'),referenceField,...common],
    references: [field('referenceId','Reference ID','id'),field('title','Document title','text',null,true),field('section','Section'),field('tableName','Table'),field('pageNumber','Page','number'),field('effectiveDate','Effective date','date'),field('sourceReference','Source / provenance'),field('documentLink','Document link','url'),field('reviewStatus','Annual review','select',reviews),field('notes','Notes','textarea')],
    courseMappings: [field('courseCode','Canonical course code','text',null,true),field('unitCount','Course units','number'),field('curriculumStage','Curriculum stage'),field('hiccEligible','HICC eligibility','nullableBoolean'),referenceField,...common,field('mappingFacts','Additional mapping facts','object')],
    subjectMappings: [field('subjectKey','Canonical subject key','text',null,true),field('subjectName','Subject name','text',null,true),field('curriculumStage','Curriculum stage'),field('developmentPhase','Development phase'),referenceField,...common,field('mappingFacts','Additional mapping facts','object')],
    exceptions: [field('category','Category'),field('scopeType','Scope','select',['global','faculty','session','course','role','assignment','source_entity']),field('scopeKey','Scope value'),field('facultyId','Faculty ID'),field('fixedDoe','Fixed DOE (%)','number',null,true),field('resultKind','Result kind','select',['credit','target','reserve']),field('reason','Approval reason','textarea',null,true),field('sourceReference','Source evidence','textarea',null,true),field('effectiveStart','Effective start','date'),field('effectiveEnd','Effective end','date'),field('recurring','Recurring','checkbox'),...common],
    reservePolicy: [field('splitThreshold','Teaching split threshold (%)','number',null,true),field('splitRatio','Split ratio (0–1)','number',null,true),field('highTeachingTraineeCeiling','High teaching trainee ceiling (%)','number',null,true),field('teachingFocusedTraineeCeiling','Teaching focused trainee ceiling (%)','number',null,true),field('rollingAverageYears','Rolling average years','number',null,true),referenceField,field('reviewStatus','Annual review','select',reviews)],
    selectors: [field('field','Context field','text',null,true),field('operator','Operator','select',['equals','not_equals','in','not_in','gt','gte','lt','lte']),field('valueType','Value type','select',['text','number']),field('valueText','Text value'),field('valueNumber','Numeric value','number'),field('values','Set values (JSON array)','array')],
    inputs: [field('inputName','Required fact','text',null,true),field('source','Source'),field('required','Required','checkbox')],
    parameters: [field('name','Parameter (rate, cap, fixed…)','text',null,true),field('valueNumber','Numeric value','number'),field('valueText','Text value')],
    tiers: [field('tierOrder','Order','number',null,true),field('fromValue','From (inclusive)','number',null,true),field('toValue','To (blank = unbounded)','number'),field('rate','Rate','number'),field('fixedCredit','Fixed credit (%)','number')]
  };
  const labels = {rules:'Rules',references:'References',courseMappings:'Course mappings',subjectMappings:'VISC subjects',exceptions:'Approved exceptions',reservePolicy:'Reserve Logic'};
  function groupOf(row) {
    const value = `${row.ruleKey || ''} ${row.activityType || ''} ${row.ruleLabel || ''}`.toLowerCase();
    if(row.category === 'reserve' || /reserve/.test(value))return 'reserve';
    if(['hicc','visc'].includes(row.category)||/hicc|visc/.test(value))return 'hicc';
    if(row.category==='course_coordination'||/coordination|coordinator|coordinate/.test(value) && !/clinical|rotation/.test(value))return 'coordination';
    if(row.category==='rotation'||/clinical|rotation/.test(value))return 'clinical';
    if(row.category === 'supervision' || /supervis|trainee/.test(value))return 'supervision';
    if(['teaching','assigned_teaching'].includes(row.category)||/lecture|laboratory|srl/.test(value))return 'assigned';
    return 'other';
  }
  function create({onChange=()=>{},editable=()=>false,onError=()=>{}}={}) {
    let root=null,bundle={},dirty=false,panel='rules',category='all',group='all',search='',editing=null,locked=false;
    const node = id => root?.querySelector(`#${id}`);
    const refName = id => {const r=(bundle.references||[]).find(r=>r.referenceId===id);return r?[r.title,r.section&&`§${r.section}`,r.tableName,r.pageNumber!=null&&`p.${r.pageNumber}`].filter(Boolean).join(' · '):id||'Reference required';};
    function mark(){dirty=true;onChange();}
    function inputHtml(def,value,path,disabled=false) {
      const attr=`data-field="${esc(def.key)}" data-path="${esc(path)}" ${disabled?'disabled':''} ${def.required?'required':''}`;
      let control;
      if(def.type==='checkbox')control=`<input type="checkbox" ${attr} ${value!==false?'checked':''}>`;
      else if(def.type==='nullableBoolean')control=`<select class="select" ${attr}>${[['','Unknown'],['true','Yes'],['false','No']].map(([v,l])=>`<option value="${v}" ${(value==null?'':String(value))===v?'selected':''}>${l}</option>`).join('')}</select>`;
      else if(def.type==='select'||def.type==='reference'){
        const choices=def.type==='reference'?[['','No reference selected'],...(bundle.references||[]).map(r=>[r.referenceId,refName(r.referenceId)])]:(def.options||[]).map(v=>[v,v.replace(/_/g,' ')||'Not specified']);
        if(value && !choices.some(([v])=>v===value))choices.push([value,value]);
        control=`<select class="select" ${attr}>${choices.map(([v,l])=>`<option value="${esc(v)}" ${value===v?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
      } else if(['textarea','array','object'].includes(def.type))control=`<textarea class="input" rows="${def.type==='textarea'?2:3}" ${attr}>${esc(def.type==='array'||def.type==='object'?value==null?'':JSON.stringify(value,null,2):value)}</textarea>`;
      else control=`<input class="input" type="${def.type==='id'?'text':def.type}" ${def.type==='number'?'step="any"':''} ${attr} value="${esc(def.type==='date'?text(value).slice(0,10):value)}" ${def.type==='id'?'readonly':''}>`;
      return `<label class="field ${['textarea','object','array'].includes(def.type)?'doe-field-wide':''}"><span class="field-label">${esc(def.label)}</span>${control}</label>`;
    }
    function readFields(container,defs,original){
      const result={...original};
      for(const def of defs){
        const element=container.querySelector(`[data-field="${def.key}"]`);if(!element||element.disabled)continue;
        const raw=element.value;
        if(def.type==='checkbox')result[def.key]=element.checked;
        else if(def.type==='number'){
          result[def.key]=raw===''?null:Number(raw);
          if(raw!==''&&!Number.isFinite(result[def.key]))throw new Error(`${def.label} must be a finite number.`);
        } else if(def.type==='nullableBoolean')result[def.key]=raw===''?null:raw==='true';
        else if(def.type==='array'||def.type==='object'){
          if(!text(raw)){if(Object.prototype.hasOwnProperty.call(original,def.key))result[def.key]=def.type==='array'?[]:{};continue;}
          try{result[def.key]=JSON.parse(raw);}catch(_){throw new Error(`${def.label} must be valid JSON.`);}
          if(def.type==='array'?!Array.isArray(result[def.key]):!result[def.key]||typeof result[def.key]!=='object'||Array.isArray(result[def.key]))throw new Error(`${def.label} must be a JSON ${def.type}.`);
        } else result[def.key]=['date','reference'].includes(def.type)&&!raw?null:text(raw);
        if(def.required&&(result[def.key]===null||result[def.key]===''))throw new Error(`${def.label} is required.`);
      }
      return result;
    }
    function table(key){
      let rows=(bundle[key]||[]).map((row,index)=>({row,index}));
      const categoryMatches=row=>category==='all'||(category==='teaching'?['teaching','assigned_teaching','rotation'].includes(row.category):category==='role'?['course_coordination','hicc','visc','adjustment','approved_activity'].includes(row.category):category==='supervision'?['supervision','reserve','other'].includes(row.category):row.category===category);
      if(key==='rules')rows=rows.filter(({row})=>categoryMatches(row)&&(group==='all'||groupOf(row)===group)&&(!search||JSON.stringify(row).toLowerCase().includes(search)));
      const columns=key==='rules'?['Rule / key','Selectors / inputs','Calculation / rate / cap','Reference','Review']:key==='references'?['Document','Section / table / page','Effective / source','Review']:key==='courseMappings'?['Course','Units / stage','HICC','Reference','Review']:key==='subjectMappings'?['Subject','Stage / development','Reference','Review']:['Scope','DOE / kind','Reason / evidence','Effective','Review'];
      function cells(row){
        const review=esc(text(row.reviewStatus).replace(/_/g,' ')||'needs review');
        const ref=esc(refName(row.referenceId));
        if(key==='rules')return [`<strong>${esc(row.ruleLabel||row.ruleKey)}</strong><small>${esc(row.ruleKey)} · ${esc(row.category)}${row.enabled===false?' · disabled':''}</small>`,`${(row.selectors||[]).map(s=>esc(`${s.field} ${s.operator} ${s.values?JSON.stringify(s.values):s.valueNumber??s.valueText??'—'}`)).join('<br>')||'All matching contexts'}<small>Facts: ${esc((row.inputs||[]).map(i=>typeof i==='string'?i:i.inputName).join(', ')||'None declared')}</small>`,`${esc(row.calculationMode)}<small>${esc((row.parameters||[]).map(p=>`${p.name} = ${p.valueNumber??p.valueText??'—'}`).join(' · '))}</small>${row.tiers?.length?`${row.tiers.length} tier(s)`:''}${row.formulaText?`<small>${esc(row.formulaText)}</small>`:''}`,ref,review];
        if(key==='references')return [esc(row.title),esc([row.section,row.tableName,row.pageNumber!=null?`p.${row.pageNumber}`:''].filter(Boolean).join(' · ')),`${esc(row.effectiveDate||'Not specified')}<small>${esc(row.sourceReference)}</small>`,review];
        if(key==='courseMappings')return [esc(row.courseCode),`${esc(row.unitCount??'Missing units')}<small>${esc(row.curriculumStage||'Missing stage')}</small>`,row.hiccEligible==null?'Unknown':row.hiccEligible?'Yes':'No',ref,review];
        if(key==='subjectMappings')return [`<strong>${esc(row.subjectName||row.subjectKey)}</strong><small>${esc(row.subjectKey)}</small>`,esc([row.curriculumStage||'Missing stage',row.developmentPhase||'Missing development'].join(' · ')),ref,review];
        return [esc(`${row.scopeType||'global'}: ${row.scopeKey||row.facultyId||'All'}`),`${esc(row.fixedDoe??'Missing')}% · ${esc(row.resultKind)}`,`${esc(row.reason)}<small>${esc(row.sourceReference)}</small>`,esc([row.effectiveStart,row.effectiveEnd].filter(Boolean).join(' to ')||'Not specified'),review];
      }
      return `<div class="doe-table-scroll"><table class="doe-rule-table"><thead><tr>${columns.map(c=>`<th scope="col">${c}</th>`).join('')}<th scope="col">Actions</th></tr></thead><tbody>${rows.map(({row,index})=>`<tr>${cells(row).map(c=>`<td>${c}</td>`).join('')}<td><button type="button" class="btn btn-small" data-edit="${key}" data-index="${index}">${editable()?'Edit':'View'}</button></td></tr>`).join('')||`<tr><td colspan="${columns.length+1}" class="empty">${bundle.version?'No matching entries.':'Select a Policy Version to view its rule book.'}</td></tr>`}</tbody></table></div>`;
    }
    function render(){
      if(!root)return;
      node('doe-rulebook-tabs').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.panel===panel);b.setAttribute('aria-pressed',String(b.dataset.panel===panel));});
      const key=category==='exceptions'&&panel==='rules'?'exceptions':panel;
      node('doe-rulebook-filters').hidden=panel!=='rules';
      node('doe-rulebook-category').value=category;node('doe-rulebook-group').value=group;
      node('doe-rulebook-content').innerHTML=key==='reservePolicy'?`<div class="doe-reserve-summary">${schemas.reservePolicy.map(d=>`<div><span>${esc(d.label)}</span><strong>${esc(d.key==='referenceId'?refName(bundle.reservePolicy?.referenceId):bundle.reservePolicy?.[d.key]??'Not configured')}</strong></div>`).join('')}</div><p class="aux-note">Reserve calculations run before negotiated manual DOE. Parameter edits require a Reserve rule; the linked reference and annual approval are stored on that rule.</p>`:table(key);
      node('doe-rulebook-add').textContent=key==='reservePolicy'?'Edit Reserve Logic':`Add ${key==='rules'?'Rule':key==='references'?'Reference':key==='exceptions'?'Exception':'Mapping'}`;
      node('doe-rulebook-add').disabled=locked||!editable();
      node('doe-rulebook-dirty').textContent=dirty?'Unsaved draft changes · Save Draft before validation or preview.':'Saved version';
    }
    function nestedHtml(key,rows){return `<fieldset class="doe-nested"><legend>${esc(key==='inputs'?'Declared inputs':key)}</legend><div data-nested="${key}">${rows.map((raw,index)=>{const row=typeof raw==='string'?{inputName:raw,required:true}:raw;return `<div class="doe-nested-row" data-row="${index}">${schemas[key].map(d=>inputHtml(d,row[d.key],key,!editable())).join('')}<button class="btn btn-small" data-remove="${key}" data-row="${index}" type="button" ${editable()?'':'disabled'}>Remove</button></div>`;}).join('')}</div><button class="btn btn-small" data-add-nested="${key}" type="button" ${editable()?'':'disabled'}>Add ${esc(key==='inputs'?'input':key.replace(/s$/,''))}</button></fieldset>`;}
    function drawEditor(){
      const {key,row}=editing;
      node('doe-rulebook-editor-title').textContent=`${editable()?'Edit':'View'} ${labels[key]}`;
      node('doe-rulebook-editor-fields').innerHTML=`<div class="doe-editor-grid">${schemas[key].map(d=>inputHtml(d,row[d.key],'root',!editable())).join('')}</div>${key==='rules'?['selectors','inputs','parameters','tiers'].map(k=>nestedHtml(k,row[k]||[])).join(''):''}`;
      node('doe-rulebook-editor-apply').hidden=!editable();
      node('doe-rulebook-editor-error').textContent='';
    }
    function readEditor(){
      const {key,row}=editing,result=readFields(node('doe-rulebook-editor-fields'),schemas[key],row);
      if(key==='rules')for(const nested of ['selectors','inputs','parameters','tiers']){
        result[nested]=[...node('doe-rulebook-editor-fields').querySelectorAll(`[data-nested="${nested}"] > [data-row]`)].map((element,index)=>readFields(element,schemas[nested],typeof row[nested]?.[index]==='string'?{inputName:row[nested][index]}:row[nested]?.[index]||{}));
      }
      if(key==='rules'){
        result.mappingRequirement=result.mappingRequirement||null;
        for(const selector of result.selectors){
          if(['in','not_in'].includes(selector.operator)){
            if(!Array.isArray(selector.values)||!selector.values.length)throw new Error('Set selectors require a nonempty JSON array of values.');
          }else{
            delete selector.values;delete selector.valuesJson;
            if(selector.valueType==='number')selector.valueText=null;else selector.valueNumber=null;
          }
        }
      }
      if(key==='exceptions')result.facultyId=result.facultyId||null;
      return result;
    }
    function openEditor(key,index){
      if(locked)return;
      if(index<0&&!editable())return;
      const original=key==='reservePolicy'?bundle.reservePolicy||{}:bundle[key]?.[index];
      const row=clone(original||{reviewStatus:'needs_review',enabled:true});
      if(!original&&key!=='reservePolicy')row[key==='rules'?'ruleId':key==='references'?'referenceId':key==='exceptions'?'exceptionId':'mappingId']=crypto.randomUUID();
      if(key==='rules'&&!original){const groupCategory={assigned:'assigned_teaching',coordination:'course_coordination',clinical:'rotation',supervision:'supervision',hicc:'hicc',reserve:'reserve',other:'approved_activity'};const initialCategory=groupCategory[group]||(category==='role'?'course_coordination':category==='supervision'?'supervision':category==='target'?'target':'teaching');Object.assign(row,{category:initialCategory,calculationMode:'fixed',resultKind:initialCategory==='target'?'target':'credit',priority:0,selectors:[],inputs:[],parameters:[],tiers:[]});}
      editing={key,index,row};drawEditor();node('doe-rulebook-editor').showModal();
    }
    function mount(host){
      root=host;
      root.innerHTML=`<nav class="doe-rulebook-tabs" id="doe-rulebook-tabs" aria-label="Rule Book tables">${[['rules','Rule Book'],['courseMappings','Course Mapping'],['subjectMappings','VISC Subjects'],['references','References'],['reservePolicy','Reserve Logic']].map(([key,label])=>`<button class="btn" type="button" data-panel="${key}">${label}</button>`).join('')}</nav><div class="doe-rulebook-filters" id="doe-rulebook-filters"><label class="field"><span class="field-label">Category</span><select class="select" id="doe-rulebook-category">${categories.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><label class="field"><span class="field-label">Rule group</span><select class="select" id="doe-rulebook-group">${groups.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><label class="field"><span class="field-label">Find rule</span><input class="input" id="doe-rulebook-search" type="search" placeholder="Key, selector, reference…"></label></div><div class="doe-rulebook-table-actions"><button type="button" class="btn" id="doe-rulebook-add">Add Rule</button><span class="aux-note" id="doe-rulebook-dirty"></span></div><div id="doe-rulebook-content"></div><dialog class="doe-rule-dialog" id="doe-rulebook-editor" aria-labelledby="doe-rulebook-editor-title"><form id="doe-rulebook-editor-form"><div class="doe-dialog-heading"><h3 id="doe-rulebook-editor-title"></h3><button type="button" class="btn" data-close-editor aria-label="Close editor">Close</button></div><p class="aux-note">Apply changes to the working Draft, then Save Draft to persist them. Unedited fields and identities are preserved.</p><div id="doe-rulebook-editor-fields"></div><p id="doe-rulebook-editor-error" class="error" role="alert"></p><div class="form-actions"><button type="button" class="btn" data-close-editor>Cancel</button><button type="submit" class="btn btn-primary" id="doe-rulebook-editor-apply">Apply to Draft</button></div></form></dialog>`;
      root.addEventListener('click',event=>{
        const button=event.target.closest('button');if(!button)return;
        try{
          if(button.dataset.panel){panel=button.dataset.panel;render();}
          else if(button.dataset.edit)openEditor(button.dataset.edit,Number(button.dataset.index));
          else if(button.id==='doe-rulebook-add')openEditor(category==='exceptions'&&panel==='rules'?'exceptions':panel,-1);
          else if(button.hasAttribute('data-close-editor'))node('doe-rulebook-editor').close();
          else if(button.dataset.addNested||button.dataset.remove){
            const key=button.dataset.addNested||button.dataset.remove;editing.row=readEditor();
            if(button.dataset.addNested)editing.row[key].push(key==='inputs'?{required:true}:key==='selectors'?{operator:'equals',valueType:'text'}:key==='tiers'?{tierOrder:editing.row[key].length,fromValue:0}:{});
            else editing.row[key].splice(Number(button.dataset.row),1);
            drawEditor();
          }
        }catch(error){node('doe-rulebook-editor-error').textContent=error.message;onError(error.message);}
      });
      node('doe-rulebook-category').addEventListener('change',event=>{category=event.target.value;render();});
      node('doe-rulebook-group').addEventListener('change',event=>{group=event.target.value;render();});
      node('doe-rulebook-search').addEventListener('input',event=>{search=event.target.value.toLowerCase();render();});
      node('doe-rulebook-editor-form').addEventListener('submit',event=>{
        event.preventDefault();if(!editable()||locked)return;
        try{
          const row=readEditor(),{key,index}=editing;
          if(key==='courseMappings')row.courseCode=text(row.courseCode).toUpperCase();
          if(key==='reservePolicy'){
            if(!(row.splitRatio>=0&&row.splitRatio<=1)||!(row.rollingAverageYears>=1&&row.rollingAverageYears<=10&&Number.isInteger(row.rollingAverageYears))||['splitThreshold','highTeachingTraineeCeiling','teachingFocusedTraineeCeiling'].some(k=>row[k]<0||row[k]>100))throw new Error('Reserve requires percentages between 0 and 100, ratio between 0 and 1, and a whole rolling year count between 1 and 10.');
            if(!(bundle.rules||[]).some(r=>r.category==='reserve'))throw new Error('Add a Reserve rule and its reference in Rule Book before configuring Reserve Logic.');
            bundle.reservePolicy=row;
            const reserve=bundle.rules.find(r=>r.category==='reserve');
            reserve.referenceId=row.referenceId||null;reserve.reviewStatus=row.reviewStatus;
            reserve.parameters=[...(reserve.parameters||[]).filter(p=>!reserveKeys.includes(p.name)),...reserveKeys.map(name=>({...(reserve.parameters||[]).find(p=>p.name===name),name,valueNumber:row[name],valueText:null}))];
          }else{
            bundle[key] ||= [];if(index<0)bundle[key].push(row);else bundle[key][index]=row;
            if(key==='rules'&&row.category==='reserve')bundle.reservePolicy={...Object.fromEntries((row.parameters||[]).filter(p=>reserveKeys.includes(p.name)&&p.valueNumber!=null).map(p=>[p.name,p.valueNumber])),referenceId:row.referenceId,reviewStatus:row.reviewStatus};
          }
          mark();render();node('doe-rulebook-editor').close();
        }catch(error){node('doe-rulebook-editor-error').textContent=error.message;}
      });
      render();
    }
    return Object.freeze({mount,setBundle(value){bundle=clone(value||{});const reserve=(bundle.rules||[]).find(r=>r.category==='reserve');if(reserve){if(!bundle.reservePolicy)bundle.reservePolicy=Object.fromEntries((reserve.parameters||[]).filter(p=>reserveKeys.includes(p.name)&&p.valueNumber!=null).map(p=>[p.name,p.valueNumber]));bundle.reservePolicy={...bundle.reservePolicy,referenceId:reserve.referenceId,reviewStatus:reserve.reviewStatus};}dirty=false;node('doe-rulebook-editor')?.close();render();},refresh:render,isDirty:()=>dirty,editorOpen:()=>Boolean(node('doe-rulebook-editor')?.open),setLocked(value){locked=Boolean(value);render();},getPatch(){
      const patch={};for(const key of ['rules','references','courseMappings','subjectMappings','exceptions'])patch[key]=clone(bundle[key]||[]);
      for(const rule of patch.rules)for(const selector of rule.selectors||[]){if(Array.isArray(selector.values))selector.valuesJson=JSON.stringify(selector.values);}
      for(const key of ['courseMappings','subjectMappings'])for(const row of patch[key])if(row.mappingFacts)row.mappingFactsJson=JSON.stringify(row.mappingFacts);
      if(bundle.reservePolicy&&(bundle.rules||[]).some(r=>r.category==='reserve'))patch.reservePolicy=Object.fromEntries(reserveKeys.filter(k=>bundle.reservePolicy[k]!=null).map(k=>[k,bundle.reservePolicy[k]]));
      return patch;
    }});
  }
  window.UCVM_FACULTY_DOE_RULEBOOK=Object.freeze({create});
})();
