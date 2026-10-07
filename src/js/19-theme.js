/* ================================================================
   LIFELEDGER PRESENTATION THEME ENGINE
   Cosmetic layer only: themes, typography, density and appearance UI.
   No ledger calculations, records or workflow logic belong here.
   ================================================================ */

const LL_THEMES = {
  modern: {
    name:'Modern Light', icon:'☀️',
    desc:'Clean, airy and friendly',
    vars:{bg:'#f3f6fb',card:'#ffffff',ink:'#172033',mut:'#647089',line:'#dfe6f1',brand:'#2563eb',brand2:'#1d4ed8',head:'#10244a',accent:'#06b6d4',glow:'rgba(37,99,235,.12)'}
  },
  dark: {
    name:'Dark Professional', icon:'🌙',
    desc:'Bold, polished and low-glare',
    vars:{bg:'#08111f',card:'#101b2d',ink:'#edf4ff',mut:'#9aabc2',line:'#24344c',brand:'#38bdf8',brand2:'#0ea5e9',head:'#050b15',accent:'#a78bfa',glow:'rgba(56,189,248,.12)'}
  },
  ocean: {
    name:'Ocean / Teal', icon:'🌊',
    desc:'Vibrant, calm and modern',
    vars:{bg:'#e8f8f8',card:'#ffffff',ink:'#12333a',mut:'#58757c',line:'#c7e5e7',brand:'#0891b2',brand2:'#0e7490',head:'#064e5a',accent:'#14b8a6',glow:'rgba(8,145,178,.13)'}
  },
  sunset: {
    name:'Sunset / Gradient', icon:'🌅',
    desc:'Energetic and expressive',
    vars:{bg:'#fff4f4',card:'#ffffff',ink:'#27152b',mut:'#766276',line:'#f0d9e4',brand:'#db2777',brand2:'#be185d',head:'#3b0a35',accent:'#f97316',glow:'rgba(219,39,119,.13)'}
  },
  minimal: {
    name:'Minimalist / Focus', icon:'◻️',
    desc:'Quiet, simple and information-first',
    vars:{bg:'#f7f7f5',card:'#ffffff',ink:'#222522',mut:'#70756f',line:'#e4e5e0',brand:'#3f5f4b',brand2:'#304b3a',head:'#28362e',accent:'#8b9a8d',glow:'rgba(63,95,75,.09)'}
  },
  contrast: {
    name:'High Contrast', icon:'◐',
    desc:'Bold, clear and accessible',
    vars:{bg:'#050505',card:'#101010',ink:'#ffffff',mut:'#e5e5e5',line:'#555555',brand:'#ffd400',brand2:'#ffea00',head:'#000000',accent:'#00e5ff',glow:'rgba(255,212,0,.16)'}
  }
};

