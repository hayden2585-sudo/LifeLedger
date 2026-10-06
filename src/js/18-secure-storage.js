/* ================================================================
   WHOLE-LEDGER ENCRYPTED STORAGE
   The normal account key protects the complete application state at rest.
   The Admin layer in 17-security.js remains a second layer for private details.
   ================================================================ */
const SECURE_STORAGE=Object.freeze({
  format:'LifeLedgerEncryptedState',
  schemaVersion:1,
  aad:'ledger-state',
  backupFormat:'LifeLedgerEncryptedBackup'
});

function securityDeriveAesKey(secret,saltB64,iterations=SECURITY.iterations,usages=['encrypt','decrypt']){
  const c=securityWebCrypto(),enc=new TextEncoder();
  return c.subtle.importKey('raw',enc.encode(String(secret)),'PBKDF2',false,['deriveKey']).then(base=>
    c.subtle.deriveKey(
      {name:'PBKDF2',salt:securityUnb64(saltB64),iterations:+iterations||SECURITY.iterations,hash:'SHA-256'},
      base,{name:'AES-GCM',length:SECURITY.keyBits},false,usages
    )
  );
}

async function securityEncryptJsonWithKey(value,key,purpose=SECURE_STORAGE.aad){
  const c=securityWebCrypto(),enc=new TextEncoder(),iv=securityUnb64(securityRandomB64(SECURITY.ivBytes));
  const aad=enc.encode('LifeLedger:'+SECURITY.schemaVersion+':'+purpose);
  const cipher=await c.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,enc.encode(JSON.stringify(value)));
  return {schemaVersion:SECURITY.schemaVersion,cipher:SECURITY.cipher,iv:securityB64(iv),aad:purpose,ciphertext:securityB64(cipher)};
}

async function securityDecryptJsonWithKey(envelope,key,purpose=SECURE_STORAGE.aad){
  if(!envelope||envelope.schemaVersion!==SECURITY.schemaVersion||envelope.cipher!==SECURITY.cipher) throw new Error('Unsupported encrypted-state envelope');
  const c=securityWebCrypto(),enc=new TextEncoder();
  const aad=enc.encode('LifeLedger:'+SECURITY.schemaVersion+':'+purpose);
  const plain=await c.subtle.decrypt({name:'AES-GCM',iv:securityUnb64(envelope.iv),additionalData:aad},key,securityUnb64(envelope.ciphertext));
  return JSON.parse(new TextDecoder().decode(plain));
}

function securityPublicHeader(cfg){
  return {
    schemaVersion:1,
    enabled:!!cfg?.enabled,
    profiles:Array.isArray(cfg?.profiles)?cfg.profiles.map(p=>({id:p.id,displayName:p.displayName,role:p.role,verifier:p.verifier})):[],
    adminVerifier:cfg?.adminVerifier||null,
    ledgerKeySalt:cfg?.ledgerKeySalt||null,
    ledgerKeyIterations:+cfg?.ledgerKeyIterations||SECURITY.iterations,
    policy:cfg?.policy||{guestEnabled:true,autoLockMinutes:15},
    storageProtected:true,
    legacyProtectionPending:false
  };
}

function securityStorageHeaderToConfig(h){
  const base=securityNewConfig();
  return {
    ...base,
    schemaVersion:1,
    enabled:!!h?.enabled,
    profiles:Array.isArray(h?.profiles)?h.profiles:[],
    adminVerifier:h?.adminVerifier||null,
    ledgerKeySalt:h?.ledgerKeySalt||null,
    ledgerKeyIterations:+h?.ledgerKeyIterations||SECURITY.iterations,
    policy:h?.policy||base.policy,
    storageProtected:true,
    legacyProtectionPending:false,
    protectedEnvelope:null
  };
}

function securityStorageRead(raw){
  try{
    const p=typeof raw==='string'?JSON.parse(raw):raw;
    if(!p||p.format!==SECURE_STORAGE.format||p.schemaVersion!==SECURE_STORAGE.schemaVersion||!p.security||!p.ledger?.ciphertext) return null;
    if(p.ledger.aad!==SECURE_STORAGE.aad||!p.security.ledgerKeySalt) return null;
    return p;
  }catch(e){ return null }
}

