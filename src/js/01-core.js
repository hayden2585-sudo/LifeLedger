"use strict";
/* ================================================================
   LifeLedger — personal expense & income spreadsheet
   Single-file app: no external dependencies. Optional OCR lazy-loads
   tesseract.js from a CDN only when explicitly enabled by the user.
   ================================================================ */

/* ---------------- categories & taxonomy ---------------- */
const GROUPS = {
  income:      {name:'Income',            color:'#15803d'},
  obligations: {name:'Obligations',       color:'#4f46e5'},
  essentials:  {name:'Essentials',        color:'#0284c7'},
  lifestyle:   {name:'Lifestyle',         color:'#d97706'},
  occasions:   {name:'Special events, religion & charity', color:'#db2777'},
  future:      {name:'Future (savings)',  color:'#7c3aed'}
};
const CATS = [
  {id:'income',      name:'Income',                       grp:'income',      icon:'💰', guide:null},
  {id:'taxes',       name:'Taxes (out-of-pocket)',        grp:'obligations', icon:'🧾', guide:1},
  {id:'loans',       name:'Loan payments (mortgage/car)', grp:'obligations', icon:'🏦', guide:null},
  {id:'medical',     name:'Medical & health',             grp:'essentials',  icon:'🩺', guide:5},
  {id:'groceries',   name:'Groceries',                    grp:'essentials',  icon:'🛒', guide:14},
  {id:'auto',        name:'Auto (fuel, licensing)',       grp:'essentials',  icon:'🚗', guide:6},
  {id:'insurance',   name:'Insurance',                    grp:'essentials',  icon:'🛡️', guide:6},
  {id:'transport',   name:'Transport (maxi, taxi, rides)',grp:'essentials',  icon:'🚌', guide:5},
  {id:'utilities',   name:'Utilities (light, water, net)',grp:'essentials',  icon:'💡', guide:8},
  {id:'upkeep',      name:'Upkeep & repairs',             grp:'essentials',  icon:'🔧', guide:3},
  {id:'toiletries',  name:'Toiletries & personal care',   grp:'essentials',  icon:'🧼', guide:2},
  {id:'dining',      name:'Dining (restaurants & takeout)',grp:'lifestyle',  icon:'🍽️', guide:7},
  {id:'entertainment',name:'Entertainment',               grp:'lifestyle',   icon:'🎬', guide:4},
  {id:'education',   name:'Education',                    grp:'lifestyle',   icon:'📚', guide:3},
  {id:'subscriptions',name:'Subscriptions',               grp:'lifestyle',   icon:'📺', guide:2},
  {id:'parties',     name:'Parties & outings',            grp:'lifestyle',   icon:'🎉', guide:4},
  {id:'events',      name:'Special events (Carnival, Christmas)',grp:'occasions', icon:'🎪', guide:null},
  {id:'charity',     name:'Religion & charity (tithing, giving)', grp:'occasions', icon:'🙏', guide:null},
  {id:'savings',     name:'Savings (pay yourself)',       grp:'future',      icon:'🐖', guide:null},
  {id:'other',       name:'Other / unclassified',         grp:'lifestyle',   icon:'🏷️', guide:3}
];
const CAT = Object.fromEntries(CATS.map(c=>[c.id,c]));
const EXPENSE_CATS = CATS.filter(c=>c.id!=='income');

const CURRENCIES = [['TTD','TT$'],['USD','US$'],['EUR','€'],['GBP','£'],['CAD','CA$'],['XCD','EC$'],['JMD','J$'],['BBD','Bds$'],['INR','₹'],['NGN','₦'],['ZAR','R'],['AUD','A$'],['GHS','GH₵'],['GYD','G$'],['SRD','SR$']];

/* ---------------- income taxonomy ----------------
   Income remains a single cashflow category for aggregation, but each inflow
   can carry a more precise type so recurring pay is not confused with arrears,
   windfalls, capital receipts, benefits, investment income, or rent. */
