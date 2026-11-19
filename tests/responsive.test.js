// Responsive layout, mouse + keyboard, and the whole-save reset. Real pointer / keyboard input; the game's own functions only set situations up.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, openRun, closeModal, CONC, reload, URL } = require('./lib/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const W = 30;
async function arena(page, rows, ox = 4, oy = 4) {
  return page.evaluate(([rows, ox, oy]) => {
    const G = window.__dbg(); G.enemies = []; G.items = []; G.shrine = null; G.merchant = null; G.cracks = []; G.smoke = [];
    for (let y = -1; y <= rows.length; y++) for (let x = -1; x <= rows[0].length; x++) { const k = (oy + y) * 30 + ox + x; if (k >= 0 && k < 900) { G.map[k] = 0; G.seen[k] = true; G.exp[k] = true; } }
    rows.forEach((r, y) => [...r].forEach((c, x) => { const k = (oy + y) * 30 + ox + x; G.map[k] = c === '#' ? 0 : c === '>' ? 2 : 1; G.seen[k] = true; G.exp[k] = true; if (c === '@') { G.p.x = ox + x; G.p.y = oy + y; } }));
    for (const k in G.cd) G.cd[k] = 0; G.vanish = 0; G.brace = null; G.p.hp = G.p.mhp; G.p.rage = 100;
    window.__dbg.fn.computeVis(); window.__dbg.fn.render(); return { x: G.p.x, y: G.p.y };
  }, [rows, ox, oy]);
}
const foe = (page, type, x, y) => page.evaluate(([t, x, y]) => { const e = window.__dbg.fn.makeEnemy(t, x, y, 1); e.awake = true; e.hp = e.mhp = 40; window.__dbg.fn.computeVis(); window.__dbg.fn.render(); return e.id; }, [type, x, y]);
const pt = (page, x, y) => page.evaluate(([x, y]) => { const v = window.__dbg.view(), r = document.getElementById('c').getBoundingClientRect(); return { x: r.left + v.ox + (x + 0.5) * v.ts, y: r.top + v.oy + (y + 0.5) * v.ts }; }, [x, y]);
const S = (page) => page.evaluate(() => { const G = window.__dbg(); return { x: G.p.x, y: G.p.y, turn: G.turn, hp: G.p.hp, mana: G.p.mana, floor: G.floor, foes: G.enemies.map((e) => [e.x, e.y, e.hp]), log: G.log.slice(-1)[0] }; });
const settle = (page, ms = 150) => page.waitForTimeout(ms);
async function dprPage(w, h, dpr, extra) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, ...(extra || {}) });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { localStorage.setItem('dcr_meta_v1', JSON.stringify({ seenHelp: 1, gold: 300, unl: { rogue: 1, mage: 1 } })); window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 100); });
  await page.goto(URL); await page.waitForFunction(() => !!window.__dbg);
  await page.evaluate(() => { window.__dbg.tables.BAL.ui.modalGraceMs = 0; });
  return { page, ctx, errors };
}
const startWarrior = async (page) => { await page.evaluate(() => window.__dbg.fn.startRun('warrior')); await page.waitForFunction(() => document.getElementById('title').style.display === 'none'); await closeModal(page); };
const rect = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

