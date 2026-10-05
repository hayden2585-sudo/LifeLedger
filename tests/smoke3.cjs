const fs=require('fs');
const {JSDOM, VirtualConsole}=require('jsdom');
const html=fs.readFileSync(process.argv[2]||'web/lifeledger.html','utf8');
function makeDom(beforeParse){
  const errors=[];
  const vc=new VirtualConsole();
  vc.on('jsdomError', e=>{ if(!/Not implemented/i.test(e.message)) errors.push(e.message) });
  const dom=new JSDOM(html,{runScripts:'dangerously', url:'https://localhost/', virtualConsole:vc, pretendToBeVisual:true, beforeParse});
  dom.errors=errors; return dom;
}
let fails=0;
const assert=(n,c)=>{ console.log((c?'PASS':'FAIL')+' - '+n); if(!c) fails++ };
setTimeout(()=>{ try{
  const dom=makeDom(); const w=dom.window, d=w.document;
  // 1) new expense groups present, zero by default
  assert('events category in occasions group', w.eval("CAT.events.grp")==='occasions');
  assert('charity category in occasions group', w.eval("CAT.charity.grp")==='occasions');
  assert('sample data leaves events & charity at zero', w.LL.state.tx.every(t=>t.cat!=='events'&&t.cat!=='charity'));
  assert('no default budgets for events/charity', !w.LL.state.budgets.events && !w.LL.state.budgets.charity);
  assert('guideline auto-budgets skip them (guide=null)', w.eval("CAT.events.guide===null && CAT.charity.guide===null"));
  // 2) classifier
  const c1=w.parseText('Carnival costume deposit TT$ 950.00','invoice');
  assert('carnival text → events', c1.length>0 && c1[0].cat==='events' && c1[0].amount===950);
  const c2=w.parseText('Monthly tithe to my church TT$ 500.00','email');
  assert('tithe text → charity', c2.length>0 && c2[0].cat==='charity');
  // 3) income taxonomy: regular + less-frequent inflows stay distinct
  const incomeCases=[
    ['salary','Monthly salary TT$ 12000.00'],
    ['side_hustle','Freelance consulting fee TT$ 900.00'],
    ['salary_arrears','Salary arrears / back pay TT$ 3500.00'],
    ['overtime_extra','Overtime and extra duties TT$ 1250.00'],
    ['dividends','Dividend payment TT$ 800.00'],
    ['asset_sale','Sale of asset proceeds TT$ 15000.00'],
    ['gratuity','Gratuity payment TT$ 6000.00'],
    ['welfare','Employee welfare benefit TT$ 500.00'],
    ['rent','Rental income received from tenant TT$ 2400.00'],
    ['gift_remittance','Gift / remittance money sent from abroad TT$ 3000.00']
  ];
  let incomePass=true;
  for(const [type,text] of incomeCases){ const c=w.parseText(text,'email'); incomePass=incomePass&&c.length>0&&c[0].cat==='income'&&c[0].incomeType===type; }
  assert('income parser recognizes salary through gifts/remittances', incomePass);
  assert('income taxonomy contains all requested less-frequent types', ['salary_arrears','overtime_extra','dividends','asset_sale','gratuity','welfare','rent','gift_remittance'].every(x=>!!w.eval(`INCOME_TYPE.${x}`)));
  // 3) grid & budgets expose the new group
  w.showView('grid');
  assert('grid shows occasions section', /SPECIAL EVENTS, RELIGION & CHARITY/.test(d.getElementById('v-grid').textContent));
  w.showView('budgets');
  assert('budgets show occasions section', /Special events, religion & charity/.test(d.getElementById('v-budgets').textContent));
  w.setBudget('events', 300);
  assert('events budget settable by user', w.LL.state.budgets.events===300);
  // 4) entry flow into new category
  d.getElementById('ledDate').value='2026-10-03';
  d.getElementById('ledAmt').value='250';
  d.getElementById('ledCat').value='charity';
  w.saveEntry('led');
  assert('charity entry saves', w.LL.state.tx.some(t=>t.cat==='charity'&&t.amt===250));
  // income entry UI + annual grid subtype visibility
  w.showView('ledger');
  d.getElementById('ledCat').value='income'; w.toggleIncomeType('led');
  d.getElementById('ledIncomeType').value='salary_arrears';
  d.getElementById('ledDate').value='2026-10-04';
  d.getElementById('ledAmt').value='3500';
  d.getElementById('ledSub').value='Employer back pay';
  d.getElementById('ledDesc').value='Salary arrears payment';
  w.saveEntry('led');
  assert('income entry stores subtype', w.LL.state.tx.some(t=>t.cat==='income'&&t.incomeType==='salary_arrears'&&t.amt===3500));
  w.showView('grid');
  assert('annual grid distinguishes income subtype', /Salary \/ wages|Salary arrears \/ back pay/.test(d.getElementById('v-grid').textContent) && /Salary arrears \/ back pay/.test(d.getElementById('v-grid').textContent));
  // 5) household + projects branches
  w.showView('household');
  assert('household branch renders', /Household budget/.test(d.getElementById('v-household').textContent));
  d.getElementById('hhMemberName').value='Partner';
  d.getElementById('hhMemberRole').value='Partner / spouse';
  w.addHouseholdMember();
  assert('household member added', w.LL.state.household.members.some(m=>m.name==='Partner'));
  const partner=w.LL.state.household.members.find(m=>m.name==='Partner');
  const stream=w.LL.state.streams[0];
  w.setStreamMember(stream.id,partner.id);
  assert('income stream assigned to household member', w.LL.state.streams.find(s=>s.id===stream.id).memberId===partner.id);
  w.showView('projects');
  assert('projects branch renders', /Projects & special budgets/.test(d.getElementById('v-projects').textContent));
  d.getElementById('projName').value='Roof replacement';
  d.getElementById('projType').value='home';
  d.getElementById('projBudget').value='10000';
  w.addProject();
  const roof=w.LL.state.projects.find(p=>p.name==='Roof replacement');
  assert('project created with finite budget model', !!roof && roof.baseBudget===10000 && roof.priority==='normal' && roof.status==='planning');
  d.getElementById('pi_name_'+roof.id).value='Roofing materials';
  d.getElementById('pi_budget_'+roof.id).value='6000';
  w.addProjectItem(roof.id);
  assert('project line item added', roof.items.length===1 && roof.items[0].budget===6000);
  w.updateProjectPriority(roof.id,'emergency');
  w.updateProjectField(roof.id,'status','active');
  w.updateProjectFunding(roof.id,'surplusAllocationPct',25);
  assert('emergency is a project priority, not a category', roof.priority==='emergency' && roof.type==='home');
  assert('project lifecycle status is independent of priority', roof.status==='active');
  assert('project funding derives monthly contribution', w.projectFunding(roof).monthly>=0 && w.projectFunding(roof).available>=0);
  w.showView('ledger');
  d.getElementById('ledDate').value='2026-10-05';
  d.getElementById('ledAmt').value='750';
  d.getElementById('ledCat').value='upkeep';
  w.toggleProjectFields('led');
  d.getElementById('ledProject').value=roof.id;
  w.refreshProjectItems('led');
  d.getElementById('ledProjectItem').value=roof.items[0].id;
  d.getElementById('ledSub').value='Roofing supplier';
  d.getElementById('ledDesc').value='Materials deposit';
  w.saveEntry('led');
  const linked=w.LL.state.tx.find(t=>t.projectId===roof.id&&t.projectItemId===roof.items[0].id&&t.amt===750);
  assert('ledger expense links to project and item', !!linked && linked.cat==='upkeep');
  assert('project actuals read linked ledger costs', w.projectActual(roof)===750);
  assert('project item actuals read linked ledger costs', w.projectActual(roof,roof.items[0].id)===750);
  // 6) minimum-wage engine (TT$20.50/hr, 173.33 h/mo, 6.3% deductions, no PAYE below allowance)
  const mw=w.minWageNumbers();
  assert('min-wage gross ≈ 3,553/mo', mw.grossM>3540 && mw.grossM<3570);
  assert('min-wage net ≈ 3,329/mo', mw.netM>3300 && mw.netM<3360);
  assert('pctMinWage(net) ≈ 100%', Math.abs(w.pctMinWage(mw.netM)-100)<1);
  const im=w.incomeMapNumbers();
  assert('demo lifestyle ≈ 2.5–6× min wage', im.lifestyleM/mw.netM>2.5 && im.lifestyleM/mw.netM<6);
  // 6) lens UI across views
  w.showView('income');
  const inc=d.getElementById('v-income').innerHTML;
  assert('minimum-wage lens card renders', /Minimum-wage lens/.test(inc) && /% of min wage/.test(inc));
  w.showView('dash');
  assert('dashboard min-wage KPI renders', /Lifestyle vs minimum wage/.test(d.getElementById('v-dash').innerHTML));
  w.showView('plan');
  assert('plan min-wage reference renders', /minimum-wage/.test(d.getElementById('v-plan').innerHTML));
  // 7) wage edits propagate
  w.setSetting('minWageHourly', 25);
  const mw2=w.minWageNumbers();
  assert('wage change propagates', Math.abs(mw2.grossM-25*173.33)<1 && mw2.netM>mw.netM);
  // 8) itemised statutory deductions: NIS ceiling + 70% NIS deduction before PAYE
  const n300=w.netFromGross(300000), n400=w.netFromGross(400000);
  assert('NIS ceiling modelled (insurable capped at 13,600/mo)', Math.abs((n400-n300)-75000)<1);
  const n120=w.netFromGross(120000);
  assert('itemised net at 120k/yr is ~106.7k', n120>106000 && n120<107500);
  assert('health surcharge is flat (4.80/wk below threshold)', w.netFromGross(4000) < 4000-4.80*52-4000*0.054+1);
  // 9) postStreams: renaming a stream must not create duplicates
  w.LL.state.streams.push({id:'st9',label:'Test stream',monthly:500});
  w.postStreams();
  w.LL.state.streams.find(x=>x.id==='st9').label='Test stream renamed';
  w.postStreams();
  assert('renamed stream does not duplicate', w.LL.state.tx.filter(t=>t.streamId==='st9').length===1);
  // 10) resetAll: two-step confirm, then clean empty state
  const rb={dataset:{},textContent:'',classList:{add(){},remove(){}},isConnected:true};
  w.resetAll(rb);
  assert('resetAll arms first (nothing wiped yet)', w.LL.state.tx.length>0);
  w.resetAll(rb);
  assert('resetAll wipes on confirm', w.LL.state.tx.length===0 && w.LL.state.streams.length===0 &&
    Object.keys(w.LL.state.budgets).length===0 && w.LL.state.meta.sample===false);
  w.showView('dash');
  assert('post-reset onboarding renders', /Welcome to LifeLedger/.test(d.getElementById('v-dash').innerHTML));
  assert('no runtime errors', dom.errors.length===0);
  if(dom.errors.length) console.log(dom.errors.join('\n'));
}catch(e){ console.log('CRASH:',e.stack); fails++ }
},300);

