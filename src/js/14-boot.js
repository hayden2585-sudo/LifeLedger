(async function boot(){
  /* expose read/write access for the browser console & tests */
  window.LL={ get state(){return state}, set state(v){ state=v }, get UI(){return UI}, get store(){return store} };
  const loaded=store.load();
  const locked=!!loaded?.__locked;
  state=locked?freshState():(loaded||freshState());
  if(locked) state.security=securityStorageHeaderToConfig(loaded.security);
  if(!locked && loaded) state.settings=migrateSettings(state.settings);
  migrateWorkspace(state);
  migrateCashflowContext(state);
  if(!locked && !loaded){
    const s=buildSample();
    state.tx=s.tx; state.budgets=s.budgets; state.streams=s.streams;
    state.household=s.household||{members:[]}; state.projects=s.projects||[];
    state.meta.sample=true; migrateIncomeTypes(state); migrateProjectArchives(); store.save();
  } else if(!locked && loaded) {
    migrateIncomeTypes(state);
    if(!securityEnabled() && migrateProjectArchives()) store.save();
  }
  if(!state.meta) state.meta={init:true,sample:false};
  $('currencySel').innerHTML=CURRENCIES.map(c=>`<option value="${c[0]}" ${c[0]===state.settings.currency?'selected':''}>${c[0]} ${c[1]}</option>`).join('');
  bootTimeDefaults();
  renderAll();
  showView('dash');
  bootNotices();   /* storage warning or security access gate */
})();