const fs=require('fs');
const {JSDOM, VirtualConsole}=require('jsdom');
const html=fs.readFileSync(process.argv[2]||'web/lifeledger.html','utf8');
const errors=[];
const vc=new VirtualConsole();
vc.on('jsdomError', e=>{ if(!/Not implemented/i.test(e.message)) errors.push(e.message) });
const dom=new JSDOM(html,{runScripts:'dangerously', url:'https://localhost/', virtualConsole:vc, pretendToBeVisual:true});
const w=dom.window, d=w.document;
let fails=0;
const assert=(n,c)=>{ console.log((c?'PASS':'FAIL')+' - '+n); if(!c) fails++ };
setTimeout(()=>{ try{
  // sample economics sanity
  const im=w.incomeMapNumbers();
  console.log('   demo: net/mo', im.netMonthly.toFixed(0), '| lifestyle/mo', im.lifestyleM.toFixed(0), '| gap/mo', im.gapMonthly.toFixed(0));
  assert('demo has realistic gap between -500 and +4000', im.gapMonthly>-500 && im.gapMonthly<4000);
  assert('gross comfort above gross current', im.grossComfort>im.grossCurrent);
  // empty state flow
  w.LL.state.meta.sample=true;
  const btn={dataset:{},textContent:'',classList:{add(){},remove(){}}};
  w.clearSample(btn); w.clearSample(btn);
  assert('clearSample empties data', w.LL.state.tx.length===0 && w.LL.state.streams.length===0);
  for(const v of ['dash','ledger','grid','budgets','income','plan','ingest']){
    w.showView(v);
    assert('empty-state view "'+v+'" renders', d.getElementById('v-'+v).innerHTML.length>300);
  }
  assert('empty dashboard shows onboarding', /Welcome to LifeLedger/.test(d.getElementById('v-dash').innerHTML));
  // streams + posting income
  w.showView('income');
  d.getElementById('streamLabel').value='Salary (net)';
  d.getElementById('streamAmt').value='12000';
  w.addStream();
  assert('stream added', w.LL.state.streams.length===1);
  w.postStreams();
  assert('stream posted to ledger as income', w.LL.state.tx.some(t=>t.cat==='income'&&t.amt===12000));
  w.postStreams();
  assert('posting twice does not duplicate', w.LL.state.tx.filter(t=>t.cat==='income').length===1);
  // guideline budgets from income
  w.applyGuidelineBudgets();
  assert('guideline budgets applied', Object.keys(w.LL.state.budgets).length>=10 && w.LL.state.budgets.groceries>0);
  // manual expense entry on empty state then grid
  d.getElementById('ledDate').value='2026-10-01';
  d.getElementById('ledAmt').value='75.00';
  d.getElementById('ledCat').value='dining';
  w.saveEntry('led');
  w.showView('grid');
  assert('grid shows the new entry', /75/.test(d.getElementById('v-grid').innerHTML));
  assert('no runtime errors in empty-state flows', errors.length===0);
  if(errors.length) console.log('ERRORS:\n'+errors.join('\n'));
}catch(e){ console.log('CRASH:',e.stack); fails++ }
console.log(fails? '\n'+fails+' FAILURES':'\nALL PASSED'); process.exit(fails?1:0);
},400);
