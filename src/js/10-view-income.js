/* ================================================================
   VIEW: INCOME MAP  (where does income/revenue need to be)
   ================================================================ */
function renderIncome(){
  const el=$('v-income'); const im=incomeMapNumbers(); const S=state.settings;
  const streams=state.streams.map(s=>`<tr>
    <td>${esc(s.label)}</td><td>${esc(incomeTypeBadge(s.incomeType||guessIncomeType(s.label)))}</td><td class="num">${fmt0(s.monthly)}</td><td class="num mut">${fmt0(s.monthly*12)}</td>
    <td style="text-align:right"><button class="btn ghost small" onclick="delStream('${s.id}')">✕</button></td></tr>`).join('');
  const incomeMix={};
  for(const {y,m} of im.t.ms) for(const t of txForMonth(y,m)) if(t.cat==='income'){
    const k=t.incomeType||guessIncomeType((t.sub||'')+' '+(t.desc||'')); incomeMix[k]=(incomeMix[k]||0)+t.amt;
  }
  const incomeMixRows=INCOME_TYPES.filter(x=>incomeMix[x.id]>0).sort((a,b)=>(incomeMix[b.id]||0)-(incomeMix[a.id]||0)).map(x=>{
    const avg=(incomeMix[x.id]||0)/im.t.n; const share=im.t.incAvg?avg/im.t.incAvg*100:0;
    return `<tr><td>${incomeTypeBadge(x.id)}</td><td>${esc(x.kind)}</td><td class="num">${fmt0(avg)}</td><td class="num">${share.toFixed(1)}%</td></tr>`;
  }).join('')||'<tr><td colspan="4" class="mut">No recorded income events in the trailing 12 months.</td></tr>';
  const incomeMixCard=`<div class="card"><h3>🧾 Recorded income mix — trailing 12 months</h3><p class="hint" style="margin-top:0">Income is still counted as cash inflow, but these types keep recurring pay, irregular payments, investment income, capital receipts, benefits and rent distinguishable.</p><table class="t"><thead><tr><th>Income type</th><th>Class</th><th class="num">Avg /mo</th><th class="num">Share</th></tr></thead><tbody>${incomeMixRows}</tbody></table></div>`;
  /* survival = obligations + essentials */
  const survivalM=['obligations','essentials'].reduce((a,g)=>a+CATS.filter(c=>c.grp===g).reduce((b,c)=>b+(im.t.byCatAvg[c.id]||0),0),0);
  const ladder=[
    {name:'🛟 Survival (essentials + obligations only)', net:survivalM},
    {name:'🏠 Current lifestyle (everything recorded)', net:im.lifestyleM},
    {name:`🐖 Lifestyle + ${S.savingsTargetPct}% savings goal`, net:im.lifestyleM+im.savingsGoalM},
    {name:'😌 Comfort (+10% buffer)', net:(im.lifestyleM+im.savingsGoalM)*1.1}
  ].map(r=>{ const gross=grossForNet(Math.max(1,r.net*12));
    const ok=im.netMonthly>=r.net;
    return `<tr class="ladder"><td>${r.name}</td>
      <td class="num b">${fmt0(r.net)}/mo</td><td class="num mut">${fmt0(r.net*12)}/yr</td>
      <td class="num b">${fmt0(gross/12)}/mo</td><td class="num mut">${fmt0(gross)}/yr</td>
      <td style="text-align:center">${ok?'<span class="chip green">covered</span>':`<span class="chip red">short by ${fmt0(r.net-im.netMonthly)}/mo</span>`}</td></tr>` }).join('');
  const maxG=im.grossComfort*1.35;
  const marks=[
    {gross:im.grossCurrent, color:'#3450b4', label:'you (≈'+fmtK(im.grossCurrent)+'/yr gross)'},
    {gross:im.grossLifestyle, color:'#b45309', label:'break-even '+fmtK(im.grossLifestyle)},
    {gross:im.grossWithSavings, color:'#15803d', label:'+savings '+fmtK(im.grossWithSavings)},
    {gross:im.grossComfort, color:'#7c3aed', label:'comfort '+fmtK(im.grossComfort)}
  ];
  const eBiz=im.grossWithSavings/(S.businessMarginPct/100);
  /* ---- minimum-wage lens ---- */
  const mw=minWageNumbers();
  const lensRows=[
    ['🛟 Survival (essentials + obligations)', survivalM],
    ['🏠 Current lifestyle', im.lifestyleM],
    [`🐖 Lifestyle + ${S.savingsTargetPct}% savings goal`, im.lifestyleM+im.savingsGoalM],
    ['😌 Comfort (+10% buffer)', (im.lifestyleM+im.savingsGoalM)*1.1]
  ];
  const catLens=Object.entries(im.t.byCatAvg).filter(e=>e[1]>0).sort((a,b)=>b[1]-a[1]);
  const lensCard = mw.netM>0? `
  <div class="card">
    <h3>📏 Minimum-wage lens — your costs as a share of a minimum-wage income</h3>
    <p class="hint" style="margin-top:0">Full-time = 40 h/week ≈ 173⅓ h/month. At <b>${fmt(mw.hourly)}/hr</b> that is about <b>${fmt0(mw.grossM)}/mo gross</b> → <b>${fmt0(mw.netM)}/mo net</b> after your tax &amp; deduction settings (editable in the card above).</p>
    <div class="kpis" style="margin-bottom:12px">
      <div class="kpi"><div class="lbl">Minimum wage (net)</div><div class="v">${fmt0(mw.netM)}</div><div class="sub">per month, full-time</div></div>
      <div class="kpi"><div class="lbl">Your lifestyle cost</div><div class="v">${(im.lifestyleM/mw.netM).toFixed(1)}×</div><div class="sub">${pctMinWage(im.lifestyleM).toFixed(0)}% of a minimum-wage income</div></div>
      <div class="kpi"><div class="lbl">One min-wage job covers</div><div class="v">${im.lifestyleM>0?(mw.netM/im.lifestyleM*100).toFixed(0)+'%':'—'}</div><div class="sub">of your current lifestyle</div></div>
      <div class="kpi"><div class="lbl">Min-wage hours/week</div><div class="v">${mw.hourly>0?Math.round(im.lifestyleM/(mw.hourly*4.333)):0}h</div><div class="sub">to fund your lifestyle entirely</div></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:22px">
      <div>
        <h3 style="font-size:13.5px">Needs ladder vs minimum wage</h3>
        <table class="t ladder">
          <thead><tr><th>Level</th><th class="num">/mo</th><th class="num">% of min wage</th><th class="num">Multiple</th></tr></thead>
          <tbody>${lensRows.map(r=>{ const p=pctMinWage(r[1]);
            return `<tr><td>${r[0]}</td><td class="num b">${fmt0(r[1])}</td>
            <td class="num"><span class="bar" style="display:inline-block;width:64px;vertical-align:middle;margin-right:6px"><i style="width:${Math.min(100,p).toFixed(0)}%;background:#db2777"></i></span>${p.toFixed(0)}%</td>
            <td class="num b">${(r[1]/mw.netM).toFixed(2)}×</td></tr>`}).join('')}</tbody>
        </table>
      </div>
      <div>
        <h3 style="font-size:13.5px">Each category as a share of a minimum-wage income</h3>
        <table class="t">
          <thead><tr><th>Category</th><th class="num">Avg /mo</th><th class="num">% of min wage</th></tr></thead>
          <tbody>${catLens.map(e=>`<tr><td>${catIcon(e[0])} ${esc(catName(e[0]))}</td><td class="num">${fmt0(e[1])}</td><td class="num">${pctMinWage(e[1]).toFixed(1)}%</td></tr>`).join('')||'<tr><td colspan="3" class="mut">No expense data yet.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  </div>`:'';
  el.innerHTML=`
  <div class="grid2">
    <div class="card">
      <h3>💵 Income streams</h3>
      <table class="t"><thead><tr><th>Stream (net take-home)</th><th>Type</th><th class="num">Monthly</th><th class="num">Annual</th><th></th></tr></thead>
      <tbody>${streams||'<tr><td colspan="5" class="mut">No streams yet</td></tr>'}</tbody></table>
      <div class="frow" style="margin-top:10px">
        <div><label class="f">New stream name</label><input type="text" id="streamLabel" placeholder="e.g. Salary (net)"></div>
        <div><label class="f">Income type</label><select id="streamType">${incomeTypeOptions('salary',true)}</select></div>
        <div><label class="f">Monthly net (${esc(SYM())})</label><input type="number" id="streamAmt" step="10" min="0" placeholder="0"></div>
        <div style="align-self:end"><button class="btn" onclick="addStream()">➕ Add stream</button></div>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn ghost small" onclick="postStreams()">📋 Post this month's income to the ledger</button>
        <span class="hint" style="align-self:center">Streams drive the map; posted entries drive the actuals.</span>
      </div>
    </div>
    <div class="card">
      <h3>⚙️ Tax & deduction assumptions <span class="mut small" style="font-weight:400">(editable estimates)</span></h3>
      <div class="frow">
        <div><label class="f">Annual tax-free allowance</label><input type="number" step="500" min="0" value="${S.taxAllowance}" onchange="setSetting('taxAllowance',this.value)"></div>
        <div><label class="f">PAYE rate % (up to 1M)</label><input type="number" step="0.5" min="0" max="60" value="${S.taxRate}" onchange="setSetting('taxRate',this.value)"></div>
        <div><label class="f">Employee NIS %</label><input type="number" step="0.1" min="0" max="15" value="${S.nisPct}" onchange="setSetting('nisPct',this.value)"></div>
        <div><label class="f">NIS insurable ceiling /mo</label><input type="number" step="100" min="0" value="${S.nisCeilingMonthly}" onchange="setSetting('nisCeilingMonthly',this.value)"></div>
      </div>
      <div class="frow">
        <div><label class="f">Health surcharge /week (flat)</label><input type="number" step="0.05" min="0" value="${S.healthSurchargeWeekly}" onchange="setSetting('healthSurchargeWeekly',this.value)"></div>
        <div><label class="f">Other deductions % (pension etc.)</label><input type="number" step="0.1" min="0" max="30" value="${S.payrollDeductionPct}" onchange="setSetting('payrollDeductionPct',this.value)"></div>
        <div><label class="f">Savings target % of net</label><input type="number" step="1" min="0" max="60" value="${S.savingsTargetPct}" onchange="setSetting('savingsTargetPct',this.value)"></div>
        <div><label class="f">Emergency fund (months)</label><input type="number" step="1" min="1" max="12" value="${S.emergencyMonths}" onchange="setSetting('emergencyMonths',this.value)"></div>
      </div>
      <div class="frow">
        <div><label class="f">Business margin % (self-employed)</label><input type="number" step="1" min="1" max="99" value="${S.businessMarginPct}" onchange="setSetting('businessMarginPct',this.value)"></div>
        <div><label class="f">Minimum wage / hour</label><input type="number" step="0.25" min="0" value="${S.minWageHourly}" onchange="setSetting('minWageHourly',this.value)"></div>
      </div>
      <p class="hint">Defaults follow Trinidad &amp; Tobago (2026): TT$90,000 personal allowance · 25% PAYE on chargeable income up to TT$1M (30% above) · employee NIS 5.4% on insurable earnings capped at TT$13,600/mo · health surcharge is a flat TT$8.25/wk above TT$469.99/mo earnings (TT$4.80/wk below) · 70% of employee NIS is deductible before PAYE · TT$20.50/hr minimum wage. Adjust to your payslip or country.</p>
    </div>
  </div>
  ${incomeMixCard}
  <div class="card">
    <h3>🧭 The cost-of-living equation — where your income needs to be</h3>
    <div class="formgrid" style="background:#f6f8fd;border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-bottom:12px;font-size:13.5px">
      <div>Monthly lifestyle cost <b>${fmt0(im.lifestyleM)}</b><br><span class="mut small">incl. ${fmt0(im.savingsAllocM)}/mo savings allocations; core spend ${fmt0(im.coreLifestyleM)}</span></div>
      <div>＋ Savings goal (${S.savingsTargetPct}% of net) <b>${fmt0(im.savingsGoalM)}</b></div>
      <div>＝ Required take-home <b>${fmt0(im.lifestyleM+im.savingsGoalM)}/mo</b></div>
      <div>÷ (1 − effective tax &amp; deductions ${etr(im.grossWithSavings).toFixed(1)}%)</div>
      <div>＝ Required <b class="pos">gross ${fmt0(im.grossWithSavings/12)}/mo</b><br><span class="mut small">${fmt0(im.grossWithSavings)}/yr salary</span></div>
    </div>
    <table class="t ladder">
      <thead><tr><th>Level</th><th class="num">Take-home needed /mo</th><th class="num">/yr</th><th class="num">Gross salary needed /mo</th><th class="num">/yr</th><th>Status vs your ${fmt0(im.netMonthly)}/mo</th></tr></thead>
      <tbody>${ladder}</tbody></table>
    <p class="hint" style="margin-top:8px">Tax inversion solves gross ↔ net exactly (binary search on the allowance + rate you set). “Survival” counts your obligations &amp; essentials only.</p>
  </div>
  ${lensCard}
  <div class="grid2">
    <div class="card">
      <h3>📈 Net pay vs your lifestyle need</h3>
      ${lineNetSVG(maxG, netFromGross, im.needWithSavings, marks)}
      <p class="hint">Blue curve = take-home pay after PAYE &amp; payroll deductions. Dashed amber = what your current lifestyle plus the savings goal actually costs per year. Where the curve crosses the line is the gross salary you need.</p>
    </div>
    <div class="card">
      <h3>🚀 Self-employed / side-hustle revenue view</h3>
      <table class="t">
        <tr><td>To fund your current lifestyle</td><td class="num b">${fmt0(im.grossLifestyle/12)}/mo gross income</td></tr>
        <tr><td>At a ${S.businessMarginPct}% margin that needs revenue of</td><td class="num b">${fmt0(im.grossLifestyle/12/(S.businessMarginPct/100))}/mo</td></tr>
        <tr><td>Lifestyle + savings goal → gross</td><td class="num b">${fmt0(im.grossWithSavings/12)}/mo</td></tr>
        <tr><td>…needs revenue at ${S.businessMarginPct}% margin</td><td class="num b pos">${fmt0(eBiz/12)}/mo</td></tr>
        <tr><td>…per year</td><td class="num b pos">${fmt0(eBiz)}</td></tr>
      </table>
      <p class="hint" style="margin-top:8px">Revenue needed = required gross income ÷ margin. Set your real margin above (a typical service business runs 25–45%).</p>
      ${im.gapMonthly<0?
        `<div style="margin-top:10px"><span class="chip red">You're running ${fmt0(-im.gapMonthly)}/mo behind your lifestyle</span> <a href="#" onclick="showView('plan');return false">See saving strategies →</a></div>`:
        `<div style="margin-top:10px"><span class="chip green">You clear ${fmt0(im.gapMonthly)}/mo above your lifestyle</span> <a href="#" onclick="showView('plan');return false">See investment options →</a></div>`}
    </div>
  </div>`;
}
function addStream(){
  const l=$('streamLabel').value.trim(), a=parseAmt($('streamAmt').value);
  const incomeType=$('streamType')?.value||'salary';
  if(!l||!a){ toast('Give the stream a name and a monthly amount'); return }
  state.streams.push({id:uid(), label:l, monthly:round2(a), incomeType}); store.save(); renderAll(); toast('Income stream added');
}
function delStream(id){ state.streams=state.streams.filter(s=>s.id!==id); store.save(); renderAll(); toast('Stream removed') }
function postStreams(){
  const mk=UI.month; let added=0, skipped=0;
  for(const s of state.streams){
    /* duplicate check keyed on stream id, so renaming a stream can't create a duplicate
       (label fallback covers entries posted before v1.2) */
    const exists=state.tx.some(t=>t.cat==='income'&&txYM(t).y===mk.y&&txYM(t).m===mk.m&&(t.streamId? t.streamId===s.id : t.sub===s.label));
    if(exists){ skipped++; continue }
    state.tx.push({id:uid(), date:mk.y+'-'+String(mk.m+1).padStart(2,'0')+'-01', cat:'income', sub:s.label, desc:'Posted from income stream', amt:s.monthly, src:'manual', ded:false, streamId:s.id, memberId:s.memberId||null, incomeType:s.incomeType||guessIncomeType(s.label)}); added++;
  }
  store.save(); renderAll(); toast(added+' income entries posted'+(skipped?' ('+skipped+' already posted)':''));
}
function setSetting(k,v){ state.settings[k]=parseAmt(v)||0; store.save(); renderIncome(); renderDash(); renderPlan(); }

