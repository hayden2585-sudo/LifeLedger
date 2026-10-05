/* ================================================================
   VIEW: PROJECTS & SPECIAL BUDGETS
   ================================================================ */
const PROJECT_TYPES=[['home','Home'],['event','Event / celebration'],['major_purchase','Major purchase'],['other','Other special project']];
const PROJECT_STATUSES=[['planning','Planning'],['active','Active'],['on_hold','On hold'],['completed','Completed'],['cancelled','Cancelled']];
const PROJECT_PRIORITIES=[['normal','Normal'],['high','High'],['emergency','🔴 Emergency']];
function projectOptionsForLedger(sel){return '<option value="">— none —</option>'+state.projects.filter(p=>p.status!=='completed'&&p.status!=='cancelled').map(p=>'<option value="'+p.id+'" '+(p.id===sel?'selected':'')+'>'+projectTypeEmoji(p.type)+' '+esc(p.name)+'</option>').join('')}
function projectItemOptionsForLedger(pid,sel){const p=state.projects.find(x=>x.id===pid);if(!p)return '<option value="">— none —</option>';return '<option value="">— unallocated —</option>'+p.items.map(i=>'<option value="'+i.id+'" '+(i.id===sel?'selected':'')+'>'+esc(i.name)+'</option>').join('')}
function refreshProjectItems(pfx){const pid=$(pfx+'Project')?.value||'';const wrap=$(pfx+'ProjectItemWrap');const sel=$(pfx+'ProjectItem');if(!wrap||!sel)return;wrap.style.display=pid?'block':'none';sel.innerHTML=projectItemOptionsForLedger(pid,sel.value)}
function toggleProjectFields(pfx){const cat=$(pfx+'Cat')?.value;const wrap=$(pfx+'ProjectWrap');if(!wrap)return;wrap.style.display=cat==='income'?'none':'block';if(cat==='income'){const s=$(pfx+'Project');if(s)s.value='';refreshProjectItems(pfx)}}
function projectTypeLabel(id){const x=PROJECT_TYPES.find(x=>x[0]===id);return x?x[1]:'Other special project'}
function projectTypeEmoji(id){return ({home:'🏠',event:'🎉',major_purchase:'🛒',other:'🛠️'})[id]||'🛠️'}
function projectStatusLabel(id){const x=PROJECT_STATUSES.find(x=>x[0]===id);return x?x[1]:'Planning'}
function projectBudget(p){const n=p.items.reduce((a,i)=>a+(+i.budget||0),0);return n>0?n:(+p.baseBudget||0)}
/* actual project cost from the ledger.
   Live transactions match on projectId; transactions belonging to a project that
   has since been archived match on _archivedProjectId, so a finished project's
   final figures survive the archive (the live link is released only so ordinary
   monthly category aggregation is unchanged). */
