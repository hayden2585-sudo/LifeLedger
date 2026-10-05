/* ================================================================
   VIEW: BUDGETS
   ================================================================ */
function renderBudgets(){
  const el=$('v-budgets'); const mk=UI.month, st=monthStats(mk.y,mk.m), t=t12();
  const netRef=t.incAvg||state.streams.reduce((a,s)=>a+(+s.monthly||0),0);
  const cards=['obligations','essentials','lifestyle','occasions','future'].map(g=>{
    const rows=CATS.filter(c=>c.grp===g).map(c=>{
      const bud=+state.budgets[c.id]||0, act=st.byCat[c.id]||0;
      const pct=bud? Math.min(140,act/bud*100):0;
      const over=bud&&act>bud;
      const guide=c.guide? (netRef*c.guide/100):null;
      const cad=detectCadence(c.id);
      /* a fixed cost billed quarterly/annual is not a monthly overspend — say so */
      const cadTag=cad? `<span class="chip grey" title="Detected from your ledger: this cost is not billed every month">🔄 ${cad.kind} · ${t.byCatTotals[c.id]?fmt0(t.byCatTotals[c.id]/12):'—'}/mo avg</span>`:'';
      return `<div class="bcard">
        <div class="hd"><span>${c.icon}</span><b style="font-size:12.8px">${c.name}</b>
          <span class="grow"></span>${over?`<span class="chip ${cad?'amber':'red'}">${cad? 'billed '+cad.adverb : '+'+fmt0(act-bud)+' over'}</span>`:bud?`<span class="chip green">under</span>`:`<span class="chip grey">no budget</span>`}</div>
        <input type="number" min="0" step="10" value="${bud||''}" placeholder="monthly budget…" onchange="setBudget('${c.id}',this.value)">
        <div class="bar" style="margin-top:8px"><i style="width:${bud?pct:0}%;background:${over?(cad?'#d97706':'#e05252'):'#2f9e5f'}"></i></div>
        <div class="row"><span class="mut">spent ${fmt0(act)}</span><span class="mut">${bud?fmt0(bud)+' budget':'—'}</span></div>
        ${cadTag?`<div class="row">${cadTag}<button class="btn ghost small" title="Set the budget to the 12-month average" onclick="setBudget('${c.id}',${Math.round((t.byCatTotals[c.id]||0)/12/10)*10||0})">use avg</button></div>`:''}
        ${c.guide?`<div class="row"><span class="mut small">guideline ${c.guide}% of net ≈ ${fmt0(guide)}</span>
          <button class="btn ghost small" title="Use guideline" onclick="setBudget('${c.id}',${Math.round(guide/10)*10})">use</button></div>`:''}
      </div>`;}).join('');
    return `<h3 style="margin:14px 0 8px;color:${GROUPS[g].color}">${GROUPS[g].name}</h3><div class="bcards">${rows}</div>`;
  }).join('');
  el.innerHTML=`
  <div class="card">
    <div class="cardhead">
      <h3 style="margin:0">🎯 Budgets vs actuals</h3>
      <select style="width:auto" onchange="UI.month=parseMK(this.value);renderBudgets();renderDash()">${monthOptions(mk.y+'-'+mk.m)}</select>
      <span class="grow"></span>
      <span class="chip ${st.over.length?'red':'green'}">${st.over.length? st.overspendTotal? fmt0(st.overspendTotal)+' over budget total':'over in '+st.over.length+' categories':'all within budget'}</span>
      <button class="btn ghost small" onclick="applyGuidelineBudgets()">✨ Apply guideline budgets</button>
      <button class="btn ghost small" onclick="clearBudgets()">Clear all</button>
    </div>
    <p class="hint" style="margin:0">Guidelines follow a 50/30/20-inspired split of your net income (currently ${fmt0(netRef)}/mo, ${coverageNote(t)}). Budgets are monthly and apply to every month. Costs your ledger shows as quarterly or annual are tagged 🔄 so a single payment is not mistaken for overspending.</p>
  </div>
  ${cards}`;
}
function applyGuidelineBudgets(){
  const netRef=t12().incAvg||state.streams.reduce((a,s)=>a+(+s.monthly||0),0);
  if(netRef<=0){ toast('Add income first — guidelines are based on net income'); return }
  let n=0; for(const c of EXPENSE_CATS){ if(c.guide){ state.budgets[c.id]=Math.round(netRef*c.guide/100/10)*10; n++ } }
  store.save(); renderAll(); toast('Set '+n+' guideline budgets based on '+fmt0(netRef)+'/mo net income');
}
function clearBudgets(){ state.budgets={}; store.save(); renderAll(); toast('Budgets cleared') }

