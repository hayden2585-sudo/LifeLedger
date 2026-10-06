/* ================================================================
   SHARED NUMBER CRUNCHING
   ================================================================ */
function monthStats(y,m){
  const a=agg(txForMonth(y,m));
  const over=[];
  let budgetTotal=0, overspendTotal=0;
  for(const c of EXPENSE_CATS){ const bud=+state.budgets[c.id]||0; const act=a.byCat[c.id]||0;
    if(bud>0){ budgetTotal+=bud; if(act>bud){ overspendTotal+=act-bud; over.push({cat:c.id, act, bud, by:act-bud}) } } }
  over.sort((x,z)=>z.by-x.by);
  return { inc:a.inc, exp:a.exp, byCat:a.byCat, over, budgetTotal, overspendTotal,
    adherence: budgetTotal? Math.max(0,100-overspendTotal/budgetTotal*100): null };
}
/* tax / net-pay engine (annual figures), itemised TT statutory deductions:
   - NIS: nisPct% of insurable earnings only, capped at nisCeilingMonthly x 12 (nothing above)
   - Health surcharge: flat weekly amount; lower statutory rate (TT$4.80/wk) at or under TT$469.99/mo
   - 70% of employee NIS is deductible from income before PAYE (with the personal allowance)
   - payrollDeductionPct covers OTHER deductible deductions (pension etc.)                 */
function netFromGross(grossAnnual){
  const s=state.settings, g=Math.max(0,grossAnnual);
  const nis=Math.min(g,(+s.nisCeilingMonthly||0)*12)*(+s.nisPct||0)/100;
  const surcharge=g>0? ((g/12)>469.99? (+s.healthSurchargeWeekly||0) : 4.80)*52 : 0;
  const other=g*(+s.payrollDeductionPct||0)/100;
  const taxable=Math.max(0, g-0.70*nis-other-s.taxAllowance);
  const tax=taxable<=1000000? taxable*s.taxRate/100 : 1000000*s.taxRate/100+(taxable-1000000)*0.30;
  return g-nis-surcharge-other-tax;
}
function grossForNet(netAnnual){
  let lo=0, hi=Math.max(netAnnual*2.5, state.settings.taxAllowance+netAnnual);
  for(let k=0;k<90;k++){ const mid=(lo+hi)/2; if(netFromGross(mid)<netAnnual) lo=mid; else hi=mid }
  /* netFromGross has a small step DOWN where the health surcharge switches from $4.80 to $8.25/wk;
     walk down so we return the LOWEST gross that still reaches the target net */
  let g=(lo+hi)/2, step=64;
  while(step>=0.001){ if(netFromGross(g-step)>=netAnnual) g-=step; else step/=2 }
  return g;
}
function etr(grossAnnual){ if(grossAnnual<=0) return 0; return (grossAnnual-netFromGross(grossAnnual))/grossAnnual*100 }
/* ---- minimum-wage lens ---- */
const FULLTIME_HOURS=173.33;   /* 40 h/week x 52 weeks / 12 months */
function minWageNumbers(){
  const S=state.settings;
  const grossM=(+S.minWageHourly||0)*FULLTIME_HOURS;
  const netM=grossM>0? netFromGross(grossM*12)/12 : 0;
  return {hourly:+S.minWageHourly||0, grossM, netM};
}
function pctMinWage(amountM){ const mw=minWageNumbers(); return mw.netM>0? amountM/mw.netM*100 : 0 }

