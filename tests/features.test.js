// Feature tests: floor modifiers, branching exits, the locked treasure room, Daily seeding, records / achievements / gold banking /
// Hard mode and the save migrations around them. Every test has its own browser context and runs concurrently with the others.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, startRun, openRun, closeModal, dbgReady, HELPERS, CONC, reload } = require('./lib/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const BASE_META = { seenHelp: 1, gold: 0, unl: { rogue: 1, mage: 1 } };
const run = (page, cls) => page.locator('#title button', { hasText: new RegExp(cls) }).click();

describe('features', { concurrency: CONC }, () => {
  // ------------------------------------------------------------------------------------------------ floor modifiers
  it('every modifier generates a completable floor over many seeds (stairs reachable, nothing sealed in, stairsOk)', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 5, meta: BASE_META });
    try {
      await startRun(page, 'warrior');
      const rep = await page.evaluate(() => {
        const g = () => window.__dbg(), F = window.__dbg.fn, M = window.__dbg.mods, out = { fails: [], floors: 0, seen: {} };
        const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const m of M.MODS) {
          for (let i = 0; i < 36; i++) {
            const f = m.minF + (i % (7 - m.minF + 1));                    // every depth the modifier can roll on (2..7), several times
            F.newFloor(f, { mod: m.id, v: i % 2 }); out.floors++;
            const G = g(), W = 30, tag = m.id + ' f' + f + ' #' + i;
            if (G.mod !== m.id) out.fails.push(tag + ': modifier not applied');
            const seen = new Set([G.p.y * W + G.p.x]), q = [[G.p.x, G.p.y]];
            for (let j = 0; j < q.length; j++) for (const [dx, dy] of DIRS) {
              const nx = q[j][0] + dx, ny = q[j][1] + dy, k = ny * W + nx;
              if (nx < 0 || ny < 0 || nx >= 30 || ny >= 30 || seen.has(k) || G.map[k] === 0 || G.map[k] === 5) continue;
              seen.add(k); q.push([nx, ny]);
            }
            if (!seen.has(G.map.indexOf(2))) out.fails.push(tag + ': stairs unreachable');
            if (!window.__dbg.api.stairsOk()) out.fails.push(tag + ': stairsOk false');
            for (const e of G.enemies) if (!e.elite && !seen.has(e.y * W + e.x)) out.fails.push(tag + ': enemy sealed in');
            if (G.merchant && !DIRS.some((d) => seen.has((G.merchant.y + d[1]) * W + G.merchant.x + d[0]))) out.fails.push(tag + ': merchant unreachable');
            if (m.id === 'flooded' && !G.water.length) out.fails.push(tag + ': no water');
            if (m.id === 'flooded' && G.water.some((k) => G.map[k] !== 1 || k === G.p.y * W + G.p.x)) out.fails.push(tag + ': water on a non-floor tile / start');
            if (m.id === 'hunted' && !G.enemies.some((e) => e.hunter && e.awake)) out.fails.push(tag + ': no awake stalker');
            if (m.id === 'horde' && (G.treasure || G.enemies.some((e) => e.elite))) out.fails.push(tag + ': horde has elite/treasure');
            if (m.id === 'cursed' && !G.shrine) out.fails.push(tag + ': cursed floor without shrine');
            if (m.id !== 'flooded' && G.water.length) out.fails.push(tag + ': water without Flooded');
            out.seen[m.id] = (out.seen[m.id] || 0) + 1;
          }
        }
        return out;
      });
      assert.deepEqual(rep.fails, []);
      assert.equal(Object.keys(rep.seen).length, 8);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('modifier rules: cursed ground, dark sight, silent sneak and hearing, rich gold, flooded wading, unstable collapse, hunted reward', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 6, meta: BASE_META });
    try {
      await page.evaluate(HELPERS);
      const r = await page.evaluate(() => {
        const g = () => window.__dbg(), F = window.__dbg.fn, A = window.__dbg.api, B = window.__dbg.tables.BAL, T = window.T, o = {};
        const clear = () => { g().enemies.length = 0; };
        // cursed: no natural regeneration, potions weakened
        F.newFloor(3, { mod: 'cursed', v: 0 }); clear(); g().p.hp = 10; for (let i = 0; i < 40; i++) F.endTurn(); o.cursedHp = g().p.hp;
        g().inv.pot = 1; g().p.hp = 10; g().p.mhp = 100; document.getElementById('b_pot').click(); o.cursedPot = g().p.hp - 10; o.potsLeft = g().inv.pot;
        F.newFloor(3, { mod: null, v: 0 }); clear(); g().p.mhp = 100; g().p.hp = 10; g().inv.pot = 1; document.getElementById('b_pot').click(); o.plainPot = g().p.hp - 10;
        // dark: short sight
        F.newFloor(3, { mod: 'dark', v: 0 }); F.computeVis(); { const G = g(); let far = 0; for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) if (G.vis[y * 30 + x] && Math.hypot(x - G.p.x, y - G.p.y) > B.mod.dark.sight + 1.2) far++; o.darkFar = far; }
        // silent: warrior sneak multiplier, and sleeping enemies only notice you from a short distance
        F.newFloor(3, { mod: 'silent', v: 0 }); o.silentSneak = window.__dbg.gear.sneakMul();
        T.setup(8); g().mod = 'silent'; { const e = T.foe('goblin', 6, 0, false); F.enemiesAct(); o.silentNoticed = e.awake; }   // (setup may roll a new floor: pin the modifier)
        F.newFloor(3, { mod: null, v: 0 }); o.plainSneak = window.__dbg.gear.sneakMul();
        T.setup(8); g().mod = null; { const e = T.foe('goblin', 6, 0, false); F.enemiesAct(); o.plainNoticed = e.awake; }
        // rich: doubled gold on pickup
        F.newFloor(3, { mod: 'rich', v: 0 }); { const G = g(); clear(); G.items.length = 0; G.p.goldMul = 1; const g0 = G.p.gold; G.items.push({ x: G.p.x, y: G.p.y, t: 'gold', v: 10 }); F.tryMove(0, 0); o.richGold = G.p.gold - g0; }
        // flooded: stepping into water gives the awake enemy a free move
        let step = null; for (let tries = 0; tries < 6 && !step; tries++) { F.newFloor(4, { mod: 'flooded', v: 0 }); const G = g(); clear(); const w = new Set(G.water);
          for (let y = 1; y < 29 && !step; y++) for (let x = 1; x < 29 && !step; x++) { if (!w.has(y * 30 + x)) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const px = x + dx, py = y + dy; if (G.map[py * 30 + px] === 1 && !w.has(py * 30 + px)) { step = { px, py, dx: -dx, dy: -dy }; break; } } } }
        { const G = g(); const w = new Set(G.water);
          o.waterFound = !!step;
          const w2 = new Set(G.water); if (step) { G.p.x = step.px; G.p.y = step.py; G.items.length = 0; G.seen.fill(true); let cand = null; for (let y = 1; y < 29 && !cand; y++) for (let x = 1; x < 29 && !cand; x++) { const d = Math.abs(x - step.px) + Math.abs(y - step.py); if (d >= 2 && d <= 5 && G.map[y * 30 + x] === 1 && !w2.has(y * 30 + x) && !(x === step.px + step.dx && y === step.py + step.dy) && (F.bfsPath(step.px, step.py, x, y) || []).length > 0) cand = [x, y]; } const e = F.makeEnemy('goblin', cand[0], cand[1], 4); e.awake = true; G.enemies = [e]; F.computeVis(); F.tryMove(step.dx, step.dy); o.waded = /slog through the water/.test(G.log.join('|')); } }
        // unstable: cracks appear, collapse hurts the one standing on them, not the one who moved away
        F.newFloor(4, { mod: 'unstable', v: 0 }); { const G = g(); clear(); G.p.hp = G.p.mhp; for (let i = 0; i < 8; i++) F.endTurn(); o.cracks = G.cracks.length;
          G.p.hp = G.p.mhp; G.cracks = [{ x: G.p.x, y: G.p.y, t: 1 }]; const h = G.p.hp; F.endTurn(); o.collapseDmg = h - G.p.hp; o.cracksLeft = G.cracks.length; }
        // hunted: stalker reward
        F.newFloor(4, { mod: 'hunted', v: 0 }); { const G = g(); const st = G.enemies.find((e) => e.hunter); o.hunter = !!st; G.items.length = 0; A.killEnemy(st); o.reward = G.items.map((i) => i.t).sort().join(','); o.huntAch = !!A.meta().ach.hunt; }
        return o;
      });
      assert.equal(r.cursedHp, 10, 'no natural regen on cursed ground');
      assert.equal(r.potsLeft, 0, 'a drunk potion is used up');
      assert.ok(r.cursedPot > 0 && r.cursedPot < r.plainPot, 'cursed potion heals less: ' + r.cursedPot + ' vs ' + r.plainPot);
      assert.equal(r.darkFar, 0, 'dark: nothing visible beyond the short radius');
      assert.ok(r.silentSneak > r.plainSneak, 'silent: warrior sneak attacks are stronger');
      assert.equal(r.silentNoticed, false, 'silent: a sleeper 6 tiles away does not notice you');
      assert.equal(r.plainNoticed, true, 'normal floor: it does');
      assert.equal(r.richGold, 20, 'rich vein doubles picked-up gold');
      assert.equal(r.waterFound, true); assert.equal(r.waded, true, 'stepping into water gives the awake enemy a free move');
      assert.ok(r.cracks >= 1, 'unstable floor produced cracks'); assert.ok(r.collapseDmg > 0, 'collapse hurt the player standing on it'); assert.equal(r.cracksLeft, 0);
      assert.equal(r.hunter, true); assert.match(r.reward, /gold/); assert.match(r.reward, /potion/); assert.equal(r.huntAch, true);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // ------------------------------------------------------------------------------------------------ exits
  it('stairs open a two-way choice by touch; each route shows theme and modifier; Stay and choosing both work; merchants on both branches', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 7, touch: true, meta: BASE_META });
    try {
      const goStairs = () => page.evaluate(() => {
        const G = window.__dbg(); G.enemies.length = 0; const k = G.map.indexOf(2); G.p.x = k % 30; G.p.y = Math.floor(k / 30); window.__dbg.fn.computeVis(); window.__dbg.fn.endTurn();
        return { floor: G.floor, opts: G.opts };
      });
      const s = await goStairs();
      assert.equal(s.opts.length, 2);
      await page.locator('#b_down').tap();
      await page.waitForSelector('#modalBox h2');
      assert.match(await page.locator('#modalBox h2').textContent(), /pick a path/);
      const btns = await page.locator('#modalBox button').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent, h: r.height, w: r.width }; }));
      assert.equal(btns.length, 3);
      for (const b of btns) assert.ok(b.h >= 44 && b.w >= 44, JSON.stringify(b));
      for (const name of ['The Crypt', 'The Ossuary']) assert.ok(btns.slice(0, 2).some((b) => b.t.includes(name)), 'theme ' + name + ' shown: ' + JSON.stringify(btns.map((b) => b.t)));
      for (let i = 0; i < 2; i++) assert.match(btns[i].t, /Plain floor|Risk:/);
      // Stay: nothing changes
      await page.locator('#modalBox button', { hasText: /Stay here/ }).tap();
      assert.equal(await page.evaluate(() => window.__dbg().floor), 1);
      // second option by touch
      await page.locator('#b_down').tap();
      await page.locator('#modalBox button').nth(1).tap();
      const after = await page.evaluate(() => { const G = window.__dbg(); return { floor: G.floor, mod: G.mod, variant: G.variant }; });
      assert.equal(after.floor, 2); assert.equal(after.mod, s.opts[1].mod); assert.equal(after.variant, s.opts[1].v);
      // the dragon lair has no choice; floors 7 -> 8 go straight down
      const direct = await page.evaluate(() => { const F = window.__dbg.fn; F.newFloor(7, { mod: null, v: 0 }); const G = window.__dbg(); G.enemies.length = 0; const k = G.map.indexOf(2); G.p.x = k % 30; G.p.y = Math.floor(k / 30); F.descend(); return { floor: G.floor, opts: G.opts, modal: document.getElementById('modal').style.display }; });
      assert.equal(direct.floor, 8); assert.equal(direct.opts, null); assert.equal(direct.modal, 'none');
      // merchant floors keep their merchant on both branches
      const mer = await page.evaluate(() => {
        const F = window.__dbg.fn, res = [];
        for (const f of [3, 6]) for (const v of [0, 1]) for (const mod of [null, 'hunted', 'horde', 'flooded', 'unstable']) for (let i = 0; i < 3; i++) { F.newFloor(f, { mod, v }); if (!window.__dbg().merchant) res.push(f + ':' + mod); }
        return res;
      });
      assert.deepEqual(mer, []);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('exit options: never two plain routes, never a modifier on floor 1 or the dragon floor, and the HUD chip explains the modifier on tap', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 8, touch: true, meta: BASE_META });
    try {
      const r = await page.evaluate(() => {
        const F = window.__dbg.fn, bad = [], counts = { mod: 0, none: 0 };
        for (let nf = 2; nf <= 7; nf++) for (let i = 0; i < 150; i++) {
          const o = F.rollOpts(nf);
          if (!o[0].mod && !o[1].mod) bad.push('two plain at ' + nf);
          if (o[0].mod && o[0].mod === o[1].mod) bad.push('same mod twice at ' + nf);
          if (o[0].v === o[1].v) bad.push('same theme twice');
          for (const x of o) { if (x.mod) counts.mod++; else counts.none++; if (x.mod === 'hunted' && nf < 3) bad.push('hunted too early'); }
        }
        return { bad, counts, floor8: (F.newFloor(8, { mod: 'dark', v: 1 }), window.__dbg().opts) };
      });
      assert.deepEqual(r.bad, []);
      assert.ok(r.counts.mod > 0.4 * (r.counts.mod + r.counts.none) && r.counts.mod < 0.75 * (r.counts.mod + r.counts.none), JSON.stringify(r.counts));
      assert.equal(r.floor8, null);
      // chip: tap shows a one-line explanation
      await page.evaluate(() => window.__dbg.fn.newFloor(3, { mod: 'silent', v: 0 }));
      const chip = page.locator('#chips .chip.mod');
      await chip.waitFor();
      const box = await page.evaluate(() => { const r = document.querySelector('#chips .chip.mod').getBoundingClientRect(); return { width: r.width, height: r.height }; }); assert.ok(box.height >= 44 && box.width >= 44, JSON.stringify(box));
      await chip.tap();
      await page.waitForFunction(() => document.getElementById('toast').style.opacity === '1');
      assert.match(await page.locator('#toast').textContent(), /Silent/);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('locked treasure room: the elite drops the key, the door stays locked without it and opens with it; stairsOk rejects blocked merchants/shrines', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 23, meta: BASE_META });
    try {
      const r = await page.evaluate(() => {
        const G = window.__dbg(), F = window.__dbg.fn, A = window.__dbg.api, out = {};
        for (let i = 0; i < 60 && !G.treasure; i++) F.newFloor(3 + (i % 4));
        out.treasure = !!G.treasure;
        const [dx, dy] = G.treasure.door, W = 30, at = (x, y) => y * W + x;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [dx + a, dy + b, -a, -b]).find((t) => G.map[at(t[0], t[1])] === 1);
        const stand = (x, y) => { G.p.x = x; G.p.y = y; G.enemies = G.enemies.filter((e) => e.elite); G.items = G.items.filter((i) => i.t === 'key'); };
        const elite = G.enemies.find((e) => e.elite); out.elite = !!elite;
        stand(nb[0], nb[1]); G.keys = 0;
        out.lockedRefused = F.tryMove(nb[2], nb[3]) === false && G.map[at(dx, dy)] === 5;
        elite.hp = 1; G.items = []; A.killEnemy(elite);
        const key = G.items.find((i) => i.t === 'key'); out.keyDropped = !!key;
        if (key) { G.p.x = key.x; G.p.y = key.y; F.tryMove(0, 0); }
        out.keys = G.keys;
        stand(nb[0], nb[1]);
        out.opened = F.tryMove(nb[2], nb[3]) === true && G.map[at(dx, dy)] === 4 && G.keys === 0;
        return out;
      });
      assert.ok(r.treasure && r.elite, 'found a floor with a treasure room: ' + JSON.stringify(r));
      assert.ok(r.lockedRefused, 'a locked door does not open without a key');
      assert.ok(r.keyDropped, 'the elite drops a key'); assert.equal(r.keys, 1, 'the key is picked up');
      assert.ok(r.opened, 'with the key the door opens (and uses it up)');
      // stairsOk: a merchant sealed into a pocket, or a shrine the player cannot reach, makes a floor invalid
      const s = await page.evaluate(() => {
        const G = window.__dbg(), api = window.__dbg.api, W = 30, out = {};
        G.map.fill(0); for (let x = 3; x <= 10; x++) G.map[5 * W + x] = 1; G.map[5 * W + 10] = 2;
        G.p.x = 3; G.p.y = 5; G.enemies = []; G.shrine = null; G.merchant = null; G.treasure = null;
        out.plain = api.stairsOk();
        G.map[9 * W + 12] = 1; G.merchant = { x: 12, y: 9, stock: [] }; out.sealedMerchant = api.stairsOk();
        G.merchant = { x: 9, y: 5, stock: [] }; G.map[5 * W + 9] = 1; out.merchantBlocksCorridor = api.stairsOk();
        G.merchant = null; G.map[5 * W + 9] = 1; G.map[9 * W + 12] = 1; G.shrine = { x: 12, y: 9, used: 0, left: 0 }; out.sealedShrine = api.stairsOk();
        return out;
      });
      assert.equal(s.plain, true); assert.equal(s.sealedMerchant, false); assert.equal(s.merchantBlocksCorridor, false); assert.equal(s.sealedShrine, false);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('merchant: a purchase costs gold and is refused when you cannot pay or the potion belt is full; elixir and scrolls apply', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 28, meta: BASE_META });
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, G = D(), p = G.p, B = D.tables.BAL, out = {};
        G.merchant = { x: p.x + 1, y: p.y, stock: [
          { k: 'pot', n: '🧪 Health potion', d: 'x', price: 10 }, { k: 'pot', n: '🧪 Health potion', d: 'x', price: 10 },
          { k: 'elixir', n: '🧿 Elixir of Vigor', d: 'x', price: 30 }, { k: 'fire', n: '📜 Flame scroll', d: 'x', price: 20 }] };
        const st = () => G.merchant.stock.map((s) => !!s.sold);
        p.gold = 45; G.inv.pot = 0; D.api.buy(0); out.buy = [G.inv.pot, p.gold, st()[0]];
        p.gold = 5; D.api.buy(1); out.broke = [G.inv.pot, p.gold, st()[1]];
        p.gold = 100; G.inv.pot = p.potCap; D.api.buy(1); out.full = [G.inv.pot === p.potCap, p.gold, st()[1]];
        const mhp = p.mhp; p.hp = 1; D.api.buy(2); out.elixir = [p.mhp - mhp, p.hp === p.mhp, p.gold];
        const f0 = G.inv.fire; D.api.buy(3); out.fire = [G.inv.fire - f0, p.gold];
        out.elixirHp = B.merchant.elixirHp;
        return out;
      });
      assert.deepEqual(r.buy, [1, 35, true]);
      assert.deepEqual(r.broke, [1, 5, false], 'cannot buy without the gold');
      assert.deepEqual(r.full, [true, 100, false], 'a full potion belt refuses another potion (and keeps your gold)');
      assert.deepEqual(r.elixir, [r.elixirHp, true, 70]);
      assert.deepEqual(r.fire, [1, 50]);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // ------------------------------------------------------------------------------------------------ daily
  const capture = (page) => page.evaluate(() => {
    const F = window.__dbg.fn, out = [];
    const snap = () => { const G = window.__dbg(); return JSON.stringify({ f: G.floor, mod: G.mod, v: G.variant, map: G.map, p: [G.p.x, G.p.y], en: G.enemies.map((e) => [e.t, e.x, e.y, e.hp, e.atk, !!e.elite, !!e.hunter]), it: G.items.map((i) => [i.t, i.k, i.v, i.x, i.y, i.tr]), sh: G.shrine && [G.shrine.x, G.shrine.y], me: G.merchant && [G.merchant.x, G.merchant.y, G.merchant.stock.map((s) => s.n)], w: G.water, opts: G.opts }); };
    out.push(snap());
    for (let f = 2; f <= 8; f++) { const G = window.__dbg(); F.goDown(f < 8 ? G.opts[f % 2] : { mod: null, v: 0 }); out.push(snap()); }
    return out;
  });
  const startDaily = async (page, cls) => { await page.locator('#btnDaily').click(); await run(page, cls); await dbgReady(page); await closeModal(page); };

  it('the same date gives identical floors, modifiers, exits, enemies and loot across two fresh page loads (different Math.random)', async () => {
    const a = await newPage(browser, { seed: 111, fakeDate: [2026, 5, 15], meta: BASE_META });
    const b = await newPage(browser, { seed: 222, fakeDate: [2026, 5, 15], meta: BASE_META });
    const c = await newPage(browser, { seed: 111, fakeDate: [2026, 5, 16], meta: BASE_META });
    try {
      const [fa, fb, fc] = await Promise.all([a, b, c].map(async (x) => { await startDaily(x.page, 'Warrior'); return capture(x.page); }));
      assert.equal(fa.length, 8);
      assert.deepEqual(fa, fb);
      assert.notDeepEqual(fa[0], fc[0], 'another date must give another dungeon');
      assert.equal(await a.page.evaluate(() => window.__dbg().daily), '2026-06-15');
      // the plan for a floor does not depend on which way you went before
      const opt = await a.page.evaluate(() => { const F = window.__dbg.fn; return [0, 1].map(() => JSON.stringify(F.rollOpts(5))); });
      assert.equal(opt[0], opt[1]);
      // ... and neither does the floor itself: the same Daily floor comes out the same after the random stream was used in between
      const same = await a.page.evaluate(() => {
        const F = window.__dbg.fn, G = window.__dbg(); F.newFloor(3, { mod: null, v: 0 }); const m1 = JSON.stringify([G.map, G.enemies.map((e) => [e.t, e.x, e.y]), G.items.map((i) => [i.t, i.x, i.y])]);
        for (let i = 0; i < 7; i++) F.makeEnemy('goblin', 1, 1, 3);                       // draws from the Daily stream
        F.newFloor(3, { mod: null, v: 0 }); return m1 === JSON.stringify([G.map, G.enemies.map((e) => [e.t, e.x, e.y]), G.items.map((i) => [i.t, i.x, i.y])]);
      });
      assert.equal(same, true, 'a Daily floor does not depend on what happened before');
      for (const x of [a, b, c]) assert.deepEqual(x.errors, []);
    } finally { for (const x of [a, b, c]) await x.ctx.close(); }
  });

  it('combat rolls are seeded too: same actions on the same date give the same outcome; Daily result is recorded per day and survives reload', async () => {
    const play = async (seed) => {
      const x = await newPage(browser, { seed, fakeDate: [2026, 5, 15], meta: BASE_META });
      await startDaily(x.page, 'Rogue');
      const res = await x.page.evaluate(() => {
        // a real fight: swing at a goblin next to you; every hit and every counter-attack rolls the combat stream
        const F = window.__dbg.fn, G = window.__dbg(); const log = [];
        const e = F.makeEnemy('goblin', G.p.x + 1, G.p.y, 3); e.hp = e.mhp = 400; e.awake = true;
        for (let i = 0; i < 14 && !G.over; i++) { F.tryMove(1, 0); if (document.getElementById('modal').style.display !== 'none') document.getElementById('modal').style.display = 'none'; log.push(e.hp + ':' + G.p.hp + ':' + G.p.x + ':' + G.kills); }
        return { log: log.join('|'), turn: G.turn };
      });
      return { x, res };
    };
    const [A, B] = await Promise.all([play(1), play(2)]);
    try {
      assert.equal(A.res.log, B.res.log);
      // record: end the run, reload, the Daily button reports the result
      await A.x.page.evaluate(() => { window.__dbg.api.finish('dead'); });
      await reload(A.x.page);
      assert.match(await A.x.page.locator('#btnDaily').textContent(), /floor \d+ · \d+ pts/);
      const m = await A.x.page.evaluate(() => JSON.parse(localStorage.getItem('dcr_meta_v1')).dly);
      assert.equal(Object.keys(m).length, 1); assert.equal(m['2026-06-15'].att, 1);
      for (const x of [A.x, B.x]) assert.deepEqual(x.errors, []);
    } finally { await A.x.ctx.close(); await B.x.ctx.close(); }
  });

  it('a Daily run saves and continues with its seeded stream intact', async () => {
    const x = await newPage(browser, { seed: 3, fakeDate: [2026, 5, 15], meta: BASE_META });
    try {
      await startDaily(x.page, 'Warrior');
      await x.page.evaluate(() => { const F = window.__dbg.fn; for (let i = 0; i < 6; i++) F.tryMove(1, 0); F.save(); });
      const before = await x.page.evaluate(() => { const G = window.__dbg(); return { turn: G.turn, rs: G.rs, daily: G.daily }; });
      await reload(x.page);
      await x.page.locator('#title button', { hasText: /Continue run/ }).click();
      const after = await x.page.evaluate(() => { const G = window.__dbg(); return { turn: G.turn, rs: G.rs, daily: G.daily }; });
      assert.deepEqual(after, before);
      assert.deepEqual(x.errors, []);
    } finally { await x.ctx.close(); }
  });

  // ------------------------------------------------------------------------------------------------ records, achievements, banking, Hard
  it('records: score and NEW RECORD on the recap; runs, wins, streaks, fastest win and achievements persist across reload', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 9, meta: BASE_META });
    try {
      // five finished runs: lose, win (800 turns), win (500), win (900), lose. startRun() through the same API the title uses.
      const recap = await page.evaluate(() => {
        const D = window.__dbg, F = D.fn, texts = [], B = D.tables.BAL;
        const play = (kind, over) => {
          F.startRun('warrior'); document.getElementById('modal').style.display = 'none';
          const G = D(); Object.assign(G, over); if (over.lvl) G.p.lvl = over.lvl; if (kind === 'win') { G.won = true; G.stats.pots = 0; }
          D.api.finish(kind); texts.push(document.getElementById('modalBox').textContent);
        };
        play('dead', { floor: 3, kills: 5 });
        play('win', { floor: 6, kills: 20, turn: 800, lvl: 5 });
        play('win', { floor: 6, kills: 20, turn: 500, lvl: 5 });
        play('win', { floor: 6, kills: 20, turn: 900, lvl: 5 });
        const m = D.api.meta(), streakAfterWins = m.streak;
        play('dead', { floor: 2, kills: 1 });
        return { texts, streakAfterWins, streak: m.streak, bstreak: m.bstreak, fast: m.rec.n.warrior.fast };
      });
      assert.match(recap.texts[0], /Score\s*\d+/);
      assert.match(recap.texts[1], /NEW RECORD/); assert.match(recap.texts[1], /Achievement/); assert.match(recap.texts[1], /First Victory/);
      assert.match(recap.texts[2], /fastest win/, 'a quicker win is a new record');
      assert.doesNotMatch(recap.texts[3], /fastest win/, 'a slower win is not');
      assert.equal(recap.streakAfterWins, 3); assert.equal(recap.streak, 0, 'a loss ends the win streak'); assert.equal(recap.bstreak, 3);
      assert.equal(recap.fast, 500);
      await page.evaluate(() => window.__dbg.api.showTitle());
      await reload(page);
      await page.locator('#btnMore').click();
      await page.locator('#btnRecords').click();
      const rec = await page.locator('#titleBox').textContent();
      assert.match(rec, /Runs 5/); assert.match(rec, /Wins 3/); assert.match(rec, /\(best 3\)/); assert.match(rec, /Fastest 500t/);
      await page.locator('#btnBack').click();
      await page.locator('#btnAch').click();
      const have = await page.locator('#titleBox [data-ach][data-have="1"]').evaluateAll((els) => els.map((e) => e.dataset.ach));
      for (const id of ['win1', 'winW', 'dry']) assert.ok(have.includes(id), id + ' earned: ' + have);
      assert.equal(await page.locator('#titleBox [data-ach]').count(), await page.evaluate(() => window.__dbg.mods.ACH.length));
      assert.ok((await page.evaluate(() => window.__dbg.mods.ACH.length)) >= 15);
      const lock = await page.locator('#titleBox [data-ach][data-have="0"]').first().evaluate((e) => e.style.opacity);
      assert.ok(lock && Number(lock) < 1, 'locked entries are dimmed');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('gold banking: full gold for an abandoned run, +win bonus for a win, x1.5 on Hard; Hard score x1.5', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 24, meta: { ...BASE_META, wins: 1 } });
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, F = D.fn, m = D.api.meta(), B = D.tables.BAL, out = {};
        const bank = (kind, gold, hard) => {
          m.heatSel = hard ? 1 : 0; D.mods.ACH.forEach((a) => { m.ach[a.id] = 1; });   // no achievement gold mixed into the numbers
          F.startRun('warrior'); document.getElementById('modal').style.display = 'none';
          const G = D(); G.p.gold = gold; if (kind === 'win') G.won = true;
          const g0 = m.gold; D.api.finish(kind); return m.gold - g0;
        };
        out.abandon = bank('abandon', 100, 0);
        out.win = bank('win', 100, 0);
        out.hardWin = bank('win', 100, 1);
        const g = { floor: 3, kills: 5, p: { lvl: 2 }, turn: 300 };
        out.scoreNormal = D.mods.scoreOf({ ...g, hard: 0 }, true); out.scoreHard = D.mods.scoreOf({ ...g, hard: 1 }, true);
        out.want = { win: 100 + B.run.winBonus, hardWin: Math.round((100 + B.run.winBonus) * B.heat.goldMul[1]), hardMul: B.heat.scoreMul[1] };
        return out;
      });
      assert.equal(r.abandon, 100, 'an abandoned run banks all its gold');
      assert.equal(r.win, r.want.win, 'a win adds the win bonus');
      assert.equal(r.hardWin, r.want.hardWin, 'Hard multiplies what is banked');
      assert.equal(r.scoreHard, Math.round(r.scoreNormal * r.want.hardMul));
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('achievement rewards go to the wallet once and a toast is shown during play', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 10, meta: BASE_META });
    try {
      const r = await page.evaluate(() => {
        const A = window.__dbg.mods, m = window.__dbg.api.meta(); const g0 = m.gold; const a = A.ACH.find((x) => x.id === 'hunt');
        const first = A.earn('hunt'), second = A.earn('hunt');
        return { first, second, d: m.gold - g0, reward: a.gold };
      });
      assert.equal(r.first, true); assert.equal(r.second, false); assert.equal(r.d, r.reward); assert.ok(r.reward > 0);
      await page.waitForFunction(() => document.getElementById('toast').style.opacity === '1');
      assert.match(await page.locator('#toast').textContent(), /Stalker Stalked/);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('dcr_meta_v1')).ach.hunt), 1);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('Heat picker is locked before the first win; afterwards it selects Heat 0 or 1 (Heat 2+ stay locked), persists and starts a harder run (Daily stays normal)', async () => {
    const a = await newPage(browser, { seed: 11, meta: BASE_META });
    try {
      assert.equal(await a.page.locator('#heatRow').count(), 0, 'no Heat row on the title');
      await a.page.locator('#btnNew').click();
      assert.equal(await a.page.locator('#heatRow').count(), 0, 'hidden on the class pick until the first win');
      assert.equal(await a.page.evaluate(() => window.__dbg.mods.hardOn()), false);
      assert.deepEqual(a.errors, []);
    } finally { await a.ctx.close(); }
    const b = await newPage(browser, { seed: 12, meta: { ...BASE_META, wins: 1, best: 8 } });
    try {
      assert.equal(await b.page.locator('#titleBox #heatRow').count(), 0, 'not on the title');
      await b.page.locator('#btnNew').click();
      const st = await b.page.locator('#heatRow button').evaluateAll((bs) => bs.map((e) => ({ d: e.classList.contains('locked'), h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width })));
      assert.equal(st.length, 6); assert.deepEqual(st.map((x) => x.d), [false, false, true, true, true, true], 'a win has unlocked Heat 1 only');
      assert.ok(st.every((x) => x.h >= 44 && x.w >= 44), 'tap targets: ' + JSON.stringify(st));
      await b.page.locator('#heatRow button[data-heat="1"]').click();
      assert.match(await b.page.locator('#heatInfo').textContent(), /Heat 1 · Tougher/);
      await reload(b.page);
      await b.page.locator('#btnNew').click();
      assert.match(await b.page.locator('#heatRow button.on').textContent(), /1/, 'the choice is kept');
      await b.page.locator('#title button', { hasText: /Warrior/ }).first().click(); await dbgReady(b.page); await closeModal(b.page);
      const h = await b.page.evaluate(() => { const G = window.__dbg(), F = window.__dbg.fn; const e = F.makeEnemy('goblin', 1, 1, 3); const hp = e.hp; G.hard = 0; const e2 = F.makeEnemy('goblin', 1, 1, 3); G.hard = 1; return { hard: G.hard, heat: G.heat, hp, hp0: e2.hp, pots: G.inv.pot }; });
      assert.equal(h.hard, 1); assert.equal(h.heat, 1); assert.ok(h.hp > h.hp0, 'hard enemies are tougher'); assert.equal(h.pots, 0, 'one fewer starting potion');
      assert.equal(await b.page.locator('#stats [data-ic="skull"]').count(), 1, 'Heat shows in the top bar');
      // Daily ignores the Heat choice
      await b.page.evaluate(() => { window.__dbg.api.finish('abandon'); });
      await b.page.locator('#modalBox button').click();
      await b.page.locator('#btnDaily').click(); await run(b.page, 'Warrior'); await dbgReady(b.page);
      assert.equal(await b.page.evaluate(() => window.__dbg().hard), 0);
      assert.equal(await b.page.evaluate(() => window.__dbg().heat), 0);
      assert.deepEqual(b.errors, []);
    } finally { await b.ctx.close(); }
  });

  it('Hard dragon: an extra whelp wave at 90% and earlier enrage', async () => {
    const x = await openRun(browser, 'warrior', { seed: 13, meta: { ...BASE_META, wins: 1, heatSel: 1 } });
    try {
      const r = await x.page.evaluate(() => {
        const F = window.__dbg.fn, G = window.__dbg(), B = window.__dbg.tables.BAL; F.newFloor(8, { mod: null, v: 0 });
        const d = G.enemies.find((e) => e.t === 'dragon'); d.hp = Math.round(d.mhp * 0.85); F.bossPhase(d); const waves1 = G.enemies.filter((e) => e.t === 'whelp').length;
        // Hard enrages at 60%: at 55% a normal dragon would still be calm
        G.enemies = [d]; d.hp = Math.floor(d.mhp * 0.55); d.awake = true; d.wind = null; d.cd = 99;
        for (const [dx, dy] of [[-2, 0], [2, 0], [0, 2], [0, -2], [-3, 0], [3, 0]]) { if (G.map[(d.y + dy) * 30 + d.x + dx] === 1) { G.p.x = d.x + dx; G.p.y = d.y + dy; break; } }
        F.computeVis(); G.p.hp = G.p.mhp = 9999; F.enemiesAct();
        return { waves1, per: B.enemyAi.summonN, enraged: !!d.enraged, normalFrac: B.enemyAi.enrageFrac, hardFrac: B.hard.enrageFrac };
      });
      assert.equal(r.waves1, r.per);   // normal mode only summons below 75%
      assert.ok(r.hardFrac > 0.55 && r.normalFrac < 0.55, 'the numbers this test relies on');
      assert.equal(r.enraged, true, 'Hard dragon is enraged at 55% health');
      assert.deepEqual(x.errors, []);
    } finally { await x.ctx.close(); }
  });

  // ------------------------------------------------------------------------------------------------ save migration
  it('an old meta save (flat shop levels, Hard toggle, no records/achievements fields) migrates: gold and unlocks kept, levels become the new levels, stats never drop, Hard becomes Heat 1', async () => {
    const old = { seenHelp: 1, gold: 777, hp: 2, atk: 1, pot: 1, goldp: 0, def: 3, wins: 1, best: 6, kills: 31, elites: 2, hardOn: 1, unl: { rogue: 1, scroll: 1, midas: 1 } };
    const { page, ctx, errors } = await newPage(browser, { seed: 14, meta: old });
    try {
      const m = await page.evaluate(() => JSON.parse(JSON.stringify(window.__dbg.api.meta())));
      for (const k of ['gold', 'wins', 'best', 'kills', 'elites']) assert.equal(m[k], old[k], k);
      assert.deepEqual(m.up, { hp: 2, atk: 1, def: 3, pot: 1, goldp: 0, xpf: 0, edge: 0, vigor: 0, prep: 0 }, 'old levels are the new levels of the same name');
      assert.equal(m.mv, 2); assert.equal(m.heat, 1, 'an existing winner has Heat 1'); assert.equal(m.heatSel, 1, 'a Hard toggle that was on selects Heat 1');
      assert.deepEqual(m.leg, {}, 'levels this low are identical, so no veteran bonus is needed');
      for (const k of ['hp', 'atk', 'pot', 'def', 'goldp', 'hardOn']) assert.equal(k in m, false, 'old field gone: ' + k);
      assert.deepEqual(m.unl.rogue, 1); assert.equal(m.unl.scroll, 1); assert.equal(m.unl.midas, 1);
      assert.deepEqual(m.rec, { n: {}, h: {} }); assert.equal(m.runs, 0); assert.equal(m.streak, 0); assert.ok(m.ach.win1, 'first win is recognised retroactively');
      await page.locator('#btnNew').click();
      assert.equal(await page.locator('#heatRow button[data-heat="1"]').isDisabled(), false, 'an existing winner gets Heat 1');
      await page.locator('#titleBox button.c', { hasText: /^Back$/ }).click();
      await page.locator('#btnMore').click();
      await page.locator('#btnRecords').click();
      assert.match(await page.locator('#titleBox').textContent(), /Runs 0/);
      await page.locator('#btnBack').click();
      await page.locator('#titleBox button.c', { hasText: /^Back$/ }).click();
      await page.locator('#btnUpg').click();
      assert.match(await page.locator('#titleBox').textContent(), /Hardy 2\/8/);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('a run saved by the previous version (save v2, no modifier / exit / stats fields) still continues, and the exit choice appears', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 15, touch: true, meta: BASE_META });
    try {
      await page.evaluate(() => { const F = window.__dbg.fn; for (let i = 0; i < 4; i++) F.tryMove(1, 0); F.save(); });
      await page.evaluate(() => {
        const o = JSON.parse(localStorage.getItem('dcr_run_v2')); o.ver = 2;
        for (const k of ['mod', 'variant', 'opts', 'water', 'cracks', 'crackT', 'wade', 'stats', 'hard', 'daily', 'rs']) delete o[k];
        localStorage.setItem('dcr_run_v2', JSON.stringify(o));
      });
      await reload(page);
      await page.locator('#title button', { hasText: /Continue run/ }).click();
      const s = await page.evaluate(() => { const G = window.__dbg(); return { ver: G.ver, mod: G.mod, opts: G.opts, legacy: G.stats.legacy, turn: G.turn }; });
      assert.equal(s.ver, 3); assert.equal(s.mod, null); assert.equal(s.legacy, 1); assert.ok(s.turn >= 4);
      await page.evaluate(() => { const G = window.__dbg(); G.enemies.length = 0; const k = G.map.indexOf(2); G.p.x = k % 30; G.p.y = Math.floor(k / 30); window.__dbg.fn.computeVis(); });
      await page.locator('#b_down').tap();
      assert.match(await page.locator('#modalBox h2').textContent(), /pick a path/);
      await page.locator('#modalBox button').first().tap();
      assert.equal(await page.evaluate(() => window.__dbg().floor), 2);
      // history-based achievements are not granted for a run whose history is unknown
      await page.evaluate(() => { const G = window.__dbg(); G.floor = 8; G.won = true; window.__dbg.api.finish('win'); });
      assert.equal(await page.evaluate(() => !!window.__dbg.api.meta().ach.dry), false);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});
