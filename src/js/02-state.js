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
    streams:[], tx:[], budgets:{}, household:{members:[]}, projects:[],
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
  for(const p of s.projects){
    if(!p.items||!Array.isArray(p.items)) p.items=[];
    if(!p.type) p.type='home';
    if(!p.priority) p.priority='normal';
    if(!p.status) p.status='planning';
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
  candidates:[], ocrFile:null, ocrURL:null, stressPct:0, cuts:{}, invReturn:7, invYears:10, invContrib:null, showT12:true };

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
/* trailing-12 aggregates (averages per month) */
function t12(){
  const ms = trailingMonths(12); let inc=0, exp=0; const byCat={};
  for(const {y,m} of ms){ const a=agg(txForMonth(y,m)); inc+=a.inc; exp+=a.exp;
    for(const k in a.byCat) byCat[k]=(byCat[k]||0)+a.byCat[k] }
  const n=ms.length;
  const byCatAvg={}; for(const k in byCat) byCatAvg[k]=byCat[k]/n;
  return { incAvg:inc/n, expAvg:exp/n, byCatAvg, ms, n };
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