/* ----------------------------------------------------------------
   IMPROVEMENT 6 — Income map recurring-only toggle
   incomeMapNumbers() now respects UI.incomeMapBase:
     't12'     → trailing-12 average income (original behaviour)
     'streams' → sum of recurring income streams only (better for
                 users with irregular windfalls in their T12 history)
---------------------------------------------------------------- */
function incomeMapNumbers(){
  const t=t12();
  const streamsMonthly=state.streams.reduce((a,s)=>a+(+s.monthly||0),0);
  /* base income: T12 average OR recurring streams only */
  const useStreams = (UI.incomeMapBase==='streams');
  const netMonthly = useStreams
    ? (streamsMonthly || t.incAvg)          /* fall back to T12 if no streams defined */
    : (t.incAvg>0? t.incAvg : streamsMonthly);
  const lifestyleM = t.expAvg;
  const savingsAllocM = t.byCatAvg.savings||0;
  const coreLifestyleM = lifestyleM - savingsAllocM;
  const savingsGoalM = netMonthly*state.settings.savingsTargetPct/100;
  const S=state.settings;
  const needLifestyle = lifestyleM*12;
  const needWithSavings = (lifestyleM+savingsGoalM)*12;
  const needComfort = needWithSavings*1.10;
  const netAnnual=netMonthly*12;
  return { t, netMonthly, streamsMonthly, lifestyleM, coreLifestyleM, savingsAllocM, savingsGoalM,
    needLifestyle, needWithSavings, needComfort, netAnnual,
    usingStreams: useStreams,
    grossCurrent: grossForNet(Math.max(1,netAnnual)),
    grossLifestyle: grossForNet(Math.max(1,needLifestyle)),
    grossWithSavings: grossForNet(Math.max(1,needWithSavings)),
    grossComfort: grossForNet(Math.max(1,needComfort)),
    gapMonthly: netMonthly-lifestyleM };
}

/* ================================================================
   PROACTIVE ALERTS  (IMPROVEMENT 6)
   The app already knows when a budget is overspent, when a project
   is behind and when data has gaps — but it only said so once you
   navigated to that view. alertsFor() turns those known facts into a
   ranked, actionable list the Dashboard can surface immediately.

   Severity drives ordering and colour only; nothing here mutates
   state. Every alert carries an optional `go` view so the UI can
   offer a one-click route to the fix.
   ================================================================ */
const SEV_RANK={critical:0,warn:1,info:2};
/* Which ledger entries count as postings of a given income stream?
   Stream id is authoritative, but entries created by the sample data, by CSV/OCR
   import or before v1.2 carry no streamId — for those, a distinctive first word of
   the stream label ("Salary (net take-home)" → "salary") is matched against the
   entry's vendor text, so a stream that IS being posted is not reported as silent. */
function txMatchesStream(t,s){
  if(t.cat!=='income') return false;
  if(t.streamId) return t.streamId===s.id;
  const word=String(s.label||'').toLowerCase().split(/[^a-z]+/).filter(w=>w.length>3)[0];
  if(!word) return false;
  return ((t.sub||'')+' '+(t.desc||'')).toLowerCase().includes(word);
}
function streamPostings(s){ return state.tx.filter(t=>txMatchesStream(t,s)) }

/* ================================================================
   SPENDING CADENCE
   A fixed cost that is not billed monthly — motor insurance every
   quarter, licensing annually, school fees by term — breaches a
   monthly budget every single time it lands, which is not overspend.
   Left alone, that trains people to ignore budget alerts entirely.
   detectCadence() recognises the pattern from the ledger itself and
   alertsFor() stops crying wolf, reporting one honest annual figure
   instead of a monthly breach per payment.
   ================================================================ */
