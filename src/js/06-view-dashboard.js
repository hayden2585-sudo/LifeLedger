/* ================================================================
   VIEW: DASHBOARD
   ================================================================ */
function renderDash(){
  const el=$('v-dash');
  if(!state.tx.length){
    el.innerHTML=`
    <div class="card" style="text-align:center;padding:46px 20px">
      <div style="font-size:44px">▦</div>
      <h2 style="margin:8px 0 6px">Welcome to LifeLedger</h2>
      <p class="mut" style="max-width:560px;margin:0 auto 18px">
        A spreadsheet-style workspace for monthly &amp; annual expense tracking, budget overages, income mapping
        and cost-of-living math. Start with sample data to explore, or add your first entry.</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn" onclick="loadSample()">🎲 Load sample data</button>
        <button class="btn ghost" onclick="showView('ingest')">➕ Add first entry</button>
        <button class="btn ghost" onclick="showView('ingest');document.getElementById('csvIn').click()">⬆️ Import CSV</button>
      </div>
    </div>`;
    return;
  }
  const mk=UI.month, y=mk.y, m=mk.m;
  const st=monthStats(y,m), t=t12(), im=incomeMapNumbers();
  const mw=minWageNumbers();
  const net=st.inc-st.exp;
  const unspent=st.inc>0? (net/st.inc*100):null;
  const groupsData=Object.keys(GROUPS).filter(g=>g!=='income').map(g=>{
    const val=Object.keys(st.byCat).filter(cid=>CAT[cid]&&CAT[cid].grp===g).reduce((a,k)=>a+st.byCat[k],0);
    return {label:GROUPS[g].name, val, color:GROUPS[g].color};
  }).filter(d=>d.val>0);
  const t12groups=Object.keys(GROUPS).filter(g=>g!=='income').map(g=>{
    const val=Object.keys(t.byCatAvg).filter(cid=>CAT[cid]&&CAT[cid].grp===g).reduce((a,k)=>a+t.byCatAvg[k],0);
    return {label:GROUPS[g].name, val, color:GROUPS[g].color};
  }).filter(d=>d.val>0);
  const bars=t.ms.map(mm=>({label:MONTHS[mm.m], inc:agg(txForMonth(mm.y,mm.m)).inc, exp:agg(txForMonth(mm.y,mm.m)).exp}));
  const yearAgg=agg(txForYear(y));
  const kpi=(lbl,val,sub,cls)=>`<div class="kpi"><div class="lbl">${lbl}</div><div class="v ${cls||''}">${val}</div><div class="sub">${sub||''}</div></div>`;
  const shownAlerts=visibleAlerts();
  const health=dataHealth();
  el.innerHTML=`
  ${alertPanelHTML(shownAlerts, health, alertsFor())}
  <div class="cardhead">
    <h3 style="margin:0">Month at a glance</h3>
    <select style="width:auto" onchange="UI.month=parseMK(this.value);renderAll()">${monthOptions(y+'-'+m)}</select>
    <span class="chip grey">Trailing-12 avg income ${fmt0(t.incAvg)}/mo · expenses ${fmt0(t.expAvg)}/mo</span>
  </div>
  <div class="kpis">
    ${kpi('Take-home income', fmt0(st.inc), 'T12 avg '+fmt0(t.incAvg))}
    ${kpi('Expenses', fmt0(st.exp), 'T12 avg '+fmt0(t.expAvg))}
    ${kpi(net>=0?'Surplus':'Deficit', fmt0(net), net>=0?'Keep it up 👍':'Watch this ⚠️', net>=0?'pos':'neg')}
    ${kpi('Unspent income', unspent==null?'—':unspent.toFixed(1)+'%', unspent==null?'':'of what came in', unspent!=null&&unspent<0?'neg':'')}
    ${kpi('Budget adherence', st.adherence==null?'—':st.adherence.toFixed(0)+'%', st.over.length? st.over.length+' categorie(s) over':'All within budget', st.over.length?'neg':'pos')}
    ${kpi('Year '+y+' net', fmt0(yearAgg.inc-yearAgg.exp), 'income '+fmt0(yearAgg.inc)+' · expenses '+fmt0(yearAgg.exp))}
    ${mw.netM>0? kpi('Lifestyle vs minimum wage', pctMinWage(im.lifestyleM).toFixed(0)+'%', 'a full-time min-wage job nets '+fmt0(mw.netM)+'/mo'):''}
  </div>
  <div class="grid2">
    <div class="card">
      <div class="cardhead"><h3 style="margin:0">Where the money went</h3>
        <span class="grow"></span>
        <button class="btn small ${UI.showT12?'':'ghost'}" onclick="UI.showT12=true;renderDash()">${MONTHS[m]} ${y}</button>
        <button class="btn small ${UI.showT12?'ghost':''}" onclick="UI.showT12=false;renderDash()">Trailing 12-mo avg</button>
      </div>
      <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
        <div style="flex:0 0 200px">${donutSVG(UI.showT12?groupsData:t12groups)}</div>
        <div class="legendl" style="flex:1;min-width:170px">
          ${(UI.showT12?groupsData:t12groups).map(d=>`<div><span class="sw" style="background:${d.color}"></span>${d.label} — <b>${fmt0(d.val)}</b>${UI.showT12&&st.inc>0?` <span class="mut">(${(d.val/st.exp*100).toFixed(0)}% of spend)</span>`:UI.showT12?'':''}</div>`).join('')}
          ${!(UI.showT12?groupsData:t12groups).length?'<div class="mut">No expenses recorded.</div>':''}
        </div>
      </div>
    </div>
    <div class="card">
      <h3>12-month history</h3>
      ${bars12SVG(bars)}
      <div class="small mut" style="margin-top:6px"><span class="sw" style="background:#2f9e5f;display:inline-block;width:11px;height:11px;border-radius:3px"></span> Income &nbsp; <span class="sw" style="background:#e05252;display:inline-block;width:11px;height:11px;border-radius:3px"></span> Expenses</div>
    </div>
  </div>
  <div class="grid2">
    <div class="card">
      <h3>🎯 Budget overages — ${MONTHS[m]} ${y}</h3>
      ${st.over.length? st.over.map(o=>`
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
            <span>${catIcon(o.cat)} ${esc(catName(o.cat))}</span>
            <span class="neg b">${fmt(o.by)} over <span class="mut">(spent ${fmt0(o.act)} / budget ${fmt0(o.bud)})</span></span>
          </div>
          <div class="bar"><i style="width:${Math.min(100,o.act/o.bud*100).toFixed(0)}%;background:#e05252"></i></div>
        </div>`).join('') + `<button class="btn ghost small" onclick="showView('budgets')">Adjust budgets →</button>`
        : `<p class="mut" style="margin:6px 0">Every category is within its budget this month. 🎉</p>`}
    </div>
    <div class="card">
      <h3>🧭 Income position</h3>
      <table class="t ladder">
        <tr><td>Current lifestyle cost</td><td class="num b">${fmt0(im.lifestyleM)}/mo</td><td class="num mut">${fmt0(im.lifestyleM*12)}/yr</td></tr>
        <tr><td>Your take-home (12-mo avg)</td><td class="num b ${im.gapMonthly>=0?'pos':'neg'}">${fmt0(im.netMonthly)}/mo</td><td class="num mut">${fmt0(im.netAnnual)}/yr</td></tr>
        <tr><td>Gross salary that supports this lifestyle</td><td class="num b">${fmt0(im.grossLifestyle/12)}/mo</td><td class="num mut">${fmt0(im.grossLifestyle)}/yr</td></tr>
        <tr><td>With ${state.settings.savingsTargetPct}% savings goal</td><td class="num b">${fmt0(im.grossWithSavings/12)}/mo</td><td class="num mut">${fmt0(im.grossWithSavings)}/yr</td></tr>
        <tr><td>Full-time minimum wage (net, ${fmt(mw.hourly)}/hr)</td><td class="num b">${fmt0(mw.netM)}/mo</td><td class="num mut">${fmt0(mw.netM*12)}/yr</td></tr>
        <tr><td>Your lifestyle vs minimum wage</td><td class="num b">${mw.netM>0?(im.lifestyleM/mw.netM).toFixed(1)+'×':'—'}</td><td class="num mut">${mw.netM>0?pctMinWage(im.lifestyleM).toFixed(0)+'% of it':'—'}</td></tr>
      </table>
      <p class="hint" style="margin-top:8px">Full breakdown, tax inversion and the self-employed revenue view → <a href="#" onclick="showView('income');return false">Income Map</a></p>
    </div>
  </div>`;
}
/* ================================================================
   PROACTIVE ALERTS PANEL  (IMPROVEMENT 6)
   Renders the ranked alert list at the top of the Dashboard so the
   app tells you what needs attention instead of waiting to be asked.
   ================================================================ */
