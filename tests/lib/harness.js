// Shared Playwright helpers for the test suite. Playwright is expected to be installed globally (require('playwright')).
'use strict';
const path = require('path');
const { chromium } = require('playwright');

const GAME = path.resolve(process.env.GAME_HTML || path.join(__dirname, '..', '..', 'index.html'));
const URL = 'file://' + GAME;
const BLANK = 'file://' + path.join(__dirname, 'blank.html');   // same (file://) storage origin as the game, but loads in a few ms

// How many tests of one file run at the same time (every test has its own browser context, so they cannot see each other).
const CONC = +process.env.TEST_CONCURRENCY || 4;

// Seeded Math.random replacement (mulberry32) so test runs are reproducible.
function seedInit(seed) {
  let a = seed >>> 0;
  Math.random = function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Freeze `new Date()` / Date.now() to local noon of [year, monthIndex, day] (Daily runs are keyed by the local date).
function fakeDateInit(ymd) {
  const R = Date, fixed = new R(ymd[0], ymd[1], ymd[2], 12, 0, 0).getTime();
  window.Date = class extends R { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } };
}

// New page with error collection. opts: {w,h,seed,meta,reducedMotion,touch,fakeDate}. meta pre-seeds the permanent save
// (default: help already seen, rogue + mage unlocked). Every test gets its own browser context, i.e. fresh localStorage / IndexedDB.
// The meta is written from a blank same-origin page and the game is then loaded ONCE (writing it from addInitScript made Chromium
// intermittently lose the newest localStorage write across a later page.reload(), so the write happens before the game ever loads).
async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: opts.w || 390, height: opts.h || 844 },
    hasTouch: !!opts.touch,
    reducedMotion: opts.reducedMotion ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('requestfailed', (r) => { if (!/^file:/.test(r.url())) errors.push('external request: ' + r.url()); });
  page.on('request', (r) => { if (!/^(file|data|blob|about):/.test(r.url())) errors.push('external request: ' + r.url()); });
  if (opts.seed != null) await page.addInitScript(seedInit, opts.seed);
  if (opts.fakeDate) await page.addInitScript(fakeDateInit, opts.fakeDate);   // [y, m0, d]: freeze the local calendar date
  const meta = opts.meta || { seenHelp: 1, gold: 0, unl: { rogue: 1, mage: 1 } };
  await page.goto(BLANK);
  await page.evaluate((m) => { localStorage.setItem('dcr_meta_v1', JSON.stringify(m)); }, meta);
  await page.goto(URL);
  return { page, ctx, errors };
}

const CLASS_LABEL = { warrior: /Warrior/, rogue: /Rogue/, mage: /Mage/ };
const dbgReady = (page) => page.waitForFunction(() => !!window.__dbg() && document.getElementById('title').style.display === 'none');
async function startRun(page, cls) {
  await page.locator('#title button', { hasText: /New run/ }).click();
  await page.locator('#title button', { hasText: CLASS_LABEL[cls] }).click();
  await dbgReady(page);
}
// a started run with the intro/help dialog closed, ready for window.__dbg poking
async function openRun(browser, cls, opts) {
  const r = await newPage(browser, opts);
  await startRun(r.page, cls);
  await closeModal(r.page);
  return r;
}
const closeModal = (page) => page.evaluate(() => { document.getElementById('modal').style.display = 'none'; });
// Auto normally decides once per 250 ms; tests that only need "Auto is running" shorten that (the rule under test is unchanged)
const fastAuto = (page, ms = 20) => page.evaluate((m) => { window.__dbg.tables.BAL.auto.tickMs = m; }, ms);

// Wait until the game stops rewriting the bottom bar. While an animation runs (the floor banner for ~2.6 s, floating damage numbers)
// render() runs every frame and re-creates the buttons' contents; a real mouse press that straddles such a rewrite is not delivered
// as a click, which is what made "click an ability button right after the floor started" fail under CPU load. Call this before a
// real (non-DOM) click on a bar button.
const quiet = (page, ms = 400) => page.evaluate((ms) => new Promise((res) => {
  const bar = document.getElementById('bar2'); let t;
  const done = () => { mo.disconnect(); res(); };
  const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(done, ms); });
  mo.observe(bar, { childList: true, subtree: true });
  t = setTimeout(done, ms);
}), ms);

// in-page helpers (string-injected so each test can use them): a clear straight corridor of floor to test lines and ranges
const HELPERS = `
window.T = {
  // find a floor tile with at least n open floor tiles in +x and 1 open tile in +y/-y, move the player there, clear the floor of enemies
  setup(n) {
    const G = () => window.__dbg(), W = 30;
    for (let attempt = 0; attempt < 40; attempt++) {
      const g = G();
      g.enemies = []; g.items = []; g.traps = []; g.shrine = null; g.merchant = null;
      for (let y = 2; y < 28; y++) for (let x = 2; x < 28 - n; x++) {
        let ok = true;
        for (let k = -1; k <= n && ok; k++) { const t = g.map[y * W + x + k]; if (t !== 1) ok = false; }
        if (ok && g.map[(y + 1) * W + x] === 1 && g.map[(y - 1) * W + x] === 1) {
          g.p.x = x; g.p.y = y; g.vanish = 0; g.smoke = []; g.brace = null;
          for (const k in g.cd) g.cd[k] = 0;
          window.__dbg.fn.computeVis(); return { x, y };
        }
      }
      window.__dbg.fn.newFloor(1 + (attempt % 3));   // this floor has no straight corridor that long: roll another
    }
    return null;
  },
  foe(type, dx, dy, awake) {
    const G = window.__dbg(), e = window.__dbg.fn.makeEnemy(type, G.p.x + dx, G.p.y + dy, 3);
    e.awake = awake !== false; window.__dbg.fn.computeVis(); return e;
  },
  tick() { window.__dbg.fn.endTurn(); }
};`;
const launch = () => chromium.launch();
module.exports = { GAME, URL, CONC, HELPERS, launch, newPage, startRun, openRun, closeModal, dbgReady, fastAuto, quiet, seedInit, fakeDateInit };