const INCOME_TYPES = [
  {id:'salary',         name:'Salary / wages',          icon:'💼', kind:'recurring'},
  {id:'side_hustle',    name:'Side hustles / gigs',    icon:'🛠️', kind:'recurring'},
  {id:'salary_arrears', name:'Salary arrears / back pay', icon:'↩️', kind:'irregular'},
  {id:'overtime_extra', name:'Overtime / extra duties', icon:'⏱️', kind:'irregular'},
  {id:'dividends',     name:'Dividends',               icon:'📈', kind:'investment'},
  {id:'asset_sale',    name:'Sale of assets',          icon:'🏷️', kind:'capital'},
  {id:'gratuity',      name:'Gratuity',                icon:'🎖️', kind:'benefit'},
  {id:'welfare',       name:'Welfare benefits',        icon:'🤝', kind:'benefit'},
  {id:'rent',          name:'Rental income',           icon:'🏠', kind:'property'},
  {id:'gift_remittance',name:'Gifts / remittances',    icon:'🎁', kind:'transfer'},
  {id:'other_income',  name:'Other income',            icon:'💵', kind:'other'}
];
const INCOME_TYPE = Object.fromEntries(INCOME_TYPES.map(x=>[x.id,x]));

/* ---------------- contextual cashflow metadata ----------------
   These fields describe why a transaction may look unusual without treating
   unusual employment, seasonality, legal gaming, rotating savings, or family
   support as evidence of wrongdoing. Context is evidence about a cashflow,
   not a verdict about the person who entered it. */
const EMPLOYMENT_CONTEXT = [
  {id:'standard',name:'Standard employment'},
  {id:'multiple_jobs',name:'Multiple jobs / income sources'},
  {id:'seasonal_work',name:'Seasonal / temporary work'},
  {id:'irregular_work',name:'Irregular / cash-heavy work'},
  {id:'self_employed',name:'Self-employed / own business'},
  {id:'temporary_zero_income',name:'Temporary zero-income period'},
  {id:'unknown',name:'Not specified'}
];
const SEASONAL_CONTEXT = [
  {id:'christmas_holiday',name:'Christmas / holiday period'},
  {id:'carnival',name:'Carnival period'},
  {id:'school_term',name:'School-term cycle'},
  {id:'agriculture_harvest',name:'Agriculture / harvest cycle'},
  {id:'tourism',name:'Tourism / travel cycle'},
  {id:'annual_payment',name:'Annual / periodic payment'},
  {id:'none',name:'No known seasonal context'},
  {id:'unknown',name:'Not specified'}
];
const TRANSFER_PURPOSES = [
  {id:'household_support',name:'Household support'},
  {id:'child_education',name:'Child education / school'},
  {id:'medical_support',name:'Medical / health support'},
  {id:'housing_living',name:'Housing / living expenses'},
  {id:'family_assistance',name:'Family assistance'},
  {id:'personal_transfer',name:'Personal transfer'},
  {id:'business_capital',name:'Business capital'},
  {id:'business_operating',name:'Business operating expense'},
  {id:'customer_payment',name:'Customer / client payment'},
  {id:'investment_capital',name:'Investment / capital transfer'},
  {id:'unknown',name:'Unknown / unclassified'}
];
const CASHFLOW_CONTEXT = [
  {id:'ordinary',name:'Ordinary cashflow'},
  {id:'legal_gaming',name:'Legal gaming / prize income'},
  {id:'sou_sou_contribution',name:'Sou-sou contribution'},
  {id:'sou_sou_payout',name:'Sou-sou payout'},
  {id:'foreign_remittance',name:'Foreign remittance / transfer'},
  {id:'unknown',name:'Not specified'}
];
const PROVENANCE_STATES = [
  {id:'reported',name:'Reported'},
  {id:'supported',name:'Supported'},
  {id:'calculated',name:'Calculated'},
  {id:'inferred',name:'Inferred'},
  {id:'unverified',name:'Unverified'}
];
const pickContextLabel=(list,id)=>((list||[]).find(x=>x.id===id)||{name:'Not specified'}).name;
function inferCashflowContext(text){
  const s=' '+String(text||'').toLowerCase()+' ';
  if(/sou[- ]?sou|sousou|rotating savings|rotating savings club/i.test(s)) return /payout|draw|received|collection/i.test(s)?'sou_sou_payout':'sou_sou_contribution';
  if(/nlcb|play\s*whe|lotto|lottery|gaming\s*prize|prize\s*money|winning\s*ticket/i.test(s)) return 'legal_gaming';
  if(/remittance|money\s+from\s+(family|relative|relatives|overseas)|support\s+from\s+abroad|overseas\s+transfer|international\s+transfer/i.test(s)) return 'foreign_remittance';
  return 'ordinary';
}
function inferTransferPurpose(text){
  const s=' '+String(text||'').toLowerCase()+' ';
  if(/school|tuition|fees|textbook|uniform|child|children|education/i.test(s)) return 'child_education';
  if(/medical|doctor|hospital|clinic|medicine|pharmacy/i.test(s)) return 'medical_support';
  if(/business|stock|inventory|equipment|shop|store|capital/i.test(s)) return /capital|start|launch|fund/i.test(s)?'business_capital':'business_operating';
  if(/rent|mortgage|house|home|living|household|grocery|food/i.test(s)) return 'housing_living';
  if(/family|relative|parent|sibling|support/i.test(s)) return 'family_assistance';
  return 'unknown';
}
function contextualFlags(t){
  const flags=[]; if(!t||typeof t!=='object') return flags;
  const text=(t.sub||'')+' '+(t.desc||'')+' '+(t.vendor||'');
  const ctx=t.cashflowContext||inferCashflowContext(text);
  if(ctx==='legal_gaming') flags.push({id:'legal-gaming-context',severity:'info',message:'Gaming/prize cashflow — verify the source and retain supporting records if consequential.'});
  if(ctx==='sou_sou_contribution') flags.push({id:'sou-sou-contribution',severity:'info',message:'Sou-sou contribution — treat as rotating savings activity, not ordinary household spending.'});
  if(ctx==='sou_sou_payout') flags.push({id:'sou-sou-payout',severity:'info',message:'Sou-sou payout — do not automatically treat the payout as new household income.'});
  if(ctx==='foreign_remittance' && (t.transferPurpose||'unknown')==='unknown') flags.push({id:'remittance-purpose',severity:'review',message:'Foreign transfer purpose is unclassified; distinguish household/education support from business activity.'});
  return flags;
}

