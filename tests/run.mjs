#!/usr/bin/env node
/* Test runner: jsdom suites against a built target (default web/lifeledger.html). */
import { spawnSync } from 'node:child_process';
const suites = ['smoke.cjs', 'smoke2.cjs', 'smoke3.cjs', 'smoke4.cjs', 'security-foundation.cjs', 'security-access.cjs'];
const target = process.argv[2] || 'web/lifeledger.html';
let failed = 0;
for (const s of suites) {
  console.log(`\n━━━ ${s} ━━━`);
  if (spawnSync('node', [`tests/${s}`, target], { stdio: 'inherit' }).status) failed = 1;
}
console.log(failed ? '\n✗ TESTS FAILED' : '\n✓ ALL SUITES PASSED');
process.exit(failed ? 1 : 0);
