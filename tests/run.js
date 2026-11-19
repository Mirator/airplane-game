#!/usr/bin/env node
// Runs the whole fast suite (everything except tests/sim.js). Exit code is non-zero if any test fails.
//   node tests/run.js                 run every test file in parallel (one node process per file)
//   node tests/run.js --bail          stop everything at the first failing test (used by tests/mutate.js)
//   node tests/run.js --jobs 2        limit how many files run at once (default: one per CPU core, at most the file count)
//   node tests/run.js kits auto       only files whose name contains one of the words
// Prints one line per file, then every failing test with its error. `FAILED: <file> :: <test>` lines are machine-readable.
'use strict';
const { spawn } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

// slowest first: the longest file starts at once, short ones fill the gaps
const FILES = ['mageshot', 'armed', 'levelup', 'responsive', 'idle', 'fix3', 'auto', 'fixes', 'fixes2', 'features', 'smoke', 'kits', 'ui', 'ux2', 'art', 'art2', 'save', 'mapgen', 'build'].map((n) => n + '.test.js');

const argv = process.argv.slice(2);
const bail = argv.includes('--bail');
const ji = argv.indexOf('--jobs');
const words = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--jobs');
const files = FILES.filter((f) => !words.length || words.some((w) => f.includes(w)));
const jobs = Math.max(1, ji >= 0 ? +argv[ji + 1] || 1 : Math.min(files.length, os.cpus().length));
const TIMEOUT_MS = +process.env.TEST_FILE_TIMEOUT_MS || 180000;

const t0 = Date.now();
const results = [];
let next = 0, running = 0, stopping = false;
const live = new Set();

function runFile(f) {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(process.execPath, ['--test', '--test-reporter=spec', path.join(__dirname, f)], { stdio: ['ignore', 'pipe', 'pipe'] });
    live.add(child);
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    const timer = setTimeout(() => { out += '\n✖ TIMEOUT: ' + f + ' did not finish in ' + TIMEOUT_MS + 'ms\n'; child.kill('SIGKILL'); }, TIMEOUT_MS);
    child.on('close', (code, sig) => {
      clearTimeout(timer); live.delete(child);
      const fails = [...out.matchAll(/^\s*✖ (.+?) \(\d+(?:\.\d+)?ms\)\s*$/gm)].map((m) => m[1]);
      const timedOut = /✖ TIMEOUT/.test(out);
      const pass = (out.match(/^ℹ pass (\d+)/m) || [])[1];
      const total = (out.match(/^ℹ tests (\d+)/m) || [])[1];
      resolve({ f, code, sig, ms: Date.now() - start, out, fails, timedOut, pass: +pass || 0, total: +total || 0, killed: sig === 'SIGKILL' && !timedOut });
    });
  });
}

function killAll() { for (const c of live) { try { c.kill('SIGKILL'); } catch (e) { /* gone */ } } }

async function main() {
  await new Promise((done) => {
    const pump = () => {
      while (!stopping && running < jobs && next < files.length) {
        const f = files[next++]; running++;
        runFile(f).then((r) => {
          running--; results.push(r);
          const bad = r.code !== 0;
          if (bad && bail) { stopping = true; killAll(); }
          if (stopping ? running === 0 : (running === 0 && next >= files.length)) done(); else pump();
        });
      }
    };
    pump();
  });
  let failed = 0;
  for (const r of results.sort((a, b) => a.f.localeCompare(b.f))) {
    const bad = r.code !== 0 && !r.killed;
    if (bad) failed++;
    console.log((bad ? 'FAIL ' : r.killed ? 'STOP ' : 'ok   ') + r.f.padEnd(20) + (r.ms / 1000).toFixed(1).padStart(6) + 's  ' + r.pass + '/' + r.total + ' passed');
  }
  for (const r of results) {
    if (r.code === 0 || r.killed) continue;
    for (const n of new Set(r.fails)) console.log('FAILED: ' + r.f + ' :: ' + n);
    if (!r.fails.length) console.log('FAILED: ' + r.f + ' :: (file crashed)');
    if (!process.env.QUIET_FAILS) console.log('\n--- output of ' + r.f + ' ---\n' + r.out.split('\n').filter((l) => !/^\s*✔/.test(l)).join('\n'));
  }
  console.log((failed ? 'FAILED' : 'PASSED') + ' in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
  process.exit(failed ? 1 : 0);
}
main();
process.on('SIGINT', () => { killAll(); process.exit(130); });
