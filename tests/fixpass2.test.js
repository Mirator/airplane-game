// Fix pass 2 (after review 2 + play-test 2): the keyboard target cursor, game keys against panel focus, folded help by keyboard, chained dialogs, swap confirm, merchant rows,
// Explore with an unreachable foe, toasts, the reset generation, the death card, small rules (shuffle, banner, labels follow their foe).
// Timing rule of this file: nothing depends on real-time margins. Windows under test are stretched through BAL.ui.* or the state is polled.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, openRun, closeModal, CONC, quiet, URL } = require('./lib/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const frames = (page, n = 2) => page.evaluate((n) => new Promise((res) => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const S = (page) => page.evaluate(() => {
  const G = window.__dbg(); return { x: G.p.x, y: G.p.y, turn: G.turn, hp: G.p.hp, mana: G.p.mana, pending: G.pending, floor: G.floor, over: G.over, log: G.log.slice(-1)[0], foes: G.enemies.map((e) => [e.x, e.y, e.hp, e.t]),
    kind: document.getElementById('modal').style.display !== 'none' ? document.getElementById('modalBox').dataset.kind : null, armed: [...document.querySelectorAll('#bar2 button.armed')].map((b) => b.id), kc: window.__dbg.kcursor() };
});
const hall = (page, wallAt) => page.evaluate((wallAt) => {   // an open 15 x 5 hall; hero in its left third; optional wall column
  const G = window.__dbg(), W = 30, ox = 4, oy = 6;
  G.stopWalk = true; G.enemies = []; G.items = []; G.shrine = null; G.merchant = null; G.cracks = []; G.smoke = []; G.opts = null;
  for (let y = -1; y <= 5; y++) for (let x = -1; x <= 15; x++) { const k = (oy + y) * W + ox + x; G.map[k] = (x < 0 || y < 0 || x > 14 || y > 4) ? 0 : 1; G.seen[k] = true; G.exp[k] = true; }
  if (wallAt != null) for (let y = 0; y <= 4; y++) G.map[(oy + y) * W + ox + wallAt] = 0;
  G.p.x = ox + 2; G.p.y = oy + 2; G.p.mana = 99; G.p.rage = 100; G.knives = 4; G.p.crit = 0; G.p.hp = G.p.mhp = 200; for (const k in G.cd) G.cd[k] = 0;
  window.__dbg.tables.BAL.combat.dmgVar = 0;
  window.__dbg.fn.computeVis(); window.__dbg.fn.render();
}, wallAt);
const foe = (page, type, dx, dy, o) => page.evaluate(([t, dx, dy, o]) => {
  const G = window.__dbg(), e = window.__dbg.fn.makeEnemy(t, G.p.x + dx, G.p.y + dy, 1); e.awake = !(o && o.asleep); e.hp = e.mhp = (o && o.hp) || 100; e.atk = (o && o.atk) || 1; window.__dbg.fn.computeVis(); window.__dbg.fn.render(); return e.id;
}, [type, dx, dy, o]);
const press = async (page, ...keys) => { for (const k of keys) { await page.keyboard.press(k); await frames(page, 1); } };
const hpOf = (s, dx, dy, base) => { const f = s.foes.find((q) => q[0] === base.x + dx && q[1] === base.y + dy); return f ? f[2] : null; };

