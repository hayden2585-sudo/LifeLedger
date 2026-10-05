#!/usr/bin/env node
/* Generates the LifeLedger icon set as valid PNGs (no image libraries —
   hand-rolled PNG encoder: IHDR + zlib IDAT + CRC32). Grid glyph on an
   indigo->violet gradient; the green cell is the "positive balance" cell. */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function crc32(buf) {
  if (!crc32.t) { crc32.t = []; for (let n = 0; n < 256; n++) { let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : c >>> 1; crc32.t[n] = c >>> 0; } }
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = crc32.t[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;                      // 8-bit truecolour + alpha
  const stride = size * 4, raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  return Buffer.concat([Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const insideRound = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const dx = Math.max(x0 + r - x, x - (x1 - r), 0), dy = Math.max(y0 + r - y, y - (y1 - r), 0);
  return dx * dx + dy * dy <= r * r;
};
function draw(size, maskable) {
  const SS = 3, px = Buffer.alloc(size * size * 4);
  const g0 = [52, 80, 180], g1 = [139, 92, 246];                       // #3450b4 -> #8b5cf6
  const bgR  = maskable ? 0 : size * 0.225;
  const c0   = size * (maskable ? 0.30 : 0.235), c1 = size * (maskable ? 0.70 : 0.765);
  const gap  = size * 0.055, cw = (c1 - c0 - gap) / 2, cellR = size * 0.045;
  const cells = [[c0, c0, 0], [c0 + cw + gap, c0, 1], [c0, c0 + cw + gap, 0], [c0 + cw + gap, c0 + cw + gap, 0]];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 1, b = 2, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const u = x + (sx + .5) / SS, v = y + (sy + .5) / SS, t = (v / size) * .85 + (u / size) * .15;
      let cr = g0[0] + (g1[0] - g0[0]) * t, cg = g0[1] + (g1[1] - g0[1]) * t, cb = g0[2] + (g1[2] - g0[2]) * t;
      if (maskable || insideRound(u, v, .5, .5, size - .5, size - .5, bgR)) {
        for (const [cx, cy, green] of cells)
          if (insideRound(u, v, cx, cy, cx + cw, cy + cw, cellR)) {
            if (green) { cr = 47; cg = 158; cb = 95; } else { cr = cg = cb = 255; }
            break;
          }
        a += 255;
      }
      r += cr; g += cg; b += cb;
    }
    const n = SS * SS, i = (y * size + x) * 4;
    px[i] = Math.round(r / n); px[i+1] = Math.round(g / n); px[i+2] = Math.round(b / n); px[i+3] = Math.round(a / n);
  }
  return png(size, px);
}
mkdirSync(join(ROOT, 'pwa/icons'), { recursive: true });
mkdirSync(join(ROOT, 'desktop/resources'), { recursive: true });
writeFileSync(join(ROOT, 'pwa/icons/icon-192.png'),      draw(192, false));
writeFileSync(join(ROOT, 'pwa/icons/icon-512.png'),      draw(512, false));
writeFileSync(join(ROOT, 'pwa/icons/maskable-512.png'),  draw(512, true));
copyFileSync(join(ROOT, 'pwa/icons/icon-512.png'), join(ROOT, 'desktop/resources/icon.png'));
console.log('✔ pwa/icons/icon-192.png · icon-512.png · maskable-512.png · desktop/resources/icon.png');
