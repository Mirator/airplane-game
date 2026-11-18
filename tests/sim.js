#!/usr/bin/env node
// Balance simulator (NOT part of `npm test`: slow). Plays full runs with the heuristic bot in tests/lib/botlib.js against
// the built index.html and prints win rate / stall rate / death-floor histogram / top killers per class and upgrade level.
//
// Usage: node tests/sim.js [--runs 10] [--classes warrior,mage,rogue] [--levels fresh=0,mid=500,heavy=1500]
//                          [--jobs 4] [--seed N] [--lib botlib.js] [--botcfg json] [--file path/to/index.html] [--jsonl out.jsonl]
//   --runs     runs per class per upgrade level (default 10)
//   --levels   name=bankedGold pairs. Each run starts from a fresh meta save with that much gold spent on the permanent
//              shop/unlocks in the bot's fixed buying order (see SEQ in tests/lib/botlib.js), so runs are independent samples.
//   --hard     play on Hard mode (meta gets one win so the toggle is unlocked)
//   --force M  debug: every exit on floors 2-7 offers only modifier M (dark flooded cursed horde hunted rich silent unstable)
//   --jobs     parallel browser pages (default 4)
//   --auto     play with the in-game Auto (src/js/auto.js, via tests/lib/autolib.js) instead of the test bot; same upgrade levels and seeds
//   --seed     seed Math.random per run (run i of the whole job list uses seed*100003+i) for reproducible tables
// "stall" = the bot gave up (action cap / no goal); it is a bot limitation, not a death. Win% counts stalls as non-wins.
// Runtime: ~0.7 s per run with 4 jobs; the default (3 classes x 3 levels x 10 runs = 90 runs) takes about 70 s here.
// Use --runs 50 or more for a balance decision (a 10-run cell has a +-15 point error bar on win%).
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const RUNS = +arg('runs', 10);
const CLASSES = arg('classes', 'warrior,mage,rogue').split(',');
const LEVELS = arg('levels', 'fresh=0,mid=500,heavy=1500').split(',').map((s) => { const [n, g] = s.split('='); return { name: n, gold: +g }; });
const JOBS = +arg('jobs', 4);
const HARD = process.argv.includes('--hard');
const FORCE = arg('force', null);
const SEED = arg('seed', null);
const FILE = path.resolve(arg('file', path.join(__dirname, '..', 'index.html')));
const JSONL = arg('jsonl', null);
const AUTO = process.argv.includes('--auto');
const BOTCFG = arg('botcfg', null);   // JSON, e.g. '{"kite":0,"snipe":0,"choke":0}' to switch bot tactics off for A/B runs
const lib = fs.readFileSync(path.resolve(arg('lib', path.join(__dirname, 'lib', 'botlib.js'))), 'utf8');
const autolib = AUTO ? fs.readFileSync(path.join(__dirname, 'lib', 'autolib.js'), 'utf8') : '';

const tasks = [];
for (const lv of LEVELS) for (const cls of CLASSES) for (let r = 0; r < RUNS; r++) tasks.push({ lv, cls, r, id: tasks.length });

