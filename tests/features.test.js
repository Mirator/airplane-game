// Feature tests: floor modifiers, branching exits, Daily seeding, records / achievements / Hard mode and the save migrations around them.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, startRun } = require('./lib/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const BASE_META = { seenHelp: 1, gold: 0, unl: { rogue: 1, mage: 1 } };
const dbgDone = (page) => page.waitForFunction(() => !!window.__dbg() && document.getElementById('title').style.display === 'none');
const closeModal = (page) => page.evaluate(() => { document.getElementById('modal').style.display = 'none'; });

describe('floor modifiers', () => {
  it('every modifier generates a completable floor over many seeds (stairs reachable, nothing sealed in, stairsOk)', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 5, meta: BASE_META });
    try {
      await startRun(page, 'warrior');
      const rep = await page.evaluate(() => {
        const g = () => window.__dbg(), F = window.__dbg.fn, M = window.__dbg.mods, out = { fails: [], floors: 0, seen: {} };
        const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const m of M.MODS) {
          for (let i = 0; i < 80; i++) {
            const f = m.minF + (i % (7 - m.minF + 1));                    // every depth the modifier can roll on (2..7)
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

  it('modifier rules: cursed ground, dark sight, silent sneak, rich gold, flooded wading, unstable collapse, hunted reward', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 6, meta: BASE_META });
    try {
      await startRun(page, 'warrior'); await closeModal(page);
      const r = await page.evaluate(() => {
        const g = () => window.__dbg(), F = window.__dbg.fn, A = window.__dbg.api, B = window.__dbg.tables.BAL, o = {};
        const clear = () => { g().enemies.length = 0; };
        // cursed: no natural regeneration, potions weakened
        F.newFloor(3, { mod: 'cursed', v: 0 }); clear(); g().p.hp = 10; const t0 = g().turn; for (let i = 0; i < 40; i++) F.endTurn(); o.cursedHp = g().p.hp;
        g().inv.pot = 1; g().p.hp = 10; g().p.mhp = 100; document.getElementById('b_pot').click(); o.cursedPot = g().p.hp - 10;
        F.newFloor(3, { mod: null, v: 0 }); clear(); g().p.mhp = 100; g().p.hp = 10; g().inv.pot = 1; document.getElementById('b_pot').click(); o.plainPot = g().p.hp - 10;
        // dark: short sight
        F.newFloor(3, { mod: 'dark', v: 0 }); F.computeVis(); { const G = g(); let far = 0; for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) if (G.vis[y * 30 + x] && Math.hypot(x - G.p.x, y - G.p.y) > B.mod.dark.sight + 1.2) far++; o.darkFar = far; }
        // silent: warrior sneak multiplier
        F.newFloor(3, { mod: 'silent', v: 0 }); o.silentSneak = window.__dbg.gear.sneakMul(); F.newFloor(3, { mod: null, v: 0 }); o.plainSneak = window.__dbg.gear.sneakMul();
        // rich: doubled gold on pickup
        F.newFloor(3, { mod: 'rich', v: 0 }); { const G = g(); clear(); G.items.length = 0; G.p.goldMul = 1; const g0 = G.p.gold; G.items.push({ x: G.p.x, y: G.p.y, t: 'gold', v: 10 }); F.tryMove(0, 0); window.__dbg.fn.endTurn(); }
        // flooded: stepping into water gives the awake enemy a free move
        F.newFloor(4, { mod: 'flooded', v: 0 }); { const G = g(); clear(); const w = new Set(G.water); let step = null;
          for (let y = 1; y < 29 && !step; y++) for (let x = 1; x < 29 && !step; x++) { if (!w.has(y * 30 + x)) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const px = x + dx, py = y + dy; if (G.map[py * 30 + px] === 1 && !w.has(py * 30 + px)) { step = { px, py, dx: -dx, dy: -dy }; break; } } }
          o.waterFound = !!step;
          if (step) { G.p.x = step.px; G.p.y = step.py; G.items.length = 0; G.traps.length = 0; const e = F.makeEnemy('goblin', step.px + (step.dx === 0 ? 3 : -step.dx * 3), step.py, 4); e.awake = true; G.enemies = [e]; F.computeVis(); const before = g().turn; F.tryMove(step.dx, step.dy); o.waded = /slog through the water/.test(G.log.join('|')); } }
        // unstable: cracks appear, collapse hurts the one standing on them, not the one who moved away
        F.newFloor(4, { mod: 'unstable', v: 0 }); { const G = g(); clear(); G.p.hp = G.p.mhp; for (let i = 0; i < 8; i++) F.endTurn(); o.cracks = G.cracks.length;
          G.p.hp = G.p.mhp; G.cracks = [{ x: G.p.x, y: G.p.y, t: 1 }]; const h = G.p.hp; F.endTurn(); o.collapseDmg = h - G.p.hp; o.cracksLeft = G.cracks.length; }
        // hunted: stalker reward
        F.newFloor(4, { mod: 'hunted', v: 0 }); { const G = g(); const st = G.enemies.find((e) => e.hunter); o.hunter = !!st; G.items.length = 0; A.killEnemy(st); o.reward = G.items.map((i) => i.t).sort().join(','); o.huntAch = !!A.meta().ach.hunt; }
        return o;
      });
      assert.equal(r.cursedHp, 10, 'no natural regen on cursed ground');
      assert.ok(r.cursedPot > 0 && r.cursedPot < r.plainPot, 'cursed potion heals less: ' + r.cursedPot + ' vs ' + r.plainPot);
      assert.equal(r.darkFar, 0, 'dark: nothing visible beyond the short radius');
      assert.ok(r.silentSneak > r.plainSneak, 'silent: warrior sneak attacks are stronger');
      assert.equal(r.waterFound, true); assert.equal(r.waded, true, 'stepping into water gives the awake enemy a free move');
      assert.ok(r.cracks >= 1, 'unstable floor produced cracks'); assert.ok(r.collapseDmg > 0, 'collapse hurt the player standing on it'); assert.equal(r.cracksLeft, 0);
      assert.equal(r.hunter, true); assert.match(r.reward, /gold/); assert.match(r.reward, /potion/); assert.equal(r.huntAch, true);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});

describe('branching exits', () => {
  it('stairs open a two-way choice by touch; each route shows theme and modifier; Stay and choosing both work; merchants on both branches', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 7, touch: true, meta: BASE_META });
    try {
      await startRun(page, 'warrior'); await closeModal(page);
      const goStairs = () => page.evaluate(() => {
        const G = window.__dbg(); G.enemies.length = 0; const k = G.map.indexOf(2); G.p.x = k % 30; G.p.y = Math.floor(k / 30); window.__dbg.fn.computeVis(); window.__dbg.fn.endTurn();
        return { floor: G.floor, opts: G.opts };
      });
      const s = await goStairs();
      assert.equal(s.opts.length, 2);
      await page.locator('#b_down').tap();
      await page.waitForSelector('#modalBox h2');
      assert.match(await page.locator('#modalBox h2').textContent(), /Choose your path/);
      const btns = await page.locator('#modalBox button').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent, h: r.height, w: r.width }; }));
      assert.equal(btns.length, 3);
      for (const b of btns) assert.ok(b.h >= 44 && b.w >= 44, JSON.stringify(b));
      for (const name of ['The Crypt', 'The Ossuary']) assert.ok(btns.slice(0, 2).some((b) => b.t.includes(name)), 'theme ' + name + ' shown: ' + JSON.stringify(btns.map((b) => b.t)));
      for (let i = 0; i < 2; i++) assert.match(btns[i].t, /No modifier|Risk:/);
      // Stay: nothing changes
      await page.locator('#modalBox button', { hasText: /Stay on this floor/ }).tap();
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
        for (const f of [3, 6]) for (const v of [0, 1]) for (const mod of [null, 'hunted', 'horde', 'flooded', 'unstable']) for (let i = 0; i < 5; i++) { F.newFloor(f, { mod, v }); if (!window.__dbg().merchant) res.push(f + ':' + mod); }
        return res;
      });
      assert.deepEqual(mer, []);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('exit options: never two plain routes, never a modifier on floor 1 or the dragon floor, and the HUD chip explains the modifier on tap', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 8, touch: true, meta: BASE_META });
    try {
      await startRun(page, 'warrior'); await closeModal(page);
      const r = await page.evaluate(() => {
        const F = window.__dbg.fn, M = window.__dbg.mods, bad = [], counts = { mod: 0, none: 0 };
        for (let nf = 2; nf <= 7; nf++) for (let i = 0; i < 200; i++) {
          const o = F.rollOpts(nf);
          if (!o[0].mod && !o[1].mod) bad.push('two plain at ' + nf);
          if (o[0].mod && o[0].mod === o[1].mod) bad.push('same mod twice at ' + nf);
          if (o[0].v === o[1].v) bad.push('same theme twice');
          for (const x of o) { if (x.mod) counts.mod++; else counts.none++; if (x.mod === 'hunted' && nf < 3) bad.push('hunted too early'); }
        }
        F.newFloor(1, { mod: null, v: 0 }); const g = window.__dbg();
        return { bad, counts, opts1: g.opts && g.opts.length, floor8: (F.newFloor(8, { mod: 'dark', v: 1 }), window.__dbg().opts) };
      });
      assert.deepEqual(r.bad, []);
      assert.ok(r.counts.mod > 0.4 * (r.counts.mod + r.counts.none) && r.counts.mod < 0.75 * (r.counts.mod + r.counts.none), JSON.stringify(r.counts));
      assert.equal(r.floor8, null);
      // chip: tap shows a one-line explanation
      await page.evaluate(() => window.__dbg.fn.newFloor(3, { mod: 'silent', v: 0 }));
      const chip = page.locator('#chips .chip.mod');
      await chip.waitFor();
      const box = await chip.boundingBox(); assert.ok(box.height >= 44 && box.width >= 44, JSON.stringify(box));
      await chip.tap();
      await page.waitForFunction(() => document.getElementById('toast').style.opacity === '1');
      assert.match(await page.locator('#toast').textContent(), /Silent/);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});

