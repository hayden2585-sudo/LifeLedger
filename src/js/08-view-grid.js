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
  </div>`;
}
function setBudget(cat, v){ if(!cat) return; const n=Math.max(0,parseAmt(v)); if(n) state.budgets[cat]=round2(n); else delete state.budgets[cat]; store.save(); toast('Budget for '+catName(cat)+' set to '+fmt0(n)+'/mo'); renderGrid(); renderBudgets(); renderDash(); }
function drill(cat,m,y){ UI.ledgerFilter={cat:cat||'all', src:'all', q:'', month:y+'-'+m}; showView('ledger') }

