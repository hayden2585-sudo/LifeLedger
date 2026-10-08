#!/usr/bin/env node
/* LifeLedger release hygiene.
   Every existing release artifact is MOVED to desktop/archive/<version>/.
   Nothing is silently deleted.
*/
import { existsSync, mkdirSync, readdirSync, renameSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const DESKTOP = join(ROOT, 'desktop');
const RELEASE = join(DESKTOP, 'release');
const ARCHIVE = join(DESKTOP, 'archive');
const VERSION = JSON.parse(readFileSync(join(DESKTOP, 'package.json'), 'utf8')).version;
const VERSION_RE = /\b(\d+\.\d+\.\d+)\b/;
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

mkdirSync(RELEASE, { recursive: true });
mkdirSync(ARCHIVE, { recursive: true });

function archivePath(version, name) {
  const dir = join(ARCHIVE, version);
  mkdirSync(dir, { recursive: true });
  let dest = join(dir, name);
  if (existsSync(dest)) dest = join(dir, stamp + '__' + name);
  return dest;
}

for (const name of readdirSync(RELEASE)) {
  const full = join(RELEASE, name);
  let artifactVersion = name.match(VERSION_RE)?.[1] || null;

  // These are generated build artifacts associated with the release being replaced.
  if (!artifactVersion && (name === 'win-unpacked' || name === '.icon-ico' || name === 'builder-debug.yml')) {
    artifactVersion = VERSION;
  }

  if (!artifactVersion) {
    const q = join(ARCHIVE, '_quarantine', stamp);
    mkdirSync(q, { recursive: true });
    renameSync(full, join(q, name));
    console.log('QUARANTINED unknown release artifact:', name);
    continue;
  }

  const dest = archivePath(artifactVersion, name);
  renameSync(full, dest);
  console.log('ARCHIVED', name, '->', dest);
}

const leftovers = readdirSync(RELEASE);
if (leftovers.length) throw new Error('Release staging directory is not empty: ' + leftovers.join(', '));
console.log('RELEASE STAGING CLEAN:', VERSION);