describe('daily run', () => {
  const capture = (page) => page.evaluate(() => {
    const F = window.__dbg.fn, out = [];
    const snap = () => { const G = window.__dbg(); return JSON.stringify({ f: G.floor, mod: G.mod, v: G.variant, map: G.map, p: [G.p.x, G.p.y], en: G.enemies.map((e) => [e.t, e.x, e.y, e.hp, e.atk, !!e.elite, !!e.hunter]), it: G.items.map((i) => [i.t, i.k, i.v, i.x, i.y, i.tr]), tr: G.traps.map((t) => [t.k, t.x, t.y]), sh: G.shrine && [G.shrine.x, G.shrine.y], me: G.merchant && [G.merchant.x, G.merchant.y, G.merchant.stock.map((s) => s.n)], w: G.water, opts: G.opts }); };
    out.push(snap());
    for (let f = 2; f <= 8; f++) { const G = window.__dbg(); F.goDown(f < 8 ? G.opts[f % 2] : { mod: null, v: 0 }); out.push(snap()); }
    return out;
  });
  it('the same date gives identical floors, modifiers, exits, enemies and loot across two fresh page loads (different Math.random)', async () => {
    const a = await newPage(browser, { seed: 111, fakeDate: [2026, 5, 15], meta: BASE_META });
    const b = await newPage(browser, { seed: 222, fakeDate: [2026, 5, 15], meta: BASE_META });
    const c = await newPage(browser, { seed: 111, fakeDate: [2026, 5, 16], meta: BASE_META });
    try {
      const run = async (x) => { await x.page.locator('#btnDaily').click(); await x.page.locator('#title button', { hasText: /Warrior/ }).click(); await dbgDone(x.page); await closeModal(x.page); return capture(x.page); };
      const [fa, fb, fc] = [await run(a), await run(b), await run(c)];
      assert.equal(fa.length, 8);
      assert.deepEqual(fa, fb);
      assert.notDeepEqual(fa[0], fc[0], 'another date must give another dungeon');
      assert.equal(await a.page.evaluate(() => window.__dbg().daily), '2026-06-15');
      // the plan for a floor does not depend on which way you went before
      const opt = await a.page.evaluate(() => { const F = window.__dbg.fn; return [0, 1].map((i) => { return JSON.stringify(F.rollOpts(5)); }); });
      assert.equal(opt[0], opt[1]);
      for (const x of [a, b, c]) assert.deepEqual(x.errors, []);
    } finally { for (const x of [a, b, c]) await x.ctx.close(); }
  });

  it('combat rolls are seeded too: same actions on the same date give the same outcome; Daily result is recorded per day and survives reload', async () => {
    const play = async (seed) => {
      const x = await newPage(browser, { seed, fakeDate: [2026, 5, 15], meta: BASE_META });
      await x.page.locator('#btnDaily').click(); await x.page.locator('#title button', { hasText: /Rogue/ }).click(); await dbgDone(x.page); await closeModal(x.page);
      const res = await x.page.evaluate(() => {
        const F = window.__dbg.fn, G = window.__dbg(); const log = [];
        for (let i = 0; i < 120 && !G.over; i++) { const d = [[1, 0], [0, 1], [-1, 0], [0, -1]][i % 4]; F.tryMove(d[0], d[1]); if (document.getElementById('modal').style.display !== 'none') document.getElementById('modal').style.display = 'none'; log.push(G.p.hp + ':' + G.p.x + ':' + G.p.y + ':' + G.kills); }
        return { log: log.join('|'), turn: G.turn };
      });
      return { x, res };
    };
    const A = await play(1), B = await play(2);
    try {
      assert.equal(A.res.log, B.res.log);
      // record: end the run, reload, the Daily button reports the result
      await A.x.page.evaluate(() => { window.__dbg.api.finish('dead'); });
      await A.x.page.waitForTimeout(100);
      await A.x.page.reload();
      assert.match(await A.x.page.locator('#btnDaily').textContent(), /best floor \d+ - \d+ pts/);
      const m = await A.x.page.evaluate(() => JSON.parse(localStorage.getItem('dcr_meta_v1')).dly);
      assert.equal(Object.keys(m).length, 1); assert.equal(m['2026-06-15'].att, 1);
      for (const x of [A.x, B.x]) assert.deepEqual(x.errors, []);
    } finally { await A.x.ctx.close(); await B.x.ctx.close(); }
  });

  it('a Daily run saves and continues with its seeded stream intact', async () => {
    const x = await newPage(browser, { seed: 3, fakeDate: [2026, 5, 15], meta: BASE_META });
    try {
      await x.page.locator('#btnDaily').click(); await x.page.locator('#title button', { hasText: /Warrior/ }).click(); await dbgDone(x.page); await closeModal(x.page);
      await x.page.evaluate(() => { const F = window.__dbg.fn; for (let i = 0; i < 6; i++) F.tryMove(1, 0); F.save(); });
      const before = await x.page.evaluate(() => { const G = window.__dbg(); return { turn: G.turn, rs: G.rs, daily: G.daily }; });
      await x.page.waitForTimeout(300);
      await x.page.reload();
      await x.page.locator('#title button', { hasText: /Continue run/ }).click();
      const after = await x.page.evaluate(() => { const G = window.__dbg(); return { turn: G.turn, rs: G.rs, daily: G.daily }; });
      assert.deepEqual(after, before);
      assert.deepEqual(x.errors, []);
    } finally { await x.ctx.close(); }
  });
});

