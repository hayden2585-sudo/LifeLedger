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
  '<div class="kpi"><div class="lbl">Variance</div><div class="v '+(budgeted-st.exp<0?'neg':'pos')+'">'+fmt0(budgeted-st.exp)+'</div><div class="sub">'+(budgeted-st.exp<0?'over budget':'remaining')+'</div></div></div></div></div>';
}