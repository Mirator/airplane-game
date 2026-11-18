// Shared Playwright helpers for the test suite. Playwright is expected to be installed globally (require('playwright')).
'use strict';
const path = require('path');
const { chromium } = require('playwright');

const GAME = path.resolve(process.env.GAME_HTML || path.join(__dirname, '..', '..', 'index.html'));
const URL = 'file://' + GAME;

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

// Chromium sends localStorage writes to its storage service asynchronously, and a page loaded right afterwards can read BEFORE the
// previous page's newest write arrived (the "lost localStorage write" quirk; it made tests that reload straight after a save flaky).
// That is Chromium's business, not the game's: what the game must get right is WHAT it writes and how it reads it back. So
// reload(page) takes the page's localStorage as the page itself sees it (always complete), hands it to the next document through
// window.name (navigation state, never lost) and the restore script installed by newPage() makes it the document's localStorage
// before any game code runs. The game still boots from whatever it wrote itself; only the browser's lazy flush is taken out.
const RESTORE = () => {
  try {
    if (window.name.indexOf('__ls:') === 0) {
      const d = JSON.parse(window.name.slice(5)); window.name = '';
      localStorage.clear(); for (const [k, v] of d) localStorage.setItem(k, v);
    }
  } catch (e) { /* storage blocked */ }
};
// The game redraws its canvas on every animation frame while an effect runs (the floor banner alone keeps it busy for 2.6 s after
// every new floor). Software-rendered headless Chromium pays dearly for that, and no test depends on the frame rate, so frames are
// requested at 10 per second instead of 60 (pass {frames: 'full'} to newPage to opt out).
const SLOW_FRAMES = () => { window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 100); };
// A dialog that opens because of a game event ignores real taps for BAL.ui.modalGraceMs (so a finger still tapping the map cannot pick a perk by
// accident). Almost every test taps dialog buttons right after they open, so the harness sets the grace to 0; the tests of the grace itself
// (fixes.test.js) pass {grace: true} to newPage and run with the real value.
const noGrace = (page) => page.evaluate(() => { try { window.__dbg.tables.BAL.ui.modalGraceMs = 0; } catch (e) { /* no game yet */ } });
async function reload(page) {
  await page.evaluate(() => { window.name = '__ls:' + JSON.stringify(Object.entries(localStorage)); });
  await page.reload();
  if (!page.__grace) await page.waitForFunction(() => !!window.__dbg).then(() => noGrace(page));
}

// New page with error collection. opts: {w,h,seed,meta,reducedMotion,touch,fakeDate}. meta pre-seeds the permanent save
// (default: help already seen, rogue + mage unlocked). Every test gets its own browser context, i.e. fresh localStorage / IndexedDB.
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
  await page.addInitScript(RESTORE);
  if (opts.frames !== 'full') await page.addInitScript(SLOW_FRAMES);
  if (opts.seed != null) await page.addInitScript(seedInit, opts.seed);
  if (opts.fakeDate) await page.addInitScript(fakeDateInit, opts.fakeDate);   // [y, m0, d]: freeze the local calendar date
  const meta = opts.meta || { seenHelp: 1, gold: 0, unl: { rogue: 1, mage: 1 } };
  // seeded by a script that runs inside the game's own document before the game boots (same storage connection as the game's read);
  // only when the key is missing, so later reloads keep whatever progress the page saved
  await page.addInitScript((m) => { try { if (localStorage.getItem('dcr_meta_v1') === null) localStorage.setItem('dcr_meta_v1', m); } catch (e) { /* storage blocked */ } }, JSON.stringify(meta));
  await page.goto(URL);
  page.__grace = !!opts.grace;
  if (!opts.grace) await noGrace(page);
  return { page, ctx, errors };
}

const CLASS_LABEL = { warrior: /Warrior/, rogue: /Rogue/, mage: /Mage/ };
const dbgReady = (page) => page.waitForFunction(() => !!window.__dbg() && document.getElementById('title').style.display === 'none');
async function startRun(page, cls) {
  await page.locator('#title button', { hasText: /New run/ }).click();
  await page.locator('#title button', { hasText: CLASS_LABEL[cls] }).click();
  await dbgReady(page);
}
// a started run with the intro/help dialog closed, ready for window.__dbg poking. The run is started through the game's own
// startRun() (what the class buttons call); the title -> class picker -> button path is covered by startRun() above in smoke / save /
// features, so most tests do not pay for two Playwright clicks and the animation frames they trigger.
async function openRun(browser, cls, opts) {
  const r = await newPage(browser, opts);
  await r.page.evaluate((c) => window.__dbg.fn.startRun(c), cls);
  await dbgReady(r.page);
  await closeModal(r.page);
  return r;
}
// Auto lives in the menu now: open it and tap "Auto play" (the stop / speed buttons are in the top bar while it runs)
// (the first tap in a run only states the half-gold cost, the second starts it)
const autoOn = async (page) => { await page.click('#menuBtn'); const b = page.locator('#modalBox button[data-k="auto"]'); await b.click(); if (await page.locator('#modal').isVisible()) await b.click(); };
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
module.exports = { autoOn, GAME, URL, CONC, HELPERS, reload, launch, newPage, startRun, openRun, closeModal, dbgReady, fastAuto, quiet, seedInit, fakeDateInit };