function categorySpendMonths(catId){
  const out={};
  for(const x of state.tx){ if(x.cat!==catId) continue;
    const p=txYM(x); out[p.y*12+p.m]=(out[p.y*12+p.m]||0)+x.amt }
  return out;
}
function detectCadence(catId){
  const by=categorySpendMonths(catId);
  const active=Object.values(by).filter(v=>v>0);
  if(active.length<3) return null;                    /* not enough history to tell */
  const mean=active.reduce((a,b)=>a+b,0)/active.length;
  if(mean<=0) return null;
  const sd=Math.sqrt(active.reduce((a,b)=>a+(b-mean)*(b-mean),0)/active.length);
  const cv=sd/mean;
  if(cv<0.5) return null;                             /* reasonably steady: treat as monthly */
  /* label the pattern from how often it actually appears */
  const gaps=[]; const keys=Object.keys(by).map(Number).sort((a,b)=>a-b);
  for(let i=1;i<keys.length;i++) gaps.push(keys[i]-keys[i-1]);
  const avgGap=gaps.length? gaps.reduce((a,b)=>a+b,0)/gaps.length : 1;
  const kind = avgGap>=10? 'annual' : avgGap>=2.5? 'quarterly' : 'irregular';
  /* adverb form for prose ("billed quarterly"), noun+ly for chips ("quarterly") */
  const adv = { annual:'annually', quarterly:'quarterly', irregular:'irregularly' }[kind];
  return { catId, cv, activeMonths:active.length, kind, label:kind, adverb:adv };
}
/* true when a category should NOT be judged against a single month's budget */
function isLumpyCategory(catId){ const d=detectCadence(catId); return !!d && d.activeMonths>=3 }

