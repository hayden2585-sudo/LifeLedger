/* ---------------- sample data ---------------- */
function buildSample(){
  const tx=[]; let n=0;
  const add=(d,cat,sub,desc,amt,src,ded)=>tx.push({id:uid()+('s'+(n++)), date:iso(d), cat, sub, desc, amt:round2(amt), src:src||'manual', ded:!!ded});
  const R=(a,b)=>a+Math.random()*(b-a);
  const J=(base,pct)=>base*(1+(Math.random()*2-1)*pct);
  const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
  const now=new Date();
  for(let i=12;i>=0;i--){
    const base=new Date(now.getFullYear(), now.getMonth()-i, 1);
    const y=base.getFullYear(), m=base.getMonth();
    const dim=new Date(y, m+1, 0).getDate();
    const D=dd=>new Date(y, m, Math.max(1,Math.min(dd,dim)));
    const raised = i<=4;   /* salary raise in the most recent 4 months */
    const salary = raised? 14456 : 13900;
    /* income */
    add(D(27),'income','Salary','Monthly salary (net take-home)',salary);
    if(Math.random()<0.62) add(D(randDay(5,25)),'income','Side gigs', pick(['Freelance design','Market stall sales','Weekend tutoring','Consulting fee']), R(300,2600));
    /* obligations */
    add(D(28),'loans','Mortgage','Monthly mortgage payment',3800);
    add(D(10),'loans','Car loan','Auto loan installment',1450);
    if(m%3===0) add(D(12),'insurance','Guardian General','Motor insurance (quarterly)',J(1410,.08));
    add(D(5),'insurance','Sagicor','Life insurance premium',218);
    add(D(5),'insurance','Atlantic Health','Health plan premium',205);
    if(m%3===1) add(D(20),'taxes','Licensing Office','Vehicle permit / licence renewal',J(180,.15));
    /* essentials */
    add(D(6),'groceries','Massy Stores','Grocery haul',J(raised?445:430,.22));
    add(D(16),'groceries','Massy Stores','Mid-month grocery top-up',J(420,.25));
    add(D(21),'groceries','Tru Valu','Fresh produce & pantry',J(300,.3));
    if(m%2===0) add(D(11),'groceries','PriceSmart','Bulk shopping run',J(1150,.15));
    add(D(14),'utilities','T&TEC','Electricity bill',J(430,.28));
    add(D(14),'utilities','WASA','Water bill',J(110,.2));
    add(D(8),'utilities','Flow','Home internet + cable',379);
    add(D(18),'utilities','bmobile','Mobile plan',J(190,.25));
    for(let w=0;w<4;w++) add(D(3+w*7),'auto', pick(['NP','Unipet']),'Fuel top-up',J(158,.3));
    add(D(9),'toiletries', pick(['Pharmacy – personal care','Blush Cosmetics','Care toiletries']),'Toiletries & personal care',J(205,.3));
    const nRides=5+Math.floor(Math.random()*4);
    for(let r=0;r<nRides;r++) add(D(randDay(1,28)),'transport', pick(['Maxi','Route taxi','Bolt ride']), pick(['Maxi/taxi fare','Taxi fare','Bolt ride']), J(34,.45));
    if(Math.random()<0.35) add(D(randDay(1,28)),'medical', pick(['Pharmacy','Doctor visit','Dental cleaning']), pick(['Prescription refill','Doctor consultation','Dental cleaning']), J(270,.4));
    if(Math.random()<0.25) add(D(randDay(1,28)),'upkeep', pick(['AC service','Plumber','Appliance repair','Handyman']), pick(['AC servicing','Plumbing repair','Washing machine repair','General repairs']), J(430,.5));
    /* lifestyle */
    const lunches=1+Math.floor(Math.random()*2);
    for(let l=0;l<lunches;l++) add(D(randDay(1,28)),'dining', pick(['Lunch takeout','Doubles run','Snack & drink']),'Lunch / takeout',J(78,.3));
    const fast=1+Math.floor(Math.random()*2);
    for(let f=0;f<fast;f++) add(D(randDay(1,28)),'dining', pick(['KFC','Subway','Royal Castle','Pizza Hut']),'Fast-food order',J(190,.3));
    if(Math.random()<0.65) add(D(randDay(10,27)),'dining', pick(['Restaurant dinner','Sushi night','Family dinner out']),'Dinner out',J(520,.4));
    add(D(3),'subscriptions','Netflix','Streaming subscription',54.99);
    add(D(3),'subscriptions','Spotify','Music subscription',26.99);
    add(D(7),'subscriptions','iCloud+','Cloud storage',18.99);
    if(raised) add(D(12),'subscriptions','Microsoft 365','Productivity subscription',74.99);
    add(D(2),'entertainment','Gym','Gym membership',260);
    const mov=1+Math.floor(Math.random()*2);
    for(let e=0;e<mov;e++) add(D(randDay(1,27)),'entertainment', pick(['Movie Towne','Cinema','Board-game café']),'Movie / outing',J(215,.3));
    if(Math.random()<0.85) add(D(randDay(4,26)),'parties', pick(['Weekend lime','Friends gathering','Beach lime']),'Weekend lime / outing',J(300,.35));
    if(Math.random()<0.5) add(D(randDay(1,27)),'parties','Birthday gift','Gift + wrapping',J(245,.4));
    if(Math.random()<0.25) add(D(randDay(1,27)),'parties', pick(['Fete tickets','All-inclusive brunch','Day pass event']), pick(['Fete tickets','All-inclusive brunch','Event day pass']), J(550,.3));
    if(Math.random()<0.25) add(D(randDay(1,27)),'education', pick(['Online course','UWI bookshop','Coursera']), pick(['Online course','Books & supplies','Course fee']), J(520,.3));
    /* future */
    add(D(25),'savings','Credit union','Automatic savings transfer', raised?700:500);
  }
  function randDay(a,b){ return a+Math.floor(Math.random()*(b-a+1)) }
  const budgets={ loans:5250, groceries:1750, utilities:1150, auto:700, insurance:900, transport:260, dining:620,
    toiletries:220, subscriptions:185, entertainment:580, parties:420, education:200, medical:220, upkeep:260, savings:600, taxes:80, income:0 };
  const streams=[ {id:uid(),label:'Salary (net take-home)',monthly:14456}, {id:uid(),label:'Side gigs (average)',monthly:850} ];
  return {tx, budgets, streams};
}
function loadSample(){
  state = freshState();
  const s = buildSample();
  state.tx = s.tx; state.budgets = s.budgets; state.streams = s.streams; state.meta.sample = true;
  store.save(); bootTimeDefaults(); renderAll(); toast('Sample data loaded — explore, then “Clear sample data” when ready');
}
function clearSample(btn){
  if(state.meta.sample){
    if(btn && !btn.dataset.armed){ btn.dataset.armed='1'; btn.textContent='Click again to confirm'; setTimeout(()=>{btn.dataset.armed='';btn.textContent='🧹 Clear sample data'},2600); return }
    state.tx=[]; state.budgets={}; state.streams=[]; state.meta.sample=false; store.save(); bootTimeDefaults(); renderAll(); toast('Sample data cleared — add your own entries');
  }
}
function resetAll(btn){
  if(btn && !btn.dataset.armed){ btn.dataset.armed='1'; btn.textContent='⚠️ Click again to erase everything'; setTimeout(()=>{btn.dataset.armed='';btn.textContent='⚠️ Reset everything'},2800); return }
  state=freshState(); store.save(); closeMenu(); bootTimeDefaults(); renderAll(); toast('Everything reset');
}

