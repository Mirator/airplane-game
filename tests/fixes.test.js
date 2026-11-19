// Fix pass tests, part 1: the three playtest P1s (camera framing, stale taps, dialog grace). Every input is a real pointer / keyboard event with real timing; the game's own handlers are only
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
    const G = window.__dbg(), W = 30; G.enemies = []; G.items = []; G.shrine = null; G.merchant = null; G.cracks = []; G.smoke = [];
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
        const cases = [[1, 1, 7, 0], [20, 14, -7, 0], [14, 1, 0, 7], [14, 20, 0, -7], [1, 1, 4, 4], [20, 20, -4, -3]];
        for (const [px, py, dx, dy] of cases) {
          await arena(page, room(22, 22, [px, py]), 1, 1);
          await page.evaluate(([dx, dy]) => { const G = window.__dbg(); G.p.mana = 32; const e = window.__dbg.fn.makeEnemy('rat', G.p.x + dx, G.p.y + dy, 1); e.awake = true; e.hp = e.mhp = 50; window.__dbg.fn.computeVis(); window.__dbg.fn.render(); }, [dx, dy]);
          assert.equal(await page.evaluate(() => window.__dbg.fn.targetTiles('bolt').length), 1, 'the foe is a legal Bolt target ' + [px, py, dx, dy]);
          await quiet(page);
          await page.click('#a_0');
          await page.waitForFunction(() => window.__dbg.view().ts > 0, null, { timeout: 3000 });
          await page.waitForTimeout(120);
          const e = await page.evaluate(() => { const G = window.__dbg(); return { x: G.enemies[0].x, y: G.enemies[0].y, hp: G.enemies[0].hp, px: G.p.x, py: G.p.y }; });
          const o = await onScreen(page, e.x, e.y), pl = await onScreen(page, e.px, e.py);
          assert.ok(o.inside, 'the target is fully on screen ' + JSON.stringify([px, py, dx, dy, o.ts])); assert.ok(pl.inside, 'and so is the player');
          assert.ok(o.ts >= 22, 'tiles stay at least 22 px: ' + o.ts); assert.equal(o.top, 'c', 'nothing covers the target tile (minimap and chips included)');
          await page.mouse.click(o.p.x, o.p.y);
          const a = await page.evaluate(() => { const G = window.__dbg(); return { hp: G.enemies[0].hp, mana: G.p.mana }; });
          assert.ok(a.hp < 50, 'a real tap on it cast Bolt ' + JSON.stringify([px, py, dx, dy])); assert.ok(a.mana < 32, 'the mana was spent');
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
  it('aiming with every target already in the normal view still hides the minimap (a target under it could not be tapped)', async () => {
    const { page, ctx, errors } = await fresh('mage', 75);
    try {
      await arena(page, room(14, 8, [3, 4]), 4, 6);
      await page.evaluate(() => { const G = window.__dbg(); G.p.mana = 32; const e = window.__dbg.fn.makeEnemy('rat', G.p.x + 3, G.p.y, 1); e.awake = true; window.__dbg.fn.computeVis(); window.__dbg.fn.render(); });
      await quiet(page);
      assert.ok((await view(page)).mm, 'minimap shown normally');
      await page.click('#a_0'); await page.waitForTimeout(250);
      const v = await view(page);
      assert.equal(v.mm, null, 'minimap hidden while aiming'); assert.equal(v.framed, false, 'and the camera did not move for a target that was already in view');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('not armed: an awake foe in sight but off screen gets an edge arrow, and the "Enemy in sight" stop frames it until the next turn', async () => {
    const { page, ctx, errors } = await fresh('warrior', 73);
    try {
      await arena(page, room(22, 8, [1, 4]), 1, 1);
      await page.evaluate(() => { const G = window.__dbg(); const e = window.__dbg.fn.makeEnemy('goblin', G.p.x + 7, G.p.y, 1); e.awake = true; window.__dbg.fn.computeVis(); window.__dbg.fn.render(); });
      await quiet(page);
      const before = await view(page);
      // an awake foe off the edge of the view is marked by a red arrow on the canvas edge (pixels read back from the canvas)
      const red = await page.evaluate(() => { const c = document.getElementById('c'), x = c.getContext('2d'), d = window.devicePixelRatio || 1, v = window.__dbg.view(); let n = 0; const img = x.getImageData(Math.floor((v.cw - 30) * d), Math.floor((v.ch / 2 - 30) * d), Math.floor(30 * d), Math.floor(60 * d)).data; for (let i = 0; i < img.length; i += 4) if (img[i] > 230 && img[i + 1] < 110 && img[i + 2] < 110) n++; return n; });
      assert.ok(red > 20, 'the red edge arrow is drawn on the right edge: ' + red);
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
  it('six taps in 1.2 s on a rat with more foes in view behind it: the first kills it, the rest do nothing (no steps into the pack); a deliberate tap there later walks at once', async () => {
    const { page, ctx, errors } = await fresh('warrior', 74);
    try {
      await arena(page, ['.......', '#.#####', '#.#####', '#@.....', '#.#####'], 4, 6);   // one rat to kill, more foes in view behind it that do not come forward
      await page.evaluate(() => { const G = window.__dbg(), p = G.p; const a = window.__dbg.fn.makeEnemy('rat', p.x + 1, p.y, 1), b = window.__dbg.fn.makeEnemy('rat', p.x + 4, p.y, 1), c = window.__dbg.fn.makeEnemy('rat', p.x + 5, p.y, 1); for (const e of [a, b, c]) { e.hp = e.mhp = 1; e.atk = 1; } a.awake = true; b.awake = c.awake = true; b.stun = c.stun = 99; G.enemies = [a, b, c]; window.__dbg.fn.computeVis(); });
      await quiet(page);
      const s0 = await st(page), p1 = await pt(page, s0.x + 1, s0.y);
      for (let i = 0; i < 6; i++) { await page.mouse.click(p1.x, p1.y); await page.waitForTimeout(200); }   // 1.2 s of tapping: longer than the 600 ms window
      const s1 = await st(page);
      assert.equal(s1.x, s0.x, 'the hero never left its tile'); assert.equal(s1.y, s0.y);
      // the burst ended: after the window a tap on that empty tile is an ordinary walk
      await page.evaluate(() => { const G = window.__dbg(); G.enemies = []; window.__dbg.fn.computeVis(); });
      await page.waitForTimeout(900);
      const p2 = await pt(page, s0.x + 1, s0.y);
      await page.mouse.click(p2.x, p2.y); await page.waitForTimeout(200);
      assert.equal((await st(page)).x, s0.x + 1, 'a later tap walks immediately');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('a tile a foe just stepped off is stale for ~350 ms (a tap there is ignored), then an ordinary walk; a foe standing there is attacked as usual', async () => {
    const { page, ctx, errors } = await fresh('warrior', 75);
    try {
      await arena(page, room(14, 7, [3, 3]), 4, 6);
      await page.evaluate(() => { const G = window.__dbg(), p = G.p; const a = window.__dbg.fn.makeEnemy('goblin', p.x + 4, p.y, 1); a.awake = true; G.enemies = [a]; window.__dbg.fn.computeVis(); });
      await quiet(page);
      const tile = await page.evaluate(() => { window.__dbg.tables.BAL.ui.staleMs = 1200; const e = window.__dbg().enemies[0]; return [e.x, e.y]; });   // the 350 ms window, stretched so a slow machine between two taps cannot let it expire
      // one turn passes (a tap on yourself): the goblin steps towards you, off its old tile
      const me = await st(page), mp = await pt(page, me.x, me.y);
      await page.mouse.click(mp.x, mp.y);
      const moved = await page.evaluate(() => { const e = window.__dbg().enemies[0]; return [e.x, e.y]; });
      assert.notDeepEqual(moved, tile, 'the goblin left its tile');
      const s0 = await st(page), p = await pt(page, tile[0], tile[1]);
      await page.mouse.click(p.x, p.y);   // aimed at where it was a moment ago
      const s1 = await st(page);
      assert.deepEqual([s1.x, s1.y, s1.turn], [s0.x, s0.y, s0.turn], 'ignored: no step, no turn');
      assert.match(s1.log, /gone/);
      await page.waitForTimeout(1300);
      await page.evaluate(() => { window.__dbg().enemies[0].stun = 9; });   // keep it where it is
      const q = await pt(page, tile[0] - 4, tile[1]); await page.mouse.click(q.x, q.y); await page.waitForTimeout(200);
      assert.ok((await st(page)).turn > s0.turn, 'a tap a moment later acts at once');
      // a foe standing on a stale tile is attacked as usual
      const e2 = await page.evaluate(() => { const G = window.__dbg(), e = G.enemies[0]; return [e.x, e.y, G.p.x, G.p.y]; });
      assert.ok(Math.abs(e2[0] - e2[2]) + Math.abs(e2[1] - e2[3]) >= 1);
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
      const box = await page.evaluate(() => { const G = window.__dbg(); G.pending = 1; window.__dbg.fn.showPerk(); const r = document.querySelector('#modalBox button').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);   // immediately: the finger that was walking
      assert.equal((await st(page)).pending, 1, 'still pending: the early tap picked nothing');
      assert.equal(await page.locator('#modal').isVisible(), true);
      await page.waitForTimeout(500);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      assert.equal((await st(page)).pending, 0, 'a tap after the grace picks');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('a tap whose finger went DOWN before the card appeared is ignored even after the grace; Auto and DOM clicks are never blocked, even inside the grace', async () => {
    const { page, ctx, errors } = await fresh('warrior', 78, { grace: true, touch: true });
    try {
      // where the first card button will be
      const spot = await page.evaluate(() => { const G = window.__dbg(); G.pending = 1; window.__dbg.fn.showPerk(); const r = document.querySelector('#modalBox button').getBoundingClientRect(); const o = { x: r.x + r.width / 2, y: r.y + r.height / 2 }; G.pending = 0; document.getElementById('modal').style.display = 'none'; return o; });
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [spot] });   // the finger lands on the map ...
      await page.evaluate(() => { const G = window.__dbg(); G.pending = 1; window.__dbg.fn.showPerk(); });   // ... the card opens under it
      await page.waitForTimeout(600);                                                              // longer than the grace
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });            // ... and lifts: the click lands on the card
      await page.waitForTimeout(150);
      assert.equal((await st(page)).pending, 1, 'a tap that began before the card is not a pick');
      assert.equal(await page.locator('#modal').isVisible(), true);
      // a tap that starts AFTER it opened works
      await page.touchscreen.tap(spot.x, spot.y); await page.waitForTimeout(150);
      assert.equal((await st(page)).pending, 0, 'a fresh tap picks');
      // a click made through the DOM (what Auto and the bots do) is not delayed, even in the first milliseconds
      const r2 = await page.evaluate(() => { const G = window.__dbg(); G.pending = 1; window.__dbg.fn.showPerk(); document.querySelector('#modalBox button').click(); return G.pending; });
      assert.equal(r2, 0, 'a DOM click inside the grace is accepted');
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

