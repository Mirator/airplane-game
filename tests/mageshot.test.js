// The Mage's free ranged shot (BAL.shot): tap / key a foe within range and line of sight; no mana, no cooldown; Warrior and Rogue unchanged.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, openRun, CONC, quiet } = require('./lib/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

// an open 15 x 5 hall, hero at its left third, optional wall column
async function hall(page, wallAt) {
  await page.waitForTimeout(250);   // let a walk that an earlier tap started finish its steps
  await page.evaluate((wallAt) => {
    const G = window.__dbg(), W = 30, ox = 4, oy = 6;
    G.stopWalk = true; window.__dbg.fn.tryMove; G.enemies = []; G.items = []; G.shrine = null; G.merchant = null; G.cracks = []; G.smoke = [];
    for (let y = -1; y <= 5; y++) for (let x = -1; x <= 15; x++) { const k = (oy + y) * W + ox + x; G.map[k] = (x < 0 || y < 0 || x > 14 || y > 4) ? 0 : 1; G.seen[k] = true; G.exp[k] = true; }
    if (wallAt != null) for (let y = 0; y <= 4; y++) G.map[(oy + y) * W + ox + wallAt] = 0;
    G.p.x = ox + 2; G.p.y = oy + 2; G.p.mana = 20; G.p.rage = 50; G.knives = 3; G.p.crit = 0; for (const k in G.cd) G.cd[k] = 0;
    window.__dbg.tables.BAL.combat.dmgVar = 0;
    window.__dbg.fn.computeVis(); window.__dbg.fn.render();
  }, wallAt);
}
const foe = (page, type, dx, dy, o) => page.evaluate(([t, dx, dy, o]) => { const G = window.__dbg(), e = window.__dbg.fn.makeEnemy(t, G.p.x + dx, G.p.y + dy, 1); e.awake = true; e.hp = e.mhp = (o && o.hp) || 100; if (o && o.face) e.face = o.face; if (o && o.stun) e.stun = o.stun; if (o && o.asleep) e.awake = false; window.__dbg.fn.computeVis(); window.__dbg.fn.render(); return e.id; }, [type, dx, dy, o || null]);
const S = (page) => page.evaluate(() => { const G = window.__dbg(); return { x: G.p.x, y: G.p.y, mana: G.p.mana, turn: G.turn, foes: G.enemies.map((e) => [e.x, e.y, e.hp]), log: G.log.slice(-2).join(' | '), cd: JSON.stringify(G.cd), rage: G.p.rage }; });
const tileXY = (page, dx, dy) => page.evaluate(([dx, dy]) => { const v = window.__dbg.view(), G = window.__dbg(), r = document.getElementById('c').getBoundingClientRect(); return { x: r.left + v.ox + (G.p.x + dx + 0.5) * v.ts, y: r.top + v.oy + (G.p.y + dy + 0.5) * v.ts }; }, [dx, dy]);
const click = async (page, dx, dy) => { await quiet(page); const p = await tileXY(page, dx, dy); await page.mouse.click(p.x, p.y); await page.waitForTimeout(120); };

