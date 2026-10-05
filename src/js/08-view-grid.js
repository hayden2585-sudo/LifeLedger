/* ================================================================
   VIEW: ANNUAL GRID  (the spreadsheet)
   ================================================================ */
function gridMatrix(y){
  const txs=txForYear(y);
  const monthsWith={}; for(const t of txs){ monthsWith[txYM(t).m]=1 }
  const nMonths=Object.keys(monthsWith).length||12;
  const incKeys=[...new Set(txs.filter(t=>t.cat==='income').map(t=>(t.incomeType||guessIncomeType((t.sub||'')+' '+(t.desc||'')))+'||'+(t.sub||'Income')))];
  const incRows=incKeys.map(key=>{
    const [incomeType,s]=key.split('||');
    return {label:'💼 '+incomeTypeLabel(incomeType)+' — '+s, rows:null, incomeSub:s, incomeType,
      vals:MONTHS.map((_,m)=>round2(txForMonth(y,m).filter(t=>t.cat==='income'&&(t.incomeType||guessIncomeType((t.sub||'')+' '+(t.desc||'')))===incomeType&&(t.sub||'Income')===s).reduce((a,t)=>a+t.amt,0)))};
  });
  const expGroups=['obligations','essentials','lifestyle','occasions','future'].map(g=>({
    g, cats: CATS.filter(c=>c.grp===g).map(c=>({c, vals:MONTHS.map((_,m)=>round2(txForMonth(y,m).filter(t=>t.cat===c.id).reduce((a,t)=>a+t.amt,0)))}))
  }));
  return {y, incRows, expGroups, nMonths};
}
function renderGrid(){
  const el=$('v-grid'); const y=UI.gridYear;
  const M=gridMatrix(y);
  const sum=vals=>round2(vals.reduce((a,b)=>a+b,0));
  const avg=(vals,n)=>n? round2(sum(vals)/n):0;
  const totExpAll=M.expGroups.reduce((a,g)=>a+g.cats.reduce((b,cr)=>b+sum(cr.vals),0),0);
  /* month totals for income / expenses */
  const mInc=MONTHS.map((_,m)=>txForMonth(y,m).filter(t=>t.cat==='income').reduce((a,t)=>a+t.amt,0));
  const mExp=MONTHS.map((_,m)=>txForMonth(y,m).filter(t=>t.cat!=='income').reduce((a,t)=>a+t.amt,0));
  const mNet=mInc.map((v,i)=>round2(v-mExp[i]));
  const bud=cat=>+state.budgets[cat]||0;
  const cell=(v,cat,m)=>{
    if(!v) return '<td class="num"></td>';
    const over= cat&&bud(cat)&&v>bud(cat);
    return `<td class="num cellhit ${over?'over':''}" onclick="drill('${cat||''}',${m},${y})" title="See ${MONTHS[m]} entries">${fmt0(v)}</td>`;
  };
  const rowHTML=(label,vals,opts={})=>{
    const t=sum(vals); const a=avg(vals,M.nMonths);
    const budCell= opts.bud!==undefined? `<td class="inedit"><input type="number" step="10" min="0" value="${opts.bud||''}" placeholder="0" onchange="setBudget('${opts.cat}',this.value)"></td>`: '<td></td>';
    const delta= opts.bud? (t-opts.bud*12): null;
    const share= opts.shareOf? (t/totExpAll*100):null;
    return `<tr class="${opts.cls||''}">
      <td class="c0" ${opts.indent?'style="padding-left:22px"':''}>${label}</td>
      ${vals.map((v,m)=>cell(v,opts.cat,m)).join('')}
      <td class="num b">${t?fmt0(t):''}</td><td class="num">${t?fmt0(a):''}</td>${budCell}
      <td class="num ${delta===null?'':delta>0?'over':delta<0?'under':''}">${delta===null?'':(delta>0?'+':'−')+fmt0(Math.abs(delta))}</td>
      <td class="num mut">${share!=null&&t?share.toFixed(1)+'%':''}</td></tr>`;
  };
  const groupTotalRow=(label,vals,cls)=>`<tr class="${cls||'sub'}"><td class="c0">${label}</td>${vals.map((v,m)=>cell(v,null,m)).join('')}
      <td class="num b">${fmt0(sum(vals))}</td><td class="num">${fmt0(avg(vals,M.nMonths))}</td><td></td><td></td><td></td></tr>`;
  let body='';
  /* income block */
  body+=`<tr class="grp"><td class="c0">💰 INCOME</td>${'<td></td>'.repeat(12+5)}</tr>`;
  for(const r of M.incRows) body+=rowHTML(r.label, r.vals, {});
  body+=groupTotalRow('Total income', mInc,'sub');
  /* expense groups */
  for(const g of M.expGroups){
    const gvals=MONTHS.map((_,m)=>g.cats.reduce((a,cr)=>a+cr.vals[m],0));
    body+=`<tr class="grp"><td class="c0">${GROUPS[g.g].name.toUpperCase()}</td>${'<td></td>'.repeat(17)}</tr>`;
    for(const cr of g.cats){
      if(sum(cr.vals)===0 && !bud(cr.c.id)) continue;
      body+=rowHTML(cr.c.icon+' '+cr.c.name, cr.vals, {cat:cr.c.id, bud:bud(cr.c.id), indent:true, shareOf:true});
    }
    body+=groupTotalRow(GROUPS[g.g].name+' subtotal', gvals, 'sub');
  }
  const expAll=MONTHS.map((_,m)=>mExp[m]);
  body+=groupTotalRow('TOTAL EXPENSES', expAll,'tot');
  body+=`<tr class="tot"><td class="c0">NET (income − expenses)</td>
    ${mNet.map((v,m)=>`<td class="num ${v<0?'over':'under'}">${v?fmt0(v):''}</td>`).join('')}
    <td class="num ${sum(mNet)<0?'over':'under'}">${fmt0(sum(mNet))}</td><td class="num">${fmt0(avg(mNet,M.nMonths))}</td><td></td><td></td><td></td></tr>`;
  el.innerHTML=`
  <div class="card">
    <div class="cardhead">
      <h3 style="margin:0">🗓️ Annual spreadsheet — full year by category</h3>
      <span class="grow"></span>
      <select style="width:auto" onchange="UI.gridYear=+this.value;renderGrid()">${yearOptions(y)}</select>
      <button class="btn ghost small" onclick="exportGridCSV()">⬇️ Export grid CSV</button>
    </div>
    <p class="hint" style="margin:0 0 8px">Every cell is live — click a month cell to drill into its entries. “Δ vs budget” compares the year total with 12× your monthly budget (red = overspent). Edit the <b>Budget/mo</b> cells right in the grid.</p>
    <div class="sheet-wrap"><table class="sheet">
      <thead><tr>
        <th class="c0">Category</th>${MONTHS.map(m=>`<th>${m}</th>`).join('')}<th>Year total</th><th>Avg/mo</th><th>Budget/mo</th><th>Δ vs budget</th><th>% spend</th>
      </tr></thead><tbody>${body}</tbody></table></div>
  </div>
  ${yoyCardHTML(y)}
  ${healthCardHTML()}`;
}

