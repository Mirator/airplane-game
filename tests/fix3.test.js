// Fix pass 3 (play-test 2 findings): the expedition economy gate, upgrade / pair / blueprint / Heat texts, screen layout and grace, Explore around cracks and dropped gear.
// Every test names the finding it guards. Several assertions per page load (a page costs ~0.3 s).
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, openRun, closeModal, dbgReady, quiet, HELPERS, CONC, reload } = require('./lib/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const BASE = { seenHelp: 1, gold: 0, unl: { rogue: 1, mage: 1 } };
const H = 3600000;
const txt = (page, sel) => page.locator(sel).innerText();

describe('fix3: expedition economy', { concurrency: CONC }, () => {
  it('P1: income is gated by the best floor reached BY HAND: the table of 8 h pay, floors never exceed the gate, Auto stairs do not raise it, old saves and in-flight trips resolve', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 21, meta: { ...BASE, gold: 0 } });
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, I = D.idle, m = D.api.meta(), out = {}, H = 3600000;
        out.best0 = I.expBest();
        const est = (b, pw, d) => I.expEstimate('warrior', d || 480, pw, b), max = I.upMaxSpent();
        out.tab = { b1: est(1, 0), b2: est(2, 0), b4mid: est(4, 800), b4heavy: est(4, 3000), b8heavy: est(8, 3000), b8max: est(8, max), b8fresh: est(8, 0) };
        out.rate = [30, 120, 480].map((d) => est(5, 800, d) / (d / 60));   // gold per hour: 30 min best, 8 h the base
        out.tot = [30, 120, 480].map((d) => est(5, 800, d));
        // measured, not only estimated: the mean of real outcomes over many seeds follows the estimate, whatever the class
        let g = 0, n = 0, deep = 0; const cls = ['warrior', 'mage', 'rogue'];
        for (let s = 0; s < 150; s++) { const rec = { cls: cls[s % 3], dur: 480, t0: 1e12, seed: s * 977, pw: 800, bf: 4 }, x = I.expResult(rec, 1e12 + 8 * H); g += x.gold; n++; deep = Math.max(deep, x.floor); }
        out.mean = g / n; out.est4 = est(4, 800); out.deep = deep;
        // the gate: the hero never goes deeper than bf, even when the table says it could
        out.gate = [1, 2, 3, 6].map((b) => { let mx = 0; for (let s = 0; s < 60; s++) mx = Math.max(mx, I.expResult({ cls: 'mage', dur: 480, t0: 1e12, seed: s, pw: 16000, bf: b }, 1e12 + 8 * H).floor); return [b, mx]; });
        // manual stairs raise the best floor; the same call made by Auto does not
        D.fn.startRun('warrior'); document.getElementById('modal').style.display = 'none';
        const G = D(); out.start = m.bestM; D.fn.goDown({ mod: null, v: 0 }); out.afterHand = m.bestM;
        const A = D.auto.state(); A.self = true; D.fn.goDown({ mod: null, v: 0 }); A.self = false; out.afterAuto = [m.bestM, G.floor];
        // an in-flight trip from before the gate (no bf) and a damaged bf resolve without error and follow the current best floor
        m.exp.run[0] = { cls: 'rogue', dur: 120, t0: Date.now() - 3 * H, seed: 5, pw: 100 };
        const old = I.expResult(m.exp.run[0], Date.now()); out.old = [old.gold, old.floor];
        m.exp.run[1] = { cls: 'mage', dur: 30, t0: Date.now() - 3 * H, seed: 6, pw: 100, bf: 'x' }; I.cleanMeta(); out.cleaned = m.exp.run.map((x) => x && x.bf);
        return out;
      });
      assert.equal(r.best0, 1, 'a player who never played has best floor 1');
      assert.ok(r.tab.b1 >= 60 && r.tab.b1 <= 120 && r.tab.b2 >= 60 && r.tab.b2 <= 120, 'brand-new player 60-120 per 8 h: ' + JSON.stringify(r.tab));
      assert.ok(r.tab.b4mid >= 400 && r.tab.b4mid <= 600, 'best floor 4, mid upgrades: ' + r.tab.b4mid);
      assert.ok(r.tab.b8heavy >= 1000 && r.tab.b8heavy <= 1400, 'dragon reached, heavy upgrades: ' + r.tab.b8heavy);
      assert.ok(r.tab.b8max >= 1500 && r.tab.b8max <= 2000, 'maxed: ' + r.tab.b8max);
      assert.ok(r.tab.b8fresh < r.tab.b8heavy && r.tab.b4heavy > r.tab.b4mid, 'more upgrades, more gold');
      assert.ok(r.rate[0] > r.rate[1] && r.rate[1] > r.rate[2], '30 min is the best rate per hour: ' + r.rate); assert.ok(r.tot[0] < r.tot[1] && r.tot[1] < r.tot[2], '8 h the best total');
      assert.ok(Math.abs(r.mean / r.est4 - 1) < 0.1, 'real outcomes average the shown estimate: ' + r.mean + ' vs ' + r.est4); assert.ok(r.deep <= 4, 'floors <= gate: ' + r.deep);
      for (const [b, mx] of r.gate) assert.ok(mx <= b && mx >= 1, 'gate ' + b + ' -> deepest ' + mx);
      assert.equal(r.start, 0); assert.equal(r.afterHand, 2, 'stairs taken by hand raise the best floor'); assert.deepEqual(r.afterAuto, [2, 3], 'the same stairs taken by Auto do not (floor 3 reached, best by hand stays 2)');
      assert.ok(r.old[0] > 0 && r.old[1] >= 1 && r.old[1] <= 2, 'an in-flight trip without bf resolves: ' + r.old); assert.deepEqual(r.cleaned, [0, 0]);
      // a save from before the gate keeps its deepest floor as the gate
      const b = await newPage(browser, { seed: 22, meta: { ...BASE, best: 5, wins: 0 } });
      try { assert.equal(await b.page.evaluate(() => window.__dbg.api.meta().bestM), 5); assert.equal(await b.page.evaluate(() => window.__dbg.idle.expBest()), 5); assert.deepEqual(b.errors, []); } finally { await b.ctx.close(); }
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('screens: the send screen says how deep heroes go and prices follow it; a double tap on "Send a hero" sends nothing; Recall asks first and says what it pays; a clock set back never adds time; the title pill follows the clock', async () => {
    const t0 = Date.now();
    const meta = { ...BASE, gold: 700, best: 3, exp: { s2: 1, run: [null, { cls: 'mage', dur: 120, t0: t0 + 24 * H, seed: 3, pw: 0, bf: 3 }], rep: null } };
    const { page, ctx, errors } = await newPage(browser, { seed: 23, meta, grace: true });
    try {
      // clock set back: the trip started "tomorrow"; the card never shows more than the trip length
      assert.match(await txt(page, '#btnExp .pill'), /^2h 00m$/, 'title pill: never more than the 2 h trip, not 26 h');
      await page.locator('#btnExp').click();
      assert.match(await txt(page, '.xslot[data-slot="1"] .xt'), /^Back in 2h 00m$/);
      assert.equal(await page.locator('#btnSlot2').count(), 0);
      // send screen (slot 0), double tap: first tap opens it, a second one 100 ms later must not dispatch
      const send = page.locator('[data-send="0"]'); const box = await send.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForSelector('#expGate');
      assert.match(await txt(page, '#expGate'), /Heroes go as deep as you have: floor 3\./); assert.ok((await txt(page, '#expGate')).length <= 55);
      await page.waitForTimeout(60);
      const d30 = await page.locator('[data-dur="30"]').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);   // same spot as the first tap
      await page.mouse.click(d30.x + 20, d30.y + 20);                          // and right on the 30 min button
      await page.waitForTimeout(80);
      assert.equal(await page.evaluate(() => window.__dbg.api.meta().exp.run[0]), null, 'nothing was dispatched by a hurried second tap');
      assert.equal(await page.locator('#btnBack').count(), 1, 'still on the send screen');
      const est = await page.evaluate(() => [window.__dbg.idle.expEstimate('mage', 30, 0, 3), window.__dbg.idle.expEstimate('mage', 480, 0, 3)]);
      assert.match(await txt(page, '[data-dur="30"]'), new RegExp('about ' + est[0]));
      assert.match(await txt(page, '[data-dur="480"]'), new RegExp('about ' + est[1]));
      await page.waitForTimeout(450);
      await page.locator('[data-dur="30"]').click();
      assert.equal(await page.evaluate(() => window.__dbg.api.meta().exp.run[0].dur), 30, 'a deliberate tap after the grace sends');
      assert.equal(await page.evaluate(() => window.__dbg.api.meta().exp.run[0].bf), 3, 'the gate is stored');
      // Recall: the first tap asks, the second pays; recalled at once there was no delve and the report says so
      const rc = page.locator('[data-collect="0"]');
      await rc.click(); assert.match(await rc.innerText(), /Recall: pays \d+\. Tap again/); assert.notEqual(await page.evaluate(() => window.__dbg.api.meta().exp.run[0]), null, 'not recalled yet');
      await rc.click();
      const body = await txt(page, '#titleBox');
      assert.match(body, /Recalled before the first delve/); assert.doesNotMatch(body, /Too short/); assert.doesNotMatch(body, /Deaths/); assert.match(body, /Delves/);
      await page.locator('#btnDone').click(); await page.locator('#btnBack').click();
      // the title pill: a trip with ~60.5 s left says 2m, then 1m without leaving the screen
      await page.evaluate(() => { const m = window.__dbg.api.meta(); m.exp.run[0] = { cls: 'warrior', dur: 30, t0: Date.now() - 30 * 60000 + 60500, seed: 1, pw: 0, bf: 1 }; m.exp.run[1] = null; window.__dbg.api.showTitle(); });
      assert.match(await txt(page, '#btnExp .pill'), /^2m$/);
      await page.waitForFunction(() => /^1m$/.test(document.querySelector('#btnExp .pill').textContent), null, { timeout: 4000 });
      await page.evaluate(() => { window.__dbg.api.meta().exp.run[0].t0 = Date.now() - 30 * 60000 + 1500; });   // 1.5 s to go
      await page.waitForFunction(() => /Ready/.test(document.querySelector('#btnExp .pill').textContent), null, { timeout: 4000 });
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});

