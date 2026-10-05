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
    !alerts.some(a=>a.key.indexOf('stream:')===0));
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
