#!/usr/bin/env node
/* ============================================================
   LifeLedger bundler
   src/  ->  web/lifeledger.html      single-file app (ships in the repo; a folder named
                                       `dist` is skipped by some zip/export tools, so the
                                       output folder is `web` and Electron's icon assets
                                       live in `desktop/resources` rather than `build`)
        ->  dist-pwa/                  installable PWA (manifest + fingerprinted SW + icons)
        ->  android/www                web assets for the Capacitor Android shell
        ->  desktop/app                payload for the Electron build
   Usage: node build.mjs [--all | --pwa | --android | --desktop]
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MODULES = ['01-core.js','02-state.js','03-sample.js','04-charts.js','05-engine.js',
  '06-view-dashboard.js','07-view-ledger.js','08-view-grid.js','09-view-budgets.js',
  '10-view-income.js','11-view-plan.js','12-view-ingest.js','13-io.js','15-view-household.js','16-view-projects.js','14-boot.js'];
const read = p => readFileSync(join(ROOT, p)).toString();

function buildWeb() {
  const css = read('src/styles.css');
  const js  = MODULES.map(m => read('src/js/' + m)).join('');
  let html = read('src/index.html');
  html = html.replace('<link rel="stylesheet" href="styles.css">',
                      () => '<style>\n' + css + '\n</style>');
  const tags = MODULES.map(m => `<script src="js/${m}"></script>`).join('\n');
  html = html.replace(tags, () => '<script>\n' + js + '\n</script>');
  mkdirSync(join(ROOT, 'web'), { recursive: true });
  writeFileSync(join(ROOT, 'web/lifeledger.html'), html);
  console.log('✔ web/lifeledger.html  (' + html.length.toLocaleString() + ' bytes, single file, zero dependencies)');
}

/* cache name = app version + hash of every cached asset, so ANY content change
   invalidates installed PWAs automatically — no manual cache bumping, ever */
function cacheTag(swSrc, html, manifest, icons) {
  const version = JSON.parse(read('package.json')).version;
  const h = createHash('sha1');
  h.update(html); h.update(manifest); h.update(swSrc);
  for (const i of icons) h.update(i);
  return `lifeledger-${version}-${h.digest('hex').slice(0, 8)}`;
}

function buildPWA() {
  buildWeb();
  let html = read('web/lifeledger.html');
  html = html.replace('</head>', '  <link rel="manifest" href="manifest.webmanifest">\n</head>');
  html = html.replace('</body>',
    '  <script>if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("service-worker.js")})}</script>\n</body>');
  const manifest = read('pwa/manifest.webmanifest');
  const swSrc = read('pwa/service-worker.js');
  const icons = existsSync(join(ROOT, 'pwa/icons'))
    ? readdirSync(join(ROOT, 'pwa/icons')).sort().map(f => read('pwa/icons/' + f)) : [];
  const tag = cacheTag(swSrc, html, manifest, icons);
  const sw = swSrc.replace("const CACHE = 'lifeledger-dev';", `const CACHE = '${tag}';`);
  if (sw === swSrc) throw new Error('service-worker.js: CACHE placeholder not found');
  rmSync(join(ROOT, 'dist-pwa'), { recursive: true, force: true });
  mkdirSync(join(ROOT, 'dist-pwa/icons'), { recursive: true });
  writeFileSync(join(ROOT, 'dist-pwa/lifeledger.html'), html);
  writeFileSync(join(ROOT, 'dist-pwa/manifest.webmanifest'), manifest);
  writeFileSync(join(ROOT, 'dist-pwa/service-worker.js'), sw);
  for (const f of readdirSync(join(ROOT, 'pwa/icons'))) copyFileSync(join(ROOT, 'pwa/icons/' + f), join(ROOT, 'dist-pwa/icons/' + f));
  console.log('✔ dist-pwa/  (PWA; service-worker cache tag: ' + tag + ')');
}

function buildAndroid() {
  if (!existsSync(join(ROOT, 'dist-pwa/lifeledger.html'))) buildPWA();
  rmSync(join(ROOT, 'android/www'), { recursive: true, force: true });
  mkdirSync(join(ROOT, 'android/www/icons'), { recursive: true });
  for (const f of ['lifeledger.html', 'manifest.webmanifest', 'service-worker.js'])
    copyFileSync(join(ROOT, 'dist-pwa/' + f), join(ROOT, 'android/www/' + f));
  for (const f of readdirSync(join(ROOT, 'dist-pwa/icons'))) copyFileSync(join(ROOT, 'dist-pwa/icons/' + f), join(ROOT, 'android/www/icons/' + f));
  console.log('✔ android/www  (Capacitor webDir ready — then: npx cap add android)');
}

function buildDesktop() {
  mkdirSync(join(ROOT, 'desktop/app'), { recursive: true });
  copyFileSync(join(ROOT, 'web/lifeledger.html'), join(ROOT, 'desktop/app/lifeledger.html'));
  console.log('✔ desktop/app  (Electron payload — cd desktop && npm run dist:win / dist:mac / dist:linux)');
}

const args = new Set(process.argv.slice(2));
if (args.has('--pwa'))          buildPWA();
else if (args.has('--android')) { buildPWA(); buildAndroid(); }
else if (args.has('--desktop')) { buildWeb(); buildDesktop(); }
else if (args.has('--all'))     { buildWeb(); buildPWA(); buildAndroid(); buildDesktop(); }
else buildWeb();
