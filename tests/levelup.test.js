// Asynchronous level-up: the perk choice is a pending pick (badge on the gear button), options rolled once, saved, nudged at the stairs, spent at once by Auto.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, openRun, CONC, reload, quiet } = require('./lib/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const st = (page) => page.evaluate(() => { const G = window.__dbg(); return { pending: G.pending, picks: JSON.stringify(G.picks), lvl: G.p.lvl, turn: G.turn, x: G.p.x, y: G.p.y, floor: G.floor, perks: Object.keys(G.perks).length, log: G.log.slice(-3), modal: document.getElementById('modal').style.display !== 'none', kind: document.getElementById('modalBox').dataset.kind, badge: document.getElementById('perkBadge').textContent, badgeShown: document.getElementById('perkBadge').style.display !== 'none' }; });
const give = (page, n) => page.evaluate((n) => { const G = window.__dbg(), X = window.__dbg.tables.BAL.xp; for (let i = 0; i < n; i++) { G.p.xp = X.base + G.p.lvl * X.perLevel - 1; window.__dbg.api.gainXp(3); } window.__dbg.fn.render(); }, n);
const opts = (page) => page.locator('#modalBox button[data-k]').evaluateAll((bs) => bs.map((b) => b.dataset.k).filter((k) => k !== 'equipment' && k !== 'later'));

