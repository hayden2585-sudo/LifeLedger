/* ================================================================
   EXPORT / IMPORT / MENU / ROUTER / BOOT
   ================================================================ */

/* ================================================================
   HIGH-IMPACT USE NOTICE
   This is a product limitation notice, not a claim that the user is
   truthful or that LifeLedger has certified the underlying records.
   ================================================================ */
function showHighImpactNotice(){
  if($('highImpactModal')) return;
  const h=document.createElement('div'); h.id='highImpactModal';
  h.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.7);z-index:310;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
  h.innerHTML=`<div style="background:#fff;border-radius:14px;padding:26px;max-width:640px;box-shadow:0 20px 50px rgba(0,0,0,.3)">
    <div style="font-size:30px">⚠️</div>
    <h2 style="margin:6px 0 10px">Tax, audit &amp; other high-impact use</h2>
    <p style="font-size:13.5px;line-height:1.65"><b>Data Integrity Notice:</b> LifeLedger provides recordkeeping, calculations and analytical estimates from information entered or imported by the user. It does not independently establish that those records are truthful, complete, authentic, or legally sufficient.</p>
    <p style="font-size:13.5px;line-height:1.65">Incorrect, incomplete, estimated, misleading, or intentionally false information can produce materially inaccurate findings. Some unusual values may pass plausibility thresholds, so a “clean” result is not a certification of truth.</p>
    <p style="font-size:13.5px;line-height:1.65"><b>Do not rely on LifeLedger alone</b> for tax filings, audits, regulatory submissions, legal matters, financial decisions, or other consequential purposes. Review the underlying records and obtain qualified professional advice where appropriate.</p>
    <div style="background:#fdf3e4;border:1px solid #f2d3a2;border-radius:8px;padding:10px 12px;font-size:12.5px;line-height:1.55"><b>System safeguard:</b> unresolved data-integrity flags reduce LifeLedger's data-health score. Corrected records are marked as corrected rather than silently rewritten.</div>
    <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn" onclick="document.getElementById('highImpactModal').remove()">I understand</button></div>
  </div>`;
  document.body.appendChild(h);
}

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
  showExportModal('Transactions CSV — '+ts.length+' rows', csvOf(ts), ledgerFileStem()+'-transactions.csv');
}
function exportGridCSV(){
  const y=UI.gridYear, M=gridMatrix(y);
  const rows=[['Category',...MONTHS,'Year total','Avg/mo','Budget/mo']];
  for(const r of M.incRows) rows.push([r.label.replace('💼 ',''),...r.vals.map(v=>v||''),r.vals.reduce((a,b)=>a+b,0),'','']);
  for(const g of M.expGroups) for(const cr of g.cats){
    const tot=cr.vals.reduce((a,b)=>a+b,0); if(!tot && !(+state.budgets[cr.c.id])) continue;
    rows.push([cr.c.name,...cr.vals.map(v=>v||''),tot,'',+state.budgets[cr.c.id]||'']);
  }
  showExportModal('Annual grid '+y+' CSV', rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n'), ledgerFileStem()+'-grid-'+y+'.csv');
}
/* the backup carries the ledger name, so name the file after it once the user has chosen one */
function exportJSON(){
  const fname=ledgerFileStem()+'-backup-'+todayISO()+'.json';
  showExportModal('Backup of “'+ledgerName()+'” — save this file to keep or move your data', JSON.stringify(state,null,1), fname);
}
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
  r.onload=async()=>{
    try{
      const p=JSON.parse(r.result);
      if(p?.format===SECURE_STORAGE.backupFormat){ securityShowEncryptedRestorePrompt(p); return }
      if(!p||!Array.isArray(p.tx)) throw new Error('bad format');
      if(securityEnabled()&&!securityIsNormal()) throw new Error('sign in first');
      const base=freshState(), localSecurity=securityEnabled()?JSON.parse(JSON.stringify(state.security)):null;
      state={...base,...p,settings:migrateSettings(Object.assign({},p.settings||{})),meta:{...base.meta,...(p.meta||{}),init:true}};
      if(localSecurity) state.security=localSecurity;
      migrateIncomeTypes(state); migrateWorkspace(state);
      if(localSecurity){ state.security.storageProtected=true; state.security.legacyProtectionPending=false }
      const ok=await store.save();
      if(!ok) throw new Error('save failed');
      if(localSecurity) store.relock();
      bootTimeDefaults(); renderAll(); toast('Backup restored — '+p.tx.length+' entries');
    }catch(e){ toast(e.message==='sign in first'?'Sign in before restoring a plain JSON backup':'That file is not a valid LifeLedger backup') }
    finally{ input.value='' }
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
  if(store.ok && store.lastSaveOk){ b.textContent='✔ saved locally'; b.className='badge' }
  else if(!store.ok){ b.textContent='⚠ preview mode — use Data ▾ ▸ Export JSON to keep changes'; b.className='badge warn' }
  else { b.textContent='⚠ save failed — export JSON now'; b.className='badge warn' }
}
/* ----------------------------------------------------------------
   WORKSPACE CHROME  (1.4.2)
   Keeps the ledger's name visible everywhere it belongs: the browser
   tab, the header, and the naming input itself (without stomping on
   what the user is currently typing).
---------------------------------------------------------------- */
function refreshLedgerNameInputs(){
  const i=$('ledgerNameInput');
  if(i && document.activeElement!==i && i.value!==ledgerName()) i.value=ledgerName();
}
function renderChrome(){
  const name=ledgerName();
  document.title=name+' — LifeLedger';
  const dateEl=$('todayDate');
  if(dateEl){
    const label=new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date());
    const textEl=dateEl.querySelector('span');
    if(textEl) textEl.textContent=label;
    dateEl.setAttribute('aria-label','Today is '+label);
  }
  const bn=$('brandName'); if(bn) bn.textContent=name;
  const bt=$('brandTag');
  if(bt) bt.textContent = ledgerNameIsCustom()
    ? 'custom name · ✎ editable'
    : 'named from your household · ✎ to rename';
  refreshLedgerNameInputs();
}
function showView(v){
  UI.view=v;
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('on'));
  const el=$('v-'+v); if(el) el.classList.add('on');
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.v===v));
  window.scrollTo({top:0});
}
function renderBanner(){
  const tag=state.meta.sample
    ? `<div class="banner">🎲 You're exploring <b>sample data</b> in <b>${esc(ledgerName())}</b> — 13 months of realistic, Trinidad-flavoured entries. When you're ready: <button class="btn small ghost" onclick="clearSample(this)">🧹 Clear sample data</button> then add your own. Rename this ledger with the ✎ field at the top.</div>`
    : '';
  $('banner').innerHTML=tag;
}
function bootTimeDefaults(){
  const lm=latestMonthWithTx()||{y:new Date().getFullYear(), m:new Date().getMonth()};
  UI.month={y:lm.y, m:lm.m};
  UI.gridYear=lm.y;
  UI.ledgerFilter={cat:'all', src:'all', q:'', month:'all'};
  UI.editingId=null; UI.candidates=[]; UI.csvCands=[]; UI.emailText=''; UI.ocrMsg=''; UI.parseMsg=''; UI.csvMsg='';
}
function renderAll(){
  renderBanner(); renderDash(); renderLedger(); renderGrid(); renderBudgets(); renderHousehold(); renderProjects(); renderIncome(); renderPlan(); renderIngest(); updateSaveBadge(); renderChrome(); refreshAlertBadges();
}
