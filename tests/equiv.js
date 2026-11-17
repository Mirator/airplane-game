#!/usr/bin/env node
// Determinism / equivalence check between two builds of the game.
// Usage: node tests/equiv.js <reference.html> <candidate.html> [seedsPerClass=6] [runsPerSeed=3]
// Stubs Math.random with a seeded PRNG (and forces reduced-motion so cosmetic code never draws random
// numbers), plays bot campaigns, and compares end state (floor, turn, hp, kills, gold, RNG-call count and a
// hash of the whole final game state) run by run. Exit code 1 on any mismatch.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const lib = fs.readFileSync(path.join(__dirname, 'lib', 'botlib.js'), 'utf8');

const [ref, cand] = process.argv.slice(2, 4).map((p) => path.resolve(p));
const SEEDS = +process.argv[4] || 6, RUNS = +process.argv[5] || 3;
const CLASSES = ['warrior', 'mage', 'rogue'];

async function play(browser, file, cls, seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.addInitScript((s) => {
    let a = s >>> 0;
    window.__rngCalls = 0;
    Math.random = function () {
      window.__rngCalls++;
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, seed * 7919 + 13);
  await page.goto('file://' + file);
  await page.addScriptTag({ content: lib });
  const rows = await page.evaluate(([cls, n]) => {
    // keep a reference to the last game object so the final state survives the bot returning to the title
    const orig = window.__dbg;
    let last = null;
    window.__dbg = Object.assign(function () { const g = orig(); if (g) last = g; return g; }, orig);
    const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
    BOT.resetMeta();
    const st = { i: 0 }, out = [];
    for (let r = 0; r < n; r++) {
      const res = BOT.runOne(cls, {});
      const g = last;
      out.push({ r, floor: g.floor, turn: g.turn, hp: g.p.hp, kills: g.kills, gold: res.gold, won: res.won, stall: res.stall, rng: window.__rngCalls, hash: fnv(JSON.stringify(g)), meta: fnv(JSON.stringify(window.__dbg.api.meta())) });
      BOT.spend(window.__dbg.api.meta(), st);
    }
    return out;
  }, [cls, RUNS]);
  await ctx.close();
  return { rows, errs };
}

(async () => {
  const browser = await chromium.launch();
  let match = 0, mismatch = 0, errors = 0;
  const t0 = Date.now();
  for (const cls of CLASSES) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const [a, b] = [await play(browser, ref, cls, seed), await play(browser, cand, cls, seed)];
      errors += a.errs.length + b.errs.length;
      for (let i = 0; i < a.rows.length; i++) {
        const x = JSON.stringify(a.rows[i]), y = JSON.stringify(b.rows[i]);
        if (x === y) match++; else { mismatch++; console.log('MISMATCH', cls, 'seed', seed, 'run', i, '\n  ref ', x, '\n  cand', y); }
      }
      const r0 = a.rows[a.rows.length - 1];
      console.log(cls.padEnd(8), 'seed', seed, 'ok  last run: floor', r0.floor, 'turn', r0.turn, 'hp', r0.hp, 'kills', r0.kills, 'gold', r0.gold);
    }
  }
  await browser.close();
  console.log(`\nruns matched: ${match}, mismatched: ${mismatch}, page errors: ${errors}, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  process.exit(mismatch || errors ? 1 : 0);
})();
