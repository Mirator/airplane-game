// Auto (autopilot) tests: completes floors for every class, a tap hands control back without moving, reload resumes paused, half gold + recap label,
// watchdog, dialogs resolved (gear / perk / path / shrine / merchant), one timer however fast you toggle, hidden page, old saves, layout.
// Every test has its own browser context and runs concurrently with the others. Waits are on conditions; where a test only needs
// "Auto is running" it shortens the decision interval (BAL.auto.tickMs) - the rule under test is the same, just sooner - and where
// it needs "nothing may happen" it freezes the timer (a huge tickMs) or checks that no timer is pending.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, startRun, openRun, closeModal, dbgReady, fastAuto, autoOn, CONC, reload } = require('./lib/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const META = { seenHelp: 1, gold: 0, unl: { rogue: 1, mage: 1 } };
const snap = (page) => page.evaluate(() => { const G = window.__dbg(); return { turn: G.turn, x: G.p.x, y: G.p.y, floor: G.floor, on: G.auto.on, over: G.over }; });
const freezeAuto = (page) => fastAuto(page, 6e5);   // Auto may be switched on, but its first decision is ten minutes away
const modalOpen = () => document.getElementById('modal').style.display !== 'none';
const fresh = (cls, seed, meta) => openRun(browser, cls, { seed, meta: meta || META });

