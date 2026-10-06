/* ---------------- state & storage ---------------- */
const LSKEY = 'lifeledger.v1';
const store = {
  ok: (()=>{ try{ localStorage.setItem('__t','1'); localStorage.removeItem('__t'); return true }catch(e){ return false } })(),
  lastSaveOk:true,
  saving:false,
  lockedRecord:null,
  _saveChain:Promise.resolve(),
  save(){
    if(!this.ok){ this.lastSaveOk=false; updateSaveBadge(); return Promise.resolve(false) }
    if(securityEnabled()&&!securitySession._ledgerKey){ this.lastSaveOk=false; updateSaveBadge(); return Promise.resolve(false) }
    /* Preserve the original synchronous behavior for plaintext legacy/new workspaces.
       Once whole-ledger protection is active, encryption is necessarily async and is
       serialized so rapid UI edits cannot race each other. */
    if(!securityEnabled()){
      try{ const raw=JSON.stringify(state); localStorage.setItem(LSKEY,raw); this.lastSaveOk=true }
      catch(e){ this.lastSaveOk=false }
      updateSaveBadge();
      return Promise.resolve(this.lastSaveOk);
    }
    const snapshot=JSON.parse(JSON.stringify(state));
    this._saveChain=this._saveChain.then(async()=>{
      this.saving=true; updateSaveBadge();
      try{
        const raw=await securityStorageRecordFromState(snapshot,securitySession._ledgerKey);
        localStorage.setItem(LSKEY,raw);
        this.lockedRecord=securityStorageRead(raw)||this.lockedRecord;
        this.lastSaveOk=true;
      }catch(e){ this.lastSaveOk=false }
      this.saving=false; updateSaveBadge();
      return this.lastSaveOk;
    });
    return this._saveChain;
  },
  flush(){ return this._saveChain },
  relock(){
    if(!this.ok){this.lockedRecord=null;return}
    try{this.lockedRecord=securityStorageRead(localStorage.getItem(LSKEY))}catch(e){this.lockedRecord=null}
  },
  load(){
    if(!this.ok) return null;
    try{
      const raw=localStorage.getItem(LSKEY);
      if(!raw) return null;
      const locked=securityStorageRead(raw);
      if(locked){ this.lockedRecord=locked; return {__locked:true,security:securityStorageHeaderToConfig(locked.security)} }
      this.lockedRecord=null;
      return JSON.parse(raw);
    }catch(e){ return null }
  }
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
    security:securityNewConfig(),
    meta:{ created:Date.now(), sample:false, init:true, name:'', nameCustom:false, privacySeen:false }
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
  if(!s.security || typeof s.security!=='object') s.security=securityNewConfig();
  if(!Array.isArray(s.security.profiles)) s.security.profiles=[];
  if(!s.security.policy || typeof s.security.policy!=='object') s.security.policy={guestEnabled:true,autoLockMinutes:15};
  if(s.security.adminVerifier===undefined) s.security.adminVerifier=null;
  if(s.security.protectedEnvelope===undefined) s.security.protectedEnvelope=null;
  if(s.security.ledgerKeySalt===undefined) s.security.ledgerKeySalt=null;
  if(s.security.ledgerKeyIterations===undefined) s.security.ledgerKeyIterations=SECURITY.iterations;
  if(s.security.storageProtected===undefined) s.security.storageProtected=false;
  if(s.security.legacyProtectionPending===undefined) s.security.legacyProtectionPending=!!s.security.enabled&&!s.security.storageProtected;
  if(s.security.schemaVersion===undefined) s.security.schemaVersion=1;
  /* workspace naming (1.4.2): a save with no meta.name is an EXISTING install, so
     default nameCustom to true — the user's ledger is theirs and we must not start
     overwriting it with a name derived from their household later. Newly created
     workspaces come from freshState(), which sets these explicitly. */
  if(!s.meta) s.meta={};
  if(s.meta.name===undefined) s.meta.name='';
  if(s.meta.nameCustom===undefined) s.meta.nameCustom=true;
  if(s.meta.privacySeen===undefined) s.meta.privacySeen=true;
  for(const p of s.projects){
    if(!p.items||!Array.isArray(p.items)) p.items=[];
    if(!p.type) p.type='home';
    if(!p.priority) p.priority='normal';
    if(!p.status) p.status='planning';
    /* projects finished before the archive workflow existed are archived on load,
       so a completed project never keeps cluttering the working list */
    if(p.archived===undefined) p.archived = (p.status==='completed' || p.status==='cancelled');
    if(p.completedAt===undefined) p.completedAt = p.archived? (p.targetDate||p.startDate||null) : null;
    if(!p.fundingPlan) p.fundingPlan={enabled:false,startingReserve:0,oneTimeContribution:0,surplusAllocationPct:0,fixedMonthlyContribution:0};
  }
  return s;
}
function normalizeCashflowContext(t){
  if(!t || typeof t!=='object') return t;
  const valid=(list,v)=>list.some(x=>x.id===v);
  if(!valid(EMPLOYMENT_CONTEXT,t.employmentContext)) t.employmentContext='unknown';
  if(!valid(SEASONAL_CONTEXT,t.seasonalContext)) t.seasonalContext='unknown';
  if(!valid(TRANSFER_PURPOSES,t.transferPurpose)) t.transferPurpose='unknown';
  if(!valid(CASHFLOW_CONTEXT,t.cashflowContext)) t.cashflowContext='ordinary';
  if(!valid(PROVENANCE_STATES,t.provenance)) t.provenance='reported';
  if(t.cashflowContext==='foreign_remittance' && t.cat==='income' && !t.incomeType) t.incomeType='gift_remittance';
  return t;
}
function migrateCashflowContext(s){
  if(!s || typeof s!=='object') return s;
  if(!Array.isArray(s.tx)) s.tx=[];
  for(const t of s.tx) normalizeCashflowContext(t);
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
  const ms=trailingMonths(12); let inc=0, exp=0; const byCat={};
  let withData=0, incomeMonths=0, expenseMonths=0;
  for(const {y,m} of ms){
    const k=txForMonth(y,m);
    if(k.length) withData++;
    const a=agg(k); inc+=a.inc; exp+=a.exp;
    if(a.inc>0) incomeMonths++;
    if(a.exp>0) expenseMonths++;
    for(const c in a.byCat) byCat[c]=(byCat[c]||0)+a.byCat[c];
  }
  const totN=ms.length;
  const n=withData||1;
  const incN=incomeMonths||1, expN=expenseMonths||1;
  const byCatAvg={}, byCatTotals={};
  for(const k in byCat){ byCatAvg[k]=byCat[k]/n; byCatTotals[k]=byCat[k] }
  return { ms, n, withData, incomeMonths, expenseMonths, totN, coverage:withData/totN,
    coveredMonths: (()=>{ const f=state.tx.reduce((a,x)=>a&&a<x.date?a:x.date,null);
      if(!f) return 0;
      const now=new Date(), s=new Date(f+'T00:00:00');
      return (now.getFullYear()-s.getFullYear())*12 + (now.getMonth()-s.getMonth()) + 1 })(),
    incAvg:inc/incN, expAvg:exp/expN, netAvg:(inc-exp)/n, byCatAvg,
    incTotal:inc, expTotal:exp, byCatTotals,
    avgBasis: withData? 'recorded months' : 'no data',
    incomeAvgBasis: incomeMonths? 'income months' : 'no income',
    expenseAvgBasis: expenseMonths? 'expense months' : 'no expenses' };
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
   WORKSPACE NAMING  (1.4.2)
   A user's data was previously anonymous — "the ledger" had no name
   anywhere, so backups were all `lifeledger-backup.json` and nothing
   identified whose figures you were looking at. The name is derived
   from what the app already knows (the household) and is fully
   renameable; a rename is preserved and never overwritten by the
   derivation.
---------------------------------------------------------------- */
function firstNameOf(full){ return String(full||'').trim().split(/\s+/)[0]||'' }
function derivedLedgerName(){
  if(state.meta && state.meta.sample) return 'Sample household ledger';
  const ms=(state.household?.members||[]).map(m=>firstNameOf(m.name)).filter(Boolean);
  if(ms.length===1) return ms[0]+' household ledger';
  if(ms.length===2) return ms[0]+' & '+ms[1];
  if(ms.length>2) return ms[0]+' +'+(ms.length-1)+' others';
  return 'My ledger';
}
function ledgerName(){
  const m=state.meta||{};
  const custom=String(m.name||'').trim();
  return custom || derivedLedgerName();
}
function ledgerNameIsCustom(){ return !!String(state.meta?.name||'').trim() }
function slugify(s){
  return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48) || 'lifeledger';
}
function ledgerFileStem(){ return ledgerNameIsCustom()? slugify(ledgerName()) : 'lifeledger' }
/* set (or, with an empty value, clear back to the derived name) */
function setLedgerName(v){
  const clean=String(v||'').trim().slice(0,60);
  state.meta.name=clean;
  state.meta.nameCustom=!!clean;
  store.save(); renderChrome(); refreshLedgerNameInputs();
  toast(clean? 'Ledger renamed to “'+clean+'”' : 'Ledger name reset to “'+ledgerName()+'”');
}
function renameLedger(){ const i=$('ledgerNameInput'); if(i) setLedgerName(i.value) }

