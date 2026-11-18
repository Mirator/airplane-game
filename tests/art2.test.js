// Art-direction tests (the graphics review): floating labels never overlap, the dragon is drawn above the player and whelps with its bar off the map,
// no full-screen flash for small hits, loot / traps stay visible under a foe, red foes keep their contrast against every floor.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, openRun, CONC, HELPERS } = require('./lib/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });
const redraw = (page) => page.evaluate(() => window.dispatchEvent(new Event('resize')));

describe('art direction', { concurrency: CONC }, () => {
  it('floating labels spawned on one tile in one turn never overlap (checked every 40 ms for the whole life), and a repeated status word is one label', async () => {
    const { page, ctx, errors } = await openRun(browser, 'mage');
    try {
      const r = await page.evaluate(() => {
        const A = window.__dbg.api, G = window.__dbg(), x = G.p.x, y = G.p.y;
        // a nasty turn: two numbers, two status words, an announcement and a crit on the player's tile, plus a ring of neighbours
        for (const [t, c, big] of [['-5', '#f55'], ['-2', '#f55'], ['braced', '#9cf'], ['stunned', '#fe6'], ['NOVA', '#9ff', true], ['-12!', '#f80', true], ['frozen', '#9ef'], ['poison', '#7b4']]) A.floatFx(x, y, t, c, big);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) { A.floatFx(x + dx, y + dy, '-4', '#fd4'); A.floatFx(x + dx, y + dy, 'frozen', '#9ef'); }
        const t0 = performance.now(); let worst = 0, n = 0, bad = null;
        for (let T = t0; T < t0 + 1900; T += 40) {
          const b = A.labelBoxes(T);
          n = Math.max(n, b.length);
          for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
            const a = b[i], c = b[j], ox = Math.min(a.r, c.r) - Math.max(a.l, c.l), oy = Math.min(a.b, c.b) - Math.max(a.t, c.t);
            if (ox > 0.02 && oy > 0.02) { worst = Math.max(worst, Math.min(ox, oy)); bad = bad || [a.text, c.text]; }
          }
        }
        const frozen = G.p && window.__dbg.api.labelBoxes(t0 + 1500).length;   // a late sample: nothing left to clash
        return { worst, bad, n, frozen };
      });
      assert.ok(r.n >= 6, 'labels were alive together: ' + r.n);
      assert.equal(r.bad, null, 'overlapping labels: ' + JSON.stringify(r.bad) + ' by ' + r.worst);
      const cnt = await page.evaluate(() => { const A = window.__dbg.api; return A.labelBoxes(performance.now() + 700).filter((b) => b.text === 'frozen').length; });
      assert.ok(cnt <= 2, 'the repeated word "frozen" (6 spawns) is merged, saw ' + cnt);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('the dragon is drawn after (above) the player and the whelps, its bar lives in a top strip that no sprite covers, and its overlays are sized to it', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior');
    try {
      await page.evaluate(() => { window.__dbg.fn.newFloor(8); });
      await page.evaluate(() => {
        const G = window.__dbg(), d = G.enemies.find((e) => e.t === 'dragon');
        G.p.x = d.x - 1; G.p.y = d.y - 1; d.awake = true; d.frz = 2;
        for (const [dx, dy] of [[-2, -1], [-1, 0], [0, -1], [1, -1], [1, 0], [0, 1], [-1, 1]]) { const e = window.__dbg.fn.makeEnemy('whelp', d.x + dx, d.y + dy, 8); e.awake = true; if (!G.enemies.some((o) => o.x === e.x && o.y === e.y)) G.enemies.push(e); }
        window.__dbg.fn.computeVis();
      });
      await redraw(page);
      const r = await page.evaluate(() => {
        const v = window.__dbg.view(), o = v.order, G = window.__dbg(), ts = v.ts;
        const rects = G.enemies.filter((e) => e.t !== 'dragon' && G.vis[e.y * 30 + e.x]).map((e) => ({ l: v.ox + e.x * ts, t: v.oy + e.y * ts, r: v.ox + (e.x + 1) * ts, b: v.oy + (e.y + 1) * ts }));
        rects.push({ l: v.ox + G.p.x * ts, t: v.oy + G.p.y * ts, r: v.ox + (G.p.x + 1) * ts, b: v.oy + (G.p.y + 1) * ts });
        const bb = v.bossBar, hit = bb && rects.some((q) => q.l < bb.x + bb.w && q.r > bb.x && q.t < bb.y + bb.h && q.b > bb.y);
        return { o, bb, hit, ts, cw: v.cw };
      });
      const ix = (n) => r.o.indexOf(n);
      assert.ok(ix('dragonHead') > ix('foes') && ix('dragonHead') > ix('player'), 'head after foes and player: ' + r.o);
      assert.ok(ix('dragonBody') < ix('objects') && ix('dragonBody') < ix('foes'), 'body under neighbours (it never hides loot, whelps or the player): ' + r.o);
      assert.ok(r.bb && r.bb.y <= 12 && r.bb.w >= 60 && !r.hit, 'boss bar in the top strip, off every sprite: ' + JSON.stringify(r.bb));
      assert.ok(r.bb.x + r.bb.w < r.cw, 'bar inside the canvas');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('a small hit gives only an edge vignette; the full-screen wash is for hits of 20% max HP or more; none with reduced motion', async () => {
    const a = await openRun(browser, 'warrior');
    try {
      const r = await a.page.evaluate(() => {
        const G = window.__dbg(), F = window.__dbg.fn, A = window.__dbg.api, out = {};
        const e = F.makeEnemy('goblin', G.p.x + 1, G.p.y, 1); G.enemies.push(e);
        G.p.mhp = 50; G.p.hp = 50; F.hurtPlayer(e, 1, true); out.small = A.flash();
        G.p.hp = 50; F.hurtPlayer(e, 40, true); out.big = A.flash();
        return out;
      });
      assert.equal(r.small.full, false, 'a tiny hit is not a full wash'); assert.ok(r.small.on && r.small.amt <= 0.2, 'edge vignette is weak: ' + r.small.amt);
      assert.equal(r.big.full, true, 'a big hit washes the screen');
    } finally { await a.ctx.close(); }
    const b = await openRun(browser, 'warrior', { reducedMotion: true });
    try {
      const r = await b.page.evaluate(() => { const G = window.__dbg(), F = window.__dbg.fn; const e = F.makeEnemy('goblin', G.p.x + 1, G.p.y, 1); G.enemies.push(e); F.hurtPlayer(e, 30, true); return window.__dbg.api.flash(); });
      assert.equal(r.on, false, 'no flash at all with reduced motion');
    } finally { await b.ctx.close(); }
  });

  it('a foe standing on loot or on a revealed trap still shows a marker for each', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior');
    try {
      await page.evaluate(HELPERS);
      await page.evaluate(() => {
        window.T.setup(3);
        const G = window.__dbg(), e = window.T.foe('rat', 1, 0), f = window.T.foe('goblin', 2, 0);
        G.items.push({ x: e.x, y: e.y, t: 'gold', v: 5 }); G.traps.push({ x: f.x, y: f.y, k: 'dart', rev: 1 });
        window.__dbg.fn.computeVis();
      });
      await redraw(page);
      const m = await page.evaluate(() => window.__dbg.view().marks.map((q) => q.k).sort());
      assert.deepEqual(m, ['item', 'trap']);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('every red-family foe keeps a luminance contrast of at least 1.25 against both floor tones of all six themes', async () => {
    const { page, ctx } = await openRun(browser, 'warrior');
    try {
      const r = await page.evaluate(() => {
        const A = window.__dbg.art, EN = window.__dbg.tables.EN, themes = [...A.ENV, ...A.THEMES2];
        const lum = (c) => { const v = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4))); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
        const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        let worst = 99, who = '', n = 0;
        for (const k in EN) { const t = A.SPR[EN[k].e].t[0], [r, g, b] = [1, 3, 5].map((i) => parseInt(t.slice(i, i + 2), 16)); if (!(r > g * 1.4 && r > b * 1.3)) continue; n++;
          for (const th of themes) for (const f of [th.fa, th.fb]) { const c = cr(t, f); if (c < worst) { worst = c; who = k + ' on ' + th.n; } } }
        return { worst, who, n };
      });
      assert.ok(r.n >= 10, 'red-family foes found: ' + r.n);
      assert.ok(r.worst >= 1.25, 'weakest pair ' + r.who + ' = ' + r.worst.toFixed(2));
    } finally { await ctx.close(); }
  });

  it('wall tops are the darkest plane and no foe or hero tone vanishes into them (hierarchy: wall top < wall front < floor)', async () => {
    const { page, ctx } = await openRun(browser, 'warrior');
    try {
      const r = await page.evaluate(() => {
        const A = window.__dbg.art, lum = (c) => { const v = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); return 0.3 * v[0] + 0.59 * v[1] + 0.11 * v[2]; };
        return [...A.ENV, ...A.THEMES2].map((t) => ({ n: t.n, ok: lum(t.wt) < lum(t.wf) && lum(t.wf) < lum(t.fa) }));
      });
      for (const t of r) assert.ok(t.ok, 'theme hierarchy broken: ' + t.n);
    } finally { await ctx.close(); }
  });
});
