(function boot(){
  /* expose read/write access for the browser console & tests */
  window.LL={ get state(){return state}, set state(v){ state=v }, get UI(){return UI} };
  const loaded=store.load();
  state=loaded||freshState();
  if(loaded) state.settings=migrateSettings(state.settings);   /* migrate older saves to the current schema */
  migrateWorkspace(state);
  if(!loaded){
    const s=buildSample();
    state.tx=s.tx; state.budgets=s.budgets; state.streams=s.streams;
    state.household=s.household||{members:[]}; state.projects=s.projects||[];
    state.meta.sample=true; migrateIncomeTypes(state); migrateProjectArchives(); store.save();
  }
  else {
    migrateIncomeTypes(state);
    if(migrateProjectArchives()) store.save();
  }
  if(!state.meta) state.meta={init:true,sample:false};
  $('currencySel').innerHTML=CURRENCIES.map(c=>`<option value="${c[0]}" ${c[0]===state.settings.currency?'selected':''}>${c[0]} ${c[1]}</option>`).join('');
  bootTimeDefaults();
  renderAll();
  showView('dash');
  bootNotices();   /* storage-loss warning (1.4.0), else the privacy notice (1.4.2) */
})();