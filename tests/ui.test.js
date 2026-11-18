// UI declutter tests: the Items tray (open, use each item, closes, never covers the map), a bare map, the four-button bottom row, the
// class pick (short taglines, Details behind a tap, Hard mode on this screen) and text-length budgets for the generated texts.
// Every test has its own browser context and runs concurrently with the others.
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
const visible = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[style*="display: none"]'); }).length, sel);
// every sampled point of the map area must belong to the canvas (nothing overlays a tile)
const coveredPoints = (page) => page.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(), bad = []; for (let y = r.top + 6; y < r.bottom; y += 12) for (let x = r.left + 6; x < r.right; x += 12) { const e = document.elementFromPoint(x, y); if (!e || e.id !== 'c') bad.push((e && (e.id || e.className)) + '@' + Math.round(x) + ',' + Math.round(y)); } return bad; });
const trayState = (page) => page.evaluate(() => { const t = document.getElementById('tray'), c = document.getElementById('cv').getBoundingClientRect(), r = t.getBoundingClientRect(); return { open: t.style.display !== 'none', top: r.top, cvBottom: c.bottom, h: r.height, btns: [...t.querySelectorAll('button')].map((b) => { const q = b.getBoundingClientRect(); return { id: b.id, w: q.width, h: q.height }; }) }; });