/* ================================================================
   YEAR OVER YEAR  (IMPROVEMENT 4)
   The plan view answers “am I making progress?” but had no historical
   anchor. This compares the selected grid year with any other year,
   by group and by category, with per-month averages so a part-year
   dataset is compared fairly.
   ================================================================ */
function yearTotalsFor(y){
  const txs=txForYear(y);
  const inc=txs.filter(t=>t.cat==='income').reduce((a,t)=>a+t.amt,0);
  const exp=txs.filter(t=>t.cat!=='income').reduce((a,t)=>a+t.amt,0);
  const monthsWith=new Set(txs.map(t=>txYM(t).m)).size;
  const effMonths=monthsWith||1;
  const byCat={}; for(const t of txs){ if(t.cat!=='income') byCat[t.cat]=(byCat[t.cat]||0)+t.amt }
  return {y, inc, exp, net:inc-exp, count:txs.length, monthsWith, effMonths, byCat};
}
function yoyYears(cur){
  const ys=[...new Set([...state.tx.map(t=>txYM(t).y), cur])].sort((a,b)=>b-a);
  return ys.length? ys : [cur];
}
function yoyCardHTML(y){
  const cur=yearTotalsFor(y);
  const priorYears=yoyYears(y).filter(x=>x!==y);
  const py = (UI.compareYear && priorYears.includes(UI.compareYear)) ? UI.compareYear
           : (priorYears.includes(y-1)? y-1 : (priorYears[0]!==undefined? priorYears[0] : null));
  const selOpts=priorYears.map(x=>`<option value="${x}" ${x===py?'selected':''}>${x}</option>`).join('');
  if(py===null){
    return `<div class="card"><div class="cardhead"><h3 style="margin:0">📅 Year over year</h3><span class="grow"></span>
      <span class="chip grey">${y}</span></div>
      <p class="mut small" style="margin:4px 0 0">Only ${y} has entries so far. Once a second year is recorded, this panel compares both side by side — spending by group, by category, and per month.</p></div>`;
  }
  const prev=yearTotalsFor(py);
  const curM=cur.inc-cur.exp, prevM=prev.inc-prev.exp;
  const expDelta=cur.exp-prev.exp, incDelta=cur.inc-prev.inc;
  const avg=(v,yy)=>v/(yy.effMonths||1);
  const sign=v=>v>0?'+':'−';
  const yo=(html,cls)=>`<div class="alertrow ${cls}" style="margin:0 0 12px">${html}</div>`;

  const row=(label, groupColor, cVals, pVals, effC, effP, isCat)=>{
    const ct=cVals.reduce((a,b)=>a+b,0), pt=pVals.reduce((a,b)=>a+b,0);
    const ca=ct/(effC||1), pa=pt/(effP||1);
    const d=ct-pt, dp= pa>0? (d/pa*100) : (ct>0? 100 : 0);
    const cls= d>0.005? 'delta-up' : d<-0.005? 'delta-down' : 'delta-flat';
    const arrow= d>0.005? '▲' : d<-0.005? '▼' : '▬';
    return `<tr>
      <td${isCat?' style="padding-left:12px"':''}>${label}</td>
      <td class="num">${ct? fmt0(ct):''}</td><td class="num mut">${ct? fmt0(ca):''}</td>
      <td class="num">${pt? fmt0(pt):''}</td><td class="num mut">${pt? fmt0(pa):''}</td>
      <td class="num ${cls}">${(ct||pt)? arrow+' '+fmt0(Math.abs(d)) : ''}</td>
      <td class="num ${cls}">${(ct||pt)? (dp>=0?'+':'−')+Math.abs(dp).toFixed(1)+'%' : ''}</td></tr>`;
  };
  const aTot=MONTHS.map((_,m)=>txForMonth(py,m).filter(t=>t.cat==='income').reduce((a,t)=>a+t.amt,0));  const bTot=MONTHS.map((_,m)=>txForMonth(y,m).filter(t=>t.cat==='income').reduce((a,t)=>a+t.amt,0));
  const aExp=MONTHS.map((_,m)=>txForMonth(py,m).filter(t=>t.cat!=='income').reduce((a,t)=>a+t.amt,0));
  const bExp=MONTHS.map((_,m)=>txForMonth(y,m).filter(t=>t.cat!=='income').reduce((a,t)=>a+t.amt,0));

  let body='';
  body+=`<tr class="grp"><td>💰 INCOME</td><td colspan="6"></td></tr>`;
  body+=row('Total income','#15803d', bTot, aTot, cur.effMonths, prev.effMonths, false);
  for(const g of ['obligations','essentials','lifestyle','occasions','future']){
    const gc=CATS.filter(c=>c.grp===g);
    const anyInGroup = gc.some(c=>(cur.byCat[c.id]||0)||(prev.byCat[c.id]||0));
    if(!anyInGroup) continue;
    body+=`<tr class="grp"><td>${GROUPS[g].name.toUpperCase()}</td><td colspan="6"></td></tr>`;
    for(const c of gc){
      const ct=+cur.byCat[c.id]||0, pt=+prev.byCat[c.id]||0;
      if(!ct && !pt) continue;
      body+=row(c.icon+' '+esc(c.name), null, [ct], [pt], cur.effMonths, prev.effMonths, true);
    }
    const gSumC=gc.reduce((a,c)=>a+(+cur.byCat[c.id]||0),0), gSumP=gc.reduce((a,c)=>a+(+prev.byCat[c.id]||0),0);
    body+=row('<b>'+esc(GROUPS[g].name)+' subtotal</b>', null, [gSumC], [gSumP], cur.effMonths, prev.effMonths, false);
  }
  const bExpTot=bExp.reduce((a,b)=>a+b,0), aExpTot=aExp.reduce((a,b)=>a+b,0);
  body+=`<tr class="tot"><td>TOTAL EXPENSES</td><td colspan="6"></td></tr>`;
  body+=row('<b>Total expenses</b>', null, [bExpTot], [aExpTot], cur.effMonths, prev.effMonths, false);

  const verdict = expDelta<-0.005 && bExpTot>0
    ? {cls:'info', icon:'📉', text:`Spending is down ${fmt0(Math.abs(expDelta))} vs ${py} (${Math.abs(expDelta/(aExpTot||1)*100).toFixed(1)}% lower) — progress.`}
    : expDelta>0.005 && bExpTot>0
      ? {cls:'warn', icon:'📈', text:`Spending is up ${fmt0(expDelta)} vs ${py} (${(expDelta/(aExpTot||1)*100).toFixed(1)}% higher), while income ${incDelta>=0?'rose':'fell'} ${fmt0(Math.abs(incDelta))}.`}
      : {cls:'info', icon:'➖', text:`Spending is broadly level with ${py} (${sign(expDelta)}${fmt0(Math.abs(expDelta))}).`};
  const netVerdict = cur.net>prev.net+0.005
    ? `<span class="chip green">net improved ${fmt0(cur.net-prev.net)}</span>`
    : cur.net<prev.net-0.005
      ? `<span class="chip red">net worsened ${fmt0(prev.net-cur.net)}</span>`
      : `<span class="chip grey">net unchanged</span>`;

  return `<div class="card">
    <div class="cardhead"><h3 style="margin:0">📅 Year over year</h3><span class="grow"></span>
      <span class="chip grey">compare ${y} against</span>
      <select style="width:auto" onchange="UI.compareYear=+this.value;renderGrid()">${selOpts}</select>
      ${netVerdict}
    </div>
    <p class="hint" style="margin:0 0 10px">Per-month and per-entry columns divide by the number of months that actually have entries, so a year that is still in progress is not flattered or penalised by empty months. Red = higher than ${py}; green = lower.</p>
    ${yo(`<span class="alertico">${verdict.icon}</span><div class="alertbody">${esc(verdict.text)}</div>`, verdict.cls)}
    <div class="kpis">
      <div class="kpi"><div class="lbl">Income ${y}</div><div class="v pos">${fmt0(cur.inc)}</div><div class="sub">${fmt0(avg(cur.inc,cur))}/mo · ${y===new Date().getFullYear()?'year to date':cur.monthsWith+' months'}</div></div>
      <div class="kpi"><div class="lbl">Income ${py}</div><div class="v pos">${fmt0(prev.inc)}</div><div class="sub">${fmt0(avg(prev.inc,prev))}/mo · ${prev.monthsWith} months</div></div>
      <div class="kpi"><div class="lbl">Spending ${y}</div><div class="v">${fmt0(cur.exp)}</div><div class="sub">${fmt0(avg(cur.exp,cur))}/mo</div></div>
      <div class="kpi"><div class="lbl">Spending ${py}</div><div class="v">${fmt0(prev.exp)}</div><div class="sub">${fmt0(avg(prev.exp,prev))}/mo</div></div>
      <div class="kpi"><div class="lbl">Net ${y}</div><div class="v ${cur.net>=0?'pos':'neg'}">${fmt0(cur.net)}</div><div class="sub">${cur.count} entries</div></div>
      <div class="kpi"><div class="lbl">Net ${py}</div><div class="v ${prev.net>=0?'pos':'neg'}">${fmt0(prev.net)}</div><div class="sub">${prev.count} entries</div></div>
    </div>
    <div class="scrollx"><table class="t">
      <thead><tr><th>Category</th><th class="num">${y} total</th><th class="num">${y} /mo</th><th class="num">${py} total</th><th class="num">${py} /mo</th><th class="num">Δ change</th><th class="num">Δ %</th></tr></thead>
      <tbody>${body}</tbody></table></div>
  </div>`;
}

