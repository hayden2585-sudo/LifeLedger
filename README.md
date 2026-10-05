# ▦ LifeLedger — Expense & Income Spreadsheet

Offline-first household finance app: **monthly/annual expense tracking, household budgeting, finite project budgets,
income mapping, funding projections, cost-of-living equations and a minimum-wage lens** — with data entry by
manual form, invoice/screenshot scan (optional OCR), email/text parsing and CSV import.

Runs everywhere from one source tree:

| Target | What you get | Where |
|---|---|---|
| **Web** | Single HTML file, zero dependencies, works offline from a double-click | `web/lifeledger.html` |
| **PWA** | Installable app with offline cache + home-screen icon (Android/desktop) | `dist-pwa/` |
| **Windows** | NSIS installer `.exe` + portable `.exe` (x64) | `desktop/` (Electron) |
| **macOS** | `.dmg` for Apple Silicon + Intel | `desktop/` (Electron) |
| **Linux** | `.AppImage` + `.deb` | `desktop/` (Electron) |
| **Android** | Native APK via Capacitor WebView shell | `android/` |

All data stays on-device (browser/app local storage). No server, no accounts, no tracking.

---

## 1 · Repository layout

```
lifeledger/
├── README.md                  ← you are here
├── LICENSE                    ← MIT
├── package.json               ← build/test scripts (Node 18+)
├── build.mjs                  ← bundler: src/ → web/, dist-pwa/, android/www, desktop/app
├── server.mjs                 ← zero-dependency dev server for the PWA build
├── src/                       ← ✏️ THE SOURCE CODE (edit here)
│   ├── index.html             ← app shell (dev mode loads the modules below)
│   ├── styles.css             ← all styling
│   └── js/
│       ├── 01-core.js         ← categories, groups, keyword classifier
│       ├── 02-state.js        ← storage, state, utilities, aggregations
│       ├── 03-sample.js       ← demo-data generator
│       ├── 04-charts.js       ← SVG chart helpers (donut/bars/lines/growth)
│       ├── 05-engine.js       ← tax inversion, minimum-wage lens, income map
│       ├── 06-view-dashboard.js … 12-view-ingest.js   ← core views
│       ├── 13-io.js           ← CSV/JSON export-import, menu, router
│       ├── 15-view-household.js ← household members + attribution
│       ├── 16-view-projects.js  ← finite projects + funding projections
│       └── 14-boot.js         ← startup + schema migration
├── web/lifeledger.html       ← built single-file app (open directly — no install)
├── pwa/
│   ├── manifest.webmanifest   ← PWA identity & icons
│   ├── service-worker.js      ← offline app-shell cache
│   └── icons/                 ← 192/512/maskable PNGs (generated, see tools/)
├── desktop/                   ← Windows · macOS · Linux (Electron + electron-builder)
│   ├── main.js                ← Electron shell (menu, window, external links)
│   ├── package.json           ← build config: NSIS/portable/dmg/AppImage/deb
│   ├── resources/icon.png     ← app icon
│   └── app/lifeledger.html    ← bundled payload (from `npm run build`)
├── android/                   ← Android APK (Capacitor)
│   ├── capacitor.config.json
│   ├── package.json
│   └── www/                   ← web assets (from `npm run build`)
├── tools/gen-icons.mjs        ← regenerates the PNG icon set (pure Node)
└── tests/                     ← jsdom suites (228 checks) · `npm test`
```

## 2 · Quick start (no installation)

Open **`web/lifeledger.html`** in any modern browser. That's the whole app.
It boots with sample data — clear it via **Data ▸ Clear sample data**, then add your own.

Rebuild after editing source (Node 18+):

```bash
node build.mjs            # web/lifeledger.html only
node build.mjs --all      # dist + PWA + android/www + desktop/app
```

## 3 · Install as a desktop app (Windows · macOS · Linux)

