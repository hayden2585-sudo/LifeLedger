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
/* the heart of the Income Map */
function incomeMapNumbers(){
  const t=t12();
  const streamsMonthly=state.streams.reduce((a,s)=>a+(+s.monthly||0),0);
  const netMonthly = t.incAvg>0? t.incAvg : streamsMonthly;
  const lifestyleM = t.expAvg;                       /* all recorded outflows incl. savings allocations */
  const savingsAllocM = t.byCatAvg.savings||0;
  const coreLifestyleM = lifestyleM - savingsAllocM;
  const savingsGoalM = netMonthly*state.settings.savingsTargetPct/100;
  const S=state.settings;
  const needLifestyle = lifestyleM*12;               /* keep current lifestyle exactly */
  const needWithSavings = (lifestyleM+savingsGoalM)*12;
  const needComfort = needWithSavings*1.10;
  const netAnnual=netMonthly*12;
  return { t, netMonthly, streamsMonthly, lifestyleM, coreLifestyleM, savingsAllocM, savingsGoalM,
    needLifestyle, needWithSavings, needComfort, netAnnual,
    grossCurrent: grossForNet(Math.max(1,netAnnual)),
    grossLifestyle: grossForNet(Math.max(1,needLifestyle)),
    grossWithSavings: grossForNet(Math.max(1,needWithSavings)),
    grossComfort: grossForNet(Math.max(1,needComfort)),
    gapMonthly: netMonthly-lifestyleM };
}