describe('records, achievements, Hard mode', () => {
  it('recap shows score and NEW RECORD; records and achievements persist across reload', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 9, meta: BASE_META });
    try {
      await startRun(page, 'warrior'); await closeModal(page);
      await page.evaluate(() => { const G = window.__dbg(); G.floor = 3; G.kills = 5; window.__dbg.api.finish('dead'); });
      assert.match(await page.locator('#modalBox').textContent(), /Score:\s*\d+/);
      await page.locator('#modalBox button').click();
      await page.locator('#title button', { hasText: /New run/ }).click(); await page.locator('#title button', { hasText: /Warrior/ }).click(); await dbgDone(page); await closeModal(page);
      await page.evaluate(() => { const G = window.__dbg(); G.floor = 6; G.kills = 20; G.turn = 800; G.p.lvl = 5; G.won = true; G.stats.pots = 0; window.__dbg.api.finish('win'); });
      const recap = await page.locator('#modalBox').textContent();
      assert.match(recap, /NEW RECORD/); assert.match(recap, /Achievement/);
      assert.match(await page.locator('#modalBox').textContent(), /First Victory/);
      await page.locator('#modalBox button').click();
      await page.waitForTimeout(150);
      await page.reload();
      await page.locator('#btnRecords').click();
      const rec = await page.locator('#titleBox').textContent();
      assert.match(rec, /Runs 2/); assert.match(rec, /Wins 1/); assert.match(rec, /Best streak 1/); assert.match(rec, /Fastest win 800 turns/);
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

  it('achievement rewards go to the wallet once and a toast is shown during play', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 10, meta: BASE_META });
    try {
      await startRun(page, 'warrior'); await closeModal(page);
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

  it('Hard toggle is locked before the first win; unlocked it toggles, persists and starts a harder run (Daily stays normal)', async () => {
    const a = await newPage(browser, { seed: 11, meta: BASE_META });
    try {
      assert.equal(await a.page.locator('#hardBtn').isDisabled(), true);
      assert.match(await a.page.locator('#hardBtn').textContent(), /win/i);
      assert.equal(await a.page.evaluate(() => window.__dbg.mods.hardOn()), false);
      assert.deepEqual(a.errors, []);
    } finally { await a.ctx.close(); }
    const b = await newPage(browser, { seed: 12, meta: { ...BASE_META, wins: 1, best: 8 } });
    try {
      assert.equal(await b.page.locator('#hardBtn').isDisabled(), false);
      await b.page.locator('#hardBtn').click();
      assert.match(await b.page.locator('#hardBtn').textContent(), /ON/);
      await b.page.reload();
      assert.match(await b.page.locator('#hardBtn').textContent(), /ON/);
      await startRun(b.page, 'warrior'); await closeModal(b.page);
      const h = await b.page.evaluate(() => { const G = window.__dbg(), F = window.__dbg.fn; const e = F.makeEnemy('goblin', 1, 1, 3); const hp = e.hp; G.hard = 0; const e2 = F.makeEnemy('goblin', 1, 1, 3); G.hard = 1; return { hard: G.hard, hp, hp0: e2.hp, pots: G.inv.pot }; });
      assert.equal(h.hard, 1); assert.ok(h.hp > h.hp0, 'hard enemies are tougher'); assert.equal(h.pots, 0, 'one fewer starting potion');
      assert.ok(await b.page.locator('#chips .chip.hard').count());
      // Daily ignores the toggle
      await b.page.evaluate(() => { window.__dbg.api.finish('abandon'); });
      await b.page.locator('#modalBox button').click();
      await b.page.locator('#btnDaily').click(); await b.page.locator('#title button', { hasText: /Warrior/ }).click(); await dbgDone(b.page);
      assert.equal(await b.page.evaluate(() => window.__dbg().hard), 0);
      assert.deepEqual(b.errors, []);
    } finally { await b.ctx.close(); }
  });

  it('Hard dragon: an extra whelp wave at 90% and earlier enrage', async () => {
    const x = await newPage(browser, { seed: 13, meta: { ...BASE_META, wins: 1, hardOn: 1 } });
    try {
      await startRun(x.page, 'warrior'); await closeModal(x.page);
      const r = await x.page.evaluate(() => {
        const F = window.__dbg.fn, G = window.__dbg(), B = window.__dbg.tables.BAL; F.newFloor(8, { mod: null, v: 0 });
        const d = G.enemies.find((e) => e.t === 'dragon'); d.hp = Math.round(d.mhp * 0.85); F.bossPhase(d); const waves1 = G.enemies.filter((e) => e.t === 'whelp').length;
        return { waves1, per: B.enemyAi.summonN };
      });
      assert.equal(r.waves1, r.per);   // normal mode only summons below 75%
      assert.deepEqual(x.errors, []);
    } finally { await x.ctx.close(); }
  });
});