const INCOME_STREAM_TYPES = INCOME_TYPES.filter(x=>['recurring','investment','property'].includes(x.kind));
function incomeTypeOptions(sel, streamOnly=false){
  const xs=streamOnly?INCOME_STREAM_TYPES:INCOME_TYPES;
  return xs.map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${x.icon} ${x.name}</option>`).join('');
}
function incomeTypeLabel(id){ const x=INCOME_TYPE[id]||INCOME_TYPE.other_income; return x.name }
function incomeTypeBadge(id){ const x=INCOME_TYPE[id]||INCOME_TYPE.other_income; return `${x.icon} ${x.name}` }
function guessIncomeType(text){
  const s=' '+String(text||'').toLowerCase()+' ';
  if(/salary\s*arrears|salary\s*back\s*pay|back\s*pay|arrears|retroactive pay/i.test(s)) return 'salary_arrears';
  if(/overtime|extra\s+dut(?:y|ies)|additional\s+dut(?:y|ies)|extra\s+duties|honorarium/i.test(s)) return 'overtime_extra';
  if(/dividend|shareholder\s+payment|share\s+dividend/i.test(s)) return 'dividends';
  if(/sale\s+of\s+(an?\s+)?asset|asset\s+sale|sold\s+(my\s+)?(car|vehicle|property|house|land|equipment)|sale\s+proceeds|capital\s+receipt/i.test(s)) return 'asset_sale';
  if(/gratuity|severance\s+gratuity|retirement\s+gratuity/i.test(s)) return 'gratuity';
  if(/welfare\s+(benefit|payment)|welfare|public\s+assistance|social\s+benefit|employee\s+welfare/i.test(s)) return 'welfare';
  if(/rental\s+income|rent\s+received|rent\s+from\s+(tenant|property)|tenant\s+payment|lease\s+payment/i.test(s)) return 'rent';
  if(/gift|remittance|money\s+sent\s+from\s+abroad|money\s+from\s+(family|relative|relatives|overseas)|family\s+support|support\s+from\s+abroad|overseas\s+transfer|international\s+transfer/i.test(s)) return 'gift_remittance';
  if(/side\s+hustle|side\s+gig|freelance|gig\s+income|consulting\s+fee|market\s+stall|tutoring|contract\s+work/i.test(s)) return 'side_hustle';
  if(/salary|wages|payroll|pay\s+advice|pay\s+slip|paycheck|net\s+pay|monthly\s+pay/i.test(s)) return 'salary';
  return null;
}

/* vendor / keyword hints used by the auto-classifier */
const VENDOR_HINTS = {
  events:     ['carnival','fete','mas band','pretty mas','mas costume','costume','jouvert',"j'ouvert",'monday wear','christmas','xmas','parang','black friday','holiday shopping','old year','eid','divali','diwali','phagwa','easter','hamper','toy drive','yearly event'],
  charity:    ['church','mosque','temple','mandir','charity','charitable','donation','donate','tithe','tithing','offering','alms','zakat','zakaat','red cross','unicef','gofundme','love offering','orphanage','home for aged','foundation gift'],
  groceries:  ['massy','price smart','pricesmart','tru valu','truvalu','supermarket','grocer','food basket','jta','phoenix park','cost u less','costco'],
  utilities:  ['t&tec','ttec','electric','wasa','water bill','water and sewerage','flow','bmobile','b mobile','blink','amplia','digicel','internet','broadband','cable'],
  auto:       ['unipet','np ','n.p.','fuel','gas station','shell','petrotrin','petrol','premium gas','super gas','car wash','vehicle permit','licensing'],
  dining:     ['kfc','subway','royal castle','pizza hut','dominos','burger king','prestige holdings','restaurant','takeout','take-out','dine','roti','doubles','cafe','coffee','starbucks','bar & grill','grill','sushi','chinese food','lunch'],
  medical:    ['pharmacy','drug store','drugstore','doctor','clinic','dentist','dental','hospital','optician','medical lab','lab','health centre','health center','pediatrician','physio'],
  insurance:  ['sagicor','guardian life','guardian general','colonial fire','british american','motor insurance','home insurance','insurance premium','policy premium','assurance'],
  loans:      ['mortgage','car loan','auto loan','hire purchase','credit union','installment','instalment','loan payment','hpd','tt mortgages','rbc','scotiabank','republic bank','first citizens','bank loan','student loan'],
  taxes:      ['ird','inland revenue','b.i.r','bir','property tax','income tax payment','vat payment','driver permit','renewal fee','customs'],
  transport:  ['maxi','taxi','ptsc','bus fare','bolt','uber','ride','ferry','airbridge','air bridge','caribbean airlines','cal ','flight fare','port'],
  subscriptions:['netflix','spotify','disney','hulu','prime video','amazon prime','youtube premium','icloud','google one','dropbox','adobe','microsoft 365','office 365','apple one','crunchyroll','subscription'],
  entertainment:['movie towne','cinema','theatre','gym','fitness','concert','party cruise','game','bowling','karaoke','event ticket'],
  education:  ['school','uwi','utt','sbcs','college','university','tuition','bookstore','books','course','udemy','coursera','exam fee','stationery','uniform'],
  parties:    ['birthday','wedding','gift','party supplies','lime','outing','beach trip','picnic','all inclusive','all-inclusive','brunch','christening','farewell','decorations'],
  upkeep:     ['plumber','electrician','mason','carpenter','painter','handyman','repair','maintenance','mechanic','garage','tyre','tire','servicing','ac service','appliance','furniture fix','leak'],
  toiletries: ['toiletries','soap','shampoo','toothpaste','deodorant','cosmetics','skincare','perfume','tissue','detergent','cleaning supplies','personal care','razor','sanitary'],
  savings:    ['savings','transfer to savings','deposit','mutual fund','unit trust','utc','money market','investment','credit union shares']
};
const GENERIC_HINTS = [
  [/carnival|christmas|xmas|parang|eid|diwali|divali|phagwa|holiday shopp|old year night/i,'events'],
  [/tithe|tithing|zakat|donation|charit|church offering|alms/i,'charity'],
  [/grocer|supermarket|market/i,'groceries'],
  [/rent|mortgage|loan|hire purchase|installment|instalment/i,'loans'],
  [/insurance|policy|premium|insure/i,'insurance'],
  [/electric|water|internet|cable|broadband|phone bill|mobile plan|utilities/i,'utilities'],
  [/fuel|petrol|gas station|diesel/i,'auto'],
  [/tax|ird|bir|revenue/i,'taxes'],
  [/doctor|clinic|dental|pharmacy|medical|health|hospital/i,'medical'],
  [/restaurant|food|dine|lunch|dinner|snack|cafe|coffee|roti|pizza|burger/i,'dining'],
  [/netflix|spotify|stream|subscription|membership/i,'subscriptions'],
  [/school|course|class|book|tuition|education|exam/i,'education'],
  [/movie|cinema|game|entertainment|concert|fete|gym/i,'entertainment'],
  [/party|birthday|gift|wedding|lime|outing|event/i,'parties'],
  [/maxi|taxi|bus|uber|bolt|ride|flight|travel/i,'transport'],
  [/repair|fix|service|maintain|plumb|paint|mechanic/i,'upkeep'],
  [/toilet|soap|shampoo|cosmetic|personal care|hygiene/i,'toiletries'],
  [/saving|invest|deposit to savings/i,'savings']
];