function projectActual(p,itemId){
  if(!p) return 0;
  return state.tx.filter(t=>t.cat!=='income' && (t.projectId===p.id || t._archivedProjectId===p.id)
    && (itemId? (t.projectItemId===itemId || t._archivedItemId===itemId) : true))
    .reduce((a,t)=>a+t.amt,0);
}
function projectFunding(p){
  const budget=projectBudget(p), actual=projectActual(p), remaining=Math.max(0,budget-actual), t=t12();
  /* "what I can free up" is the surplus earned over the whole trailing window, not a
     per-month average — with incAvg/expAvg divided by the months recorded and the
     contribution then added 12× a year, a part-year user was credited four times the
     surplus they had actually earned. */
  const available=Math.max(0,t.incTotal-t.expTotal), fp=p.fundingPlan||{}, fixed=+fp.fixedMonthlyContribution||0, pct=+fp.surplusAllocationPct||0;
  const monthly=fixed>0?fixed:available*pct/100, reserve=+fp.startingReserve||0, oneTime=+fp.oneTimeContribution||0, initial=Math.max(0,reserve+oneTime-actual);
  const months=monthly>0&&remaining>initial?Math.ceil((remaining-initial)/monthly):0; const eta=months?new Date(new Date().getFullYear(),new Date().getMonth()+months,1):null;
  return {budget,actual,remaining,available,monthly,reserve,oneTime,initial,months,eta,t};
}
function addProject(){
  const name=$('projName')?.value.trim(); if(!name){toast('Give the project a name');return}
  const p={id:uid(),name,type:$('projType')?.value||'home',priority:'normal',status:'planning',startDate:todayISO(),targetDate:$('projTarget')?.value||'',baseBudget:round2(parseAmt($('projBudget')?.value)),notes:'',items:[],archived:false,completedAt:null,fundingPlan:{enabled:false,startingReserve:0,oneTimeContribution:0,surplusAllocationPct:0,fixedMonthlyContribution:0}};
  state.projects.push(p);store.save();renderProjects();renderLedger();toast('Project created');
}
function deleteProject(id){state.projects=state.projects.filter(p=>p.id!==id);for(const t of state.tx)if(t.projectId===id){t.projectId=null;t.projectItemId=null}store.save();renderAll();toast('Project removed; ledger entries kept')}

/* ================================================================
   PROJECT COMPLETION & ARCHIVE  (IMPROVEMENT 7)
   Before this, marking a project “Completed” changed a chip and
   nothing else — the card stayed in the working list forever, and
   completed projects piled up. Now completion is a real lifecycle
   step: the project is stamped with a completion date, its actuals
   are frozen into a permanent summary (budget, actual, variance,
   duration) and it leaves the working list for a collapsed archive.
   Ledger entries are never deleted — only the project link is
   released while archived, so monthly category totals are untouched,
   and “Restore” re-links every entry that belonged to it.
   ================================================================ */
