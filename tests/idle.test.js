// Idle / meta layer tests: save migration, expeditions (model, determinism, caps, screens), upgrade levels and pairs, blueprints (lock -> found ->
// unlocked -> in the loot pool, and what each of the 20 items does), Heat (unlock chain, Heat 1 = the old Hard, each rule). Every test has its own browser context.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, openRun, closeModal, dbgReady, HELPERS, CONC, reload } = require('./lib/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const BASE = { seenHelp: 1, gold: 0, unl: { rogue: 1, mage: 1 } };
const H = 3600000;

describe('idle', { concurrency: CONC }, () => {
  // ------------------------------------------------------------------------------------------------ migration
  it('a real old-format meta save (flat shop at level 8, Hard on) migrates: nothing is lost, run stats are at least the old ones, and a damaged new field never bricks the boot', async () => {
    const old = { seenHelp: 1, gold: 5000, hp: 8, atk: 8, pot: 4, goldp: 8, def: 8, wins: 3, best: 8, kills: 400, elites: 12, hardOn: 1, hwins: 1, rec: { n: { warrior: { runs: 5, wins: 3, best: 8, fast: 900, score: 3000 } }, h: { warrior: { runs: 2, wins: 1, best: 8, fast: 1100, score: 4000 } } }, unl: { rogue: 1, mage: 1, scroll: 1, midas: 1 } };
    const a = await newPage(browser, { seed: 1, meta: old });
    try {
      const r = await a.page.evaluate(() => {
        const D = window.__dbg, m = JSON.parse(JSON.stringify(D.api.meta())); D.fn.startRun('warrior', { heat: 0 }); document.getElementById('modal').style.display = 'none';
        const G = D(), B = D.tables.BAL;
        return { m, mhp: G.p.mhp, atk: G.p.atk, def: G.p.def, pots: G.inv.pot, cap: G.p.potCap, gm: G.p.goldMul, base: D.tables.CLS.warrior, B: B.upg.legacy };
      });
      assert.ok(r.m.gold >= 5000 && r.m.gold <= 5300, 'gold kept (plus the retroactive achievement rewards): ' + r.m.gold); assert.equal(r.m.mv, 2); assert.equal(r.m.rec.h.warrior.wins, 1, 'Hard records carry over');
      assert.deepEqual(Object.keys(r.m.up).sort(), ['atk', 'def', 'edge', 'goldp', 'hp', 'pot', 'prep', 'vigor', 'xpf']);
      assert.ok(r.m.up.hp >= 1 && r.m.up.hp <= 8, 'levels are the old ones, capped at the new maximum');
      assert.ok(r.mhp >= r.base.hp + 8 * r.B.hp, 'HP at least old: ' + r.mhp);
      assert.ok(r.atk >= r.base.atk + 8 && r.def >= r.base.def + 8, 'attack / defense at least old: ' + r.atk + '/' + r.def);
      assert.ok(r.pots >= 5 && r.cap >= 5, 'potions at least old');
      assert.ok(r.gm >= 1 + 8 * 0.15 - 1e-9, 'gold find at least old: ' + r.gm);
      assert.ok(Object.keys(r.m.leg).length > 0, 'the difference is kept as a veteran bonus');
      assert.equal(r.m.heat, 1); assert.equal(r.m.heatSel, 1);
      assert.deepEqual(a.errors, []);
    } finally { await a.ctx.close(); }
    // damaged new-format fields: every one gets a safe value and the game boots to the title
    const bad = { seenHelp: 1, gold: 'lots', mv: 2, up: 'x', pv: [1], bp: { rapier: 7, nothing: 1, maul: 2 }, leg: { hp: -4, atk: 'a' }, heat: 99, heatSel: 'z', exp: { s2: 1, rep: { cls: 'zzz' }, run: [{ cls: 'warrior', dur: 77, t0: 1, seed: 1, pw: 1 }, { cls: 'mage', dur: 120, t0: 'now', seed: 1, pw: 1 }, 5] }, unl: 'bad' };
    const b = await newPage(browser, { seed: 2, meta: bad });
    try {
      const r = await b.page.evaluate(() => { const m = window.__dbg.api.meta(); return { gold: m.gold, up: m.up.hp, bp: m.bp, leg: m.leg, heat: m.heat, sel: m.heatSel, run: m.exp.run, rep: m.exp.rep, title: document.getElementById('title').style.display }; });
      assert.equal(r.gold, 0); assert.equal(r.up, 0); assert.deepEqual(r.bp, { maul: 2 }); assert.deepEqual(r.leg, {}); assert.equal(r.heat, 5); assert.equal(r.sel, 0);
      assert.deepEqual(r.run, [null, null]); assert.equal(r.rep, null); assert.equal(r.title, 'flex');
      await b.page.locator('#btnExp').click(); await b.page.locator('#btnBack').click(); await b.page.locator('#btnUpg').click(); await b.page.locator('#tabBp').click();
      assert.deepEqual(b.errors, []);
    } finally { await b.ctx.close(); }
  });

  // ------------------------------------------------------------------------------------------------ expeditions: the model
  it('expedition model: deterministic, capped at 8 h, never paid for negative time, early collect pays the part done, pay per hour falls with length but totals rise, ~1/4-1/3 of manual', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 3, meta: { ...BASE, gold: 100 } });
    try {
      const rec = { cls: 'warrior', dur: 480, t0: 1700000000000, seed: 4242, pw: 2000, bf: 5 };
      const r = await page.evaluate(([rec, H]) => {
        const I = window.__dbg.idle, t0 = rec.t0, out = {};
        out.a = I.expResult(rec, t0 + 20 * H); out.cap = I.expResult(rec, t0 + 8 * H); out.past = I.expResult(rec, t0 + 800 * H);
        out.neg = I.expResult(rec, t0 - 5 * H); out.zero = I.expResult(rec, t0);
        out.part = I.expResult(rec, t0 + 2 * H); out.again = I.expResult(rec, t0 + 2 * H);
        out.elapsed = [I.expElapsed(rec, t0 - 1), I.expElapsed(rec, t0 + 99 * H), I.expElapsed(rec, t0 + H)];
        // rates over many seeds: per hour for 30 min / 2 h / 8 h, against the table's manual gold per hour
        const mean = (dur, n) => { let g = 0; for (let s = 0; s < n; s++) g += I.expResult({ cls: 'warrior', dur, t0: t0 + s * 7919, seed: s * 31 + 1, pw: rec.pw, bf: rec.bf }, t0 + s * 7919 + dur * 60000).gold; return g / n; };
        out.g30 = mean(30, 300) * 2; out.g120 = mean(120, 200) / 2; out.g480 = mean(480, 100) / 8; out.gph = I.expGph(rec.bf, rec.pw); out.rates = window.__dbg.tables.BAL.exp.durs.map((d) => d.rate);
        out.tot = [mean(30, 100), mean(120, 100), mean(480, 100)];
        out.bpAny = [...Array(300).keys()].some((s) => I.expResult({ cls: 'mage', dur: 480, t0: t0, seed: s, pw: 0, bf: 4 }, t0 + 8 * H).bp);
        out.bpNone = [...Array(300).keys()].some((s) => I.expResult({ cls: 'mage', dur: 480, t0: t0, seed: s, pw: 0, bf: 2 }, t0 + 8 * H).bp);
        return out;
      }, [rec, H]);
      assert.deepEqual(r.a, r.cap, 'more than 8 h pays exactly 8 h'); assert.deepEqual(r.past, r.cap);
      assert.deepEqual(r.part, r.again, 'the same inputs give the same result');
      assert.equal(r.neg.gold, 0); assert.equal(r.neg.delves, 0); assert.equal(r.zero.gold, 0); assert.deepEqual(r.elapsed, [0, 480, 60]);
      assert.equal(r.part.early, 1); assert.equal(r.cap.early, 0); assert.ok(r.part.gold > 0 && r.part.gold < r.cap.gold, 'early collect pays the part done: ' + r.part.gold + ' < ' + r.cap.gold);
      assert.ok(r.cap.floor >= 1 && r.cap.floor <= 5 && r.cap.deaths <= r.cap.delves && r.cap.kills > 0, 'never deeper than the player has been (floor 5): ' + r.cap.floor);
      assert.ok(r.g30 > r.g120 && r.g120 > r.g480, 'pay per hour falls with length: ' + [r.g30, r.g120, r.g480].map(Math.round));
      assert.ok(r.tot[0] < r.tot[1] && r.tot[1] < r.tot[2], 'total pay rises with length');
      for (const [g, rate] of [[r.g30, r.rates[0]], [r.g120, r.rates[1]], [r.g480, r.rates[2]]]) assert.ok(Math.abs(g / (r.gph * rate) - 1) < 0.2, 'about rate x gold per hour of the best floor: ' + Math.round(g) + ' vs ' + Math.round(r.gph * rate));
      assert.ok(r.rates[0] > r.rates[1] && r.rates[1] > r.rates[2] && r.rates[2] === 1, '30 min is the best rate, 8 h the base');
      assert.ok(r.bpAny, 'a long trip can bring a blueprint'); assert.ok(!r.bpNone, 'no blueprint from heroes that never got past floor 2');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('expedition outcome scales with upgrade power and class, and a hero sent through the game screens survives a reload with the same result', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 4, meta: { ...BASE, gold: 2000 } });
    try {
      const pw = await page.evaluate(() => { const I = window.__dbg.idle; const g = (b, p) => I.expGph(b, p); return { lo: g(4, 0), hi: g(4, I.upMaxSpent()), deep: g(8, 0), spent0: I.upSpent() }; });
      assert.ok(pw.hi > pw.lo * 1.5, 'stronger characters bring home more: ' + pw.lo + ' -> ' + pw.hi); assert.ok(pw.deep > pw.lo * 1.5, 'deeper best floor pays more'); assert.equal(pw.spent0, 0);
      await page.evaluate(() => { const I = window.__dbg.idle; I.upBuy('hp'); I.upBuy('hp'); });
      assert.equal(await page.evaluate(() => window.__dbg.idle.upSpent()), 30 + 78, 'power = gold put into levels');
      // through the screens
      await page.locator('#btnExp').click();
      await page.locator('[data-send="0"]').click();
      await page.locator('button[data-cls="mage"]').click();
      assert.equal(await page.locator('button[data-cls="mage"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-dur]').count(), 3);
      await page.locator('[data-dur="120"]').click();
      assert.match(await page.locator('.xslot[data-slot="0"]').textContent(), /Mage · 2 hours.*Back in/);
      const saved = await page.evaluate(() => JSON.parse(JSON.stringify(window.__dbg.api.meta().exp.run[0])));
      assert.equal(saved.cls, 'mage'); assert.equal(saved.dur, 120); assert.equal(saved.pw, 108); assert.equal(saved.bf, 1, 'the best manual floor is stored with the trip');
      // second slot is a purchase
      assert.equal(await page.locator('#btnSlot2').isDisabled(), false);
      await page.locator('#btnSlot2').click();
      assert.equal(await page.evaluate(() => window.__dbg.api.meta().exp.s2), 1);
      assert.equal(await page.locator('[data-send="1"]').count(), 1);
      // reload, move the clock by editing the stored start: the result is a pure function of the record
      await reload(page);
      const same = await page.evaluate(() => {
        const I = window.__dbg.idle, m = window.__dbg.api.meta(), rec = m.exp.run[0], t = rec.t0 + 130 * 60000;
        const a = I.expResult(rec, t), b = I.expResult(JSON.parse(JSON.stringify(rec)), t); return { a, b, ready: I.expReady(rec, rec.t0 + 119 * 60000), ready2: I.expReady(rec, t), n: I.expReadyCount(t) };
      });
      assert.deepEqual(same.a, same.b); assert.equal(same.ready, false); assert.equal(same.ready2, true); assert.equal(same.n, 1);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('collecting: Recall pays the part done, Collect pays once (no double pay), the report survives a reload, the badge shows on the title, a blueprint is marked found', async () => {
    const t0 = Date.now() - 3 * H;
    const meta = { ...BASE, gold: 10, exp: { s2: 1, run: [{ cls: 'warrior', dur: 120, t0: t0, seed: 77, pw: 3000 }, { cls: 'rogue', dur: 480, t0: Date.now() - 1 * H, seed: 5, pw: 3000 }], rep: null } };
    const { page, ctx, errors } = await newPage(browser, { seed: 5, meta });
    try {
      const badge = await page.locator('#btnExp .pill').textContent();
      assert.match(badge, /Ready/, 'a finished expedition shows a badge');
      const want = await page.evaluate(() => { const I = window.__dbg.idle, m = window.__dbg.api.meta(); return { full: I.expResult(m.exp.run[0], Date.now()).gold }; });
      await page.locator('#btnExp').click();
      assert.equal(await page.locator('[data-collect="0"]').getAttribute('class').then((c) => /go/.test(c)), true, 'the finished one is highlighted');
      await page.locator('[data-collect="0"]').click();
      assert.match(await page.locator('#titleBox h1').textContent(), /report/i);
      const gold1 = await page.evaluate(() => window.__dbg.api.meta().gold);
      assert.ok(Math.abs(gold1 - 10 - want.full) <= 3, 'paid the result: ' + (gold1 - 10) + ' vs ' + want.full);
      const body = await page.locator('#titleBox').innerText();
      for (const w of ['Deepest floor', 'Kills', 'Delves', 'Gold']) assert.match(body, new RegExp(w));
      await reload(page);
      assert.equal(await page.evaluate(() => window.__dbg.api.meta().gold), gold1, 'reload pays nothing more');
      await page.locator('#btnExp').click();
      assert.match(await page.locator('#titleBox h1').textContent(), /report/i, 'the unread report is still there');
      await page.locator('#btnDone').click();
      assert.match(await page.locator('#titleBox h1').textContent(), /Expeditions/);
      assert.equal(await page.evaluate(() => window.__dbg.api.meta().exp.rep), null);
      assert.equal(await page.evaluate(() => window.__dbg.idle.expCollect(0)), null, 'an empty slot pays nothing');
      // recall an unfinished one: only the part done
      const r2 = await page.evaluate(() => { const I = window.__dbg.idle, m = window.__dbg.api.meta(); const g0 = m.gold; const r = I.expCollect(1, m.exp.run[1].t0 + 90 * 60000); return { r, d: m.gold - g0 }; });
      assert.equal(r2.r.early, 1); assert.equal(r2.d, r2.r.gold); assert.ok(r2.r.el === 90);
      // a blueprint in a result is marked found, not unlocked
      const bp = await page.evaluate(() => {
        const I = window.__dbg.idle, m = window.__dbg.api.meta(); let found = null;
        for (let s = 0; s < 400 && !found; s++) { m.exp.run[0] = { cls: 'mage', dur: 480, t0: 1e12, seed: s, pw: 0, bf: 4 }; const r = I.expResult(m.exp.run[0], 1e12 + 8 * 3600000); if (r.bp) { I.expCollect(0, 1e12 + 8 * 3600000); found = r.bp; } }
        return { found, state: found && I.bpState(found), tier: found && I.BPS.find((b) => b.id === found).tier };
      });
      assert.ok(bp.found && bp.state === 1 && bp.tier === 'c', 'expeditions bring common blueprints, found but not bought');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // ------------------------------------------------------------------------------------------------ upgrades
  it('upgrade levels: rising prices, diminishing gains, applied at run start; pairs: one level counter, free first pick, fee to switch, the variant decides the effect', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 6, meta: { ...BASE, gold: 100000 } });
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, I = D.idle, out = { cost: {}, gain: {}, max: {} };
        for (const u of I.UPG) {
          const c = [], g = []; for (let l = 0; l < I.upMax(u); l++) { c.push(I.upCost(u, l)); g.push(I.upVal(u, l + 1) - I.upVal(u, l)); }
          out.cost[u.k] = c; out.gain[u.k] = g; out.max[u.k] = I.upMax(u);
        }
        out.old = { hp: I.upCost(I.UPG[0], 0), atk: I.upCost(I.UPG[1], 1), pot3: I.upCost(I.UPG[3], 1) };
        // buy everything once and look at the run
        const m = D.api.meta(); for (const u of I.UPG) while (I.upBuy(u.k)); out.afterMax = { gold: m.gold, spent: I.upSpent(), full: I.upMaxSpent() - (I.PAIRS.reduce((a, q) => { let s = 0; for (let l = 0; l < q.max; l++) s += I.upCost(q, l); return a + s; }, 0)) };
        D.fn.startRun('warrior'); document.getElementById('modal').style.display = 'none'; const G = D(), C = D.tables.CLS.warrior;
        out.run = { hp: G.p.mhp - C.hp, atk: G.p.atk - C.atk, def: G.p.def - C.def, pots: G.inv.pot, xp: G.p.xpMul, gold: G.p.goldMul };
        out.bonus = { hp: I.upBonus('hp'), atk: I.upBonus('atk'), def: I.upBonus('def'), pot: I.upBonus('pot') };
        D.api.finish('abandon'); document.getElementById('modalBox').querySelector('button').click();
        return out;
      });
      for (const k in r.cost) { for (let i = 1; i < r.cost[k].length; i++) assert.ok(r.cost[k][i] > r.cost[k][i - 1], k + ' prices rise'); for (let i = 1; i < r.gain[k].length; i++) assert.ok(r.gain[k][i] <= r.gain[k][i - 1] + 1e-9, k + ' gains never grow'); assert.ok(r.max[k] >= 2, k + ' has several levels'); }
      assert.ok(Object.values(r.gain).some((g) => g[g.length - 1] < g[0]), 'later levels give less');
      assert.deepEqual(r.old, { hp: 30, atk: 143, pot3: 104 }, 'the early prices are the old shop prices');
      assert.equal(r.afterMax.spent, r.afterMax.full, 'maxing buys every level');
      assert.deepEqual(r.run, { hp: r.bonus.hp, atk: r.bonus.atk, def: r.bonus.def, pots: 1 + r.bonus.pot, xp: r.run.xp, gold: r.run.gold });
      assert.ok(r.run.xp > 1 && r.run.gold > 1);
      // pairs
      const p = await page.evaluate(() => {
        const D = window.__dbg, I = D.idle, m = D.api.meta(), q = I.PAIRS[0], out = {}; m.gold = 1000;
        out.freeFee = I.pairFee(q); out.sw0 = I.pairSwitch('edge'); out.v0 = I.pairVar(q).id; out.g0 = m.gold;
        I.pairSwitch('edge'); out.back = I.pairVar(q).id;
        I.upBuy('edge'); out.fee = I.pairFee(q); const g = m.gold; I.pairSwitch('edge'); out.paid = g - m.gold; out.v1 = I.pairVar(q).id;
        m.gold = 0; out.poor = I.pairSwitch('edge'); out.still = I.pairVar(q).id; m.gold = 1000;
        D.fn.startRun('warrior'); document.getElementById('modal').style.display = 'none'; const G = D();
        out.dmg = G.p.dmgMul; out.crit = G.p.crit; I.pairSwitch('edge'); D.api.finish('abandon'); document.getElementById('modalBox').querySelector('button').click();
        D.fn.startRun('warrior'); document.getElementById('modal').style.display = 'none'; out.dmg2 = D().p.dmgMul; out.crit2 = D().p.crit;
        return out;
      });
      assert.equal(p.freeFee, 0); assert.equal(p.sw0, true); assert.equal(p.v0, 'vicious'); assert.equal(p.back, 'keen'); assert.equal(p.fee, 50); assert.equal(p.paid, 50); assert.equal(p.v1, 'vicious');
      assert.equal(p.poor, false); assert.equal(p.still, 'vicious', 'no switch without the fee');
      assert.ok(p.dmg > 1 && p.crit < 0.1, 'Vicious: damage, no extra crit'); assert.ok(p.dmg2 === 1 && p.crit2 > 0.05 + 1e-9, 'Keen: crit, no extra damage');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('shop screen: Upgrades and Blueprints tabs, boost cards with level and price, either/or rows with a swap button, tap targets >= 44 px, nothing wider than the phone', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 7, meta: { ...BASE, gold: 500, up: { hp: 2, edge: 1 } } });
    try {
      await page.locator('#btnUpg').click();
      assert.equal(await page.locator('#tabUpg').getAttribute('aria-pressed'), 'true');
      const cards = await page.locator('[data-up]').evaluateAll((bs) => bs.map((b) => ({ k: b.dataset.up, t: b.textContent.replace(/\s+/g, ' ').trim(), h: b.getBoundingClientRect().height, r: b.getBoundingClientRect().right })));
      assert.equal(cards.length, 9, 'six boosts and three pairs');
      assert.match(cards.find((c) => c.k === 'hp').t, /Hardy 2\/8\s*\+16 HP · next \+8/);
      assert.match(cards.find((c) => c.k === 'edge').t, /Edge: Keen 1\/3/);
      assert.ok(cards.every((c) => c.h >= 44 && c.r <= 391));
      const sw = await page.locator('[data-swap]').evaluateAll((bs) => bs.map((b) => ({ k: b.dataset.swap, h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width, t: b.textContent.trim(), d: b.disabled })));
      assert.equal(sw.length, 3); assert.ok(sw.every((x) => x.h >= 44 && x.w >= 44));
      assert.match(sw.find((x) => x.k === 'edge').t, /Vicious.*50/); assert.match(sw.find((x) => x.k === 'vigor').t, /Lifedrinker.*free/);
      await page.locator('[data-up="hp"]').click();
      assert.equal(await page.evaluate(() => window.__dbg.idle.upLvl('hp')), 3);
      await page.locator('[data-swap="edge"]').click();
      assert.equal(await page.evaluate(() => window.__dbg.idle.pairVar(window.__dbg.idle.PAIRS[0]).id), 'vicious');
      await page.locator('#tabBp').click();
      assert.equal(await page.locator('#tabBp').getAttribute('aria-pressed'), 'true');
      assert.match(await page.locator('#titleBox').innerText(), /Found 0\/20/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // ------------------------------------------------------------------------------------------------ blueprints
  it('blueprints: 20 items across the classes; locked -> found -> unlocked -> in the loot pool; cannot buy what is not found or without gold; the tab shows counts', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 8, meta: { ...BASE, gold: 100 } });
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, I = D.idle, T = D.tables, out = {}, m = D.api.meta();
        out.n = I.BPS.length; out.byT = {}; out.byTier = {}; for (const b of I.BPS) { out.byT[b.t] = (out.byT[b.t] || 0) + 1; out.byTier[b.tier] = (out.byTier[b.tier] || 0) + 1; }
        out.sprites = I.BPS.filter((b) => !D.art.SPR[b.t === 'perk' ? 'p_' + b.id : b.e]).map((b) => b.id);
        out.classes = { warrior: 0, mage: 0, rogue: 0 }; for (const k in T.OFF) if (T.OFF[k].bp) out.classes[T.OFF[k].cls]++; for (const p of T.PERKS) if (p.bp && p.cls) out.classes[p.cls]++;
        D.fn.startRun('warrior'); document.getElementById('modal').style.display = 'none'; const G = D();
        const draw = (slot, n) => { const s = {}; for (let i = 0; i < n; i++) { const g = D.gear.newGear(slot, 4, false); s[g.k] = 1; } return s; };
        const pool = () => ({ w: draw('weapon', 500), c: draw('charm', 300), perk: D.perkIds });
        out.locked = pool(); out.lockedPerk = (G.p.cls = 'warrior', I.bpTable(T.WP).rapier === undefined);
        out.buyUnfound = I.bpBuy('rapier'); out.found = I.bpFound('rapier'); out.foundAgain = I.bpFound('rapier'); out.stateF = I.bpState('rapier'); out.inPoolF = !!I.bpTable(T.WP).rapier;
        out.poor = (m.gold = 10, I.bpBuy('rapier')); m.gold = 100; out.buy = I.bpBuy('rapier'); out.gold = m.gold; out.state = I.bpState('rapier'); out.again = I.bpBuy('rapier');
        out.after = draw('weapon', 800); I.bpFound('gilded'); m.gold = 500; I.bpBuy('gilded'); out.charms = draw('charm', 600);
        // off-hands are class locked, perks need the class
        I.bpFound('warbanner'); m.gold = 500; I.bpBuy('warbanner'); I.bpFound('warcry'); I.bpBuy('warcry');
        const offs = new Set(); for (let i = 0; i < 300; i++) offs.add(D.gear.newGear('off', 3, false).k); out.offs = [...offs];
        G.p.cls = 'rogue'; const offr = new Set(); for (let i = 0; i < 300; i++) offr.add(D.gear.newGear('off', 3, false).k); out.offsRogue = [...offr];
        G.p.cls = 'warrior'; G.perks = {}; out.perkPoolW = D.tables.PERKS.filter((pk) => (!pk.bp || I.bpOn(pk.id)) && (!pk.cls || pk.cls === 'warrior')).map((p) => p.id);
        out.counts = I.bpCounts(); D.api.finish('abandon'); document.getElementById('modalBox').querySelector('button').click();
        return out;
      });
      assert.equal(r.n, 20); assert.deepEqual(r.byT, { weapon: 5, off: 6, charm: 5, perk: 4 }); assert.deepEqual(r.byTier, { c: 8, r: 8, b: 4 });
      assert.deepEqual(r.sprites, [], 'every blueprint has its sprite'); assert.deepEqual(r.classes, { warrior: 3, mage: 3, rogue: 3 }, 'spread across the classes: class off-hands and perks');
      assert.ok(!r.locked.w.rapier && !r.locked.w.maul && !r.locked.w.viper && !r.locked.w.stormrod && !r.locked.w.reaper, 'locked weapons never drop');
      assert.ok(!r.locked.c.gilded && !r.locked.c.aegis && !r.locked.c.cinder && !r.locked.c.frenzy && !r.locked.c.laststand, 'locked charms never drop');
      assert.equal(r.lockedPerk, true); assert.equal(r.buyUnfound, false, 'cannot buy what was not found');
      assert.equal(r.found, true); assert.equal(r.foundAgain, false); assert.equal(r.stateF, 1); assert.equal(r.inPoolF, false, 'found is not yet in the pool');
      assert.equal(r.poor, false); assert.equal(r.buy, true); assert.equal(r.gold, 100 - 80, 'a common blueprint costs 80'); assert.equal(r.state, 2); assert.equal(r.again, false);
      assert.ok(r.after.rapier, 'unlocked: it drops'); assert.ok(r.charms.gilded);
      assert.ok(r.offs.includes('warbanner') && !r.offs.includes('garrote') && !r.offs.includes('shard'), 'only the bought off-hand of the own class'); assert.ok(!r.offsRogue.includes('warbanner'));
      assert.ok(r.perkPoolW.includes('warcry') && !r.perkPoolW.includes('lacerate') && !r.perkPoolW.includes('stalker'));
      assert.deepEqual(r.counts, { found: 4, unlocked: 4, total: 20 });
      // the tab: found ones are cards, the rest only counts by source
      await page.evaluate(() => { const I = window.__dbg.idle; I.bpFound('aegis'); I.bpFound('maul'); });
      await page.locator('#btnUpg').click(); await page.locator('#tabBp').click();
      assert.equal(await page.locator('[data-bp]').count(), 6);
      assert.equal(await page.locator('[data-bp][data-state="2"]').count(), 4); assert.equal(await page.locator('[data-bp="aegis"]').isDisabled(), true, 'a best blueprint costs 450, not affordable');
      assert.match(await page.locator('#titleBox').innerText(), /Found 6\/20/);
      assert.equal(await page.locator('[data-locked]').count(), 3); assert.match(await page.locator('[data-locked="b"]').textContent(), /dragon.*Heat 1\+/i);
      await page.evaluate(() => { window.__dbg.api.meta().gold = 300; }); await page.locator('#tabUpg').click(); await page.locator('#tabBp').click();
      await page.locator('[data-bp="maul"]').click();
      assert.equal(await page.evaluate(() => window.__dbg.idle.bpState('maul')), 2); assert.equal(await page.evaluate(() => window.__dbg.api.meta().gold), 220);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('blueprint drops: manual runs only; deep runs find better ones; the best only from the dragon or Heat 1+; Auto runs find none; the recap says so', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 9, meta: { ...BASE, wins: 1 } });
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, I = D.idle, m = D.api.meta(), out = {};
        const setup = (floor, heat, won, auto) => { m.bp = {}; D.fn.startRun('warrior', { heat }); document.getElementById('modal').style.display = 'none'; const G = D(); G.floor = floor; if (auto) G.auto.used = 1; if (won) G.won = true; return G; };
        const tier = (b) => b && b.tier; const rnd = Math.random;
        Math.random = () => 0;   // every chance succeeds
        let G = setup(3, 0, false, false); out.shallow = tier(I.bpRunDrop(false)); D.api.finish('abandon'); document.getElementById('modalBox').querySelector('button').click();
        G = setup(5, 0, false, false); out.deep = tier(I.bpRunDrop(false)); D.api.finish('abandon'); document.getElementById('modalBox').querySelector('button').click();
        G = setup(6, 1, false, false); out.deepHeat = tier(I.bpRunDrop(false)); D.api.finish('abandon'); document.getElementById('modalBox').querySelector('button').click();
        G = setup(8, 0, true, false); out.win = tier(I.bpRunDrop(true)); D.api.finish('abandon'); document.getElementById('modalBox').querySelector('button').click();
        G = setup(8, 0, true, true); out.auto = I.bpRunDrop(true); D.api.finish('abandon'); document.getElementById('modalBox').querySelector('button').click();
        Math.random = () => 0.999;   // every chance fails
        G = setup(8, 1, true, false); out.unlucky = I.bpRunDrop(true); D.api.finish('abandon'); document.getElementById('modalBox').querySelector('button').click();
        Math.random = () => 0; m.bp = {}; D.fn.startRun('warrior', { heat: 0 }); document.getElementById('modal').style.display = 'none'; D().floor = 5; D().won = true; D.api.finish('win');
        out.recap = document.getElementById('bpRecap') ? document.getElementById('bpRecap').textContent : null; out.found = Object.keys(m.bp).length;
        Math.random = rnd;
        return out;
      });
      assert.equal(r.shallow, null, 'floor 3 finds nothing'); assert.equal(r.deep, 'r'); assert.equal(r.deepHeat, 'b', 'Heat 1+ deep runs can find the best'); assert.equal(r.win, 'b', 'the dragon drops the best');
      assert.equal(r.auto, null); assert.equal(r.unlucky, null); assert.match(r.recap, /Blueprint found/); assert.equal(r.found, 1);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // ------------------------------------------------------------------------------------------------ what the 20 items do
  it('weapons: Maul knocks back (wall slam), Rapier counters and crits more, Viperblade poisons, Storm Rod zaps on a kill, Reaper hits the neighbours for full damage', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 41, meta: BASE });
    try {
      await page.evaluate(HELPERS);
      const r = await page.evaluate(() => {
        const D = window.__dbg, F = D.fn, G = () => D(), T = window.T, out = {}; D.tables.BAL.combat.dmgVar = 0; D.tables.BAL.combat.enemyDmgVar = 0; const eq = (k) => { G().p.eq.weapon = { t: 'weapon', k, v: 3, tr: null }; };
        const fresh = () => { T.setup(4); G().p.hp = G().p.mhp = 500; G().p.def = 0; G().perks = {}; return G().p; };
        // maul: the foe two tiles away ends one tile further after a hit
        let p = fresh(); eq('maul'); let e = T.foe('troll', 1, 0, true); e.hp = e.mhp = 400; e.stun = 3; const x0 = e.x; F.tryMove(1, 0); out.maulMoved = e.x - x0;
        // wall slam: a foe against the wall takes extra
        p = fresh(); eq('maul'); e = T.foe('troll', 1, 0, true); e.hp = e.mhp = 400; e.stun = 3; G().map[(p.y) * 30 + p.x + 2] = 0; const h0 = e.hp; F.tryMove(1, 0); out.slam = h0 - e.hp;
        p = fresh(); eq('sword'); e = T.foe('troll', 1, 0, true); e.hp = e.mhp = 400; e.stun = 3; G().map[(p.y) * 30 + p.x + 2] = 0; const h1 = e.hp; F.tryMove(1, 0); out.noSlam = h1 - e.hp;
        // viper: poison without the perk
        p = fresh(); eq('viper'); e = T.foe('troll', 1, 0, true); e.hp = e.mhp = 400; e.stun = 3; F.tryMove(1, 0); out.pois = e.pois && { t: e.pois.t, d: e.pois.d };
        p = fresh(); eq('sword'); e = T.foe('troll', 1, 0, true); e.hp = e.mhp = 400; e.stun = 3; F.tryMove(1, 0); out.noPois = !e.pois;
        // reaper: sweeps the neighbour at full damage
        p = fresh(); eq('reaper'); e = T.foe('troll', 1, 0, true); const o = T.foe('troll', 1, 1, true); for (const z of [e, o]) { z.hp = z.mhp = 400; z.stun = 3; } F.tryMove(1, 0); out.reaper = [400 - e.hp, 400 - o.hp];
        // rapier: counter chance and crit
        p = fresh(); eq('rapier'); out.rapier = D.tables.WP.rapier.riposte; out.crit = D.gear.statVec().crit;
        eq('sword'); out.critSword = D.gear.statVec().crit;
        // counter in action: with rf forced low the foe takes a hit back
        p = fresh(); eq('rapier'); e = T.foe('goblin', 1, 0, true); e.hp = e.mhp = 400; const r0 = Math.random; Math.random = () => 0; const hb = e.hp; F.hurtPlayer(e, 3, true, 'hits'); Math.random = r0; out.counter = hb - e.hp;
        // storm rod: killing blow zaps the other foe
        p = fresh(); eq('stormrod'); e = T.foe('rat', 1, 0, true); e.hp = 1; const far = T.foe('goblin', 3, 0, true); far.hp = far.mhp = 400; const f0 = far.hp; F.tryMove(1, 0); out.zap = f0 - far.hp;
        p = fresh(); eq('sword'); e = T.foe('rat', 1, 0, true); e.hp = 1; const far2 = T.foe('goblin', 3, 0, true); far2.hp = far2.mhp = 400; const f1 = far2.hp; F.tryMove(1, 0); out.noZap = f1 - far2.hp;
        return out;
      });
      assert.equal(r.maulMoved, 1, 'pushed back one tile'); assert.ok(r.slam > r.noSlam, 'slammed into a wall: ' + r.slam + ' > ' + r.noSlam);
      assert.ok(r.pois && r.pois.d === 2 && r.pois.t >= 2, 'poisoned: ' + JSON.stringify(r.pois)); assert.equal(r.noPois, true);
      assert.ok(r.reaper[0] > 0 && r.reaper[1] > 0 && Math.abs(r.reaper[0] - r.reaper[1]) <= 2, 'full damage to the neighbour: ' + r.reaper);
      assert.equal(r.rapier, 0.25); assert.ok(r.crit > r.critSword, 'more crit'); assert.ok(r.counter > 0, 'countered');
      assert.ok(r.zap > 0 && r.noZap === 0, 'the kill arcs lightning');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('charms: Gilded Coin heals on gold, Blood Brand stacks attack per kill (reset each floor), Last Stand heals once a floor, Stone Heart caps a hit, Cinder burns the neighbours of a kill', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 42, meta: BASE });
    try {
      await page.evaluate(HELPERS);
      const r = await page.evaluate(() => {
        const D = window.__dbg, F = D.fn, G = () => D(), T = window.T, out = {}; D.tables.BAL.combat.dmgVar = 0; D.tables.BAL.combat.enemyDmgVar = 0; 
        const fresh = (ch) => { T.setup(4); const p = G().p; p.mhp = 100; p.hp = 50; p.def = 0; G().perks = {}; G().ssUsed = 0; G().lsUsed = 0; G().fz = 0; p.eq.charm = ch ? { t: 'charm', k: ch, v: 0, tr: null } : null; return p; };
        let p = fresh('gilded'); G().items.push({ x: p.x + 1, y: p.y, t: 'gold', v: 20 }); p.goldMul = 1; F.tryMove(1, 0); out.gilded = p.hp - 50;
        p = fresh(null); G().items.push({ x: p.x + 1, y: p.y, t: 'gold', v: 20 }); p.goldMul = 1; F.tryMove(1, 0); out.noGild = p.hp - 50;
        p = fresh('frenzy'); const a0 = D.gear.statVec().attack; for (let i = 0; i < 6; i++) { const e = T.foe('rat', 1, 0, true); e.hp = 1; F.tryMove(1, 0); } out.frenzy = D.gear.statVec().attack - a0;
        F.newFloor(2); out.reset = G().fz;
        p = fresh('laststand'); const e = T.foe('goblin', 1, 0, true); p.hp = 32; F.hurtPlayer(e, 5, true, 'hits'); out.lastHp = p.hp; const before = p.hp; F.hurtPlayer(e, 1, true, 'hits'); out.second = before - p.hp;
        p = fresh('aegis'); p.mhp = 100; p.hp = 100; const e2 = T.foe('goblin', 1, 0, true); F.hurtPlayer(e2, 90, true, 'hits'); out.aegis = 100 - p.hp;
        p = fresh(null); p.mhp = 100; p.hp = 100; F.hurtPlayer(e2, 90, true, 'hits'); out.noAegis = 100 - p.hp;
        p = fresh('cinder'); const k = T.foe('rat', 1, 0, true); k.hp = 1; const nb = T.foe('troll', 1, 1, true); nb.hp = nb.mhp = 200; const nh = nb.hp; F.tryMove(1, 0); out.cinder = nh - nb.hp;
        return out;
      });
      assert.equal(r.gilded, 5); assert.equal(r.noGild, 0);
      assert.equal(r.frenzy, 4, 'capped at +4'); assert.equal(r.reset, 0, 'a new floor starts clean');
      assert.ok(r.lastHp >= 32 + 25, 'Last Stand rallied: ' + r.lastHp); assert.ok(r.second >= 1 && r.second <= 2, 'only once a floor');
      assert.equal(r.aegis, 30); assert.ok(r.noAegis > 60);
      assert.ok(r.cinder >= 3, 'burned the neighbour: ' + r.cinder);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('off-hands: Garrote resets Backstab on a kill, Focus Crystal doubles Bolt on a frozen foe, War Banner / Gauntlet / Mirror Shard / Caltrops change Cleave / Charge / Blink / Smoke', async () => {
    const { page, ctx, errors } = await openRun(browser, 'rogue', { seed: 43, meta: BASE });
    try {
      await page.evaluate(HELPERS);
      const r = await page.evaluate(() => {
        const D = window.__dbg, F = D.fn, G = () => D(), T = window.T, out = {}, B = D.tables.BAL; D.tables.BAL.combat.dmgVar = 0; D.tables.BAL.combat.enemyDmgVar = 0; 
        const fresh = (cls, off) => { G().p.cls = cls; G().p.mbase = cls === 'mage' ? 60 : 0; T.setup(7); const p = G().p; p.hp = p.mhp = 500; p.def = 0; p.mana = 60; p.rage = 100; G().knives = 4; G().perks = {}; for (const k in G().cd) delete G().cd[k]; for (const k of D.tables.CLS[cls].kit) G().cd[k] = 0; p.eq.off = off ? { t: 'off', k: off, v: 0, tr: null } : null; p.eq.weapon = { t: 'weapon', k: 'sword', v: 3, tr: null }; return p; };
        const stab = (off) => { fresh('rogue', off); const e = T.foe('goblin', 1, 0, false); e.hp = 1; e.mhp = 50; F.use('backstab', e.x, e.y); return G().cd.backstab; };
        out.garrote = stab('garrote'); out.noGarrote = stab(null);
        const bolt = (off) => { fresh('mage', off); const e = T.foe('troll', 3, 0, true); e.hp = e.mhp = 400; e.frz = 3; const h = e.hp; F.use('bolt', e.x, e.y); return h - e.hp; };
        const b1 = bolt('focus'), b0 = bolt(null); out.focus = [b1, b0];
        const cleave = (off) => { fresh('warrior', off); const e = T.foe('troll', 1, 0, true); e.hp = e.mhp = 400; const h = e.hp; F.use('cleave'); return h - e.hp; };
        out.banner = [cleave('warbanner'), cleave(null)];
        const charge = (off, d) => { fresh('warrior', off); const e = T.foe('troll', d, 0, true); e.hp = e.mhp = 400; const x0 = e.x; const ok = D.fn.use('charge', e.x, e.y); return { ok, moved: e.x - x0 }; };
        out.gauntlet = [charge('gauntlet', 7), charge(null, 7), charge('gauntlet', 4)];
        const blink = (off) => { const p = fresh('mage', off); const e = T.foe('troll', 0, 1, true); e.hp = e.mhp = 400; e.stun = 2; const h = e.hp; F.use('blink', p.x + 3, p.y); return h - e.hp; };
        out.shard = [blink('shard'), blink(null)];
        const smoke = (off) => { const p = fresh('rogue', off); const e = T.foe('troll', 3, 0, true); e.hp = e.mhp = 400; F.use('smoke', e.x, e.y); return { stun: e.stun || 0, blind: e.blind }; };
        out.caltrops = [smoke('caltrops'), smoke(null)];
        out.cfg = { gr: B.offhand.gauntletRange, st: B.offhand.caltropStun };
        return out;
      });
      assert.equal(r.garrote, 0, 'a Backstab kill resets it'); assert.ok(r.noGarrote > 0);
      assert.ok(r.focus[0] >= r.focus[1] * 1.7, 'Bolt on a frozen foe: ' + r.focus);
      assert.ok(r.banner[0] > r.banner[1] * 1.4, 'Cleave strikes twice: ' + r.banner);
      assert.equal(r.gauntlet[0].ok, true, 'range 7 only with the gauntlet'); assert.equal(r.gauntlet[1].ok, false); assert.equal(r.gauntlet[2].moved, 1, 'the foe is slammed back');
      assert.ok(r.shard[0] > 0 && r.shard[1] === 0, 'Blink scorches: ' + r.shard);
      assert.ok(r.caltrops[0].stun >= 1 && !r.caltrops[1].stun, 'Smoke stuns with caltrops');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('perks: Stalker hits unaware foes harder, Warcry stuns with Cleave, Frostbite hurts frozen foes, Lacerate makes sneak hits bleed (each class-locked as stated)', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 44, meta: BASE });
    try {
      await page.evaluate(HELPERS);
      const r = await page.evaluate(() => {
        const D = window.__dbg, F = D.fn, G = () => D(), T = window.T, out = {}; D.tables.BAL.combat.dmgVar = 0; D.tables.BAL.combat.enemyDmgVar = 0; 
        const fresh = (cls) => { G().p.cls = cls; T.setup(7); const p = G().p; p.hp = p.mhp = 500; p.def = 0; p.rage = 100; p.crit = 0; G().perks = {}; for (const k of D.tables.CLS[cls].kit) G().cd[k] = 0; p.eq.weapon = { t: 'weapon', k: 'sword', v: 3, tr: null }; p.eq.off = null; return p; };
        const hit = (perk, aware) => { fresh('warrior'); if (perk) G().perks[perk] = 1; const e = T.foe('troll', 1, 0, aware); e.hp = e.mhp = 400; e.stun = aware ? 3 : 0; const h = e.hp; F.tryMove(1, 0); return h - e.hp; };
        const st = [hit('stalker', false), hit(null, false), hit('stalker', true), hit(null, true)]; out.stalker = st;
        const cl = (perk) => { D.tables.BAL.perk.warcryStun = 3; fresh('warrior'); if (perk) G().perks[perk] = 1; const e = T.foe('troll', 1, 0, true); e.hp = e.mhp = 400; F.use('cleave'); return e.stun || 0; };
        out.warcry = [cl('warcry'), cl(null)];
        const bolt = (perk) => { fresh('mage'); G().p.mana = 60; G().p.mbase = 60; if (perk) G().perks[perk] = 1; const e = T.foe('troll', 3, 0, true); e.hp = e.mhp = 400; e.frz = 3; const h = e.hp; F.use('bolt', e.x, e.y); return h - e.hp; };
        out.frost = [bolt('frostbite'), bolt(null)];
        const stab = (perk) => { fresh('rogue'); if (perk) G().perks[perk] = 1; const e = T.foe('troll', 1, 0, false); e.hp = e.mhp = 400; F.use('backstab', e.x, e.y); return e.pois ? e.pois.d : 0; };
        out.lacerate = [stab('lacerate'), stab(null)];
        out.cls = D.tables.PERKS.filter((p) => p.bp).map((p) => p.id + ':' + (p.cls || '-'));
        return out;
      });
      assert.ok(r.stalker[0] > r.stalker[1] * 1.3, 'unaware: ' + r.stalker); assert.ok(Math.abs(r.stalker[2] - r.stalker[3]) <= 2, 'aware foes unaffected');
      assert.deepEqual(r.warcry, [2, 0], 'stunned (one turn of it already ticked)'); assert.ok(r.frost[0] > r.frost[1] * 1.3, 'frozen: ' + r.frost);
      assert.ok(r.lacerate[0] >= 2 && r.lacerate[1] === 0, 'bleeds: ' + r.lacerate);
      assert.deepEqual(r.cls.sort(), ['frostbite:mage', 'lacerate:rogue', 'stalker:-', 'warcry:warrior']);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // ------------------------------------------------------------------------------------------------ Heat
  it('Heat unlock chain: a win at the highest unlocked Heat opens the next (to 5), wins below it, in a Daily or on Auto-less abandon do not; the picker follows', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 21, meta: { ...BASE } });
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, I = D.idle, m = D.api.meta(), out = { max: [] };
        const win = (heat, daily) => { D.fn.startRun('warrior', { heat, daily }); document.getElementById('modal').style.display = 'none'; const G = D(); G.won = true; G.floor = 8; D.api.finish('win'); const t = document.getElementById('heatRecap'); document.getElementById('modalBox').querySelector('button').click(); return t ? t.textContent : null; };
        out.start = I.heatMax();                         // no win yet: Heat 0 only
        out.w0 = win(0); out.afterW0 = I.heatMax();       // the first win opens Heat 1 (and only that)
        out.w0b = win(0); out.afterW0b = I.heatMax();     // winning below the top opens nothing
        out.w1 = win(1); out.afterW1 = I.heatMax();
        out.dly = (m.dly = {}, win(2, true)); out.afterDaily = I.heatMax();
        for (let h = 2; h <= 5; h++) { win(h); out.max.push(I.heatMax()); }
        out.w5 = win(5); out.final = I.heatMax();
        out.clamp = (m.heatSel = 5, m.heat = 2, I.heatSel());
        out.hard = { off: (m.heatSel = 0, window.__dbg.mods.hardOn()), on: (m.heatSel = 1, window.__dbg.mods.hardOn()), un: window.__dbg.mods.hardUnlocked() };
        out.rows = D.idle.HEAT.map((x) => x.n); out.gold = [0, 1, 2, 3, 4, 5].map(I.heatGold);
        return out;
      });
      assert.equal(r.start, 0); assert.equal(r.w0, null); assert.equal(r.afterW0, 1, 'a first win unlocks Heat 1 (as Hard was)'); assert.equal(r.afterW0b, 1);
      assert.match(r.w1, /Heat 2/); assert.equal(r.afterW1, 2); assert.equal(r.dly, null); assert.equal(r.afterDaily, 2);
      assert.deepEqual(r.max, [3, 4, 5, 5]); assert.equal(r.w5, null); assert.equal(r.final, 5);
      assert.equal(r.clamp, 2, 'the selection never exceeds what is unlocked'); assert.deepEqual(r.hard, { off: false, on: true, un: true });
      assert.equal(r.rows.length, 6); assert.deepEqual(r.gold, [1, 1.5, 1.75, 2, 2.25, 2.5]);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('Heat 1 is exactly the old Hard (same enemy numbers, potions, dragon, gold x1.5, score x1.5, nothing from Heat 2+); each higher Heat adds its one rule', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 22, meta: { ...BASE, wins: 1, heat: 5 } });
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, F = D.fn, B = D.tables.BAL, I = D.idle, m = D.api.meta(), out = {};
        const start = (heat) => { D.fn.startRun('warrior', { heat }); document.getElementById('modal').style.display = 'none'; return D(); };
        const stop = () => { D.api.finish('abandon'); document.getElementById('modalBox').querySelector('button').click(); };
        // enemy numbers and starting potions at Heat 0 / 1 / 5 against the Hard formulas
        let G = start(0); const e0 = F.makeEnemy('goblin', 1, 1, 3), d0 = F.makeEnemy('dragon', 2, 2, 8); out.h0 = { hp: e0.hp, atk: e0.atk, dat: d0.atk, pots: G.inv.pot, hard: G.hard }; stop();
        G = start(1); const e1 = F.makeEnemy('goblin', 1, 1, 3), d1 = F.makeEnemy('dragon', 2, 2, 8); out.h1 = { hp: e1.hp, atk: e1.atk, dat: d1.atk, pots: G.inv.pot, hard: G.hard, heat: G.heat }; out.want = { hp: Math.round(e0.hp * B.hard.hpMul), atk: Math.round(e0.atk * B.hard.atkMul), dat: Math.round(d0.atk * B.hard.bossAtkMul) };
        // Heat 1 has no Heat 2+ rule: same foe count, normal potion heal, hard dragon enrage fraction
        out.enrage1 = (() => { const d = F.makeEnemy('dragon', 2, 2, 8); return B.hard.enrageFrac; })();
        const pot = () => { const p = D().p; p.hp = 10; p.mhp = 100; D().inv.pot = 3; F.endTurn; const h0 = p.hp; document.getElementById('b_pot') && 0; return p; };
        const heal = (heat) => { const G2 = start(heat); const p = G2.p; p.mhp = 100; p.hp = 10; G2.inv.pot = 3; G2.enemies = []; document.getElementById('b_pot').click(); const h = p.hp - 10; stop(); return h; };
        out.heal = [heal(1), heal(3), heal(4)];
        // foes per floor: Heat 2 adds extraFoes from floor 2
        const count = (heat) => { const seeds = []; let t = 0; for (let s = 0; s < 12; s++) { const g = start(heat); let a = 7 + s; Math.random = () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; F.newFloor(3); t += D().enemies.length; stop(); } return t; };
        const rnd = Math.random; out.count = [count(1), count(2)]; Math.random = rnd;
        // dragon enrage at 75% HP: Heat 5 yes, Heat 1 no
        const rage = (heat) => { const G3 = start(heat); F.newFloor(8, { mod: null, v: 0 }); const d = G3.enemies.find((e) => e.t === 'dragon'); d.hp = Math.floor(d.mhp * 0.75); d.awake = true; d.wind = null; d.cd = 99; G3.enemies = [d]; for (const [dx, dy] of [[-2, 0], [2, 0], [0, 2], [0, -2]]) if (G3.map[(d.y + dy) * 30 + d.x + dx] === 1) { G3.p.x = d.x + dx; G3.p.y = d.y + dy; break; } F.computeVis(); G3.p.hp = G3.p.mhp = 9999; F.enemiesAct(); const r = !!d.enraged; stop(); return r; };
        out.rage = [rage(1), rage(5)];
        // gold and score
        const bank = (heat) => { const G4 = start(heat); G4.p.gold = 100; const g0 = m.gold; stop(); return m.gold - g0; };
        out.bank = [bank(0), bank(1), bank(2), bank(5)];
        out.score = [0, 1, 5].map((h) => D.mods.scoreOf({ floor: 3, kills: 5, p: { lvl: 2 }, turn: 300, heat: h, hard: h > 0 ? 1 : 0 }, true));
        // elites: Heat 3 key elites are tougher (force the vault floor)
        const elite = (heat) => { for (let s = 0; s < 60; s++) { start(heat); F.newFloor(3); const e = D().enemies.find((x) => x.elite); const res = e ? { hp: e.mhp / EN_hp(e), atk: e.atk } : null; stop(); if (res) return res; } return null; };
        const EN_hp = (e) => { const d = D.tables.EN[e.t]; return 1; };
        out.elite = [elite(2), elite(3)];
        return out;
      });
      assert.equal(r.h0.hard, 0); assert.equal(r.h0.pots, 1); assert.equal(r.h1.hard, 1); assert.equal(r.h1.heat, 1); assert.equal(r.h1.pots, 0, 'one fewer starting potion');
      assert.equal(r.h1.hp, r.want.hp); assert.equal(r.h1.atk, r.want.atk); assert.equal(r.h1.dat, r.want.dat);
      assert.ok(r.heal[0] === r.heal[1] && r.heal[2] < r.heal[0], 'Heat 4: potions heal less: ' + r.heal);
      assert.ok(r.count[1] >= r.count[0] + 12, 'Heat 2 adds foes: ' + r.count);
      assert.deepEqual(r.rage, [false, true], 'Heat 5: the dragon enrages early');
      assert.deepEqual(r.bank, [100, 150, 175, 250]);
      assert.equal(r.score[1], Math.round(r.score[0] * 1.5)); assert.equal(r.score[2], Math.round(r.score[0] * 2.5));
      assert.ok(r.elite[0] && r.elite[1], 'elites found');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('Heat 3: the key-carrying elite has more HP and attack than at Heat 2 (same floor, same seed)', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 23, meta: { ...BASE, wins: 1, heat: 5 } });
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, F = D.fn, B = D.tables.BAL, out = {};
        const elite = (heat, seed) => {
          D.fn.startRun('warrior', { heat }); document.getElementById('modal').style.display = 'none';
          let a = seed; Math.random = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
          F.newFloor(4); const e = D().enemies.find((x) => x.elite); const res = e ? { t: e.t, hp: e.mhp, atk: e.atk } : null; D.api.finish('abandon'); document.getElementById('modalBox').querySelector('button').click(); return res;
        };
        const rnd = Math.random;
        for (let s = 1; s < 80; s++) { const a = elite(2, s * 977), b = elite(3, s * 977); if (a && b && a.t === b.t) { out.a = a; out.b = b; break; } }
        Math.random = rnd; out.mul = [B.heat.eliteHpMul, B.heat.eliteAtkMul];
        return out;
      });
      assert.ok(r.a && r.b, 'found the same elite at both Heats');
      assert.ok(r.b.hp > r.a.hp * 1.4 && r.b.atk > r.a.atk * 1.15, 'Heat 3 elite: ' + JSON.stringify([r.a, r.b]));
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});