function alertsFor(){
  const out=[];
  const now=new Date();
  const mk=UI.month||{y:now.getFullYear(), m:now.getMonth()};
  const daysInMonth=new Date(mk.y, mk.m+1, 0).getDate();
  const isCurrentMonth = mk.y===now.getFullYear() && mk.m===now.getMonth();
  const st=monthStats(mk.y, mk.m);
  const tw=t12();

  /* --- budget overages, with the remaining-days context. A cost that is not
         billed monthly is reported once, as an annual figure, instead of as a
         monthly breach on every payment. --- */
  for(const o of st.over){
    const left=(isCurrentMonth? daysInMonth-now.getDate(): 0);
    const cad=detectCadence(o.cat);
    const annual=tw.byCatTotals[o.cat]||0;
    /* a cost billed a handful of times a year is not a monthly overspend */
    if(cad && annual>o.bud*12*0.85){
      out.push({ key:'cadence:'+o.cat, sev:'info', view:'budgets', icon:'🎯',
        title:catName(o.cat)+' is not billed monthly',
        detail:`${fmt0(o.act)} landed this month against a ${fmt0(o.bud)}/mo budget, but your ledger shows it is billed `
          +`${cad.adverb} (${cad.activeMonths} payment months). Trailing-12 spend is ${fmt0(annual)}, i.e. ${fmt0(annual/12)}/mo — `
          +`setting the monthly budget near that stops it flagging every time it is billed.` });
      continue;
    }
    out.push({ key:'budget:'+o.cat, sev:'warn', view:'budgets', icon:'🎯',
      title:catName(o.cat)+' is over budget',
      detail:`${fmt0(o.act)} spent against a ${fmt0(o.bud)} budget — ${fmt0(o.by)} over in ${MONTHS[mk.m]} ${mk.y}`
        + (left>0? `, with ${left} day${left===1?'':'s'} still to go` : '')+'.' });
  }

  /* --- data gaps: a month with nothing recorded drags the averages down.
         Only months since the first entry count — nothing existed before then. --- */
  const firstDate=state.tx.reduce((a,x)=>a&&a<x.date?a:x.date,null);
  const empty=[];
  for(const {y,m} of tw.ms){
    if(!txForMonth(y,m).length && firstDate && iso(new Date(y,m,1))>=firstDate) empty.push(MONTHS[m]+' '+y);
  }
  if(empty.length){
    out.push({ key:'gap:months', sev: empty.length>=2?'warn':'info', view:'grid', icon:'🗓️',
      title: empty.length===1? 'One month has no entries' : empty.length+' months have no entries',
      detail: empty.slice(0,4).join(', ')+(empty.length>4? ' +'+(empty.length-4)+' more' : '')
        +` — since your records begin (${firstDate}), so the averages rest on ${tw.withData} months.` });
  }

  /* --- recurring income streams that stopped posting --- */
  const cutoff=new Date(now.getFullYear(), now.getMonth()-2, 1);
  for(const s of state.streams){
    const posts=streamPostings(s);
    const last=posts.reduce((a,x)=> a&&a>x.date? a : x.date, null);
    if(!last || last < iso(cutoff)){
      out.push({ key:'stream:'+s.id, sev:(+s.monthly||0)>0?'warn':'info', view:'income', icon:'🔁',
        title:'Income stream “'+s.label+'” has no recent entries',
        detail: (last? 'Last posted '+last+'. ' : 'Never posted to the ledger. ')
          +'Planned at '+fmt0(+s.monthly||0)+'/mo — use “Post this month” on the Income Map.' });
    }
  }

  /* --- projects: over budget, or finished but not yet archived --- */
  for(const p of (state.projects||[])){
    if(p.archived) continue;
    const f=projectFunding(p);
    if(f.budget>0 && f.remaining<0 && p.status!=='cancelled'){
      out.push({ key:'projover:'+p.id, sev:'warn', view:'projects', icon:projectTypeEmoji(p.type),
        title:'“'+p.name+'” is over its project budget',
        detail:'Spent '+fmt0(f.actual)+' of '+fmt0(f.budget)+' — '+fmt0(-f.remaining)+' over. Raise the budget or re-scope the line items.' });
    }
    if(p.status==='completed'){
      out.push({ key:'projdone:'+p.id, sev:'info', view:'projects', icon:'✅',
        title:'“'+p.name+'” is marked completed',
        detail:'Spend '+fmt0(f.actual)+' vs budget '+fmt0(f.budget)+'. Archive it to clear the working list and keep a permanent summary.' });
    }
  }

  /* --- cashflow direction for the selected month --- */
  if(st.inc>0 && st.exp>st.inc){
    out.push({ key:'cashflow:'+mk.y+'-'+mk.m, sev:'warn', view:'plan', icon:'📉',
      title:MONTHS[mk.m]+' '+mk.y+' spent more than it earned',
      detail:'Outflows '+fmt0(st.exp)+' against inflows '+fmt0(st.inc)+' — a deficit of '+fmt0(st.exp-st.inc)+'. Plan & Advice ranks the fixes.' });
  }
  if(st.exp>0 && st.inc===0){
    out.push({ key:'noincome:'+mk.y+'-'+mk.m, sev:'info', view:'ledger', icon:'🔍',
      title:'No income recorded for '+MONTHS[mk.m]+' '+mk.y,
      detail:'Expenses of '+fmt0(st.exp)+' were recorded with no matching income — check whether payday entries are missing.' });
  }

  return out.sort((a,b)=> SEV_RANK[a.sev]-SEV_RANK[b.sev] );
}
/* alerts the user has not muted this session, plus the per-tab badge count */
function visibleAlerts(){ const d=UI.alertsDismissed||{}; return alertsFor().filter(a=>!d[a.key]) }
function alertCountFor(view){ return visibleAlerts().filter(a=>a.view===view).length }
function dismissAlert(key){ UI.alertsDismissed=UI.alertsDismissed||{}; UI.alertsDismissed[key]=1; renderAll() }
function restoreAlerts(){ UI.alertsDismissed={}; renderAll(); toast('Muted alerts restored') }

/* ================================================================
   DATA HEALTH  (IMPROVEMENT 11)
   A compact integrity score for the numbers the rest of the app
   derives. Trailing-12 averages, guideline budgets and the income
   map are only as trustworthy as the coverage behind them.
   ================================================================ */