const LL_FONTS = {
  system: {name:'System UI', css:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif'},
  aptos: {name:'Aptos', css:'Aptos,"Segoe UI",Arial,sans-serif'},
  inter: {name:'Inter', css:'Inter,"Segoe UI",Arial,sans-serif'},
  avenir: {name:'Avenir Next', css:'"Avenir Next",Avenir,"Segoe UI",sans-serif'},
  nunito: {name:'Nunito', css:'Nunito,"Trebuchet MS",sans-serif'},
  georgia: {name:'Georgia', css:'Georgia,"Times New Roman",serif'},
  verdana: {name:'Verdana', css:'Verdana,Geneva,sans-serif'},
  mono: {name:'Monospace', css:'ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace'}
};

function llAppearanceDefaults(){
  return {
    uiTheme:'modern',
    uiFont:'system',
    uiCustomFont:'',
    uiFontSize:'standard',
    uiFontWeight:'regular',
    uiDensity:'comfortable',
    uiRadius:'modern'
  };
}

function llEnsureAppearanceSettings(){
  if(!state || !state.settings) return;
  const d=llAppearanceDefaults();
  Object.keys(d).forEach(k=>{ if(state.settings[k]===undefined) state.settings[k]=d[k] });
}

function llApplyAppearance(){
  if(!state) return;
  llEnsureAppearanceSettings();
  const s=state.settings;
  const theme=LL_THEMES[s.uiTheme]||LL_THEMES.modern;
  const root=document.documentElement;
  root.dataset.theme=s.uiTheme||'modern';
  root.dataset.font=s.uiFont||'system';
  root.dataset.fontSize=s.uiFontSize||'standard';
  root.dataset.fontWeight=s.uiFontWeight||'regular';
  root.dataset.density=s.uiDensity||'comfortable';
  root.dataset.radius=s.uiRadius||'modern';
  Object.entries(theme.vars).forEach(([k,v])=>root.style.setProperty('--'+k,v));
  const custom=(s.uiCustomFont||'').trim();
  root.style.setProperty('--custom-font', custom ? '"'+custom.replace(/["']/g,'')+'",'+llFontCSS(s.uiFont) : llFontCSS(s.uiFont));
}

function llFontCSS(key){
  return (LL_FONTS[key]||LL_FONTS.system).css;
}

function llOpenAppearance(){
  llEnsureAppearanceSettings();
  if(!$('llAppearanceModal')) document.body.insertAdjacentHTML('beforeend',llAppearanceHTML());
  llPopulateAppearance();
  $('llAppearanceModal').classList.add('open');
  document.body.classList.add('appearance-open');
}

function llCloseAppearance(){
  const m=$('llAppearanceModal');
  if(m) m.classList.remove('open');
  document.body.classList.remove('appearance-open');
}

function llApplyAppearanceSettings(){
  const s=state.settings;
  const get=id=>$(id);
  s.uiTheme=get('llThemeSelect').value;
  s.uiFont=get('llFontSelect').value;
  s.uiCustomFont=get('llCustomFont').value.trim().slice(0,60);
  s.uiFontSize=get('llFontSize').value;
  s.uiFontWeight=get('llFontWeight').value;
  s.uiDensity=get('llDensity').value;
  s.uiRadius=get('llRadius').value;
  llApplyAppearance();
  store.save();
  renderAll();
  llCloseAppearance();
  toast('Appearance saved — your ledger data was not changed.');
}

function llPreviewAppearance(){
  const s=state.settings;
  s.uiTheme=$('llThemeSelect').value;
  s.uiFont=$('llFontSelect').value;
  s.uiCustomFont=$('llCustomFont').value.trim().slice(0,60);
  s.uiFontSize=$('llFontSize').value;
  s.uiFontWeight=$('llFontWeight').value;
  s.uiDensity=$('llDensity').value;
  s.uiRadius=$('llRadius').value;
  llApplyAppearance();
  llUpdateAppearancePreview();
}

function llResetAppearance(){
  Object.assign(state.settings,llAppearanceDefaults());
  llApplyAppearance();
  store.save();
  llPopulateAppearance();
  renderAll();
  toast('Appearance reset to the LifeLedger default.');
}

function llPopulateAppearance(){
  const s=state.settings;
  $('llThemeSelect').value=s.uiTheme||'modern';
  $('llFontSelect').value=s.uiFont||'system';
  $('llCustomFont').value=s.uiCustomFont||'';
  $('llFontSize').value=s.uiFontSize||'standard';
  $('llFontWeight').value=s.uiFontWeight||'regular';
  $('llDensity').value=s.uiDensity||'comfortable';
  $('llRadius').value=s.uiRadius||'modern';
  const grid=$('llThemeCards');
  if(grid) grid.innerHTML=Object.entries(LL_THEMES).map(([id,t])=>`
    <button type="button" class="ll-theme-card ${s.uiTheme===id?'selected':''}" data-theme-choice="${id}" onclick="llChooseTheme('${id}')">
      <span class="ll-theme-swatch" data-swatch="${id}">
        <i></i><i></i><i></i><i></i>
      </span>
      <span class="ll-theme-card-copy"><b>${t.icon} ${t.name}</b><small>${t.desc}</small></span>
      <span class="ll-theme-check">✓</span>
    </button>`).join('');
  llUpdateAppearancePreview();
}

function llChooseTheme(id){
  $('llThemeSelect').value=id;
  llPreviewAppearance();
  document.querySelectorAll('.ll-theme-card').forEach(x=>x.classList.toggle('selected',x.dataset.themeChoice===id));
}

function llUpdateAppearancePreview(){
  const theme=LL_THEMES[$('llThemeSelect').value]||LL_THEMES.modern;
  const p=$('llAppearancePreview');
  if(!p) return;
  p.style.setProperty('--preview-brand',theme.vars.brand);
  p.style.setProperty('--preview-accent',theme.vars.accent);
  p.innerHTML=`
    <div class="ll-preview-head"><span>${theme.icon} LifeLedger</span><span>Today · ${new Date().toLocaleDateString()}</span></div>
    <div class="ll-preview-title">Monthly Household Budget</div>
    <div class="ll-preview-kpis">
      <div><small>Income</small><strong>TT$12,450</strong><em>↑ 12.5%</em></div>
      <div><small>Expenses</small><strong>TT$8,321</strong><em>↓ 8.3%</em></div>
      <div><small>Balance</small><strong>TT$4,129</strong><em>↑ 15.7%</em></div>
    </div>
    <div class="ll-preview-chart"><span></span><span></span><span></span><span></span><span></span><span></span></div>
    <div class="ll-preview-foot"><span>Spending breakdown</span><span>Income vs Expenses</span></div>`;
}

function llAppearanceHTML(){
  const fontOptions=Object.entries(LL_FONTS).map(([k,f])=>`<option value="${k}">${f.name}</option>`).join('');
  return `
  <div id="llAppearanceModal" class="ll-modal" role="dialog" aria-modal="true" aria-labelledby="llAppearanceTitle" onclick="if(event.target===this)llCloseAppearance()">
    <div class="ll-modal-panel">
      <div class="ll-modal-head">
        <div><span class="ll-eyebrow">PERSONALIZATION</span><h2 id="llAppearanceTitle">Make LifeLedger yours</h2><p>Change the look and typography without changing a single ledger record.</p></div>
        <button type="button" class="ll-close" onclick="llCloseAppearance()" aria-label="Close">×</button>
      </div>
      <div class="ll-appearance-grid">
        <section class="ll-theme-section">
          <div class="ll-section-title"><h3>Visual theme</h3><span>Choose your personality</span></div>
          <div id="llThemeCards" class="ll-theme-cards"></div>
        </section>
        <section class="ll-type-section">
          <div class="ll-section-title"><h3>Typography</h3><span>Readable your way</span></div>
          <label class="ll-field"><span>Theme selector</span><select id="llThemeSelect" onchange="llChooseTheme(this.value)">
            <option value="modern">Modern Light</option><option value="dark">Dark Professional</option><option value="ocean">Ocean / Teal</option><option value="sunset">Sunset / Gradient</option><option value="minimal">Minimalist / Focus</option><option value="contrast">High Contrast</option>
          </select></label>
          <label class="ll-field"><span>Font family</span><select id="llFontSelect" onchange="llPreviewAppearance()">${fontOptions}</select></label>
          <label class="ll-field"><span>Custom/local font name <small>(optional)</small></span><input id="llCustomFont" type="text" maxlength="60" placeholder="e.g. Poppins" oninput="llPreviewAppearance()"></label>
          <div class="ll-two-fields">
            <label class="ll-field"><span>Text size</span><select id="llFontSize" onchange="llPreviewAppearance()"><option value="compact">Compact</option><option value="standard">Standard</option><option value="large">Large</option><option value="xl">Extra Large</option></select></label>
            <label class="ll-field"><span>Weight</span><select id="llFontWeight" onchange="llPreviewAppearance()"><option value="light">Light</option><option value="regular">Regular</option><option value="medium">Medium</option><option value="semibold">Semibold</option><option value="bold">Bold</option></select></label>
          </div>
          <div class="ll-two-fields">
            <label class="ll-field"><span>Density</span><select id="llDensity" onchange="llPreviewAppearance()"><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select></label>
            <label class="ll-field"><span>Corner style</span><select id="llRadius" onchange="llPreviewAppearance()"><option value="sharp">Sharp</option><option value="modern">Modern</option><option value="soft">Soft</option><option value="pill">Pill-like</option></select></label>
          </div>
          <div class="ll-tip">Tip: choose a theme first, then tune typography independently. Your choices work across the dashboard, ledger, budgets, projects and reports.</div>
        </section>
      </div>
      <section class="ll-preview-section">
        <div class="ll-section-title"><h3>Live preview</h3><span>Representative dashboard components</span></div>
        <div id="llAppearancePreview" class="ll-preview"></div>
      </section>
      <div class="ll-modal-foot">
        <span>🎨 Cosmetic settings only · your ledger remains untouched</span>
        <div><button type="button" class="btn ghost" onclick="llResetAppearance()">Reset default</button><button type="button" class="btn" onclick="llApplyAppearanceSettings()">Apply &amp; save</button></div>
      </div>
    </div>
  </div>`;
}

(function llThemeInit(){
  window.addEventListener('DOMContentLoaded',()=>{
    try{ llEnsureAppearanceSettings(); llApplyAppearance(); }catch(e){ console.warn('Appearance init skipped',e) }
  });
})();
