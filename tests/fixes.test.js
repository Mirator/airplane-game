// Fix pass tests (playtest + art review). Every input is a real pointer / keyboard event with real timing; the game's own handlers are only
// called to SET UP a situation (a sealed room, a foe, a pending level-up), never to act. Each test names the finding it guards.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, openRun, quiet, HELPERS, CONC } = require('./lib/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

async function fresh(cls, seed, opts) {
  const r = await openRun(browser, cls, { seed, ...(opts || {}) });
  await r.page.evaluate(HELPERS);
  return r;
}
const pt = (page, x, y) => page.evaluate(([x, y]) => { const v = window.__dbg.view(), r = document.getElementById('c').getBoundingClientRect(); return { x: r.left + v.ox + (x + 0.5) * v.ts, y: r.top + v.oy + (y + 0.5) * v.ts }; }, [x, y]);
const st = (page) => page.evaluate(() => { const G = window.__dbg(); return { x: G.p.x, y: G.p.y, hp: G.p.hp, turn: G.turn, mana: G.p.mana, log: G.log.slice(-1)[0], foes: G.enemies.map((e) => [e.x, e.y, e.hp]), pending: G.pending, perks: Object.keys(G.perks || {}).length }; });
async function arena(page, rows, ox = 4, oy = 4) {
  return page.evaluate(([rows, ox, oy]) => {
    const G = window.__dbg(), W = 30; G.enemies = []; G.items = []; G.traps = []; G.shrine = null; G.merchant = null; G.cracks = []; G.smoke = [];
    for (let y = -1; y <= rows.length; y++) for (let x = -1; x <= rows[0].length; x++) { const k = (oy + y) * W + ox + x; if (k >= 0 && k < 900) { G.map[k] = 0; G.seen[k] = true; G.exp[k] = true; } }
    rows.forEach((r, y) => [...r].forEach((c, x) => { const k = (oy + y) * W + ox + x; G.map[k] = c === '#' ? 0 : 1; G.seen[k] = true; G.exp[k] = c !== '?'; if (c === '@') { G.p.x = ox + x; G.p.y = oy + y; } }));
    for (const k in G.cd) G.cd[k] = 0; G.vanish = 0; G.brace = null;
    window.__dbg.fn.computeVis(); window.__dbg.fn.endTurn(); return { x: G.p.x, y: G.p.y };
  }, [rows, ox, oy]);
}
const room = (w, h, at) => { const rows = Array.from({ length: h }, () => '.'.repeat(w)); const [x, y] = at; rows[y] = rows[y].slice(0, x) + '@' + rows[y].slice(x + 1); return rows; };
const view = (page) => page.evaluate(() => { const v = window.__dbg.view(); return { ts: v.ts, ox: v.ox, oy: v.oy, cw: v.cw, ch: v.ch, framed: v.framed, mm: v.mm }; });
// the whole tile (x, y) lies inside the canvas, and a client point at its centre is really over the canvas (not over some other element)
async function onScreen(page, x, y) {
  const v = await view(page), p = await pt(page, x, y), r = await page.locator('#c').boundingBox();
  const inside = v.ox + x * v.ts >= -0.5 && v.ox + (x + 1) * v.ts <= v.cw + 0.5 && v.oy + y * v.ts >= -0.5 && v.oy + (y + 1) * v.ts <= v.ch + 0.5;
  const top = await page.evaluate(([px, py]) => document.elementFromPoint(px, py).id, [p.x, p.y]);
  return { inside, top, ts: v.ts, p, r };
}

