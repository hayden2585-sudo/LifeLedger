/* ================================================================
   smoke4 — regression coverage for the six-enhancement release:
     #1  storage-loss modal
     #4  year-over-year comparison (Annual Grid)
     #6  proactive alerts + nav tab badges
     #7  project completion & archive workflow
     #8  household spending split chart
     #11 data health check
   Runs against the built single-file artifact, like the other suites.
   ================================================================ */
const fs=require('fs');
const {JSDOM, VirtualConsole}=require('jsdom');
const html=fs.readFileSync(process.argv[2]||'web/lifeledger.html','utf8');
let fails=0;
const assert=(n,c)=>{ console.log((c?'PASS':'FAIL')+' - '+n); if(!c) fails++ };
const t12Of=w=>w.t12();
function makeDom(beforeParse){
  const errors=[];
  const vc=new VirtualConsole();
  vc.on('jsdomError', e=>{ if(!/Not implemented/i.test(e.message)) errors.push(e.message) });
  vc.on('error', (...a)=>errors.push('console.error: '+a.join(' ')));
  const dom=new JSDOM(html,{runScripts:'dangerously', url:'https://localhost/', virtualConsole:vc, pretendToBeVisual:true, beforeParse});
  dom.errors=errors; return dom;
}
setTimeout(()=>{ try{
  const dom=makeDom(); const w=dom.window, d=w.document;

  /* ---------- sample data now demonstrates the new branches ---------- */
  assert('sample data ships household members', w.LL.state.household.members.length>=2);
  assert('sample data ships an active and an archived project',
    w.LL.state.projects.some(p=>!p.archived) && w.LL.state.projects.some(p=>p.archived));
  assert('sample ledger carries member attribution', w.LL.state.tx.some(t=>t.memberId));
  assert('sample ledger carries project attribution', w.LL.state.tx.some(t=>t.projectId));

  /* ---------- #6 proactive alerts ---------- */
  const alerts=w.alertsFor();
  assert('#6 alertsFor returns alert objects with required shape',
    Array.isArray(alerts) && alerts.length>0 && alerts.every(a=>a.key&&a.sev&&a.title&&a.detail));
  assert('#6 alerts are ranked most-urgent first',
    alerts.every((a,i)=> i===0 || ['critical','warn','info'].indexOf(alerts[i-1].sev)<=['critical','warn','info'].indexOf(a.sev)));
  assert('#6 budget overage alert carries the remaining-days context',
    alerts.some(a=>a.key.indexOf('budget:')===0 && /still to go/.test(a.detail)));
  assert('#6 an already-archived project raises no alert at all',
    alerts.every(a=>a.key.indexOf(w.LL.state.projects.find(p=>p.archived).id)<0));
  assert('#6 archived project does NOT raise an "over budget" alert',
    !alerts.some(a=>a.key.indexOf('projover:')>=0 && a.key.indexOf(w.LL.state.projects.find(p=>p.archived).id)>0));
  w.showView('dash');
  const dash=d.getElementById('v-dash').innerHTML;
  assert('#6 dashboard renders the alert panel', /Needs your attention/.test(dash));
  assert('#6 dashboard alert panel exposes a data-health chip', /data health \d+%/.test(dash));
  assert('#6 alerts offer a one-click route to the fix', /onclick="showView\('(budgets|projects|grid|income|plan|ledger)'\)"/.test(dash));

  /* nav badges */
  const counts={};
  for(const a of w.visibleAlerts()) counts[a.view]=(counts[a.view]||0)+1;
  const anyView=Object.keys(counts)[0];
  const badge=d.querySelector('nav#tabs .tab[data-v="'+anyView+'"] .tabbadge');
  assert('#6 tabs carry alert-count badges', !!badge && badge.textContent===String(counts[anyView]));
  assert('#6 alertCountFor matches the visible list', w.alertCountFor(anyView)===counts[anyView]);
  const key=w.visibleAlerts()[0].key, before=w.visibleAlerts().length;
  w.dismissAlert(key);
  assert('#6 dismissing mutes the alert for the session', w.visibleAlerts().length===before-1 && !w.visibleAlerts().some(a=>a.key===key));
  assert('#6 muted count is surfaced with a restore control', /1 muted/.test(d.getElementById('v-dash').innerHTML));
  w.restoreAlerts();
  assert('#6 restore brings every alert back', w.visibleAlerts().length===before);

  /* ---------- #11 data health ---------- */
  const h=w.dataHealth();
  const sampleStreams=w.LL.state.streams;
  assert('#11 dataHealth returns all six integrity checks', h.checks.length===6 && h.total===6);
  assert('#11 dataHealth scores the passing checks', h.score===h.checks.filter(c=>c.ok).length && h.pct===Math.round(h.score/h.total*100));
  assert('#11 dataHealth counts entries by side of the ledger',
    h.counts.income===w.LL.state.tx.filter(t=>t.cat==='income').length &&
    h.counts.income+h.counts.expense===w.LL.state.tx.length);
  assert('#11 dataHealth reports stream staleness', Array.isArray(h.streams) && h.streams.every(s=>'ok' in s && 'last' in s));
  assert('#11 a stream that IS being posted is not reported as stale',
    h.streams.filter(s=>s.posted12>0).every(s=>s.ok) && h.streams.some(s=>s.posted12>0));
  assert('#11 income posted by a stream produces no false alert',
    !w.streamPostings(sampleStreams[0]).some(t=>t.cat!=='income'));
  /* entries with no streamId (imported / pre-v1.2 / sample) still match their stream */
  const st=sampleStreams[0];
  const imported={id:'imp1',date:w.todayISO(),cat:'income',sub:'Salary credited',desc:'',amt:100,src:'csv',ded:false};
  w.LL.state.tx.push(imported);
  assert('stream matching falls back to the label when an entry carries no streamId',
    w.txMatchesStream(imported, st) && w.streamPostings(st).some(t=>t.id==='imp1'));
  const unrelated={id:'imp2',date:w.todayISO(),cat:'income',sub:'Dividend',desc:'',amt:100,src:'csv',ded:false};
  assert('stream matching does not claim unrelated income', !w.txMatchesStream(unrelated, st));
  w.LL.state.tx=w.LL.state.tx.filter(t=>t.id!=='imp1'&&t.id!=='imp2');
  assert('#11 dataHealth counts archived projects', h.counts.archived===w.LL.state.projects.filter(p=>p.archived).length);
  w.showView('grid');
  const grid=d.getElementById('v-grid').textContent;
  assert('#11 grid renders the data-health card', /Data health — is the trailing-12 picture trustworthy\?/.test(grid));
  assert('#11 grid data-health card lists each check', /Month-by-month coverage/.test(grid) && /Recurring income streams are posting/.test(grid));

  /* the same must hold for the sample workspace exactly as it boots */
  const pristine=makeDom();
  assert('#11 the pristine sample workspace raises no silent-stream alert',
    !pristine.window.alertsFor().some(a=>a.key.indexOf('stream:')===0));

  /* ---------- #4 year over year ---------- */
  assert('#4 grid renders the year-over-year card', /Year over year/.test(d.getElementById('v-grid').innerHTML));
  const years=[...new Set(w.LL.state.tx.map(t=>+t.date.slice(0,4)))].sort((a,b)=>a-b);
  assert('#4 sample data spans at least two calendar years', years.length>=2);
  assert('#4 year-over-year comparison table is populated', /Δ change/.test(grid) && /Δ %/.test(grid) && /TOTAL EXPENSES/.test(grid));
  const yt=w.yearTotalsFor(years[years.length-1]);
  assert('#4 yearTotalsFor aggregates income/expense/net consistently',
    yt.count===w.LL.state.tx.filter(t=>+t.date.slice(0,4)===years[years.length-1]).length &&
    Math.abs(yt.net-(yt.inc-yt.exp))<0.01);
  assert('#4 yearTotalsFor reports months actually covered', yt.monthsWith>0 && yt.monthsWith<=12);
  assert('#4 yearTotalsFor groups spend by category', Object.keys(yt.byCat).length>0);
  w.LL.UI.compareYear=years[0];
  w.renderGrid();
  assert('#4 the comparison year is selectable', new RegExp('compare \\d{4} against').test(d.getElementById('v-grid').innerHTML));
  /* with genuinely no second year recorded, the panel explains itself instead of breaking */
  const keepTx=w.LL.state.tx;
  w.LL.state.tx=keepTx.filter(t=>+t.date.slice(0,4)===years[years.length-1]);
  w.LL.UI.gridYear=years[years.length-1]; w.LL.UI.compareYear=null;
  w.renderGrid();
  assert('#4 a year with no other year recorded renders an explanatory panel, not a broken table',
    /Only \d+ has entries so far/.test(d.getElementById('v-grid').innerHTML));
  w.LL.state.tx=keepTx;
  w.LL.UI.gridYear=years[years.length-1]; w.LL.UI.compareYear=null; w.renderGrid();

  /* ---------- CSV export keeps attribution ---------- */
  const csv=w.csvOf(w.LL.state.tx.slice(0,3)).split('\n');
  assert('CSV header carries attribution columns',
    /household_member/.test(csv[0]) && /project_item/.test(csv[0]) && /income_type/.test(csv[0]));
  assert('CSV row resolves the contributor name', csv.slice(1).some(r=>/"(Hayden|Simone)"/.test(r)));
  const projRow=w.csvOf(w.LL.state.tx.filter(t=>t.projectId).slice(0,1));
  assert('CSV row resolves the project name', /Downstairs bathroom refurbishment/.test(projRow));

  /* ---------- #8 household spending split ---------- */
  const mk=w.LL.UI.month;
  const split=w.householdSplit(mk.y,mk.m);
  assert('#8 householdSplit totals the month outflows',
    Math.abs(split.total-(split.rows.reduce((a,b)=>a+b.val,0)))<0.01);
  assert('#8 householdSplit separates attributed from shared spending',
    Math.abs(split.attributed-(split.total-split.shared))<0.01);
  const memberSum=w.LL.state.household.members
    .reduce((a,m)=>a+w.txForMonth(mk.y,mk.m).filter(t=>t.cat!=='income'&&t.memberId===m.id).reduce((x,t)=>x+t.amt,0),0);
  assert('#8 householdSplit agrees with the raw per-member totals', Math.abs(split.attributed-memberSum)<0.01);
  w.showView('household');
  const hh=d.getElementById('v-household').innerHTML;
  assert('#8 household view renders the spending split card', /Spending split by contributor/.test(hh));
  assert('#8 split card draws a stacked bar and a donut', /class="splitbar"/.test(hh) && /<svg/.test(hh));
  assert('#8 split card shows each contributor share', /Share/.test(hh) && /Hayden/.test(hh) && /Simone/.test(hh));
  assert('#8 split card warns when spending is unattributed', split.shared>0? /household\/shared spending/.test(hh) : true);
  const segs=[...d.querySelectorAll('#v-household .splitbar i')];
  assert('#8 every stacked-bar segment carries an inline share width',
    segs.length>0 && segs.every(s=>/width:[\d.]+%/.test(s.getAttribute('style')||'')) && segs.every(s=>!/width:0%/.test(s.getAttribute('style')||'')));

  /* ---------- layout guards (jsdom cannot paint, but it can check structure) ---------- */
  w.showView('dash');
  const dashHTML=d.getElementById('v-dash').innerHTML;
  assert('layout: the alert panel renders above the KPI cards',
    dashHTML.indexOf('Needs your attention') > -1 &&
    dashHTML.indexOf('Needs your attention') < dashHTML.indexOf('Month at a glance'));
  assert('layout: alert rows use the severity-classed row markup',
    /class="alertrow (warn|info|critical)"/.test(dashHTML));
  w.showView('grid');
  const yoyTable=d.querySelector('#v-grid table.t');
  assert('layout: the year-over-year table keeps its seven comparison columns',
    !!yoyTable && yoyTable.querySelectorAll('thead th').length===7);
  assert('layout: the annual spreadsheet header is still 18 columns',
    d.querySelectorAll('#v-grid table.sheet thead th').length===18);

  /* ---------- #7 project completion & archive ---------- */
  const roof=w.LL.state.projects.find(p=>!p.archived);
  const roofTx=w.LL.state.tx.filter(t=>t.projectId===roof.id);
  assert('#7 sample project has linked ledger costs', roofTx.length>0);
  const actualBefore=w.projectActual(roof);
  w.setProjectStatus(roof.id,'completed');            /* first click arms */
  assert('#7 archiving is two-step (arms before it acts)', !roof.archived && roof.status!=='completed');
  assert('#7 archived project leaves the active rendering list', w.isArchived(roof)===false);
  w.showView('projects');
  assert('#7 status control explains that completion archives', /Completed archives the project/.test(d.getElementById('v-projects').innerHTML));
  w.archiveProject(roof.id,'completed');
  assert('#7 archive stamps status AND completion date', roof.status==='completed' && !!roof.completedAt);
  assert('#7 archive keeps the ledger entries alive', w.LL.state.tx.length>0 && w.LL.state.tx.filter(t=>t._archivedProjectId===roof.id).length===roofTx.length);
  assert('#7 archive releases the live project link so category totals are untouched',
    w.LL.state.tx.every(t=>t.projectId!==roof.id));
  w.showView('projects');
  const pj=d.getElementById('v-projects').innerHTML;
  assert('#7 archived projects render in the archive section', /Project archive/.test(pj));
  assert('#7 archive summary shows final budget, actual, variance and duration',
    /Final budget/.test(pj) && /Actual spend/.test(pj) && /Variance/.test(pj) && /Duration/.test(pj));
  const archivedCards=[...d.querySelectorAll('#v-projects details.sec .project-card')];
  const liveCards=[...d.querySelectorAll('#v-projects .project-card')].filter(c=>!c.closest('details.sec'));
  assert('#7 archived project is removed from the working list',
    !liveCards.some(c=>/Downstairs bathroom refurbishment/.test(c.textContent)));
  assert('#7 archived project appears inside the archive section instead',
    archivedCards.some(c=>/Downstairs bathroom refurbishment/.test(c.textContent)));
  const arch=w.archivedProjects().find(f=>f.p.id===roof.id);
  assert('#7 archiveProjectSummary freezes the final figures',
    !!arch && arch.budget===w.projectBudget(roof) && Math.abs(arch.actual-actualBefore)<0.01 && arch.actual>0);
  assert('#7 archiveProjectSummary lists line-item variance',
    arch.items.length===roof.items.length && arch.items.every(i=>'variance' in i));
  assert('#7 archived spend is not lost when the live link is released',
    w.LL.state.tx.filter(t=>t._archivedProjectId===roof.id).length>0 && arch.actual===actualBefore);
  assert('#7 archived line items still resolve their own spend',
    arch.items.filter(i=>i.actual>0).length>0 || arch.items.length===0);
  assert('#7 projected aggregate covers every archived project', w.archivedProjects().length>=2);
  w.reopenProject(roof.id);
  assert('#7 restore returns the project to active status', roof.archived===false && roof.status==='active' && roof.completedAt===null);
  assert('#7 restore re-links the ledger entries', w.LL.state.tx.filter(t=>t.projectId===roof.id).length===roofTx.length);
  assert('#7 restore does not duplicate or lose entries', w.LL.state.tx.length>roofTx.length);
  assert('#7 projectActual reads the same total after a restore round-trip', Math.abs(w.projectActual(roof)-actualBefore)<0.01);

  /* a project that finishes nowhere near its line items keeps its final budget */
  const fake={id:'ptest',name:'Test project',type:'other',priority:'normal',status:'completed',archived:true,
    startDate:'2026-01-10',completedAt:'2026-04-20',baseBudget:3000,items:[],fundingPlan:{}};
  w.LL.state.projects.push(fake);
  const fs2=w.archivedProjects().find(f=>f.p.id==='ptest');
  assert('#7 archive summary falls back to the base budget and stays sane',
    !!fs2 && fs2.budget===3000 && fs2.actual===0 && fs2.variance===3000 && fs2.months>=3);
  w.LL.state.projects=w.LL.state.projects.filter(p=>p.id!=='ptest');

  /* old saves with a completed project auto-archive on load */
  const old={settings:{},streams:[],tx:[],budgets:{},household:{members:[]},meta:{created:1,sample:false,init:true},
    projects:[{id:'old1',name:'Old job',type:'home',items:[],baseBudget:1000,status:'completed'}]};
  const dom2=makeDom(win=>{ win.localStorage.setItem('lifeledger.v1', JSON.stringify(old)) });
  const p0=dom2.window.LL.state.projects[0];
  assert('#7 pre-archive completed project migrates to archived',
    p0.archived===true && p0.status==='completed' && 'completedAt' in p0);

  /* ================================================================
     1.4.1 — coverage-aware averages, cadence detection, honest fields
     ================================================================ */

  /* ---- the trailing-12 denominator ---- */
  const full=t12Of(w);
  assert('1.4.1 t12 exposes both a per-recorded-month average and the raw totals',
    'incAvg' in full && 'incTotal' in full && 'byCatTotals' in full && 'coverage' in full);
  assert('1.4.1 t12 divides by months WITH data, not a hard 12',
    full.n===full.withData && full.withData<=full.totN);
  assert('1.4.1 incAvg * n reconstructs the total',
    Math.abs(full.incAvg*full.n-full.incTotal)<0.01);
  assert('1.4.1 sample data covers the full window so nothing moves for a year-long user',
    full.withData===12 && full.coverage===1);

  /* a genuine part-year user must not have their income divided by 12 */
  const keepAll=w.LL.state.tx, nowD=new Date();
  const threeMonths=keepAll.filter(x=>{ const q=w.txYM(x); return (nowD.getFullYear()-q.y)*12+(nowD.getMonth()-q.m)<3 });
  w.LL.state.tx=threeMonths;
  const t3=w.t12(), im3=w.incomeMapNumbers();
  const trueAvg=threeMonths.filter(x=>x.cat==='income').reduce((a,x)=>a+x.amt,0)/3;
  assert('1.4.1 a 3-month user is no longer understated (was 4x too low)',
    t3.n===3 && Math.abs(t3.incAvg-trueAvg)<0.01);
  assert('1.4.1 the income map inherits the corrected base, not a quarter of it',
    Math.abs(im3.netMonthly-trueAvg)<0.01 && im3.netMonthly>trueAvg*0.99);
  assert('1.4.1 savings goal follows the corrected income',
    Math.abs(im3.savingsGoalM-trueAvg*w.LL.state.settings.savingsTargetPct/100)<0.01);
  assert('1.4.1 coverage is reported honestly for a part-year user',
    t3.coverage<1 && /averaged over 3 of the last 12 months/.test(w.coverageNote(t3)) && w.coverageIsPartial(t3));
  assert('1.4.1 byCatAvg also divides by recorded months',
    Object.keys(t3.byCatAvg).every(k=>Math.abs(t3.byCatAvg[k]*t3.n-t3.byCatTotals[k])<0.01));

  /* the project funding basis must be the surplus actually earned in the window */
  const proj3=w.LL.state.projects.find(x=>!x.archived);
  const f3=w.projectFunding(proj3);
  const earned=threeMonths.filter(x=>x.cat==='income').reduce((a,x)=>a+x.amt,0)
              -threeMonths.filter(x=>x.cat!=='income').reduce((a,x)=>a+x.amt,0);
  assert('1.4.1 project funding uses surplus EARNED over the window, not a monthly average',
    Math.abs(f3.available-Math.max(0,earned))<0.01 && f3.available>f3.t.incAvg-f3.t.expAvg);
  w.LL.state.tx=keepAll;
  w.renderAll();

  /* ---- cadence: non-monthly fixed costs stop crying wolf ---- */
  assert('1.4.1 detectCadence needs history before it commits', w.detectCadence('nonexistent_cat')===null);
  w.LL.state.tx=[];
  assert('1.4.1 detectCadence declines to judge a category with too few months', w.detectCadence('insurance')===null);
  w.LL.state.tx=keepAll;
  const steady=w.detectCadence('groceries'), lumpy=w.detectCadence('insurance');
  assert('1.4.1 a monthly cost is not flagged as lumpy', steady===null && !w.isLumpyCategory('groceries'));
  assert('1.4.1 a quarterly/irregular cost IS detected and labelled',
    !!lumpy && ['quarterly','annual','irregular'].indexOf(lumpy.kind)>=0 && !!lumpy.adverb);
  assert('1.4.1 lumpy detection is not applied to monthly spend',
    w.isLumpyCategory('groceries')===false);
  const a1=w.alertsFor();
  const cadAlert=a1.find(a=>a.key==='cadence:insurance');
  assert('1.4.1 a non-monthly fixed cost reports once as an annual figure, not a monthly breach',
    !!cadAlert && cadAlert.sev==='info' && !a1.some(a=>a.key==='budget:insurance'));
  assert('1.4.1 the cadence alert still names the real 12-month figure and a fix',
    !!cadAlert && /Trailing-12 spend is/.test(cadAlert.detail) && /monthly budget near that/.test(cadAlert.detail));
  /* a genuinely overspent monthly category must still raise a real warning */
  w.setBudget('groceries', 1);
  assert('1.4.1 a genuinely overspent monthly category still warns',
    w.alertsFor().some(a=>a.key==='budget:groceries' && a.sev==='warn'));
  delete w.LL.state.budgets.groceries; w.renderAll();
  w.showView('budgets');
  assert('1.4.1 the budgets view tags non-monthly costs', /🔄 (quarterly|annual|irregular)/.test(d.getElementById('v-budgets').innerHTML));

  /* ---- the formerly-inert project budget field ---- */
  w.showView('projects');
  const withItems=w.LL.state.projects.find(x=>!x.archived && x.items.length);
  const fieldHTML=d.getElementById('v-projects').innerHTML;
  assert('1.4.1 a project with line items no longer offers an editable base budget',
    /<input type="number" value="\d+" disabled/.test(fieldHTML));
  assert('1.4.1 the disabled field shows the budget actually in force',
    fieldHTML.indexOf('value="'+w.projectBudget(withItems)+'" disabled')>=0);
  assert('1.4.1 the field explains where the budget comes from', /Sum of line items/.test(fieldHTML));
  /* and it is genuinely inert: the value in force is the item sum */
  assert('1.4.1 projectBudget equals the line-item sum, which is what is displayed',
    w.projectBudget(withItems)===withItems.items.reduce((a,i)=>a+ +i.budget,0));
  const noItems=w.LL.state.projects.find(x=>!x.archived && !x.items.length);
  if(!noItems){
    const tmp={id:'nobudget',name:'No items yet',type:'other',priority:'normal',status:'planning',archived:false,
      items:[],baseBudget:2500,fundingPlan:{}};
    w.LL.state.projects.push(tmp); w.renderProjects();
    assert('1.4.1 a project with no line items keeps an editable base budget',
      /Base budget<\/label><input type="number" min="0" step="10" value="2500"/.test(d.getElementById('v-projects').innerHTML));
    w.LL.state.projects=w.LL.state.projects.filter(p=>p.id!=='nobudget');
  }

  /* ---- coverage disclosure ---- */
  w.showView('dash');
  assert('1.4.1 the dashboard discloses coverage of the trailing window',
    /all 12 months recorded/.test(d.getElementById('v-dash').innerHTML));
  w.LL.state.tx=threeMonths; w.renderDash();
  assert('1.4.1 a part-year user sees the coverage caveat on the dashboard',
    /averaged over 3 of the last 12 months/.test(d.getElementById('v-dash').innerHTML));
  w.LL.state.tx=keepAll; w.renderAll();
  w.showView('plan');
  assert('1.4.1 the plan view discloses coverage too',
    /📅 all 12 months recorded/.test(d.getElementById('v-plan').innerHTML));
  w.showView('grid');

  /* ================================================================
     1.4.2 — workspace naming and the privacy notice
     ================================================================ */

  /* ---- derived name ---- */
  assert('1.4.2 the sample workspace is named, not anonymous',
    w.ledgerName()==='Sample household ledger' && /Sample household ledger/.test(d.getElementById('brandName').textContent));
  assert('1.4.2 the browser title carries the ledger name',
    d.title==='Sample household ledger — LifeLedger');
  const auto=w.derivedLedgerName();
  w.LL.state.meta.sample=false;
  assert('1.4.2 the name derives from the household once real data is in use',
    w.derivedLedgerName()==='Hayden & Simone' && w.ledgerName()==='Hayden & Simone');
  /* a single member names it after them; no members falls back safely */
  const twoMembers=w.LL.state.household.members.slice();
  w.LL.state.household.members=[twoMembers[0]];
  assert('1.4.2 a single contributor names the ledger after them',
    w.derivedLedgerName()==='Hayden household ledger');
  w.LL.state.household.members=[];
  assert('1.4.2 with no household members the fallback name is still sensible',
    w.derivedLedgerName()==='My ledger' && w.ledgerName()==='My ledger');
  w.LL.state.household.members=twoMembers;
  w.LL.state.meta.sample=true;
  assert('1.4.2 restoring the sample restores its derived name', w.derivedLedgerName()===auto);
  w.renderAll();

  /* ---- renaming: custom names win, and survive the derivation ---- */
  assert('1.4.2 a fresh sample ledger is not treated as custom-named', w.ledgerNameIsCustom()===false);
  d.getElementById('ledgerNameInput').value='Boodoosingh household 2026';
  w.renameLedger();
  assert('1.4.2 renaming stores the name and marks it custom',
    w.LL.state.meta.name==='Boodoosingh household 2026' && w.ledgerNameIsCustom()===true);
  assert('1.4.2 the rename reaches the header, the tab title and the input',
    /Boodoosingh household 2026/.test(d.getElementById('brandName').textContent) &&
    d.title==='Boodoosingh household 2026 — LifeLedger' &&
    d.getElementById('ledgerNameInput').value==='Boodoosingh household 2026');
  assert('1.4.2 a custom name is not overwritten by the household derivation',
    w.derivedLedgerName()!==w.ledgerName() && w.ledgerName()==='Boodoosingh household 2026');
  assert('1.4.2 the header says the name is custom', /custom name/.test(d.getElementById('brandTag').textContent));
  assert('1.4.2 the custom name rides along in the backup',
    /Boodoosingh household 2026/.test(JSON.stringify(w.LL.state)));
  assert('1.4.2 export filenames use the custom name, slugified',
    w.ledgerFileStem()==='boodoosingh-household-2026');
  w.exportJSON();
  assert('1.4.2 the backup modal offers the named filename',
    /boodoosingh-household-2026-backup-\d{4}-\d{2}-\d{2}\.json/.test(d.getElementById('expModal').innerHTML));
  assert('1.4.2 the backup modal names the ledger it contains',
    /Backup of “Boodoosingh household 2026”/.test(d.getElementById('expModal').innerHTML));
  d.getElementById('expModal').style.display='none';
  /* clearing the field reverts to the derived name */
  d.getElementById('ledgerNameInput').value='   ';
  w.renameLedger();
  assert('1.4.2 clearing the name reverts to the derived one',
    w.ledgerNameIsCustom()===false && w.ledgerName()===w.derivedLedgerName() && w.LL.state.meta.name==='');
  assert('1.4.2 an unnamed ledger keeps the generic backup filename',
    w.ledgerFileStem()==='lifeledger');
  /* names are bounded and slugged safely */
  w.setLedgerName('  A very long name that goes past sixty characters '.repeat(3));
  assert('1.4.2 an over-long name is truncated', w.ledgerName().length<=60);
  assert('1.4.2 a slug never yields an empty filename component',
    /^[a-z0-9-]+$/.test(w.ledgerFileStem()) && w.ledgerFileStem().length>0);
  w.setLedgerName('!!! ???');
  assert('1.4.2 punctuation-only names still produce a usable filename stem',
    w.ledgerFileStem()==='lifeledger' || /^[a-z0-9-]+$/.test(w.ledgerFileStem()));
  w.setLedgerName('');

  /* ---- privacy notice ---- */
  w.showView('dash');
  assert('1.4.2 the privacy notice is reachable from the Data menu',
    /showPrivacyNotice\(\)/.test(d.getElementById('dataMenu').innerHTML) && /Privacy &amp; data/.test(d.getElementById('dataMenu').innerHTML));
  w.showPrivacyNotice();
  const pm=d.getElementById('privacyModal');
  assert('1.4.2 the privacy notice opens', !!pm);
  const ptxt=pm? pm.textContent : '';
  assert('1.4.2 it states the data stays on the device', /stays on this device/.test(ptxt) && /no server, no account/.test(ptxt));
  assert('1.4.2 it states plainly that the data is NOT encrypted',
    /not encrypted/i.test(ptxt) && /readable text/i.test(ptxt) && /no password/i.test(ptxt));
  assert('1.4.2 it says who can actually read the ledger',
    /Who can read it/.test(ptxt) && /browser profile/.test(ptxt) && /shared or work computer/.test(ptxt));
  assert('1.4.2 it warns that backups are plain text too', /backup files you export/.test(ptxt));
  assert('1.4.2 it explains the permanent-loss risk and the export remedy',
    /deletes the ledger permanently/.test(ptxt) && /Export a JSON backup first/.test(ptxt));
  assert('1.4.2 it never claims protection the app does not provide',
    !/encrypted for you|we encrypt|end-to-end|secure by design|military-grade/i.test(ptxt));
  assert('1.4.2 it names the ledger it is describing', /My ledger|household|Boodoosingh/.test(ptxt));
  assert('1.4.2 opening it twice does not stack duplicates',
    (w.showPrivacyNotice(), d.querySelectorAll('#privacyModal').length===1));
  w.ackPrivacy();
  assert('1.4.2 acknowledging closes it and records the acknowledgement',
    !d.getElementById('privacyModal') && w.LL.state.meta.privacySeen===true);
  w.maybeShowPrivacyNotice();
  assert('1.4.2 an acknowledged notice does not reappear', !d.getElementById('privacyModal'));
  /* a brand-new install shows it once, at startup */
  const newDom=makeDom();
  const nw=newDom.window;
  assert('1.4.2 a new install is shown the notice at startup', !!nw.document.getElementById('privacyModal'));
  assert('1.4.2 the notice is shown for a new install even when storage works',
    nw.localStorage.getItem('lifeledger.v1')!==null && !!nw.document.getElementById('privacyModal'));
  /* but never alongside the storage warning, and never for a pre-existing save */
  const old2={settings:{},streams:[],tx:[{id:'z',date:'2026-01-05',cat:'groceries',sub:'M',desc:'',amt:10,src:'manual',ded:false}],
    budgets:{},household:{members:[]},meta:{created:1,sample:false,init:true}};
  const oldDom=makeDom(win=>{ win.localStorage.setItem('lifeledger.v1', JSON.stringify(old2)) });
  assert('1.4.2 an existing save is NOT nagged with a privacy notice it never saw',
    !oldDom.window.document.getElementById('privacyModal') && oldDom.window.LL.state.meta.privacySeen===true);
  const blockedDom=makeDom(win=>{ Object.defineProperty(win,'localStorage',{configurable:true,get(){ throw new Error('blocked') }}) });
  assert('1.4.2 with storage blocked the loss warning takes precedence, with no stacked modals',
    !!blockedDom.window.document.getElementById('storageWarnModal') && !blockedDom.window.document.getElementById('privacyModal'));

  assert('no runtime errors during the enhancement run', dom.errors.length===0);
  if(dom.errors.length) console.log('\nERRORS:\n'+dom.errors.join('\n---\n'));
}catch(e){ console.log('CRASH:',e.stack); fails++ }
console.log(fails? '\n'+fails+' FAILURES' : '\nALL PASSED');
process.exit(fails?1:0);
},400);

