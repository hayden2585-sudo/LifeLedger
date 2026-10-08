'use strict';
/* LifeLedger desktop shell (Electron). */
const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// This machine has Chromium GPU process launch error 18.
// Disable hardware acceleration while retaining the renderer sandbox.
app.disableHardwareAcceleration();

const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath('appData'), '..', 'Local');
const cachePath = path.join(localAppData, 'LifeLedger', 'Cache');
fs.mkdirSync(cachePath, { recursive: true });
app.setPath('cache', cachePath);

function resolveApp() {
  const candidates = [
    path.join(__dirname, 'app', 'lifeledger.html'),
    path.join(__dirname, '..', 'web', 'lifeledger.html')
  ];
  return candidates.find(p => fs.existsSync(p));
}

function createWindow() {
  const target = resolveApp();
  if (!target) {
    dialog.showErrorBox('LifeLedger', 'App bundle missing.\nRun: node build.mjs --desktop in the project root, then restart.');
    return app.quit();
  }

  const win = new BrowserWindow({
    width: 1380, height: 920, minWidth: 980, minHeight: 640,
    backgroundColor: '#eef1f6', show: false,
    icon: path.join(__dirname, 'resources', 'icon.png'),
    title: 'LifeLedger',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const runRenderer = (code) => win.webContents.executeJavaScript(code).catch(() => {});

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [
      { label: 'New / Reset Ledger…', accelerator: 'CmdOrCtrl+N', click() {
        runRenderer(`(()=>{ const b=document.querySelector('.dangerText'); if(b) resetAll(b); })()`);
      } },
      { type: 'separator' },
      { label: 'Import Backup…', accelerator: 'CmdOrCtrl+O', click() {
        runRenderer('importJSONClick()');
      } },
      { label: 'Export Transactions (CSV)…', click() {
        runRenderer('exportCSV()');
      } },
      { label: 'Export Annual Grid (CSV)…', click() {
        runRenderer('exportGridCSV()');
      } },
      { label: 'Export Backup (JSON)…', accelerator: 'CmdOrCtrl+S', click() {
        runRenderer('exportJSON()');
      } },
      { label: 'Restore Encrypted Backup…', click() {
        runRenderer('securityChooseEncryptedRestore()');
      } },
      { type: 'separator' },
      { label: 'Print Current View…', accelerator: 'CmdOrCtrl+P', click() {
        win.webContents.print({ printBackground: true });
      } },
      { type: 'separator' },
      { role: 'quit', label: 'Exit' }
    ] },
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
    ] },
    { label: 'View', submenu: [
      { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
      { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' },
      { role: 'zoomOut' }, { role: 'togglefullscreen' }
    ] },
    { label: 'Help', submenu: [
      { label: 'About LifeLedger', click() {
        dialog.showMessageBox(win, {
          type: 'info',
          title: 'About LifeLedger',
          message: 'LifeLedger ' + app.getVersion(),
          detail: 'Offline expense & income spreadsheet.\nAll data stays on this device (Chromium profile storage).\nBack up via Data ▸ Export JSON.\n\nEducational tool — not financial advice.'
        });
      } }
    ] }
  ]));

  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadFile(target);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