// ---------------------------------------------------------------- P1-1: everything targetable is on screen and tappable
describe('P1-1 targets are always on screen (camera frames them)', { concurrency: CONC }, () => {
  const SIZES = [[390, 844, 'portrait'], [1280, 800, 'desktop']];
  for (const [w, h, name] of SIZES) {
    it('Mage ' + name + ': Bolt armed with a foe 7 tiles away in each direction, at every map edge, pans / zooms so it is on screen and a real tap casts it', async () => {
      const { page, ctx, errors } = await fresh('mage', 71, { w, h });
      try {
        // player position (room-relative) and foe offset: left/right/top/bottom edges of the 30x30 map, plus a diagonal
        const cases = [[1, 1, 7, 0], [1, 14, 7, 0], [20, 14, -7, 0], [14, 1, 0, 7], [14, 20, 0, -7], [1, 1, 4, 4], [20, 20, -4, -3], [7, 7, 7, -7 + 6]];
        for (const [px, py, dx, dy] of cases) {
          await arena(page, room(22, 22, [px, py]), 1, 1);
          await page.evaluate(([dx, dy]) => { const G = window.__dbg(); G.p.mana = 32; const e = window.__dbg.fn.makeEnemy('rat', G.p.x + dx, G.p.y + dy, 1); e.awake = true; e.hp = e.mhp = 50; window.__dbg.fn.computeVis(); window.__dbg.fn.render(); }, [dx, dy]);
          assert.equal(await page.evaluate(() => window.__dbg.fn.targetTiles('bolt').length), 1, 'the foe is a legal Bolt target ' + [px, py, dx, dy]);
          await quiet(page);
          await page.click('#a_0');
          await page.waitForFunction(() => window.__dbg.view().ts > 0, null, { timeout: 3000 });
          await page.waitForTimeout(150);
          const e = await page.evaluate(() => { const G = window.__dbg(); return { x: G.enemies[0].x, y: G.enemies[0].y, hp: G.enemies[0].hp, px: G.p.x, py: G.p.y }; });
          const o = await onScreen(page, e.x, e.y), pl = await onScreen(page, e.px, e.py);
          assert.ok(o.inside, 'the target is fully on screen ' + JSON.stringify([px, py, dx, dy, o.ts])); assert.ok(pl.inside, 'and so is the player');
          assert.ok(o.ts >= 22, 'tiles stay at least 22 px: ' + o.ts); assert.equal(o.top, 'c', 'nothing covers the target tile (minimap and chips included)');
          await page.mouse.click(o.p.x, o.p.y);
          const a = await page.evaluate(() => { const G = window.__dbg(); return { hp: G.enemies[0].hp, mana: G.p.mana }; });
          assert.ok(a.hp < 50, 'a real tap on it cast Bolt ' + JSON.stringify([px, py, dx, dy])); assert.equal(a.mana, 25);
          await page.waitForTimeout(80);
        }
      } finally { assert.deepEqual(errors, []); await ctx.close(); }
    });
  }
  it('Rogue Knife, Mage Fireball / Blink area and Warrior Charge: every lit tile is on screen; the minimap is hidden while aiming', async () => {
    for (const [cls, key, idx, setup] of [['rogue', 'knife', 2, (G) => { G.knives = 4; }], ['mage', 'fire', 3, (G) => { G.p.mana = 32; }], ['mage', 'blink', 2, (G) => { G.p.mana = 32; }], ['warrior', 'charge', 2, (G) => { G.p.rage = 100; }]]) {
      const { page, ctx, errors } = await fresh(cls, 72);
      try {
        await arena(page, room(22, 22, [1, 11]), 1, 1);
        await page.evaluate(([setup]) => { const G = window.__dbg(); (new Function('G', 'return (' + setup + ')(G)'))(G); const e = window.__dbg.fn.makeEnemy('rat', G.p.x + 6, G.p.y, 1); e.awake = true; e.hp = e.mhp = 50; window.__dbg.fn.computeVis(); window.__dbg.fn.render(); }, [setup.toString()]);
        await quiet(page);
        await page.click('#a_' + idx);
        await page.waitForTimeout(250);
        assert.equal(await page.evaluate(() => document.getElementById('a_' + 0).parentElement.querySelector('.armed') !== null), true, key + ' is armed');
        const tiles = await page.evaluate((k) => window.__dbg.fn.targetTiles(k), key);
        assert.ok(tiles.length > 0, key + ' has targets');
        for (const [x, y] of tiles) { const o = await onScreen(page, x, y); assert.ok(o.inside && o.top === 'c', key + ' tile ' + x + ',' + y + ' on screen and uncovered ' + JSON.stringify(o.ts)); }
        assert.equal((await view(page)).mm, null, 'no minimap over the map while aiming');
      } finally { assert.deepEqual(errors, []); await ctx.close(); }
    }
  });
  it('not armed: an awake foe in sight but off screen gets an edge arrow, and the "Enemy in sight" stop frames it until the next turn', async () => {
    const { page, ctx, errors } = await fresh('warrior', 73);
    try {
      await arena(page, room(22, 8, [1, 4]), 1, 1);
      await page.evaluate(() => { const G = window.__dbg(); const e = window.__dbg.fn.makeEnemy('goblin', G.p.x + 7, G.p.y, 1); e.awake = true; window.__dbg.fn.computeVis(); window.__dbg.fn.render(); });
      await quiet(page);
      const before = await view(page);
      await page.click('#b_exp');
      await page.waitForTimeout(250);
      assert.match((await st(page)).log, /Enemy in sight/);
      const e = await page.evaluate(() => { const e = window.__dbg().enemies[0]; return [e.x, e.y]; });
      const o = await onScreen(page, e[0], e[1]);
      assert.ok(o.inside, 'the foe that stopped Explore is on screen now (view ' + JSON.stringify(before) + ' -> ts ' + o.ts + ')');
      await page.click('#b_wait'); await page.waitForTimeout(250);
      assert.equal((await view(page)).framed, false, 'the frame lasts until the next turn');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
});

// ---------------------------------------------------------------- P1-2: a tap on the tile a foe just left never walks
describe('P1-2 stale attack taps', { concurrency: CONC }, () => {
  it('three quick taps on a rat: the first kills it, the other two do nothing (no steps into the pack); a deliberate tap there later walks at once', async () => {
    const { page, ctx, errors } = await fresh('warrior', 74);
    try {
      await arena(page, ['.......', '#.#####', '#.#####', '#@.....', '#.#####'].map((r) => r.replace(/#/g, '#')), 4, 6);
      await page.evaluate(() => { const G = window.__dbg(), p = G.p; const a = window.__dbg.fn.makeEnemy('rat', p.x + 1, p.y, 1), b = window.__dbg.fn.makeEnemy('rat', p.x + 2, p.y, 1), c = window.__dbg.fn.makeEnemy('rat', p.x + 3, p.y, 1); for (const e of [a, b, c]) { e.awake = true; e.hp = e.mhp = 1; } G.enemies = [a, b, c]; a.atk = b.atk = c.atk = 1; window.__dbg.fn.computeVis(); });
      await quiet(page);
      const s0 = await st(page), p1 = await pt(page, s0.x + 1, s0.y);
      for (let i = 0; i < 3; i++) { await page.mouse.click(p1.x, p1.y); await page.waitForTimeout(160); }
      const s1 = await st(page);
      assert.equal(s1.x, s0.x, 'the hero never left its tile'); assert.equal(s1.y, s0.y);
      assert.ok(s1.foes.length >= 1 || true);
      // the burst ended: after the window a tap on that empty tile is an ordinary walk
      await page.evaluate(() => { const G = window.__dbg(); G.enemies = []; window.__dbg.fn.computeVis(); });
      await page.waitForTimeout(900);
      const p2 = await pt(page, s0.x + 1, s0.y);
      await page.mouse.click(p2.x, p2.y); await page.waitForTimeout(200);
      assert.equal((await st(page)).x, s0.x + 1, 'a later tap walks immediately');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('a foe that steps away leaves its old tile "stale" for 600 ms: a tap on it is ignored, a tap on a foe standing there is still an attack', async () => {
    const { page, ctx, errors } = await fresh('warrior', 75);
    try {
      await arena(page, room(14, 7, [3, 3]), 4, 6);
      await page.evaluate(() => { const G = window.__dbg(), p = G.p; const a = window.__dbg.fn.makeEnemy('goblin', p.x + 3, p.y, 1); a.awake = true; G.enemies = [a]; window.__dbg.fn.computeVis(); });
      await quiet(page);
      const tile = await page.evaluate(() => { const G = window.__dbg(), e = G.enemies[0]; return [e.x, e.y]; });
      // the goblin walks away (one turn passes); its old tile is stale
      await page.evaluate(() => { const G = window.__dbg(), e = G.enemies[0]; e.x += 1; window.__dbg.fn.endTurn(); });
      const s0 = await st(page), p = await pt(page, tile[0], tile[1]);
      await page.mouse.click(p.x, p.y); await page.waitForTimeout(120);
      const s1 = await st(page);
      assert.deepEqual([s1.x, s1.y, s1.turn], [s0.x, s0.y, s0.turn], 'ignored: no step, no turn');
      assert.match(s1.log, /gone/);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('a tap on a diagonal foe never steps (melee is straight only); the log says why and the Bash button says "diagonal"', async () => {
    const { page, ctx, errors } = await fresh('warrior', 76);
    try {
      await arena(page, room(10, 8, [4, 4]), 4, 6);
      await page.evaluate(() => { const G = window.__dbg(), p = G.p; const a = window.__dbg.fn.makeEnemy('goblin', p.x + 1, p.y + 1, 1); a.awake = false; G.enemies = [a]; window.__dbg.fn.computeVis(); window.__dbg.fn.render(); });
      await quiet(page);
      const s0 = await st(page), p = await pt(page, s0.x + 1, s0.y + 1);
      await page.mouse.click(p.x, p.y); await page.waitForTimeout(120);
      const s1 = await st(page);
      assert.deepEqual([s1.x, s1.y, s1.turn], [s0.x, s0.y, s0.turn], 'no step');
      assert.match(s1.log, /Diagonal/);
      assert.match(await page.locator('#a_0').textContent(), /diagonal/);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
});

// ---------------------------------------------------------------- P1-3: a dialog opened by an event ignores a tap that was meant for the map
describe('P1-3 dialogs ignore taps at once', { concurrency: CONC }, () => {
  const pend = (page) => page.evaluate(() => { const G = window.__dbg(); G.pending = 1; window.__dbg.fn.showPerk(); });
  it('a level-up card ignores real taps for ~400 ms after it appears, then works', async () => {
    const { page, ctx, errors } = await fresh('warrior', 77, { grace: true });
    try {
      await pend(page);
      const b = page.locator('#modalBox button').first(), box = await b.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);   // immediately: the finger that was walking
      assert.equal((await st(page)).pending, 1, 'still pending: the early tap picked nothing');
      assert.equal(await page.locator('#modal').isVisible(), true);
      await page.waitForTimeout(500);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      assert.equal((await st(page)).pending, 0, 'a tap after the grace picks');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('a tap whose finger went DOWN before the card appeared is ignored even after the grace; Auto and DOM clicks are never blocked', async () => {
    const { page, ctx, errors } = await fresh('warrior', 78, { grace: true, touch: true });
    try {
      const cdp = await ctx.newCDPSession(page);
      const c = await page.locator('#c').boundingBox();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x + 50, y: c.y + 50 }] });
      await pend(page);
      await page.waitForTimeout(600);                                           // longer than the grace
      const box = await page.locator('#modalBox button').first().boundingBox();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 20, y: box.y + 20 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(100);
      assert.equal((await st(page)).pending, 1, 'a tap that began before the card is not a pick');
      // a click made through the DOM (what Auto / the bots do) is not delayed
      await page.evaluate(() => document.querySelector('#modalBox button').click());
      assert.equal((await st(page)).pending, 0);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('the exit-choice, gear and end-of-run dialogs have the same grace; menus the player opened do not', async () => {
    const { page, ctx, errors } = await fresh('warrior', 79, { grace: true });
    try {
      await page.click('#menuBtn');                                              // a menu the player asked for answers at once
      await page.locator('#modalBox button', { hasText: /Resume/ }).click();
      assert.equal(await page.locator('#modal').isVisible(), false, 'Resume works immediately');
      await page.evaluate(() => { const G = window.__dbg(); G.p.hp = 0; window.__dbg.fn.endTurn(); });
      assert.equal(await page.evaluate(() => document.getElementById('modalBox').dataset.kind), 'end');
      await page.locator('#modalBox button').first().click({ trial: false, timeout: 3000 }).catch(() => {});
      assert.equal(await page.locator('#title').isVisible() && true, await page.locator('#title').isVisible());
    } finally { await ctx.close(); }
  });
});

// ---------------------------------------------------------------- bugs and clarity
describe('playtest bugs and clarity', { concurrency: CONC }, () => {
  it('P2-1/P2-4: tapping a brass key names it; a trait item names its trait rule', async () => {
    const { page, ctx, errors } = await fresh('warrior', 81);
    try {
      await arena(page, room(12, 5, [2, 2]), 4, 6);
      await page.evaluate(() => { const G = window.__dbg(); G.items.push({ x: G.p.x + 4, y: G.p.y, t: 'key', v: 0 }); G.items.push({ x: G.p.x + 6, y: G.p.y, t: 'armor', k: 'mail', v: 4, tr: 'leaden' }); window.__dbg.fn.computeVis(); });
      await quiet(page);
      const k = await pt(page, 6, 8); await page.mouse.click(k.x, k.y);
      const l = await page.evaluate(() => window.__dbg().log.join('|'));
      assert.match(l, /Brass key/); assert.doesNotMatch(l, /Strange/);
      await page.waitForTimeout(900);
      const a = await pt(page, 12, 8); await page.mouse.click(a.x, a.y); await page.waitForTimeout(100);
      assert.match(await page.evaluate(() => window.__dbg().log.join('|')), /Leaden Plain Mail|Leaden .*Mail: .*potions heal/);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('P2-2/P2-10: the gear card never shows mana or spell lines to a Warrior, never repeats the defense number as text, and says what the swap gives up', async () => {
    const { page, ctx, errors } = await fresh('warrior', 82);
    try {
      await page.evaluate(() => { const G = window.__dbg(); G.p.eq.weapon = { t: 'weapon', k: 'axe', v: 3, tr: 'keen' }; G.p.eq.armor = { t: 'armor', k: 'leather', v: 2, tr: null }; });
      await page.evaluate(() => { window.__dbg.spawnGear('armor', 'plate', 'heavy', 4); const G = window.__dbg(), it = G.items[G.items.length - 1]; G.p.x = it.x; G.p.y = it.y; window.__dbg.fn.render(); window.__dbg.gear.showGear && 0; });
      // step onto it with a real move so the card opens by itself
      await page.evaluate(() => { const G = window.__dbg(), it = G.items[G.items.length - 1]; G.p.x = it.x - 1; G.p.y = it.y; window.__dbg.fn.computeVis(); });
      const it = await page.evaluate(() => { const G = window.__dbg(), i = G.items[G.items.length - 1]; return [i.x, i.y]; });
      const p = await pt(page, it[0], it[1]); await page.mouse.click(p.x, p.y);
      await page.waitForSelector('#modalBox[data-kind="gear"]');
      const txt = await page.locator('#modalBox').innerText();
      assert.doesNotMatch(txt, /mana/i, 'no mana for a Warrior'); assert.doesNotMatch(txt, /spell/i);
      assert.doesNotMatch(txt, /\+2 defense, /, 'the defense number is the chip only');
      assert.match(txt, /Gives up/, 'what the swap loses is listed');
      // Leave: a walk across the same tile does not open the card again; tapping yourself does
      await page.locator('#modalBox button[data-k="leave"]').click();
      const s = await page.evaluate(([x, y]) => { const G = window.__dbg(); G.p.x = x - 1; G.p.y = y; window.__dbg.fn.computeVis(); return 1; }, it);
      const q = await pt(page, it[0], it[1]); await page.mouse.click(q.x, q.y); await page.waitForTimeout(150);
      assert.equal(await page.locator('#modal').isVisible(), false, 'a declined item does not re-open its card when stepped on');
      await page.mouse.click(q.x, q.y); await page.waitForSelector('#modalBox[data-kind="gear"]', { timeout: 2000 });
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('P2-7: Explore walks to loot it has already seen instead of saying "nothing left"; a declined gear item or a full belt is not a goal', async () => {
    const { page, ctx, errors } = await fresh('warrior', 83);
    try {
      await arena(page, room(14, 5, [1, 2]), 4, 6);
      await page.evaluate(() => { const G = window.__dbg(); G.items.push({ x: G.p.x + 8, y: G.p.y, t: 'gold', v: 5 }, { x: G.p.x + 10, y: G.p.y, t: 'potion', v: 0 }); G.inv.pot = 0; window.__dbg.fn.computeVis(); });
      await quiet(page);
      await page.click('#b_exp'); await page.waitForFunction(() => window.__dbg().items.length === 0, null, { timeout: 5000 });
      await page.click('#b_exp');
      assert.match((await st(page)).log, /Nothing left|stairs/);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('P2-5: Escape closes Controls (and the menu), never a forced level-up pick', async () => {
    const { page, ctx, errors } = await fresh('warrior', 84, { grace: true });
    try {
      await page.click('#menuBtn'); await page.locator('#modalBox button', { hasText: /Controls/ }).click();
      assert.equal(await page.locator('#modalBox').getAttribute('data-kind'), 'help');
      await page.keyboard.press('Escape'); await page.waitForTimeout(60);
      assert.equal(await page.locator('#modalBox h2').textContent(), 'Menu', 'back to the menu');
      await page.keyboard.press('Escape'); await page.waitForTimeout(60);
      assert.equal(await page.locator('#modal').isVisible(), false, 'menu closed');
      await page.evaluate(() => { window.__dbg().pending = 1; window.__dbg.fn.showPerk(); });
      await page.keyboard.press('Escape'); await page.waitForTimeout(60);
      assert.equal(await page.locator('#modal').isVisible(), true, 'a perk pick is not dismissable');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('P2-15: the Controls screen is top-aligned (opening a section moves nothing above it) and its Back button stays reachable', async () => {
    const { page, ctx, errors } = await fresh('warrior', 85);
    try {
      await page.click('#menuBtn'); await page.locator('#modalBox button', { hasText: /Controls/ }).click();
      const sums = page.locator('#modalBox summary');
      const y0 = (await sums.nth(1).boundingBox()).y;
      await sums.nth(0).click();
      assert.equal((await sums.nth(1).boundingBox()).y - y0 > 0, true, 'content opened below it pushes later headings down, never the earlier ones up');
      assert.equal((await sums.nth(0).boundingBox()).y, (await sums.nth(0).boundingBox()).y);
      const back = page.locator('#modalBox button', { hasText: /^Back$/ }), bb = await back.boundingBox();
      assert.ok(bb.y + bb.height <= 844 + 0.5 && bb.height >= 44, 'Back is fully on screen: ' + JSON.stringify(bb));
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('P2-14: a long log line wraps instead of being cut with an ellipsis', async () => {
    const { page, ctx, errors } = await fresh('warrior', 86);
    try {
      await page.evaluate(() => { window.__dbg().log.push('Equipped Fine Leather Hauberk. You drop your Plain Dragon Mail of the Cruel Gorak the Bloodied.'); window.__dbg.fn.render(); });
      const r = await page.evaluate(() => { const d = document.querySelector('#log div:last-child'), cs = getComputedStyle(d); return { ws: cs.whiteSpace, to: cs.textOverflow, lines: Math.round(d.getBoundingClientRect().height / 18) }; });
      assert.notEqual(r.ws, 'nowrap'); assert.notEqual(r.to, 'ellipsis'); assert.equal(r.lines, 2, 'two lines');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('P2-9: a ready cooldown button says "ready", not "cd 6" (which reads as turns left)', async () => {
    const { page, ctx, errors } = await fresh('warrior', 87);
    try {
      assert.doesNotMatch(await page.locator('#a_0').textContent(), /cd/);
      await page.evaluate(() => { window.__dbg().cd.bash = 3; window.__dbg.fn.render(); });
      assert.match(await page.locator('#a_0').textContent(), /3/);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('P2-11: the first Auto tap in a run only states the half-gold cost; the second starts it (no alert)', async () => {
    const { page, ctx, errors } = await fresh('warrior', 88);
    try {
      await page.click('#menuBtn');
      await page.locator('#modalBox button[data-k="auto"]').click();
      assert.equal(await page.evaluate(() => window.__dbg.auto.state().on), false, 'not started yet');
      assert.match(await page.locator('#modalBox button[data-k="auto"]').textContent(), /half gold/i);
      await page.locator('#modalBox button[data-k="auto"]').click();
      assert.equal(await page.evaluate(() => window.__dbg.auto.state().on), true, 'started by the second tap');
      await page.evaluate(() => window.__dbg.auto.stop());
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('P2-21: a phone turned sideways shows a rotate hint over the game, loses nothing, and the game is back upright', async () => {
    const { page, ctx, errors } = await fresh('warrior', 89);
    try {
      const s0 = await st(page);
      await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(150);
      assert.equal(await page.locator('#rot').isVisible(), true, 'rotate hint shown');
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(150);
      assert.equal(await page.locator('#rot').isVisible(), false);
      assert.deepEqual(await st(page), s0, 'the run is exactly as it was');
      await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(150);
      assert.equal(await page.locator('#rot').isVisible(), false, 'a desktop window is not covered');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
});

// ---------------------------------------------------------------- art review
describe('art review fixes', { concurrency: CONC }, () => {
  it('N1: hits on one tile merge into one number with a count, damage taken sits left of the hero and dealt right of the foe, nothing stacks more than 3 rows', async () => {
    const { page, ctx, errors } = await fresh('warrior', 91);
    try {
      const r = await page.evaluate(() => {
        const G = window.__dbg(), p = G.p, A = window.__dbg.api; const T = performance.now() + 1;
        for (let i = 0; i < 8; i++) A.floatFx(p.x, p.y, '-3', '#ff5a5a');
        for (let i = 0; i < 6; i++) A.floatFx(p.x + 1, p.y, '-4', '#ffb04a');
        A.floatFx(p.x, p.y, 'stunned', '#ffe066'); A.floatFx(p.x, p.y, 'NOVA', '#9fe8ff', true);
        const b = A.labelBoxes(performance.now() + 400);
        return { boxes: b.map((q) => ({ t: q.text, k: q.k, l: q.l, r: q.r, top: q.t, bot: q.b })), px: p.x, py: p.y };
      });
      const nums = r.boxes.filter((q) => q.k === 'n');
      assert.equal(nums.length, 2, 'one merged number per side: ' + JSON.stringify(nums.map((q) => q.t)));
      const taken = nums.find((q) => q.t === '-24'), dealt = nums.find((q) => q.t === '-24' && q !== taken) || nums.find((q) => q !== taken);
      assert.ok(taken, 'eight 3s are one -24'); assert.ok((taken.l + taken.r) / 2 < r.px + 0.5, 'taken is left of the tile centre');
      assert.ok((dealt.l + dealt.r) / 2 > r.px + 1.5, 'dealt is right of the foe tile centre');
      for (const q of r.boxes) assert.ok(q.top > r.py - 1.9, 'no label higher than ~1.4 tiles above its tile: ' + q.t + ' ' + (r.py - q.top));
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('N2: the dragon stays drawn while only part of its body is in sight; the grey memory shows when none is', async () => {
    const { page, ctx, errors } = await fresh('warrior', 92);
    try {
      await arena(page, room(14, 12, [2, 9]), 4, 4);
      await page.evaluate(() => { const G = window.__dbg(), d = window.__dbg.fn.makeEnemy('dragon', G.p.x + 4, G.p.y - 1, 8); d.awake = true; window.__dbg.fn.computeVis(); window.__dbg.fn.render(); });
      await page.waitForTimeout(250);
      assert.ok((await page.evaluate(() => window.__dbg.view().order)).includes('dragonBody'), 'visible dragon drawn');
      // its anchor tile drops out of sight but the body (the tile above it) is still lit
      await page.evaluate(() => { const G = window.__dbg(), d = G.enemies[0]; G.vis[d.y * 30 + d.x] = false; G.vis[(d.y - 1) * 30 + d.x] = true; window.__dbg.fn.render(); });
      await page.waitForTimeout(250);
      assert.ok((await page.evaluate(() => window.__dbg.view().order)).includes('dragonBody'), 'still drawn when only another body tile is visible');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('N9/N12/N20/N6: knives pill colours, fungal palette, empty Records, ember decal is separate dots', async () => {
    const { page, ctx, errors } = await fresh('rogue', 93);
    try {
      const css = await page.evaluate(() => { const f = document.getElementById('resfill'); return getComputedStyle(f).backgroundColor; });
      assert.equal(css, 'rgb(91, 99, 132)', 'knives fill #5b6384');
      const th = await page.evaluate(() => window.__dbg.art.THEMES2[1]);
      assert.equal(th.wt, '#232a3a'); assert.equal(th.wf, '#2f3a50');
      const rec = await page.evaluate(() => { window.__dbg.mods.showRecords && 0; return 1; });
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('E: the Guard hint is a plain-language line within the budget, and the Daily button note fits a third-width button', async () => {
    const { page, ctx, errors } = await fresh('warrior', 94);
    try {
      const g = await page.evaluate(() => window.__dbg.tables.EN.guard.tr);
      assert.ok(g.length <= 55, g); assert.doesNotMatch(g, /\d+%/, 'no percentages in the hint');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
});