Requires [Node.js 18+](https://nodejs.org). One-time setup (~600 MB of dev tooling):

```bash
node build.mjs --desktop        # bundle the app into desktop/app/
cd desktop
npm install                     # electron + electron-builder
```

| Platform | Command | Output in `desktop/release/` |
|---|---|---|
| **Windows** | `npm run dist:win` | `LifeLedger Setup 1.1.0.exe` (installer) + `LifeLedger 1.1.0.exe` (portable) |
| **macOS** | `npm run dist:mac` | `LifeLedger-1.1.0-arm64.dmg` and `-x64.dmg` |
| **Linux** | `npm run dist:linux` | `.AppImage` + `.deb` |
| All at once | `npm run dist` | everything above |

To try it without building installers: `npm start` (runs the Electron window immediately).

**First-run permission notes (normal for unsigned free software):**
- *Windows:* SmartScreen may warn → **More info ▸ Run anyway**. Stop the warnings by code-signing with your own certificate.
- *macOS:* Gatekeeper blocks unsigned apps → right-click the app ▸ **Open** ▸ Open (once), or run `xattr -cr /Applications/LifeLedger.app`. Distribution outside your own machines requires an Apple Developer ID + notarization.
- *Linux:* `chmod +x LifeLedger-*.AppImage` then run; `.deb` installs via your package manager.

## 4 · Install on Android

### Option A — PWA (fastest, ~1 minute, no build tools)
The PWA build is a real installable app with its own icon and offline storage:

```bash
node build.mjs --pwa
node server.mjs 0.0.0.0 8080        # serve on your Wi-Fi LAN
```

1. Phone (same Wi-Fi) → Chrome → `http://<your-computer-ip>:8080`
   (find your IP with `ipconfig` on Windows / `ifconfig` on macOS).
2. Menu **⋮ ▸ Add to Home screen / Install app**.

For a proper internet-hosted install (HTTPS, works anywhere, not just LAN), upload the
**`dist-pwa/`** folder to any static host — GitHub Pages, Netlify, Cloudflare Pages all work.

### Option B — real APK (requires Android Studio + JDK 17)

```bash
node build.mjs --android     # prepare android/www
cd android
npm install
npx cap add android          # first time only — generates the native project
npx cap sync android         # after every app rebuild
npx cap open android         # opens Android Studio → Run ▶ to install on device/emulator
```

Debug APK lands in `android/android/app/build/outputs/apk/debug/app-debug.apk`.
For a signed Play-Store release: Android Studio ▸ *Build ▸ Generate Signed Bundle/APK*.

## 5 · Where your data lives (and backups)

| Platform | Storage | Backup |
|---|---|---|
| Browser (file/URL) | that browser's local storage for that origin | **Data ▸ Export JSON** |
| PWA | installed-app storage (survives offline) | **Data ▸ Export JSON** |
| Electron | Chromium profile storage (per user) | **Data ▸ Export JSON** |
| Android (Capacitor) | WebView local storage (per device) | **Data ▸ Export JSON** |

Because storage is per-origin/per-device, the JSON backup (Data ▸ Export/Import backup)
is the way to move data between devices. **In the in-app file preview here, storage does
not persist — export before closing.**

### Naming your ledger
A new install is named for you — from your household once contributors exist
("Hayden & Simone"), "Sample household ledger" while the demo data is loaded, or a
plain "My ledger" otherwise. The name appears in the browser tab, the header and your
export filenames (`boodoosingh-household-2026-backup-2026-10-05.json`). Rename it with
the ✎ field in the header; clearing the field reverts to the derived name. A custom
name is saved in your backup and is never overwritten by the automatic derivation.

### Encryption and privacy — stated plainly
**LifeLedger does not encrypt your data.** Entries are stored as readable text in the
browser's local storage, and exported JSON/CSV backups are plain, unprotected files.
There is no account, password or login, so there is **no logon step** at which anything
could be unlocked or verified. `Data ▸ Privacy & data` repeats this in-app, and it is
shown once on a new install.

What that means in practice:

- Anyone who can use this device or sign in to this computer account, anyone using this
  browser profile, and anyone you send a backup to **can read every figure**.
- On a shared, family or work computer, treat the ledger as legible to others.
- Protect it yourself: lock the device, use a dedicated browser profile for finances,
  and keep backups somewhere you control. For at-rest secrecy, put the backup inside an
  encrypted volume or password-protected archive — the app cannot do it for you.
- Clearing browser data, uninstalling, or **Data ▸ Reset everything** deletes the ledger
  permanently. Export a JSON backup first; nothing can recover it afterwards.

## 6 · Development & tests

```bash
npm install        # jsdom (dev-only)
npm test           # 228 jsdom checks against web/lifeledger.html
node tools/gen-icons.mjs   # regenerate icon PNGs after changing the logo logic
node server.mjs    # serve PWA at http://127.0.0.1:8080
```

- Dev mode: open `src/index.html` over `node server.mjs`-style HTTP (or any static server) —
  it loads the 14 unbundled modules for readable stack traces. Opening `src/index.html`
  directly from disk also works in most browsers.
- The bundler inlines CSS+JS back into one file; `build.mjs` output is verified
  lossless and the test suite runs against the **built** artifact, in strict mode.
- Runtime dependencies: **none**. The only network feature is optional OCR
  (tesseract.js, lazy-loaded only when you tick "Try OCR").

## 7 · Feature map

Dashboard (proactive alert panel with tab badges, KPIs, donut, 12-month bars, overages, data-health score) ·
Ledger (search/filter/edit + household/project attribution) ·
Annual Grid (17+2 categories × 12 months, live totals, editable budgets, drill-down, year-over-year comparison, data-health panel) ·
Budgets (guideline-based, over/under chips) · Household (multiple contributors, income attribution, member spending, **spending split chart**) ·
Projects (finite budgets, line items, priority/status lifecycle, **completion archive with frozen final figures and restore**, linked actuals, derived funding projection) ·
Income Map (tax inversion, needs ladder, cost-of-living equation, self-employed revenue targets, **minimum-wage lens**, income-type mix) ·
Plan & Advice (surplus → investment playbook; deficit → ranked saving strategies,
stress test, what-if cuts) · Add Data (manual, invoice/screenshot + OCR, email/text
parser, CSV import) · special events & religion/charity groups (zero by default) · income
subtypes for salary/wages, side hustles, salary arrears, overtime/extra duties, dividends,
sale of assets, gratuity, welfare benefits, rental income, and gifts/remittances (including
money sent from abroad).

**Status:** release 1.4.2 adds named ledgers and an honest privacy notice. 1.4.1 corrected the trailing-12 average denominator, makes the project budget field honest\nand stops non-monthly fixed costs being reported as overspending. 1.4.0 added the proactive alerts panel,\ndata health check, year-over-year comparison, household spending split, project archive lifecycle and the\nstorage-loss warning. See the changelog.

**Disclaimer:** educational tool — not financial, tax or investment advice.

## 8 · Universal application updates

GitHub is intended to become the canonical source and release store. The application source, tagged releases, checksums and CI build workflow are documented in `docs/UNIVERSAL_UPDATE_METHOD.md`; a GitHub Actions release template is staged in `.github/workflows/release.yml`.

The important separation is: **GitHub distributes application code; each device retains authority over its own financial data.** User backups, local storage and credentials are never part of the application repository.

## 9 · Changelog

**1.4.2** — named ledgers and an honest privacy notice
- **Your ledger now has a name.** Previously the workspace was anonymous: nothing
  identified whose figures you were looking at, every backup was `lifeledger-backup.json`,
  and there was no way to rename any of it. A new install is now named automatically from
  what the app already knows — the household ("Hayden & Simone"), "Sample household ledger"
  while the demo is loaded, or "My ledger" otherwise — and it is renameable from the ✎ field
  in the header. The name appears in the browser tab, the header, the sample-data banner and
  your export filenames (`hayden-simone-backup-2026-10-05.json`), travels inside the backup,
  and a name you set by hand is never overwritten by the automatic derivation. Clearing the
  field reverts to the derived name.
  - Existing installs keep their data and are **not** renamed: a save that predates this
    release is treated as already-custom, so the derivation can never overwrite it.
- **An honest privacy notice, because there was nothing before.** There is no encryption, no
  account and no login anywhere in LifeLedger, so there was also no "logon reminder" — and a
  reminder implying protection the app does not provide would be worse than silence. Instead:
  a notice on first run, plus a permanent **Data ▸ Privacy & data** entry, stating that data
  stays on the device, that it is **not encrypted**, that local storage and exported backups
  are readable text, who can read them, how to protect them yourself, and that clearing
  browser data or resetting deletes the ledger permanently. The README now says the same
  rather than leaving it implied.
  - Shown once on a genuinely new install; an existing save is not nagged with a notice it
    never saw. If storage is unavailable the storage-loss warning takes precedence, so two
    overlays never stack at startup.
- Regression coverage grew from 191 to 228 jsdom checks.

**1.4.1** — correctness fixes to the numbers every view reports
- **Trailing-12 averages no longer divide by a hard 12.** Averages are now divided by the months that
  actually contain entries, with the raw totals kept separately. For anyone whose records cover less than
  a year this was a serious error: with three months recorded, the app reported a **quarter** of the real
  monthly income — and every guideline budget, the income-map ladder, the savings target, the
  minimum-wage comparison and the project funding projection inherited that error. A three-month user now
  sees their true average, and the whole app agrees with the Annual Grid and year-over-year views, which
  already averaged over months with data.
  - **What to expect if you are a newer user:** your headline income, expenses and guideline budgets will
    be **higher and more accurate** than before, and project funding projections will be **less
    optimistic** (they were crediting a part-year surplus as if it recurred every month).
  - Averages are disclosed, never silent: a **📅 coverage chip** on the Dashboard, Plan and Budgets views
    states how much of the window is populated ("all 12 months recorded" / "averaged over 3 of the last
    12 months"), and the data-health check lists any month inside your records with nothing in it.
- **Project budget field no longer lies.** A project's budget is the sum of its line items whenever items
  exist, so the editable "base budget" field silently discarded whatever you typed into it. It is now
  disabled and shows the budget actually in force, with the reason and a pointer to the line items; a
  project with no line items keeps an editable base budget.
- **Non-monthly fixed costs stop being reported as overspending.** Motor insurance billed quarterly,
  licensing annually or school fees by term breached a monthly budget every time they landed — four false
  overages a year for a perfectly predictable cost, which is exactly how people learn to ignore budget
  alerts. Life Ledger now detects the cadence from the ledger itself (`detectCadence`, coefficient of
  variation over payment months) and reports one honest annual figure with a suggested monthly
  equivalent, instead of a monthly breach per payment. The Budgets view tags such costs 🔄 with their
  quarterly/annual pattern, the true 12-month total and a "use avg" button. Genuinely overspent monthly
  categories still warn exactly as before.
- Regression coverage grew from 166 to 191 jsdom checks, covering the denominator, coverage disclosure,
  cadence detection, funding basis and the project budget field.

**1.4.0** — proactive insight & data integrity
- **Proactive alerts panel** on the Dashboard. Life Ledger already knew when a budget was overspent, a
  project was over, or an income stream had gone quiet — but only said so once you navigated to that
  view. Alerts are now derived live, ranked by urgency, each with a one-click route to the fix, a
  per-session mute, and a **count badge on the affected nav tab**. Nothing to configure.
- **Data health check** (Annual Grid, with a score chip on the Dashboard): month-by-month coverage of
  the trailing-12 window, months missing income or expenses, income streams that have stopped posting,
  unclassified spending, budget coverage and household attribution — each with the fix that resolves it.
  Trailing-12 averages, guideline budgets and the income map are only as trustworthy as the coverage
  behind them.
- **Year-over-year comparison** in the Annual Grid: the current year against any other recorded year by
  group and category, with **per-month** columns that divide by the months actually covered, so a
  part-year dataset is neither flattered nor penalised, plus a plain-language verdict and income/spend/net
  KPIs for both years.
- **Household spending split chart**: a stacked bar and share donut of who spent what, with unattributed
  spending shown explicitly rather than hidden, an attribution-coverage chip, and a per-contributor table.
- **Project completion is now a real lifecycle step.** Marking a project Completed (or Cancelled) archives
  it: the final budget, actual spend, variance, line-item breakdown and duration are frozen into a
  collapsed **Project archive** with portfolio totals, and the project leaves the working list. Ledger
  entries are never deleted — only the link is released so ordinary monthly category aggregation is
  unchanged — and **Restore** re-links every entry. Projects already marked completed in older saves are
  archived automatically on load.
- **Storage-loss warning is now impossible to miss**: a blocking, acknowledge-or-export modal on load
  when localStorage is unavailable, instead of a badge nobody reads. Shown once per session.
- **Sample data now demonstrates the newer branches** — two named household contributors with attributed
  income and expenses, one active renovation project with line items and a funding plan, and one archived
  Christmas project — so the Household split, project archive and alert engine are all visible on first run.
- **CSV export keeps attribution**: `household_member`, `project`, `project_item` and `income_type` were
  previously stripped at export; they are now included, and a spend on a project that has since been
  archived still resolves its project name.
- Regression coverage grew from 82 to 166 jsdom checks in 1.4.0, to 191 in 1.4.1 and to 228 in 1.4.2, including a new `tests/smoke4.cjs` suite for the
  six enhancements plus migration, archive and restore round-trips.
**1.3.0** — household + projects expansion
- Added a **Household** branch with contributor/member attribution for working couples, remote professionals, stay-at-home professionals and other household contributors.
- Added a **Projects & special budgets** branch for finite goals such as home repairs, refurbishments, events, major purchases and emergency work.
- Emergency is modeled as a **project priority**, not a project category; project lifecycle status remains independent.
- Added project line items and ledger-to-project/project-item attribution without changing ordinary monthly expense aggregation.
- Added a derived project funding projection using trailing-12 available surplus plus optional starting reserve, one-time contribution, surplus-allocation percentage or fixed monthly contribution.
- Added backward-compatible workspace migration for older saves and JSON backups.
- Added regression coverage for the new branches, attribution and funding model.

**1.2.0** — review-driven fixes
- **Build outputs renamed** `dist/` → `web/` and `desktop/build/` → `desktop/resources/`:
  folders literally named `dist` and `build` are skipped by some archive/export tools,
  which previously left the zip with no runnable app.
- **Statutory deductions are now itemised and ceiling-aware** (Trinidad & Tobago defaults,
  all editable): employee NIS **5.4%** on insurable earnings **capped at TT$13,600/month**
  (16.2% combined, effective 5 Jan 2026, rising in 2027) — no more flat 6.3% approximation;
  health surcharge modelled as a **flat TT$8.25/week** (TT$4.80/wk at or below TT$469.99/mo
  earnings), not a percentage; **70% of employee NIS is deducted before PAYE**; a separate
  "other deductions %" field covers pension etc. Older saves migrate automatically (the
  pre-1.2 combined 6.3% field is retired, not double-counted).
- `postStreams` duplicate detection is now keyed on stream id — renaming an income stream
  and re-posting no longer duplicates the entry.
- **PWA cache is fingerprinted automatically**: the build stamps the service-worker cache
  name with the app version + a hash of every cached asset, so any rebuild invalidates
  installed PWAs — no manual `CACHE` bumping.
- OCR engine pinned to `tesseract.js@5.1.1` (was a major-version float).
- `resetAll` and the tax engine are now covered by the jsdom suites (78 checks).
