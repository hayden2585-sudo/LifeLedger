/* ================================================================
   VIEW: HOUSEHOLD
   ================================================================ */
function householdMemberOptions(sel, includeShared=true){
  const shared=includeShared?'<option value="">🏠 Household / shared</option>':'';
  return shared+state.household.members.map(m=>'<option value="'+m.id+'" '+(m.id===sel?'selected':'')+'>'+esc(m.name)+'</option>').join('');
}
function householdMemberName(id){
  const m=state.household.members.find(x=>x.id===id); return m?m.name:'Household / shared';
}
function addHouseholdMember(){
  const name=$('hhMemberName')?.value.trim(), role=$('hhMemberRole')?.value||'Contributor';
  if(!name){toast('Enter a household member name');return}
  state.household.members.push({id:uid(),name,role,active:true}); store.save(); renderAll(); toast(name+' added to household');
}
function deleteHouseholdMember(id){
  if(state.household.members.length<=1){toast('Keep at least one household member');return}
  state.household.members=state.household.members.filter(m=>m.id!==id);
  for(const s of state.streams) if(s.memberId===id) s.memberId=null;
  for(const t of state.tx) if(t.memberId===id) t.memberId=null;
  store.save(); renderAll(); toast('Household member removed');
}
function setStreamMember(id,memberId){
  const s=state.streams.find(x=>x.id===id); if(!s)return;
  s.memberId=memberId||null; store.save(); renderHousehold(); renderIncome();
}
/* ================================================================
   HOUSEHOLD SPENDING SPLIT  (IMPROVEMENT 8)
   Income attribution and per-member expense totals already existed as
   numbers; this makes the split visible — a stacked bar for the whole
   month plus a share donut by contributor. Shared (unattributed)
   spending is shown explicitly rather than hidden, so the chart never
   implies a member spent money that was never attributed to them.
   ================================================================ */
