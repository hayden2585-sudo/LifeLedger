/* ================================================================
   EXPORT / IMPORT / MENU / ROUTER / BOOT
   ================================================================ */

/* ----------------------------------------------------------------
   IMPROVEMENT 5 — Full CSV export including all attribution fields
   Original export lost: household_member, project, project_item,
   income_type. All are now included so external analysis retains
   the full attribution context.
---------------------------------------------------------------- */
function memberName(id){
  if(!id) return '';
  const m=(state.household.members||[]).find(x=>x.id===id);
  return m? m.name : '';
}
function projectName(id){
  if(!id) return '';
  const p=(state.projects||[]).find(x=>x.id===id);
  return p? p.name : '';
}
function projectItemName(pid,iid){
  if(!pid||!iid) return '';
  const p=(state.projects||[]).find(x=>x.id===pid);
  if(!p) return '';
  const i=(p.items||[]).find(x=>x.id===iid);
  return i? i.name : '';
}
/* an expense spent on a project that has since been archived keeps its attribution
   in the export (the live link is released so monthly category totals stay intact) */
function txProjectId(t){ return t.projectId || t._archivedProjectId || '' }
function txProjectItemId(t){ return t.projectId? (t.projectItemId||'') : '' }
function csvOf(ts){
  const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const head=['date','category','subcategory','description','amount','source','tax_deductible',
               'income_type','household_member','project','project_item'];
  return [head.join(',')].concat(ts.map(t=>[
    t.date,
    t.cat,
    t.sub||'',
    t.desc||'',
    t.amt.toFixed(2),
    t.src,
    t.ded?'yes':'no',
    t.cat==='income'? incomeTypeLabel(t.incomeType||'other_income') : '',
    memberName(t.memberId),
    projectName(txProjectId(t)),
    projectItemName(txProjectId(t), txProjectItemId(t))
  ].map(q).join(','))).join('\n');
}
function exportCSV(filtered){
  let ts=filtered? ledgerRows(): state.tx.slice();
  ts.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  showExportModal('Transactions CSV — '+ts.length+' rows', csvOf(ts), 'lifeledger-transactions.csv');
}
function exportGridCSV(){
  const y=UI.gridYear, M=gridMatrix(y);
  const rows=[['Category',...MONTHS,'Year total','Avg/mo','Budget/mo']];
  for(const r of M.incRows) rows.push([r.label.replace('💼 ',''),...r.vals.map(v=>v||''),r.vals.reduce((a,b)=>a+b,0),'','']);
  for(const g of M.expGroups) for(const cr of g.cats){
    const tot=cr.vals.reduce((a,b)=>a+b,0); if(!tot && !(+state.budgets[cr.c.id])) continue;
    rows.push([cr.c.name,...cr.vals.map(v=>v||''),tot,'',+state.budgets[cr.c.id]||'']);
  }
  showExportModal('Annual grid '+y+' CSV', rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n'), 'lifeledger-grid-'+y+'.csv');
}
function exportJSON(){ showExportModal('Backup JSON — save this file to keep or move your data', JSON.stringify(state,null,1), 'lifeledger-backup.json') }
function showExportModal(title, content, filename){
  let m=$('expModal');
  if(!m){ m=document.createElement('div'); m.id='expModal';
    m.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:200;padding:16px;overflow:auto';
    document.body.appendChild(m) }
  m.innerHTML=`<div class="card" style="max-width:760px;margin:6vh auto;position:relative">
    <button class="btn ghost small" style="position:absolute;top:10px;right:10px" onclick="this.closest('#expModal').style.display='none'">✕ close</button>
    <h3>${esc(title)}</h3>
    <p class="hint">If the download doesn't start (the in-app preview blocks downloads), select all text below and copy it.</p>
    <button class="btn small" onclick="downloadBlob('${esc(filename)}')">⬇️ Download file</button>
    <textarea id="expTA" spellcheck="false" style="width:100%;height:44vh;margin-top:10px;font-family:ui-monospace,Consolas,monospace;font-size:11.5px">${esc(content)}</textarea>
  </div>`;
  m.style.display='block';
}
function downloadBlob(name){
  const blob=new Blob([$('expTA').value],{type:'text/plain'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
}
function importJSONClick(){ closeMenu(); $('jsonFile').click() }
function importJSONFile(input){
  const f=input.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const p=JSON.parse(r.result);
      if(!p||!Array.isArray(p.tx)) throw new Error('bad format');
      const base=freshState();
      state={...base, ...p, settings:migrateSettings(Object.assign({}, p.settings||{})), meta:{...base.meta, ...(p.meta||{}), init:true}};
      migrateIncomeTypes(state); migrateWorkspace(state);
      store.save(); bootTimeDefaults(); renderAll(); toast('Backup restored — '+p.tx.length+' entries');
    }catch(e){ toast('That file is not a valid LifeLedger backup') }
    input.value='';
  };
  r.readAsText(f);
}
function toggleMenu(e){ e.stopPropagation(); $('dataMenu').classList.toggle('open') }
function closeMenu(){ $('dataMenu').classList.remove('open') }
document.addEventListener('click', e=>{ if(!e.target.closest('.menu')||e.target.closest('.dropdown')) closeMenu() });
function setCurrency(v){
  const c=CURRENCIES.find(x=>x[0]===v)||CURRENCIES[0];
  state.settings.currency=c[0]; state.settings.symbol=c[1];
  store.save(); renderAll();
}
function updateSaveBadge(){
  const b=$('saveBadge');
  if(store.ok){ b.textContent='✔ saved locally'; b.className='badge' }
  else { b.textContent='⚠ preview mode — use Data ▾ ▸ Export JSON to keep changes'; b.className='badge warn' }
}
function showView(v){
  UI.view=v;
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('on'));
  const el=$('v-'+v); if(el) el.classList.add('on');
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.v===v));
  window.scrollTo({top:0});
}
function renderBanner(){
  $('banner').innerHTML = state.meta.sample
    ? `<div class="banner">🎲 You're exploring <b>sample data</b> — 13 months of realistic, Trinidad-flavoured entries. When you're ready: <button class="btn small ghost" onclick="clearSample(this)">🧹 Clear sample data</button> then add your own.</div>`
    : '';
}
function bootTimeDefaults(){
  const lm=latestMonthWithTx()||{y:new Date().getFullYear(), m:new Date().getMonth()};
  UI.month={y:lm.y, m:lm.m};
  UI.gridYear=lm.y;
  UI.ledgerFilter={cat:'all', src:'all', q:'', month:'all'};
  UI.editingId=null; UI.candidates=[]; UI.csvCands=[]; UI.emailText=''; UI.ocrMsg=''; UI.parseMsg=''; UI.csvMsg='';
}
function renderAll(){
  renderBanner(); renderDash(); renderLedger(); renderGrid(); renderBudgets(); renderHousehold(); renderProjects(); renderIncome(); renderPlan(); renderIngest(); updateSaveBadge(); refreshAlertBadges();
}
