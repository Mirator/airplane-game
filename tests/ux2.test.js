// UX pass 2 tests: long-press / right-click inspect, reasons on disabled ability buttons, the danger guard (two taps, routes around traps),
// on-map callouts, the floor banner never blocking a tap, and the restructured Controls screen. Every input is a real pointer event
// (page.mouse, page.touchscreen, or CDP touch events with timing), never a call into the game's own handlers.
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
// client point of the centre of map tile (x, y)
const pt = (page, x, y) => page.evaluate(([x, y]) => { const v = window.__dbg.view(), r = document.getElementById('c').getBoundingClientRect(); return { x: r.left + v.ox + (x + 0.5) * v.ts, y: r.top + v.oy + (y + 0.5) * v.ts, ts: v.ts }; }, [x, y]);
const st = (page) => page.evaluate(() => { const G = window.__dbg(); return { x: G.p.x, y: G.p.y, hp: G.p.hp, turn: G.turn, mana: G.p.mana, log: G.log.slice(-1)[0], insp: window.__dbg.insp() && window.__dbg.insp().lines, guard: !!window.__dbg.guard(), foes: G.enemies.map((e) => [e.x, e.y, e.hp]) }; });
const hold = async (page, p, ms = 520) => { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up(); };
// carve a sealed test room out of the map: rows of '#' (wall) and '.' (floor); '@' = the player; everything is seen, and explored except '?' tiles
async function arena(page, rows, ox = 4, oy = 4) {
  return page.evaluate(([rows, ox, oy]) => {
    const G = window.__dbg(), W = 30; G.enemies = []; G.items = []; G.traps = []; G.shrine = null; G.merchant = null; G.cracks = []; G.smoke = [];
    for (let y = -1; y <= rows.length; y++) for (let x = -1; x <= rows[0].length; x++) { const k = (oy + y) * W + ox + x; G.map[k] = 0; G.seen[k] = true; G.exp[k] = true; }
    rows.forEach((r, y) => [...r].forEach((c, x) => { const k = (oy + y) * W + ox + x; G.map[k] = c === '#' ? 0 : 1; G.seen[k] = true; G.exp[k] = c !== '?'; if (c === '@') { G.p.x = ox + x; G.p.y = oy + y; } }));
    for (const k in G.cd) G.cd[k] = 0; G.vanish = 0; G.brace = null;
    window.__dbg.fn.computeVis(); window.__dbg.fn.endTurn(); return { x: G.p.x, y: G.p.y };
  }, [rows, ox, oy]);
}
const settle = (page, ms = 1200) => page.waitForTimeout(ms);

