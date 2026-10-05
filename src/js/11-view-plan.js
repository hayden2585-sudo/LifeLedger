/* ================================================================
   VIEW: PLAN & ADVICE  (surplus → investments · deficit → strategies)
   ================================================================ */
const RISK_PROFILES={
  conservative:{name:'Conservative', rows:[['Emergency / money-market fund',40],['T-bills & fixed deposits',35],['Retirement annuity (tax-advantaged)',15],['Dividend & balanced funds',10]]},
  balanced:{name:'Balanced', rows:[['Emergency / money-market fund',20],['T-bills & fixed deposits',25],['Retirement annuity (tax-advantaged)',15],['Diversified equity funds / ETFs',30],['REITs / income property exposure',10]]},
  growth:{name:'Growth', rows:[['Emergency / money-market fund',10],['T-bills & fixed deposits',10],['Retirement annuity (tax-advantaged)',15],['Diversified equity funds / ETFs',45],['REITs / alternatives',20]]}
};
function updCutLbl(c){
  const t=t12();
  const l1=document.getElementById('cutLbl_'+c), l2=document.getElementById('cutSv_'+c);
  if(l1) l1.textContent=UI.cuts[c]||0;
  if(l2) l2.textContent=fmt0((t.byCatAvg[c]||0)*(UI.cuts[c]||0)/100);
}

/* ----------------------------------------------------------------
   IMPROVEMENT 3 — Personalised dynamic quick wins
   Replaces boilerplate tips with ranked, user-data-driven suggestions
   drawn from actual spending patterns, overspent categories, and
   subscription / dining / loan totals.
---------------------------------------------------------------- */
function buildQuickWins(t, excess, netRef){
  const wins=[];
  /* 1. Subscriptions: if user has any subscription spend flag it specifically */
  const subSpend=t.byCatAvg.subscriptions||0;
  if(subSpend>0){
    wins.push({score:subSpend, text:`You average ${fmt0(subSpend)}/mo on subscriptions. Auditing for unused or duplicate services typically recovers 20–40% — that's up to ${fmt0(subSpend*0.4)}/mo.`});
  }
  /* 2. Dining: if above guideline */
  const diningSpend=t.byCatAvg.dining||0;
  const diningGuide=netRef*(CAT.dining.guide||7)/100;
  if(diningSpend>diningGuide){
    const saving=diningSpend-diningGuide;
    wins.push({score:saving, text:`Dining averages ${fmt0(diningSpend)}/mo — ${fmt0(saving)}/mo above the ${CAT.dining.guide}% guideline. Two extra meal-prep days per week typically cuts restaurant spend by 25–30%, freeing ${fmt0(diningSpend*0.27)}/mo.`});
  }
  /* 3. Top overspent category (if not already dining) */
  const topOver=excess.find(x=>x.c.id!=='dining'&&x.c.id!=='loans');
  if(topOver){
    wins.push({score:topOver.excess, text:`${topOver.c.icon} ${topOver.c.name} is your biggest category overage: ${fmt0(topOver.spend)}/mo vs a ${topOver.c.guide}% guideline of ${fmt0(topOver.guide)}/mo. Bringing it to guideline saves ${fmt0(topOver.excess*12)}/yr.`});
  }
  /* 4. Insurance: always worth a re-quote nudge */
  const insSpend=t.byCatAvg.insurance||0;
  if(insSpend>0){
    wins.push({score:insSpend*0.12, text:`Insurance averages ${fmt0(insSpend)}/mo. Bundling motor and home cover and re-quoting annually typically saves 10–15% — about ${fmt0(insSpend*0.12)}/mo in your case.`});
  }
  /* 5. Loans: suggest refinancing if it's a large share */
  const loanSpend=t.byCatAvg.loans||0;
  if(loanSpend>netRef*0.30){
    wins.push({score:loanSpend*0.02, text:`Loan repayments take ${(loanSpend/netRef*100).toFixed(0)}% of your net income (${fmt0(loanSpend)}/mo). Ask your lender about refinancing — even a 0.5% rate reduction on ${fmt0(loanSpend)}/mo of obligations matters significantly over the life of the loan.`});
  }
  /* 6. Auto / fuel: if meaningful */
  const autoSpend=t.byCatAvg.auto||0;
  if(autoSpend>0){
    wins.push({score:autoSpend*0.08, text:`Auto costs (fuel, licensing) average ${fmt0(autoSpend)}/mo. Consolidating trips and checking tyre pressure monthly can reduce fuel consumption by 5–10% — roughly ${fmt0(autoSpend*0.08)}/mo.`});
  }
  /* 7. Structural gap fallback */
  if(wins.length<3){
    wins.push({score:0, text:'Your spending categories are close to guideline. The gap is likely structural — focus on the Income Map revenue target and consider refinancing fixed obligations.'});
  }
  /* sort by estimated saving, take top 5 */
  return wins.sort((a,b)=>b.score-a.score).slice(0,5).map(w=>w.text);
}

