const fs=require('fs');
const {JSDOM, VirtualConsole}=require('jsdom');
const html=fs.readFileSync(process.argv[2]||'web/lifeledger.html','utf8');
const errors=[];
const vc=new VirtualConsole();
vc.on('jsdomError', e=>{ if(!/Not implemented/i.test(e.message)) errors.push('jsdomError: '+e.message) });
vc.on('error', (...a)=>errors.push('console.error: '+a.join(' ')));
const dom=new JSDOM(html,{runScripts:'dangerously', url:'https://localhost/', virtualConsole:vc, pretendToBeVisual:true});
const w=dom.window, d=w.document;
let fails=0;
function assert(name, cond){ console.log((cond?'PASS':'FAIL')+' - '+name); if(!cond) fails++; }
setTimeout(()=>{
try{
  assert('boot rendered dashboard KPIs', d.querySelectorAll('#v-dash .kpi').length>=4);
  assert('sample data loaded', w.LL.state.tx.length>150);
  assert('dashboard donut svg', !!d.querySelector('#v-dash svg'));
  for(const v of ['ledger','grid','budgets','income','plan','ingest','dash']){
    w.showView(v);
    const el=d.getElementById('v-'+v);
    assert('view "'+v+'" renders', el && el.innerHTML.length>500);
  }
  // manual entry through the ingest form
  d.getElementById('manDate').value='2026-10-02';
  d.getElementById('manAmt').value='123.45';
  d.getElementById('manCat').value='dining';
  d.getElementById('manSub').value='Test Cafe';
  d.getElementById('manDesc').value='smoke test';
  const before=w.LL.state.tx.length;
  w.saveEntry('man');
  assert('manual entry added', w.LL.state.tx.length===before+1 && w.LL.state.tx.some(t=>t.sub==='Test Cafe'&&t.amt===123.45));
  // email parser
  const c=w.parseText('From: billing@massystores.com\nSubject: Order confirmation\nDate: 12/03/2026\nThank you for shopping with Massy Stores.\nYour order total: TT$ 486.20\nBalance due: 486.20','email');
  assert('parser detects the total amount', c.length>0 && c.some(x=>x.amount===486.20));
  assert('parser classifies as groceries', c.length>0 && c[0].cat==='groceries');
  assert('parser extracts d/m/yyyy date', c.length>0 && c[0].date==='2026-03-12');
  // candidate import flow
  w.LL.UI.candidates=c; w.renderIngest();
  d.getElementById('ck0').checked=true;
  const b2=w.LL.state.tx.length;
  w.importCandidates();
  assert('parsed candidates imported', w.LL.state.tx.length>b2 && w.LL.state.tx.some(t=>t.src==='email'));
  // tax engine (TT defaults: 90k allowance, 25% PAYE, 6.3% deductions)
  const net=w.netFromGross(120000);
  assert('net-from-gross TT math (120k -> ~106.7k)', net>105500 && net<108000);
  assert('gross-for-net inversion round-trips', Math.abs(w.netFromGross(w.grossForNet(100000))-100000)<0.01);
  const im=w.incomeMapNumbers();
  assert('income map: gross > net need', im.grossWithSavings>im.needWithSavings*0.99 && im.grossWithSavings>90000);
  assert('income map: current lifestyle computed', im.lifestyleM>8000 && im.lifestyleM<16000);
  // budgets & overages
  w.setBudget('dining', 100);
  assert('budget setter works', w.LL.state.budgets.dining===100);
  const st=w.monthStats(im.t.ms[im.t.ms.length-1].y, im.t.ms[im.t.ms.length-1].m);
  assert('monthStats computes overages list', Array.isArray(st.over) && st.over.length>0);
  // grid
  w.showView('grid');
  assert('grid spreadsheet rows', d.querySelectorAll('#v-grid table.sheet tbody tr').length>10);
  assert('grid has 12 month columns', d.querySelectorAll('#v-grid table.sheet thead th').length===18);
  // csv + tax parse helpers
  assert('csvOf builds rows', w.csvOf(w.LL.state.tx.slice(0,5)).trim().split('\n').length===6);
  assert('parseAmt handles currency strings', w.parseAmt('TT$ 1,234.50')===1234.5 && w.parseAmt('(45.00)')===-45);
  assert('extractDate handles "5 Sep 2026"', w.extractDate('paid on 5 Sep 2026')==='2026-09-05');
  // CSV import path
  const res=w.parseCSVText('date,description,category,vendor,amount\n2026-02-01,Monthly plan,,Netflix,54.99\n2026-02-02,Fuel top-up,,Unipet,180.00\n');
  assert('CSV parser maps rows', res.cands && res.cands.length===2 && res.cands[0].cat==='subscriptions' && res.cands[1].cat==='auto');
  // plan view computes both playbooks
  w.showView('plan');
  assert('plan shows surplus/deficit chip', /chip (green|red)/.test(d.getElementById('v-plan').innerHTML));
  assert('plan investment chart svg', d.querySelectorAll('#v-plan svg').length>=1);
  // income map view
  w.showView('income');
  assert('income map ladder rows', d.querySelectorAll('#v-income table.ladder tbody tr').length>=4);
  // delete flow (two-step)
  const someId=w.LL.state.tx[w.LL.state.tx.length-1].id;
  const fakeBtn={dataset:{}, textContent:'', classList:{add(){},remove(){}}, isConnected:true};
  w.delTx(someId, fakeBtn);
  assert('two-step delete arms first', w.LL.state.tx.some(t=>t.id===someId));
  w.delTx(someId, fakeBtn);
  assert('two-step delete removes on confirm', !w.LL.state.tx.some(t=>t.id===someId));
  assert('no runtime errors during whole run', errors.length===0);
  if(errors.length) console.log('\nERRORS:\n'+errors.join('\n---\n').slice(0,3000));
}catch(e){ console.log('TEST CRASH:', e.stack); fails++; }
console.log(fails? '\n'+fails+' FAILURES' : '\nALL TESTS PASSED');
process.exit(fails?1:0);
},400);
