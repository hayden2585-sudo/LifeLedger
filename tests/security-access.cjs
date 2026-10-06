/* LifeLedger security access integration test.
   Uses synthetic data only; no user ledger is touched. */
const fs=require('fs');
const {webcrypto}=require('node:crypto');
const {TextEncoder,TextDecoder}=require('node:util');
const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync('web/lifeledger.html','utf8');
function makeDom(seed){
  const errors=[],vc=new VirtualConsole();
  vc.on('jsdomError',e=>{if(!/Not implemented/i.test(e.message))errors.push(e.message)});
  vc.on('error',(...a)=>errors.push('console.error: '+a.join(' ')));
  const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://localhost/',virtualConsole:vc,pretendToBeVisual:true,
    beforeParse(win){
      Object.defineProperty(win,'crypto',{value:webcrypto,configurable:true});
      Object.defineProperty(win,'TextEncoder',{value:TextEncoder,configurable:true});
      Object.defineProperty(win,'TextDecoder',{value:TextDecoder,configurable:true});
      if(seed)win.localStorage.setItem('lifeledger.v1',seed);
    }});
  dom.errors=errors;return dom;
}
let failures=0;const assert=(n,c,d='')=>{console.log((c?'PASS':'FAIL')+' - '+n+(d?': '+d:''));if(!c)failures++};
(async()=>{
  const d1=makeDom(),w1=d1.window,d=d1.window.document;
  assert('fresh install starts Guest with access gate',w1.LL_SECURITY.securitySession.mode==='guest'&&!!d.getElementById('securityModal'));
  assert('Guest renders no household navigation',d.querySelector('nav#tabs').style.display==='none'&&d.querySelector('main').style.display==='none');

  d.getElementById('securityModal').querySelector('button').click();
  d.getElementById('secName').value='Security Test User';
  d.getElementById('secPass').value='normal-pass-2026';
  d.getElementById('secPass2').value='normal-pass-2026';
  d.getElementById('secAdmin').value='admin-passphrase-2026';
  d.getElementById('secAdmin2').value='admin-passphrase-2026';
  await w1.securityCreateAccount();
  assert('account creation enables local authentication',w1.LL_SECURITY.securitySession.mode==='normal'&&w1.securityEnabled());

  w1.LL.state.tx.push({id:'secret-ledger-test',date:'2026-10-06',cat:'food',sub:'',desc:'SECURE-LEDGER-SECRET-ROW',amt:123.45,src:'synthetic',ded:false});
  await w1.LL.store.save();
  let saved=d.defaultView.localStorage.getItem('lifeledger.v1');
  let persisted=JSON.parse(saved);
  assert('local storage now contains an encrypted whole-ledger record',persisted.format==='LifeLedgerEncryptedState'&&!!persisted.ledger?.ciphertext);
  assert('whole-ledger ciphertext does not expose a synthetic ledger secret',!saved.includes('SECURE-LEDGER-SECRET-ROW')&&!saved.includes('123.45'));
  assert('account verifier has no plaintext login/admin passphrases',!saved.includes('normal-pass-2026')&&!saved.includes('admin-passphrase-2026'));

  w1.showView('household');
  assert('Normal view keeps private details masked',/Admin unlock required/.test(d.getElementById('v-household').textContent));
  w1.securityShowAdminUnlock();
  d.getElementById('secAdminPass').value='admin-passphrase-2026';
  await w1.securityAdminUnlock();
  d.getElementById('secEmployer').value='Top Secret Employer';
  d.getElementById('secBank').value='9876543210';
  d.getElementById('secTax').value='TAX-TEST-2044';
  d.getElementById('secPolicy').value='POLICY-TEST-771';
  d.getElementById('secPrivateNotes').value='Private household testing note';
  await w1.securitySavePrivateDetails();
  saved=d.defaultView.localStorage.getItem('lifeledger.v1');persisted=JSON.parse(saved);
  assert('private details remain inside the encrypted ledger payload',!saved.includes('Top Secret Employer')&&!saved.includes('9876543210'));
  assert('admin memory reveals private details only while unlocked',w1.LL_SECURITY.securitySession.protectedData.employerName==='Top Secret Employer');

  w1.LL_SECURITY.securitySession.lockAdmin();w1.LL_SECURITY.securitySession.mode='normal';w1.securitySetAppVisibility();w1.renderAll();
  assert('Admin lock remasks private details',!d.getElementById('v-household').textContent.includes('Top Secret Employer'));

  const backup=await w1.LL_SECURE_STORAGE.securityMakeEncryptedBackup('normal-pass-2026');
  assert('encrypted backup is portable ciphertext',backup.format==='LifeLedgerEncryptedBackup'&&!!backup.ledger?.ciphertext&&!JSON.stringify(backup).includes('SECURE-LEDGER-SECRET-ROW')&&!JSON.stringify(backup).includes('Top Secret Employer'));

  const d2=makeDom(saved),w2=d2.window,doc2=w2.document;
  assert('encrypted reload opens locked to Guest',w2.LL_SECURITY.securitySession.mode==='guest'&&/Sign in/.test(doc2.getElementById('securityModal').textContent));
  doc2.getElementById('secLoginPass').value='normal-pass-2026';
  await w2.securityLogin();
  assert('correct login decrypts the whole ledger',w2.LL_SECURITY.securitySession.mode==='normal'&&w2.LL.state.tx.some(t=>t.desc==='SECURE-LEDGER-SECRET-ROW'));
  w2.showView('household');
  assert('private values remain masked after normal login',!doc2.getElementById('v-household').textContent.includes('Top Secret Employer'));
  w2.securityShowAdminUnlock();doc2.getElementById('secAdminPass').value='admin-passphrase-2026';await w2.securityAdminUnlock();
  assert('Admin can decrypt the protected private envelope after reload',w2.LL_SECURITY.securitySession.protectedData.employerName==='Top Secret Employer');

  const d3=makeDom(),w3=d3.window;
  await w3.LL_SECURE_STORAGE.securityRestoreEncryptedBackup(backup,'normal-pass-2026');
  assert('encrypted backup restores into a fresh install',w3.LL_SECURITY.securitySession.mode==='normal'&&w3.securityEnabled()&&w3.LL.state.tx.some(t=>t.desc==='SECURE-LEDGER-SECRET-ROW'));
  const restored=w3.localStorage.getItem('lifeledger.v1');
  assert('restored local storage is encrypted at rest',JSON.parse(restored).format==='LifeLedgerEncryptedState'&&!restored.includes('SECURE-LEDGER-SECRET-ROW'));

  w2.securityEnterGuest();
  assert('logout clears decrypted ledger memory and hides UI',w2.LL_SECURITY.securitySession.mode==='guest'&&w2.LL.state.tx.length===0&&doc2.querySelector('nav#tabs').style.display==='none');

  /* Explicit legacy 1.4.x migration: plaintext input becomes encrypted local storage
     only after account setup succeeds; no synthetic secret survives in the raw record. */
  const legacy={
    settings:{currency:'TTD',symbol:'TT$'},streams:[],budgets:{},household:{members:[]},projects:[],
    tx:[{id:'legacy-secret-1',date:'2026-10-01',cat:'food',sub:'',desc:'LEGACY-SENSITIVE-ENTRY',amt:444.55,src:'legacy',ded:false}],
    meta:{created:1,sample:false,init:true,name:'Legacy Test Ledger'}
  };
  const ld=makeDom(JSON.stringify(legacy)),lw=ld.window,ldoc=ld.window.document;
  ldoc.getElementById('securityModal').querySelector('button').click();
  ldoc.getElementById('secName').value='Legacy Migration User';
  ldoc.getElementById('secPass').value='legacy-normal-2026';
  ldoc.getElementById('secPass2').value='legacy-normal-2026';
  ldoc.getElementById('secAdmin').value='legacy-admin-2026';
  ldoc.getElementById('secAdmin2').value='legacy-admin-2026';
  await lw.securityCreateAccount();
  const legacyRaw=lw.localStorage.getItem('lifeledger.v1');
  assert('1.5 migration converts legacy plaintext storage to encrypted storage',JSON.parse(legacyRaw).format==='LifeLedgerEncryptedState');
  assert('1.5 migration removes legacy plaintext ledger content from local storage',!legacyRaw.includes('LEGACY-SENSITIVE-ENTRY')&&!legacyRaw.includes('444.55'));
  assert('1.5 migrated ledger remains readable after the new account is established',lw.LL.state.tx.some(t=>t.desc==='LEGACY-SENSITIVE-ENTRY'));

  /* Failed encrypted write must not replace the last known-good ciphertext. */
  const saveProto=Object.getPrototypeOf(lw.localStorage),realSet=saveProto.setItem,goodRaw=legacyRaw;
  saveProto.setItem=function(){throw new Error('simulated encrypted-storage write failure')};
  lw.LL.state.tx.push({id:'should-not-persist',date:'2026-10-06',cat:'food',sub:'',desc:'FAILED-WRITE-SHOULD-NOT-APPEAR',amt:1,src:'synthetic',ded:false});
  await lw.LL.store.save();
  assert('1.5 failed encrypted save is reported honestly',lw.LL.store.lastSaveOk===false);
  saveProto.setItem=realSet;
  assert('1.5 failed encrypted save preserves the last good ciphertext',lw.localStorage.getItem('lifeledger.v1')===goodRaw);

  assert('no runtime errors in the access integration run',d1.errors.length===0&&d2.errors.length===0&&d3.errors.length===0&&ld.errors.length===0);
  console.log('\n'+(failures?'FAILURES: '+failures:'ALL SECURITY ACCESS TESTS PASSED'));
  process.exit(failures?1:0);
})().catch(e=>{console.error(e.stack);process.exit(1)});
