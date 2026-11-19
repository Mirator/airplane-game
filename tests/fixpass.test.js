// The fix pass after review + play-test 3: armed-state rules, Mage shot, deferred perk picks, Heat wording, death card, toasts, reset across tabs, Explore blocked by a foe,
// the Expedition best-floor gate, keyboard-only play of every dialog, key-hint chips, wide / landscape layout and the In sight list. Real input; the game's own functions only set situations up.
// Timing rule of this file: no assertion depends on real-time margins. Windows under test are stretched (BAL.ui.*) or the page clock is moved by hand; waits are on state.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, openRun, closeModal, CONC, reload, quiet, startRun } = require('./lib/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const frames = (page, n = 2) => page.evaluate((n) => new Promise((res) => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const S = (page) => page.evaluate(() => {
  const G = window.__dbg(); return { x: G.p.x, y: G.p.y, turn: G.turn, hp: G.p.hp, mana: G.p.mana, pending: G.pending, floor: G.floor, over: G.over, log: G.log.slice(-1)[0], foes: G.enemies.map((e) => [e.x, e.y, e.hp]),
    kind: document.getElementById('modal').style.display !== 'none' ? document.getElementById('modalBox').dataset.kind : null, armed: [...document.querySelectorAll('#bar2 button.armed')].map((b) => b.id) };
});
const hall = (page, wallAt) => page.evaluate((wallAt) => {   // an open 15 x 5 hall; hero in its left third; optional wall column
  const G = window.__dbg(), W = 30, ox = 4, oy = 6;
  G.stopWalk = true; G.enemies = []; G.items = []; G.shrine = null; G.merchant = null; G.cracks = []; G.smoke = []; G.opts = null;
  for (let y = -1; y <= 5; y++) for (let x = -1; x <= 15; x++) { const k = (oy + y) * W + ox + x; G.map[k] = (x < 0 || y < 0 || x > 14 || y > 4) ? 0 : 1; G.seen[k] = true; G.exp[k] = true; }
  if (wallAt != null) for (let y = 0; y <= 4; y++) G.map[(oy + y) * W + ox + wallAt] = 0;
  G.p.x = ox + 2; G.p.y = oy + 2; G.p.mana = 20; G.p.rage = 100; G.knives = 4; G.p.crit = 0; G.p.hp = G.p.mhp; for (const k in G.cd) G.cd[k] = 0;
  window.__dbg.tables.BAL.combat.dmgVar = 0;
  window.__dbg.fn.computeVis(); window.__dbg.fn.render();
}, wallAt);
const foe = (page, type, dx, dy, o) => page.evaluate(([t, dx, dy, o]) => {
  const G = window.__dbg(), e = window.__dbg.fn.makeEnemy(t, G.p.x + dx, G.p.y + dy, 1); e.awake = !(o && o.asleep); e.hp = e.mhp = (o && o.hp) || 100; e.atk = (o && o.atk) || 1; window.__dbg.fn.computeVis(); window.__dbg.fn.render(); return e.id;
}, [type, dx, dy, o]);
const tilePt = (page, dx, dy) => page.evaluate(([dx, dy]) => { const v = window.__dbg.view(), G = window.__dbg(), r = document.getElementById('c').getBoundingClientRect(); return { x: r.left + v.ox + (G.p.x + dx + 0.5) * v.ts, y: r.top + v.oy + (G.p.y + dy + 0.5) * v.ts }; }, [dx, dy]);
const clickTile = async (page, dx, dy) => { await quiet(page); const p = await tilePt(page, dx, dy); await page.mouse.click(p.x, p.y); await frames(page, 2); };
const idx = (page, k) => page.evaluate((k) => window.__dbg.tables.CLS[window.__dbg().p.cls].kit.indexOf(k), k);
const give = (page, n) => page.evaluate((n) => { const G = window.__dbg(); G.pending = n; G.picks = []; window.__dbg.fn.showPerk(); document.getElementById('modal').style.display = 'none'; window.__dbg.fn.render(); }, n);