describe('auto', { concurrency: CONC }, () => {
  for (const cls of ['warrior', 'rogue', 'mage']) {
    it(`${cls}: explores, fights and descends at least one floor (sync steps, same code as the timer)`, async () => {
      const { page, ctx, errors } = await fresh(cls, 11);
      try {
        const r = await page.evaluate(() => {
          const D = window.__dbg, A = D.auto;
          A.start(true);
          let n = 0; while (A.state().on && !D().over && D().floor < 2 && n++ < 4000) A.step();
          return { floor: D().floor, over: D().over, on: D().auto.on, turn: D().turn, stop: A.state().lastStop, err: A.state().err, used: D().auto.used };
        });
        assert.equal(r.err, null);
        assert.equal(r.floor, 2, 'descended: ' + JSON.stringify(r));
        assert.equal(r.used, 1);
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    });
  }

  it('with real timers: the button turns Auto on, turns advance on their own, the speed button cycles 1x/2x/4x and is remembered', async () => {
    const { page, ctx, errors } = await fresh('warrior', 12);
    try {
      assert.equal(await page.locator('#autoSpd').isVisible(), false, 'speed control only while Auto is on');
      assert.equal(await page.locator('#cv #autoBox, #cv #autoBtn').count(), 0, 'no Auto control on the map');
      assert.equal(await page.locator('#autoBtn').isVisible(), false, 'no stop button while Auto is off');
      await autoOn(page);
      assert.equal(await page.evaluate(() => window.__dbg().auto.on), 1);
      assert.equal(await page.evaluate(() => document.getElementById('modal').style.display), 'none', 'the menu closed');
      assert.ok(await page.locator('#autoSpd').isVisible());
      assert.ok(await page.locator('#autoTag').isVisible());
      assert.match(await page.locator('#autoBtn').getAttribute('aria-label'), /Stop Auto/);
      const t0 = (await snap(page)).turn;
      await page.waitForFunction((t) => window.__dbg().turn >= t + 2, t0, { timeout: 15000 });   // turns advance by themselves at 1x
      assert.equal(await page.locator('#autoSpd').innerText(), '1×');
      await page.click('#autoSpd'); assert.equal(await page.locator('#autoSpd').innerText(), '2×');
      await page.click('#autoSpd'); assert.equal(await page.locator('#autoSpd').innerText(), '4×');
      assert.equal(await page.evaluate(() => localStorage.getItem('dcr_auto_speed')), '4');
      assert.equal(await page.evaluate(() => window.__dbg().auto.on), 1, 'changing speed does not stop Auto');
      await reload(page);
      assert.equal(await page.evaluate(() => window.__dbg.auto.state().speed), 4, 'speed choice survives a reload');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('a tap on the map stops Auto at once and does not also move the player', async () => {
    const { page, ctx, errors } = await fresh('warrior', 13);
    try {
      await page.evaluate(() => { while (window.__dbg.auto.state().speed !== 1) window.__dbg.auto.speed(); });
      await freezeAuto(page);                       // Auto is on but cannot take a turn by itself: only the tap can change anything
      await autoOn(page);
      const before = await snap(page);
      assert.equal(before.on, 1);
      // tap a free floor tile right next to the player (the player is drawn at the middle of the map): a normal tap there would move
      const dir = await page.evaluate(() => { const G = window.__dbg(); return [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => G.map[(G.p.y + dy) * 30 + G.p.x + dx] === 1 && !G.enemies.some((e) => e.x === G.p.x + dx && e.y === G.p.y + dy)); });
      assert.ok(dir, 'a free neighbouring tile');
      const box = await page.locator('#c').boundingBox();
      const ts = Math.max(28, Math.floor(Math.min(box.width, box.height) / 11.5));
      await page.mouse.click(box.x + box.width / 2 + dir[0] * ts, box.y + box.height / 2 + dir[1] * ts);
      const at = await snap(page);
      assert.equal(at.on, 0, 'Auto is off right after the tap');
      assert.deepEqual([at.turn, at.x, at.y], [before.turn, before.x, before.y], 'the tap itself issued no move');
      assert.equal(await page.evaluate(() => window.__dbg.auto.timers()), 0, 'timer cancelled');
      assert.match(await page.evaluate(() => window.__dbg().log.slice(-3).join('|')), /Auto off/);
      // and Auto can be switched on again in the same run
      await fastAuto(page, 30); await autoOn(page);
      await page.waitForFunction((t) => window.__dbg().turn > t, at.turn, { timeout: 15000 });
      assert.equal((await snap(page)).on, 1);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('a tap on a dialog hands control back too; a keypress as well', async () => {
    const { page, ctx } = await fresh('warrior', 14);
    try {
      await freezeAuto(page);
      await page.evaluate(() => { const G = window.__dbg(); G.pending = 1; window.__dbg.auto.start(true); window.__dbg.api.afterModals(); });
      assert.equal(await page.evaluate(modalOpen), true);
      await page.mouse.click(5, 400);   // the dimmed area outside the box
      assert.equal(await page.evaluate(() => window.__dbg().auto.on), 0);
      await closeModal(page);
      await page.evaluate(() => window.__dbg.auto.start(true));
      await page.keyboard.press('ArrowRight');
      const s = await snap(page); assert.equal(s.on, 0);
    } finally { await ctx.close(); }
  });

  it('reload: the run resumes PAUSED and nothing acts until a tap (also from a save that says Auto was on, as after a crash)', async () => {
    const { page, ctx, errors } = await fresh('mage', 15);
    try {
      await fastAuto(page, 30); await autoOn(page);
      await page.waitForFunction(() => window.__dbg().turn >= 3, null, { timeout: 15000 });
      const mid = await snap(page); assert.equal(mid.on, 1);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('dcr_run_v2')).auto.on), 1, 'saved as on');
      const resume = async () => { await reload(page); await page.click('#btnContinue'); await dbgReady(page); await closeModal(page); return snap(page); };   // (Continue re-opens a pending level-up dialog)
      const loaded = await resume();   // (the page being hidden during the reload already paused it)
      assert.equal(loaded.on, 0, 'paused after reload');
      assert.equal(await page.evaluate(() => window.__dbg().auto.used), 1, 'the half-gold flag is kept');
      assert.equal(await page.evaluate(() => window.__dbg.auto.timers()), 0, 'no timer pending: nothing can act');
      assert.equal(await page.locator('#autoSpd').isVisible(), false);
      await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));   // longer than one decision interval at 1x
      assert.equal((await snap(page)).turn, loaded.turn, 'no turn passed on its own');
      await fastAuto(page, 30); await autoOn(page);
      await page.waitForFunction((t) => window.__dbg().turn > t, loaded.turn, { timeout: 15000 });   // Auto play in the menu resumes it
      // crash case: the save still says on=1 (no chance to pause it before the page went away)
      await page.evaluate(() => { window.__dbg.auto.stop('x'); window.__dbg.fn.save(); const o = JSON.parse(localStorage.getItem('dcr_run_v2')); o.auto.on = 1; localStorage.setItem('dcr_run_v2', JSON.stringify(o)); });
      const c = await resume(); assert.equal(c.on, 0);
      assert.match(await page.evaluate(() => window.__dbg().log.slice(-2).join('|')), /Auto is paused/);
      assert.equal(await page.evaluate(() => window.__dbg.auto.timers()), 0);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('exactly one timer survives rapid toggling and speed changes; none when off', async () => {
    const { page, ctx, errors } = await fresh('rogue', 16);
    try {
      const r = await page.evaluate(async () => {
        window.__dbg.tables.BAL.auto.tickMs = 30;
        const live = new Set(), st = window.setTimeout, ct = window.clearTimeout;
        window.setTimeout = function (fn, ms) { const a = [].slice.call(arguments, 2), id = st(function () { live.delete(id); fn.apply(null, a); }, ms); if (fn && fn.name === 'autoTick') live.add(id); return id; };
        window.clearTimeout = function (id) { live.delete(id); return ct(id); };
        const btn = document.getElementById('autoBtn'), spd = document.getElementById('autoSpd'), out = [];
        for (let i = 0; i < 30; i++) { btn.click(); if (i % 3 === 0 && spd.offsetParent) spd.click(); }   // 30 clicks: ends OFF
        out.push(['after 30 toggles', window.__dbg().auto.on, live.size, window.__dbg.auto.timers()]);
        btn.click(); out.push(['on', window.__dbg().auto.on, live.size, window.__dbg.auto.timers()]);
        for (let i = 0; i < 5; i++) spd.click();
        window.__dbg.auto.toggle(); window.__dbg.auto.toggle(); window.__dbg.auto.toggle(); window.__dbg.auto.toggle();
        out.push(['on again', window.__dbg().auto.on, live.size, window.__dbg.auto.timers()]);
        const t0 = window.__dbg().turn; await new Promise((r) => { const w = () => (window.__dbg().turn >= t0 + 3 ? r() : st(w, 10)); w(); });
        out.push(['after 3 turns', window.__dbg().auto.on, live.size, window.__dbg.auto.timers()]);
        btn.click(); out.push(['off', window.__dbg().auto.on, live.size, window.__dbg.auto.timers()]);
        window.setTimeout = st; window.clearTimeout = ct;
        return out;
      });
      assert.deepEqual(r.map((x) => x.slice(1)), [[0, 0, 0], [1, 1, 1], [1, 1, 1], [1, 1, 1], [0, 0, 0]], JSON.stringify(r));
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('a hidden page switches Auto off (resuming paused); finishing the run switches it off', async () => {
    const { page, ctx } = await fresh('warrior', 17);
    try {
      await freezeAuto(page);
      await autoOn(page);
      assert.equal(await page.evaluate(() => window.__dbg().auto.on), 1);
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      assert.equal(await page.evaluate(() => window.__dbg().auto.on), 0);
      assert.match(await page.evaluate(() => window.__dbg().log.slice(-2).join('|')), /hidden/);
      assert.equal(await page.evaluate(() => window.__dbg.auto.timers()), 0);
      await page.evaluate(() => { delete document.hidden; });
      await autoOn(page);
      await page.evaluate(() => window.__dbg.api.finish('abandon'));
      assert.deepEqual(await page.evaluate(() => [window.__dbg().auto.on, window.__dbg.auto.timers(), window.__dbg().over]), [0, 0, true]);
      assert.equal(await page.locator('#autoBox').isVisible(), false, 'no Auto control on the recap');
    } finally { await ctx.close(); }
  });

  it('watchdog: a contrived stuck state (sealed in, nothing to do) switches Auto off with the reason in the log', async () => {
    const { page, ctx } = await fresh('warrior', 18);
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, G = D(), A = D.auto;
        D.tables.BAL.auto.stuckTurns = 25;
        const p = G.p; G.enemies = []; G.items = []; G.merchant = null; G.shrine = null; G.traps = [];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) G.map[(p.y + dy) * 30 + p.x + dx] = 0;
        D.fn.computeVis();
        A.start(true);
        let n = 0; while (A.state().on && !G.over && n++ < 400) A.step();
        return { on: G.auto.on, turns: G.turn, stop: A.state().lastStop, log: G.log.slice(-2).join('|') };
      });
      assert.equal(r.on, 0);
      assert.match(r.stop, /no progress for 25 turns/);
      assert.match(r.log, /Auto stopped: no progress/);
      assert.ok(r.turns < 60, 'tripped soon after the limit: ' + r.turns);
    } finally { await ctx.close(); }
  });

  it('watchdog: decisions that use no turn (every action refused) also switch Auto off', async () => {
    const { page, ctx } = await fresh('warrior', 19);
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, G = D(), A = D.auto, out = [];
        A.start(true);
        for (let i = 0; i < 20; i++) { out.push(A.watch(G.turn, G.floor)); }   // twenty decisions in a row that changed neither turn nor floor nor opened a dialog
        return out;
      });
      assert.equal(r[0], '', 'one idle decision is fine');
      assert.match(r.find((x) => x) || '', /no effect/);
      assert.ok(r.findIndex((x) => x) < 14, 'trips after the idle limit: ' + r.findIndex((x) => x));
    } finally { await ctx.close(); }
  });

  // ---------------------------------------------------------------------------------------------------- dialogs
  it('perk: takes the first perk of the class priority list; the dialog closes by itself', async () => {
    const { page, ctx } = await fresh('warrior', 21);
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, G = D(), A = D.auto;
        G.pending = 1; A.start(true); D.api.afterModals();
        const kind = document.getElementById('modalBox').dataset.kind, before = Object.keys(G.perks).length;
        let n = 0; while (document.getElementById('modal').style.display !== 'none' && n++ < 10) A.step();
        return { kind, closed: document.getElementById('modal').style.display === 'none', before, after: Object.keys(G.perks).length, pending: G.pending, log: G.log.join('|') };
      });
      assert.equal(r.kind, 'perk'); assert.ok(r.closed); assert.equal(r.after, r.before + 1); assert.equal(r.pending, 0);
      assert.match(r.log, /Auto: takes perk/);
    } finally { await ctx.close(); }
  });

  it('gear: equips a clearly better weapon, leaves a worse one, never equips another class\'s off-hand', async () => {
    const { page, ctx } = await fresh('mage', 22);
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, G = D(), A = D.auto, p = G.p, out = {};
        const open = () => document.getElementById('modal').style.display !== 'none';
        const stepOnto = (xy) => { D.fn.tryMove(xy[0] - p.x, xy[1] - p.y); };
        const settle = () => { let n = 0; while (open() && n++ < 8) A.step(); };
        A.start(true);
        let xy = D.spawnGear('weapon', 'sword', null, 14); stepOnto(xy); out.gearOpen = open() && document.getElementById('modalBox').dataset.kind === 'gear'; settle();
        out.weaponV = p.eq.weapon.v; out.k1 = p.eq.weapon.k;
        xy = D.spawnGear('weapon', 'axe', null, 0); stepOnto(xy); settle();   // clearly worse
        out.weaponV2 = p.eq.weapon.v;
        xy = D.spawnGear('off', 'tower', null, 0); stepOnto(xy); settle();      // warrior shield, mage cannot use it
        out.off = p.eq.off ? p.eq.off.k : null;
        xy = D.spawnGear('off', 'tome', null, 0); stepOnto(xy); settle();       // the mage's own
        out.off2 = p.eq.off ? p.eq.off.k : null;
        out.modalClosed = !open();
        return out;
      });
      assert.ok(r.gearOpen); assert.equal(r.weaponV, 14); assert.equal(r.weaponV2, 14, 'worse weapon left');
      assert.equal(r.off, null, 'class-locked off-hand not equipped'); assert.equal(r.off2, 'tome'); assert.ok(r.modalClosed);
    } finally { await ctx.close(); }
  });

  it('path: plain floor by default, a rewarding modifier only when HP is high', async () => {
    const { page, ctx } = await fresh('warrior', 23);
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, G = D(), A = D.auto, p = G.p, out = [];
        A.start(true);
        for (const [hp, label] of [[1, 'high'], [0.5, 'low']]) {
          D.fn.newFloor(2, { mod: null, v: 0 }); G.enemies = []; G.items = [];
          G.opts = [{ mod: null, v: 0 }, { mod: 'rich', v: 1 }];
          p.hp = Math.round(p.mhp * hp); G.map[p.y * 30 + p.x] = 2;
          D.fn.descend();
          const kind = document.getElementById('modalBox').dataset.kind;
          let n = 0; while (document.getElementById('modal').style.display !== 'none' && n++ < 6) A.step();
          out.push([label, kind, G.floor, G.mod]);
          document.getElementById('modal').style.display = 'none';
        }
        // both modified, low HP: falls back to the safest
        D.fn.newFloor(3, { mod: null, v: 0 }); G.enemies = []; G.opts = [{ mod: 'horde', v: 0 }, { mod: 'silent', v: 1 }];
        p.hp = Math.round(p.mhp * 0.4); G.map[p.y * 30 + p.x] = 2; D.fn.descend();
        let n = 0; while (document.getElementById('modal').style.display !== 'none' && n++ < 6) A.step();
        out.push(['safest', G.floor, G.mod]);
        return out;
      });
      assert.deepEqual(r[0], ['high', 'path', 3, 'rich'], JSON.stringify(r));
      assert.deepEqual(r[1], ['low', 'path', 3, null], JSON.stringify(r));
      assert.deepEqual(r[2], ['safest', 4, 'silent'], JSON.stringify(r));
    } finally { await ctx.close(); }
  });

  it('shrine: only the safe option (blessing, else leave); merchant: potions first and paid for, then leaves', async () => {
    const { page, ctx } = await fresh('warrior', 24, { seenHelp: 1, gold: 0, unl: { rogue: 1, mage: 1, shrine: 1 } });
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, G = D(), A = D.auto, p = G.p, out = {};
        const open = () => document.getElementById('modal').style.display !== 'none';
        const settle = () => { let n = 0; while (open() && n++ < 30) A.step(); };
        G.enemies = []; A.start(true);
        p.hp = 10; G.shrine = { x: p.x, y: p.y, used: 0, left: 0 }; D.api.showShrine();
        out.shrineKind = document.getElementById('modalBox').dataset.kind; settle();
        out.shrineClosed = !open(); out.shrineHp = p.hp; out.shrineUsed = G.shrine.used; out.def = p.def;
        // merchant with a stocked shelf
        p.gold = 100; G.inv.pot = 0;
        G.merchant = { x: p.x + 1, y: p.y, stock: [
          { k: 'fire', n: '📜 Flame scroll', d: 'x', price: 20 },
          { k: 'pot', n: '🧪 Health potion', d: 'x', price: 10 },
          { k: 'pot', n: '🧪 Health potion', d: 'x', price: 10 },
          { k: 'elixir', n: '🧿 Elixir of Vigor', d: 'x', price: 30 }] };
        D.api.showShop(); out.shopKind = document.getElementById('modalBox').dataset.kind;
        const order = []; let n = 0;
        while (open() && n++ < 40) { const was = G.merchant.stock.map((s) => !!s.sold).join(); A.step(); const now = G.merchant.stock.map((s) => !!s.sold).join(); if (was !== now) order.push(G.merchant.stock.findIndex((s, i) => s.sold && was.split(',')[i] === 'false')); }
        out.order = order; out.shopClosed = !open(); out.pots = G.inv.pot; out.gold = p.gold;
        out.spent = G.merchant.stock.filter((s) => s.sold).reduce((a, s) => a + s.price, 0);
        return out;
      });
      assert.equal(r.shrineKind, 'shrine'); assert.ok(r.shrineClosed); assert.equal(r.shrineUsed, 1);
      assert.ok(r.shrineHp > 10 && r.def >= 3 + 1, 'took the blessing (heal + defense), not a gamble');
      assert.equal(r.shopKind, 'shop'); assert.ok(r.shopClosed);
      assert.deepEqual(r.order.slice(0, 2), [1, 2], 'potions bought first'); assert.equal(r.pots, 2);
      assert.ok(r.spent >= 20); assert.equal(r.gold, 100 - r.spent, 'buying costs gold');
    } finally { await ctx.close(); }
  });

  it('a flashed dialog shows the pick (highlighted) for the flash time at 1x, then closes; one log line per choice', async () => {
    const { page, ctx, errors } = await fresh('warrior', 25);
    try {
      await page.evaluate(() => { while (window.__dbg.auto.state().speed !== 1) window.__dbg.auto.speed(); window.__dbg().pending = 1; window.__dbg.auto.start(false); window.__dbg.api.afterModals(); });
      // from the moment the choice is highlighted until the dialog closes. Timestamps are taken by MutationObservers, which run right after
      // the task that changed the DOM, so a busy machine cannot make the measurement shorter than the real time (a lower bound only).
      const r = await page.evaluate(() => new Promise((res) => {
        const m = document.getElementById('modal'), picks = () => m.querySelectorAll('#modalBox button.autopick').length;
        let t0 = null, maxPicks = 0;
        const mo = new MutationObserver(() => {
          maxPicks = Math.max(maxPicks, picks());
          if (t0 === null && picks() === 1) t0 = performance.now();
          if (t0 !== null && m.style.display === 'none') { mo.disconnect(); res({ ms: performance.now() - t0, maxPicks, flash: window.__dbg.tables.BAL.auto.flashMs }); }
        });
        mo.observe(m, { attributes: true, subtree: true, childList: true });
      }));
      assert.equal(r.maxPicks, 1, 'exactly one button is highlighted');
      assert.ok(r.ms >= r.flash * 0.8, `the pick stays visible for about ${r.flash} ms (saw ${Math.round(r.ms)})`);
      assert.equal(await page.evaluate(() => window.__dbg().log.filter((l) => /^Auto: takes perk/.test(l)).length), 1);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // ---------------------------------------------------------------------------------------------------- rewards and records
  it('half gold is banked for an Auto run (full for a manual one); the recap says so; records and the daily still count and carry an Auto tag', async () => {
    const { page, ctx } = await fresh('warrior', 31);
    try {
      const man = await page.evaluate(() => {
        const D = window.__dbg, G = D(), m = D.api.meta(); G.p.gold = 101; const g0 = m.gold; D.api.finish('abandon');
        return { banked: m.gold - g0, text: document.getElementById('modalBox').textContent, recap: !!document.getElementById('autoRecap') };
      });
      assert.equal(man.banked, 101); assert.equal(man.recap, false);
      await page.evaluate(() => { document.getElementById('modalBox').querySelector('button').click(); });
      await startRun(page, 'warrior'); await closeModal(page);
      const aut = await page.evaluate(() => {
        const D = window.__dbg, G = D(), m = D.api.meta();
        D.auto.start(true); D.auto.step(); D.auto.step(); G.p.gold = 101; const g0 = m.gold, runs0 = m.runs;
        D.api.finish('abandon');
        return { banked: m.gold - g0, text: document.getElementById('modalBox').textContent, recap: !!document.getElementById('autoRecap'), aruns: m.rec.n.warrior.aruns, runs: m.runs - runs0, on: G.auto.on };
      });
      assert.equal(aut.banked, 51, 'round(101 * 0.5)');
      assert.equal(aut.recap, true); assert.match(aut.text, /Auto run: half gold/);
      assert.equal(aut.aruns, 1); assert.equal(aut.runs, 1, 'the run counts in the records'); assert.equal(aut.on, 0);
      const lists = await page.evaluate(() => { document.getElementById('modalBox').querySelector('button').click(); window.__dbg.mods.showRecords(); return document.getElementById('titleBox').innerHTML; });
      assert.match(lists, /Auto<\/em>/, 'Records list shows the Auto tag');
    } finally { await ctx.close(); }
  });

  it('the one-time notice appears the first time Auto is switched on in a run and not again', async () => {
    const { page, ctx } = await fresh('rogue', 32);
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, G = D(), A = D.auto, cnt = () => G.log.filter((l) => /Auto runs bank half gold/.test(l)).length;
        A.start(true); const a = cnt(); A.stop('x'); A.start(true); A.stop('y'); A.start(true);
        return { a, b: cnt(), toast: document.getElementById('toast').textContent };
      });
      assert.equal(r.a, 1); assert.equal(r.b, 1); assert.match(r.toast, /half gold/);
    } finally { await ctx.close(); }
  });

  it('a Daily run played by Auto keeps its result and is tagged Auto', async () => {
    const { page, ctx } = await newPage(browser, { seed: 33, meta: META, fakeDate: [2026, 5, 6] });
    try {
      await page.locator('#title button', { hasText: /Daily/ }).click();
      await page.locator('#title button', { hasText: /Warrior/ }).click();
      await dbgReady(page); await closeModal(page);
      const r = await page.evaluate(() => {
        const D = window.__dbg, G = D(), m = D.api.meta();
        D.auto.start(true); D.auto.runSync(300); const f = G.floor; D.api.finish('abandon');
        const d = m.dly[G.daily]; return { daily: G.daily, d: d, f: f };
      });
      assert.equal(r.d.auto, 1); assert.ok(r.d.score > 0);
    } finally { await ctx.close(); }
  });

  // ---------------------------------------------------------------------------------------------------- saves and layout
  it('an older run save without the auto field continues fine (defaults, paused)', async () => {
    const { page, ctx, errors } = await fresh('warrior', 41);
    try {
      await page.evaluate(() => { window.__dbg.fn.save(); const o = JSON.parse(localStorage.getItem('dcr_run_v2')); delete o.auto; localStorage.setItem('dcr_run_v2', JSON.stringify(o)); });
      await reload(page); await page.click('#btnContinue'); await dbgReady(page);
      assert.deepEqual(await page.evaluate(() => window.__dbg().auto), { on: 0, used: 0, noticed: 0 });
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('390x844: the Auto strip (indicator, speed, stop) is in the top bar, >=44px, off the map; only the modifier icon is on the map; no page scroll', async () => {
    const { page, ctx } = await fresh('warrior', 42);
    try {
      await freezeAuto(page);   // layout only: Auto is switched on but takes no turn, so no dialog can appear
      await page.evaluate(() => { const G = window.__dbg(); G.daily = '2026-01-01'; G.hard = 1; G.mod = 'cursed'; });
      await autoOn(page); await page.click('#autoSpd');
      await page.waitForFunction(() => document.getElementById('autoTag').offsetParent !== null && document.querySelectorAll('#chips .chip').length === 1);
      const L = await page.evaluate(() => {
        const r = (e) => { const b = (typeof e === 'string' ? document.querySelector(e) : e).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
        return { btn: r('#autoBtn'), spd: r('#autoSpd'), tag: r('#autoTag'), chip: r('#chips .chip'), hud: r('#hud'), log: r('#log'), cv: r('#cv'), stats: document.getElementById('stats').textContent,
          onMap: document.querySelectorAll('#cv button').length, scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] };
      });
      assert.ok(L.btn.h >= 44 && L.btn.w >= 44 && L.spd.h >= 44 && L.spd.w >= 44 && L.chip.h >= 44 && L.chip.w >= 44);
      assert.ok(L.btn.b <= L.hud.b + 0.5 && L.spd.b <= L.hud.b + 0.5 && L.hud.b <= L.cv.t + 0.5, 'the Auto strip is in the top bar, above the map');
      assert.ok(L.btn.r <= 391 && L.spd.l >= L.tag.r, 'indicator, speed and stop fit side by side');
      assert.equal(L.onMap, 1, 'the map carries one button: the modifier icon');
      assert.match(L.stats, /📅/); assert.match(L.stats, /💀/);   // Daily / Hard moved to the top bar
      assert.ok(L.cv.b <= L.log.t + 0.5 && L.cv.r <= 391);
      assert.deepEqual(L.scroll, [390, 844]);
    } finally { await ctx.close(); }
  });
});