describe('mage free shot', { concurrency: CONC }, () => {
  it('fires at range 1-3 with line of sight: no mana, no cooldown, one turn, no walking; the same shot next to you', async () => {
    const { page, ctx, errors } = await openRun(browser, 'mage', { seed: 11, w: 1366, h: 768 });
    try {
      for (const d of [1, 2, 3]) {
        await hall(page); await foe(page, 'ogre', d, 0); const s0 = await S(page);
        await click(page, d, 0); const s1 = await S(page);
        assert.ok(s1.foes[0][2] < 100, 'hit at ' + d); assert.equal(s1.mana > s0.mana - 0.001 || s1.mana >= s0.mana, true, 'no mana spent'); assert.equal(s1.cd, s0.cd, 'no cooldown');
        assert.ok(s1.turn > s0.turn, 'a turn'); assert.equal(s1.x, s0.x, 'did not walk'); assert.match(s1.log, /Your shot hits/);
      }
      await page.evaluate(() => window.__dbg.fn.render());
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('no shot through a wall or beyond the range: the tap walks as before', async () => {
    const { page, ctx, errors } = await openRun(browser, 'mage', { seed: 12, w: 1366, h: 768 });
    try {
      await hall(page); await foe(page, 'ogre', 6, 0, { asleep: true }); const s0 = await S(page);
      await click(page, 6, 0); await page.waitForFunction((t) => window.__dbg().turn > t, s0.turn, { timeout: 3000 }).catch(() => {}); const s1 = await S(page);
      assert.equal(s1.foes[0][2], 100, 'out of range: no shot'); assert.ok(s1.x > s0.x || /Can't reach|walk/i.test(s1.log) || s1.turn > s0.turn, 'walks toward it ' + JSON.stringify([s0, s1]));
      await hall(page, 5); await foe(page, 'ogre', 4, 0, { asleep: true }); await page.evaluate(() => { const G = window.__dbg(); G.vis.fill(true); });
      const s2 = await S(page); assert.ok(!(await page.evaluate(() => window.__dbg.fn.canShoot(window.__dbg().enemies[0]))), 'blocked line of sight: cannot shoot');
      await page.evaluate(() => window.__dbg.fn.onTap(window.__dbg().enemies[0].x, window.__dbg().enemies[0].y));
      assert.equal((await S(page)).foes[0][2], 100, 'nothing hit through the wall'); assert.doesNotMatch((await S(page)).log, /Your shot/);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('damage follows the equipped weapon (normal attack formula x BAL.shot.mul), the Guard shield works as for Bolt, keys shoot an adjacent foe', async () => {
    const { page, ctx, errors } = await openRun(browser, 'mage', { seed: 13, w: 1366, h: 768 });
    try {
      const dmgWith = async (v) => {
        await hall(page); await page.evaluate((v) => { const G = window.__dbg(); G.p.eq.weapon = { t: 'weapon', k: 'staff', v: v, tr: null }; }, v);
        await foe(page, 'ogre', 2, 0, { hp: 400 }); const want = await page.evaluate(() => Math.max(1, Math.round(window.__dbg.gear.statVec().attack * 0 + (window.__dbg.tables.BAL.shot.mul * (window.__dbg().p.atk + 0)))));
        await click(page, 2, 0); return { got: 400 - (await S(page)).foes[0][2], want };
      };
      const a = await dmgWith(0), b = await dmgWith(12);
      assert.ok(b.got > a.got, 'a better weapon hits harder ' + JSON.stringify([a, b]));
      const exp = await page.evaluate(() => { const B = window.__dbg.tables.BAL; const G = window.__dbg(); const WPk = window.__dbg.tables.WP[G.p.eq.weapon.k]; return Math.round(Math.max(1, Math.round(Math.max(1, G.p.atk + (G.p.eq.weapon.v)) * (G.p.dmgMul || 1))) * B.shot.mul * (1 + (WPk.spell || 0))); });   // spell attack (the staff's melee -3 does not count) x shot mul x spell multiplier
      assert.equal(b.got, exp, 'exactly the formula');
      // Guard: shield facing the mage takes less than a stunned one
      await hall(page); await foe(page, 'guard', 3, 0, { hp: 400, face: [-1, 0] }); await click(page, 3, 0); const front = 400 - (await S(page)).foes[0][2];
      await hall(page); await foe(page, 'guard', 3, 0, { hp: 400, face: [-1, 0], stun: 5 }); await click(page, 3, 0); const open = 400 - (await S(page)).foes[0][2];
      assert.ok(front < open, 'frontal shield reduces the shot ' + front + ' < ' + open);
      // keyboard: an arrow into an adjacent foe is a shot, not a step
      await hall(page); await foe(page, 'ogre', 1, 0, { hp: 400 }); const s0 = await S(page); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100);
      const s1 = await S(page); assert.equal(s1.x, s0.x); assert.ok(s1.foes[0][2] < 400); assert.match(s1.log, /Your shot/);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('a tap on the tile of a foe that just died is ignored; Warrior and Rogue taps are unchanged (walk / melee, no shot)', async () => {
    const m = await openRun(browser, 'mage', { seed: 14, w: 1366, h: 768 });
    try {
      await m.page.evaluate(() => { window.__dbg.tables.BAL.ui.staleMs = 600000; window.__dbg.tables.BAL.ui.burstMs = 600000; });   // stretched: the pace of the two real taps cannot matter
      await hall(m.page); await foe(m.page, 'rat', 2, 0, { hp: 1 }); await click(m.page, 2, 0);
      const k = await S(m.page); assert.equal(k.foes.length, 0, 'killed'); const t0 = k.turn;
      await click(m.page, 2, 0); const k2 = await S(m.page); assert.equal(k2.x, k.x, 'the stale tap did not walk'); assert.equal(k2.turn, t0);
    } finally { assert.deepEqual(m.errors, []); await m.ctx.close(); }
    for (const cls of ['warrior', 'rogue']) {
      const w = await openRun(browser, cls, { seed: 15, w: 1366, h: 768 });
      try {
        await hall(w.page); await foe(w.page, 'ogre', 3, 0, { hp: 400, asleep: true }); await click(w.page, 3, 0);
        const s = await S(w.page); assert.equal(s.foes[0][2], 400, cls + ': no ranged shot'); assert.doesNotMatch(s.log, /Your shot/);
        await hall(w.page); await foe(w.page, 'ogre', 1, 0, { hp: 400 }); await click(w.page, 1, 0);
        assert.match((await S(w.page)).log, /You hit the/, cls + ': melee as before');
      } finally { assert.deepEqual(w.errors, []); await w.ctx.close(); }
    }
  });
  it('Auto fires the shot when Bolt is not an option', async () => {
    const { page, ctx, errors } = await openRun(browser, 'mage', { seed: 16, w: 1366, h: 768 });
    try {
      await hall(page); await foe(page, 'ogre', 3, 0, { hp: 400 });
      const r = await page.evaluate(() => { const D = window.__dbg, G = D(); G.p.mana = 0; D.auto.start(true); let n = 0, shot = false; while (n++ < 12 && !shot) { D.auto.step(); shot = G.log.some((l) => /Your shot hits/.test(l)); } return { shot, mana: G.p.mana }; });
      assert.equal(r.shot, true, 'Auto shoots with an empty mana pool');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
});
