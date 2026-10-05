/* ================================================================
   VIEW: ADD DATA  (manual · invoice scan · email/text · CSV)
   ================================================================ */
function renderIngest(){
  const el=$('v-ingest');
  const dzContent= UI.ocrURL
    ? `<img src="${UI.ocrURL}" alt="preview">`
    : `📄 <b>Drop an invoice, receipt or screenshot here</b> — or click to browse<br><span class="small mut">images stay on your device; nothing is uploaded</span>`;
  el.innerHTML=`
  <div class="grid2">
    <div class="card">
      <h3>✍️ Manual entry</h3>
      ${entryFormHTML('man','manual')}
    </div>
    <div class="card">
      <h3>🧾 Scan invoice / receipt / screenshot</h3>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
        <label class="checkline"><input type="checkbox" id="ocrOn" ${UI.ocrOn?'checked':''} onchange="UI.ocrOn=this.checked"> Try OCR (needs internet)</label>
        <select id="imgSrcSel" style="width:auto" onchange="UI.imgSrc=this.value;renderIngest()">
          <option value="invoice" ${UI.imgSrc==='invoice'?'selected':''}>Source: Invoice scan</option>
          <option value="screenshot" ${UI.imgSrc==='screenshot'?'selected':''}>Source: Screenshot</option>
        </select>
        <button class="btn small" onclick="runOCR()">🔍 Scan image</button>
      </div>
      <div class="dropzone" onclick="document.getElementById('imgIn').click()"
           ondragover="event.preventDefault();this.classList.add('hover')"
           ondragleave="this.classList.remove('hover')"
           ondrop="event.preventDefault();this.classList.remove('hover');handleImgFile(event.dataTransfer.files[0])">${dzContent}</div>
      <input type="file" id="imgIn" accept="image/*" style="display:none" onchange="handleImgFile(this.files[0])">
      <div class="status" id="ocrStatus">${UI.ocrMsg||''}</div>
      <hr style="border:0;border-top:1px solid var(--line);margin:12px 0">
      <h3 style="font-size:13.5px">Quick-entry from this image</h3>
      ${entryFormHTML('img', UI.imgSrc||'invoice')}
    </div>
  </div>
  ${UI.candidates.length? `
  <div class="card">
    <div class="cardhead"><h3 style="margin:0">🔍 Parsed entries — review &amp; import <span class="chip grey">${UI.candidates.length}</span></h3>
      <span class="grow"></span><button class="btn small" onclick="importCandidates()">➕ Import checked</button>
      <button class="btn ghost small" onclick="UI.candidates=[];renderIngest()">Discard</button></div>
    <div class="scrollx"><table class="t"><thead><tr><th></th><th>Date</th><th>Vendor</th><th>Detail</th><th>Category</th><th class="num">Amount</th><th>Confidence</th></tr></thead>
    <tbody>${UI.candidates.map((c,i)=>`
      <tr><td><input type="checkbox" id="ck${i}" checked></td>
        <td><input type="date" id="cd${i}" value="${c.date}" style="width:132px"></td>
        <td><input type="text" id="cv${i}" value="${esc(c.vendor)}" style="width:130px"></td>
        <td><input type="text" id="cx${i}" value="${esc(c.desc)}" style="width:170px"></td>
        <td><select id="cc${i}" style="width:190px">${catOptions(c.cat,false)}</select></td>
        <td><input type="number" id="ca${i}" step="0.01" value="${c.amount}" style="width:100px"></td>
        <td>${c.conf==='high'?'<span class="chip green">high</span>':'<span class="chip amber">verify</span>'}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="hint">“Verify” rows were guessed from keywords — amounts and categories are editable before import.</p>
  </div>`:''}
  <div class="card">
    <h3>📧 From email or pasted text</h3>
    <p class="hint" style="margin-top:0">Paste a receipt/order/bank email (or upload an .eml/.txt file). Amounts, dates, vendors and categories are detected automatically.</p>
    <textarea id="emailText" rows="7" placeholder="Paste email or statement text here… e.g.&#10;From: billing@massystores.com&#10;Date: 12/03/2026&#10;Your order total: TT$ 486.20" oninput="UI.emailText=this.value">${esc(UI.emailText||'')}</textarea>
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
      <button class="btn" onclick="parseEmailText()">🔍 Parse text</button>
      <button class="btn ghost" onclick="document.getElementById('emlIn').click()">📂 Upload .eml / .txt</button>
      <input type="file" id="emlIn" accept=".eml,.txt,text/plain,message/rfc822" style="display:none" onchange="readEmlFile(this)">
    </div>
    <div class="status" id="parseStatus">${UI.parseMsg||''}</div>
  </div>
  <div class="card">
    <h3>📄 CSV import</h3>
    <p class="hint" style="margin-top:0">Columns recognized: <b>date, description, category, vendor, amount</b> (any order, extra columns ignored). Amounts can include currency symbols.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" onclick="document.getElementById('csvIn').click()">📂 Choose CSV file</button>
      <button class="btn ghost" onclick="downloadTemplate()">⬇️ Download template</button>
      <input type="file" id="csvIn" accept=".csv,text/csv" style="display:none" onchange="handleCSVFile(this)">
    </div>
    <div class="status" id="csvStatus">${UI.csvMsg||''}</div>
    ${UI.csvCands&&UI.csvCands.length? `
      <div class="scrollx" style="margin-top:8px"><table class="t"><thead><tr><th>Date</th><th>Vendor</th><th>Description</th><th>Category</th><th class="num">Amount</th></tr></thead>
      <tbody>${UI.csvCands.slice(0,10).map(c=>`<tr><td>${c.date}</td><td>${esc(c.vendor)}</td><td>${esc(c.desc)}</td><td>${catIcon(c.cat)} ${esc(catName(c.cat))}</td><td class="num">${fmt(c.amount)}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint">${UI.csvCands.length>10?('…and '+(UI.csvCands.length-10)+' more. '):''}Categories were auto-assigned where possible.</p>
      <button class="btn" onclick="importCSV()">➕ Import ${UI.csvCands.length} rows</button>`:''}
  </div>`;
}
/* ---- image flow ---- */
function handleImgFile(f){
  if(!f) return;
  if(!/^image\//.test(f.type)){ toast('Please choose an image file (JPG/PNG)'); return }
  if(UI.ocrURL) URL.revokeObjectURL(UI.ocrURL);
  UI.ocrFile=f; UI.ocrURL=URL.createObjectURL(f); UI.ocrMsg='';
  renderIngest();
  if(UI.ocrOn) runOCR();
}
let tessPromise=null;
function loadTesseract(){
  if(window.Tesseract) return Promise.resolve();
  if(!tessPromise) tessPromise=new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';   /* pinned — major-only floats can break silently */
    s.onload=()=>res(); s.onerror=()=>{ tessPromise=null; rej(new Error('offline')) };
    document.head.appendChild(s);
  });
  return tessPromise;
}
async function runOCR(){
  if(!UI.ocrFile){ toast('Choose an invoice or screenshot image first'); return }
  if(!UI.ocrOn){ UI.ocrMsg='Tick “Try OCR” first (it needs internet).'; renderIngest(); return }
  UI.ocrMsg='⏳ Loading OCR engine (first use downloads ~2 MB)…'; renderIngest();
  try{
    await loadTesseract();
    UI.ocrMsg='⏳ Reading image…'; renderIngest();
    const res=await window.Tesseract.recognize(UI.ocrFile,'eng');
    const text=(res.data&&res.data.text)||'';
    const cands=parseText(text, UI.imgSrc||'invoice');
    UI.ocrMsg = cands.length? 'OCR finished — review the parsed entries below.':'OCR finished but no amounts were found — use the quick-entry form beside the image.';
    UI.candidates=cands;
  }catch(e){
    UI.ocrMsg='⚠️ OCR unavailable here (offline or blocked). The image preview stays above — type the details into the quick-entry form. When this file is opened in a normal browser with internet, OCR will work.';
  }
  renderIngest();
}
/* ---- email / text parsing ---- */
function readEmlFile(input){
  const f=input.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ UI.emailText=String(r.result||''); renderIngest(); parseEmailText() };
  r.readAsText(f);
}
function parseEmailText(){
  const txt=(UI.emailText||'').trim();
  if(!txt){ UI.parseMsg='Paste some text first.'; renderIngest(); return }
  const cands=parseText(txt,'email');
  UI.candidates=cands;
  UI.parseMsg = cands.length? ('Found '+cands.length+' candidate '+(cands.length===1?'entry':'entries')+' — review them in the table above.')
    : 'No amounts detected. Tip: include lines like “Total TT$ 123.45”.';
  renderIngest();
  if(cands.length){ const tbl=document.querySelector('#v-ingest .card .scrollx'); if(tbl) tbl.scrollIntoView({behavior:'smooth',block:'center'}) }
}
/* ---- the heuristic parser (works on OCR text, emails, statements) ---- */
function mkISO(y,m,d){ m=Math.min(12,Math.max(1,m)); d=Math.min(31,Math.max(1,d));
  return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0') }
function extractDate(s){
  s=String(s||'');
  let m=s.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/); if(m) return mkISO(+m[1],+m[2],+m[3]);
  m=s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/); if(m) return mkISO(+m[3],+m[2],+m[1]); /* d/m/yyyy */
  const MO='jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
  m=s.match(new RegExp('(\\d{1,2})\\s+('+MO+')[a-z]*\\s*,?\\s*(20\\d{2})','i')); if(m) return mkISO(+m[3], 1+MO.split('|').indexOf(m[2].toLowerCase()), +m[1]);
  m=s.match(new RegExp('('+MO+')[a-z]*\\.?\\s+(\\d{1,2}),?\\s*(20\\d{2})','i')); if(m) return mkISO(+m[3], 1+MO.split('|').indexOf(m[1].toLowerCase()), +m[2]);
  return null;
}
function guessVendorLine(l){
  for(const words of Object.values(VENDOR_HINTS)){ for(const w of words){ if(l.toLowerCase().includes(w)) return w.replace(/\b\w/g,c=>c.toUpperCase()) } }
  const cleaned=l.replace(/[\d,.$€£]/g,' ').replace(/\s+/g,' ').trim();
  const words=cleaned.split(' ').filter(w=>w.length>2).slice(0,3);
  return words.length? words.map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' '): '';
}
function parseText(raw, src){
  const lines=String(raw||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const fromM=String(raw).match(/^From:\s*(.+)$/mi); const fromVendor=fromM? vendorFromEmail(fromM[1]):null;
  const subjM=String(raw).match(/^Subject:\s*(.+)$/mi);
  const cands=[], seen={};
  for(const l of lines){
    if(/^(from|to|cc|bcc|subject|date|sent|reply|return-path|delivered-to|received|content-type|mime|dkim|spf|authentication-results|x-|>--|^--$|={3,}|#{3,}|\*{3,})/i.test(l) && !/total|amount|due|paid|balance|charged/i.test(l)) continue;
    const amts=[...l.matchAll(/(?:tt\$|ttd|us\$|usd|\$|€|£|rs\.?)?\s*([\d,]+\.\d{2})\b/gi)].map(m=>+m[1].replace(/,/g,''));
    if(!amts.length) continue;
    const isTotal=/(grand total|total due|amount due|balance due|amount payable|total paid|pay this amount|invoice total|order total|total:)/i.test(l);
    const amt=isTotal? Math.max(...amts): amts[amts.length-1];
    const key=l.toLowerCase().replace(/[^a-z0-9.]/g,'');
    if(seen[key]) continue; seen[key]=1;
    const vendor=fromVendor||guessVendorLine(l)||'';
    const combined=l+' '+vendor+' '+(subjM?subjM[1]:'');
    const cat=guessCat(combined)||'other';
    const incomeType=cat==='income'?guessIncomeType(combined):undefined;
    cands.push({ date: extractDate(l)||extractDate(String(raw))||todayISO(), amount:amt,
      vendor, desc:(subjM&&!isTotal? subjM[1].slice(0,60): l.replace(/[\t ]+/g,' ').slice(0,70)),
      cat, ...(incomeType?{incomeType}:{}), src:src||'manual', conf:(isTotal||fromVendor)?'high':'verify' });
    if(cands.length>=30) break;
  }
  return cands;
}
function importCandidates(){
  let n=0;
  UI.candidates.forEach((c,i)=>{
    if(!$('ck'+i)||!$('ck'+i).checked) return;
    const amt=parseAmt($('ca'+i).value); if(!amt) return;
    const cat=$('cc'+i).value;
    state.tx.push({ id:uid(), date:$('cd'+i).value||todayISO(), cat,
      sub:$('cv'+i).value.trim(), desc:$('cx'+i).value.trim(), amt:round2(amt), src:c.src||'manual', ded:false,
      ...(cat==='income'?{incomeType:c.incomeType||guessIncomeType(($('cv'+i).value||'')+' '+($('cx'+i).value||''))||'other_income'}:{}) });
    n++;
  });
  UI.candidates=[]; UI.ocrMsg=''; UI.parseMsg='';
  store.save(); renderAll(); toast(n+' entries imported');
}
/* ---- CSV ---- */
function downloadTemplate(){
  const csv='date,description,category,vendor,amount\n2026-01-05,Weekly groceries,,Massy Stores,412.50\n2026-01-07,Electricity bill,,T&TEC,398.74\n2026-01-08,Dinner out,,Restaurant dinner,486.00\n';
  showExportModal('CSV template', csv, 'lifeledger-template.csv');
}
function handleCSVFile(input){
  const f=input.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    const res=parseCSVText(String(r.result||''));
    if(res.error){ UI.csvMsg='⚠️ '+res.error; UI.csvCands=[] }
    else { UI.csvMsg='✔ Read '+res.cands.length+' rows — preview below, then import.'; UI.csvCands=res.cands }
    renderIngest();
  };
  r.readAsText(f);
}
function csvLine(l){ const out=[]; let cur='',q=false;
  for(const ch of l){ if(ch==='"'){ q=!q } else if(ch===','&&!q){ out.push(cur); cur='' } else cur+=ch }
  out.push(cur); return out.map(s=>s.trim());
}
function matchCatName(name){
  const s=String(name||'').toLowerCase().replace(/[^a-z]/g,'');
  if(!s) return null;
  for(const c of CATS){ if(s===c.id||s===c.name.toLowerCase().replace(/[^a-z]/g,'')) return c.id }
  for(const c of CATS){ if(s.includes(c.id)||c.name.toLowerCase().replace(/[^a-z]/g,'').includes(s)) return c.id }
  return null;
}
function parseCSVText(text){
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  if(!lines.length) return {error:'empty file'};
  const head=csvLine(lines[0]).map(h=>h.toLowerCase());
  const find=(...names)=>{ for(const nm of names){ const i=head.findIndex(h=>h===nm||h.startsWith(nm)); if(i>=0) return i } return -1 };
  let iDate=find('date'), iAmt=find('amount','amt','value','total','sum'), iDesc=find('description','desc','details','memo','notes','narrative','particulars'),
      iVen=find('vendor','merchant','payee','store','company'), iCat=find('category','cat','type','tag');
  if(iDate<0||iAmt<0){
    /* maybe headerless: date,description,amount */
    const t1=csvLine(lines[0]);
    if(t1.length>=3 && /^\d/.test(t1[0]) && !isNaN(parseFloat(t1[t1.length-1].replace(/[^\d.]/g,'')))){
      iDate=0; iDesc=1; iAmt=t1.length-1; iVen=-1; iCat=-1; lines.unshift([]);
    } else return {error:'Could not find date/amount columns. Use the template to see the expected headers.'};
  }
  const cands=[];
  for(let r=1;r<lines.length;r++){
    const c=csvLine(lines[r]);
    if(!c[iDate]) continue;
    const amt=Math.abs(parseAmt(c[iAmt])); if(!amt) continue;
    const desc=iDesc>=0? c[iDesc]:'';
    const ven=iVen>=0? c[iVen]:'';
    const cat=(iCat>=0&&matchCatName(c[iCat]))||guessCat(desc+' '+ven)||'other';
    const incomeType=cat==='income'?guessIncomeType(desc+' '+ven):null;
    const dt=extractDate(c[iDate])||todayISO();
    cands.push({date:dt, amount:round2(amt), vendor:ven, desc, cat, ...(incomeType?{incomeType}:{}), src:'csv'});
  }
  return {cands};
}
function importCSV(){
  let n=0;
  for(const c of (UI.csvCands||[])){
    state.tx.push({id:uid(), date:c.date, cat:c.cat, sub:c.vendor, desc:c.desc, amt:c.amount, src:'csv', ded:false,
      ...(c.cat==='income'?{incomeType:c.incomeType||guessIncomeType((c.vendor||'')+' '+(c.desc||''))||'other_income'}:{})}); n++;
  }
  UI.csvCands=[]; UI.csvMsg='';
  store.save(); renderAll(); toast(n+' rows imported from CSV');
}