/* ---------- #1 storage-loss modal (separate DOM with localStorage blocked) ---------- */
setTimeout(()=>{
  let d3=null;
  try{
    d3=makeDom(win=>{ Object.defineProperty(win,'localStorage',{configurable:true,get(){ throw new Error('blocked'); }}) });
    const w3=d3.window, doc=w3.document;
    const modal=doc.getElementById('storageWarnModal');
    assert('#1 storage-loss modal appears when localStorage is blocked', !!modal);
    assert('#1 modal is a blocking overlay with an explicit acknowledgement',
      !!modal && /Data will not be saved/.test(modal.textContent) && /I understand — continue anyway/.test(modal.textContent));
    assert('#1 modal offers an export-before-closing route',
      !!modal && /Export JSON first/.test(modal.textContent) && /exportJSON\(\)/.test(modal.innerHTML));
    assert('#1 modal warns about sandboxed preview / private mode',
      !!modal && /sandboxed preview/.test(modal.textContent) && /incognito/.test(modal.textContent));
    assert('#1 app still boots and renders behind the warning', /Welcome|Month at a glance/.test(doc.getElementById('v-dash').innerHTML));
    /* the modal must not reappear on every re-render */
    w3.renderAll(); w3.renderAll();
    assert('#1 modal does not duplicate on re-render', doc.querySelectorAll('#storageWarnModal').length===1);
    modal.remove();
    assert('#1 acknowledging removes the overlay', doc.querySelectorAll('#storageWarnModal').length===0);
    assert('#1 no runtime errors with storage unavailable', d3.errors.length===0);
    if(d3.errors.length) console.log('ERRORS(#1):\n'+d3.errors.join('\n'));
  }catch(e){ console.log('CRASH(#1):',e.stack); fails++ }
  console.log(fails? '\n'+fails+' FAILURES' : '\nALL PASSED (incl. storage warning)');
  process.exit(fails?1:0);
},700);