/* ================================================================
   DATA HEALTH  (IMPROVEMENT 11)
   Trailing-12 averages, guideline budgets and the income map are only
   as good as the coverage behind them. This panel makes the gaps
   explicit and offers a one-click route to each fix.
   ================================================================ */
function healthCardHTML(){
  const h=dataHealth();
  const c=h.counts;
  const sevChip=c2=>c2.ok? '<span class="chip green">ok</span>' : `<span class="chip ${c2.sev==='warn'?'amber':'grey'}">check</span>`;
  const rows=h.checks.map(c2=>`<tr>
      <td>${h.checks.indexOf(c2)+1}. ${esc(c2.label)}</td>
      <td>${sevChip(c2)}</td>
      <td class="small mut">${esc(c2.detail)}</td></tr>`).join('');
  const streamRows=h.streams.length? h.streams.map(s=>`<tr>
      <td>${esc(s.label)}</td><td class="num">${fmt0(s.monthly)}/mo</td>
      <td>${s.posted12} posting(s) in window</td>
      <td>${s.last? esc(s.last) : '<span class="mut">never</span>'}</td>
      <td>${s.ok?'<span class="chip green">healthy</span>':'<span class="chip amber">stale</span>'}</td></tr>`).join('')
    : `<tr><td colspan="5" class="mut">No recurring income streams defined.</td></tr>`;
  const firstUnposted=h.streams.find(s=>!s.ok);
  return `<div class="card">
    <div class="cardhead"><h3 style="margin:0">📋 Data health — is the trailing-12 picture trustworthy?</h3><span class="grow"></span>
      <span class="chip ${h.pct>=85?'green':h.pct>=60?'amber':'red'}">${h.score} of ${h.total} checks pass · ${h.pct}%</span>
    </div>
    <p class="hint" style="margin:0 0 10px">Every average and guideline in LifeLedger is derived from the last ${h.monthsChecked} calendar months. Missing months, silent income streams and unclassified entries quietly distort them — this panel names them.</p>
    <div class="scrollx"><table class="t"><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="kpis" style="margin-top:12px">
      <div class="kpi"><div class="lbl">Months with data</div><div class="v">${h.monthsWithData}<span class="mut" style="font-size:14px">/${h.monthsChecked}</span></div><div class="sub">trailing-12 window</div></div>
      <div class="kpi"><div class="lbl">Entries</div><div class="v">${c.income+c.expense}</div><div class="sub">${c.income} income · ${c.expense} expense</div></div>
      <div class="kpi"><div class="lbl">Budgeted categories</div><div class="v">${c.budgeted}<span class="mut" style="font-size:14px">/${EXPENSE_CATS.length}</span></div><div class="sub">monthly budgets set</div></div>
      <div class="kpi"><div class="lbl">Attributed</div><div class="v">${c.attributed+c.linked}</div><div class="sub">${c.attributed} member · ${c.linked} project</div></div>
      <div class="kpi"><div class="lbl">Projects</div><div class="v">${c.projects}</div><div class="sub">${c.archived} archived</div></div>
    </div>
    <h4 style="margin:12px 0 6px">🔁 Recurring income streams</h4>
    <div class="scrollx"><table class="t"><thead><tr><th>Stream</th><th class="num">Planned</th><th>Posted</th><th>Last posting</th><th>Status</th></tr></thead><tbody>${streamRows}</tbody></table></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      ${firstUnposted?`<button class="btn small" onclick="showView('income')">🔁 Review income streams</button>`:''}
      ${h.missing.length?`<button class="btn ghost small" onclick="showView('ledger')">📒 Fill the ${h.missing.length} gap month${h.missing.length===1?'':'s'}</button>`:''}
      ${c.unclassified?`<button class="btn ghost small" onclick="UI.ledgerFilter={cat:'other',src:'all',q:'',month:'all'};showView('ledger');renderLedger()">🏷️ Re-categorise ${c.unclassified} entr${c.unclassified===1?'y':'ies'}</button>`:''}
      ${c.budgeted<8?`<button class="btn ghost small" onclick="applyGuidelineBudgets()">✨ Apply guideline budgets</button>`:''}
    </div>
  </div>`;
}

function setBudget(cat, v){ if(!cat) return; const n=Math.max(0,parseAmt(v)); if(n) state.budgets[cat]=round2(n); else delete state.budgets[cat]; store.save(); toast('Budget for '+catName(cat)+' set to '+fmt0(n)+'/mo'); renderGrid(); renderBudgets(); renderDash(); }
function drill(cat,m,y){ UI.ledgerFilter={cat:cat||'all', src:'all', q:'', month:y+'-'+m}; showView('ledger') }

