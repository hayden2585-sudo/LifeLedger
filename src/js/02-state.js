/* ---------------- state & storage ---------------- */
const LSKEY = 'lifeledger.v1';
const store = {
  ok: (()=>{ try{ localStorage.setItem('__t','1'); localStorage.removeItem('__t'); return true }catch(e){ return false } })(),
  save(){ if(this.ok){ try{ localStorage.setItem(LSKEY, JSON.stringify(state)) }catch(e){} } updateSaveBadge() },
  load(){ if(!this.ok) return null; try{ const s = localStorage.getItem(LSKEY); return s? JSON.parse(s): null }catch(e){ return null } }
};
function freshState(){
  return {
    /* TT statutory defaults (all editable; verify against your payslip):
       - TT$90,000 personal allowance; 25% PAYE on chargeable income up to TT$1M (30% above)
       - Employee NIS: 5.4% of insurable earnings, capped at TT$13,600/month (NIBTT ceiling,
         combined 16.2% effective 5 Jan 2026, scheduled to rise in 2027)
       - Health surcharge: FLAT TT$8.25/week when monthly pay > TT$469.99 (TT$4.80/week below) —
         it is not a percentage
       - 70% of employee NIS is deductible before PAYE is applied            */
    settings:{ currency:'TTD', symbol:'TT$',
      taxAllowance:90000, taxRate:25,
      nisPct:5.4, nisCeilingMonthly:13600, healthSurchargeWeekly:8.25, payrollDeductionPct:0,
      savingsTargetPct:10, emergencyMonths:4, businessMarginPct:35, minWageHourly:20.50 },
    streams:[], recurringExpenses:[], tx:[], budgets:{}, household:{members:[]}, projects:[],
    meta:{ created:Date.now(), sample:false, init:true }
  };
}
/* Bring settings from older saves up to the current schema.
   Pre-1.2 saves bundled NIS + surcharge into payrollDeductionPct (default 6.3);
   when we detect that, clear it so deductions aren't double-counted. */
function migrateSettings(s){
  if(!s || typeof s!=='object') return freshState().settings;
  const base=freshState().settings;
  const isOld=s.nisPct===undefined;
  for(const k in base){ if(s[k]===undefined) s[k]=base[k] }
  if(isOld && +s.payrollDeductionPct===6.3) s.payrollDeductionPct=0;
  return s;
}
function migrateWorkspace(s){
  if(!s||typeof s!=='object') return s;
  if(!Array.isArray(s.household?.members)) s.household={members:[]};
  if(!Array.isArray(s.projects)) s.projects=[];
  if(!Array.isArray(s.recurringExpenses)) s.recurringExpenses=[];
  for(const p of s.projects){
    if(!p.items||!Array.isArray(p.items)) p.items=[];
    if(!p.type) p.type='home';
    if(!p.priority) p.priority='normal';
    if(!p.status) p.status='planning';
    /* projects finished before the archive workflow existed are archived on load,
       so a completed project never keeps cluttering the working list */
    if(p.archived===undefined) p.archived = (p.status==='completed');
    if(p.completedAt===undefined) p.completedAt = p.archived? (p.targetDate||p.startDate||null) : null;
    if(!p.fundingPlan) p.fundingPlan={enabled:false,startingReserve:0,oneTimeContribution:0,surplusAllocationPct:0,fixedMonthlyContribution:0};
  }
  return s;
}
function migrateIncomeTypes(s){
  if(!s || typeof s!=='object') return s;
  if(!Array.isArray(s.streams)) s.streams=[];
  if(!Array.isArray(s.tx)) s.tx=[];
  for(const stream of s.streams){
    if(!stream.incomeType) stream.incomeType=guessIncomeType(stream.label);
    if(!INCOME_TYPE[stream.incomeType]) stream.incomeType='other_income';
  }
  for(const t of s.tx){
    if(t.cat==='income'){
      if(!t.incomeType) t.incomeType=guessIncomeType((t.sub||'')+' '+(t.desc||''));
      if(!INCOME_TYPE[t.incomeType]) t.incomeType='other_income';
    }
  }
  return s;
}
let state = null;
let UI = { view:'dash', month:null, year:null, gridYear:null, ledgerFilter:{cat:'all',src:'all',q:'',month:'all'}, editingId:null,
  candidates:[], ocrFile:null, ocrURL:null, stressPct:0, cuts:{}, invReturn:7, invYears:10, invContrib:null, showT12:true,
  incomeMapBase:'t12' /* 't12' | 'streams' */, alertsDismissed:{}, compareYear:null };

/* ---------------- small utils ---------------- */
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const round2 = n => Math.round(n*100)/100;
const SYM = () => (state && state.settings.symbol) || 'TT$';
function fmt(n, dec){ if(n===undefined||n===null||isNaN(n)) return '—';
  dec = (dec===undefined)?2:dec;
  const neg = n < -0.004; const v = Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec});
  return (neg?'−':'') + SYM() + v; }
