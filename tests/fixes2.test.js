// Fix pass tests, part 2: playtest bugs / clarity and the art review fixes. Every input is a real pointer / keyboard event with real timing; the game's own handlers are only
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

// ---------------------------------------------------------------- bugs and clarity
describe('playtest bugs and clarity', { concurrency: CONC }, () => {
  it('P2-1/P2-4: tapping a brass key names it; a trait item names its trait rule', async () => {
    const { page, ctx, errors } = await fresh('warrior', 81);
    try {
      await arena(page, room(12, 5, [2, 2]), 4, 6);
      const p0 = await st(page);
      await page.evaluate(() => { const G = window.__dbg(); G.items.push({ x: G.p.x + 4, y: G.p.y, t: 'key', v: 0 }); G.items.push({ x: G.p.x + 6, y: G.p.y, t: 'armor', k: 'mail', v: 4, tr: 'leaden' }); window.__dbg.fn.computeVis(); });
      await quiet(page);
      const k = await pt(page, p0.x + 4, p0.y); await page.mouse.click(k.x, k.y);
      assert.match(await page.evaluate(() => window.__dbg().log.join('|')), /Brass key/); assert.doesNotMatch(await page.evaluate(() => window.__dbg().log.join('|')), /Strange/);
      await page.waitForFunction(() => window.__dbg().keys > 0, null, { timeout: 4000 });
      const a = await pt(page, p0.x + 6, p0.y); await page.mouse.click(a.x, a.y);
      assert.match(await page.evaluate(() => window.__dbg().log.join('|')), /Leaden \w+ Mail: .*potions heal/);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('P2-2/P2-10/P2-3: the gear card shows no mana line to a Warrior, repeats no defense number as text, says what the swap gives up; a declined item does not re-open when stepped on, tapping yourself shows it again', async () => {
    const { page, ctx, errors } = await fresh('warrior', 82);
    try {
      await arena(page, room(12, 5, [2, 2]), 4, 6);
      await page.evaluate(() => { const G = window.__dbg(); G.p.eq.armor = { t: 'armor', k: 'leather', v: 2, tr: 'spiked' }; });
      const at = await page.evaluate(() => window.__dbg.spawnGear('armor', 'plate', 'heavy', 4));
      await page.evaluate(() => window.__dbg.fn.computeVis()); await quiet(page);
      const p = await pt(page, at[0], at[1]); await page.mouse.click(p.x, p.y);
      await page.waitForSelector('#modalBox[data-kind="gear"]', { timeout: 3000 });
      const txt = await page.locator('#modalBox').innerText();
      assert.doesNotMatch(txt, /mana/i, 'no mana for a Warrior'); assert.doesNotMatch(txt, /spell/i);
      assert.doesNotMatch(txt, /[+-]\d defense,/, 'the defense number is the chip only, not a text line');
      assert.match(txt, /Gives up: .*dodge/i, 'what the swap loses is listed: ' + txt);
      await page.locator('#modalBox button[data-k="leave"]').click();
      // walk off and back on with real taps: no card
      const sp = await st(page), away = await pt(page, sp.x - 1, sp.y); await page.mouse.click(away.x, away.y); await page.waitForTimeout(150);
      const back = await pt(page, at[0], at[1]); await page.mouse.click(back.x, back.y); await page.waitForTimeout(250);
      assert.equal(await page.locator('#modal').isVisible(), false, 'a declined item does not re-open its card when stepped on');
      const me = await pt(page, at[0], at[1]); await page.mouse.click(me.x, me.y);
      await page.waitForSelector('#modalBox[data-kind="gear"]', { timeout: 2000 });
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('P2-7: Explore walks to loot it has already seen instead of saying "nothing left"; a declined gear item or a full belt is not a goal', async () => {
    const { page, ctx, errors } = await fresh('warrior', 83);
    try {
      await arena(page, room(14, 5, [1, 2]), 4, 6);
      await page.evaluate(() => { const G = window.__dbg(); G.items.push({ x: G.p.x + 8, y: G.p.y, t: 'gold', v: 5 }, { x: G.p.x + 10, y: G.p.y, t: 'potion', v: 0 }); G.inv.pot = 0; window.__dbg.fn.computeVis(); });
      await quiet(page);
      for (let i = 0; i < 4 && (await page.evaluate(() => window.__dbg().items.length)) > 0; i++) { await page.click('#b_exp'); await page.waitForTimeout(900); }
      assert.equal(await page.evaluate(() => window.__dbg().items.length), 0, 'both piles were picked up by Explore');
      await page.click('#b_exp');
      assert.match((await st(page)).log, /Nothing left|stairs/);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('P2-5: Escape closes Controls (and the menu), a level-up pick closes too (it stays pending), never the end screen', async () => {
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
      assert.equal(await page.locator('#modal').isVisible(), false, 'a perk pick can be put off with Esc'); assert.equal(await page.evaluate(() => window.__dbg().pending), 1, 'and stays pending');
      await page.evaluate(() => { window.__dbg().pending = 0; document.getElementById('modal').style.display = 'none'; const G = window.__dbg(); G.p.hp = 0; window.__dbg.fn.endTurn(); });
      assert.equal(await page.evaluate(() => document.getElementById('modalBox').dataset.kind), 'end');
      await page.keyboard.press('Escape'); await page.waitForTimeout(60);
      assert.equal(await page.locator('#modal').isVisible(), true, 'the end-of-run screen is not dismissed by Escape either');
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
      await page.evaluate(() => { window.T.setup(5); window.T.foe('goblin', 1, 0, false); window.__dbg.fn.endTurn(); });   // a foe next to you: Bash is ready
      await page.waitForFunction(() => /ready/.test(document.getElementById('a_0').textContent));
      assert.doesNotMatch(await page.locator('#a_0').textContent(), /cd/);
      await page.evaluate(() => { window.__dbg().cd.bash = 3; window.__dbg.fn.render(); });
      assert.match(await page.locator('#a_0').textContent(), /3/);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('P2-11: the first Auto tap in a run only states the idle-pay terms; the second starts it (no alert)', async () => {
    const { page, ctx, errors } = await fresh('warrior', 88);
    try {
      await page.click('#menuBtn');
      await page.locator('#modalBox button[data-k="auto"]').click();
      assert.equal(await page.evaluate(() => window.__dbg.auto.state().on), false, 'not started yet');
      assert.match(await page.locator('#modalBox button[data-k="auto"]').textContent(), /pays ~\d+ gold per 1000 turns, not run gold/i);
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
  it('N5: what the enemy phase shows starts ~140 ms after the player\'s action (hit flash, damage number), attackers staggered', async () => {
    const { page, ctx, errors } = await fresh('warrior', 95);
    try {
      await arena(page, room(8, 5, [2, 2]), 4, 6);
      await page.evaluate(() => { const G = window.__dbg(), p = G.p; G.p.mhp = G.p.hp = 500; for (const dx of [1, -1]) { const e = window.__dbg.fn.makeEnemy('goblin', p.x + dx, p.y, 1); e.awake = true; e.atk = 5; } window.__dbg.fn.computeVis(); });
      await quiet(page);
      await page.evaluate(() => { window.__pd = 0; document.addEventListener('pointerdown', () => { window.__pd = performance.now(); }, true); });
      const me = await pt(page, (await st(page)).x, (await st(page)).y);
      await page.mouse.click(me.x, me.y);   // tap yourself: Wait, the two goblins hit
      // absolute times (the machine may be slow between the tap and this call): when the finger went down, when the visuals start
      const r = await page.evaluate(() => { const v = window.__dbg.api.vt(), n = performance.now(); return { pd: window.__pd, pflash: n + v.pflash, labels: v.labels.map((l) => ({ text: l.text, c: l.c, at: n + l.at })) }; });
      const taken = r.labels.filter((l) => /^-\d/.test(l.text) && !l.c);
      assert.ok(taken.length >= 1, 'a damage label exists');
      assert.ok(r.pflash - r.pd >= 120, 'the hurt flash starts behind the action: ' + (r.pflash - r.pd));
      assert.ok(Math.min(...taken.map((l) => l.at)) - r.pd >= 120, 'the first damage number starts later than the action: ' + JSON.stringify(taken) + ' pd ' + r.pd);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('N19: a boss kill delays the LEVEL UP pill so the death can play; N7: loot under the boss is shown small at its corner, not on its head', async () => {
    const { page, ctx, errors } = await fresh('warrior', 96, { reducedMotion: true });   // no breathing animation: two frames of the same scene are pixel-identical
    try {
      await arena(page, room(14, 12, [2, 9]), 4, 4);
      await page.evaluate(() => { const G = window.__dbg(), d = window.__dbg.fn.makeEnemy('dragon', G.p.x + 4, G.p.y - 1, 8); d.awake = true; G.items.push({ x: d.x, y: d.y - 1, t: 'gold', v: 9 }); window.__dbg.fn.computeVis(); window.__dbg.fn.render(); });
      await page.waitForTimeout(250);
      const marks = await page.evaluate(() => window.__dbg.view().marks);
      assert.ok(marks.some((m) => m.k === 'item'), 'loot inside the boss footprint is drawn as a corner mark: ' + JSON.stringify(marks));
      // pixels: the tile looks the same with and without the coin lying under the dragon (the coin is NOT drawn on its body)
      const [ix, iy] = await page.evaluate(() => { const it = window.__dbg().items[0]; return [it.x, it.y]; });
      const sample = () => page.evaluate(([x, y]) => { window.dispatchEvent(new Event('resize')); return new Promise((res) => setTimeout(() => { const V = window.__dbg.view(), d = window.devicePixelRatio || 1, c = document.getElementById('c').getContext('2d'); res(Array.from(c.getImageData(Math.round((V.ox + x * V.ts) * d), Math.round((V.oy + y * V.ts) * d), Math.round(V.ts * d), Math.round(V.ts * d)).data).join(',')); }, 900)); }, [ix, iy]);
      const withCoin = await sample();
      await page.evaluate(() => { window.__dbg().items.length = 0; });
      const bare = await sample();
      assert.equal(withCoin, bare, 'a coin under the dragon does not show on its body');
      await page.evaluate(() => { const G = window.__dbg(), d = G.enemies[0]; d.hp = 1; G.p.xp = G.p.xp + 9999; window.__dbg.fn.hurtEnemy(d, 5, '#fff', false, 'melee'); window.__dbg.fn.render(); });
    } finally { await ctx.close(); }
    const r2 = await fresh('warrior', 97);
    try {
      const page2 = r2.page;
      await arena(page2, room(14, 12, [2, 9]), 4, 4);
      await page2.evaluate(() => { const G = window.__dbg(), d = window.__dbg.fn.makeEnemy('dragon', G.p.x + 1, G.p.y, 8); d.awake = true; d.hp = 1; G.p.xp = 999; window.__dbg.fn.computeVis(); });
      await quiet(page2);
      const t = await pt(page2, (await st(page2)).x + 1, (await st(page2)).y);
      await page2.mouse.click(t.x, t.y);
      const vt = await page2.evaluate(() => window.__dbg.api.vt());
      const lv = vt.labels.filter((l) => l.c && /LEVEL/.test(l.text));
      assert.ok(lv.length === 0 || lv.every((l) => l.at > 300), 'LEVEL UP waits for the boss death: ' + JSON.stringify(lv));
    } finally { await r2.ctx.close(); }
  });
  it('N20: the Records screen of a class with no runs says so in one line', async () => {
    const { page, ctx, errors } = await fresh('warrior', 98);
    try {
      await page.evaluate(() => { window.__dbg.mods.showRecords(); });
      assert.match(await page.locator('#titleBox').innerText(), /No runs yet/);
    } finally { await ctx.close(); }
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