function alertPanelHTML(alerts, health, all){
  all = all || alertsFor();
  const muted=all.length-alerts.length;
  const crit=alerts.filter(a=>a.sev==='critical').length;
  const warn=alerts.filter(a=>a.sev==='warn').length;
  const info=alerts.filter(a=>a.sev==='info').length;
  const sorted=[...alerts].sort((a,b)=>SEV_RANK[a.sev]-SEV_RANK[b.sev]);
  const shown=sorted.slice(0,4);
  const rest=sorted.slice(4);
  const row=a=>`
    <div class="alertrow ${a.sev}" id="al-${esc(a.key).replace(/[^a-z0-9]/gi,'_')}">
      <span class="alertico">${a.icon||'•'}</span>
      <div class="alertbody">
        <div class="alerttitle">${esc(a.title)}</div>
        <div class="alertdetail small mut">${esc(a.detail)}</div>
      </div>
      <div class="alertacts">
        ${a.view?`<button class="btn ghost small" onclick="showView('${a.view}')">Open</button>`:''}
        <button class="btn ghost small" title="Mute until reload" onclick="dismissAlert('${esc(a.key)}')">✕</button>
      </div>
    </div>`;
  const head=`<div class="cardhead"><h3 style="margin:0">🔔 Needs your attention</h3>
      <span class="grow"></span>
      ${crit?`<span class="chip red">${crit} critical</span>`:''}
      ${warn?`<span class="chip amber">${warn} to watch</span>`:''}
      ${info?`<span class="chip grey">${info} for review</span>`:''}
      <span class="chip ${health.pct>=85?'green':health.pct>=60?'amber':'red'}" title="Data health: ${health.score} of ${health.total} checks pass">📋 data health ${health.pct}%</span>
      ${muted?`<button class="btn ghost small" onclick="restoreAlerts()">↺ ${muted} muted</button>`:''}
    </div>`;
  if(!all.length){
    return `<div class="card"><div class="cardhead"><h3 style="margin:0">🔔 Needs your attention</h3><span class="grow"></span>
      <span class="chip ${health.pct>=85?'green':'amber'}">📋 data health ${health.pct}%</span></div>
      <p class="mut small" style="margin:4px 0 0">Nothing is asking for a decision right now — every budget is inside its limit, no project is over, and the trailing-12 window has data in it. 🎉</p></div>`;
  }
  return `<div class="card"><div id="alertPanelHead">${head}</div>
    ${shown.map(row).join('')}
    ${rest.length?`<details class="sec" style="margin-top:6px"><summary>${rest.length} more alert${rest.length===1?'':'s'} to review</summary><div class="inner">${rest.map(row).join('')}</div></details>`:''}
    <p class="hint" style="margin:8px 0 0">Alerts are derived live from your ledger, budgets, income streams and projects — they need no setup and are muted only for this session. Educational guidance, not financial advice.</p>
  </div>`;
}
function parseMK(v){ const p=v.split('-'); return {y:+p[0], m:+p[1]} }