async function securityStorageRecordFromState(snapshot,key){
  const cfg=snapshot.security||securityNewConfig();
  const ledger=await securityEncryptJsonWithKey(snapshot,key,SECURE_STORAGE.aad);
  return JSON.stringify({
    format:SECURE_STORAGE.format,
    schemaVersion:SECURE_STORAGE.schemaVersion,
    security:securityPublicHeader(cfg),
    ledger
  });
}

async function securityEstablishLedgerKey(passphrase,cfg){
  if(!cfg.ledgerKeySalt){
    cfg.ledgerKeySalt=securityRandomB64(SECURITY.saltBytes);
  }
  cfg.ledgerKeyIterations=+cfg.ledgerKeyIterations||SECURITY.iterations;
  return securityDeriveAesKey(passphrase,cfg.ledgerKeySalt,cfg.ledgerKeyIterations,['encrypt','decrypt']);
}

async function securityUnlockLedger(passphrase){
  const rec=store.lockedRecord||securityStorageRead(localStorage.getItem(LSKEY));
  if(!rec) throw new Error('No encrypted ledger is available');
  const key=await securityDeriveAesKey(passphrase,rec.security.ledgerKeySalt,rec.security.ledgerKeyIterations,['encrypt','decrypt']);
  const next=await securityDecryptJsonWithKey(rec.ledger,key,SECURE_STORAGE.aad);
  if(!next||!Array.isArray(next.tx)||!next.security?.enabled) throw new Error('Encrypted ledger payload is invalid');
  migrateWorkspace(next); migrateIncomeTypes(next);
  state=next;
  state.security.storageProtected=true;
  state.security.legacyProtectionPending=false;
  securitySession._ledgerKey=key;
  securitySession.accountId=securityPrimaryProfile()?.id||rec.security.profiles?.[0]?.id||null;
  securitySession.mode='normal';
  securitySession.lockAdmin();
  return true;
}

function securityClearDecryptedLedger(){
  const header=store.lockedRecord?.security||null;
  state=freshState();
  if(header) state.security=securityStorageHeaderToConfig(header);
  securitySession._ledgerKey=null;
  securitySession.accountId=null;
  securitySession.lockAdmin();
}

async function securityMakeEncryptedBackup(passphrase){
  const p=securityPrimaryProfile();
  if(!p||!(await securityVerify(passphrase,p.verifier))) throw new Error('Incorrect login passphrase');
  const payload=JSON.parse(JSON.stringify(state));
  const ledger=await securityEncryptJson(payload,passphrase,'encrypted-backup');
  return {format:SECURE_STORAGE.backupFormat,schemaVersion:1,createdAt:Date.now(),security:securityPublicHeader(state.security),ledger};
}

async function securityRestoreEncryptedBackup(payload,passphrase){
  if(!payload||payload.format!==SECURE_STORAGE.backupFormat||payload.schemaVersion!==1||!payload.ledger) throw new Error('Unsupported encrypted backup');
  const next=await securityDecryptJson(payload.ledger,passphrase,'encrypted-backup');
  if(!next||!Array.isArray(next.tx)||!next.security?.enabled||!Array.isArray(next.security.profiles)||!next.security.profiles.length) throw new Error('Backup payload is invalid');
  migrateWorkspace(next); migrateIncomeTypes(next);
  const oldState=state, oldKey=securitySession._ledgerKey, oldMode=securitySession.mode, oldAccount=securitySession.accountId;
  next.security.ledgerKeySalt=securityRandomB64(SECURITY.saltBytes);
  next.security.ledgerKeyIterations=SECURITY.iterations;
  next.security.storageProtected=true;
  next.security.legacyProtectionPending=false;
  const key=await securityDeriveAesKey(passphrase,next.security.ledgerKeySalt,next.security.ledgerKeyIterations,['encrypt','decrypt']);
  state=next; securitySession._ledgerKey=key; securitySession.mode='normal'; securitySession.accountId=next.security.profiles[0].id;
  const ok=await store.save();
  if(!ok){state=oldState;securitySession._ledgerKey=oldKey;securitySession.mode=oldMode;securitySession.accountId=oldAccount;throw new Error('Local encrypted save failed')}
  store.relock();
  return true;
}

globalThis.LL_SECURE_STORAGE={SECURE_STORAGE,securityDeriveAesKey,securityEncryptJsonWithKey,securityDecryptJsonWithKey,securityPublicHeader,securityStorageRead,securityStorageRecordFromState,securityEstablishLedgerKey,securityUnlockLedger,securityClearDecryptedLedger,securityMakeEncryptedBackup,securityRestoreEncryptedBackup};