const SIZES = [[360, 640, 2], [390, 844, 2], [820, 1180, 1], [1180, 820, 1], [1366, 768, 1], [1920, 1080, 1], [1366, 768, 2]];
describe('layout at every size', { concurrency: CONC }, () => {
  for (const [w, h, dpr] of SIZES) {
    it(`${w}x${h} @${dpr}x: run layout, buttons, crisp canvas, no overlap, menus fit`, async () => {
      const { page, ctx, errors } = await dprPage(w, h, dpr);
      try {
        await startWarrior(page);
        await arena(page, ['.......', '.......', '...@...', '.......', '.......']);
        const g = await page.evaluate(() => window.__dbg()); await foe(page, 'rat', g.p.x + 2, g.p.y); await settle(page);
        assert.equal(await page.locator('#rot').isVisible(), false, 'no rotate hint');
        const ids = ['a_0', 'a_1', 'a_2', 'a_3', 'b_items', 'b_exp', 'b_wait', 'b_down', 'gearBtn', 'menuBtn'];
        const rs = {}; for (const id of ids) rs['#' + id] = await rect(page, '#' + id);
        for (const [id, r] of Object.entries(rs)) {
          assert.ok(r.l >= -0.5 && r.t >= -0.5 && r.r <= w + 0.5 && r.b <= h + 0.5, id + ' inside the viewport ' + JSON.stringify(r));
          assert.ok(r.w >= 44 && r.h >= 44, id + ' tap target >= 44px ' + r.w + 'x' + r.h);
          assert.ok(r.w <= 220 && r.h <= 80, id + ' keeps a sane size ' + r.w + 'x' + r.h);
        }
        const keys = Object.keys(rs);
        for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) assert.equal(inter(rs[keys[i]], rs[keys[j]]) < 1, true, keys[i] + ' overlaps ' + keys[j]);
        const cvr = await rect(page, '#cv');
        for (const sel of ['#hud', '#bar', '#bar2', '#logw']) assert.ok(inter(await rect(page, sel), cvr) < 1, sel + ' must not cover the map');
        const wide = w >= 640 && h >= 480 && w / h >= 1.1;   // landscape side-panel layout
        if (wide) { const b = await rect(page, '#bar'); assert.ok(cvr.r <= b.l + 0.5, 'side panel: map left of the buttons'); assert.ok(cvr.w > w * 0.6, 'map uses the space'); }
        else assert.ok(cvr.w >= Math.min(w, 900) - 1, 'portrait: map spans the column');
        const c = await page.evaluate(() => { const c = document.getElementById('c'), r = c.getBoundingClientRect(), v = window.__dbg.view(); return { bw: c.width, bh: c.height, cw: r.width, ch: r.height, dpr: devicePixelRatio, ts: v.ts, sx: document.documentElement.scrollWidth, sy: document.documentElement.scrollHeight }; });
        assert.ok(Math.abs(c.bw - c.cw * c.dpr) <= 1 && Math.abs(c.bh - c.ch * c.dpr) <= 1, 'canvas backing = css x dpr ' + JSON.stringify(c));
        assert.ok(c.ts >= 28 && c.ts <= 64, 'tile size sane ' + c.ts);
        assert.ok(c.sx <= w && c.sy <= h, 'no page scroll');
        // the hero is on the map and the foe tile center is really over the canvas
        const p = await pt(page, g.p.x, g.p.y), q = await pt(page, g.p.x + 2, g.p.y);
        for (const z of [p, q]) assert.equal(await page.evaluate(([x, y]) => document.elementFromPoint(x, y).id, [z.x, z.y]), 'c');
        // menus: title, upgrades, a modal; boxes centered, inside the viewport, last button reachable
        await page.click('#menuBtn'); await settle(page, 60);
        let b = await rect(page, '#modalBox'); assert.ok(b.l >= 0 && b.r <= w && b.t >= 0 && b.b <= h && b.w <= (w >= 1700 ? 720 : w >= 1180 ? 640 : 540), 'modal box fits ' + JSON.stringify(b));
        assert.ok(Math.abs((b.l + b.r) / 2 - w / 2) <= 2, 'modal centered');
        await page.evaluate(() => { document.getElementById('modal').style.display = 'none'; window.__dbg.api.showTitle(); });
        for (const [sel, name] of [['#titleBox', 'title'], ['', 'upgrades']]) {
          if (!sel) { await page.click('#btnUpg'); await settle(page, 60); }
          const t = await rect(page, '#titleBox'); assert.ok(t.l >= 0 && t.r <= w && t.t >= 0 && t.b <= h && t.w <= (w >= 1700 ? 1200 : w >= 1180 ? 1020 : 540), name + ' box fits ' + JSON.stringify(t));
          assert.ok(Math.abs((t.l + t.r) / 2 - w / 2) <= 2, name + ' centered');
          const sc = await page.evaluate(() => { const e = document.getElementById('titleBox'); const bs = [...e.querySelectorAll('button')].filter((x) => x.offsetParent); const last = bs[bs.length - 1].getBoundingClientRect(); return { last: last.bottom, scrolls: e.scrollHeight > e.clientHeight, ov: document.getElementById('title').scrollWidth > innerWidth }; });
          assert.ok((sc.last <= h + 0.5 || sc.scrolls) && !sc.ov, name + ' last button reachable (fits or scrolls)');
        }
      } finally { assert.deepEqual(errors, []); await ctx.close(); }
    });
  }
  it('rotate overlay only for small landscape phones', async () => {
    const t = await dprPage(390, 844, 1, { hasTouch: true, isMobile: true });
    try {   // a touch phone in a run: the hint only below 500 px tall
      await startWarrior(t.page);
      for (const [w, h, want] of [[844, 390, true], [932, 430, true], [1180, 820, false], [820, 1180, false], [1024, 600, false], [390, 844, false]]) {
        await t.page.setViewportSize({ width: w, height: h }); await settle(t.page, 80);
        assert.equal(await t.page.locator('#rot').isVisible(), want, 'touch ' + w + 'x' + h);
      }
      await t.page.setViewportSize({ width: 390, height: 844 }); await t.page.evaluate(() => { window.__dbg.api.finish('abandon'); document.querySelector('#modalBox button').click(); });
      await t.page.setViewportSize({ width: 844, height: 390 }); await settle(t.page, 80);
      assert.equal(await t.page.locator('#rot').isVisible(), false, 'the title screens are not covered');
    } finally { assert.deepEqual(t.errors, []); await t.ctx.close(); }
    const { page, ctx, errors } = await dprPage(1366, 768, 1);
    try {   // a mouse window, however short, is never covered; landscape windows >= 480 tall get the side panel
      await startWarrior(page);
      for (const [w, h] of [[1000, 499], [1024, 480], [900, 600], [700, 450]]) {
        await page.setViewportSize({ width: w, height: h }); await settle(page, 80);
        assert.equal(await page.locator('#rot').isVisible(), false, 'mouse ' + w + 'x' + h);
        if (h >= 480 && w >= 640) {
          const c = await rect(page, '#cv'), b = await rect(page, '#bar');
          assert.ok(c.r <= b.l + 0.5 && c.h >= h - 2, 'side panel layout at ' + w + 'x' + h + ' ' + JSON.stringify([c, b]));
        }
      }
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('resize and rotation mid-run: hero stays visible, a real click lands on the right tile, aiming still frames targets', async () => {
    const { page, ctx, errors } = await dprPage(390, 844, 1);
    try {
      await startWarrior(page);
      await arena(page, ['...........', '...........', '.....@.....', '...........', '...........']);
      let g = await page.evaluate(() => window.__dbg());
      for (const [w, h] of [[1366, 768], [820, 1180], [1180, 820], [360, 640], [1920, 1080]]) {
        await page.setViewportSize({ width: w, height: h }); await settle(page, 200);
        const v = await page.evaluate(() => { const v = window.__dbg.view(), G = window.__dbg(); return { x: v.ox + G.p.x * v.ts, y: v.oy + G.p.y * v.ts, ts: v.ts, cw: v.cw, ch: v.ch }; });
        assert.ok(v.x >= 0 && v.x + v.ts <= v.cw && v.y >= 0 && v.y + v.ts <= v.ch, 'hero on screen at ' + w + 'x' + h);
        const a1 = await arena(page, ['...........', '...........', '.....@.....', '...........', '...........']);
        const id = await foe(page, 'rat', a1.x + 1, a1.y); await settle(page, 80);
        const before = (await S(page)).foes[0][2];
        const q = await pt(page, a1.x + 1, a1.y); await page.mouse.click(q.x, q.y); await settle(page, 120);
        const after = await S(page);
        assert.ok(after.foes.length === 0 || after.foes[0][2] < before, 'click on the adjacent foe attacked it at ' + w + 'x' + h + ' ' + JSON.stringify([before, after, q, await S(page), await page.evaluate(() => [document.getElementById('modal').style.display, document.getElementById('modalBox').dataset.kind, window.__dbg.view().ts])]));
        // armed framing: a far target stays on screen
        const a2 = await arena(page, ['.............', '.............', '......@......', '.............', '.............']);
        await foe(page, 'rat', a2.x + 3, a2.y); await page.evaluate(() => window.__dbg.fn.toggleAbility('charge')); await settle(page, 120);
        const f = await page.evaluate(() => { const v = window.__dbg.view(), G = window.__dbg(), e = G.enemies[0]; return { ok: v.ox + e.x * v.ts >= 0 && v.ox + (e.x + 1) * v.ts <= v.cw && v.oy + e.y * v.ts >= 0 && v.oy + (e.y + 1) * v.ts <= v.ch, armed: document.querySelectorAll('#bar2 button.armed').length > 0 }; });
        assert.ok(f.armed && f.ok, 'armed, target framed at ' + w + 'x' + h);
        if (f.armed) await page.keyboard.press('Escape'); if (await page.locator('#modal').isVisible()) await page.keyboard.press('Escape'); g = await page.evaluate(() => window.__dbg());
      }
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
});

describe('mouse and keyboard', { concurrency: CONC }, () => {
  it('right-click inspects (no browser menu), long-press cursor, hover and armed cursor', async () => {
    const { page, ctx, errors } = await dprPage(1366, 768, 1);
    try {
      await startWarrior(page);
      const g = await arena(page, ['.......', '...@...', '.......']);
      await foe(page, 'rat', g.x + 2, g.y); await settle(page, 100);
      await page.evaluate(() => { window.__cm = []; document.getElementById('c').addEventListener('contextmenu', (e) => window.__cm.push(e.defaultPrevented), { once: false }); });
      const q = await pt(page, g.x + 2, g.y); await page.mouse.click(q.x, q.y, { button: 'right' }); await settle(page, 100);
      assert.ok(await page.evaluate(() => !!window.__dbg.insp()), 'card open');
      assert.ok(await page.evaluate(() => window.__cm.length >= 1), 'contextmenu seen');
      assert.equal((await S(page)).turn, (await page.evaluate(() => window.__dbg().turn)), 'no turn used');
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('c')).cursor), 'default');
      await page.keyboard.press('Escape'); await settle(page, 50);
      assert.ok(await page.evaluate(() => !window.__dbg.insp()), 'Esc closes the card');
      await page.evaluate(() => window.__dbg.fn.toggleAbility('charge')); await settle(page, 50);
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('c')).cursor), 'crosshair');
      await page.keyboard.press('Escape');
      await page.hover('#b_wait');
      assert.notEqual(await page.evaluate(() => getComputedStyle(document.getElementById('b_wait')).backgroundColor), await page.evaluate(() => getComputedStyle(document.getElementById('b_exp')).backgroundColor), 'hover state differs');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('keys: move, attack by moving, abilities 1-4, wait, items, stairs, Esc ladder, no hijack of Ctrl combos', async () => {
    const { page, ctx, errors } = await dprPage(1366, 768, 1);
    try {
      await startWarrior(page);
      const g = await arena(page, ['.........', '....@....', '.........', '....>....']);
      assert.equal(await page.evaluate(() => document.body.classList.contains('kb')), false, 'no hints before a key');
      await page.keyboard.press('ArrowRight'); await settle(page, 60); assert.equal((await S(page)).x, g.x + 1);
      await page.keyboard.press('a'); await settle(page, 60); assert.equal((await S(page)).x, g.x);
      await page.keyboard.press('w'); await settle(page, 60); assert.equal((await S(page)).y, g.y - 1);
      await page.keyboard.press('ArrowDown'); await settle(page, 60);
      const t0 = (await S(page)).turn; await page.keyboard.press('Space'); await settle(page, 60); assert.equal((await S(page)).turn, t0 + 1, 'Space waits');
      await page.keyboard.press('.'); await settle(page, 60); assert.equal((await S(page)).turn, t0 + 2, '. waits');
      await page.keyboard.press('Control+a'); await settle(page, 40); assert.equal((await S(page)).turn, t0 + 2, 'Ctrl+A ignored');
      // attack by moving into a foe
      await foe(page, 'rat', g.x + 1, g.y); const f0 = (await S(page)).foes[0][2];
      await page.keyboard.press('ArrowRight'); await settle(page, 80);
      const s1 = await S(page); assert.ok(!s1.foes.length || s1.foes[0][2] < f0, 'moving into the foe attacks'); assert.equal(s1.x, g.x, 'did not step');
      // abilities 1..4 arm / act and the key = the button
      await arena(page, ['.........', '....@....', '.........']);
      await foe(page, 'rat', g.x + 1, g.y);
      await page.keyboard.press('1'); await settle(page, 60);
      assert.equal(await page.evaluate(() => document.querySelectorAll('#bar2 button.armed').length), 1, '1 arms Bash (adjacent foe)');
      await page.keyboard.press('Escape'); await settle(page, 60);
      assert.equal(await page.evaluate(() => document.querySelectorAll('#bar2 button.armed').length), 0, 'Esc cancels aim');
      assert.equal(await page.locator('#modal').isVisible(), false, 'Esc cancelled aim, not opened the menu');
      // items tray, then Esc closes it, then Esc opens the menu, then Esc closes it
      await page.evaluate(() => { window.__dbg().inv.pot = 2; window.__dbg.fn.render(); });
      await page.keyboard.press('i'); await settle(page, 60); assert.equal(await page.locator('#tray').isVisible(), true);
      await page.keyboard.press('Escape'); await settle(page, 60); assert.equal(await page.locator('#tray').isVisible(), false);
      await page.keyboard.press('Escape'); await settle(page, 60); assert.equal(await page.locator('#modal').isVisible(), true, 'Esc opens the menu');
      await page.keyboard.press('ArrowLeft'); await settle(page, 40); assert.equal((await S(page)).x, g.x, 'keys ignored in dialogs');
      await page.keyboard.press('Escape'); await settle(page, 60); assert.equal(await page.locator('#modal').isVisible(), false, 'Esc closes it');
      // stairs: Enter does nothing off the stairs, descends on them; Space never descends
      await arena(page, ['....@....', '.........', '....>....']);
      const fl = (await S(page)).floor; await page.keyboard.press('Enter'); await settle(page, 80); assert.equal((await S(page)).floor, fl, 'not on stairs');
      await page.evaluate(() => { const G = window.__dbg(); for (let i = 0; i < 900; i++) if (G.map[i] === 2) { G.p.x = i % 30; G.p.y = Math.floor(i / 30); } window.__dbg.fn.render(); });
      await page.keyboard.press('Space'); await settle(page, 80); assert.equal((await S(page)).floor, fl, 'Space waits on the stairs');
      await page.keyboard.press('Enter'); await settle(page, 300); assert.ok((await S(page)).floor === fl + 1 || (await page.locator('#modalBox[data-kind="path"]').count()) > 0, 'Enter descends (or offers the exit choice)');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('keys honour the danger guard: first press only marks, a held key never confirms, a second press goes', async () => {
    const { page, ctx, errors } = await dprPage(1366, 768, 1);
    try {
      await startWarrior(page);
      const g = await arena(page, ['.........', '....@....', '.........']);
      await page.evaluate(([x, y]) => { window.__dbg().cracks = [{ x: x + 1, y: y, t: 1 }]; window.__dbg.fn.render(); }, [g.x, g.y]);
      await page.keyboard.down('ArrowRight'); await page.keyboard.down('ArrowRight'); await page.keyboard.down('ArrowRight'); await page.keyboard.up('ArrowRight'); await settle(page, 80);
      let s = await S(page); assert.equal(s.x, g.x, 'held key did not step onto the danger'); assert.match(s.log, /again/i);
      await page.keyboard.press('ArrowRight'); await settle(page, 80);
      assert.equal((await S(page)).x, g.x + 1, 'the second, separate press goes');
      // a different key / direction in between does not carry the confirmation
      await page.evaluate(([x, y]) => { const G = window.__dbg(); G.p.x = x; G.p.y = y; G.cracks = [{ x: x + 1, y: y, t: 1 }]; window.__dbg.fn.render(); }, [g.x, g.y]);
      await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight'); await settle(page, 80);
      assert.equal((await S(page)).x, g.x, 'moving away resets the mark');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
  it('key hints appear after the first key press, on buttons only, never on a touch device', async () => {
    const { page, ctx, errors } = await dprPage(1366, 768, 1);
    try {
      await startWarrior(page);
      const hint = (id) => page.evaluate((id) => getComputedStyle(document.getElementById(id), '::before').content, id);
      assert.equal(await hint('b_wait'), 'none', 'hidden before a key');
      const h0 = await page.evaluate(() => document.getElementById('b_wait').innerHTML);
      await page.keyboard.press('ArrowUp'); await settle(page, 50);
      assert.equal(await hint('b_wait'), '"␣"'); assert.equal(await hint('a_0'), '"1"'); assert.equal(await hint('menuBtn'), '"Esc"');
      assert.equal(await page.evaluate(() => document.getElementById('b_wait').innerHTML), h0, 'markup untouched');
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
    const t = await dprPage(820, 1180, 2, { hasTouch: true, isMobile: true });
    try {
      await startWarrior(t.page); await t.page.keyboard.press('ArrowUp'); await settle(t.page, 50);
      assert.equal(await t.page.evaluate(() => document.body.classList.contains('kb')), false, 'no hints on touch');
    } finally { assert.deepEqual(t.errors, []); await t.ctx.close(); }
  });
});

describe('reset all progress', { concurrency: CONC }, () => {
  const idbRun = (page) => page.evaluate(() => new Promise((res) => { const r = indexedDB.open('dcr_run_mirror', 1); r.onupgradeneeded = () => { r.result.createObjectStore('s'); }; r.onsuccess = () => { const g = r.result.transaction('s').objectStore('s').get('run2'); g.onsuccess = () => { r.result.close(); res(g.result === undefined ? null : g.result); }; }; r.onerror = () => res('err'); }));
  const lsKeys = (page) => page.evaluate(() => Object.keys(localStorage).sort());
  async function seeded() {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    // seed once (a foreign '__seeded' key, which the reset must leave alone), so a reload after the reset really starts from whatever the game left; localStorage is carried over by window.name (Chromium's lazy flush)
    await page.addInitScript((m) => {
      try { if (window.name.indexOf('__ls:') === 0) { const d = JSON.parse(window.name.slice(5)); window.name = ''; localStorage.clear(); for (const [k, v] of d) localStorage.setItem(k, v); }
        if (localStorage.getItem('__seeded') === null) { localStorage.setItem('__seeded', '1'); localStorage.setItem('dcr_meta_v1', m); } } catch (e) { /* blocked */ }
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 100);
    }, JSON.stringify({ seenHelp: 1, gold: 777, unl: { rogue: 1, mage: 1 }, up: { hp: 3 }, bp: { x: 1 }, heat: 2, sound: 1 }));
    await page.goto(URL); await page.waitForFunction(() => !!window.__dbg);
    const r = { page, ctx, errors };
    await page.evaluate(() => { window.__dbg.tables.BAL.ui.modalGraceMs = 400; localStorage.setItem('other_app_key', 'keep me'); localStorage.setItem('dcr_auto_speed', '2'); });
    await page.evaluate(() => { window.__dbg.fn.startRun('rogue'); });
    await page.evaluate(() => { document.getElementById('modal').style.display = 'none'; window.__dbg.fn.save(); window.__dbg.api.saveMeta(); });
    await page.waitForFunction(async () => { return true; });
    for (let i = 0; i < 40 && !(await idbRun(page)); i++) await page.waitForTimeout(50);
    assert.ok(await idbRun(page), 'IDB mirror written');
    await page.evaluate(() => { document.getElementById('modal').style.display = 'none'; window.__dbg.api.showTitle(); window.__dbg.fn.startRun; });
    return r;
  }
  const toMore = async (page) => { await page.evaluate(() => window.__dbg.api.showTitle()); await page.click('#btnMore'); await page.click('#btnReset'); };
  it('two confirm steps, cancel keeps everything, full wipe incl. IndexedDB, survives reload, foreign key untouched', async () => {
    const { page, ctx, errors } = await seeded();
    try {
      const before = await lsKeys(page); assert.ok(before.includes('dcr_meta_v1') && before.includes('dcr_run_v2') && before.includes('other_app_key'));
      await page.evaluate(() => { window.__dbg.tables.BAL.ui.modalGraceMs = 1200; });   // long enough that a slow machine cannot out-wait the check below
      await toMore(page);
      assert.match(await page.locator('#modalBox').innerText(), /lost/i); assert.ok((await page.locator('#modalBox p').innerText()).split('\n').length <= 2);
      // 400 ms grace: an immediate real click on the destructive button does nothing
      await page.locator('#modalBox button[data-k="reset1"]').click(); await settle(page, 50);
      assert.ok(await page.locator('#modalBox button[data-k="reset1"]').isVisible(), 'still step 1 (grace)');
      await page.waitForTimeout(1300); await page.evaluate(() => { window.__dbg.tables.BAL.ui.modalGraceMs = 400; });
      // cancel keeps all
      await page.locator('#modalBox button[data-k="cancel"]').click(); await settle(page, 80);
      assert.equal(await page.locator('#modal').isVisible(), false); assert.deepEqual(await lsKeys(page), before); assert.ok(await idbRun(page));
      // step 1 then cancel at step 2
      await page.click('#btnReset'); await page.waitForTimeout(450);
      await page.locator('#modalBox button[data-k="reset1"]').click(); await page.waitForTimeout(450);
      assert.equal(await page.locator('#modalBox button[data-k="reset2"]').isVisible(), true, 'second step shown');
      assert.equal(await page.evaluate(() => window.__dbg.api.meta().gold), 777, 'nothing wiped after step 1');
      await page.keyboard.press('Escape'); await settle(page, 80);
      assert.equal(await page.evaluate(() => window.__dbg.api.meta().gold), 777); assert.deepEqual(await lsKeys(page), before);
      // both steps
      await page.click('#btnReset'); await page.waitForTimeout(450);
      await page.locator('#modalBox button[data-k="reset1"]').click(); await page.waitForTimeout(450);
      await page.locator('#modalBox button[data-k="reset2"]').click();
      await page.waitForFunction(() => document.getElementById('modal').style.display === 'none' && !!document.getElementById('btnNew'));
      const m = await page.evaluate(() => window.__dbg.api.meta());
      assert.equal(m.gold, 0); assert.ok(Object.values(m.up).every((v) => v === 0)); assert.deepEqual(m.bp, {}); assert.equal(m.heat, 0); assert.equal(m.sound, 0); assert.equal(m.seenHelp, 0);
      assert.equal(await page.locator('#btnContinue').count(), 0, 'no Continue');
      const after = await lsKeys(page); assert.ok(!after.includes('dcr_run_v2') && !after.includes('dcr_auto_speed'), 'run + auto speed gone'); assert.equal(await page.evaluate(() => localStorage.getItem('other_app_key')), 'keep me');
      assert.ok(!(await idbRun(page)), 'IndexedDB mirror empty');
      const dbs = await page.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : []));
      assert.ok(!dbs.includes('dcr_run_mirror') || !(await idbRun(page)), 'mirror database gone');
      // reload: nothing comes back
      await page.evaluate(() => { window.name = '__ls:' + JSON.stringify(Object.entries(localStorage)); }); await page.reload(); await page.waitForFunction(() => !!window.__dbg); await page.waitForTimeout(600);
      assert.equal(await page.locator('#btnContinue').count(), 0, 'no Continue after reload');
      assert.equal(await page.evaluate(() => window.__dbg.api.meta().gold), 0);
      assert.equal(await page.evaluate(() => localStorage.getItem('other_app_key')), 'keep me');
      assert.equal(await page.evaluate(() => Object.keys(window.__dbg.api.meta().unl).length), 0, 'class unlocks gone');
      assert.equal(await page.locator('#btnNew').isVisible(), true);
    } finally { assert.deepEqual(errors, []); await ctx.close(); }
  });
});
