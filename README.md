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
└── tests/                     ← jsdom suites (70+ checks) · `npm test`
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

## 6 · Development & tests

```bash
npm install        # jsdom (dev-only)
npm test           # 78 jsdom checks against web/lifeledger.html
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

Dashboard (KPIs, donut, 12-month bars, overages) · Ledger (search/filter/edit + household/project attribution) ·
Annual Grid (17+2 categories × 12 months, live totals, editable budgets, drill-down) ·
Budgets (guideline-based, over/under chips) · Household (multiple contributors, income attribution, member spending) ·
Projects (finite budgets, line items, priority/status lifecycle, linked actuals, derived funding projection) ·
Income Map (tax inversion, needs ladder, cost-of-living equation, self-employed revenue targets, **minimum-wage lens**, income-type mix) ·
Plan & Advice (surplus → investment playbook; deficit → ranked saving strategies,
stress test, what-if cuts) · Add Data (manual, invoice/screenshot + OCR, email/text
parser, CSV import) · special events & religion/charity groups (zero by default) · income
subtypes for salary/wages, side hustles, salary arrears, overtime/extra duties, dividends,
sale of assets, gratuity, welfare benefits, rental income, and gifts/remittances (including
money sent from abroad).

**Disclaimer:** educational tool — not financial, tax or investment advice.

## 8 · Universal application updates

GitHub is intended to become the canonical source and release store. The application source, tagged releases, checksums and CI build workflow are documented in `docs/UNIVERSAL_UPDATE_METHOD.md`; a GitHub Actions release template is staged in `.github/workflows/release.yml`.

The important separation is: **GitHub distributes application code; each device retains authority over its own financial data.** User backups, local storage and credentials are never part of the application repository.

## 9 · Changelog

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