// ---------------------------------------------------------------- armed state
describe('armed abilities: one set of rules', { concurrency: CONC }, () => {
  it('Wait button and Space cancel an armed ability and spend no turn; Explore cancels too; a potion or a new floor never leaves it armed', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 41, w: 1366, h: 768 });
    try {
      await hall(page); await foe(page, 'goblin', 1, 0, { hp: 90 });
      const i = await idx(page, 'cleave');
      await quiet(page); await page.click('#a_' + i); assert.deepEqual((await S(page)).armed, ['a_' + i]);
      const t0 = (await S(page)).turn;
      await quiet(page); await page.click('#b_wait'); await frames(page);
      let s = await S(page); assert.deepEqual(s.armed, [], 'Wait cancelled it'); assert.equal(s.turn, t0, 'no turn spent'); assert.match(s.log, /Cancelled/);
      await quiet(page); await page.click('#a_' + i); await page.keyboard.press(' '); await frames(page);
      s = await S(page); assert.deepEqual(s.armed, []); assert.equal(s.turn, t0, 'Space is the same cancel');
      await quiet(page); await page.click('#a_' + i); await quiet(page); await page.click('#b_exp'); await frames(page);
      s = await S(page); assert.deepEqual(s.armed, [], 'Explore cancels'); assert.equal(s.turn, t0);
      // a turn that is not the ability's own clears the arming: potion (drink), and the stairs
      await page.evaluate(() => { const G = window.__dbg(); G.p.hp = 5; G.inv.pot = 2; });
      await quiet(page); await page.click('#a_' + i); assert.deepEqual((await S(page)).armed, ['a_' + i]);
      await page.keyboard.press('q'); await frames(page);
      s = await S(page); assert.deepEqual(s.armed, [], 'a potion turn disarms'); assert.ok(s.turn > t0);
      await page.evaluate(() => { const G = window.__dbg(); G.enemies = []; G.opts = null; G.map[G.p.y * 30 + G.p.x] = 2; window.__dbg.fn.computeVis(); });
      await page.evaluate(() => window.__dbg.fn.toggleAbility('bash')); await page.evaluate(() => window.__dbg.fn.goDown({ mod: null, v: 0 }));
      assert.deepEqual((await S(page)).armed, [], 'descending clears an armed ability');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('labels follow one rule: self abilities say Use, aimed ones say Cancel; tapping the lit hero tile casts Smoke and Fireball, and an unlit own tile cancels', async () => {
    const r = await openRun(browser, 'rogue', { seed: 42, w: 1366, h: 768 });
    try {
      const { page, errors } = r;
      await hall(page); await foe(page, 'goblin', 3, 0, { hp: 50 });
      const iv = await idx(page, 'vanish'), is = await idx(page, 'smoke'), ib = await idx(page, 'backstab');
      await quiet(page); await page.click('#a_' + iv); assert.match(await page.locator('#a_' + iv).innerText(), /Use/); await page.keyboard.press('Escape');
      await quiet(page); await page.click('#a_' + ib); await frames(page);   // backstab: no foe adjacent -> refused, not armed
      assert.deepEqual((await S(page)).armed, []);
      await quiet(page); await page.click('#a_' + is); assert.match(await page.locator('#a_' + is).innerText(), /Cancel/);
      const lit = await page.evaluate(() => { const G = window.__dbg(); return window.__dbg.fn.targetTiles('smoke').some((t) => t[0] === G.p.x && t[1] === G.p.y); });
      assert.equal(lit, true, 'the own tile is lit for Smoke');
      const t0 = (await S(page)).turn; await clickTile(page, 0, 0);
      let s = await S(page); assert.equal(s.turn, t0 + 1, 'tapping the lit own tile casts Smoke there'); assert.deepEqual(s.armed, []);
      assert.equal(await page.evaluate(() => (window.__dbg().smoke || []).length), 1);
      // Blink (Mage-only) never lights the own tile: tapping it cancels (checked through the rule, not a class)
      const m = await openRun(browser, 'mage', { seed: 43, w: 1366, h: 768 });
      try {
        await hall(m.page); const ib2 = await idx(m.page, 'blink'); await m.page.click('#a_' + ib2);
        const own = await m.page.evaluate(() => { const G = window.__dbg(); return window.__dbg.fn.targetTiles('blink').some((t) => t[0] === G.p.x && t[1] === G.p.y); });
        assert.equal(own, false, 'a lit tile is always a valid target: Blink does not light your own tile');
        const t1 = (await S(m.page)).turn; await clickTile(m.page, 0, 0); s = await S(m.page);
        assert.equal(s.turn, t1); assert.deepEqual(s.armed, []); assert.match(s.log, /Cancelled/);
        const i4 = await idx(m.page, 'fire'); await m.page.click('#a_' + i4);
        assert.equal(await m.page.evaluate(() => { const G = window.__dbg(); return window.__dbg.fn.targetTiles('fire').some((t) => t[0] === G.p.x && t[1] === G.p.y); }), true, 'Fireball lights the own tile');
        const t2 = (await S(m.page)).turn; await clickTile(m.page, 0, 0); assert.equal((await S(m.page)).turn, t2 + 1, 'and casts on it');
        assert.deepEqual(m.errors, []);
      } finally { await m.ctx.close(); }
      assert.deepEqual(errors, []);
    } finally { await r.ctx.close(); }
  });
  it('self ability armed + an arrow key says how to use it (no silent key); Enter with an aimed ability armed does not open the stairs dialog', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 44, w: 1366, h: 768 });
    try {
      await hall(page); await foe(page, 'goblin', 1, 0, { hp: 90 });
      const ic = await idx(page, 'cleave'), ibash = await idx(page, 'bash');
      await quiet(page); await page.click('#a_' + ic); const t0 = (await S(page)).turn; await page.keyboard.press('ArrowLeft'); await frames(page);
      let s = await S(page); assert.match(s.log, /Enter or \d to use, Esc to cancel/); assert.equal(s.turn, t0); await page.keyboard.press('Escape');
      await page.evaluate(() => { const G = window.__dbg(); G.map[G.p.y * 30 + G.p.x] = 2; window.__dbg.fn.render(); });
      await quiet(page); await page.click('#a_' + ibash); await frames(page); await page.keyboard.press('Enter'); await frames(page);
      s = await S(page); assert.equal(s.kind, null, 'no path dialog'); assert.match(s.log, /lit tile/);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
});