function fmt0(n){ return fmt(n,0) }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) }
function iso(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }
function todayISO(){ return iso(new Date()) }
function parseAmt(s){ if(typeof s==='number') return s; if(!s) return 0;
  s = String(s).replace(/[−–]/g,'-').replace(/[^\d.\-()]/g,''); let neg = /\(.*\)/.test(s) || s.trim().startsWith('-');
  s = s.replace(/[()\-]/g,''); const v = parseFloat(s); return isNaN(v)? 0 : (neg? -v : v); }
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toast._h); toast._h=setTimeout(()=>t.classList.remove('show'),2600) }
function catIcon(id){ return (CAT[id]||{}).icon || '🏷️' }
function catName(id){ return (CAT[id]||{}).name || id }

/* date of tx -> {y,m} */
function txYM(t){ const p=t.date.split('-'); return {y:+p[0], m:+p[1]-1} }
function txForMonth(y,m){ return state.tx.filter(t=>{ const p=txYM(t); return p.y===y && p.m===m }) }
function txForYear(y){ return state.tx.filter(t=> txYM(t).y===y ) }
function sumT(ts){ return round2(ts.reduce((a,t)=>a+t.amt,0)) }

/* aggregate a tx list */
function agg(ts){
  let inc=0, exp=0; const byCat={};
  for(const t of ts){ if(t.cat==='income'){ inc+=t.amt } else { exp+=t.amt; byCat[t.cat]=(byCat[t.cat]||0)+t.amt } }
  return {inc:round2(inc), exp:round2(exp), byCat};
}
/* last n calendar months incl current -> [{y,m}] oldest first */
function trailingMonths(n){ const out=[], now=new Date();
  for(let i=n-1;i>=0;i--){ const d=new Date(now.getFullYear(), now.getMonth()-i, 1); out.push({y:d.getFullYear(), m:d.getMonth()}) } return out }
/* Trailing-12 aggregates.
   IMPORTANT — the trailing window is always the last 12 calendar months, but an
   "average" only means something if it is divided by the months that actually
   contributed data. Dividing by a hard 12 understates every headline figure for
   anyone whose records cover less than a year: with three months recorded, the
   app reported a quarter of the real monthly income, and every guideline budget,
   the income-map ladder and the minimum-wage comparison inherited that error.
   So:
     incAvg/expAvg/byCatAvg/n  → average per month WITH DATA ("n" is that count)
     incTotal/expTotal, totN   → the raw 12-month totals and the full window size
     coverage                  → how much of the window is actually populated
   Views that need an annual figure use incTotal/expTotal; views that show a
   representative monthly figure use incAvg/expAvg. */
function t12(){
  const ms = trailingMonths(12); let inc=0, exp=0; const byCat={};
  let withData=0;
  for(const {y,m} of ms){ const k=txForMonth(y,m);
    if(k.length) withData++;
    const a=agg(k); inc+=a.inc; exp+=a.exp;
    for(const c in a.byCat) byCat[c]=(byCat[c]||0)+a.byCat[c] }
  const totN=ms.length;
  const n=withData||1;                    /* never divide by zero */
  const byCatAvg={}, byCatTotals={}; for(const k in byCat){ byCatAvg[k]=byCat[k]/n; byCatTotals[k]=byCat[k] }
  return { ms, n, withData, totN, coverage:withData/totN,
    /* is this a full trailing-12 picture, or a part-year one? coveredMonths is the
       inclusive span the user's records occupy, used to explain gaps honestly. */
    coveredMonths: (()=>{ const f=state.tx.reduce((a,x)=>a&&a<x.date?a:x.date,null);
      if(!f) return 0;
      const now=new Date(), s=new Date(f+'T00:00:00');
      return (now.getFullYear()-s.getFullYear())*12 + (now.getMonth()-s.getMonth()) + 1 })(),
    incAvg:inc/n, expAvg:exp/n, byCatAvg, incTotal:inc, expTotal:exp, byCatTotals,
    avgBasis: withData? 'recorded months' : 'no data' };
}
function latestMonthWithTx(){ let best=null; for(const t of state.tx){ const p=txYM(t);
    if(!best || p.y>best.y || (p.y===best.y && p.m>best.m)) best=p } return best }
function monthOptions(sel){ let h=''; const seen={};
  for(const t of [...state.tx].sort((a,b)=>a.date<b.date?1:-1)){ const p=txYM(t); const k=p.y+'-'+p.m;
    if(seen[k]) continue; seen[k]=1; h+=`<option value="${k}" ${sel===k?'selected':''}>${MONTHS[p.m]} ${p.y}</option>` }
  return h }
