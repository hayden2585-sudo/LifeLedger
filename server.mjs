#!/usr/bin/env node
/* Zero-dependency static server for the installable PWA build.
   Usage:  node server.mjs [host] [port]        e.g. node server.mjs 0.0.0.0 8080  (LAN) */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'dist-pwa');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
               '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.png': 'image/png' };
const host = process.argv[2] || '127.0.0.1';
const port = Number(process.argv[3]) || 8080;
http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/' || p === '') p = '/lifeledger.html';
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, host, () => console.log(`LifeLedger PWA →  http://${host}:${port}   (Ctrl+C to stop)`));