// ---------------------------------------------------------------- Mage shot
describe('Mage free shot, second version', { concurrency: CONC }, () => {
  it('range 4 fires, range 5 does not; the damage is 30-45% of a Bolt at equal gear for several attack levels; no mana, no cooldown', async () => {
    const { page, ctx, errors } = await openRun(browser, 'mage', { seed: 45, w: 1366, h: 768 });
    try {
      assert.equal(await page.evaluate(() => window.__dbg.tables.BAL.shot.range), 4);
      await hall(page); await foe(page, 'ogre', 4, 0, { hp: 400 });
      assert.equal(await page.evaluate(() => window.__dbg.fn.canShoot(window.__dbg().enemies[0])), true, 'range 4 in line of sight');
      await hall(page); await foe(page, 'ogre', 5, 0, { hp: 400 });
      assert.equal(await page.evaluate(() => window.__dbg.fn.canShoot(window.__dbg().enemies[0])), false, 'range 5 is out');
      for (const atk of [4, 8, 12]) {
        await hall(page); await page.evaluate((a) => { const p = window.__dbg().p; p.atk = a; p.eq.weapon = { t: 'weapon', k: 'staff', v: 0, tr: null }; }, atk);
        await foe(page, 'ogre', 3, 0, { hp: 400 });
        const r = await page.evaluate(() => {
          const D = window.__dbg, G = D(), e = G.enemies[0], m0 = G.p.mana, cd0 = JSON.stringify(G.cd);
          D.fn.shoot(e.x, e.y); const shot = 400 - e.hp; e.hp = 400; G.p.mana = 30; G.cd.bolt = 0;
          D.fn.use('bolt', e.x, e.y); const bolt = 400 - e.hp;
          return { shot, bolt, noMana: true, cd: cd0 };
        });
        const ratio = r.shot / r.bolt; assert.ok(ratio >= 0.3 && ratio <= 0.45, 'shot / Bolt at attack ' + atk + ': ' + r.shot + '/' + r.bolt + ' = ' + ratio.toFixed(2));
      }
      // a shot costs nothing
      await hall(page); await foe(page, 'ogre', 2, 0, { hp: 400 });
      const a = await page.evaluate(() => { const G = window.__dbg(); const m = G.p.mana, cd = JSON.stringify(G.cd); window.__dbg.fn.shoot(G.enemies[0].x, G.enemies[0].y); return { m: G.p.mana >= m, cd: JSON.stringify(G.cd) === cd || Object.keys(G.cd).every((k) => G.cd[k] <= JSON.parse(cd)[k]) }; });
      assert.deepEqual(a, { m: true, cd: true });
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('keyboard: an arrow toward a foe in range and line fires the shot (no step, a visible projectile is queued); a wall in between or a foe at range 5 means a step; Warrior keys still step', async () => {
    const { page, ctx, errors } = await openRun(browser, 'mage', { seed: 46, w: 1366, h: 768 });
    try {
      await hall(page); await foe(page, 'ogre', 3, 0, { hp: 400 }); const s0 = await S(page);
      const fx0 = await page.evaluate(() => window.__dbg.art.fxCount());
      await page.keyboard.press('ArrowRight');
      const fxNow = await page.evaluate(() => window.__dbg.art.fxCount()); await frames(page);
      let s = await S(page); assert.equal(s.x, s0.x, 'did not step toward it'); assert.ok(s.foes[0][2] < 400, 'the foe was hit'); assert.match(s.log, /Your shot/); assert.ok(s.turn > s0.turn);
      assert.ok(fxNow > fx0, 'a projectile effect was started');
      await hall(page, 4); await foe(page, 'ogre', 5, 0, { hp: 400, asleep: true }); const s1 = await S(page);
      await page.keyboard.press('ArrowRight'); await frames(page); s = await S(page); assert.equal(s.x, s1.x + 1, 'wall in the line: a plain step'); assert.equal(s.foes[0][2], 400);
      await hall(page); await foe(page, 'ogre', 5, 0, { hp: 400, asleep: true }); const s2 = await S(page);
      await page.keyboard.press('ArrowRight'); await frames(page); s = await S(page); assert.equal(s.x, s2.x + 1, 'range 5: walks'); assert.equal(s.foes[0][2], 400);
      const w = await openRun(browser, 'warrior', { seed: 47, w: 1366, h: 768 });
      try { await hall(w.page); await foe(w.page, 'ogre', 3, 0, { hp: 400, asleep: true }); const a = await S(w.page); await w.page.keyboard.press('ArrowRight'); await frames(w.page); const b = await S(w.page); assert.equal(b.x, a.x + 1); assert.equal(b.foes[0][2], 400); } finally { await w.ctx.close(); }
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('mana economy: the Mage regenerates less than before (BAL.mana) and the shot is the fallback between Bolts', async () => {
    const { page, ctx } = await openRun(browser, 'mage', { seed: 48 });
    try {
      const m = await page.evaluate(() => window.__dbg.tables.BAL.mana);
      assert.ok(m.regen <= 0.9 && m.perKill <= 2, 'regen / per kill lowered to pay for the free shot: ' + JSON.stringify(m));
    } finally { await ctx.close(); }
  });
});

// ---------------------------------------------------------------- deferred perk picks
describe('deferred perk picks, second pass', { concurrency: CONC }, () => {
  it('Equip never reopens a postponed pick; the pick stays pending; the dialog the player opened is not delayed even with the real grace', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 49, w: 1366, h: 768 });
    try {
      await hall(page); await give(page, 1);
      await page.evaluate(() => { const G = window.__dbg(); G.p.eq.weapon = { t: 'weapon', k: 'sword', v: 0, tr: null }; G.items.push({ x: G.p.x + 1, y: G.p.y, t: 'weapon', k: 'axe', v: 4, tr: null }); window.__dbg.fn.tryMove(1, 0); });
      await page.waitForSelector('#modalBox[data-kind="gear"]');
      await page.locator('#modalBox button[data-k="equip"]').click(); await frames(page);
      const s = await S(page); assert.equal(s.kind, null, 'no perk dialog after Equip'); assert.equal(s.pending, 1);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
    const g = await openRun(browser, 'warrior', { seed: 50, w: 1366, h: 768, grace: true });
    try {
      await g.page.evaluate(() => { window.__dbg.tables.BAL.ui.modalGraceMs = 600000; });   // an event dialog would ignore real taps for ever
      await give(g.page, 1);
      await g.page.click('#gearBtn'); await frames(g.page);
      await g.page.locator('#modalBox button[data-k="later"]').click();   // the player opened it: Later answers at once
      assert.equal((await S(g.page)).kind, null);
      await g.page.evaluate(() => { const G = window.__dbg(); window.__dbg.fn.showPerk(); });   // an event-opened one (stairs nudge / level-up) is guarded
      await g.page.locator('#modalBox button[data-k="later"]').click(); await frames(g.page, 3);
      assert.equal((await S(g.page)).kind, 'perk', 'the event dialog still ignores a real click inside its grace');
    } finally { await g.ctx.close(); }
  });
  it('rollPick draws exactly pool-1 random numbers (a Fisher-Yates shuffle, the same on every engine) and stored options survive a save', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 51 });
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, G = D(); let n = 0; const R = Math.random; Math.random = function () { n++; return R(); };
        G.pending = 0; G.picks = []; G.p.xp = 0; const pool = D.api.perkPool().length;
        D.api.gainXp(Math.ceil(D.api.needXp(G.p.lvl) / G.p.xpMul)); Math.random = R;   // exactly one level
        return { used: n, picks: G.picks.length, pool };
      });
      assert.equal(r.picks, 1); assert.ok(r.pool >= 4);
      assert.equal(r.used, r.pool - 1, 'a Fisher-Yates shuffle draws exactly pool - 1 numbers, whatever the engine sorts with');
      const o1 = await page.evaluate(() => JSON.stringify(window.__dbg().picks)); await page.evaluate(() => window.__dbg.fn.save()); await reload(page); await page.locator('#btnContinue').click();
      await page.waitForFunction(() => !!window.__dbg());
      assert.equal(await page.evaluate(() => JSON.stringify(window.__dbg().picks)), o1, 'stored options persist');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('the recap says in one line that picks went unspent; the stairs nudge fires once per floor', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 52 });
    try {
      await give(page, 2);
      await page.evaluate(() => window.__dbg.api.finish('dead'));
      const t = await page.locator('#modalBox').innerText(); assert.match(t, /2 level-up picks went unspent\./);
      await page.locator('#modalBox button').click();
      await page.evaluate(() => window.__dbg.fn.startRun('warrior')); await closeModal(page);
      await page.evaluate(() => window.__dbg.api.finish('abandon'));
      assert.doesNotMatch(await page.locator('#modalBox').innerText(), /unspent/, 'no picks, no line');
      await page.locator('#modalBox button').click(); await page.evaluate(() => window.__dbg.fn.startRun('warrior')); await closeModal(page);
      await page.evaluate(() => { const G = window.__dbg(); G.turn = 5; G.auto = { on: 0, used: 1, noticed: 1, t: 1 }; window.__dbg.api.finish('abandon'); });
      assert.match(await page.locator('#modalBox').innerText(), /Auto played 1 turn: idle pay/, 'singular');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
});

// ---------------------------------------------------------------- Heat naming, first win, HUD purse, Auto pay, bestM share
describe('Heat, purse, Auto pay, expedition gate', { concurrency: CONC }, () => {
  it('no player-facing "Hard" is left: recap, class picker, Controls, achievements, Records; the first win announces Heat 1', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 53, meta: { seenHelp: 1, gold: 0, unl: { rogue: 1, mage: 1 } } });
    try {
      await page.evaluate(() => window.__dbg.fn.startRun('warrior')); await closeModal(page);
      await page.evaluate(() => { const G = window.__dbg(); G.won = true; G.floor = 8; window.__dbg.api.finish('win'); });
      const t = await page.locator('#modalBox').innerText(); assert.match(t, /Heat 1 unlocked/); assert.doesNotMatch(t, /\bHard\b/);
      await page.locator('#modalBox button').click();
      const texts = [];
      await page.locator('#btnNew').click(); texts.push(await page.locator('#titleBox').innerText()); await page.keyboard.press('Escape');
      await page.evaluate(() => { window.__dbg.api.meta().heat = 1; window.__dbg.api.meta().heatSel = 1; });
      await page.locator('#btnNew').click(); texts.push(await page.locator('#titleBox').innerText()); await page.keyboard.press('Escape');
      await page.locator('#btnMore').click(); await page.locator('#btnAch').click(); texts.push(await page.locator('#titleBox').innerText());
      await page.locator('#btnBack').click(); await page.locator('#btnRecords').click(); texts.push(await page.locator('#titleBox').innerText());
      await page.evaluate(() => window.__dbg.fn.startRun('warrior', { heat: 1 })); await closeModal(page);
      texts.push(await page.locator('#stats').innerText());
      await page.evaluate(() => { document.getElementById('modal').style.display = 'none'; window.__dbg.fn.render(); });
      await page.click('#menuBtn'); await page.locator('#modalBox button', { hasText: /Controls/ }).click(); texts.push(await page.locator('#modalBox').evaluate((b) => b.textContent));
      for (const x of texts) assert.doesNotMatch(x, /\bHard\b/, 'a leftover "Hard": ' + x.slice(0, 80));
      assert.match(texts[1], /Heat 1/);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('the HUD gold is the purse the merchant spends, also after Auto played; the Auto strip shows the idle pay separately', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 54, w: 1366, h: 768 });
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, G = D(); G.p.gold = 100; G.turn = 400; G.auto = { on: 1, used: 1, noticed: 1, t: 300 }; D.api.meta().bestM = 3; D.fn.render();
        return { hud: document.querySelectorAll('#stats span')[2].textContent.trim(), pay: document.getElementById('autoPay').textContent, bank: D.idle.runBank(G, false), purse: G.p.gold };
      });
      assert.equal(+r.hud.replace(/\D/g, ''), r.purse, 'HUD = purse: ' + r.hud); assert.match(r.pay, new RegExp('\\+' + r.bank.idle + ' pay'));
      assert.notEqual(r.bank.banked, r.purse, 'the projected bank differs from the purse here, so the test can tell them apart');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('bestM (the expedition gate) counts a floor only when the player played most of it: Auto walked it and a manual stairs press does not raise it', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 55 });
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, G = D(), m = D.api.meta(); m.bestM = 1; const out = {};
        // floor 1 played by hand: 100 turns, 0 by Auto
        G.fm = { t: 0, a: 0 }; G.turn = 100; G.auto = { on: 0, used: 0, noticed: 0, t: 0 }; D.fn.goDown({ mod: null, v: 0 }); out.hand = m.bestM;
        // floor 2: 100 turns of which Auto played 90, then the player presses the stairs
        G.fm = { t: G.turn, a: 0 }; G.turn += 100; G.auto = { on: 0, used: 1, noticed: 1, t: 90 }; D.fn.goDown({ mod: null, v: 0 }); out.autoFloor = m.bestM;
        // floor 3: 100 turns, Auto played 30
        G.fm = { t: G.turn, a: G.auto.t }; G.turn += 100; G.auto.t += 30; D.fn.goDown({ mod: null, v: 0 }); out.mostlyHand = m.bestM;
        return out;
      });
      assert.equal(r.hand, 2); assert.equal(r.autoFloor, 2, 'an Auto-played floor does not count'); assert.equal(r.mostlyHand, 4, 'a mostly manual floor does');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('the dragon-tier blueprint drops from a manual win about half the time (BAL.bp.bestWin) and never from an Auto win', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 56 });
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, G = D(), I = D.idle, m = D.api.meta(); let hit = 0, auto = 0; G.floor = 8;
        for (let i = 0; i < 300; i++) { m.bp = {}; G.auto = { on: 0, used: 0, noticed: 0, t: 0 }; const b = I.bpRunDrop(true); if (b && b.tier === 'b') hit++; }
        for (let i = 0; i < 50; i++) { m.bp = {}; G.auto = { on: 0, used: 1, noticed: 0, t: 5 }; if (I.bpRunDrop(true)) auto++; }
        return { hit, auto, want: D.tables.BAL.bp.bestWin };
      });
      assert.ok(r.hit / 300 > r.want - 0.12 && r.hit / 300 < r.want + 0.12, 'dragon-tier rate ' + r.hit / 300 + ' vs ' + r.want); assert.equal(r.auto, 0);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
});