function dataHealth(){
  const t=t12();
  const monthsChecked=t.ms.length;
  const withData=t.ms.filter(({y,m})=>txForMonth(y,m).length);
  const missing=[], emptyBoth=[];
  for(const {y,m} of t.ms){
    const imp=txForMonth(y,m);
    if(!imp.length){ missing.push({y,m,label:MONTHS[m]+' '+y}); continue }
    if(!imp.some(x=>x.cat==='income')) emptyBoth.push({y,m,label:MONTHS[m]+' '+y, kind:'no income'});
    else if(!imp.some(x=>x.cat!=='income')) emptyBoth.push({y,m,label:MONTHS[m]+' '+y, kind:'no expenses'});
  }
  const windowKeys=new Set(t.ms.map(x=>x.y+'-'+x.m));
  const streams=state.streams.map(s=>{
    const posts=streamPostings(s);
    const inWindow=posts.filter(x=>{ const p=txYM(x); return windowKeys.has(p.y+'-'+p.m) });
    const last=inWindow.reduce((a,x)=> a&&a>x.date? a : x.date, null);
    const posted12=inWindow.length;
    return { label:s.label, monthly:+s.monthly||0, last, posted12, ok: posted12>0 };
  }).sort((a,b)=> (a.ok?1:0)-(b.ok?1:0));

  const income=state.tx.filter(x=>x.cat==='income').length, expense=state.tx.length-income;
  const unclassified=state.tx.filter(x=>x.cat==='other').length;
  const linked=state.tx.filter(x=>x.projectId).length;
  const attributed=state.tx.filter(x=>x.memberId).length;
  const budgeted=EXPENSE_CATS.filter(c=>+state.budgets[c.id]>0).length;

  const checks=[
    { id:'coverage', ok: missing.length===0, sev: missing.length>=3?'warn':'info', label:'Month-by-month coverage',
      detail: missing.length? missing.length+' of the last '+monthsChecked+' months have no entries ('+missing.slice(0,3).map(x=>x.label).join(', ')+(missing.length>3?'…':'')+').'
        : 'All '+monthsChecked+' months in the trailing-12 window have entries.' },
    { id:'direction', ok: emptyBoth.length===0, sev:'warn', label:'Every month has both income and expenses',
      detail: emptyBoth.length? emptyBoth.slice(0,3).map(x=>x.label+' has '+x.kind).join('; ')+(emptyBoth.length>3?'…':'')+'.'
        : 'No month is missing one side of the ledger.' },
    { id:'streams', ok: streams.length>0 && streams.every(s=>s.ok), sev:'info', label:'Recurring income streams are posting',
      detail: !streams.length? 'No income streams defined — the Income Map has no baseline to plan against.'
        : streams.filter(s=>!s.ok).length? streams.filter(s=>!s.ok).map(s=>'“'+s.label+'”'+(s.last?' last posted '+s.last:' never posted')).join('; ')+'.'
        : 'All '+streams.length+' streams have posted inside the window.' },
    { id:'classification', ok: unclassified===0, sev:'info', label:'No unclassified spending',
      detail: unclassified? unclassified+' entr'+(unclassified===1?'y is':'ies are')+' filed under “Other / unclassified”, worth '+fmt0(state.tx.filter(x=>x.cat==='other').reduce((a,x)=>a+x.amt,0))+'.'
        : 'Every entry has a real category.' },
    { id:'budgets', ok: budgeted>=8, sev:'info', label:'Budget coverage',
      detail: budgeted? budgeted+' of '+EXPENSE_CATS.length+' expense categories have a monthly budget.'
        : 'No monthly budgets set — Budgets ▸ Apply guideline budgets creates a starting set.' },
    { id:'attribution', ok: (state.household.members.length<2)||attributed>0, sev:'info', label:'Household attribution in use',
      detail: state.household.members.length<2? 'Single-contributor household — attribution is optional.'
        : attributed? attributed+' entr'+(attributed===1?'y is':'ies are')+' attributed to a member; '+linked+' linked to a project.'
        : state.household.members.length+' members defined but no expense is attributed to any of them.' }
  ];
  const score=checks.filter(c=>c.ok).length;
  return { checks, score, total:checks.length, pct: Math.round(score/checks.length*100),
    monthsChecked, monthsWithData:withData.length, missing, emptyBoth, streams,
    counts:{ income, expense, unclassified, linked, attributed, budgeted, projects:(state.projects||[]).length,
      archived:(state.projects||[]).filter(p=>p.archived).length, members:state.household.members.length } };
}