describe('fix3: shop, Heat, blueprints', { concurrency: CONC }, () => {
  it('upgrades: every card states the gain of its next level truthfully (whole numbers, never +2/+1/+2), pairs say what each option does before the first purchase, plural, price does not wrap', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 24, meta: { ...BASE, gold: 50000 } });
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, I = D.idle, m = D.api.meta(), rows = [];
        for (const u of I.UPG) {
          const steps = []; let bad = null;
          for (let l = 0; l < I.upMax(u); l++) {
            m.up[u.k] = l; I.showUpgrades('upg');
            const card = document.querySelector('button[data-up="' + u.k + '"]'), t = card.innerText, mm = t.match(/next \+(\d+)/);
            const before = I.upBonus(u.k); m.up[u.k] = l + 1; const gain = I.upBonus(u.k) - before; steps.push(gain);
            if (!mm || +mm[1] !== gain) bad = [u.k, l, t, gain];
          }
          rows.push({ k: u.k, steps, bad });
        }
        m.up = {}; m.pv = {}; I.showUpgrades('upg');
        const pairs = [...document.querySelectorAll('.pair')].map((p) => ({ main: p.querySelector('button[data-up]').innerText, other: p.querySelector('.pdesc').innerText, k: p.dataset.pair }));
        m.up.pot = 2; m.up.hp = 1; I.showUpgrades('upg');
        const pot = document.querySelector('button[data-up="pot"]').innerText;
        const gold = [...document.querySelectorAll('#titleBox .gold')].every((e) => getComputedStyle(e).whiteSpace === 'nowrap');
        return { rows, pairs, pot, gold, lens: [...document.querySelectorAll('#titleBox button, #titleBox .pdesc')].map((e) => e.innerText.split('\n').slice(1).join(' ')).filter((x) => x.length > 0).map((x) => x.length) };
      });
      for (const x of r.rows) { assert.equal(x.bad, null, 'card text == real gain: ' + JSON.stringify(x.bad)); for (let i = 1; i < x.steps.length; i++) assert.ok(x.steps[i] <= x.steps[i - 1], x.k + ' gains never go up again: ' + x.steps); assert.ok(x.steps.every((g) => g >= 1 && Number.isInteger(g)), x.k + ' whole steps: ' + x.steps); }
      assert.deepEqual(r.rows.find((x) => x.k === 'hp').steps, [8, 8, 8, 8, 8, 5, 5, 5]);
      const mainOf = (k) => r.pairs.find((p) => p.k === k);
      assert.match(mainOf('edge').main, /Keen \+2% crit per level/); assert.match(mainOf('edge').other, /Swap: Vicious \+2% damage per level/);
      assert.match(mainOf('vigor').main, /Regrowth .*HP healed per floor per level/); assert.match(mainOf('vigor').other, /Lifedrinker/);
      assert.match(mainOf('prep').main, /Flames \+1 starting Flames/); assert.match(mainOf('prep').other, /Teleport \+1 starting Teleport/);
      assert.match(r.pot, /\+2 potions/); assert.ok(r.gold, 'price + coin never wrap apart');
      assert.ok(r.lens.every((n) => n <= 72), 'lines stay short: ' + r.lens.filter((n) => n > 72));
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('a migrated save: the shop shows the totals the player really has (veteran bonus included) and a run starts with exactly those', async () => {
    const old = { seenHelp: 1, gold: 9000, hp: 7, atk: 5, pot: 3, goldp: 7, def: 2, wins: 1, best: 4, unl: { rogue: 1, mage: 1 } };
    const { page, ctx, errors } = await newPage(browser, { seed: 25, meta: old });
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, I = D.idle; I.showUpgrades('upg');
        const card = (k) => document.querySelector('button[data-up="' + k + '"]').innerText.replace(/\s+/g, ' ');
        const cards = { hp: card('hp'), atk: card('atk'), pot: card('pot'), goldp: card('goldp'), def: card('def') };
        D.fn.startRun('warrior', { heat: 0 }); document.getElementById('modal').style.display = 'none';
        const G = D(), C = D.tables.CLS.warrior;
        return { cards, bonus: { hp: G.p.mhp - C.hp, atk: G.p.atk - C.atk, def: G.p.def - C.def, pots: G.inv.pot, gm: Math.round((G.p.goldMul - 1) * 100) } };
      });
      assert.match(r.cards.hp, new RegExp('\\+' + r.bonus.hp + ' HP'), 'Hardy shows its real total: ' + r.cards.hp + ' vs ' + r.bonus.hp);
      assert.match(r.cards.hp, /\(incl\. \d+ veteran\)/);
      assert.match(r.cards.atk, new RegExp('\\+' + r.bonus.atk + ' attack')); assert.match(r.cards.def, new RegExp('\\+' + r.bonus.def + ' defense'));
      assert.match(r.cards.goldp, new RegExp('\\+' + r.bonus.gm + '% gold')); assert.match(r.cards.pot, new RegExp('\\+' + (r.bonus.pots - 1) + ' potions'));
      assert.equal(r.bonus.hp, 56); assert.equal(r.bonus.atk, 5); assert.equal(r.bonus.gm, 105);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('Heat picker: labelled, lists every active rule of the selected level, a lock says why, the run shows the word Heat', async () => {
    const meta = { ...BASE, wins: 3, best: 8, heat: 2, heatSel: 3 };
    const { page, ctx, errors } = await newPage(browser, { seed: 26, meta });
    try {
      await page.locator('#btnNew').click();
      assert.match(await txt(page, '#heatLbl'), /^Heat/, 'the row has a label');
      assert.equal(await page.locator('#heatRow button.on').count(), 1);
      // selected 2 (3 is locked and was clamped): Hard rules + Reinforced
      const info = await txt(page, '#heatInfo');
      assert.match(info, /Heat 2 · Reinforced/); assert.match(info, /Hard: tougher foes, scarce potions, brood mother/i); assert.match(info, /Reinforced: \+2 foes/); assert.doesNotMatch(info, /Iron elites:/, 'Heat 3 rules are not active at Heat 2');
      assert.match(info, /×1\.75/); assert.match(info, /win a run at Heat 2 for Heat 3/i);
      // a lock is tappable and says why; nothing else changes
      const locks = page.locator('#heatRow button.locked');
      assert.equal(await locks.count(), 3);
      await locks.nth(0).click({ force: true }); assert.match(await txt(page, '#heatInfo'), /Heat 3 is locked\. Win a run at Heat 2 to unlock Heat 3\./);
      await locks.nth(1).click({ force: true }); assert.match(await txt(page, '#heatInfo'), /Heat 4 is locked\. Unlock Heat 3 first\./);
      assert.equal(await page.evaluate(() => window.__dbg.idle.heatSel()), 2, 'a locked level is never selected');
      const bs = await page.locator('#heatRow button').evaluateAll((b) => b.map((e) => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }));
      assert.ok(bs.every(([w, h]) => w >= 44 && h >= 44), 'tap targets');
      await page.locator('#heatRow button[data-heat="0"]').click(); assert.match(await txt(page, '#heatInfo'), /Heat 0 · Normal[\s\S]*standard dungeon/);
      await page.locator('#heatRow button[data-heat="2"]').click();
      await page.locator('#title button', { hasText: /Warrior/ }).first().click(); await dbgReady(page); await closeModal(page);
      assert.match(await page.locator('#stats').innerText(), /Heat 2/, 'the stat row says the word');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('blueprint cards say what kind of item it is and which class can use it; weapon stats are relative to a Sword; Bought, not Unlocked', async () => {
    const meta = { ...BASE, gold: 1000, bp: { garrote: 1, focus: 1, viper: 1, gilded: 1, stalker: 1, warcry: 2 } };
    const { page, ctx, errors } = await newPage(browser, { seed: 27, meta });
    try {
      await page.evaluate(() => window.__dbg.idle.showUpgrades('bp'));
      const card = async (id) => (await page.locator('button[data-bp="' + id + '"]').innerText()).replace(/\s+/g, ' ');
      assert.match(await card('garrote'), /Garrote OFF-HAND · ROGUE ONLY|Garrote Off-hand · Rogue only/i);
      assert.match(await card('focus'), /Off-hand · Mage only/i); assert.match(await card('viper'), /Weapon · any class/i);
      assert.match(await card('viper'), /-2 attack vs Sword/); assert.match(await card('gilded'), /Charm · any class/i);
      assert.match(await card('stalker'), /Perk · any class/i); assert.match(await card('warcry'), /Perk · Warrior only/i); assert.match(await card('warcry'), /Bought/);
      assert.doesNotMatch(await txt(page, '#titleBox'), /Unlocked/); assert.match(await txt(page, '#titleBox'), /Found 6\/20 · Bought 1/);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});

describe('fix3: layout', { concurrency: CONC }, () => {
  for (const [w, h] of [[390, 844], [360, 640]]) {
    it(`Back on Upgrades / Blueprints / Expeditions is fully on screen and covers no row at the end of the list (${w}x${h})`, async () => {
      const bp = {}; for (const b of ['garrote', 'focus', 'viper', 'gilded', 'rapier', 'maul', 'warbanner', 'stalker']) bp[b] = 1;
      const { page, ctx, errors } = await newPage(browser, { seed: 28, w, h, meta: { ...BASE, gold: 300, bp } });
      try {
        const probe = (tab) => page.evaluate((tab) => {
          const I = window.__dbg.idle; tab === 'exp' ? I.showExpeditions() : I.showUpgrades(tab);
          const box = document.getElementById('titleBox'), res = {};
          const ov = document.getElementById('title');
          const at = (top) => { box.scrollTop = top; const b = document.getElementById('btnBack').getBoundingClientRect(), bb = box.getBoundingClientRect(); const rows = [...box.children].filter((e) => e.id !== 'btnBack'), last = rows[rows.length - 1].getBoundingClientRect(); return { backBottom: b.bottom, backTop: b.top, boxBottom: bb.bottom, boxTop: bb.top, h: b.height, lastBottom: last.bottom, overlap: Math.max(0, Math.min(last.bottom, b.bottom) - Math.max(last.top, b.top)) }; };
          res.top = at(0); res.end = at(1e6); res.vh = innerHeight; res.pageScroll = ov.scrollHeight - ov.clientHeight; res.boxScroll = box.scrollHeight - box.clientHeight;
          return res;
        }, tab);
        for (const tab of ['upg', 'bp', 'exp']) {
          const r = await probe(tab);
          assert.ok(r.end.backBottom <= r.vh + 0.5 && r.end.backTop >= 0, tab + ': Back inside the screen: ' + JSON.stringify(r.end));
          assert.ok(r.end.boxBottom <= r.vh + 0.5, tab + ': the box ends inside the screen (' + r.end.boxBottom + ' <= ' + r.vh + ')');
          assert.ok(r.top.backBottom <= r.vh + 0.5, tab + ': Back visible without scrolling');
          assert.ok(r.end.h >= 44, 'tap target');
          assert.equal(r.end.overlap, 0, tab + ': at the end of the list Back covers no row');
          assert.ok(r.pageScroll <= 1, tab + ': no outer scrolling (the overlay does not scroll 51 px): ' + r.pageScroll);
        }
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    });
  }
});

describe('fix3: Explore and the floor', { concurrency: CONC }, () => {
  const arena = (page, rows, ox = 4, oy = 4) => page.evaluate(([rows, ox, oy]) => {
    const G = window.__dbg(), W = 30; G.enemies = []; G.items = []; G.traps = []; G.shrine = null; G.merchant = null; G.cracks = []; G.smoke = [];
    for (let y = -1; y <= rows.length; y++) for (let x = -1; x <= rows[0].length; x++) { const k = (oy + y) * W + ox + x; G.map[k] = 0; G.seen[k] = true; G.exp[k] = true; }
    rows.forEach((r, y) => [...r].forEach((c, x) => { const k = (oy + y) * W + ox + x; G.map[k] = c === '#' ? 0 : 1; G.seen[k] = true; G.exp[k] = c !== '?'; if (c === '@') { G.p.x = ox + x; G.p.y = oy + y; } }));
    window.__dbg.fn.computeVis(); window.__dbg.fn.endTurn();
  }, [rows, ox, oy]);
  const last = (page) => page.evaluate(() => { const G = window.__dbg(); return { x: G.p.x, y: G.p.y, log: G.log.slice(-1)[0], modal: document.getElementById('modal').style.display }; });

  it('Explore: the way on leads through a cracking tile -> it says so and stops in front (not "Nothing left"); gear you just dropped is not a goal and never reopens its card', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 29 });
    try {
      await arena(page, ['#########################', '#@.....................?#', '#########################']);
      await page.evaluate(() => { const G = window.__dbg(); G.cracks = [{ x: G.p.x + 4, y: G.p.y, t: 99 }]; });
      const a = await last(page);
      await page.evaluate(() => window.__dbg.fn.explore()); await page.waitForTimeout(700);
      const b = await last(page);
      assert.match(b.log, /cracking ahead/i, 'the log says why: ' + b.log); assert.doesNotMatch(b.log, /Nothing left/);
      assert.equal(b.x, a.x + 3, 'walked up to the crack and stopped in front of it');
      await page.evaluate(() => window.__dbg.fn.explore()); await page.waitForTimeout(100);
      assert.match((await last(page)).log, /cracking ahead/i, 'asking again says the same, nothing is spent');
      // no crack, nothing unexplored: the old message
      await arena(page, ['#######', '#@....#', '#######']);
      await page.evaluate(() => window.__dbg.fn.explore()); assert.match((await last(page)).log, /Nothing left/);
      // gear swap: equip the found item, the old one is dropped under the player and marked skip
      await arena(page, ['#########', '#@.......#', '#########']);
      await page.evaluate(() => { const G = window.__dbg(); G.p.eq.weapon = { t: 'weapon', k: 'sword', v: 2, tr: null }; G.items.push({ x: G.p.x + 1, y: G.p.y, t: 'weapon', k: 'axe', v: 3, tr: null }); window.__dbg.fn.tryMove(1, 0); });
      await page.waitForSelector('#modalBox[data-kind="gear"]');
      await page.locator('#modalBox button[data-k="equip"]').click();
      const dr = await page.evaluate(() => { const G = window.__dbg(); return { items: G.items.map((i) => [i.k, i.skip | 0, i.x, i.y]), eq: G.p.eq.weapon.k, px: G.p.x }; });
      assert.equal(dr.eq, 'axe'); assert.equal(dr.items.length, 1, 'the sword lies where we stand'); assert.equal(dr.items[0][0], 'sword'); assert.equal(dr.items[0][1], 1, 'marked skip: Explore ignores it');
      await page.evaluate(() => { window.__dbg.fn.tryMove(2, 0); }); await page.evaluate(() => window.__dbg.fn.tryMove(1, 0));
      for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__dbg.fn.explore()); await page.waitForTimeout(150); }
      const e = await last(page);
      assert.equal(e.modal, 'none', 'no gear card came back'); assert.match(e.log, /Nothing left/, 'Explore does not walk back to the dropped item: ' + e.log);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('a merchant never stands in the way of the stairs (many floors 3 and 6)', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 30 });
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg; let n = 0, blocked = 0, none = 0;
        for (let i = 0; i < 120; i++) {
          D.fn.newFloor(i % 2 ? 6 : 3); const G = D(); document.getElementById('modal').style.display = 'none';
          if (!G.merchant) { none++; continue; } n++;
          const W = 30, st = G.map.indexOf(2), seen = new Set([G.p.y * W + G.p.x]), q = [[G.p.x, G.p.y]]; let ok = false;
          for (let j = 0; j < q.length && !ok; j++) { const [x, y] = q[j]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= W || seen.has(k) || G.map[k] === 0 || G.map[k] === 5 || (G.merchant.x === nx && G.merchant.y === ny)) continue; seen.add(k); q.push([nx, ny]); if (k === st) ok = true; } }
          if (!ok && !G.enemies.some((e) => e.boss)) blocked++;
        }
        return { n, blocked, none };
      });
      assert.equal(r.blocked, 0, 'stairs reachable around the merchant on every floor: ' + JSON.stringify(r)); assert.ok(r.n >= 100, 'a merchant is almost always there: ' + JSON.stringify(r));
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});