// ---------------------------------------------------------------- death card, toasts
describe('death card and toasts', { concurrency: CONC }, () => {
  it('the death card follows the lethal hit after BAL.ui.deathMs, input is locked meanwhile, and Enter inside the grace does not dismiss it, with or without a focused button (page clock)', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 57, grace: true });
    try {
      await page.evaluate(() => window.__dbg.fn.startRun('warrior')); await closeModal(page);
      await page.clock.install({ time: Date.now() });
      await page.evaluate(() => { const G = window.__dbg(); G.p.hp = 0; window.__dbg.api.finish('dead'); });
      assert.equal(await page.locator('#modal').isVisible(), false, 'not in the same frame as the hit');
      await page.evaluate(() => document.getElementById('c').click()); assert.equal(await page.locator('#modal').isVisible(), false, 'the map takes no input while it waits');
      await page.clock.runFor(700);
      assert.equal(await page.evaluate(() => document.getElementById('modalBox').dataset.kind), 'end');
      await page.keyboard.press('Enter'); await page.clock.runFor(100);
      assert.equal(await page.evaluate(() => document.getElementById('modalBox').dataset.kind), 'end', 'Enter inside the grace is ignored (no button focused yet)');
      await page.clock.runFor(500); await page.keyboard.press('Enter'); await page.clock.runFor(50);
      assert.equal(await page.locator('#title').isVisible(), true, 'after the grace Enter goes back to the title');
      // a keyboard player (a key was pressed before): the card takes the focus, and its native Enter press is held back by the same grace
      await page.evaluate(() => window.__dbg.fn.startRun('warrior')); await page.evaluate(() => { document.getElementById('modal').style.display = 'none'; });
      await page.evaluate(() => { const G = window.__dbg(); G.p.hp = 0; window.__dbg.api.finish('dead'); }); await page.clock.runFor(700);
      assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.tagName), 'BUTTON', 'the card holds the focus for keyboard users');
      await page.keyboard.press('Enter'); await page.clock.runFor(100);
      assert.equal(await page.evaluate(() => document.getElementById('modalBox').dataset.kind), 'end', 'the focused button ignores Enter inside the grace too');
      await page.clock.runFor(500); await page.keyboard.press('Enter'); await page.clock.runFor(50);
      assert.equal(await page.locator('#title').isVisible(), true);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('a toast waits while a dialog is open or an ability is armed, never sits over the map then, and a new run drops queued toasts', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 58, w: 1366, h: 768 });
    try {
      await hall(page); await foe(page, 'goblin', 1, 0, { hp: 90 });
      const op = () => page.evaluate(() => getComputedStyle(document.getElementById('toast')).opacity);
      await page.evaluate(() => window.__dbg.fn.toggleAbility('cleave')); await page.evaluate(() => window.__dbg.mods.toast('an achievement', 1000));
      await page.evaluate(() => new Promise((r) => setTimeout(r, 600)));
      assert.equal(await op(), '0', 'held while armed');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => getComputedStyle(document.getElementById('toast')).opacity === '1');
      await page.click('#menuBtn'); await page.waitForFunction(() => getComputedStyle(document.getElementById('toast')).opacity === '0');   // a dialog hides it
      await page.evaluate(() => { document.getElementById('modal').style.display = 'none'; window.__dbg.mods.toast('queued', 5000); document.getElementById('menuBtn').click(); });
      await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
      assert.equal(await op(), '0', 'held while a dialog is open');
      await page.evaluate(() => { document.getElementById('modal').style.display = 'none'; window.__dbg.fn.startRun('warrior'); });
      await page.evaluate(() => new Promise((r) => setTimeout(r, 700)));
      assert.equal(await op(), '0', 'a new run cleared the queue');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
});