function yearOptions(sel){ const ys=[...new Set(state.tx.map(t=>txYM(t).y))].sort((a,b)=>b-a);
  if(!ys.length) ys.push(new Date().getFullYear());
  return ys.map(y=>`<option value="${y}" ${y===sel?'selected':''}>${y}</option>`).join('') }

/* ----------------------------------------------------------------
   Coverage helpers — a trailing-12 figure is only as good as how much
   of the window is actually populated. These keep that visible.
---------------------------------------------------------------- */
function coverageIsPartial(t){ t=t||t12(); return t.withData>0 && t.withData<t.totN }
function coverageNote(t){ t=t||t12();
  if(!t.withData) return 'no data recorded yet';
  if(t.withData>=t.totN) return 'all 12 months recorded';
  return 'averaged over '+t.withData+' of the last 12 months';
}
function coverageChip(t){ t=t||t12();
  const cls = !t.withData? 'grey' : t.withData>=10? 'green' : t.withData>=6? 'amber' : 'red';
  return `<span class="chip ${cls}" title="Trailing-12 averages divide by the months that actually contain entries">📅 ${coverageNote(t)}</span>`;
}

/* ---------------- classification ---------------- */
function guessCat(text){
  const s = ' ' + String(text||'').toLowerCase() + ' ';
  if(guessIncomeType(s)) return 'income';
  for(const [cat, words] of Object.entries(VENDOR_HINTS)){
    for(const w of words){ if(s.includes(w)) return cat }
  }
  for(const [re,cat] of GENERIC_HINTS){ if(re.test(s)) return cat }
  return null;
}
function vendorFromEmail(fromLine){
  const m = String(fromLine).match(/<([^>]+)>/); const addr = m? m[1] : String(fromLine);
  const dom = (addr.split('@')[1]||'').split('.')[0];
  return dom? dom.charAt(0).toUpperCase()+dom.slice(1) : null;
}

/* ----------------------------------------------------------------
   IMPROVEMENT 1 — Storage loss modal
   A prominent, blocking first-load warning when localStorage is
   unavailable, so nobody spends an evening entering data that will
   vanish on close. The old save badge is still there, but nobody
   reads a badge — this one you have to acknowledge.
   Called once from boot(); never shown when storage works.
---------------------------------------------------------------- */
let storageWarned=false;   /* session-scoped: don't nag on every re-render */
function showStorageWarning(){
  if(store.ok || storageWarned) return;
  storageWarned=true;
  const m=document.createElement('div');
  m.id='storageWarnModal';
  m.setAttribute('role','alertdialog');
  m.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.7);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px';
  m.innerHTML=`<div style="background:#fff;border-radius:14px;padding:28px 26px;max-width:480px;box-shadow:0 20px 50px rgba(0,0,0,.3)">
    <div style="font-size:36px;margin-bottom:10px">⚠️</div>
    <h2 style="margin:0 0 10px;color:#c62f2f">Data will not be saved</h2>
    <p style="margin:0 0 14px;font-size:13.5px;line-height:1.6">
      LifeLedger cannot access your browser's local storage in this environment.
      Any entries you make <strong>will be lost</strong> when you close this tab.
    </p>
    <p style="margin:0 0 18px;font-size:13px;color:#67707f;line-height:1.6">
      This usually happens when the file is opened from a sandboxed preview, a restricted browser profile,
      or private/incognito mode. Open the file directly in Chrome, Edge, or Firefox for full storage access.
      Use <strong>Data ▸ Export JSON</strong> before closing to preserve any work you do now.
    </p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button onclick="document.getElementById('storageWarnModal').remove()" style="background:#3450b4;color:#fff;border:0;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">I understand — continue anyway</button>
      <button onclick="exportJSON();document.getElementById('storageWarnModal').remove()" style="background:#fff;color:#3450b4;border:1px solid #c6cfe6;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">Export JSON first</button>
    </div>
  </div>`;
  document.body.appendChild(m);
}
/* ---- nav tab badges: surface alert counts on the tabs themselves ---- */
function refreshAlertBadges(){
  const counts={}; let n=0;
  for(const a of (typeof visibleAlerts==='function'? visibleAlerts(): [])){ counts[a.view]=(counts[a.view]||0)+1; n++ }
  document.querySelectorAll('nav#tabs .tab').forEach(b=>{
    const v=b.dataset.v, c=counts[v]||0;
    let badge=b.querySelector('.tabbadge');
    if(c>0){
      if(!badge){ badge=document.createElement('span'); badge.className='tabbadge'; b.appendChild(badge) }
      badge.textContent=String(c);
      badge.title=c+' item(s) need attention on this tab';
    } else if(badge) badge.remove();
  });
  const t=document.querySelector('nav#tabs .tab[data-v="dash"]');
  if(t) t.title = n? n+' open alert(s) on the dashboard' : 'No open alerts';
}