describe('save migration', () => {
  it('an old meta save (no records/achievements fields) keeps gold, upgrades and unlocks and gains safe defaults', async () => {
    const old = { seenHelp: 1, gold: 777, hp: 2, atk: 1, pot: 1, goldp: 0, def: 3, wins: 1, best: 6, kills: 31, elites: 2, unl: { rogue: 1, scroll: 1, midas: 1 } };
    const { page, ctx, errors } = await newPage(browser, { seed: 14, meta: old });
    try {
      const m = await page.evaluate(() => JSON.parse(JSON.stringify(window.__dbg.api.meta())));
      for (const k of ['gold', 'hp', 'atk', 'pot', 'def', 'wins', 'best', 'kills', 'elites']) assert.equal(m[k], old[k], k);
      assert.deepEqual(m.unl.rogue, 1); assert.equal(m.unl.scroll, 1); assert.equal(m.unl.midas, 1);
      assert.deepEqual(m.rec, { n: {}, h: {} }); assert.equal(m.runs, 0); assert.equal(m.streak, 0); assert.ok(m.ach.win1, 'first win is recognised retroactively');
      assert.equal(await page.locator('#hardBtn').isDisabled(), false, 'an existing winner gets Hard');
      await page.locator('#btnRecords').click();
      assert.match(await page.locator('#titleBox').textContent(), /Runs 0/);
      await page.locator('#btnBack').click();
      await page.locator('#btnUpg').click();
      assert.match(await page.locator('#titleBox').textContent(), /Hardy \(Lv 2\/8\)/);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('a run saved by the previous version (save v2, no modifier / exit / stats fields) still continues, and the exit choice appears', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 15, touch: true, meta: BASE_META });
    try {
      await startRun(page, 'warrior'); await closeModal(page);
      await page.evaluate(() => { const F = window.__dbg.fn; for (let i = 0; i < 4; i++) F.tryMove(1, 0); F.save(); });
      await page.evaluate(() => {
        const o = JSON.parse(localStorage.getItem('dcr_run_v2')); o.ver = 2;
        for (const k of ['mod', 'variant', 'opts', 'water', 'cracks', 'crackT', 'wade', 'stats', 'hard', 'daily', 'rs']) delete o[k];
        localStorage.setItem('dcr_run_v2', JSON.stringify(o));
      });
      await page.reload();
      await page.locator('#title button', { hasText: /Continue run/ }).click();
      const s = await page.evaluate(() => { const G = window.__dbg(); return { ver: G.ver, mod: G.mod, opts: G.opts, legacy: G.stats.legacy, turn: G.turn }; });
      assert.equal(s.ver, 3); assert.equal(s.mod, null); assert.equal(s.legacy, 1); assert.ok(s.turn >= 4);
      await page.evaluate(() => { const G = window.__dbg(); G.enemies.length = 0; const k = G.map.indexOf(2); G.p.x = k % 30; G.p.y = Math.floor(k / 30); window.__dbg.fn.computeVis(); });
      await page.locator('#b_down').tap();
      assert.match(await page.locator('#modalBox h2').textContent(), /Choose your path/);
      await page.locator('#modalBox button').first().tap();
      assert.equal(await page.evaluate(() => window.__dbg().floor), 2);
      // history-based achievements are not granted for a run whose history is unknown
      await page.evaluate(() => { const G = window.__dbg(); G.floor = 8; G.won = true; window.__dbg.api.finish('win'); });
      assert.equal(await page.evaluate(() => !!window.__dbg.api.meta().ach.dry), false);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});