describe('ui', { concurrency: CONC }, () => {
  it('Items tray: one tap opens it, one tap uses Potion / Flames / Teleport and closes it; the badge shows the total; it never covers the map', async () => {
    const { page, ctx, errors } = await fresh('warrior', 21);
    try {
      await page.evaluate(() => { window.T.setup(7); const G = window.__dbg(); G.inv.pot = 2; G.inv.fire = 1; G.inv.tele = 1; G.p.hp = 5; G.p.mhp = 60; window.__dbg.fn.endTurn(); });
      await quiet(page);
      assert.equal((await trayState(page)).open, false, 'closed by default');
      assert.match(await page.locator('#b_items').textContent(), /Items.*4|4.*Items/s, 'badge = total carried (2+1+1)');
      // the bottom area: 4 ability buttons + exactly 4 large buttons, all >= 44px
      const bar = await page.evaluate(() => [...document.querySelectorAll('#bar button')].map((b) => { const r = b.getBoundingClientRect(); return { id: b.id, w: r.width, h: r.height }; }));
      assert.deepEqual(bar.map((b) => b.id), ['b_items', 'b_exp', 'b_wait', 'b_down']);
      for (const b of bar) assert.ok(b.w >= 60 && b.h >= 56, JSON.stringify(b));
      // open: three buttons, big, in the log strip below the map
      await page.click('#b_items');
      let t = await trayState(page);
      assert.equal(t.open, true); assert.equal(t.btns.length, 3);
      for (const b of t.btns) assert.ok(b.w >= 44 && b.h >= 44, JSON.stringify(b));
      assert.ok(t.top >= t.cvBottom - 0.5, 'the tray starts below the map');
      assert.deepEqual(await coveredPoints(page), [], 'nothing over the map with the tray open');
      // Items again closes it without using anything
      await page.click('#b_items'); assert.equal((await trayState(page)).open, false);
      // Potion
      await page.click('#b_items'); await page.click('#b_pot');
      let s = await page.evaluate(() => { const G = window.__dbg(); return { pot: G.inv.pot, hp: G.p.hp }; });
      assert.equal(s.pot, 1); assert.ok(s.hp > 5, 'healed');
      assert.equal((await trayState(page)).open, false, 'closes after use');
      // Flames (needs an enemy in sight)
      await page.evaluate(() => { window.T.setup(7); const e = window.T.foe('goblin', 3, 0); e.hp = e.mhp = 400; });
      await quiet(page);
      await page.click('#b_items'); await page.click('#b_fire');
      s = await page.evaluate(() => { const G = window.__dbg(); return { fire: G.inv.fire, hp: G.enemies[0].hp }; });
      assert.equal(s.fire, 0); assert.ok(s.hp < 400, 'the scroll burned the goblin');
      assert.equal((await trayState(page)).open, false);
      // Teleport
      await page.evaluate(() => { window.T.setup(7); });
      await quiet(page);
      const p0 = await page.evaluate(() => { const G = window.__dbg(); return [G.p.x, G.p.y]; });
      await page.click('#b_items'); await page.click('#b_tele');
      s = await page.evaluate(() => { const G = window.__dbg(); return { tele: G.inv.tele, p: [G.p.x, G.p.y] }; });
      assert.equal(s.tele, 0); assert.notDeepEqual(s.p, p0, 'moved');
      assert.equal((await trayState(page)).open, false);
      // the tray closes by its own handler, not only through the document-level tap-elsewhere rule (a bare DOM click bubbles with the tray button as target)
      await page.evaluate(() => { const G = window.__dbg(); G.inv.pot = 1; G.p.hp = 3; window.__dbg.fn.endTurn(); });
      await page.click('#b_items');
      await page.evaluate(() => document.getElementById('b_pot').click());
      assert.equal((await trayState(page)).open, false, 'closes after use (own handler)');
      // nothing left: Items says so instead of opening an empty tray
      await page.evaluate(() => { const G = window.__dbg(); G.inv.pot = 0; G.inv.fire = 0; G.inv.tele = 0; window.__dbg.fn.endTurn(); });
      await quiet(page);
      await page.click('#b_items');
      assert.equal((await trayState(page)).open, false);
      assert.match(await page.evaluate(() => window.__dbg().log.slice(-1)[0]), /No items/);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('Items tray vs targeting: arming an ability closes the tray, Items while armed cancels the aim, and nothing covers the map either way', async () => {
    const { page, ctx, errors } = await fresh('mage', 22);
    try {
      await page.evaluate(() => { window.T.setup(7); window.T.foe('goblin', 3, 0); const G = window.__dbg(); G.p.mana = 30; G.inv.pot = 1; G.inv.fire = 1; });
      await quiet(page);
      await page.click('#b_items'); assert.equal((await trayState(page)).open, true);
      await page.click('#a_0');                                                   // Bolt arms: the tray closes
      assert.equal(await page.evaluate(() => document.getElementById('a_0').classList.contains('armed')), true);
      assert.equal((await trayState(page)).open, false, 'arming closes the tray');
      assert.deepEqual(await coveredPoints(page), [], 'nothing over the map while aiming');
      // arming through the game's own function (no tap on the map / another button) closes the tray as well
      await page.evaluate(() => { document.getElementById('b_items').click(); window.__dbg.fn.toggleAbility('bolt'); });
      assert.equal((await trayState(page)).open, false, 'arming closes the tray by itself');
      assert.equal(await page.evaluate(() => document.getElementById('a_0').classList.contains('armed')), true);
      await page.click('#b_items');                                               // Items while armed: aim cancelled, tray opens
      assert.equal(await page.evaluate(() => document.getElementById('a_0').classList.contains('armed')), false);
      assert.equal((await trayState(page)).open, true);
      assert.deepEqual(await coveredPoints(page), [], 'nothing over the map with the tray open');
      // a tap on the map closes the tray (the tap itself still works as a tap)
      const box = await page.locator('#c').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      assert.equal((await trayState(page)).open, false, 'a tap elsewhere closes it');
      // aim again with the tray state fixed: still bare
      await quiet(page);
      await page.click('#a_0');
      assert.deepEqual(await coveredPoints(page), []);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('the map is bare: no buttons on it without a modifier, one small icon with one; Daily / Hard / Auto never sit on it; ? lives in the menu', async () => {
    const { page, ctx, errors } = await fresh('rogue', 23);
    try {
      assert.equal(await page.locator('#cv button').count(), 0, 'no buttons on the map');
      assert.equal(await page.locator('#helpBtn').count(), 0, 'no ? button in the top bar');
      await page.evaluate(() => { const G = window.__dbg(); G.mod = 'dark'; G.daily = '2026-01-01'; G.hard = 1; window.__dbg.fn.endTurn(); });
      await quiet(page);
      const chips = await page.locator('#cv button').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, t: b.textContent }; }));
      assert.equal(chips.length, 1, 'one modifier icon');
      assert.ok(chips[0].w >= 44 && chips[0].h >= 44 && chips[0].w <= 56, JSON.stringify(chips));
      assert.ok(chips[0].t.length <= 3, 'icon only: ' + chips[0].t);
      // the top bar: HP, resource, gear, menu; floor, level, gold, tags
      const stats = await page.locator('#stats').textContent();
      assert.match(stats, /🏰/); assert.match(stats, /💰/); assert.doesNotMatch(stats, /⚔️|🛡/, 'attack / defense moved to the gear screen');
      await page.click('#gearBtn');
      const eq = await page.locator('#modalBox .stripe').textContent();
      assert.match(eq, /⚔️ \d+/); assert.match(eq, /🛡 \d+/); assert.match(eq, /Lv \d+/);
      await page.locator('#modalBox button', { hasText: /^Back$/ }).click();
      // the menu has Controls (one tap deeper than the old ? button)
      await page.click('#menuBtn');
      assert.ok(await page.locator('#modalBox button', { hasText: /Controls/ }).count());
      assert.ok(await page.locator('#modalBox button[data-k="auto"]').count());
      assert.ok((await page.locator('#modalBox button').count()) <= 6, 'menu has at most six buttons');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('class pick: icon + name + one short line + four ability icons per card; Details behind a tap; Hard mode here; every class still starts a run', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 24, meta: { seenHelp: 1, gold: 0, wins: 1, best: 8, unl: { rogue: 1, mage: 1 } } });
    try {
      // the title: Continue/New dominate, no Hard box, no stat lines
      const tb = await page.locator('#titleBox button').evaluateAll((bs) => bs.map((b) => b.textContent.trim()));
      assert.ok(tb.length <= 5, 'few buttons on the title: ' + JSON.stringify(tb));
      assert.equal(await page.locator('#titleBox #hardBtn').count(), 0);
      assert.ok((await page.locator('#titleBox').innerText()).split(/\s+/).length <= 25, 'few words on the title');
      await page.locator('#btnNew').click();
      const cards = await page.locator('#titleBox .cls').count(); assert.equal(cards, 3);
      for (const k of ['warrior', 'mage', 'rogue']) {
        const tag = await page.evaluate((c) => window.__dbg.text.classBlurb(c), k);
        assert.ok(tag.length > 0 && tag.length <= 45, k + ' tagline <= 45 chars: ' + tag.length + ' "' + tag + '"');
      }
      const card = page.locator('#titleBox .cls').first();
      assert.equal(await card.locator('.ab i').count(), 4, 'four ability icons');
      const words = (await card.locator('.clsmain').innerText()).split(/\s+/).filter(Boolean).length;
      assert.ok(words <= 16, 'a card is short: ' + words + ' words');
      for (const b of await page.locator('#titleBox button').evaluateAll((bs) => bs.map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; }))) assert.ok(b.w >= 44 && b.h >= 44, JSON.stringify(b));
      // Details: numbers and the four abilities with their text, then Play
      await card.locator('.clsinfo').click();
      const body = await page.locator('#modalBox').innerText();
      assert.match(body, /Warrior/); for (const a of ['Bash', 'Cleave', 'Charge', 'Brace']) assert.match(body, new RegExp(a));
      assert.match(body, /46 HP/);
      await page.locator('#modalBox button', { hasText: /^Back$/ }).click();
      assert.equal(await page.evaluate(() => document.getElementById('modal').style.display), 'none');
      assert.equal(await page.evaluate(() => !!window.__dbg()), false, 'no run started by looking at details');
      // Hard toggle is on this screen
      await page.locator('#hardBtn').click(); assert.match(await page.locator('#hardBtn').textContent(), /ON/);
      await page.locator('#hardBtn').click(); assert.match(await page.locator('#hardBtn').textContent(), /OFF/);
      // each class starts via its card
      for (const [i, c] of ['warrior', 'mage', 'rogue'].entries()) {
        if (i > 0) { await page.evaluate(() => { window.__dbg.api.finish('abandon'); document.getElementById('modalBox').querySelector('button').click(); }); await page.locator('#btnNew').click(); }
        await page.locator('#titleBox .clsmain').nth(i).click();
        await page.waitForFunction(() => !!window.__dbg() && document.getElementById('title').style.display === 'none');
        assert.equal(await page.evaluate(() => window.__dbg().p.cls), c);
        await page.evaluate(() => { document.getElementById('modal').style.display = 'none'; });
      }
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('text budgets: tagline <= 45, enemy / ability / perk / trait / charm / off-hand / weapon / armor / modifier lines <= 55, path risk and gain <= 30 characters', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 25 });
    try {
      const all = await page.evaluate(() => {
        const D = window.__dbg, T = D.tables, X = D.text, o = [], add = (g, k, s) => o.push({ g, k, s: String(s), n: String(s).replace(/<[^>]+>/g, '').length });
        for (const a in T.ABIL) add('line', 'ability ' + a, X.abilityDesc(a));
        for (const p of T.PERKS) add('line', 'perk ' + p.id, p.d);
        for (const s of T.SYN) add('line', 'synergy ' + s.id, s.d);
        for (const k in T.TR) add('line', 'trait ' + k, T.TR[k].d);
        for (const k in T.EN) add('line', 'enemy ' + k, T.EN[k].tr);   // shown on the long-press card
        for (const k in T.CH) add('line', 'charm ' + k, X.charmRule(k));
        for (const k in T.OFF) add('line', 'offhand ' + k, X.offRule(k));
        for (const k in T.WP) add('line', 'weapon ' + k, X.wpRule(k));
        for (const k in T.ARM) add('line', 'armor ' + k, X.armRule(k));
        for (const m of D.mods.MODS) { add('line', 'modifier ' + m.id, m.tip); add('short', 'risk ' + m.id, m.r); add('short', 'gain ' + m.id, m.g); }
        for (const c in T.CLS) add('tag', 'class ' + c, X.classBlurb(c));
        return o;
      });
      assert.ok(all.length > 80, 'covered ' + all.length + ' texts');
      const bad = all.filter((x) => x.n > ({ line: 55, short: 30, tag: 45 })[x.g] || x.n === 0);
      assert.deepEqual(bad.map((x) => x.k + ' (' + x.n + '): ' + x.s), []);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});
