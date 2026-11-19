// Self abilities (Cleave, Nova, Brace, Vanish) are armed first and used by a second tap, like the targeted ones.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, openRun, CONC, quiet } = require('./lib/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const CASES = [['warrior', 'cleave', true], ['mage', 'nova', true], ['warrior', 'brace', false], ['rogue', 'vanish', false]];
const S = (page) => page.evaluate((k) => { const G = window.__dbg(); return { turn: G.turn, x: G.p.x, y: G.p.y, rage: G.p.rage, mana: G.p.mana, cd: G.cd[k], brace: !!G.brace, vanish: G.vanish, foes: G.enemies.map((e) => e.hp), log: G.log.slice(-1)[0], armed: [...document.querySelectorAll('#bar2 button.armed')].map((b) => b.id) }; }, null);
async function setup(page, withFoe) {
  await page.evaluate((withFoe) => {
    const G = window.__dbg(), W = 30, ox = 5, oy = 5;
    G.enemies = []; G.items = []; G.shrine = null; G.merchant = null; G.cracks = []; G.smoke = [];
    for (let y = -1; y <= 7; y++) for (let x = -1; x <= 11; x++) { const k = (oy + y) * W + ox + x; G.map[k] = (x < 0 || y < 0 || x > 10 || y > 6) ? 0 : 1; G.seen[k] = true; G.exp[k] = true; }
    G.p.x = ox + 5; G.p.y = oy + 3; G.p.rage = 100; G.p.mana = G.p.mhp && 40; G.knives = 5; for (const k in G.cd) G.cd[k] = 0;
    if (withFoe) { const e = window.__dbg.fn.makeEnemy('goblin', G.p.x + 1, G.p.y, 1); e.awake = true; e.hp = e.mhp = 60; }
    window.__dbg.fn.computeVis(); window.__dbg.fn.render();
  }, withFoe);
  await quiet(page);
}
const tile = (page, dx, dy) => page.evaluate(([dx, dy]) => { const v = window.__dbg.view(), G = window.__dbg(), r = document.getElementById('c').getBoundingClientRect(); return { x: r.left + v.ox + (G.p.x + dx + 0.5) * v.ts, y: r.top + v.oy + (G.p.y + dy + 0.5) * v.ts }; }, [dx, dy]);
const pix = (page, dx, dy) => page.evaluate(([dx, dy]) => { window.__dbg.fn.render(); const v = window.__dbg.view(), G = window.__dbg(), c = document.getElementById('c'), d = v.dpr; const x = Math.round((v.ox + (G.p.x + dx + 0.12) * v.ts) * d), y = Math.round((v.oy + (G.p.y + dy + 0.12) * v.ts) * d); return Array.from(c.getContext('2d').getImageData(x, y, 3, 3).data.slice(0, 3)).join(','); }, [dx, dy]);
const idx = (page, k) => page.evaluate((k) => window.__dbg.tables.CLS[window.__dbg().p.cls].kit.indexOf(k), k);