describe('async level-up', { concurrency: CONC }, () => {
  it('a level-up opens no dialog and blocks nothing; the badge counts; the log says where to tap', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 5 });
    try {
      await page.evaluate(() => { const G = window.__dbg(), e = window.__dbg.fn.makeEnemy('rat', G.p.x + 3, G.p.y, 1); e.awake = true; window.__dbg.fn.computeVis(); });
      await give(page, 1); await page.waitForTimeout(100);
      let s = await st(page);
      assert.equal(s.pending, 1); assert.equal(s.modal, false, 'no dialog'); assert.equal(s.badge, '1'); assert.equal(s.badgeShown, true);
      assert.ok(s.log.some((l) => /Level up: tap the badge/.test(l)));
      const t0 = s.turn; await page.click('#b_wait'); await page.waitForTimeout(100);
      assert.ok((await st(page)).turn > t0, 'the Wait button still works'); assert.equal((await st(page)).modal, false);
      const t1 = (await st(page)).turn; await page.keyboard.press('Space'); await page.waitForTimeout(100);
      assert.ok((await st(page)).turn > t1, 'keys still work');
      const r = await page.evaluate(() => { const b = document.getElementById('gearBtn').getBoundingClientRect(), c = document.getElementById('cv').getBoundingClientRect(); const k = document.getElementById('perkBadge').getBoundingClientRect(); return { overlap: Math.max(0, Math.min(k.right, c.right) - Math.max(k.left, c.left)) * Math.max(0, Math.min(k.bottom, c.bottom) - Math.max(k.top, c.top)), bw: b.width, bh: b.height }; });
      assert.ok(r.overlap < 1, 'badge never covers the map'); assert.ok(r.bw >= 44 && r.bh >= 44);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('the badge opens the choice; closing and reopening keeps the same options; a pick applies; Esc leaves it pending', async () => {
    const { page, ctx, errors } = await openRun(browser, 'mage', { seed: 6 });
    try {
      await give(page, 1);
      await page.click('#gearBtn'); await page.waitForTimeout(80);
      assert.equal((await st(page)).kind, 'perk'); const o1 = await opts(page); assert.ok(o1.length >= 3);
      await page.locator('#modalBox button[data-k="later"]').click();
      assert.equal((await st(page)).modal, false); assert.equal((await st(page)).pending, 1);
      await page.click('#gearBtn'); assert.deepEqual(await opts(page), o1, 'same options, no reroll');
      await page.keyboard.press('Escape'); await page.waitForTimeout(60);
      assert.equal((await st(page)).modal, false); assert.equal((await st(page)).pending, 1, 'Esc closes, still pending');
      await page.keyboard.press('p'); await page.waitForTimeout(60); assert.deepEqual(await opts(page), o1, 'P opens it too');
      await page.locator('#modalBox button[data-k="equipment"]').click(); assert.match(await page.locator('#modalBox h2').textContent(), /Equipment/);
      await page.locator('#modalBox button', { hasText: 'Back' }).click(); await page.waitForTimeout(60);
      assert.equal((await st(page)).kind, 'perk', 'Equipment > Back returns to the pick'); assert.deepEqual(await opts(page), o1, 'with the same options');
      await page.locator('#modalBox button[data-k="later"]').click();
      assert.equal((await st(page)).modal, false);
      const p0 = (await st(page)).perks; await page.click('#gearBtn'); await page.locator('#modalBox button[data-k="' + o1[0] + '"]').click(); await page.waitForTimeout(80);
      const s = await st(page); assert.equal(s.perks, p0 + 1); assert.equal(s.pending, 0); assert.equal(s.badgeShown, false); assert.equal(s.modal, false);
      await page.click('#gearBtn'); await page.waitForTimeout(60); assert.match(await page.locator('#modalBox h2').textContent(), /Equipment/, 'no pick pending: the button opens the equipment');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('two pending picks are offered one after another; the rest stays pending when the dialog is closed', async () => {
    const { page, ctx, errors } = await openRun(browser, 'rogue', { seed: 7 });
    try {
      await give(page, 2);
      let s = await st(page); assert.equal(s.pending, 2); assert.equal(s.badge, '2');
      await page.click('#gearBtn'); const a = await opts(page);
      await page.locator('#modalBox button[data-k="' + a[0] + '"]').click(); await page.waitForTimeout(80);
      s = await st(page); assert.equal(s.modal, true, 'second pick follows'); assert.equal(s.kind, 'perk'); assert.equal(s.pending, 1);
      await page.keyboard.press('Escape'); await page.waitForTimeout(60);
      s = await st(page); assert.equal(s.modal, false); assert.equal(s.pending, 1); assert.equal(s.badge, '1');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('pending picks and their rolled options survive a reload; a run save from before has none', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 8 });
    try {
      await give(page, 2); await page.evaluate(() => window.__dbg.fn.save());
      const s0 = await st(page);
      await reload(page); await page.locator('#btnContinue').click(); await page.waitForTimeout(100);
      const s1 = await st(page); assert.equal(s1.pending, 2); assert.equal(s1.picks, s0.picks, 'same options'); assert.equal(s1.modal, false, 'no dialog on load'); assert.equal(s1.badge, '2');
      // an older save: pending without stored picks keeps its count (the options are rolled when the dialog opens)
      await page.evaluate(() => { const G = window.__dbg(); delete G.picks; G.pending = 3; window.__dbg.fn.save(); });
      await reload(page); await page.locator('#btnContinue').click(); await page.waitForTimeout(100);
      const s2 = await st(page); assert.equal(s2.pending, 3, 'the old save keeps its pending picks'); assert.equal(s2.badgeShown, true); assert.equal(s2.modal, false);
      await page.click('#gearBtn'); assert.equal((await st(page)).kind, 'perk', 'and the dialog rolls options for them'); assert.ok((await opts(page)).length >= 3);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('the stairs nudge: one choice dialog first, closing it lets the next tap descend', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 9 });
    try {
      await page.evaluate(() => { const G = window.__dbg(); G.enemies = []; for (let i = 0; i < 900; i++) if (G.map[i] === 2) { G.p.x = i % 30; G.p.y = Math.floor(i / 30); } window.__dbg.fn.computeVis(); window.__dbg.fn.render(); });
      await give(page, 1); const f0 = (await st(page)).floor;
      await quiet(page); await page.click('#b_down'); await page.waitForTimeout(100);
      let s = await st(page); assert.equal(s.kind, 'perk'); assert.equal(s.floor, f0); assert.equal(s.pending, 1);
      await page.keyboard.press('Escape'); await page.waitForTimeout(60);
      await page.click('#b_down'); await page.waitForTimeout(150);
      s = await st(page); assert.ok(s.floor === f0 + 1 || s.kind === 'path', 'second tap goes down (or offers the exit choice) ' + JSON.stringify(s));
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('Auto spends a pending pick at once, without a badge or a nudge', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 10 });
    try {
      await give(page, 2);
      const r = await page.evaluate(() => { const D = window.__dbg, G = D(); const p0 = Object.keys(G.perks).length; D.auto.start(true); let n = 0; while (G.pending > 0 && n++ < 40) D.auto.step(); return { pending: G.pending, gained: Object.keys(G.perks).length - p0, auto: D.auto.state().on }; });
      assert.equal(r.pending, 0); assert.ok(r.gained >= 1);
      // and a level gained while Auto plays is spent the same turn
      const r2 = await page.evaluate(() => { const D = window.__dbg, G = D(); D.auto.start(true); D.api.gainXp(500); D.api.afterModals(); let n = 0; while (G.pending > 0 && n++ < 20) D.auto.step(); return { pending: G.pending, log: G.log.join('|') }; });
      assert.equal(r2.pending, 0); assert.doesNotMatch(r2.log.split('|').slice(-1)[0] || '', /badge/);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
});