const MEMBER_COLORS=['#3450b4','#0e9488','#d97706','#7c3aed','#be123c','#0369a1','#4d7c0f','#a16207'];
function householdSplit(y,m){
  /* Sou-sou contributions are cash outflows, not household spending. */
  const tx=txForMonth(y,m).filter(t=>t.cat!=='income' &&
    (t.cashflowContext||inferCashflowContext((t.sub||'')+' '+(t.desc||'')+' '+(t.vendor||'')))!=='sou_sou_contribution');
  const total=round2(tx.reduce((a,t)=>a+t.amt,0));
  const buckets=state.household.members.map((mem,i)=>({
    id:mem.id, name:mem.name, role:mem.role||'Contributor',
    val:round2(tx.filter(t=>t.memberId===mem.id).reduce((a,t)=>a+t.amt,0)),
    color:MEMBER_COLORS[i%MEMBER_COLORS.length]
  }));
  const shared=round2(tx.filter(t=>!t.memberId||!state.household.members.some(mem=>mem.id===t.memberId))
    .reduce((a,t)=>a+t.amt,0));
  if(shared>0) buckets.push({id:'__shared', name:'🏠 Household / shared', role:'Not attributed', val:shared, color:'#94a3b8', shared:true});
  const attributed=round2(total-shared);
  return { y, m, total, buckets: buckets.filter(b=>b.val>0||!b.shared), shared, attributed,
    attributedPct: total? attributed/total*100 : 0,
    rows: buckets, top: [...buckets].filter(b=>!b.shared).sort((a,b)=>b.val-a.val)[0]||null };
}
function memberSplitCardHTML(y,m){
  const s=householdSplit(y,m);
  if(!s.total){
    return '<div class="card"><h3>🥧 Spending split by contributor</h3><p class="mut small" style="margin:4px 0 0">No expenses recorded for '+MONTHS[m]+' '+y+' yet.</p></div>';
  }
  if(!state.household.members.length){
    return '<div class="card"><h3>🥧 Spending split by contributor</h3><p class="mut small" style="margin:4px 0 0">Add household contributors above and attribute entries in the Ledger — every expense is currently recorded as household/shared ('+fmt0(s.total)+').</p></div>';
  }
  const bar=s.rows.filter(b=>b.val>0).map(b=>`<i style="width:${(b.val/s.total*100).toFixed(2)}%;background:${b.color}" title="${esc(b.name)} — ${fmt0(b.val)}"></i>`).join('');
  const legend=s.rows.filter(b=>b.val>0).map(b=>`<div><span class="sw" style="background:${b.color}"></span>${esc(b.name)} — <b>${fmt0(b.val)}</b> <span class="mut">(${(b.val/s.total*100).toFixed(1)}%${b.shared?' unattributed':''})</span></div>`).join('');
  const donut=s.buckets.filter(b=>b.val>0).map(b=>({val:b.val, color:b.color}));
  const table=s.rows.filter(b=>b.val>0).map(b=>`<tr>
      <td><span class="sw" style="background:${b.color};display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px"></span>${esc(b.name)}</td>
      <td class="mut small">${esc(b.role)}</td>
      <td class="num">${fmt0(b.val)}</td>
      <td class="num">${(b.val/s.total*100).toFixed(1)}%</td>
      <td class="num mut">${fmt(b.val/s.total*100,2)}</td></tr>`).join('');
  const note = s.shared>0
    ? `<p class="hint" style="margin:8px 0 0">${s.attributed>0? fmt0(s.attributed)+' of '+fmt0(s.total)+' ('+s.attributedPct.toFixed(0)+'%) is attributed to a named contributor;':'Nothing is attributed to a named contributor yet;'} the remaining <b>${fmt0(s.shared)}</b> is household/shared spending. Attribute entries in the Ledger to make this split complete.</p>`
    : `<p class="hint" style="margin:8px 0 0">Every expense in ${MONTHS[m]} is attributed to a named contributor.${s.top? ' Largest share: <b>'+esc(s.top.name)+'</b> at '+(s.top.val/s.total*100).toFixed(1)+'%.':''}</p>`;
  return `<div class="card">
    <div class="cardhead"><h3 style="margin:0">🥧 Spending split by contributor</h3><span class="grow"></span>
      <span class="chip ${s.attributedPct>=80?'green':s.attributedPct>0?'amber':'grey'}">${s.attributedPct.toFixed(0)}% attributed</span></div>
    <div class="splitbar" role="img" aria-label="Household spending share by contributor">${bar}</div>
    <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-top:10px">
      <div style="flex:0 0 190px">${donutSVG(donut)}</div>
      <div class="legendl" style="flex:1;min-width:200px">${legend}
        <div class="mut small" style="margin-top:4px">Total household outflows ${fmt0(s.total)} in ${MONTHS[m]} ${y}</div></div>
    </div>
    <div class="scrollx" style="margin-top:10px"><table class="t">
      <thead><tr><th>Contributor</th><th>Role</th><th class="num">Spend</th><th class="num">Share</th><th class="num">Per ${SYM()}100</th></tr></thead>
      <tbody>${table}</tbody></table></div>
    ${note}
  </div>`;
}
function renderHousehold(){
  const el=$('v-household'), mk=UI.month, st=monthStats(mk.y,mk.m);
  const plannedIncome=state.streams.reduce((a,s)=>a+(+s.monthly||0),0);
  const budgeted=EXPENSE_CATS.reduce((a,c)=>a+(+state.budgets[c.id]||0),0);
  const members=state.household.members.map(m=>{
    const planned=state.streams.filter(s=>s.memberId===m.id).reduce((a,s)=>a+(+s.monthly||0),0);
    const mi=txForMonth(mk.y,mk.m).filter(t=>t.cat==='income'&&t.memberId===m.id).reduce((a,x)=>a+x.amt,0);
    const me=txForMonth(mk.y,mk.m).filter(t=>t.cat!=='income'&&t.memberId===m.id).reduce((a,x)=>a+x.amt,0);
    return '<div class="bcard"><div class="hd"><span>👤</span><b>'+esc(m.name)+'</b><span class="grow"></span><span class="chip grey">'+esc(m.role||'Contributor')+'</span><button class="btn ghost small" onclick="deleteHouseholdMember(\''+m.id+'\')">✕</button></div>'+
      '<div class="row"><span class="mut">planned income</span><span class="num">'+fmt0(planned)+'/mo</span></div>'+
      '<div class="row"><span class="mut">actual income</span><span class="num pos b">'+fmt0(mi)+'</span></div>'+
      '<div class="row"><span class="mut">actual expenses</span><span class="num">'+fmt0(me)+'</span></div></div>';
  }).join('')||'<div class="mut">No named contributors yet. Shared transactions remain valid.</div>';
  const streams=state.streams.map(s=>'<tr><td>'+esc(s.label)+'</td><td class="num">'+fmt0(s.monthly)+'/mo</td><td><select style="min-width:180px" onchange="setStreamMember(\''+s.id+'\',this.value)">'+householdMemberOptions(s.memberId||'')+'</select></td></tr>').join('')||'<tr><td colspan="3" class="mut">No recurring income streams yet. Add them in Income Map.</td></tr>';
  const spend=state.household.members.map(m=>{ const e=txForMonth(mk.y,mk.m).filter(t=>t.cat!=='income'&&t.memberId===m.id).reduce((a,x)=>a+x.amt,0); return '<tr><td>'+esc(m.name)+'</td><td class="num">'+fmt0(e)+'</td><td>'+(e?'member-attributed':'—')+'</td></tr>'; }).join('')||'<tr><td colspan="3" class="mut">No member-attributed expenses this month.</td></tr>';
  el.innerHTML='<div class="card"><div class="cardhead"><h3 style="margin:0">🏠 Household budget</h3><select style="width:auto" onchange="UI.month=parseMK(this.value);renderHousehold()">'+monthOptions(mk.y+'-'+mk.m)+'</select><span class="grow"></span><span class="chip '+(st.inc-st.exp>=0?'green':'red')+'">'+fmt0(st.inc-st.exp)+' '+(st.inc-st.exp>=0?'surplus':'deficit')+'</span></div>'+
  '<p class="hint" style="margin:0">Multiple earners and other contributors can be attributed without changing the underlying ledger or income taxonomy.</p>'+
  '<div class="kpis" style="margin-top:12px"><div class="kpi"><div class="lbl">Planned recurring income</div><div class="v pos">'+fmt0(plannedIncome)+'</div><div class="sub">all streams / month</div></div>'+
  '<div class="kpi"><div class="lbl">'+MONTHS[mk.m]+' actual income</div><div class="v pos">'+fmt0(st.inc)+'</div><div class="sub">household inflows</div></div>'+
  '<div class="kpi"><div class="lbl">'+MONTHS[mk.m]+' expenses</div><div class="v">'+fmt0(st.exp)+'</div><div class="sub">household outflows</div></div>'+
  '<div class="kpi"><div class="lbl">Monthly budgets</div><div class="v">'+fmt0(budgeted)+'</div><div class="sub">shared category budgets</div></div></div></div>'+
  '<div class="grid2"><div class="card"><div class="cardhead"><h3 style="margin:0">👥 Household contributors</h3></div><div class="bcards">'+members+'</div>'+
  '<div class="formgrid" style="margin-top:12px"><div><label class="f">Name *</label><input id="hhMemberName" type="text" placeholder="Partner / spouse / adult child"></div>'+
  '<div><label class="f">Role</label><select id="hhMemberRole"><option>Primary</option><option>Partner / spouse</option><option>Remote professional</option><option>Stay-at-home professional</option><option>Adult child</option><option>Other contributor</option></select></div>'+
  '<div style="display:flex;align-items:end"><button class="btn" onclick="addHouseholdMember()">➕ Add contributor</button></div></div></div>'+
  '<div class="card"><div class="cardhead"><h3 style="margin:0">💼 Income by contributor</h3></div><div class="scrollx"><table class="t"><thead><tr><th>Income stream</th><th class="num">Planned</th><th>Contributor</th></tr></thead><tbody>'+streams+'</tbody></table></div><p class="hint">Assignment changes attribution only; cashflow and income subtype treatment stay unchanged.</p></div></div>'+
  '<div class="grid2"><div class="card"><h3>📊 Spending attribution</h3><div class="scrollx"><table class="t"><thead><tr><th>Contributor</th><th class="num">'+MONTHS[mk.m]+' spend</th><th>Coverage</th></tr></thead><tbody>'+spend+'</tbody></table></div><p class="hint">Unassigned expenses remain household/shared.</p></div>'+
  '<div class="card"><div class="cardhead"><h3 style="margin:0">🎯 Monthly household budget</h3><span class="grow"></span><button class="btn ghost small" onclick="showView(\'budgets\')">Edit category budgets →</button></div>'+
  '<div class="kpis"><div class="kpi"><div class="lbl">Budget</div><div class="v">'+fmt0(budgeted)+'</div><div class="sub">per month</div></div><div class="kpi"><div class="lbl">Actual</div><div class="v">'+fmt0(st.exp)+'</div><div class="sub">selected month</div></div>'+
  '<div class="kpi"><div class="lbl">Variance</div><div class="v '+(budgeted-st.exp<0?'neg':'pos')+'">'+fmt0(budgeted-st.exp)+'</div><div class="sub">'+(budgeted-st.exp<0?'over budget':'remaining')+'</div></div></div></div></div>'+
  /* IMPROVEMENT 8 — visual split of household spending by contributor */
  memberSplitCardHTML(mk.y, mk.m);
  el.innerHTML += securityPrivateDetailsCardHTML();
}