describe('arm, then use', { concurrency: CONC }, () => {
  for (const [cls, k, foe] of CASES) {
    it(`${k} (${cls}): first tap arms and shows the area, nothing spent; button / hero tile / lit tile / key / Enter use it; Esc, tap away, another ability cancel`, async () => {
      const { page, ctx, errors } = await openRun(browser, cls, { seed: 3, w: 1366, h: 768 });
      try {
        const i = await idx(page, k), btn = '#a_' + i, key = String(i + 1);
        await setup(page, foe);
        let s0 = await S(page); const before = await pix(page, 1, 1);
        const redo = async () => { await setup(page, foe); s0 = await S(page); };
        await page.click(btn); await page.waitForTimeout(80);
        let s = await S(page);
        assert.deepEqual(s.armed, ['a_' + i], 'armed'); assert.equal(s.turn, s0.turn, 'no turn'); assert.equal(s.rage, s0.rage); assert.equal(s.mana, s0.mana); assert.equal(s.cd, s0.cd, 'no cooldown'); assert.equal(s.brace, false); assert.equal(s.vanish, s0.vanish);
        assert.match(s.log, /tap again to use/i);
        assert.equal(await page.evaluate(() => document.getElementById('cv').classList.contains('arming')), true);
        assert.match(await page.locator(btn).innerText(), /Use/);
        const tg = await page.evaluate(() => window.__dbg.view().tg); assert.ok(tg && tg.length >= 1);
        if (foe) assert.notEqual(await pix(page, 1, 1), before, 'the area is drawn on the map');
        const h0 = await page.locator(btn).evaluate((b) => b.innerHTML); await page.waitForTimeout(150); assert.equal(await page.locator(btn).evaluate((b) => b.innerHTML), h0, 'button markup not rewritten');
        const used = async (s2) => { assert.ok(s2.turn > s0.turn, 'used a turn'); assert.deepEqual(s2.armed, []); };
        // 1: the button again
        await quiet(page); await page.click(btn); await page.waitForTimeout(100); await used(await S(page));
        // 2: the hero tile
        await redo(); await page.click(btn); await page.waitForTimeout(60);
        let p = await tile(page, 0, 0); await page.mouse.click(p.x, p.y); await page.waitForTimeout(100); await used(await S(page));
        // 3: a lit tile (a neighbour; Brace / Vanish only light your own tile)
        if (foe) { await redo(); await page.click(btn); await page.waitForTimeout(60);
        p = await tile(page, 0, 1); await page.mouse.click(p.x, p.y); await page.waitForTimeout(100); let s3 = await S(page); await used(s3); assert.equal(s3.x, s0.x, 'it did not walk'); assert.equal(s3.y, s0.y); }
        // 4: the number key twice; 5: key then Enter
        await redo(); await page.keyboard.press(key); await page.waitForTimeout(60); assert.deepEqual((await S(page)).armed, ['a_' + i]); assert.equal((await S(page)).turn, s0.turn);
        await page.keyboard.press(key); await page.waitForTimeout(100); await used(await S(page));
        await redo(); await page.keyboard.press(key); await page.waitForTimeout(60); await page.keyboard.press('Enter'); await page.waitForTimeout(100); await used(await S(page));
        // cancel: Esc
        await redo(); await page.keyboard.press(key); await page.waitForTimeout(60); await page.keyboard.press('Escape'); await page.waitForTimeout(60);
        s = await S(page); assert.deepEqual(s.armed, []); assert.equal(s.turn, s0.turn); assert.equal(await page.locator('#modal').isVisible(), false);
        // cancel: tap outside the lit area (consumed: it does not walk there, and costs nothing)
        await redo(); await page.click(btn); await page.waitForTimeout(60);
        p = await tile(page, 4, 2); await page.mouse.click(p.x, p.y); await page.waitForTimeout(100);
        s = await S(page); assert.deepEqual(s.armed, []); assert.equal(s.turn, s0.turn, 'no turn'); assert.equal(s.x, s0.x, 'no walking'); assert.equal(s.y, s0.y);
        // cancel by choosing another ability
        await redo(); await page.click(btn); await page.waitForTimeout(60);
        const other = await page.evaluate((k) => window.__dbg.tables.CLS[window.__dbg().p.cls].kit.find((q) => q !== k && window.__dbg.tables.ABIL[q].tg === 'self'), k);
        if (other) { await page.click('#a_' + (await idx(page, other))); await page.waitForTimeout(60); s = await S(page); assert.ok(s.armed.length <= 1 && !s.armed.includes('a_' + i)); }
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    });
  }
  it('Auto and direct calls still use a self ability at once (no arming)', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 4 });
    try {
      await setup(page, true);
      const r = await page.evaluate(() => { const D = window.__dbg, G = D(), t0 = G.turn; D.fn.use('cleave'); return { used: G.turn > t0, armed: document.querySelectorAll('#bar2 button.armed').length }; });
      assert.equal(r.used, true); assert.equal(r.armed, 0);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});