function isArchived(p){ return !!(p && (p.archived || p.status==='completed')) }
const ARCHIVE_STATUSES=['completed','cancelled'];
function archiveProjectSummary(p){
  const budget=projectBudget(p), actual=projectActual(p), remaining=budget-actual;
  const items=(p.items||[]).map(i=>{ const a=projectActual(p,i.id); return {name:i.name, budget:+i.budget||0, actual:a, variance:(+i.budget||0)-a} });
  const linked=state.tx.filter(t=>t.projectId===p.id||(t._archivedProjectId===p.id)).length;
  const start=p.startDate||'', end=p.completedAt||todayISO();
  let months=null;
  if(start&&end){ const a=new Date(start), b=new Date(end);
    if(!isNaN(a)&&!isNaN(b)) months=Math.max(1,Math.round((b-a)/(1000*60*60*24*30.44))) }
  const variance=budget-actual;
  return { p, budget, actual, remaining, items, linked, start, end, months, variance,
    over: variance<0, overPct: budget>0? Math.abs(variance)/budget*100 : 0,
    completionPct: budget>0? Math.min(100, actual/budget*100) : (actual>0?100:0) };
}
function setProjectStatus(id,val,btn){
  const p=state.projects.find(x=>x.id===id); if(!p) return;
  if(ARCHIVE_STATUSES.includes(val)){
    if(!btn || !btn.dataset.armed){
      if(btn){ btn.dataset.armed='1'; const was=btn.innerHTML; btn.innerHTML='Confirm archive?';
        setTimeout(()=>{ if(btn.isConnected){ btn.dataset.armed=''; btn.innerHTML=was } },2600) }
      return;
    }
    archiveProject(id,val); return;
  }
  p.status=val; p.completedAt=null; p.archived=false;
  store.save(); renderProjects(); renderDash(); toast('Project status set to '+projectStatusLabel(val));
}
function archiveProject(id,status){
  const p=state.projects.find(x=>x.id===id); if(!p) return;
  p.status=status||'completed';
  p.archived=true;
  p.completedAt=todayISO();
  /* freeze the record against the ledger without destroying category aggregation */
  let released=0;
  for(const t of state.tx) if(t.projectId===p.id){ t._archivedProjectId=p.id; if(t.projectItemId) t._archivedItemId=t.projectItemId; t.projectId=null; t.projectItemId=null; released++ }
  store.save(); renderAll();
  const f=archiveProjectSummary(p);
  toast('“'+p.name+'” archived — '+fmt0(f.actual)+' actual vs '+fmt0(f.budget)+' budget ('+(f.over? fmt0(-f.variance)+' over' : fmt0(f.variance)+' unused')+')');
}
function reopenProject(id){
  const p=state.projects.find(x=>x.id===id); if(!p) return;
  p.archived=false; p.status='active'; p.completedAt=null;
  let relinked=0;
  for(const t of state.tx) if(t._archivedProjectId===p.id){ t.projectId=p.id; if(t._archivedItemId) t.projectItemId=t._archivedItemId; delete t._archivedProjectId; delete t._archivedItemId; relinked++ }
  store.save(); renderAll();
  toast('“'+p.name+'” reopened'+(relinked? ' — '+relinked+' ledger entr'+(relinked===1?'y':'ies')+' re-linked':''));
}
function archivedProjects(){
  return state.projects.filter(isArchived)
    .map(archiveProjectSummary)
    .sort((a,b)=>(b.p.completedAt||b.p.startDate||'').localeCompare(a.p.completedAt||a.p.startDate||''));
}
function archivedCardHTML(){
  const list=archivedProjects(); if(!list.length) return '';
  const rows=list.map(f=>{
    const p=f.p, itemsLeft=p.items.length;
    const statusChip = p.status==='cancelled'? '<span class="chip red">Cancelled</span>' : '<span class="chip green">Completed</span>';
    return `<div class="card project-card" style="background:#fbfcfe">
      <div class="cardhead"><h3 style="margin:0">${projectTypeEmoji(p.type)} ${esc(p.name)}</h3>${statusChip}
        ${p.priority==='emergency'?'<span class="chip red">🔴 Emergency</span>':''}
        <span class="grow"></span>
        <button class="btn ghost small" onclick="reopenProject('${p.id}')">↺ Restore</button>
        <button class="btn ghost small" onclick="deleteProject('${p.id}')">Delete</button></div>
      <div class="kpis" style="margin:0">
        <div class="kpi"><div class="lbl">Final budget</div><div class="v">${fmt0(f.budget)}</div><div class="sub">${itemsLeft} line item${itemsLeft===1?'':'s'}</div></div>
        <div class="kpi"><div class="lbl">Actual spend</div><div class="v">${fmt0(f.actual)}</div><div class="sub">${f.completionPct.toFixed(0)}% of budget</div></div>
        <div class="kpi"><div class="lbl">Variance</div><div class="v ${f.over?'neg':'pos'}">${f.over?'−':'+'}${fmt0(Math.abs(f.variance))}</div><div class="sub">${f.over? f.overPct.toFixed(1)+'% over budget' : 'under budget'}</div></div>
        <div class="kpi"><div class="lbl">Duration</div><div class="v">${f.months!=null? f.months+' mo':'—'}</div><div class="sub">${esc(f.start||'no start')} → ${esc(f.end)}</div></div>
      </div>
      ${f.items.length?`<div class="scrollx" style="margin-top:10px"><table class="t"><thead><tr><th>Line item</th><th class="num">Budget</th><th class="num">Actual</th><th class="num">Variance</th></tr></thead><tbody>
        ${f.items.map(i=>`<tr><td>${esc(i.name)}</td><td class="num">${fmt0(i.budget)}</td><td class="num">${fmt0(i.actual)}</td><td class="num ${i.variance<0?'neg':'pos'}">${fmt0(i.variance)}</td></tr>`).join('')}
      </tbody></table></div>`:''}
      <p class="hint" style="margin:8px 0 0">${f.over
        ? 'Finished '+fmt0(-f.variance)+' over budget. '
        : (f.variance>0? 'Finished '+fmt0(f.variance)+' under budget. ' : 'Finished exactly on budget. ')}
        ${f.linked} ledger entr${f.linked===1?'y':'ies'} were linked to this project${isArchived(p)&&!p.archived?'':' and are unfrozen in the ledger for this archive'}. Life Ledger never transfers money — if you want the ${f.variance>0?fmt0(f.variance)+' surplus':'remaining amount'} moved into savings, record it as a <b>Savings</b> entry.</p>
    </div>`;
  }).join('');
  const totalBudget=list.reduce((a,f)=>a+f.budget,0), totalActual=list.reduce((a,f)=>a+f.actual,0);
  const totalVar=totalBudget-totalActual;
  return `<details class="sec" style="margin-top:16px">
    <summary>🗄️ Project archive — ${list.length} finished project${list.length===1?'':'s'} · ${fmt0(totalActual)} spent of ${fmt0(totalBudget)} (${totalVar>=0? fmt0(totalVar)+' under':fmt0(-totalVar)+' over'})</summary>
    <div class="inner">${rows}
      <p class="hint">Archived projects keep their final figures for year-over-year reference and stay out of the working list. Restore returns one to the active list and re-links its ledger entries.</p>
    </div></details>`;
}
function updateProjectField(id,key,val){const p=state.projects.find(x=>x.id===id);if(!p)return;if(key==='budget')p.baseBudget=parseAmt(val);else p[key]=val;store.save();renderProjects();renderLedger()}
function updateProjectPriority(id,val){updateProjectField(id,'priority',val)}
function updateProjectFunding(id,key,val){const p=state.projects.find(x=>x.id===id);if(!p)return;p.fundingPlan=p.fundingPlan||{enabled:false,startingReserve:0,oneTimeContribution:0,surplusAllocationPct:0,fixedMonthlyContribution:0};p.fundingPlan[key]=parseAmt(val);store.save();renderProjects()}
function addProjectItem(id){const n=$('pi_name_'+id)?.value.trim(),b=parseAmt($('pi_budget_'+id)?.value),p=state.projects.find(x=>x.id===id);if(!p||!n){toast('Enter a project item');return}p.items.push({id:uid(),name:n,budget:round2(b),notes:''});store.save();renderProjects();renderLedger()}
function deleteProjectItem(pid,iid){const p=state.projects.find(x=>x.id===pid);if(!p)return;p.items=p.items.filter(i=>i.id!==iid);for(const t of state.tx)if(t.projectItemId===iid)t.projectItemId=null;store.save();renderProjects()}
function renderProjects(){
  const el=$('v-projects'); const active=state.projects.filter(p=>!isArchived(p));
  const cards=active.map(p=>{
    const f=projectFunding(p), pct=f.budget>0?Math.min(100,f.actual/f.budget*100):0;
    const items=p.items.map(i=>{const a=projectActual(p,i.id),r=(+i.budget||0)-a;return '<tr><td>'+esc(i.name)+'</td><td class="num">'+fmt0(i.budget)+'</td><td class="num">'+fmt0(a)+'</td><td class="num '+(r<0?'neg':'pos')+'">'+fmt0(r)+'</td><td><button class="btn ghost small" onclick="deleteProjectItem(\''+p.id+'\',\''+i.id+'\')">✕</button></td></tr>'}).join('')||'<tr><td colspan="5" class="mut">No line items yet.</td></tr>';
    return '<div class="card project-card"><div class="cardhead"><h3 style="margin:0">'+projectTypeEmoji(p.type)+' '+esc(p.name)+'</h3><span class="chip '+(p.priority==='emergency'?'red':p.priority==='high'?'amber':'grey')+'">'+(p.priority==='emergency'?'🔴 Emergency':p.priority==='high'?'High':'Normal')+'</span><span class="chip '+(p.status==='completed'?'green':p.status==='cancelled'?'red':p.status==='active'?'amber':'grey')+'">'+esc(projectStatusLabel(p.status))+'</span><span class="grow"></span><button class="btn ghost small" onclick="deleteProject(\''+p.id+'\')">Delete</button></div>'+
    '<div class="formgrid"><div><label class="f">Category</label><select onchange="updateProjectField(\''+p.id+'\',\'type\',this.value)">'+PROJECT_TYPES.map(x=>'<option value="'+x[0]+'" '+(x[0]===p.type?'selected':'')+'>'+x[1]+'</option>').join('')+'</select></div>'+
    '<div><label class="f">Priority</label><select onchange="updateProjectPriority(\''+p.id+'\',this.value)">'+PROJECT_PRIORITIES.map(x=>'<option value="'+x[0]+'" '+(x[0]===p.priority?'selected':'')+'>'+x[1]+'</option>').join('')+'</select></div>'+
    '<div><label class="f">Status</label><select onchange="setProjectStatus(\''+p.id+'\',this.value,this)">'+PROJECT_STATUSES.map(x=>'<option value="'+x[0]+'" '+(x[0]===p.status?'selected':'')+'>'+x[1]+'</option>').join('')+'</select><span class="hint">Completed archives the project</span></div>'+
    '<div><label class="f">Target date</label><input type="date" value="'+esc(p.targetDate||'')+'" onchange="updateProjectField(\''+p.id+'\',\'targetDate\',this.value)"></div>'+
    /* The budget used by the project is the sum of its line items whenever items exist,
       so an editable "base budget" here would accept input and silently discard it.
       Disabled, with the reason stated, instead of pretending to work. */
    (p.items.length
      ? '<div><label class="f">Budget</label><input type="number" value="'+projectBudget(p)+'" disabled title="Sum of the line items below — edit or remove items to change it"><span class="hint">Sum of line items below — edit the items to change it</span></div>'
      : '<div><label class="f">Base budget</label><input type="number" min="0" step="10" value="'+(p.baseBudget||'')+'" onchange="updateProjectField(\''+p.id+'\',\'budget\',this.value)"><span class="hint">Used until you add line items</span></div>')+'</div>'+
    '<div class="kpis" style="margin-top:12px"><div class="kpi"><div class="lbl">Budget</div><div class="v">'+fmt0(f.budget)+'</div><div class="sub">'+(p.items.length?'sum of items':'base budget')+'</div></div>'+
    '<div class="kpi"><div class="lbl">Actual</div><div class="v">'+fmt0(f.actual)+'</div><div class="sub">linked ledger costs</div></div><div class="kpi"><div class="lbl">Remaining</div><div class="v '+(f.remaining>0?'pos':'neg')+'">'+fmt0(f.remaining)+'</div><div class="sub">'+(f.remaining>0?'to spend':'budget used')+'</div></div>'+
    '<div class="kpi"><div class="lbl">Completion</div><div class="v">'+pct.toFixed(0)+'%</div><div class="sub">'+(p.targetDate?'target '+esc(p.targetDate):'no target')+'</div></div></div>'+
    '<div class="bar"><i style="width:'+pct.toFixed(0)+'%;background:'+(f.remaining<0?'#c62f2f':'#15803d')+'"></i></div><h4 style="margin:12px 0 6px">📋 Budget items</h4>'+
    '<div class="scrollx"><table class="t"><thead><tr><th>Item</th><th class="num">Budget</th><th class="num">Actual</th><th class="num">Remaining</th><th></th></tr></thead><tbody>'+items+'</tbody></table></div>'+
    '<div class="formgrid" style="margin-top:10px"><div><label class="f">New item</label><input id="pi_name_'+p.id+'" type="text" placeholder="e.g. Roofing materials"></div><div><label class="f">Item budget</label><input id="pi_budget_'+p.id+'" type="number" min="0" step="10" placeholder="0.00"></div><div style="display:flex;align-items:end"><button class="btn" onclick="addProjectItem(\''+p.id+'\')">➕ Add item</button></div></div>'+
    '<details class="sec" style="margin-top:12px"><summary>💰 Funding plan</summary><div class="inner"><p class="hint">Projection uses trailing-12 average income minus expenses as available surplus. It is a planning estimate only; Life Ledger does not transfer money automatically.</p>'+
    '<div class="formgrid"><div><label class="f">Existing project reserve</label><input type="number" min="0" step="10" value="'+(f.reserve||'')+'" onchange="updateProjectFunding(\''+p.id+'\',\'startingReserve\',this.value)"></div>'+
    '<div><label class="f">One-time contribution</label><input type="number" min="0" step="10" value="'+(f.oneTime||'')+'" onchange="updateProjectFunding(\''+p.id+'\',\'oneTimeContribution\',this.value)"></div>'+
    '<div><label class="f">Surplus allocation %</label><input type="number" min="0" max="100" step="5" value="'+(p.fundingPlan?.surplusAllocationPct||'')+'" onchange="updateProjectFunding(\''+p.id+'\',\'surplusAllocationPct\',this.value)"></div>'+
    '<div><label class="f">Fixed monthly contribution</label><input type="number" min="0" step="10" value="'+(p.fundingPlan?.fixedMonthlyContribution||'')+'" onchange="updateProjectFunding(\''+p.id+'\',\'fixedMonthlyContribution\',this.value)"></div></div>'+
    '<div class="kpis" style="margin-top:10px"><div class="kpi"><div class="lbl">Available T12 surplus</div><div class="v">'+fmt0(f.available)+'</div><div class="sub">income − expenses</div></div><div class="kpi"><div class="lbl">Monthly funding</div><div class="v">'+fmt0(f.monthly)+'</div><div class="sub">project allocation</div></div><div class="kpi"><div class="lbl">Projected months</div><div class="v">'+(f.months||'—')+'</div><div class="sub">'+(f.eta?'≈ '+MONTHS[f.eta.getMonth()]+' '+f.eta.getFullYear():'set a contribution')+'</div></div><div class="kpi"><div class="lbl">Reserve + one-time</div><div class="v">'+fmt0(f.reserve+f.oneTime)+'</div><div class="sub">starting funding</div></div></div></div></details></div>';
  }).join('');
  el.innerHTML='<div class="card"><div class="cardhead"><h3 style="margin:0">🛠️ Projects & special budgets</h3><span class="grow"></span><button class="btn ghost small" onclick="showView(\'budgets\')">Monthly budgets →</button></div><p class="hint" style="margin:0">Use finite budgets for roof repairs, refurbishments, plumbing/sewerage emergencies, events, major purchases and other special goals. Emergency is a priority, not a project category.</p>'+
  '<div class="formgrid" style="margin-top:12px"><div><label class="f">Project name *</label><input id="projName" type="text" placeholder="e.g. Roof replacement"></div><div><label class="f">Category</label><select id="projType">'+PROJECT_TYPES.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('')+'</select></div><div><label class="f">Base budget</label><input id="projBudget" type="number" min="0" step="10" placeholder="0.00"></div><div><label class="f">Target date</label><input id="projTarget" type="date"></div><div style="display:flex;align-items:end"><button class="btn" onclick="addProject()">➕ Create project</button></div></div></div>'+
  (cards||'<div class="card" style="text-align:center;padding:36px"><div style="font-size:38px">🛠️</div><h3>No special projects yet</h3><p class="mut">Create a finite budget instead of forcing a renovation, event or emergency into a recurring monthly category.</p></div>')+
  /* IMPROVEMENT 7 — finished projects move here instead of piling up */
  archivedCardHTML();
}