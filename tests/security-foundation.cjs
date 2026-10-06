/* LifeLedger security foundation tests — crypto primitives only.
   This suite deliberately does not mutate or import a user's real ledger. */
const fs=require('fs');
const {webcrypto}=require('node:crypto');
global.crypto=webcrypto;
global.btoa=s=>Buffer.from(s,'binary').toString('base64');
global.atob=s=>Buffer.from(s,'base64').toString('binary');
const src=fs.readFileSync('src/js/17-security.js','utf8');
eval(src);
const S=global.LL_SECURITY;
let failures=0;
const assert=(name,c)=>{console.log((c?'PASS':'FAIL')+' - '+name);if(!c)failures++};
(async()=>{
  const v1=await S.securityVerifier('correct horse battery staple');
  const v2=await S.securityVerifier('correct horse battery staple');
  assert('verifier uses the declared password KDF',v1.algorithm==='PBKDF2-HMAC-SHA256' && v1.iterations===600000);
  assert('verifier never stores the password',!Object.values(v1).includes('correct horse battery staple'));
  assert('each verifier gets a fresh salt',v1.salt!==v2.salt && v1.verifier!==v2.verifier);
  assert('correct password verifies',await S.securityVerify('correct horse battery staple',v1));
  assert('wrong password does not verify',!(await S.securityVerify('wrong password',v1)));

  const payload={members:[{name:'Daniel Maharaj'}],bank:{account:'123456789'},notes:'private family record'};
  const pass='admin-passphrase-example-2026';
  const env=await S.securityEncryptJson(payload,pass,'protected-data');
  const recovered=await S.securityDecryptJson(env,pass,'protected-data');
  assert('encrypted envelope declares authenticated AES-GCM storage',env.cipher==='AES-GCM' && env.iv && env.salt && env.ciphertext);
  assert('encrypted envelope contains no plaintext protected fields',!JSON.stringify(env).includes('Daniel Maharaj') && !JSON.stringify(env).includes('123456789'));
  assert('protected payload decrypts exactly',JSON.stringify(recovered)===JSON.stringify(payload));
  assert('wrong admin passphrase cannot decrypt',await S.securityDecryptJson(env,'wrong-passphrase','protected-data').then(()=>false).catch(()=>true));

  const tampered={...env,ciphertext:env.ciphertext.slice(0,-2)+'AA'};
  assert('ciphertext tampering is rejected',await S.securityDecryptJson(tampered,pass,'protected-data').then(()=>false).catch(()=>true));
  assert('guest/normal/admin access levels are explicit',S.SECURITY.modes.guest==='guest'&&S.SECURITY.modes.normal==='normal'&&S.SECURITY.modes.admin==='admin');
  assert('restricted data remains distinct from protected data',S.securityClassification('bankAccountNumber')==='restricted'&&S.securityClassification('transactionDescription')==='protected');
  assert('restricted masking is stronger than ordinary masking',S.securityMask('123456789','restricted')==='••••••'&&S.securityMask('Daniel','protected').startsWith('D'));
  assert('security session starts locked to guest',S.securitySession.mode==='guest'&&S.securitySession.adminUnlocked===false);
  console.log('\n'+(failures?'FAILURES: '+failures:'ALL SECURITY FOUNDATION TESTS PASSED'));
  process.exit(failures?1:0);
})().catch(e=>{console.error(e.stack);process.exit(1)});
