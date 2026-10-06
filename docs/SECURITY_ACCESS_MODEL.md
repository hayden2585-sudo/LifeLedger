# LifeLedger Security & Access Model

Status: PARTIALLY INTEGRATED — local account, Guest mode, Admin step-up, encrypted private-record envelope, whole-ledger encrypted local storage and encrypted backup/restore implemented; richer roles and recovery controls remain pending
Version: SEC-FOUNDATION-v0.2

## Purpose

LifeLedger should remain approachable for ordinary household use while reducing casual exposure of sensitive personal and financial information.

The security model is intentionally layered rather than vault-first:

```text
Guest
  ↓
Local account login
  ↓
Normal view
  ↓
Protected data remains masked
  ↓
Admin unlock / step-up passphrase
  ↓
Full protected view
```

No cloud identity is required. Accounts are local profiles on the device.

## Access levels

| Level | Intended user | Visibility | Sensitive actions |
|---|---|---|---|
| Guest | Demonstration / shared-device visitor | No household data; sample/help only | None |
| Normal | Household user | Ordinary budgeting, totals, categories, plans, projects; protected fields masked | Routine budgeting actions |
| Admin unlocked | Owner / explicitly authorized household admin | Full view of protected and restricted data | Security settings, protected-data edits, sensitive exports, destructive controls |

## Data classes

### Normal

Data required for ordinary budgeting and planning:

- transaction date
- category
- amount
- ordinary budget/actual totals
- non-sensitive project budget/actual metrics
- aggregate household cash-flow figures

Normal data should not reveal more personal context than necessary.

### Protected

Useful to the household but potentially exposing when displayed on a shared screen:

- household member names and roles
- employer/source labels
- detailed vendor/payee text where it reveals personal context
- transaction descriptions/notes
- income-source names
- project names and notes where sensitive
- detailed insurance or benefit descriptions
- identifiable attribution between a person and a transaction

Protected data is stored in an authenticated encrypted envelope once the user enables protection.

### Restricted

High-value personal information that should require explicit admin step-up authentication:

- bank account numbers
- tax identifiers
- government identifiers
- policy/reference numbers
- credentials or access secrets
- recovery codes
- other user-designated high-value secrets

Restricted data should be minimized. The preferred protection is not storing a secret that the app does not actually need.

## Authentication model

### Local account

The normal account credential is a local password/passphrase. It is never stored in plaintext.

Stored verifier record:

```json
{
  "algorithm": "PBKDF2-HMAC-SHA256",
  "iterations": 600000,
  "salt": "base64",
  "verifier": "base64"
}
```

The exact work factor is subject to benchmarking on the target Windows, macOS, Android and browser environments before release.

### Admin unlock

Admin uses a separate passphrase. The passphrase is never persisted. The admin-derived key decrypts the protected-data envelope. A successful admin unlock is a session capability, not a permanent setting.

Recommended default auto-lock: 15 minutes, user adjustable.

### Whole-ledger storage key

The normal login passphrase also derives a separate AES-256-GCM key for the complete application state. The per-install ledger key salt is stored only in the public access header, never as the key itself. At boot, an encrypted ledger is represented only by its access header until the user successfully signs in.

A successful login decrypts the ledger into application memory for the session. Returning to Guest clears the decrypted ledger state and retains only the public access header needed to sign in again.

## Protected-data envelope

Protected private records remain separately authenticated/encrypted, and the normal account now also encrypts the complete application state at rest. The encrypted browser-storage record exposes only a small access header; the financial ledger itself remains inside AES-GCM ciphertext.

Initial interoperable target:

- AES-256-GCM
- random 96-bit IV per encryption operation
- authenticated context / AAD containing the envelope version and purpose
- key derived from the admin passphrase through PBKDF2-HMAC-SHA256 for the first browser-compatible implementation

The envelope must contain algorithm/KDF/version metadata so future migration is possible.

No derived key or admin passphrase is persisted.

## Guest mode

Guest mode must not merely blur or visually hide existing household data. The protected and normal household dataset must not be rendered to Guest at all.

Guest can see:

- empty setup
- documentation/help
- deliberately synthetic sample data

## Export rules

Normal export of ordinary budgeting data can remain available to authenticated normal users.

Exports containing Protected or Restricted information require Admin unlock and must be labelled clearly as sensitive.

Encrypted backup is now the portable migration/backup workflow. It is independently encrypted with the normal passphrase and can be restored into a fresh profile. Plain JSON/CSV export remains an explicit, clearly warned interoperability option and is not encrypted.

## Migration of existing 1.4.x saves

Legacy plaintext saves are still accepted for backward compatibility. On a successful first account setup/sign-in, the complete legacy state is serialized and written as an encrypted whole-ledger record. The plaintext browser-storage value is replaced only after encryption and local write succeed.

Current migration sequence:

1. Detect legacy plaintext save.
2. Create or verify the local account and admin credentials.
3. Derive the whole-ledger AES-GCM key from the normal login passphrase.
4. Encrypt the complete application state, including legacy household, transaction, project and settings data.
5. Write the encrypted record transactionally and confirm the local write.
6. Keep the encrypted record's access header available for future login; do not retain a plaintext ledger copy in browser storage.

The current migration is therefore whole-ledger rather than field-by-field redaction. A failed encrypted write leaves the in-memory legacy state intact and reports the failure rather than claiming success.

## Threat model boundary

This layer primarily addresses:

- casual viewing on a shared computer
- another browser profile/user opening the ledger
- shoulder-surfing / exposed screen contents
- accidental exposure through normal application views
- plaintext protected fields sitting in browser storage
- accidental export of sensitive information

It does not claim to defeat a fully compromised operating system, malware with access to the running process, or an attacker who already controls the user's unlocked session.

## Non-goals for this phase

- cloud accounts
- mandatory online authentication
- bank aggregation
- remote synchronization
- enterprise identity management
- forcing an encryption prompt for every ordinary budgeting action

## Release gate

Security work is not considered complete until all of the following have independent tests:

- Guest cannot see household data.
- Normal view masks Protected/Restricted fields.
- Admin unlock reveals the intended fields only.
- Raw browser storage contains no plaintext Protected/Restricted payload.
- Wrong admin passphrase cannot decrypt.
- Ciphertext tampering is rejected.
- Password verifiers are salted and non-reversible.
- Protected-data export requires Admin unlock.
- Legacy plaintext migration is transactional and recoverable.
- Locking clears decrypted protected data from application memory as far as the runtime permits.
- Encrypted backup can be restored into a fresh profile and reconciles with the source totals.