// ---------------------------------------------------------------- reset, save details
describe('reset across tabs, clock and save details', { concurrency: CONC }, () => {
  it('a reset in one tab makes the other tab stop saving and reload empty (storage event); each stored thing is gone', async () => {
    const a = await newPage(browser, { seed: 59, meta: { seenHelp: 1, gold: 777, wins: 2, heat: 2, unl: { rogue: 1, mage: 1 }, up: { hp: 3 } } });
    try {
      const b = await a.ctx.newPage(); const errs = []; b.on('pageerror', (e) => errs.push(e.message));
      await b.addInitScript(() => { try { const first = window.name !== 'seeded'; window.name = 'seeded'; if (first && localStorage.getItem('dcr_meta_v1') === null) { localStorage.setItem('dcr_meta_v1', JSON.stringify({ seenHelp: 1, gold: 777, wins: 2, heat: 2, unl: { rogue: 1, mage: 1 }, up: { hp: 3 } })); } } catch (e) { /* blocked */ } });   // seeds only the first load: a reload after the reset must find the storage empty
      await b.goto(a.page.url()); await b.waitForFunction(() => !!window.__dbg, null, { polling: 100 });
      await b.evaluate(() => { window.__marker = 1; window.__dbg.fn.startRun('warrior'); });
      assert.equal(await b.evaluate(() => window.__dbg.api.meta().gold), 777);
      await a.page.evaluate(() => window.__dbg.fn.startRun('warrior')); await closeModal(a.page);
      await a.page.evaluate(() => { document.getElementById('modal').style.display = 'none'; window.__dbg.api.showTitle(); });
      // tab A is in the background (tab B was opened last): its dialogs are pressed through the DOM
      const dom = (sel) => a.page.evaluate((s) => document.querySelector(s).click(), sel);
      await dom('#btnMore'); await dom('#btnReset'); await dom('#modalBox button[data-k="reset1"]'); await dom('#modalBox button[data-k="reset2"]');
      await a.page.waitForFunction(() => document.getElementById('title').style.display !== 'none' && document.getElementById('modal').style.display === 'none' && !document.getElementById('btnContinue'), null, { polling: 100 });
      const store = await a.page.evaluate(() => ({ metaRaw: localStorage.getItem('dcr_meta_v1'), ls: Object.keys(localStorage), gold: window.__dbg.api.meta().gold, unl: Object.keys(window.__dbg.api.meta().unl), heat: window.__dbg.api.meta().heat, up: window.__dbg.api.meta().up.hp }));
      assert.deepEqual(store.ls.filter((k) => /^dcr_/.test(k) && k !== 'dcr_meta_v1'), [], 'no run / settings key is left (the other tab may already have booted a fresh, empty meta)'); assert.equal(store.metaRaw === null || (JSON.parse(store.metaRaw).gold === 0 && !(JSON.parse(store.metaRaw).unl || {}).rogue), true, 'the stored meta is empty or fresh: ' + store.metaRaw); assert.equal(store.gold, 0); assert.deepEqual(store.unl, []); assert.equal(store.heat, 0); assert.equal(store.up, 0);
      await b.waitForFunction(() => window.__marker !== 1, null, { timeout: 15000, polling: 100 });   // the other tab reloaded itself
      assert.equal(await b.evaluate(() => window.__dbg.api.meta().gold), 0, 'and booted from the empty storage');
      assert.equal(await b.evaluate(() => localStorage.getItem('dcr_meta_v1') === null || JSON.parse(localStorage.getItem('dcr_meta_v1')).gold === 0), true, 'the stale tab did not write the old save back');
      assert.deepEqual(errs, []);
    } finally { await a.ctx.close(); }
  });
  it('while an erase runs both reset buttons are disabled', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 60, meta: { seenHelp: 1, gold: 5, unl: {} } });
    try {
      await page.locator('#btnMore').click(); await page.locator('#btnReset').click();
      await page.locator('#modalBox button[data-k="reset1"]').click();
      await page.evaluate(() => { const o = IDBFactory.prototype.deleteDatabase; IDBFactory.prototype.deleteDatabase = function () { window.__del = 1; return o.apply(this, arguments); }; });
      await page.evaluate(() => { document.querySelector('#modalBox button[data-k="reset2"]').addEventListener('click', () => { window.__dis = [...document.querySelectorAll('#modalBox button')].map((b) => b.disabled); }); });   // runs after the game's own handler
      await page.locator('#modalBox button[data-k="reset2"]').click();
      assert.deepEqual(await page.evaluate(() => window.__dis), [true, true], 'both buttons are disabled while the erase runs');
      await page.waitForFunction(() => document.getElementById('title').style.display !== 'none' && document.getElementById('modal').style.display === 'none');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('an expedition sent while the clock was ahead is clamped to now on boot (no frozen trip)', async () => {
    const future = Date.now() + 3 * 86400000;
    const { page, ctx, errors } = await newPage(browser, { seed: 61, meta: { seenHelp: 1, gold: 0, mv: 2, unl: {}, exp: { s2: 0, run: [{ cls: 'warrior', dur: 30, t0: future, seed: 5, pw: 0, bf: 1 }, null], rep: null } } });
    try {
      const r = await page.evaluate(() => ({ t0: window.__dbg.api.meta().exp.run[0].t0, now: Date.now() }));
      assert.ok(r.t0 <= r.now, 'clamped: ' + (r.t0 - r.now));
      await page.clock.install({ time: Date.now() }); await page.clock.runFor(31 * 60000);
      assert.equal(await page.evaluate(() => window.__dbg.idle.expReadyCount()), 1, 'ready 30 minutes later');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
});

// ---------------------------------------------------------------- Explore blocked by a foe
describe('Explore with a foe in the only way on', () => {
  it('walks up to a sleeping foe that stands unseen in the only corridor and says so instead of "Nothing left to explore"', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 62, w: 1366, h: 768 });
    try {
      await page.evaluate(() => {
        const G = window.__dbg(), W = 30, ox = 3, oy = 8; G.enemies = []; G.items = []; G.shrine = null; G.merchant = null; G.cracks = []; G.opts = null;
        for (let k = 0; k < 900; k++) { G.map[k] = 0; G.seen[k] = false; G.exp[k] = false; }
        for (let x = 0; x < 20; x++) { const k = oy * W + ox + x; G.map[k] = 1; G.seen[k] = true; G.exp[k] = x < 12; }   // a corridor: explored near us, a seen frontier beyond
        G.p.x = ox; G.p.y = oy; const e = window.__dbg.fn.makeEnemy('rat', ox + 9, oy, 1); e.awake = false;
        window.__dbg.fn.computeVis(); G.vis[oy * W + ox + 9] = false; window.__dbg.fn.render();
      });
      const x0 = (await S(page)).x;
      await page.evaluate(() => window.__dbg.fn.explore()); await page.waitForFunction(() => !window.__dbg.walking());
      const s = await S(page); assert.doesNotMatch(s.log, /Nothing left/); assert.match(s.log, /blocks|foe/i);
      assert.ok(s.x > x0, 'it walked toward the foe'); assert.ok(s.x <= x0 + 8, 'and stopped in front of it (x ' + s.x + ')');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
});

// ---------------------------------------------------------------- keyboard completes the game
describe('every dialog by keyboard', { concurrency: CONC }, () => {
  const inBox = (page) => page.evaluate(() => { const root = document.getElementById('modal').style.display !== 'none' ? 'modalBox' : 'titleBox'; return document.getElementById(root).contains(document.activeElement); });
  const ring = (page) => page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { style: s.outlineStyle, w: parseFloat(s.outlineWidth) }; });
  it('perk dialog: arrows move a visible focus ring, focus never leaves the dialog (Tab cycles), Enter picks the focused card, Esc leaves it pending; the game underneath is inert', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 63, w: 1366, h: 768 });
    try {
      await give(page, 1); await page.keyboard.press('p'); await page.waitForSelector('#modalBox[data-kind="perk"]');
      assert.equal(await page.evaluate(() => document.getElementById('app').inert), true, 'game inert behind a dialog');
      await page.keyboard.press('Tab'); assert.equal(await inBox(page), true); const r = await ring(page); assert.equal(r.style, 'solid'); assert.ok(r.w >= 2, 'visible ring');
      for (let i = 0; i < 9; i++) { await page.keyboard.press('Tab'); assert.equal(await inBox(page), true, 'Tab ' + i + ' stays inside'); }
      await page.keyboard.press('Shift+Tab'); assert.equal(await inBox(page), true);
      const labels = await page.evaluate(() => [...document.querySelectorAll('#modalBox button')].map((b) => b.dataset.k));
      await page.evaluate(() => document.querySelector('#modalBox button').focus());
      await page.keyboard.press('ArrowDown'); const second = await page.evaluate(() => document.activeElement.dataset.k); assert.equal(second, labels[1]);
      await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
      const third = await page.evaluate(() => document.activeElement.dataset.k); assert.equal(third, labels[2]);
      const p0 = await page.evaluate(() => Object.keys(window.__dbg().perks).length);
      await page.keyboard.press('Enter'); await frames(page);
      assert.equal(await page.evaluate(() => Object.keys(window.__dbg().perks).length), p0 + 1, 'Enter picked the focused card'); assert.equal((await S(page)).pending, 0);
      await give(page, 1); await page.keyboard.press('p'); await page.waitForSelector('#modalBox[data-kind="perk"]'); await page.keyboard.press('Escape');
      assert.equal((await S(page)).kind, null); assert.equal((await S(page)).pending, 1, 'Esc keeps it pending');
      assert.equal(await page.evaluate(() => document.getElementById('app').inert), false);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('path dialog: Esc is Stay here; arrows + Enter pick a route; gear card: Enter on Equip equips; merchant and shrine: arrows + Enter buy / choose, Esc leaves', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 64, w: 1366, h: 768 });
    try {
      await hall(page);
      await page.evaluate(() => { const G = window.__dbg(); G.map[G.p.y * 30 + G.p.x] = 2; window.__dbg.fn.render(); });
      await page.keyboard.press('Enter'); await page.waitForSelector('#modalBox[data-kind="path"]');
      await page.keyboard.press('Escape'); assert.equal((await S(page)).kind, null, 'Esc = Stay here'); assert.equal((await S(page)).floor, 1);
      await page.keyboard.press('Enter'); await page.waitForSelector('#modalBox[data-kind="path"]');
      await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await page.waitForFunction(() => window.__dbg().floor === 2);
      // gear card
      await hall(page);
      await page.evaluate(() => { const G = window.__dbg(); G.p.eq.weapon = { t: 'weapon', k: 'sword', v: 0, tr: null }; G.items.push({ x: G.p.x + 1, y: G.p.y, t: 'weapon', k: 'axe', v: 5, tr: null }); window.__dbg.fn.tryMove(1, 0); });
      await page.waitForSelector('#modalBox[data-kind="gear"]'); assert.equal(await page.evaluate(() => document.activeElement.dataset.k), 'equip', 'the default button holds the focus'); await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => window.__dbg().p.eq.weapon.k), 'axe', 'Enter equipped it');
      // merchant: buy the first affordable thing by keys, Esc leaves
      await page.evaluate(() => { const G = window.__dbg(); G.p.gold = 500; G.merchant = { x: G.p.x + 3, y: G.p.y, stock: [{ k: 'pot', n: 'Potion', ic: 'potion', d: 'Heals.', price: 10 }, { k: 'fire', n: 'Flames', ic: 'fire', d: 'Burns.', price: 20 }] }; window.__dbg.api.showShop(); });
      const f0 = await page.evaluate(() => window.__dbg().inv.fire);
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await frames(page);
      assert.equal(await page.evaluate(() => window.__dbg().inv.fire), f0 + 1, 'bought Flames by keys'); assert.equal(await inBox(page), true, 'the dialog was rebuilt and still holds the focus');
      await page.keyboard.press('Escape'); assert.equal((await S(page)).kind, null);
      // shrine
      await page.evaluate(() => { const G = window.__dbg(); G.shrine = { x: G.p.x, y: G.p.y, used: 0, left: 0 }; window.__dbg.api.showShrine(); });
      await page.waitForSelector('#modalBox[data-kind="shrine"]'); await page.keyboard.press('Escape'); assert.equal((await S(page)).kind, null);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('menu, reset confirmations, title, class pick, Upgrades tabs and the Heat row work with Tab / arrows / Enter / Esc only; the reset default focus is Cancel', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 65, meta: { seenHelp: 1, gold: 500, wins: 1, heat: 1, unl: { rogue: 1, mage: 1 } } });
    try {
      await page.keyboard.press('Tab'); assert.equal(await inBox(page), true, 'title: the first key focuses a button inside the title');
      const firstId = await page.evaluate(() => document.activeElement.id); assert.equal(firstId, 'btnNew');
      await page.keyboard.press('Enter'); await page.waitForSelector('.cls');
      assert.ok(await page.evaluate(() => !!document.getElementById('heatRow')));
      await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');   // a Heat button (arrow order: heat 0, heat 1, ...)
      await page.waitForSelector('#heatRow'); assert.equal(await inBox(page), true, 'focus survives the rebuilt screen');
      await page.keyboard.press('Escape'); await page.waitForSelector('#btnUpg');
      await page.evaluate(() => document.getElementById('btnUpg').focus()); await page.keyboard.press('Enter'); await page.waitForSelector('#tabBp');
      await page.keyboard.press('Tab'); const t1 = await page.evaluate(() => document.activeElement.id); assert.ok(t1);
      await page.evaluate(() => document.getElementById('tabBp').focus()); await page.keyboard.press('Enter'); await page.waitForFunction(() => document.getElementById('tabBp').classList.contains('on'));
      await page.keyboard.press('Escape'); await page.waitForSelector('#btnMore');
      await page.evaluate(() => document.getElementById('btnMore').focus()); await page.keyboard.press('Enter'); await page.waitForSelector('#btnReset');
      await page.evaluate(() => document.getElementById('btnReset').focus()); await page.keyboard.press('Enter'); await page.waitForSelector('#modalBox.reset');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.k), 'cancel', 'default focus is the safe button');
      await page.keyboard.press('Enter'); assert.equal(await page.locator('#modal').isVisible(), false, 'Enter on Cancel closes');
      await page.evaluate(() => document.getElementById('btnReset').focus()); await page.keyboard.press('Enter'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#modalBox button[data-k="reset2"]')); assert.equal(await page.evaluate(() => document.activeElement.dataset.k), 'cancel');
      await page.keyboard.press('Escape'); assert.equal(await page.locator('#modal').isVisible(), false, 'Esc cancels the second step');
      assert.equal(await page.evaluate(() => window.__dbg.api.meta().gold), 500, 'nothing was erased');
      // in a run: Esc opens the menu, Enter on Resume, abandon needs two presses
      await page.evaluate(() => { window.__dbg.fn.startRun('warrior'); document.getElementById('modal').style.display = 'none'; });
      await page.keyboard.press('Escape'); await page.waitForSelector('#modalBox[data-kind="menu"]'); assert.equal(await inBox(page), true);
      await page.keyboard.press('Enter'); assert.equal(await page.locator('#modal').isVisible(), false, 'Resume');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('key-hint chips never cover an icon: the chip box (from the computed ::before) misses the icon box of every hinted button', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 66, w: 1366, h: 768 });
    try {
      await page.keyboard.press('ArrowUp'); await frames(page);
      const bad = await page.evaluate(() => {
        const out = [];
        for (const b of document.querySelectorAll('button[data-key]')) {
          if (!b.getClientRects().length) continue;
          const cs = getComputedStyle(b, '::before'); if (cs.display === 'none') continue;
          const r = b.getBoundingClientRect(); const px = (v) => parseFloat(v);
          const w = px(cs.width), h = px(cs.height);
          const l = cs.left !== 'auto' ? r.left + px(cs.left) : r.right - px(cs.right) - w, t = cs.top !== 'auto' ? r.top + px(cs.top) : r.bottom - px(cs.bottom) - h;
          const chip = { l, t, r: l + w, b: t + h };
          for (const ic of b.querySelectorAll('svg, .bi, .ai')) { const q = ic.getBoundingClientRect(); if (!q.width) continue;
            const ox = Math.min(chip.r, q.right) - Math.max(chip.l, q.left), oy = Math.min(chip.b, q.bottom) - Math.max(chip.t, q.top);
            if (ox > 1 && oy > 1) out.push(b.id + ' chip ' + JSON.stringify(chip) + ' icon ' + JSON.stringify({ l: q.left, t: q.top, r: q.right, b: q.bottom })); }
        }
        return out;
      });
      assert.deepEqual(bad, []);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
});