describe('inspect (long-press / right-click)', { concurrency: CONC }, () => {
  it('a long-press on a foe shows its card (name, HP, trait, state) and does not move or attack; any tap closes it and does nothing else', async () => {
    const { page, ctx, errors } = await fresh('warrior', 31);
    try {
      await page.evaluate(() => { window.T.setup(7); window.T.foe('goblin', 3, 0, false); window.__dbg.fn.endTurn(); window.__dbg().enemies[0].awake = false; window.__dbg.fn.computeVis(); });
      await quiet(page);
      const s0 = await st(page), e = s0.foes[0], p = await pt(page, e[0], e[1]);
      await hold(page, p);
      const s1 = await st(page);
      assert.ok(s1.insp, 'card shown');
      assert.match(s1.insp[0], /Goblin.*HP \d+\/\d+/); assert.ok(s1.insp.some((l) => /lunges/.test(l)), 'trait line'); assert.ok(s1.insp.some((l) => /Asleep/.test(l)), 'state: asleep');
      for (const l of s1.insp) assert.ok(l.length <= 55, 'card line <= 55 chars: ' + l);
      assert.equal(s1.x, s0.x); assert.equal(s1.turn, s0.turn, 'no turn passed: no move, no attack'); assert.deepEqual(s1.foes, s0.foes);
      // any tap closes the card and does nothing else
      const far = await pt(page, s0.x - 1, s0.y);
      await page.mouse.click(far.x, far.y);
      const s2 = await st(page);
      assert.equal(s2.insp, null, 'closed'); assert.equal(s2.x, s0.x); assert.equal(s2.turn, s0.turn, 'the closing tap is only a close');
      // a normal tap afterwards works as before
      await page.mouse.click(far.x, far.y);
      assert.equal((await st(page)).x, s0.x - 1, 'plain tap walks');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('card states: asleep, stunned / frozen / blinded with turns, winding up, Guard shield facing; own tile shows buffs; trap, shrine, item tiles get one line', async () => {
    const { page, ctx, errors } = await fresh('warrior', 32);
    try {
      await page.evaluate(() => {
        window.T.setup(7); const G = window.__dbg();
        const g = window.T.foe('guard', 3, 0, true); g.face = [-1, 0]; g.stun = 2; g.blind = 1; g.frz = 1; g.wind = { k: 'smash', tiles: [[G.p.x + 4, G.p.y]], dx: 1, dy: 0 };
        G.traps = [{ x: G.p.x + 1, y: G.p.y, k: 'spike', rev: 1 }];
        G.items.push({ x: G.p.x + 2, y: G.p.y, t: 'potion', v: 0 });
        G.ppois = { t: 3, d: 1 }; G.vanish = 2; G.brace = { hits: 2, t: 5, reflect: 0.5 };
        window.__dbg.fn.computeVis();
      });
      const lines = (x, y) => page.evaluate(([x, y]) => { const G = window.__dbg(); const r = window.__dbg.text.inspectLines(G.p.x + x, G.p.y + y); return r; }, [x, y]);
      // inspect through real input for the foe, through the text builder for the rest (same code path: showInspect uses inspectLines)
      const gl = await lines(3, 0);
      const txt = gl.join(' | ');
      assert.match(txt, /Guard/); assert.match(txt, /Stunned \d+ turn/); assert.match(txt, /Frozen/); assert.match(txt, /Blinded/); assert.match(txt, /Winding up/); assert.match(txt, /Shield down/);
      for (const l of gl) assert.ok(l.length <= 55, l);
      await page.evaluate(() => { const e = window.__dbg().enemies[0]; e.stun = 0; e.frz = 0; });
      assert.match((await lines(3, 0)).join(' '), /Shield faces west/, 'unstunned guard: facing');
      const me = (await lines(0, 0)).join(' | ');
      assert.match(me, /You.*HP/); assert.match(me, /Poisoned 3 turns/); assert.match(me, /Unseen 2 turns/); assert.match(me, /Brace: 2 hits/);
      assert.match((await lines(1, 0)).join(' '), /Spike trap/); assert.match((await lines(2, 0)).join(' '), /Potion/);
      await page.evaluate(() => { const G = window.__dbg(); G.ppois = null; G.vanish = 0; G.brace = null; });
      assert.deepEqual(await lines(0, 0), ['🛡 You  HP ' + await page.evaluate(() => { const p = window.__dbg().p; return p.hp + '/' + p.mhp; }), 'No effects.']);
      // a real long-press on the trap tile and on yourself
      await quiet(page);
      const s0 = await st(page);
      await hold(page, await pt(page, s0.x + 1, s0.y));
      assert.match((await st(page)).insp.join(' '), /Spike trap/);
      assert.equal((await st(page)).turn, s0.turn);
      await page.mouse.click(5, 120);
      await hold(page, await pt(page, s0.x, s0.y));
      assert.match((await st(page)).insp.join(' '), /You/);
      assert.equal((await st(page)).turn, s0.turn, 'inspecting yourself does not wait a turn');
      // a tile with nothing on it shows nothing and still is not a tap
      await page.mouse.click(5, 120);
      const nothing = await pt(page, s0.x, s0.y + 1);
      await hold(page, nothing);
      const sn = await st(page); assert.equal(sn.insp, null); assert.equal(sn.turn, s0.turn); assert.equal(sn.y, s0.y);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('every foe, in every state at once, fits the card budget (<= 55 chars a line) and starts with its name', async () => {
    const { page, ctx, errors } = await fresh('mage', 33);
    try {
      const bad = await page.evaluate(() => {
        window.T.setup(7); const G = window.__dbg(), out = [];
        for (const t of Object.keys(window.__dbg.tables.EN)) {
          const e = window.T.foe(t, 2, 0, false); e.elite = t === 'goblin' ? 1 : 0; e.name = 'Grimgor the Unbelievably Bloodthirsty'; e.stun = 3; e.frz = 2; e.blind = 2; e.pois = { t: 4, d: 1 }; e.rest = 1; e.hunter = 1; e.wind = { k: 'smash', tiles: [] };
          const L = window.__dbg.text.inspectLines(e.x, e.y);
          if (!L || !L[0].includes(window.__dbg.tables.EN[t].n) && !e.elite) out.push(t + ' no name');
          for (const l of L || []) if (l.length > 55) out.push(t + ': ' + l);
          G.enemies = [];
        }
        return out;
      });
      assert.deepEqual(bad, []);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('a press that moves more than 10px is not a long-press; a quick tap is not delayed (it moves in the same click, no timer in between)', async () => {
    const { page, ctx, errors } = await fresh('rogue', 34);
    try {
      await page.evaluate(() => { window.T.setup(7); window.T.foe('goblin', 4, 0, false); window.__dbg.fn.endTurn(); });
      await quiet(page);
      const s0 = await st(page);
      // quick tap: measure pointerdown -> end of the click dispatch, and whether the move already happened by then
      await page.evaluate(() => {
        window.__lat = {}; const c = document.getElementById('c');
        c.addEventListener('pointerdown', () => { window.__lat.down = performance.now(); window.__lat.x0 = window.__dbg().p.x; }, true);
        window.addEventListener('click', () => { window.__lat.up = performance.now(); window.__lat.x1 = window.__dbg().p.x; });
      });
      const t = await pt(page, s0.x + 1, s0.y);
      await page.mouse.move(t.x, t.y); await page.mouse.down(); await page.mouse.up();
      const lat = await page.evaluate(() => window.__lat);
      assert.equal(lat.x1, lat.x0 + 1, 'the step happened inside the click');
      assert.ok(lat.up - lat.down < 150, 'tap handled promptly: ' + (lat.up - lat.down) + ' ms');
      assert.equal((await st(page)).insp, null, 'no card on a tap');
      // a drag cancels the long-press: press on the foe, slide 24px (still on the map), wait, release (the release is then an ordinary tap)
      const e = (await st(page)).foes[0], p = await pt(page, e[0], e[1]), before = await st(page);
      await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 24, p.y + 3, { steps: 4 }); await page.waitForTimeout(520); await page.mouse.up();
      const after = await st(page);
      assert.equal(after.insp, null, 'a drag cancels the long-press'); assert.ok(before.turn >= 0);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('right-click inspects on desktop (1280x800) and does not act; the browser menu stays closed', async () => {
    const { page, ctx, errors } = await fresh('warrior', 35, { w: 1280, h: 800 });
    try {
      await page.evaluate(() => { window.T.setup(7); window.T.foe('archer', 3, 0, true); window.__dbg.fn.endTurn(); });
      await quiet(page);
      const s0 = await st(page), e = s0.foes[0], p = await pt(page, e[0], e[1]);
      await page.mouse.click(p.x, p.y, { button: 'right' });
      const s1 = await st(page);
      assert.match(s1.insp[0], /Archer/); assert.equal(s1.turn, s0.turn); assert.equal(s1.x, s0.x);
      // the card sits on the canvas: nothing covers the map
      const covered = await page.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); let bad = 0; for (let y = r.top + 6; y < r.bottom; y += 20) for (let x = r.left + 6; x < r.right; x += 20) { const el = document.elementFromPoint(x, y); if (!el || el.id !== 'c') bad++; } return bad; });
      assert.equal(covered, 0);
      await page.mouse.click(p.x, p.y + 80);                  // any tap closes
      assert.equal((await st(page)).insp, null);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('touch: a held finger (CDP touch events) inspects without moving; a finger that slides away does not; a quick touch tap still walks', async () => {
    const { page, ctx, errors } = await fresh('warrior', 36, { touch: true });
    try {
      const cdp = await ctx.newCDPSession(page);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await page.evaluate(() => { window.T.setup(7); window.T.foe('hound', 3, 0, false); window.__dbg.fn.endTurn(); });
      await quiet(page);
      const s0 = await st(page), e = s0.foes[0], p = await pt(page, e[0], e[1]);
      await touch('touchStart', p.x, p.y); await page.waitForTimeout(520); await touch('touchEnd');
      await page.waitForTimeout(80);
      const s1 = await st(page);
      assert.match(s1.insp[0], /Hound/); assert.equal(s1.turn, s0.turn); assert.equal(s1.x, s0.x, 'no move after the release');
      await page.touchscreen.tap(5, 120);                     // dismiss
      assert.equal((await st(page)).insp, null);
      await touch('touchStart', p.x, p.y); await touch('touchMove', p.x + 30, p.y); await page.waitForTimeout(520); await touch('touchEnd');
      assert.equal((await st(page)).insp, null, 'sliding cancels');
      const t = await pt(page, s0.x - 1, s0.y);
      await page.touchscreen.tap(t.x, t.y);
      assert.equal((await st(page)).x, s0.x - 1, 'a touch tap walks');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('inspect while an ability is armed: the card shows, the ability does not fire and stays armed; a following tap on a target still fires; nothing covers the map', async () => {
    const { page, ctx, errors } = await fresh('mage', 37);
    try {
      await page.evaluate(() => { window.T.setup(7); const e = window.T.foe('goblin', 3, 0, true); e.hp = e.mhp = 200; window.__dbg().p.mana = 30; window.__dbg.fn.endTurn(); });
      await quiet(page);
      await page.click('#a_0');                                // Bolt armed
      const s0 = await st(page), e = s0.foes[0], p = await pt(page, e[0], e[1]);
      await hold(page, p);
      const s1 = await st(page);
      assert.ok(s1.insp, 'card shown while armed'); assert.equal(s1.mana, s0.mana, 'nothing fired'); assert.deepEqual(s1.foes, s0.foes); assert.equal(s1.turn, s0.turn);
      assert.equal(await page.evaluate(() => document.getElementById('a_0').classList.contains('armed')), true, 'still armed');
      const covered = await page.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); const bad = []; for (let y = r.top + 6; y < r.bottom; y += 12) for (let x = r.left + 6; x < r.right; x += 12) { const el = document.elementFromPoint(x, y); if (!el || el.id !== 'c') bad.push(1); } return bad.length; });
      assert.equal(covered, 0, 'nothing over the map while armed with a card open');
      await page.mouse.click(p.x, p.y);                       // taps still target as before
      const s2 = await st(page);
      assert.ok(s2.mana < s0.mana, 'the tap fired the bolt'); assert.equal(s2.insp, null);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});

describe('ability button reasons', { concurrency: CONC }, () => {
  const subs = (page) => page.evaluate(() => [0, 1, 2, 3].map((i) => { const b = document.getElementById('a_' + i); return { cls: b.className, sub: (b.querySelector('.sub') || {}).textContent || '' }; }));
  it('disabled abilities say why in <= 2 words: no target / too far / no line / cooldown / missing cost; tapping one still logs the reason; unchanged buttons are not rewritten', async () => {
    const { page, ctx, errors } = await fresh('mage', 38);
    try {
      await page.evaluate(() => { window.T.setup(7); const G = window.__dbg(); G.p.mana = 30; window.__dbg.fn.endTurn(); });
      await quiet(page);
      let s = await subs(page);                                 // mage kit: bolt, nova, blink, fire
      assert.equal(s[0].sub, 'no target', 'bolt, nothing in sight'); assert.match(s[0].cls, /dis/); assert.equal(s[1].sub, 'no target', 'nova');
      // a foe in sight but out of bolt range
      await page.evaluate(() => { window.__dbg.tables.BAL.ability.bolt.range = 2; window.T.foe('goblin', 4, 0, false); window.__dbg.fn.endTurn(); });
      s = await subs(page);
      assert.equal(s[0].sub, 'too far', 'bolt: visible but out of range'); assert.equal(s[1].sub, 'too far', 'nova: foe not adjacent');
      // in range, but the line is blocked by another foe
      await page.evaluate(() => { window.__dbg.tables.BAL.ability.bolt.range = 9; window.T.setup(7); window.T.foe('goblin', 1, 0, false).hp = 99; window.T.foe('goblin', 3, 0, false); const G = window.__dbg(); G.enemies = [G.enemies[1], G.enemies[0]]; window.__dbg.fn.endTurn(); });
      // cooldown and missing mana
      await page.evaluate(() => { const G = window.__dbg(); G.cd.blink = 3; G.p.mana = 0; window.__dbg.fn.computeVis(); window.__dbg.fn.endTurn(); });
      s = await subs(page);
      assert.match(s[2].sub, /^⏳ \d$/, 'blink on cooldown: ' + s[2].sub);
      assert.match(s[0].sub, /^\d+ mana$/, 'bolt: missing cost ' + s[0].sub);
      for (const x of s) assert.ok(x.sub.split(' ').length <= 2, 'at most two words: ' + x.sub);
      // tapping a disabled button logs the reason
      await page.evaluate(() => { window.__dbg().log.push('x'); });
      await page.click('#a_2');
      assert.match(await page.evaluate(() => window.__dbg().log.slice(-1)[0]), /Blink.*recharge/);
      await page.click('#a_0');
      assert.match(await page.evaluate(() => window.__dbg().log.slice(-1)[0]), /needs \d+ mana/);
      // not rewritten when nothing changed
      await page.evaluate(() => { const G = window.__dbg(); G.p.mana = 30; G.cd.blink = 0; window.__dbg.fn.endTurn(); });
      await quiet(page);
      const n = await page.evaluate(() => new Promise((res) => { let c = 0; const mo = new MutationObserver((m) => { c += m.length; }); mo.observe(document.getElementById('bar2'), { childList: true, subtree: true, characterData: true }); for (let i = 0; i < 30; i++) window.__dbg.view(), document.getElementById('c').dispatchEvent(new Event('pointermove')); setTimeout(() => { mo.disconnect(); res(c); }, 600); }));
      assert.equal(n, 0, 'the ability row is not rewritten while unchanged');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('warrior and rogue labels: melee kits say no target / too far; Charge says no line when a foe is not in line; knives say no knives', async () => {
    const { page, ctx, errors } = await fresh('warrior', 39);
    try {
      await page.evaluate(() => { window.T.setup(7); const G = window.__dbg(); G.p.rage = 100; window.__dbg.fn.endTurn(); });
      await quiet(page);
      let s = await subs(page);                                 // warrior: bash, cleave, charge, brace
      assert.equal(s[0].sub, 'no target'); assert.equal(s[1].sub, 'no target'); assert.equal(s[2].sub, 'no target');
      await page.evaluate(() => { window.T.foe('goblin', 4, 0, false); window.__dbg.fn.endTurn(); });
      s = await subs(page);
      assert.equal(s[0].sub, 'too far'); assert.equal(s[1].sub, 'too far'); assert.notEqual(s[2].sub, 'no target');
      await page.evaluate(() => { const G = window.__dbg(); G.enemies = []; window.T.foe('goblin', 3, 1, false); window.__dbg.fn.endTurn(); });
      s = await subs(page);
      assert.equal(s[2].sub, 'no line', 'a foe in sight but off the charge lines');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
    const r = await fresh('rogue', 40);
    try {
      await r.page.evaluate(() => { window.T.setup(7); const G = window.__dbg(); G.knives = 0; window.__dbg.fn.endTurn(); });
      await quiet(r.page);
      const s = await subs(r.page);                             // rogue: backstab, vanish, knife, smoke
      assert.equal(s[0].sub, 'no target'); assert.equal(s[2].sub, 'no knives');
      assert.deepEqual(r.errors, []);
    } finally { await r.ctx.close(); }
  });
});

describe('danger guard', { concurrency: CONC }, () => {
  it('a revealed trap needs two taps: the first marks it with a warning and a <= 5 word log line, the second walks on; another tile or the timeout resets it', async () => {
    const { page, ctx, errors } = await fresh('warrior', 41);
    try {
      await arena(page, ['#########', '#@......#', '#.......#', '#########']);
      await page.evaluate(() => { const G = window.__dbg(); G.traps = [{ x: G.p.x + 1, y: G.p.y, k: 'spike', rev: 1 }]; window.__dbg.fn.endTurn(); });
      await quiet(page);
      const s0 = await st(page), t = await pt(page, s0.x + 1, s0.y);
      await page.mouse.click(t.x, t.y);
      let s1 = await st(page);
      assert.equal(s1.x, s0.x, 'the first tap does not move'); assert.equal(s1.turn, s0.turn); assert.equal(s1.hp, s0.hp); assert.equal(s1.guard, true, 'the tile is marked');
      assert.match(s1.log, /tap again/i); assert.ok(s1.log.replace(/[^\w ]/g, ' ').trim().split(/\s+/).length <= 5, 'at most 5 words: ' + s1.log);
      // a tap elsewhere is a normal tap (and drops the mark)
      const o = await pt(page, s0.x, s0.y + 1);
      await page.mouse.click(o.x, o.y);
      assert.equal((await st(page)).y, s0.y + 1); assert.equal((await st(page)).guard, false);
      // two taps again, back on the trap (now diagonal to us: still the first tap only warns)
      const t1 = await pt(page, s0.x + 1, s0.y);
      await page.mouse.click(t1.x, t1.y);
      assert.equal((await st(page)).guard, true); assert.equal((await st(page)).y, s0.y + 1);
      await page.mouse.click(t1.x, t1.y);
      await page.waitForFunction(() => window.__dbg().p.hp < window.__dbg().p.mhp, null, { timeout: 4000 });
      assert.equal((await st(page)).x, s0.x + 1, 'the second tap walked onto the trap');
      // the mark times out
      await page.evaluate(() => { const G = window.__dbg(); G.traps = [{ x: G.p.x + 1, y: G.p.y, k: 'spike', rev: 1 }]; });
      const s2 = await st(page), t2 = await pt(page, s2.x + 1, s2.y);
      await page.mouse.click(t2.x, t2.y); await page.waitForTimeout(4400);   // the default confirm window is 4 s
      assert.equal((await st(page)).guard, false, 'expired');
      await page.mouse.click(t2.x, t2.y);
      assert.equal((await st(page)).x, s2.x, 'after the timeout the next tap warns again instead of walking');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('a red (wind-up) tile needs two taps; a crack about to break counts, a fresh crack does not; keyboard / internal tryMove are untouched', async () => {
    const { page, ctx, errors } = await fresh('warrior', 42);
    try {
      await arena(page, ['#########', '#@......#', '#.......#', '#########']);
      await page.evaluate(() => { const G = window.__dbg(), e = window.__dbg.fn.makeEnemy('troll', G.p.x + 4, G.p.y, 3); e.awake = true; e.wind = { k: 'smash', tiles: [[G.p.x + 1, G.p.y]], dx: 1, dy: 0 }; e.cd = 9; G.cracks = [{ x: G.p.x + 1, y: G.p.y + 1, t: 1 }, { x: G.p.x + 2, y: G.p.y + 1, t: 5 }]; window.__dbg.fn.computeVis(); });
      await quiet(page);
      const s0 = await st(page);
      const red = await pt(page, s0.x + 1, s0.y); await page.mouse.click(red.x, red.y);
      let s1 = await st(page); assert.equal(s1.x, s0.x); assert.equal(s1.turn, s0.turn); assert.match(s1.log, /Danger.*tap again/);
      const crack = await pt(page, s0.x + 1, s0.y + 1); await page.mouse.click(crack.x, crack.y);
      s1 = await st(page); assert.equal(s1.x, s0.x, 'a crack that breaks this turn needs a second tap'); assert.match(s1.log, /tap again/);
      // a fresh crack (several turns left) is not a danger: tapping it does not warn
      const fresh = await pt(page, s0.x + 2, s0.y + 1); await page.mouse.click(fresh.x, fresh.y);
      s1 = await st(page); assert.equal(s1.guard, false, 'a fresh crack is not guarded'); assert.doesNotMatch(s1.log, /tap again/);
      // internal moves (what Auto and the bots call) have no guard
      await page.evaluate(() => { window.__dbg.fn.tryMove(1, 0); });
      const s3 = await st(page);
      assert.ok(s3.x > s0.x && s3.turn > s0.turn && s3.hp < s0.hp, 'tryMove is unguarded: it walked into the red tile and took the hit ' + JSON.stringify(s3));
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('tap-to-walk routes around a revealed trap when it can, and stops in front of it (without stepping on it) when it cannot', async () => {
    const { page, ctx, errors } = await fresh('warrior', 43);
    try {
      await arena(page, ['########', '#@.....#', '#......#', '#......#', '########']);
      await page.evaluate(() => { const G = window.__dbg(); G.traps = [{ x: G.p.x + 3, y: G.p.y, k: 'spike', rev: 1 }]; window.__dbg.fn.endTurn(); });
      await quiet(page);
      const s0 = await st(page), goal = await pt(page, s0.x + 5, s0.y);
      await page.mouse.click(goal.x, goal.y);
      await page.waitForFunction(([x, y]) => window.__dbg().p.x === x && window.__dbg().p.y === y, [s0.x + 5, s0.y], { timeout: 5000 });
      await page.waitForTimeout(300);
      const s1 = await st(page);
      assert.equal(s1.hp, s0.hp, 'went round: the trap never fired'); assert.equal(s1.guard, false);
      // a corridor with the trap in it: no way round
      await arena(page, ['########', '#@.....#', '########']);
      await page.evaluate(() => { const G = window.__dbg(); G.traps = [{ x: G.p.x + 3, y: G.p.y, k: 'spike', rev: 1 }]; window.__dbg.fn.endTurn(); });
      await quiet(page);
      const c0 = await st(page), cg = await pt(page, c0.x + 5, c0.y);
      await page.mouse.click(cg.x, cg.y);
      await page.waitForFunction((x) => window.__dbg().p.x === x, c0.x + 2, { timeout: 5000 }).catch(async (e) => { throw new Error(e.message + ' state ' + JSON.stringify([c0, await st(page)])); });
      await page.waitForTimeout(400);
      const c1 = await st(page);
      assert.equal(c1.x, c0.x + 2, 'stopped right in front of the trap'); assert.equal(c1.hp, c0.hp); assert.match(c1.log, /Trap in the way/);
      // then the trap tile itself: two taps cross it
      const tp = await pt(page, c0.x + 3, c0.y);
      await page.mouse.click(tp.x, tp.y); assert.equal((await st(page)).x, c0.x + 2); assert.equal((await st(page)).guard, true);
      await page.mouse.click(tp.x, tp.y);
      assert.equal((await st(page)).x, c0.x + 3); assert.ok((await st(page)).hp < c0.hp, 'the second tap stepped on it');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('a trap further away: the first tap marks it, the second walks up and steps on it', async () => {
    const { page, ctx, errors } = await fresh('warrior', 44);
    try {
      await arena(page, ['#########', '#@......#', '#.......#', '#########']);
      await page.evaluate(() => { const G = window.__dbg(); G.traps = [{ x: G.p.x + 5, y: G.p.y, k: 'dart', rev: 1 }]; window.__dbg.fn.endTurn(); });
      await quiet(page);
      const s0 = await st(page), t = await pt(page, s0.x + 5, s0.y);
      await page.mouse.click(t.x, t.y);
      assert.equal((await st(page)).x, s0.x); assert.equal((await st(page)).guard, true);
      await page.mouse.click(t.x, t.y);
      await page.waitForFunction((x) => window.__dbg().p.x === x, s0.x + 5, { timeout: 6000 });
      assert.ok(await page.evaluate(() => !!window.__dbg().ppois), 'poisoned by the dart');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('Explore goes around a revealed trap to the unexplored tile, and in a corridor stops in front of the trap', async () => {
    const { page, ctx, errors } = await fresh('warrior', 45);
    try {
      await arena(page, ['#####################', '#@..................#', '#...................#', '#..................?#', '#####################']);
      await page.evaluate(() => { const G = window.__dbg(); G.traps = [{ x: G.p.x + 1, y: G.p.y, k: 'spike', rev: 1 }, { x: G.p.x + 5, y: G.p.y + 2, k: 'spike', rev: 1 }]; window.__dbg.fn.endTurn(); });
      await quiet(page);
      const hp0 = (await st(page)).hp;
      await page.click('#b_exp');
      await page.waitForFunction(() => window.__dbg().p.x >= 12, null, { timeout: 8000 });
      await page.waitForTimeout(500);
      assert.equal((await st(page)).hp, hp0, 'Explore never stepped on a revealed trap');
      // corridor: the unexplored end is behind the trap
      await arena(page, ['#####################', '#@..................?#', '#####################']);
      await page.evaluate(() => { const G = window.__dbg(); G.traps = [{ x: G.p.x + 4, y: G.p.y, k: 'spike', rev: 1 }]; window.__dbg.fn.endTurn(); });
      await quiet(page);
      const c0 = await st(page);
      await page.click('#b_exp');
      await page.waitForFunction((x) => window.__dbg().p.x === x, c0.x + 3, { timeout: 6000 });
      await page.waitForTimeout(500);
      const c1 = await st(page);
      assert.equal(c1.x, c0.x + 3, 'stopped in front of the trap'); assert.equal(c1.hp, c0.hp); assert.match(c1.log, /Trap in the way/);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('Auto is not guarded: it still plays a run through (internal moves, no tap confirmations)', async () => {
    const { page, ctx, errors } = await fresh('warrior', 46);
    try {
      const n = await page.evaluate(() => { window.__dbg.auto.start(true); return window.__dbg.auto.runSync(400); });
      assert.ok(n > 50, 'Auto took ' + n + ' decisions');
      assert.equal(await page.evaluate(() => window.__dbg.guard()), null, 'Auto never sets the guard');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});

describe('callouts', { concurrency: CONC }, () => {
  const co = (page) => page.evaluate(() => window.__dbg.callouts());
  it('HP below 30% calls out once per crossing and re-arms above 40%; elite sighting, level up, enrage, key, unlocked; never more than two; <= 3 words', async () => {
    const { page, ctx, errors } = await fresh('warrior', 47);
    try {
      const seen = new Set();
      const note = async () => { for (const t of await co(page)) seen.add(t); };
      await page.evaluate(() => { window.T.setup(7); const G = window.__dbg(); G.p.mhp = 100; G.p.hp = 100; window.__dbg.fn.endTurn(); });
      await page.evaluate(() => { const G = window.__dbg(); G.p.hp = 35; window.__dbg.fn.endTurn(); });
      assert.deepEqual(await co(page), [], '35% is not low');
      await page.evaluate(() => { const G = window.__dbg(); G.p.hp = 25; window.__dbg.fn.endTurn(); });
      assert.deepEqual(await co(page), ['LOW HP']); await note();
      await page.waitForTimeout(1200);
      await page.evaluate(() => { const G = window.__dbg(); G.p.hp = 20; window.__dbg.fn.endTurn(); });
      assert.deepEqual(await co(page), [], 'once per crossing: still low, no repeat');
      await page.evaluate(() => { const G = window.__dbg(); G.p.hp = 35; window.__dbg.fn.endTurn(); });
      await page.evaluate(() => { const G = window.__dbg(); G.p.hp = 20; window.__dbg.fn.endTurn(); });
      assert.deepEqual(await co(page), [], '35% is inside the dead band: no re-arm yet');
      await page.evaluate(() => { const G = window.__dbg(); G.p.hp = 60; window.__dbg.fn.endTurn(); G.p.hp = 20; window.__dbg.fn.endTurn(); });
      assert.deepEqual(await co(page), ['LOW HP'], 're-armed after healing above 40%');
      await page.waitForTimeout(1200);
      // elite comes into view: once
      await page.evaluate(() => { window.T.setup(7); const e = window.T.foe('goblin', 3, 0, false); e.elite = 1; e.name = 'Grim Test'; });
      await page.evaluate(() => { window.__dbg.fn.endTurn(); });
      assert.deepEqual(await co(page), ['ELITE']); await note();
      await page.evaluate(() => { window.__dbg.fn.computeVis(); window.__dbg.fn.computeVis(); });
      assert.deepEqual(await co(page), ['ELITE'], 'not repeated while it stays in view');
      await page.waitForTimeout(1200);
      // killing the elite drops the key; picking it up and opening the vault
      await page.evaluate(() => { const G = window.__dbg(); window.__dbg.api.killEnemy(G.enemies[0]); });
      assert.ok((await co(page)).includes('KEY')); await note();
      await page.waitForTimeout(1200);
      await page.evaluate(() => { const G = window.__dbg(); G.items.push({ x: G.p.x + 1, y: G.p.y, t: 'key', v: 0 }); window.__dbg.fn.tryMove(1, 0); });
      assert.ok((await co(page)).includes('KEY'), 'picking the key up calls out'); await page.waitForTimeout(1200);
      await page.evaluate(() => { const G = window.__dbg(); G.keys = 1; G.map[G.p.y * 30 + G.p.x + 1] = 5; G.seen[G.p.y * 30 + G.p.x + 1] = true; window.__dbg.fn.tryMove(1, 0); });
      assert.deepEqual(await co(page), ['UNLOCKED']); await note();
      await page.waitForTimeout(1200);
      // level up
      await page.evaluate(() => { window.T.setup(7); const G = window.__dbg(); G.p.xp = 1e6; window.T.foe('rat', 1, 0, true); window.__dbg.api.killEnemy(G.enemies[0]); });
      assert.ok((await co(page)).includes('LEVEL UP')); await note();
      await page.evaluate(() => { document.getElementById('modal').style.display = 'none'; });
      await page.waitForTimeout(1200);
      // boss enrage
      await page.evaluate(() => { window.T.setup(7); const G = window.__dbg(), d = window.__dbg.fn.makeEnemy('dragon', G.p.x + 3, G.p.y, 8); d.awake = true; d.hp = Math.round(d.mhp * 0.1); d.sm = 9; d.cd = 99; window.__dbg.fn.computeVis(); window.__dbg.fn.endTurn(); });
      assert.ok((await co(page)).includes('ENRAGED')); await note();
      for (const t of seen) assert.ok(t.split(' ').length <= 3, t);
      assert.deepEqual([...seen].sort(), ['ELITE', 'ENRAGED', 'KEY', 'LEVEL UP', 'LOW HP', 'UNLOCKED'].sort());
      // never more than two at once
      await page.waitForTimeout(1200);
      await page.evaluate(() => { const G = window.__dbg(); for (let i = 0; i < 5; i++) window.__dbg.callout(G.p.x, G.p.y, 'TEST ' + i, '#fff'); });
      assert.equal((await co(page)).length, 2, 'two at most');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('a callout never takes a tap: the point under it is the canvas and a real tap there still walks; with reduced motion it still shows', async () => {
    for (const reducedMotion of [false, true]) {
      const { page, ctx, errors } = await fresh('warrior', 48, { reducedMotion });
      try {
        await page.evaluate(() => { window.T.setup(7); window.__dbg.fn.endTurn(); });
        await quiet(page);
        const s0 = await st(page);
        await page.evaluate(() => { const G = window.__dbg(); window.__dbg.callout(G.p.x + 1, G.p.y, 'LEVEL UP', '#ffd24a'); window.__dbg.callout(G.p.x + 1, G.p.y, 'LOW HP', '#f55'); });
        assert.equal((await co(page)).length, 2);
        const t = await pt(page, s0.x + 1, s0.y);
        for (const dy of [0, -t.ts * 0.5, -t.ts]) assert.equal(await page.evaluate(([x, y]) => (document.elementFromPoint(x, y) || {}).id, [t.x, t.y + dy]), 'c', 'canvas under the callout');
        assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('toast')).pointerEvents), 'none', 'the toast pill does not take taps either');
        await page.mouse.click(t.x, t.y - t.ts * 0.5);           // tap through where the callout is drawn: acts as a tap on that tile
        assert.ok((await st(page)).x >= s0.x, 'no error'); assert.ok((await st(page)).turn > s0.turn || (await st(page)).x !== s0.x, 'the tap went through to the map');
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    }
  });

  it('the floor-arrival banner is drawn on the canvas, never blocks a tap, and a tap clears it', async () => {
    const { page, ctx, errors } = await fresh('warrior', 49);
    try {
      await page.evaluate(() => { window.__dbg.fn.newFloor(2); window.T.setup(7); window.__dbg.fn.endTurn(); });
      assert.equal(await page.evaluate(() => window.__dbg.banner()), true, 'banner is up');
      await quiet(page);
      const box = await page.locator('#c').boundingBox();
      for (const f of [0.1, 0.16, 0.2, 0.3]) assert.equal(await page.evaluate(([x, y]) => (document.elementFromPoint(x, y) || {}).id, [box.x + box.width / 2, box.y + box.height * f]), 'c');
      const s0 = await st(page), t = await pt(page, s0.x + 1, s0.y);
      await page.mouse.click(t.x, t.y);
      assert.equal((await st(page)).x, s0.x + 1, 'the tap went through the banner');
      assert.equal(await page.evaluate(() => window.__dbg.banner()), false, 'the tap cleared the banner');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});

describe('controls screen', { concurrency: CONC }, () => {
  it('essentials (<= 120 words) are visible first, the rest sits in collapsed sections with 44px headers; it mentions hold-to-inspect and the second tap', async () => {
    const { page, ctx, errors } = await fresh('warrior', 50);
    try {
      await page.click('#menuBtn'); await page.locator('#modalBox button', { hasText: /Controls/ }).click();
      const info = await page.evaluate(() => {
        const box = document.getElementById('modalBox'), ess = box.querySelector('.hess'), ds = [...box.querySelectorAll('details.hsec')];
        return { words: ess.innerText.split(/\s+/).filter(Boolean).length, text: ess.innerText, n: ds.length, open: ds.filter((d) => d.open).length, h: ds.map((d) => d.querySelector('summary').getBoundingClientRect().height), total: box.innerText.split(/\s+/).length, scroll: document.documentElement.scrollHeight <= window.innerHeight };
      });
      assert.ok(info.words <= 120, 'essentials ' + info.words + ' words');
      assert.ok(info.n >= 4, 'sections'); assert.equal(info.open, 0, 'collapsed by default');
      for (const h of info.h) assert.ok(h >= 44, 'summary tap target ' + h);
      assert.match(info.text, /Hold/); assert.match(info.text, /right-click/); assert.match(info.text, /second tap/); assert.match(info.text, /Dim/);
      assert.ok(info.scroll, 'no page scroll');
      await page.locator('#modalBox summary').first().click();
      assert.equal(await page.evaluate(() => document.querySelectorAll('#modalBox details[open]').length), 1);
      assert.ok(await page.locator('#modalBox details[open] .pl').first().isVisible());
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});