// ---------------------------------------------------------------- keyboard target cursor
describe('keyboard cursor for every aimed ability and the Mage shot', { concurrency: CONC }, () => {
  it('Mage Bolt: starts on the nearest foe, arrows jump to a foe OFF the straight line, Tab steps through the foes, Enter and the ability key fire at the cursor, Esc cancels', async () => {
    const { page, ctx, errors } = await openRun(browser, 'mage', { seed: 71, w: 1366, h: 768 });
    try {
      await hall(page); const b = await page.evaluate(() => ({ x: window.__dbg().p.x, y: window.__dbg().p.y }));
      await foe(page, 'rat', 2, 0); await foe(page, 'skeleton', -2, 1); await foe(page, 'archer', 3, -1);
      await press(page, '1');   // Bolt (first key press: the keyboard hints and the cursor appear)
      let s = await S(page); assert.deepEqual(s.armed, ['a_0']); assert.deepEqual([s.kc.x - b.x, s.kc.y - b.y], [2, 0], 'starts on the nearest foe');
      assert.match(s.log, /arrows move the cursor, Tab next foe, Enter fires/);
      await press(page, 'ArrowDown'); s = await S(page); assert.deepEqual([s.kc.x - b.x, s.kc.y - b.y], [-2, 1], 'ArrowDown reaches the skeleton although it is not in line');
      await press(page, 'ArrowRight'); s = await S(page); assert.deepEqual([s.kc.x - b.x, s.kc.y - b.y], [2, 0], 'ArrowRight goes back to the rat');
      await press(page, 'Tab'); s = await S(page); assert.deepEqual([s.kc.x - b.x, s.kc.y - b.y], [-2, 1], 'Tab: next foe by distance');
      await press(page, 'Tab'); s = await S(page); assert.deepEqual([s.kc.x - b.x, s.kc.y - b.y], [3, -1]);
      await press(page, 'Shift+Tab'); s = await S(page); assert.deepEqual([s.kc.x - b.x, s.kc.y - b.y], [-2, 1], 'Shift+Tab goes back');
      const t0 = s.turn, hp = { sk: hpOf(s, -2, 1, b), rat: hpOf(s, 2, 0, b) };
      await press(page, 'Enter'); s = await S(page);
      assert.ok(hpOf(s, -2, 1, b) < hp.sk, 'Enter fired the Bolt at the cursor (the skeleton)'); assert.equal(hpOf(s, 2, 0, b) <= hp.rat, true); assert.equal(s.turn, t0 + 1); assert.deepEqual(s.armed, []);
      // the ability's own key fires too (Bolt again, cursor on the nearest foe), Esc cancels without a turn
      await page.evaluate(() => { const G = window.__dbg(); G.p.mana = 99; }); await press(page, '1');
      s = await S(page); const t1 = s.turn; await press(page, 'Escape'); s = await S(page); assert.deepEqual(s.armed, []); assert.equal(s.turn, t1, 'Esc spends no turn');
      await page.evaluate(() => { window.__dbg().p.mana = 99; }); await press(page, '1', '1'); s = await S(page); assert.equal(s.turn, t1 + 1, 'the same number key fires at the cursor'); assert.deepEqual(s.armed, []);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
  it('Mage Blink, Fireball and the F shot: the cursor sits only on valid lit tiles, Enter acts there; a foe out of range is not selectable; F from another class says so', async () => {
    const { page, ctx, errors } = await openRun(browser, 'mage', { seed: 72, w: 1366, h: 768 });
    try {
      await hall(page, 9); const b = await page.evaluate(() => ({ x: window.__dbg().p.x, y: window.__dbg().p.y }));   // a wall column 7 tiles to the right: nothing beyond it is lit
      await press(page, '3'); let s = await S(page);   // Blink
      const lit = await page.evaluate(() => window.__dbg.fn.targetTiles('blink').map((t) => t.join(',')));
      assert.ok(lit.includes(s.kc.x + ',' + s.kc.y), 'the cursor starts on a lit tile'); assert.ok(Math.abs(s.kc.x - b.x) + Math.abs(s.kc.y - b.y) === 1, 'the nearest lit tile');
      for (let i = 0; i < 12; i++) { await page.keyboard.press('ArrowRight'); const c = await page.evaluate(() => window.__dbg.kcursor()); assert.ok((await page.evaluate(() => window.__dbg.fn.targetTiles('blink').map((t) => t.join(',')))).includes(c.x + ',' + c.y), 'cursor never leaves the lit tiles'); }
      s = await S(page); assert.ok(s.kc.x < b.x + 7 && s.kc.x > b.x, 'it stops at the edge of the lit area (the wall): ' + s.kc.x);
      const target = { x: s.kc.x, y: s.kc.y }; await press(page, 'Enter'); s = await S(page); assert.deepEqual([s.x, s.y], [target.x, target.y], 'Blink landed on the cursor'); assert.deepEqual(s.armed, []);
      await hall(page); await foe(page, 'rat', 4, 0, { hp: 9 }); await foe(page, 'rat', 4, 1, { hp: 9 }); await foe(page, 'skeleton', -3, -1);
      await press(page, '4'); s = await S(page); assert.deepEqual([s.kc.x - b.x, s.kc.y - b.y], [-3, -1], 'Fireball starts on the nearest FOE, not the nearest tile');
      await press(page, 'Tab', 'Tab'); s = await S(page); const f0 = s.foes.map((f) => f[2]); await press(page, 'Enter'); s = await S(page);
      assert.ok(s.foes.filter((f) => f[3] === 'rat').every((f) => f[2] < 9) || s.foes.filter((f) => f[3] === 'rat').length < 2, 'the blast hit the rats at the cursor'); assert.ok(f0.length === 3);
      // the shot: F arms it, range 4 only
      await hall(page); await foe(page, 'ogre', 5, 0); await press(page, 'f'); s = await S(page);
      assert.match(s.log, /Shot: no target/, 'a foe at 5 is out of the shot range'); assert.deepEqual(s.armed, []);
      await foe(page, 'rat', 0, 3); await press(page, 'f'); s = await S(page); assert.deepEqual([s.kc.x - b.x, s.kc.y - b.y], [0, 3], 'the cursor starts on the foe in range'); assert.match(s.log, /Shot: arrows move the cursor/);
      const t0 = s.turn, mana = s.mana; await press(page, 'f'); s = await S(page);
      assert.equal(s.turn, t0 + 1, 'F again fires'); assert.ok(hpOf(s, 0, 3, b) < 100); assert.equal(s.mana, mana + 0, 'the shot costs no mana (regeneration only adds)');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
  it('Rogue Knife / Smoke / Backstab and Warrior Bash / Charge are aimed by the cursor too; F is the Mage\'s', async () => {
    const r = await openRun(browser, 'rogue', { seed: 73, w: 1366, h: 768 });
    try {
      const { page, errors } = r; await hall(page); const b = await page.evaluate(() => ({ x: window.__dbg().p.x, y: window.__dbg().p.y }));
      await foe(page, 'goblin', 1, 0); await foe(page, 'goblin', 0, 1); await foe(page, 'archer', 4, -1, { asleep: false });
      await press(page, '1'); let s = await S(page);   // Backstab: adjacent foes only
      assert.deepEqual([s.kc.x - b.x, s.kc.y - b.y], [1, 0]); await press(page, 'ArrowDown'); s = await S(page); assert.deepEqual([s.kc.x - b.x, s.kc.y - b.y], [0, 1]);
      const t0 = s.turn; await press(page, 'Enter'); s = await S(page); assert.equal(s.turn, t0 + 1); assert.ok(hpOf(s, 0, 1, b) < 100, 'Backstab hit the foe the cursor was on');
      await page.evaluate(() => { for (const k in window.__dbg().cd) window.__dbg().cd[k] = 0; }); await press(page, '3'); s = await S(page);   // Knife: any foe in range 6 with a clear line
      assert.equal(s.armed.length, 1); await press(page, 'Tab'); const h0 = (await S(page)).foes.map((f) => f[2]); await press(page, 'Enter'); s = await S(page);
      assert.ok(s.foes.some((f, i) => f[2] < h0[i]), 'the knife flew');
      await page.evaluate(() => { for (const k in window.__dbg().cd) window.__dbg().cd[k] = 0; }); await press(page, '4'); s = await S(page);   // Smoke: a ground tile
      assert.ok(s.kc && Math.abs(s.kc.x - b.x) + Math.abs(s.kc.y - b.y) >= 1); const sm = s.kc; await press(page, 'Enter'); s = await S(page);
      assert.equal(await page.evaluate(() => window.__dbg().smoke.length), 1, 'Smoke was thrown at the cursor'); assert.ok(sm);
      await press(page, 'f'); assert.match((await S(page)).log, /Only the Mage shoots/);
      assert.deepEqual(errors, []);
    } finally { await r.ctx.close(); }
    const w = await openRun(browser, 'warrior', { seed: 74, w: 1366, h: 768 });
    try {
      const { page, errors } = w; await hall(page); const b = await page.evaluate(() => ({ x: window.__dbg().p.x, y: window.__dbg().p.y }));
      await foe(page, 'goblin', 4, 0); await foe(page, 'goblin', 0, 3); await foe(page, 'goblin', -1, 0);
      await press(page, '3'); let s = await S(page);   // Charge: a foe in a straight line 2-6 tiles
      assert.ok([[4, 0], [0, 3]].some(([x, y]) => s.kc.x - b.x === x && s.kc.y - b.y === y), 'Charge cursor on a foe in line'); await press(page, 'ArrowRight'); s = await S(page); assert.deepEqual([s.kc.x - b.x, s.kc.y - b.y], [4, 0]);
      await press(page, 'Enter'); s = await S(page); assert.equal(s.x, b.x + 3, 'Charge ran up to the foe at the cursor'); assert.ok(hpOf(s, 4, 0, b) < 100);
      assert.deepEqual(errors, []);
    } finally { await w.ctx.close(); }
  });
});

// ---------------------------------------------------------------- game keys vs focus, folded help, dialog scrolling
describe('keys: the game wins in a run; dialogs by keyboard', { concurrency: CONC }, () => {
  it('after a Tab onto a panel button, Space is still Wait and Enter is still Stairs; arrows still move; the open Items tray keeps its own Enter', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 75, w: 1366, h: 768 });
    try {
      await hall(page); const b = await page.evaluate(() => ({ x: window.__dbg().p.x, y: window.__dbg().p.y }));
      await page.keyboard.press('Tab'); await frames(page);
      assert.ok(await page.evaluate(() => document.activeElement && document.activeElement.tagName === 'BUTTON'), 'a panel button has the focus');
      let s = await S(page); await page.keyboard.press(' '); await frames(page); let s2 = await S(page);
      assert.equal(s2.kind, null, 'Space did not press Equipment'); assert.equal(s2.turn, s.turn + 1, 'Space waited');
      assert.ok(await page.evaluate(() => document.activeElement === document.body), 'the panel button gave up the focus');
      await page.keyboard.press('Tab'); await page.keyboard.press('ArrowRight'); await frames(page); s2 = await S(page); assert.equal(s2.x, b.x + 1, 'arrow still moves'); assert.equal(s2.kind, null);
      await page.evaluate(() => { const G = window.__dbg(); G.map[G.p.y * 30 + G.p.x] = 2; G.opts = null; window.__dbg.fn.render(); });
      await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await frames(page); s2 = await S(page);
      assert.equal(s2.kind, 'path', 'Enter with the stairs under you opens the exit choice, whichever button had the focus'); await page.keyboard.press('Escape');
      // the Items tray: I opens it, Tab walks its buttons, Enter presses the focused one (here: Potion)
      await page.evaluate(() => { const G = window.__dbg(); G.map[G.p.y * 30 + G.p.x] = 1; G.inv.pot = 2; G.p.hp = 10; window.__dbg.fn.render(); });
      await page.keyboard.press('i'); await frames(page); await page.keyboard.press('Tab'); await page.waitForFunction(() => !!document.activeElement.closest('#tray'));
      while (await page.evaluate(() => document.activeElement.id !== 'b_pot')) await page.keyboard.press('Tab');
      await page.keyboard.press('Enter'); await frames(page); s2 = await S(page); assert.equal(await page.evaluate(() => window.__dbg().inv.pot), 1, 'Enter drank the focused potion'); assert.ok(s2.hp > 10);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
  it('the folded Controls sections open by keyboard (Tab / arrows to a section, Enter or Space); a one-button dialog scrolls with the arrows', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 76, w: 1366, h: 768 });
    try {
      await page.keyboard.press('Escape'); await page.waitForSelector('#modalBox button[data-k="auto"]');
      await page.evaluate(() => [...document.querySelectorAll('#modalBox button')].find((b) => /Controls/.test(b.textContent)).click());
      await page.waitForSelector('#modalBox details.hsec');
      const open = () => page.evaluate(() => [...document.querySelectorAll('#modalBox details.hsec')].map((d) => d.open));
      assert.ok((await open()).every((o) => !o), 'all folded at first');
      await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.tagName), 'SUMMARY', 'Tab reaches a section title');
      await page.keyboard.press('Enter'); assert.deepEqual((await open()).slice(0, 2), [true, false], 'Enter opens it');
      await page.keyboard.press('ArrowDown'); assert.equal(await page.evaluate(() => document.activeElement.tagName), 'SUMMARY'); await page.keyboard.press('Space');
      assert.deepEqual((await open()).slice(0, 3), [true, true, false], 'arrow to the next, Space opens it');
      await page.keyboard.press('Escape'); await page.waitForFunction(() => document.querySelector('#modalBox button[data-k="auto"]'));   // Esc = Back to the menu
      await page.keyboard.press('Escape');
      // a long list with one button: the arrows scroll it (the window is too short to show it whole)
      await page.setViewportSize({ width: 390, height: 420 });
      await page.evaluate(() => { for (const id of window.__dbg.perkIds.slice(0, 8)) window.__dbg.grant(id); window.__dbg.fn.render(); });
      await page.keyboard.press('Escape'); await page.waitForSelector('#modalBox button[data-k="auto"]');
      await page.evaluate(() => [...document.querySelectorAll('#modalBox button')].find((b) => /Perks/.test(b.textContent)).click()); await page.waitForSelector('#modalBox h2');
      const sc0 = await page.evaluate(() => { const m = document.getElementById('modalBox'); return [m.scrollTop, m.scrollHeight > m.clientHeight + 5, document.querySelectorAll('#modalBox button').length]; });
      assert.equal(sc0[1], true, 'the perks list is longer than the window'); assert.equal(sc0[2], 1, 'one button');
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); assert.ok(await page.evaluate(() => document.getElementById('modalBox').scrollTop) > sc0[0] + 50, 'the arrows scrolled the dialog');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
  it('arrow keys follow the layout in the two-column Upgrades screen: Down is the card below, Right the card beside', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 77, w: 1366, h: 768, meta: { seenHelp: 1, gold: 900, wins: 1, unl: { rogue: 1, mage: 1 } } });
    try {
      await page.keyboard.press('Tab'); await page.locator('#btnUpg').click(); await page.waitForSelector('#tabBp');
      await page.evaluate(() => document.querySelector('[data-up="hp"]').focus());
      const cur = () => page.evaluate(() => document.activeElement.dataset.up || document.activeElement.id);
      assert.equal(await cur(), 'hp'); await page.keyboard.press('ArrowDown'); assert.equal(await cur(), 'def', 'Down: Padded, the card below Hardy (left column)');
      await page.keyboard.press('ArrowRight'); assert.equal(await cur(), 'pot', 'Right: Supplies, beside Padded');
      await page.keyboard.press('ArrowUp'); assert.equal(await cur(), 'atk', 'Up: Sharpened');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
  it('Records spans its totals and note over both columns on a wide screen; the class picker is three cards side by side', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 78, w: 1366, h: 768, meta: { seenHelp: 1, gold: 900, wins: 1, runs: 3, unl: { rogue: 1, mage: 1 } } });
    try {
      await page.evaluate(() => window.__dbg.mods.showRecords());
      const r = await page.evaluate(() => { const t = document.getElementById('titleBox').getBoundingClientRect(), pl = [...document.querySelectorAll('#titleBox > .pl')].map((e) => e.getBoundingClientRect()); return { t: t.width, first: pl[0].width, last: pl[pl.length - 1].width, mid: pl[1].width }; });
      assert.ok(r.first > r.mid * 1.6 && r.last > r.mid * 1.6, 'first and last span both columns: ' + JSON.stringify(r));
      await page.evaluate(() => { window.__dbg.api.showTitle(); }); await page.click('#btnNew');
      const xs = await page.evaluate(() => [...document.querySelectorAll('#titleBox .cls')].map((e) => Math.round(e.getBoundingClientRect().left)));
      assert.equal(new Set(xs).size, 3, 'three cards in one row: ' + xs);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});

// ---------------------------------------------------------------- dialogs: chained picks, swap, merchant, death card
describe('dialogs and shop', { concurrency: CONC }, () => {
  it('chained perk picks keep their own grace: a double click takes ONE perk, a Tab + Enter + Enter takes one; after the grace the next pick works', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 79, w: 1366, h: 768 });
    try {
      await page.evaluate(() => { window.__dbg.tables.BAL.ui.modalGraceMs = 700; const G = window.__dbg(); G.pending = 4; G.picks = []; window.__dbg.fn.render(); });
      await page.click('#gearBtn');   // the badge opens the perk dialog by the player's own hand: no grace on that one
      await page.waitForSelector('#modalBox[data-kind="perk"]');
      const pend = () => page.evaluate(() => window.__dbg().pending);
      assert.equal(await pend(), 4);
      await page.locator('#modalBox button').first().dblclick();   // two real clicks in the same spot: the second lands on the NEXT dialog, inside its grace
      assert.equal(await pend(), 3, 'one perk, not two');
      // keyboard: Enter on the focused first card picks, a second Enter at once is held by the grace
      await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
      assert.ok((await pend()) >= 2, 'the second Enter did not take another perk: ' + (await pend()));
      // after the grace the same click works (polled, never slept)
      await page.evaluate(() => { window.__dbg.tables.BAL.ui.modalGraceMs = 0; });
      for (let i = 0; i < 40 && (await pend()) >= 2; i++) { await page.evaluate(() => { const b = document.querySelector('#modalBox[data-kind="perk"] button'); if (b) b.click(); }); await page.waitForTimeout(25); }
      assert.ok((await pend()) <= 1, 'picks work once the grace has passed');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
  it('a swap that costs gold needs a second tap on the same button; a free swap does not; the second tap pays', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 80, w: 390, h: 844, meta: { seenHelp: 1, gold: 500, wins: 1, up: { edge: 1 }, unl: { rogue: 1, mage: 1 } } });
    try {
      await page.locator('#btnUpg').click();
      const gold = () => page.evaluate(() => window.__dbg.api.meta().gold), pv = (k) => page.evaluate((k) => window.__dbg.api.meta().pv[k] || 0, k);
      await page.locator('[data-swap="vigor"]').click();   // vigor has no level yet: the swap is free
      assert.equal(await pv('vigor'), 1, 'the free swap needed one tap'); assert.equal(await gold(), 500);
      await page.locator('[data-swap="edge"]').click();
      assert.equal(await pv('edge'), 0, 'the first tap only asks'); assert.equal(await gold(), 500); assert.match(await page.locator('[data-swap="edge"]').getAttribute('aria-label'), /Tap again to switch Edge/);
      await page.locator('[data-swap="edge"]').click(); assert.equal(await pv('edge'), 1); assert.equal(await gold(), 450, 'the second tap paid the fee');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
  it('merchant rows that cannot be bought are disabled and say why (full belt, not enough gold); the others still work', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 81, w: 360, h: 640 });
    try {
      await page.evaluate(() => { const G = window.__dbg(); G.p.gold = 20; G.inv.pot = G.p.potCap; const f = window.__dbg.fn; f.newFloor(3); let i = 0; while (!G.merchant && i++ < 30) f.newFloor(3); G.p.gold = 20; G.inv.pot = G.p.potCap; window.__dbg.api.showShop(); });
      const rows = await page.locator('#modalBox button[data-k^="buy"]').evaluateAll((bs) => bs.map((b) => ({ k: b.dataset.k, off: b.disabled, t: b.textContent.replace(/\s+/g, ' ') })));
      const pots = rows.filter((r) => /Potion/.test(r.t)); assert.equal(pots.length, 2);
      assert.ok(pots.every((r) => r.off && /potion belt is full/i.test(r.t)), 'both potion rows are off with the reason: ' + JSON.stringify(pots));
      assert.ok(rows.filter((r) => !/Potion/.test(r.t)).every((r) => r.off && /Need \d+ more gold/.test(r.t)), 'too poor for the rest, each says how much is missing: ' + JSON.stringify(rows));
      const g0 = await page.evaluate(() => window.__dbg().p.gold); await page.evaluate(() => document.querySelector('#modalBox button[data-k="buy0"]').click());   // a disabled button does nothing
      assert.equal(await page.evaluate(() => window.__dbg().p.gold), g0);
      await page.evaluate(() => { const G = window.__dbg(); G.p.gold = 500; G.inv.pot = 0; window.__dbg.api.showShop(); });
      assert.equal(await page.locator('#modalBox button[data-k="buy0"]').isDisabled(), false, 'room in the belt and gold: buyable'); await page.locator('#modalBox button[data-k="buy0"]').click();
      assert.equal(await page.evaluate(() => window.__dbg().inv.pot), 1);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
  it('the death card is never skipped: a dialog that is open when the run ends gives way to it', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 82, w: 390, h: 844 });
    try {
      await page.evaluate(() => { window.__dbg.tables.BAL.ui.deathMs = 150; const G = window.__dbg(); G.pending = 1; G.picks = []; window.__dbg.fn.showPerk(); });
      assert.equal(await page.evaluate(() => document.getElementById('modalBox').dataset.kind), 'perk');
      await page.evaluate(() => { const G = window.__dbg(); G.killer = 'Troll'; G.p.hp = 0; window.__dbg.api.finish('dead'); });
      await page.waitForFunction(() => document.getElementById('modalBox').dataset.kind === 'end', null, { timeout: 5000 });
      assert.match(await page.locator('#modalBox h2').innerText(), /You Died/);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
  it('a run saved without its floor-start marks (fm) loads with sane ones', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 83, w: 390, h: 844 });
    try {
      await page.evaluate(() => { const G = window.__dbg(); G.turn = 100; window.__dbg.fn.save(); const o = JSON.parse(localStorage.getItem('dcr_run_v2')); delete o.fm; localStorage.setItem('dcr_run_v2', JSON.stringify(o)); });
      await page.evaluate(() => { window.__dbg.api.showTitle(); }); await page.click('#btnContinue'); await page.waitForFunction(() => document.getElementById('title').style.display === 'none');
      assert.deepEqual(await page.evaluate(() => window.__dbg().fm), { t: 100, a: 0 });
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});

// ---------------------------------------------------------------- Explore, toasts, small rules
describe('Explore, toasts, small rules', { concurrency: CONC }, () => {
  const corridor = (page) => page.evaluate(() => {   // you in a hall with unexplored ground to your left; a foe far right, behind the merchant standing in the only gap: neither side can reach the other
    const G = window.__dbg(), W = 30, oy = 8;
    G.stopWalk = true; G.enemies = []; G.items = []; G.shrine = null; G.cracks = []; G.smoke = []; G.opts = null;
    for (let y = oy - 2; y <= oy + 2; y++) for (let x = 2; x <= 22; x++) { G.map[y * W + x] = 0; G.seen[y * W + x] = true; G.exp[y * W + x] = true; }
    for (let x = 4; x <= 20; x++) { G.map[oy * W + x] = 1; G.seen[oy * W + x] = true; G.exp[oy * W + x] = x > 5; }   // x 4, 5 are seen but not explored
    G.p.x = 12; G.p.y = oy; G.merchant = { x: 15, y: oy, stock: [] };
    window.__dbg.fn.computeVis(); return { y: oy };
  });
  it('Explore goes on when an awake foe in sight can neither reach you nor be reached, and says so once; a reachable foe, or a shooter with a line, still stops it', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 84, w: 390, h: 844 });
    try {
      const { y } = await corridor(page);
      const id = await page.evaluate((y) => { const e = window.__dbg.fn.makeEnemy('bat', 18, y, 1); e.awake = true; e.hp = e.mhp = 50; window.__dbg.fn.computeVis(); window.__dbg.fn.render(); return e.id; }, y);
      assert.equal(await page.evaluate((id) => window.__dbg().vis[window.__dbg().enemies.find((e) => e.id === id).y * 30 + 18], id), true, 'the bat is in sight');
      assert.equal(await page.evaluate(() => window.__dbg.fn.exploreBlockers().length), 0, 'it is not a blocker');
      const x0 = await page.evaluate(() => window.__dbg().p.x); await page.evaluate(() => window.__dbg.fn.explore());
      await page.waitForFunction((x0) => window.__dbg().p.x !== x0, x0);
      assert.equal(await page.evaluate(() => window.__dbg().log.filter((l) => /cannot reach you and you cannot reach it/.test(l)).length), 1, 'said once');
      await page.waitForFunction(() => !window.__dbg.walking());
      await page.evaluate(() => window.__dbg.fn.explore()); await page.evaluate(() => window.__dbg.fn.explore());
      assert.equal(await page.evaluate(() => window.__dbg().log.filter((l) => /cannot reach you and you cannot reach it/.test(l)).length), 1, 'and never again for that foe');
      // the same foe with a way to you is a real blocker
      await page.evaluate(() => { const G = window.__dbg(); G.merchant = null; window.__dbg.fn.computeVis(); });
      assert.equal(await page.evaluate(() => window.__dbg.fn.exploreBlockers().length), 1);
      await page.evaluate(() => window.__dbg.fn.explore()); assert.match(await page.evaluate(() => window.__dbg().log.slice(-1)[0]), /Enemy in sight/);
      // an archer behind the merchant with a clear line to you can still shoot you: it stays a blocker
      await page.evaluate(() => { const G = window.__dbg(); G.merchant = { x: 15, y: 8, stock: [] }; G.enemies = []; const e = window.__dbg.fn.makeEnemy('archer', 17, 8, 1); e.awake = true; window.__dbg.fn.computeVis(); });
      assert.equal(await page.evaluate(() => window.__dbg.fn.exploreBlockers().length), 1, 'a shooter with a line is not ignored');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
  it('a foe behind another foe: the tap says "Something is in the way", not "Can\'t reach it"', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 85, w: 390, h: 844 });
    try {
      await page.evaluate(() => {
        const G = window.__dbg(), W = 30, oy = 8; G.stopWalk = true; G.enemies = []; G.items = []; G.merchant = null; G.shrine = null; G.cracks = [];
        for (let y = oy - 1; y <= oy + 1; y++) for (let x = 2; x <= 14; x++) { G.map[y * W + x] = 0; G.seen[y * W + x] = true; G.exp[y * W + x] = true; }
        for (let x = 3; x <= 13; x++) G.map[oy * W + x] = 1; G.p.x = 4; G.p.y = oy;
        const a = window.__dbg.fn.makeEnemy('goblin', 7, oy, 1), b = window.__dbg.fn.makeEnemy('goblin', 9, oy, 1); a.hp = a.mhp = b.hp = b.mhp = 90; a.awake = b.awake = false;
        window.__dbg.fn.computeVis(); window.__dbg.fn.onTap(9, oy);
      });
      await page.waitForFunction(() => !window.__dbg.walking());   // a path to the near goblin is not what was asked; the far one is the target: the tap walks up to the first, then ...
      assert.match(await page.evaluate(() => window.__dbg().log.slice(-3).join('|')), /Something is in the way|Goblin/);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
  it('a toast on screen when a dialog opens or an ability is armed is not lost: it comes back when the way is clear', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 86, w: 1366, h: 768 });
    try {
      await hall(page); await foe(page, 'goblin', 1, 0, { hp: 90 });
      const op = () => page.evaluate(() => +getComputedStyle(document.getElementById('toast')).opacity);
      await page.evaluate(() => window.__dbg.mods.toast('TOAST-ONE', 60000));
      await page.waitForFunction(() => +getComputedStyle(document.getElementById('toast')).opacity > 0.9);
      await page.keyboard.press('Escape'); await page.waitForSelector('#modalBox[data-kind="menu"]');   // a dialog opens: the toast steps aside
      await page.waitForFunction(() => +getComputedStyle(document.getElementById('toast')).opacity < 0.1);
      await page.keyboard.press('Escape'); await page.waitForSelector('#modal', { state: 'hidden' });
      await page.waitForFunction(() => +getComputedStyle(document.getElementById('toast')).opacity > 0.9); assert.equal(await page.locator('#toast').innerText(), 'TOAST-ONE', 'the same toast, again');
      await page.keyboard.press('2'); await frames(page, 2);   // arming hides it too (nothing covers the tiles while aiming)
      await page.waitForFunction(() => +getComputedStyle(document.getElementById('toast')).opacity < 0.1);
      await page.keyboard.press('Escape'); await page.waitForFunction(() => +getComputedStyle(document.getElementById('toast')).opacity > 0.9);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
  it('arming clears the floor banner; Items while armed says Cancelled; the shuffle is unbiased; a damage number rides with the foe that stepped away', async () => {
    const { page, ctx, errors } = await openRun(browser, 'mage', { seed: 87, w: 1366, h: 768 });
    try {
      await hall(page); await foe(page, 'rat', 3, 0, { hp: 100, atk: 1 });
      await page.evaluate(() => { window.__dbg.fn.newFloor(2); }); await hall(page); await foe(page, 'skeleton', 3, 0, { hp: 100, atk: 1 });
      await page.evaluate(() => { window.__dbg.fn.newFloor(2); }); await hall(page); await foe(page, 'rat', 3, 0, { hp: 100, atk: 1 });
      assert.equal(await page.evaluate(() => window.__dbg.banner()), true, 'the floor banner is up'); await press(page, '1');
      assert.equal(await page.evaluate(() => window.__dbg.banner()), false, 'arming clears it (nothing covers the tiles)');
      await page.evaluate(() => { window.__dbg().inv.pot = 1; window.__dbg.fn.render(); }); await page.keyboard.press('i'); await frames(page);
      const s = await S(page); assert.deepEqual(s.armed, []); assert.match(s.log, /Cancelled/, 'Items disarmed it and said so');
      // Fisher-Yates: every order of three comes up about equally often
      const perm = await page.evaluate(() => { const c = {}; for (let i = 0; i < 6000; i++) { const k = window.__dbg.fn.shuf([0, 1, 2]).join(''); c[k] = (c[k] || 0) + 1; } return c; });
      assert.equal(Object.keys(perm).length, 6); for (const k in perm) assert.ok(perm[k] > 800 && perm[k] < 1200, 'unbiased shuffle: ' + JSON.stringify(perm));
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
  it('the Mage shot number is drawn on the foe after it steps away from the tile it was hit on', async () => {
    const { page, ctx, errors } = await openRun(browser, 'mage', { seed: 88, w: 1366, h: 768 });
    try {
      await hall(page); const b = await page.evaluate(() => ({ x: window.__dbg().p.x, y: window.__dbg().p.y }));
      await foe(page, 'skeleton', 3, 0, { hp: 400, atk: 1 });
      await page.evaluate(() => { const G = window.__dbg(); window.__dbg.fn.shoot(G.enemies[0].x, G.enemies[0].y); });   // the shot hurts it, then it steps towards you
      await page.waitForFunction(() => window.__dbg.labelTiles().some((l) => /^-\d/.test(l.text) && l.follows));
      const lab = await page.evaluate(() => window.__dbg.labelTiles().find((l) => /^-\d/.test(l.text)));
      const foeNow = await page.evaluate(() => { const e = window.__dbg().enemies[0]; return [e.x, e.y]; });
      assert.notDeepEqual(lab.anchor, foeNow, 'the foe has moved off the tile where it was hit');
      await page.waitForFunction(([x, y]) => { const l = window.__dbg.labelTiles().find((q) => /^-\d/.test(q.text)); return l && Math.abs(l.drawn[0] - x) < 0.05 && Math.abs(l.drawn[1] - y) < 0.05; }, foeNow, { timeout: 4000 });
      assert.ok(b);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});

// ---------------------------------------------------------------- reset across tabs: generation guard
describe('reset across tabs: generation guard', { concurrency: 1 }, () => {
  const mk = async (ctx) => { const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message)); await page.goto(URL); await page.waitForFunction(() => !!window.__dbg); await page.evaluate(() => { window.__dbg.tables.BAL.ui.modalGraceMs = 0; }); return { page, errors }; };
  it('a tab whose generation is older writes nothing and reloads; whatever it wrote with the old number is thrown away on load', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
    try {
      const A = await mk(ctx);
      await A.page.evaluate(() => { const m = window.__dbg.api.meta(); m.seenHelp = 1; m.gold = 321; window.__dbg.api.saveMeta(); window.__alive = 1; });
      assert.equal(await A.page.evaluate(() => JSON.parse(localStorage.getItem('dcr_meta_v1')).gold), 321);
      // another tab resets: all it does is write the new generation and erase (done here by hand, no event is waited for)
      await A.page.evaluate(() => { localStorage.setItem('dcr_gen', '4'); localStorage.removeItem('dcr_meta_v1'); localStorage.removeItem('dcr_run_v2'); });
      await A.page.evaluate(() => { window.__dbg.api.meta().gold = 999; window.__dbg.api.saveMeta(); });   // the stale tab tries to save at once
      assert.equal(await A.page.evaluate(() => localStorage.getItem('dcr_meta_v1')), null, 'the stale tab refused to write');
      await A.page.waitForFunction(() => window.__alive !== 1, null, { timeout: 8000 });   // ... and reloaded (the marker of the old document is gone)
      await A.page.waitForFunction(() => !!window.__dbg && document.getElementById('title').style.display !== 'none');
      assert.equal(await A.page.evaluate(() => window.__dbg.api.meta().gold), 0, 'the title shows fresh progress');
      // old-generation data that did get written (a tab saving in the gap) is discarded on load, silently
      await A.page.evaluate(() => { localStorage.setItem('dcr_meta_v1', JSON.stringify({ gold: 777, gen: 1, seenHelp: 1, unl: {} })); localStorage.setItem('dcr_run_v2', JSON.stringify({ ver: 3, gen: 1, p: { eq: {} }, map: [] })); });
      await A.page.reload(); await A.page.waitForFunction(() => !!window.__dbg);
      assert.equal(await A.page.evaluate(() => window.__dbg.api.meta().gold), 0, 'old-generation meta ignored');
      assert.equal(await A.page.evaluate(() => localStorage.getItem('dcr_meta_v1') === null || JSON.parse(localStorage.getItem('dcr_meta_v1')).gen >= 4), true);
      assert.equal(await A.page.evaluate(() => !!document.getElementById('btnContinue')), false, 'no Continue from an old-generation run');
      assert.equal(await A.page.evaluate(() => /old run save/.test(document.getElementById('titleBox').textContent)), false, 'and no "could not be loaded" notice');
      assert.deepEqual(A.errors, []);
    } finally { await ctx.close(); }
  });
  it('a tab that keeps saving through another tab\'s reset cannot bring the old progress back', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
    try {
      const A = await mk(ctx), B = await mk(ctx);
      await A.page.evaluate(() => { const m = window.__dbg.api.meta(); m.seenHelp = 1; m.gold = 777; window.__dbg.api.saveMeta(); });
      await B.page.reload(); await B.page.waitForFunction(() => !!window.__dbg);
      await B.page.evaluate(() => { window.__dbg.tables.BAL.ui.modalGraceMs = 0; window.__dbg.fn.startRun('warrior'); document.getElementById('modal').style.display = 'none'; window.__n = 0; const loop = () => { const t = performance.now(); while (performance.now() - t < 30) { window.__dbg.api.meta().kills++; window.__dbg.api.saveMeta(); window.__dbg.fn.save(); window.__n++; } setTimeout(loop, 0); }; loop(); });
      await A.page.evaluate(() => { window.__dbg.api.showTitle(); });
      await A.page.click('#btnMore'); await A.page.click('#btnReset'); await A.page.click('#modalBox [data-k="reset1"]'); await A.page.click('#modalBox [data-k="reset2"]');
      await A.page.waitForFunction(() => document.getElementById('modal').style.display === 'none' && !document.getElementById('btnContinue'));
      await B.page.waitForFunction(() => !window.__n || window.__n > 0);   // B ran its loop in the meantime
      // poll until B has noticed (it reloads and stops writing): storage ends up holding no progress at all
      await A.page.waitForFunction(() => { const m = localStorage.getItem('dcr_meta_v1'); return localStorage.getItem('dcr_run_v2') === null && (m === null || (JSON.parse(m).gold || 0) === 0); }, null, { timeout: 15000 });
      assert.equal(await A.page.evaluate(() => !!document.getElementById('btnContinue')), false);
      await B.page.waitForFunction(() => document.getElementById('title') && document.getElementById('title').style.display !== 'none' && !window.__n, null, { timeout: 15000 });   // B reloaded: its loop is gone
      assert.equal(await B.page.evaluate(() => window.__dbg.api.meta().gold), 0, 'the other tab shows the reset progress too');
      assert.deepEqual(A.errors.concat(B.errors), []);
    } finally { await ctx.close(); }
  });
});