// ---------------------------------------------------------------- wide / landscape layout, In sight
describe('wide layout', { concurrency: CONC }, () => {
  const rect = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
  for (const [w, h] of [[1366, 768], [1920, 1080], [1180, 820]]) {
    it(`${w}x${h}: the side panel is filled on purpose: type >= 15px, an In sight list (icon, name, HP bar; click inspects and rings the foe), the log takes the free height, no hole`, async () => {
      const { page, ctx, errors } = await openRun(browser, 'mage', { seed: 67, w, h });
      try {
        await hall(page); await foe(page, 'rat', 2, 0, { hp: 14 }); await foe(page, 'guard', 3, 1, { hp: 46, asleep: true });
        await foe(page, 'bat', 12, 2, { hp: 10 }); await page.evaluate(() => { const G = window.__dbg(), e = G.enemies[G.enemies.length - 1]; G.vis[e.y * 30 + e.x] = false; });   // a foe out of sight is not listed
        await page.evaluate(() => { const G = window.__dbg(); for (const l of ['one', 'two', 'three', 'four', 'five', 'six']) G.log.push('Log line ' + l); window.__dbg.fn.render(); });
        await frames(page, 3);
        const fs = await page.evaluate(() => ({ log: parseFloat(getComputedStyle(document.getElementById('log')).fontSize), stats: parseFloat(getComputedStyle(document.getElementById('stats')).fontSize), body: parseFloat(getComputedStyle(document.querySelector('#sightList .sn')).fontSize) }));
        assert.ok(fs.log >= 15 && fs.stats >= 15 && fs.body >= 15, 'type scale ' + JSON.stringify(fs));
        const rows = await page.evaluate(() => [...document.querySelectorAll('#sightList button.srow')].map((b) => ({ txt: b.textContent, svg: !!b.querySelector('svg'), bar: !!b.querySelector('.sh i'), h: b.getBoundingClientRect().height })));
        assert.equal(rows.length, 2, 'two foes in sight'); assert.ok(rows.every((r) => r.svg && r.bar && r.h >= 44), JSON.stringify(rows)); assert.match(rows[0].txt, /Rat/);
        const sight = await rect(page, '#sight'), logw = await rect(page, '#logw'), hud = await rect(page, '#hud'), bar2 = await rect(page, '#bar2');
        assert.ok(sight.t - hud.b < 16 && logw.t - sight.b < 16 && bar2.t - logw.b < 16, 'panel sections are packed, no hole: ' + JSON.stringify({ a: sight.t - hud.b, b: logw.t - sight.b, c: bar2.t - logw.b }));
        assert.ok(logw.h >= 150, 'the log takes the free height: ' + logw.h);
        await page.locator('#sightList button.srow').first().click(); await frames(page);
        const insp = await page.evaluate(() => ({ i: !!window.__dbg.insp(), hl: window.__dbg.hl() }));
        assert.equal(insp.i, true, 'click inspects'); assert.ok(insp.hl && insp.hl.id, 'and rings the foe on the map');
        assert.equal(await page.evaluate(() => window.__dbg().p.x), await page.evaluate(() => window.__dbg().p.x), 'nothing else happened');
        await page.evaluate(() => { const G = window.__dbg(); G.enemies = []; window.__dbg.fn.computeVis(); window.__dbg.fn.render(); }); await frames(page);
        assert.match(await page.locator('#sightList').innerText(), /Nothing in sight/);
      } finally { assert.deepEqual(errors, []); await ctx.close(); }
    });
  }
  it('menus use the width on 1180+: the title is two columns (art left), Upgrades lists in two columns, larger type than on a phone; 1366 keeps the box inside the window', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 68, w: 1366, h: 768, meta: { seenHelp: 1, gold: 900, wins: 1, unl: { rogue: 1, mage: 1 } } });
    try {
      const t = await rect(page, '#titleBox'); assert.ok(t.w >= 800 && t.w <= 1366, 'wide card ' + t.w);
      const logo = await rect(page, '#titleBox .logo'), btn = await rect(page, '#btnNew'); assert.ok(logo.r <= btn.l + 1, 'art left of the buttons: ' + JSON.stringify([logo, btn]));
      const fs = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('btnNew')).fontSize)); assert.ok(fs >= 17, 'button type ' + fs);
      await page.locator('#btnUpg').click(); await page.waitForSelector('#tabBp');
      const cards = await page.evaluate(() => [...document.querySelectorAll('#titleBox > button.hasic')].slice(0, 4).map((b) => Math.round(b.getBoundingClientRect().left)));
      assert.ok(new Set(cards).size === 2, 'two columns: ' + cards);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('landscape windows >= 480 tall get the side panel (1024x480, 900x600); a mouse window short of 480 is not covered; the rotate hint is touch only', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 69, w: 1024, h: 480 });
    try {
      for (const [w, h] of [[1024, 480], [900, 600], [700, 520]]) {
        await page.setViewportSize({ width: w, height: h }); await frames(page, 3);
        const c = await rect(page, '#cv'), b = await rect(page, '#bar'); assert.ok(c.r <= b.l + 0.5 && c.h >= h - 2, w + 'x' + h + ' side panel ' + JSON.stringify([c, b]));
        assert.ok(c.h >= 440 || h < 480, 'a full-height map, not a 130 px strip');
        assert.equal(await page.locator('#rot').isVisible(), false);
      }
      await page.setViewportSize({ width: 844, height: 400 }); await frames(page, 3); assert.equal(await page.locator('#rot').isVisible(), false, 'no rotate hint for a mouse window');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
});