const med = (a) => { if (!a.length) return 0; a = a.slice().sort((x, y) => x - y); return a[a.length >> 1]; };

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch();
  const results = [], errors = [];
  let next = 0, done = 0;
  async function worker() {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('file://' + FILE);
    await page.addScriptTag({ content: lib });
    if (AUTO) await page.addScriptTag({ content: autolib });
    if (BOTCFG) await page.evaluate((c) => Object.assign(window.BOT.cfg || {}, JSON.parse(c)), BOTCFG);
    while (next < tasks.length) {
      const t = tasks[next++];
      try {
        const res = await page.evaluate(([cls, gold, seed, hard, force]) => {
          if (seed !== null) {
            let a = seed >>> 0;
            Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
          }
          BOT.resetMeta(hard ? { gold, wins: 1, hardOn: 1 } : { gold });
          window.__dbg.mods.setForce(force);
          BOT.spend(window.__dbg.api.meta(), { i: 0 });
          const r = BOT.runOne(cls, {});
          if (!r.dbg || !r.auto) r.dbg = null;   // the Auto runner keeps its watchdog report
          return r;
        }, [t.cls, t.lv.gold, SEED === null ? null : (+SEED * 100003 + t.id) >>> 0, HARD, FORCE]);
        results.push({ ...res, level: t.lv.name, run: t.r });
      } catch (e) { errors.push('crash ' + t.cls + ': ' + String(e).slice(0, 100)); }
      if (++done % 10 === 0) process.stderr.write(`  ${done}/${tasks.length} runs, ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
    }
    await ctx.close();
  }
  await Promise.all(Array.from({ length: Math.min(JOBS, tasks.length) }, worker));
  await browser.close();

  if (JSONL) fs.writeFileSync(JSONL, results.map((r) => JSON.stringify(r)).join('\n') + '\n');
  for (const lv of LEVELS) {
    console.log(`\n== ${lv.name} (${lv.gold} banked gold spent on upgrades)`);
    console.log('class     n   win%  stall%  medTurns  winTurns  dragon%  deathFloor(1..8)  top killers');
    for (const cls of CLASSES) {
      const rows = results.filter((r) => r.level === lv.name && r.cls === cls);
      if (!rows.length) continue;
      const n = rows.length, won = rows.filter((r) => r.won).length, st = rows.filter((r) => r.stall).length;
      const fl = Array(9).fill(0);
      rows.filter((r) => !r.won).forEach((r) => fl[r.floor]++);
      const kc = {};
      rows.filter((r) => !r.won && !r.stall).forEach((r) => { kc[r.killer] = (kc[r.killer] || 0) + 1; });
      const ks = Object.entries(kc).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0] + ':' + x[1]).join(' ');
      console.log(cls.padEnd(9) + String(n).padStart(3) + String((100 * won / n).toFixed(0) + '%').padStart(7) + String((100 * st / n).toFixed(0) + '%').padStart(8)
        + String(med(rows.map((r) => r.turns))).padStart(10) + String(med(rows.filter((r) => r.won).map((r) => r.turns))).padStart(10)
        + String(((r8) => r8.length ? (100 * r8.filter((r) => r.won).length / r8.length).toFixed(0) + '%(' + r8.length + ')' : '-')(rows.filter((r) => r.floor === 8))).padStart(11) + '  ' + fl.slice(1).join(',').padEnd(17) + ks);
    }
  }
  if (AUTO) for (const r of results.filter((x) => x.stall && x.dbg)) console.log('  watchdog: ' + r.level + ' ' + r.cls + ' floor ' + r.dbg.floor + ' turn ' + r.dbg.turn + ' [' + r.dbg.cause + '] ' + r.stall + ' | mod ' + r.dbg.mod + ' hp ' + r.dbg.hp + ' | in sight: ' + r.dbg.vis.join(',') + ' | trail: ' + r.dbg.tr.slice(-3).join(' / ') + ' | log: ' + r.dbg.log.join(' / '));
  { const sc = {}; results.filter((r) => r.stall).forEach((r) => { const k = String(r.stall).replace(/\d+/g, 'N'); sc[k] = (sc[k] || 0) + 1; });
    if (Object.keys(sc).length) console.log('\n== stall / watchdog causes: ' + Object.entries(sc).map(([k, v]) => k + ' x' + v).join(' | ')); }
  { const mc = {}; let tot = 0; results.forEach((r) => (r.mods || '').split(',').filter(Boolean).forEach((m) => { mc[m] = (mc[m] || 0) + 1; tot++; }));
    console.log('\n== floors by modifier (share of all floors entered): ' + Object.entries(mc).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + (100 * v / tot).toFixed(0) + '%').join('  ')); }
  // ability usage share per class (all levels pooled): how often each of the four abilities was used, as a share of all uses
  console.log('\n== ability usage share per class (uses per run in brackets)');
  for (const cls of CLASSES) {
    const rows = results.filter((r) => r.cls === cls && r.uses);
    const tot = {}; let all = 0;
    rows.forEach((r) => { for (const k in r.uses) { tot[k] = (tot[k] || 0) + r.uses[k]; all += r.uses[k]; } });
    const parts = Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / all).toFixed(0)}% (${(v / rows.length).toFixed(1)})`);
    console.log(cls.padEnd(9) + (parts.join('  ') || 'none'));
  }
  console.log('\n== Wait taps per run (all / with an awake foe in sight)');
  for (const cls of CLASSES) { const rows = results.filter((r) => r.cls === cls && r.waits != null); if (rows.length) console.log(cls.padEnd(9) + (rows.reduce((a, r) => a + r.waits, 0) / rows.length).toFixed(1) + ' / ' + (rows.reduce((a, r) => a + r.waitsC, 0) / rows.length).toFixed(1) + ' / mana-rest ' + (rows.reduce((a, r) => a + (r.waitsM || 0), 0) / rows.length).toFixed(1)); }
  console.log('\n== ability uses per run ON FLOOR 8 (the dragon fight), runs that reached it');
  for (const cls of CLASSES) {
    const rows = results.filter((r) => r.cls === cls && r.floor === 8 && r.uses8);
    const tot = {}; rows.forEach((r) => { for (const k in r.uses8) tot[k] = (tot[k] || 0) + r.uses8[k]; });
    console.log(cls.padEnd(9) + `(n=${rows.length}) ` + (Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / Math.max(1, rows.length)).toFixed(1)}`).join('  ') || 'none'));
  }
  const gc = {};
  results.forEach((r) => { if (r.gear) { const [w, a, o, c] = r.gear.split('/'); const k = r.cls + ' ' + w; gc[k] = (gc[k] || 0) + 1; } });
  if (process.argv.includes('--gear')) console.log('\nfinal weapon by class:', JSON.stringify(gc));
  console.log(`\n${results.length}/${tasks.length} runs finished in ${((Date.now() - t0) / 1000).toFixed(0)}s, ${errors.length} page errors/crashes${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  process.exit(errors.length ? 1 : 0);
})();
