// Smoke test: load the built index.html at phone and laptop sizes, play each class with random taps plus bar/modal
// buttons, assert no console/page errors and no external requests, then reload and check Continue restores the run.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, startRun } = require('./lib/harness');

const VIEWPORTS = [{ w: 390, h: 844 }, { w: 1280, h: 800 }];
const CLASSES = ['warrior', 'rogue', 'mage'];
const ACTIONS = 140;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

// click a random enabled, visible button inside the selector (DOM click: same as a user tap, but fast)
const pressRandom = (page, sel) => page.evaluate((s) => {
  const bs = [...document.querySelectorAll(s)].filter((b) => !b.disabled && b.offsetParent !== null);
  if (!bs.length) return false;
  bs[Math.floor(Math.random() * bs.length)].click();
  return true;
}, sel);

async function playRandomly(page, cls, n) {
  const box = await page.locator('#c').boundingBox();
  for (let i = 0; i < n; i++) {
    const title = await page.evaluate(() => document.getElementById('title').style.display !== 'none');
    if (title) { await startRun(page, cls); continue; }
    const modal = await page.evaluate(() => document.getElementById('modal').style.display !== 'none');
    if (modal) { await pressRandom(page, '#modalBox button'); continue; }
    const r = i % 10;
    if (r === 0) await pressRandom(page, '#bar button, #bar2 button');
    else if (r === 1) await page.click('#b_exp');
    else await page.mouse.click(box.x + Math.random() * box.width, box.y + Math.random() * box.height);
  }
}

describe('smoke', { concurrency: 3 }, () => {
  for (const vp of VIEWPORTS) for (const cls of CLASSES) {
    it(`${cls} at ${vp.w}x${vp.h}: random play, zero errors, layout fits`, async () => {
      const { page, ctx, errors } = await newPage(browser, { ...vp, seed: 1234 + CLASSES.indexOf(cls) });
      try {
        await startRun(page, cls);
        await playRandomly(page, cls, ACTIONS);
        // layout: no page scroll, whole bottom bar inside the viewport
        const lay = await page.evaluate(() => {
          const r = [...document.querySelectorAll('#bar button, #bar2 button')].map((b) => b.getBoundingClientRect());
          return {
            sw: document.documentElement.scrollWidth, iw: window.innerWidth, sh: document.documentElement.scrollHeight, ih: window.innerHeight,
            barRight: Math.max(...r.map((x) => x.right)), barBottom: Math.max(...r.map((x) => x.bottom)),
          };
        });
        assert.ok(lay.sw <= lay.iw && lay.sh <= lay.ih, 'page scrolls: ' + JSON.stringify(lay));
        assert.ok(lay.barRight <= lay.iw + 0.5 && lay.barBottom <= lay.ih + 0.5, 'bar overflows: ' + JSON.stringify(lay));
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    });
  }

  for (const cls of CLASSES) {
    it(`${cls}: reload + Continue restores turn and floor`, async () => {
      const { page, ctx, errors } = await newPage(browser, { seed: 99 + CLASSES.indexOf(cls) });
      try {
        await startRun(page, cls);
        await playRandomly(page, cls, 60);
        // make sure we have a live run, then wait for auto-walk to settle before snapshotting
        const live = () => page.evaluate(() => { const g = window.__dbg(); return !!g && !g.over; });
        if (!(await live())) { await page.evaluate(() => window.__dbg.api.showTitle()); await startRun(page, cls); await page.click('#b_exp'); }
        let last = null, stable = 0;
        while (stable < 5) {
          await page.waitForTimeout(100);
          const s = await page.evaluate(() => { const g = window.__dbg(); return g ? g.turn + ':' + g.floor + ':' + g.pending : 'none'; });
          stable = s === last ? stable + 1 : 0; last = s;
        }
        await page.waitForTimeout(500); // let the browser flush localStorage before reloading
        const before = await page.evaluate(() => { const g = window.__dbg(); return { turn: g.turn, floor: g.floor, hp: g.p.hp, gold: g.p.gold }; });
        await page.reload();
        await page.locator('#title button', { hasText: /Continue run/ }).click();
        const after = await page.evaluate(() => { const g = window.__dbg(); return { turn: g.turn, floor: g.floor, hp: g.p.hp, gold: g.p.gold }; });
        assert.deepEqual(after, before);
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    });
  }
});