// 8) migration: pre-v1.1 backup (no minWageHourly) seeds localStorage before scripts run
setTimeout(()=>{
  const old={settings:{currency:'TTD',symbol:'TT$',taxAllowance:90000,taxRate:25,payrollDeductionPct:6.3,savingsTargetPct:10,emergencyMonths:4,businessMarginPct:35},
    streams:[], tx:[{id:'x1',date:'2026-01-05',cat:'groceries',sub:'Massy',desc:'test',amt:100,src:'manual',ded:false}], budgets:{}, meta:{created:1,sample:false,init:true}};
  const dom=makeDom(w=>{ w.localStorage.setItem('lifeledger.v1', JSON.stringify(old)) });
  const w=dom.window;
  try{
    const s=w.LL.state;
    let ok = s.settings.minWageHourly===20.50 && s.tx.length===1 && s.tx[0].amt===100 && s.meta.sample===false;
    ok = ok && s.settings.nisPct===5.4 && s.settings.nisCeilingMonthly===13600 && s.settings.healthSurchargeWeekly===8.25;
    ok = ok && s.settings.payrollDeductionPct===0;   /* old combined 6.3% field retired, not double-counted */
    console.log((ok?'PASS':'FAIL')+' - old backup migrates (new setting defaulted, user data kept, sample not injected)');
    if(!ok) fails++;
    if(dom.errors.length){ console.log('ERRORS:',dom.errors.join('\n')); fails++ }
  }catch(e){ console.log('MIGRATION CRASH:',e.stack); fails++ }
  console.log(fails? '\n'+fails+' FAILURES' : '\nALL PASSED (incl. migration)');
  process.exit(fails?1:0);
},900);