/* ----------------------------------------------------------------
   PRIVACY & DATA NOTICE
   Legacy saves remain local and may still be plaintext until the user
   enables the new local-account security model. The notice is explicit
   about which layer is protected and which legacy data is not.
---------------------------------------------------------------- */
function showPrivacyNotice(){
  if($('privacyModal')) return;
  const m=document.createElement('div');
  m.id='privacyModal';
  m.setAttribute('role','dialog');
  m.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.7);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
  m.innerHTML=`<div style="background:#fff;border-radius:14px;padding:26px;max-width:600px;box-shadow:0 20px 50px rgba(0,0,0,.3)">
    <div style="font-size:32px;margin-bottom:6px">🔒</div>
    <h2 style="margin:0 0 4px;font-size:19px">Your data &amp; your privacy</h2>
    <p class="mut small" style="margin:0 0 14px">How <b>${esc(ledgerName())}</b> is stored — stated plainly, including what is <b>not</b> protected.</p>
    <div style="font-size:13.3px;line-height:1.65">
      <p style="margin:0 0 8px"><b>✓ It stays on this device.</b> LifeLedger remains local-first: there is no required cloud account, sync service or server storing your figures.</p>
      <p style="margin:0 0 8px;background:#edf7ef;border:1px solid #b9dfc0;border-radius:8px;padding:10px 12px"><b>🔐 With a local account:</b> ordinary budgeting uses your login; private high-value details are stored in a separate authenticated encrypted envelope and require the Admin key to reveal.</p>
      <p style="margin:0 0 8px;background:#fdf3e4;border:1px solid #f2d3a2;border-radius:8px;padding:10px 12px"><b>⚠ Legacy financial fields:</b> existing 1.4.x ledger data remains local and is not retroactively encrypted simply by installing this version. Use Account to enable protection during the migration process.</p>
      <p style="margin:0 0 8px"><b>Who can read what:</b> Guest cannot open the household UI. A signed-in user can use normal budgeting. Protected details require the separate Admin key. Anyone with control of the unlocked operating system remains outside the app's threat boundary.</p>
      <p style="margin:0 0 8px"><b>Backups:</b> plain JSON/CSV exports remain readable copies. Use an encrypted backup when that workflow is available, and store any export somewhere you control.</p>
      <p style="margin:0 0 2px"><b>Clearing browser data, uninstalling, or “Reset everything” deletes the ledger permanently.</b> Nothing can recover it. Export a JSON backup first.</p>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
      <button class="btn" onclick="ackPrivacy()">I understand — don't show this again</button>
      <button class="btn ghost" onclick="document.getElementById('privacyModal').remove()">Close</button>
    </div>
  </div>`;
  document.body.appendChild(m);
}
function ackPrivacy(){
  state.meta.privacySeen=true; store.save();
  const m=$('privacyModal'); if(m) m.remove();
}
/* shown once on a genuinely new install; a save that predates the notice is left alone */
function maybeShowPrivacyNotice(){
  if(!state || !state.meta) return;
  if(state.meta.privacySeen===true) return;
  showPrivacyNotice();
}
/* One overlay at a time at startup: if storage is unavailable that warning comes
   first (it is the more urgent fact), and the privacy notice is deferred rather
   than stacked on top of it. */
function bootNotices(){
  if(!store.ok){ showStorageWarning(); return }
  if(typeof securityBoot==='function'){ securityBoot(); return }
  maybeShowPrivacyNotice();
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
