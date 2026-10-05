/* ================================================================
   VIEW: LEDGER (transaction register + entry form)
   ================================================================ */
const SRC_META={ manual:['✍️','Manual'], invoice:['🧾','Invoice scan'], email:['📧','Email'], screenshot:['🖼️','Screenshot'], csv:['📄','CSV import'] };
function catOptions(sel, includeIncome){
  const gs=['income','obligations','essentials','lifestyle','occasions','future'].filter(g=>includeIncome||g!=='income');
  return gs.map(g=>`<optgroup label="${GROUPS[g].name}">`+
    CATS.filter(c=>c.grp===g).map(c=>`<option value="${c.id}" ${c.id===sel?'selected':''}>${c.icon} ${c.name}</option>`).join('')+`</optgroup>`).join('');
}
function entryFormHTML(pfx, fixedSrc){
  const editing = pfx==='led' && UI.editingId;
  const t = editing? state.tx.find(x=>x.id===UI.editingId): null;
  const src = t? t.src : (fixedSrc||'manual');
  const incomeType = t&&t.cat==='income' ? (t.incomeType||'salary') : 'salary';
  const showIncomeType = t&&t.cat==='income';
  const subHints=[...new Set(state.tx.filter(x=>x.cat===((t&&t.cat)||'')).map(x=>x.sub).filter(Boolean))];
  return `
  <form id="${pfx}Form" onsubmit="saveEntry('${pfx}');return false">
    <div class="formgrid">
      <div><label class="f">Date *</label><input type="date" id="${pfx}Date" value="${t? esc(t.date): todayISO()}" required></div>
      <div><label class="f">Amount (${esc(SYM())}) *</label><input type="number" id="${pfx}Amt" step="0.01" min="0" value="${t? t.amt:''}" placeholder="0.00" required></div>
      <div><label class="f">Category *</label><select id="${pfx}Cat" onchange="updateSubHints('${pfx}');toggleIncomeType('${pfx}');toggleProjectFields('${pfx}')">${catOptions(t? t.cat:'groceries', true)}</select></div>
      <div id="${pfx}IncomeTypeWrap" style="display:${showIncomeType?'block':'none'}"><label class="f">Income type *</label><select id="${pfx}IncomeType">${incomeTypeOptions(incomeType)}</select><span class="small mut">Classifies salary, arrears, overtime, dividends, asset sales, benefits, rent and remittances separately.</span></div>
      <div><label class="f">Household member</label><select id="${pfx}Member"><option value="">🏠 Household / shared</option>${state.household.members.map(m=>`<option value="${m.id}" ${t&&t.memberId===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div>
      <div id="${pfx}ProjectWrap" style="display:${t&&t.cat==='income'?'none':'block'}"><label class="f">Project</label><select id="${pfx}Project" onchange="refreshProjectItems('${pfx}')">${projectOptionsForLedger(t?t.projectId:'')}</select></div>
      <div id="${pfx}ProjectItemWrap" style="display:${t&&t.projectId?'block':'none'}"><label class="f">Project item</label><select id="${pfx}ProjectItem">${projectItemOptionsForLedger(t?t.projectId:'',t?t.projectItemId:'')}</select></div>
      <div><label class="f">Vendor / payee</label><input type="text" id="${pfx}Sub" list="${pfx}SubList" value="${t? esc(t.sub||''):''}" placeholder="e.g. Massy Stores"><datalist id="${pfx}SubList">${subHints.map(s=>`<option value="${esc(s)}">`).join('')}</datalist></div>
      <div style="grid-column:span 2;min-width:200px"><label class="f">Description</label><input type="text" id="${pfx}Desc" value="${t? esc(t.desc||''):''}" placeholder="what was this for?"></div>
      ${fixedSrc? `<input type="hidden" id="${pfx}Src" value="${fixedSrc}">`:
      `<div><label class="f">Source</label><select id="${pfx}Src">${Object.keys(SRC_META).map(s=>`<option value="${s}" ${s===src?'selected':''}>${SRC_META[s][0]} ${SRC_META[s][1]}</option>`).join('')}</select></div>`}
    </div>
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:8px">
      <label class="checkline"><input type="checkbox" id="${pfx}Ded" ${t&&t.ded?'checked':''}> Tax-deductible</label>
      <span class="grow"></span>
      ${editing? `<button type="button" class="btn ghost" onclick="cancelEdit()">Cancel edit</button>
                  <button type="submit" class="btn">💾 Update entry</button>`
                : `<button type="submit" class="btn">➕ Add entry</button>`}
    </div>
  </form>`;
}
function updateSubHints(pfx){
  const cat=$(pfx+'Cat').value;
  const subs=[...new Set(state.tx.filter(x=>x.cat===cat).map(x=>x.sub).filter(Boolean))];
  $(pfx+'SubList').innerHTML=subs.map(s=>`<option value="${esc(s)}">`).join('');
  toggleIncomeType(pfx);
}
function toggleIncomeType(pfx){
  const wrap=$(pfx+'IncomeTypeWrap'); if(!wrap) return;
  const isIncome=$(pfx+'Cat')&&$(pfx+'Cat').value==='income';
  wrap.style.display=isIncome?'block':'none';
  const sel=$(pfx+'IncomeType');
  if(isIncome&&sel&&!sel.value) sel.value='salary';
}
function saveEntry(pfx){
  const cat=$(pfx+'Cat').value;
  const data={ date:$(pfx+'Date').value, amt:parseAmt($(pfx+'Amt').value), cat,
    sub:$(pfx+'Sub').value.trim(), desc:$(pfx+'Desc').value.trim(),
    src:$(pfx+'Src')? $(pfx+'Src').value : 'manual', ded:$(pfx+'Ded').checked,
    memberId:$(pfx+'Member')?.value||null,
    projectId:cat==='income'?null:($(pfx+'Project')?.value||null),
    projectItemId:cat==='income'?null:($(pfx+'ProjectItem')?.value||null) };
  if(cat==='income') data.incomeType=$(pfx+'IncomeType')?.value||'salary';
  if(!data.date || !data.amt || !data.cat){ toast('Date, amount and category are required'); return }
  if(!CAT[data.cat]){ toast('If this is income, choose a category under “Income”'); return }
  const editing = pfx==='led' && UI.editingId;
  if(editing){ const t=state.tx.find(x=>x.id===UI.editingId); Object.assign(t,data); UI.editingId=null; toast('Entry updated') }
  else { state.tx.push({id:uid(), ...data}); toast((data.cat==='income'?'Income':'Expense')+' added — '+fmt(data.amt)) }
  store.save(); renderAll();
}
function cancelEdit(){ UI.editingId=null; renderLedger() }
function editTx(id){ UI.editingId=id; showView('ledger'); renderLedger(); window.scrollTo({top:0,behavior:'smooth'}) }
function delTx(id, btn){
  if(!btn.dataset.armed){ btn.dataset.armed='1'; btn.textContent='Sure?'; btn.classList.add('confirm'); setTimeout(()=>{ if(btn.isConnected){btn.dataset.armed='';btn.textContent='✕';btn.classList.remove('confirm')} },2400); return }
  state.tx=state.tx.filter(t=>t.id!==id);
  if(UI.editingId===id) UI.editingId=null;
  store.save(); renderAll(); toast('Entry deleted');
}
function ledgerRows(){
  const f=UI.ledgerFilter;
  let ts=[...state.tx];
  if(f.cat!=='all') ts=ts.filter(t=>t.cat===f.cat);
  if(f.src!=='all') ts=ts.filter(t=>t.src===f.src);
  if(f.month!=='all'){ const p=f.month.split('-'); ts=ts.filter(t=>{ const q=txYM(t); return q.y===+p[0]&&q.m===+p[1] }) }
  if(f.q){ const q=f.q.toLowerCase(); ts=ts.filter(t=>(t.desc+' '+t.sub+' '+catName(t.cat)+' '+(t.cat==='income'?incomeTypeLabel(t.incomeType||'other_income'):'')).toLowerCase().includes(q)) }
  ts.sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
  return ts;
}
function renderLedger(){
  const el=$('v-ledger');
  const ts=ledgerRows(); const a=agg(ts);
  el.innerHTML=`
  <div class="card">
    <h3>${UI.editingId?'✏️ Edit entry':'➕ New entry'} <span class="mut small" style="font-weight:400">— every field flows into the annual grid, budgets and income map</span></h3>
    ${entryFormHTML('led')}
  </div>
  <div class="card">
    <div class="cardhead">
      <h3 style="margin:0">📒 Transaction register <span class="chip grey">${ts.length}</span></h3>
      <span class="grow"></span>
      <input type="text" placeholder="🔍 search description / vendor…" style="width:210px" value="${esc(UI.ledgerFilter.q)}" oninput="UI.ledgerFilter.q=this.value;refreshLedgerTable()">
      <select style="width:auto" onchange="UI.ledgerFilter.month=this.value;refreshLedgerTable()">
        <option value="all">All months</option>${monthOptions(UI.ledgerFilter.month)}</select>
      <select style="width:auto" onchange="UI.ledgerFilter.cat=this.value;refreshLedgerTable()">
        <option value="all">All categories</option>${catOptions(UI.ledgerFilter.cat==='all'?'':UI.ledgerFilter.cat,true)}</select>
      <select style="width:auto" onchange="UI.ledgerFilter.src=this.value;refreshLedgerTable()">
        <option value="all">All sources</option>
        ${Object.keys(SRC_META).map(s=>`<option value="${s}" ${UI.ledgerFilter.src===s?'selected':''}>${SRC_META[s][0]} ${SRC_META[s][1]}</option>`).join('')}</select>
      <button class="btn ghost small" onclick="exportCSV(true)">⬇️ CSV (filtered)</button>
    </div>
    <div class="scrollx"><table class="t" id="ledTable">${ledgerTableHTML(ts)}</table></div>
    <div class="small mut" style="margin-top:8px">Showing ${ts.length} entries · income ${fmt0(a.inc)} · expenses ${fmt0(a.exp)} · net <b class="${a.inc-a.exp>=0?'pos':'neg'}">${fmt0(a.inc-a.exp)}</b></div>
  </div>`;
  const q=el.querySelector('input[type=text]');
  if(q){ const keep=UI.ledgerFilter.q; q.addEventListener('focus',()=>{q.selectionStart=q.value.length}) }
}
function ledgerTableHTML(ts){
  if(!ts.length) return `<tr><td colspan="7" class="mut" style="text-align:center;padding:26px">No entries match. Add one above or import from the <a href="#" onclick="showView('ingest');return false">Add Data</a> tab.</td></tr>`;
  return `<thead><tr><th>Date</th><th>Category</th><th class="hide-m">Vendor</th><th>Description</th><th class="hide-m">Source</th><th class="num">Amount</th><th></th></tr></thead><tbody>`+
    ts.map(t=>`<tr>
      <td style="white-space:nowrap">${t.date}</td>
      <td style="white-space:nowrap">${catIcon(t.cat)} ${esc(catName(t.cat))}${t.cat==='income'?` <span class="chip green" title="Income type">${esc(incomeTypeLabel(t.incomeType||'other_income'))}</span>`:''}${t.ded?' <span class="chip amber" title="Tax-deductible">D</span>':''}</td>
      <td class="hide-m">${esc(t.sub||'')}</td>
      <td>${esc(t.desc||'')}</td>
      <td class="hide-m" title="${SRC_META[t.src]?SRC_META[t.src][1]:t.src}">${SRC_META[t.src]?SRC_META[t.src][0]:'📄'}</td>
      <td class="num ${t.cat==='income'?'pos b':''}">${t.cat==='income'?'+':''}${fmt(t.amt)}</td>
      <td style="white-space:nowrap">
        <button class="btn ghost small" onclick="editTx('${t.id}')">✏️</button>
        <button class="btn ghost small" onclick="delTx('${t.id}',this)">✕</button>
      </td></tr>`).join('')+`</tbody>`;
}
function refreshLedgerTable(){ const el=$('ledTable'); if(el) el.innerHTML=ledgerTableHTML(ledgerRows());
  const foot=$('ledFoot'); /* updated below if present */
  renderLedgerFooter(); }
function renderLedgerFooter(){ /* re-render summary line by re-running ledger stats */
  const el=$('v-ledger'); if(!el) return; const line=el.querySelector('.small.mut:last-of-type');
  const ts=ledgerRows(); const a=agg(ts);
  const target=el.querySelectorAll('.card .small.mut'); const node=target[target.length-1];
  if(node) node.innerHTML=`Showing ${ts.length} entries · income ${fmt0(a.inc)} · expenses ${fmt0(a.exp)} · net <b class="${a.inc-a.exp>=0?'pos':'neg'}">${fmt0(a.inc-a.exp)}</b>`;
}

