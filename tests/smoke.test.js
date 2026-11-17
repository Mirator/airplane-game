// Smoke test: load the built index.html at phone and laptop sizes, play each class with random taps plus bar/modal buttons,
// assert no console/page errors and no external requests, then reload and check Continue restores the WHOLE saved run.
// The random play runs inside the page (real DOM click events on the canvas / buttons, the same handlers a finger reaches),
// so hundreds of actions cost milliseconds instead of one Playwright round trip each.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, startRun, CONC } = require('./lib/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const CLASSES = ['warrior', 'rogue', 'mage'];
const ACTIONS = 300;

// n random actions: map taps (most), a random bar / ability button, Explore (with a short pause so the auto-walk can take steps),
// a random dialog button when a dialog is open, "New run" + class when the run ended and the title is showing.
const playRandomly = (page, cls, n) => page.evaluate(async ({ cls, n }) => {
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shown = (id) => $(id).style.display !== 'none';
  const live = (sel) => [...document.querySelectorAll(sel)].filter((b) => !b.disabled && b.offsetParent !== null);
  const pressRandom = (sel) => { const bs = live(sel); if (!bs.length) return false; bs[Math.floor(Math.random() * bs.length)].click(); return true; };
  const pressText = (root, re) => [...$(root).querySelectorAll('button')].find((b) => re.test(b.textContent)).click();
  const cv = $('c');
  for (let i = 0; i < n; i++) {
    if (shown('title')) { pressText('titleBox', /New run/); pressText('titleBox', new RegExp(cls, 'i')); continue; }
    if (shown('modal')) { pressRandom('#modalBox button'); continue; }
    const r = cv.getBoundingClientRect(), k = i % 10;
    if (k === 0) pressRandom('#bar button, #bar2 button');
    else if (k === 1) { $('b_exp').click(); await sleep(70); }
    else cv.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + Math.random() * r.width, clientY: r.top + Math.random() * r.height }));
  }
}, { cls, n });

const layout = (page) => page.evaluate(() => {
  const r = [...document.querySelectorAll('#bar button, #bar2 button')].map((b) => b.getBoundingClientRect());
  return {
    sw: document.documentElement.scrollWidth, iw: window.innerWidth, sh: document.documentElement.scrollHeight, ih: window.innerHeight,
    barRight: Math.max(...r.map((x) => x.right)), barBottom: Math.max(...r.map((x) => x.bottom)),
  };
});

describe('smoke', { concurrency: CONC }, () => {
  for (const [cls, vp] of [['warrior', { w: 390, h: 844 }], ['rogue', { w: 390, h: 844 }], ['mage', { w: 390, h: 844 }], ['warrior', { w: 1280, h: 800 }]]) {
    it(`${cls} at ${vp.w}x${vp.h}: random play, zero errors, layout fits`, async () => {
      const { page, ctx, errors } = await newPage(browser, { ...vp, seed: 1234 + CLASSES.indexOf(cls) + vp.w });
      try {
        await startRun(page, cls);
        await playRandomly(page, cls, ACTIONS);
        // layout: no page scroll, whole bottom bar inside the viewport
        const lay = await layout(page);
        assert.ok(lay.sw <= lay.iw && lay.sh <= lay.ih, 'page scrolls: ' + JSON.stringify(lay));
        assert.ok(lay.barRight <= lay.iw + 0.5 && lay.barBottom <= lay.ih + 0.5, 'bar overflows: ' + JSON.stringify(lay));
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    });
  }

  for (const cls of CLASSES) {
    it(`${cls}: reload + Continue restores the whole run (every saved field, not just turn and floor)`, async () => {
      const { page, ctx, errors } = await newPage(browser, { seed: 99 + CLASSES.indexOf(cls) });
      try {
        await startRun(page, cls);
        await playRandomly(page, cls, 80);
        // make sure there is a live run, give every persisted resource a non-default value, save and snapshot in ONE step
        const snap = () => page.evaluate(() => {
          const g = window.__dbg();
          if (!g || g.over) return null;
          const o = JSON.parse(JSON.stringify(g));
          // legitimately re-derived by Continue: save timestamp, walking flag, wading flag (see continueRun)
          for (const k of ['ts', 'stopWalk', 'wade']) delete o[k];
          return o;
        });
        if (!(await snap())) { await page.evaluate(() => window.__dbg.api.showTitle()); await startRun(page, cls); }
        const before = await page.evaluate(() => {
          const g = window.__dbg(), F = window.__dbg.fn, kit = window.__dbg.tables.CLS[g.p.cls].kit;
          document.getElementById('modal').style.display = 'none';
          g.cd[kit[1]] = 3; g.cd[kit[2]] = 2; g.p.gold += 37; g.inv.pot = 3; g.kills += 4;
          if (g.p.cls === 'warrior') g.p.rage = 41; else if (g.p.cls === 'mage') g.p.mana = 11; else g.knives = 2;
          window.__dbg.grant(window.__dbg.perkIds.find((id) => { const pk = window.__dbg.tables.PERKS.find((x) => x.id === id); return !pk.cls || pk.cls === g.p.cls; }));
          F.save();
          const o = JSON.parse(JSON.stringify(g));
          for (const k of ['ts', 'stopWalk', 'wade']) delete o[k];
          return o;
        });
        await page.reload();
        await page.locator('#title button', { hasText: /Continue run/ }).click();
        const after = await snap();
        assert.deepEqual(after, before);
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    });
  }
});