function renderPlan(){
  const el=$('v-plan'); const t=t12(); const im=incomeMapNumbers(); const S=state.settings;
  const mw=minWageNumbers();
  const stress=UI.stressPct;
  const cutCats=Object.keys(t.byCatAvg).filter(c=>c!=='savings'&&c!=='income').sort((a,b)=>t.byCatAvg[b]-t.byCatAvg[a]).slice(0,6);
  const cutSavings=cutCats.reduce((a,c)=>a+(t.byCatAvg[c]*(UI.cuts[c]||0)/100),0);
  const effExp=t.expAvg*(1+stress/100)-cutSavings;
  const effNet=t.incAvg-effExp;
  const savingsAlloc=t.byCatAvg.savings||0;
  const surplusCard=effNet>=0;
  /* investments */
  const contrib=(UI.invContrib==null? Math.max(0,effNet): UI.invContrib);
  const g=growthSVG(contrib, UI.invReturn, UI.invYears, 0);
  const profile=RISK_PROFILES[UI.riskProfile||'balanced'];
  const emergFund=S.emergencyMonths*effExp;
  /* deficit table: excess over guideline */
  const netRef=t.incAvg||state.streams.reduce((a,s)=>a+(+s.monthly||0),0);
  const excess=EXPENSE_CATS.filter(c=>c.guide&&t.byCatAvg[c.id]>netRef*c.guide/100 && c.id!=='loans')
    .map(c=>({c, spend:t.byCatAvg[c.id], guide:netRef*c.guide/100, excess:t.byCatAvg[c.id]-netRef*c.guide/100}))
    .sort((a,b)=>b.excess-a.excess);
  const stratLines=excess.slice(0,4).map(x=>
    `• <b>${x.c.name}</b> runs ${fmt0(x.spend)}/mo — ${(x.spend/netRef*100).toFixed(1)}% of net income vs a ${x.c.guide}% guideline. Bringing it to the guideline frees <b>${fmt0(x.excess)}/mo (${fmt0(x.excess*12)}/yr)</b>.`).join('<br>');

  /* IMPROVEMENT 3 — personalised quick wins (replaces generic boilerplate) */
  const quickWins = buildQuickWins(t, excess, netRef);

  el.innerHTML=`
  <div class="card">
    <div class="cardhead"><h3 style="margin:0">💡 Where you stand</h3><span class="grow"></span>
      ${coverageChip(t)}
      <span class="chip ${surplusCard?'green':'red'}">${surplusCard? 'Surplus':'Deficit'}</span></div>
    <div class="kpis" style="margin-bottom:10px">
      <div class="kpi"><div class="lbl">Take-home (avg)</div><div class="v">${fmt0(t.incAvg)}</div><div class="sub">per month</div></div>
      <div class="kpi"><div class="lbl">Lifestyle cost (avg)</div><div class="v">${fmt0(t.expAvg)}</div><div class="sub">incl. ${fmt0(savingsAlloc)} savings</div></div>
      <div class="kpi"><div class="lbl">Monthly ${surplusCard?'surplus':'deficit'}</div><div class="v ${surplusCard?'pos':'neg'}">${fmt0(Math.abs(effNet))}</div><div class="sub">${fmt0(effNet*12)}/yr</div></div>
      <div class="kpi"><div class="lbl">Savings rate</div><div class="v">${t.incAvg?((savingsAlloc+Math.max(0,effNet))/t.incAvg*100).toFixed(1):'—'}%</div><div class="sub">allocations + unspent</div></div>
    </div>
    ${mw.netM>0? `<p class="hint" style="margin:0 0 10px">📏 Reference: a full-time minimum-wage job nets ≈ <b>${fmt0(mw.netM)}/mo</b> — your monthly position of ${fmt0(effNet)} equals about <b>${Math.round(Math.abs(effNet)/(mw.hourly*4.333))} hours/week</b> of minimum-wage work.</p>`:''}
    <div class="frow">
      <div><label class="f">Cost-of-living stress test: <span id="stressLbl">+${stress}%</span> <span class="mut" id="stressSub">${stress? 'adds '+fmt0(t.expAvg*stress/100)+'/mo':''}</span></label>
        <input type="range" min="0" max="30" step="1" value="${stress}" style="width:100%"
          oninput="UI.stressPct=+this.value;document.getElementById('stressLbl').textContent='+'+this.value+'%'"
          onchange="renderPlan()"></div>
      <div><label class="f">What-if cuts</label>
        <div class="small mut">Trim categories below — the position updates when you release the slider${cutSavings?` · cutting <b class="pos">${fmt0(cutSavings)}/mo</b>`:''}</div></div>
    </div>
    <div class="formgrid">
      ${cutCats.map(c=>`<div><label class="f">${catIcon(c)} ${catName(c)} −<span id="cutLbl_${c}">${UI.cuts[c]||0}</span>% <span class="mut">saves <span id="cutSv_${c}">${fmt0(t.byCatAvg[c]*(UI.cuts[c]||0)/100)}</span>/mo</span></label>
        <input type="range" min="0" max="30" step="5" value="${UI.cuts[c]||0}" style="width:100%"
          oninput="UI.cuts['${c}']=+this.value;updCutLbl('${c}')"
          onchange="renderPlan()"></div>`).join('')}
    </div>
  </div>
  <details class="sec" ${surplusCard?'open':''}>
    <summary>📈 Surplus playbook — investing spare cash (${fmt0(Math.max(0,effNet))}/mo available)</summary>
    <div class="inner">
      <div class="formgrid" style="margin-bottom:12px">
        <div><label class="f">Monthly contribution</label><input type="number" min="0" step="10" value="${contrib||''}" placeholder="0" onchange="UI.invContrib=parseAmt(this.value);renderPlan()"></div>
        <div><label class="f">Expected annual return %</label><select onchange="UI.invReturn=+this.value;renderPlan()">
          ${[3,4,5,6,7,8,10,12].map(r=>`<option value="${r}" ${r===UI.invReturn?'selected':''}>${r}%</option>`).join('')}</select></div>
        <div><label class="f">Horizon: <span id="invYearsLbl">${UI.invYears}</span> years</label><input type="range" min="1" max="30" value="${UI.invYears}" style="width:100%" oninput="UI.invYears=+this.value;document.getElementById('invYearsLbl').textContent=this.value" onchange="renderPlan()"></div>
        <div><label class="f">Risk profile</label><select onchange="UI.riskProfile=this.value;renderPlan()">
          ${Object.entries(RISK_PROFILES).map(([k,p])=>`<option value="${k}" ${k===(UI.riskProfile||'balanced')?'selected':''}>${p.name}</option>`).join('')}</select></div>
      </div>
      <div class="kpis" style="margin-bottom:10px">
        <div class="kpi"><div class="lbl">Invested to</div><div class="v">${fmt0(g.contributed)}</div><div class="sub">over ${UI.invYears} yrs at ${contrib}/mo</div></div>
        <div class="kpi"><div class="lbl">Projected value</div><div class="v pos">${fmt0(g.fv)}</div><div class="sub">at ${UI.invReturn}%/yr compounded monthly</div></div>
        <div class="kpi"><div class="lbl">Growth earned</div><div class="v">${fmt0(g.fv-g.contributed)}</div><div class="sub">compounding doing the work</div></div>
        <div class="kpi"><div class="lbl">Emergency fund first</div><div class="v">${fmt0(emergFund)}</div><div class="sub">${S.emergencyMonths} months × ${fmt0(effExp)}</div></div>
      </div>
      ${g.svg}
      <h3 style="margin-top:12px">${profile.name} allocation (educational example)</h3>
      <table class="t">${profile.rows.map(r=>`<tr><td>${r[0]}</td><td class="num b">${r[1]}%</td><td class="num mut">${fmt0(contrib*r[1]/100)}/mo</td></tr>`).join('')}</table>
      <p class="hint" style="margin-top:8px">⚠️ Educational illustration only — not financial advice. Verify any product with a licensed advisor and your local regulator (e.g. TTSEC in Trinidad &amp; Tobago), and check fees, lock-ins and deposit insurance.</p>
    </div>
  </details>
  <details class="sec" ${!surplusCard?'open':''}>
    <summary>🛟 Deficit playbook — saving strategies (${!surplusCard? fmt0(-effNet)+'\/mo to close':'currently in surplus — bookmark this for hard months'})</summary>
    <div class="inner">
      ${excess.length? `<table class="t">
        <thead><tr><th>Category</th><th class="num">You spend</th><th class="num">Guideline</th><th class="num">Over guideline</th><th class="num">Cut to guideline saves</th><th></th></tr></thead>
        <tbody>${excess.map(x=>`<tr><td>${x.c.icon} ${x.c.name}</td><td class="num">${fmt0(x.spend)}</td><td class="num mut">${fmt0(x.guide)} (${x.c.guide}%)</td>
          <td class="num neg b">${fmt0(x.excess)}</td><td class="num pos b">${fmt0(x.excess*12)}/yr</td>
          <td><button class="btn ghost small" onclick="setBudget('${x.c.id}',${Math.round(x.guide/10)*10})">set as budget</button></td></tr>`).join('')}</tbody></table>
        <div style="margin-top:10px">${stratLines}</div>`:
        '<p class="mut">No category is dramatically above guideline — your deficit (if any) is structural: income vs fixed obligations. Focus on the Income Map revenue target and refinancing fixed costs.</p>'}
      <h3 style="margin-top:14px">🎯 Biggest savings opportunities — based on your actual spending</h3>
      <div class="small" style="line-height:1.9">${quickWins.map(q=>'• '+q).join('<br>')}</div>
      <p class="hint" style="margin-top:8px">⚠️ Educational guidance only — not financial advice.</p>
    </div>
  </details>`;
}
