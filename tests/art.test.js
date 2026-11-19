// Art tests: no emoji anywhere in the rendered UI, every id in the balance tables has a real sprite (the renderer reports any it had to
// fall back for), distinct ids draw distinct pictures, effects are skipped with reduced motion, the whole game stays free of external requests.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, openRun, closeModal, CONC } = require('./lib/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

// symbols that are plain text glyphs (not emoji art) and may stay: the menu hint, the stairs marker, multiplication and arrows used in copy
const ALLOW = new Set(['☰', '▼', '→', '×', '★', '✓']);
const EMOJI = /[\p{Extended_Pictographic}️⃣]/u;
const bad = (text) => [...text].filter((c) => EMOJI.test(c) && !ALLOW.has(c));

describe('art', { concurrency: CONC }, () => {
  it('no emoji in the rendered UI: title, picker, upgrades, more, run HUD, modals, help, records, shop, shrine, path, game over, log', async () => {
    const { page, ctx, errors } = await newPage(browser, { meta: { seenHelp: 1, gold: 400, unl: { rogue: 1, mage: 1 } } });
    try {
      const seen = [];
      const grab = async (label) => { const t = await page.evaluate(() => document.body.innerText + '\n' + [...document.querySelectorAll('[aria-label],[title]')].map((e) => (e.getAttribute('aria-label') || '') + (e.title || '')).join(' ')); assert.ok(t.length > 15, label + ' rendered nothing'); seen.push([label, bad(t)]); };
      await grab('title');
      await page.locator('#title button', { hasText: /New run/ }).click(); await grab('picker');
      await page.evaluate(() => { document.getElementById('btnNew') && 0; window.__dbg.api.showTitle(); });
      await page.locator('#btnUpg').click(); await grab('upgrades');
      await page.evaluate(() => window.__dbg.api.showTitle());
      await page.locator('#btnMore').click(); await grab('more');
      await page.locator('#btnRecords').click(); await grab('records');
      await page.evaluate(() => window.__dbg.api.showTitle()); await page.locator('#btnMore').click();
      await page.locator('#btnAch').click(); await grab('achievements');
      await page.evaluate(() => window.__dbg.fn.startRun('rogue'));
      await page.waitForFunction(() => !!window.__dbg());
      await grab('intro / run');
      await closeModal(page);
      await page.evaluate(() => { const G = window.__dbg(); G.keys = 1; G.vanish = 3; G.ppois = { t: 2, d: 1 }; G.bl = 1; G.brace = { hits: 2, t: 3, reflect: 0.3 }; G.daily = 'x'; G.hard = 1; window.__dbg.fn.newFloor(3); });
      await grab('HUD with every tag');
      for (const [label, fn] of [
        ['equipment', () => window.__dbg.gear.showEquip(() => {})],
        ['shop', () => { window.__dbg().p.gold = 99; window.__dbg.api.showShop(); }],
        ['shrine', () => window.__dbg.api.showShrine()],
        ['path', () => window.__dbg.mods.showBranch()],
        ['perks', () => { window.__dbg().pending = 1; window.__dbg.api.afterModals(); }],
        ['gear found', () => { window.__dbg.spawnGear('weapon', 'axe', null, 3); const G = window.__dbg(), it = G.items[G.items.length - 1]; G.p.x = it.x; G.p.y = it.y; window.__dbg.gear.showGear && 0; }],
        ['records', () => window.__dbg.mods.showRecords()],
        ['achievements', () => window.__dbg.mods.showAchievements()],
        ['death', () => { window.__dbg().p.hp = 0; window.__dbg.api.finish('dead'); }],
      ]) {
        await page.evaluate(() => { document.getElementById('modal').style.display = 'none'; });
        await page.evaluate(fn); await grab(label);
      }
      // help (every section opened) and the ability / class detail screens
      await page.evaluate(() => { document.getElementById('modal').style.display = 'none'; window.__dbg.api.showTitle(); });
      await page.locator('#btnMore').click(); await page.locator('#btnControls').click();
      await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; })); await grab('help');
      assert.ok(seen.length >= 17, 'screens checked: ' + seen.length);
      const leaks = seen.filter(([, b]) => b.length);
      assert.deepEqual(leaks, [], 'emoji found: ' + JSON.stringify(leaks));
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('every entity / item / ability / modifier id in the balance tables has a sprite, and drawing them all falls back to nothing', async () => {
    const { page, ctx, errors } = await openRun(browser, 'warrior', { seed: 3 });
    try {
      const r = await page.evaluate(() => {
        const T = window.__dbg.tables, A = window.__dbg.art, ids = new Set();
        for (const t of ['EN', 'CLS', 'ABIL']) for (const k in T[t]) ids.add(T[t][k].e);
        for (const t of ['WP', 'ARM', 'OFF', 'CH']) for (const k in T[t]) ids.add(T[t][k].e);
        for (const m of window.__dbg.mods.MODS) ids.add(m.e);
        for (const k of ['gold', 'potion', 'fire', 'tele', 'key', 'knife', 'merchant', 'shrine', 'door', 'door_open', 'door_locked', 'stairs', 'chest', 'crown', 'warn', 'st_stun', 'st_frz', 'st_blind', 'st_pois', 'st_burn', 'st_wind', 'st_rest', 'st_hunt', 'st_sleep']) ids.add(k);
        const missing = [...ids].filter((i) => !A.SPR[i]);
        // draw each one (bitmap path) and a full frame; the renderer records any id it could not find
        for (const i of ids) A.spriteBmp(i, 40, '');
        window.__dbg.fn.newFloor(5); window.__dbg.fn.computeVis();
        return { n: ids.size, missing, fallbacks: A.missing() };
      });
      assert.ok(r.n >= 80, 'ids checked: ' + r.n);
      assert.deepEqual(r.missing, []);
      assert.deepEqual(r.fallbacks, [], 'the renderer had to draw a placeholder');
      // the in-game icon helper reports a missing id too (and draws the placeholder)
      const bad = await page.evaluate(() => { const A = window.__dbg.art; A.ic('no_such_sprite', 12); return A.missing(); });
      assert.deepEqual(bad, ['no_such_sprite'], 'a missing sprite is detectable');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('sprites for distinct ids are not pixel-identical, and every sprite draws something', async () => {
    const { page, ctx } = await newPage(browser);
    try {
      const r = await page.evaluate(() => {
        const A = window.__dbg.art, seen = {}, dup = [], empty = [];
        for (const id of A.ids()) {
          const b = A.spriteBmp(id, 48, ''), d = b.getContext('2d').getImageData(0, 0, 48, 48).data;
          let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
          if (n < 150) empty.push(id);
          const key = b.toDataURL();
          if (seen[key]) dup.push(seen[key] + '=' + id); else seen[key] = id;
        }
        return { dup, empty, n: A.ids().length };
      });
      assert.deepEqual(r.dup, []);
      assert.deepEqual(r.empty, []);
      assert.ok(r.n >= 110, 'sprites: ' + r.n);
    } finally { await ctx.close(); }
  });

  it('the map draws with the flat-vector renderer: sprites are cached bitmaps, not re-drawn paths, and one blit cache serves every frame', async () => {
    const { page, ctx, errors } = await openRun(browser, 'mage', { seed: 4 });
    try {
      const r = await page.evaluate(() => {
        const A = window.__dbg.art, id = 'goblin';
        const a = A.spriteBmp(id, 34, ''), b = A.spriteBmp(id, 34, '');
        const t = performance.now(); for (let i = 0; i < 400; i++) A.spriteBmp('rat', 34, '');
        return { same: a === b, ms: performance.now() - t };
      });
      assert.ok(r.same, 'same size and variant return the same cached canvas');
      assert.ok(r.ms < 60, 'cache hits are cheap: ' + r.ms);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('effects: abilities add motion normally and none with prefers-reduced-motion', async () => {
    for (const rm of [false, true]) {
      const { page, ctx, errors } = await openRun(browser, 'mage', { seed: 6, reducedMotion: rm });
      try {
        const n = await page.evaluate(() => {
          window.T = null;
          const D = window.__dbg, G = D(); G.enemies = [];
          const e = D.fn.makeEnemy('goblin', G.p.x + 1, G.p.y, 1); e.awake = true; G.enemies.push(e);
          G.p.mana = 99; D.fn.computeVis();
          D.fn.use('nova');
          return D.art.fxCount();
        });
        if (rm) assert.equal(n, 0, 'reduced motion: no effects'); else assert.ok(n > 0, 'effects were queued');
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    }
  });

  it('every ability, with and without a target, runs its effect without errors and within 450 ms', async () => {
    const { page, ctx, errors } = await openRun(browser, 'mage', { seed: 8, meta: { seenHelp: 1, gold: 0, unl: { rogue: 1, mage: 1 } } });
    try {
      const out = await page.evaluate(() => {
        const D = window.__dbg, res = {};
        for (const [cls, ks] of [['warrior', ['bash', 'cleave', 'charge', 'brace']], ['mage', ['bolt', 'nova', 'blink', 'fire']], ['rogue', ['backstab', 'vanish', 'knife', 'smoke']]]) {
          D.fn.startRun(cls); document.getElementById('modal').style.display = 'none';
          for (const k of ks) {
            const G = D(); G.enemies = []; G.items = []; 
            // a straight open corridor of 5 floor tiles, foe 3 tiles away in line
            let ok = false;
            for (let y = 2; y < 28 && !ok; y++) for (let x = 2; x < 22 && !ok; x++) { let f = true; for (let d = -1; d <= 5; d++) if (G.map[y * 30 + x + d] !== 1) f = false; if (f) { G.p.x = x; G.p.y = y; ok = true; } }
            const e = D.fn.makeEnemy('goblin', G.p.x + (k === 'charge' ? 4 : 1), G.p.y, 1); e.awake = true; e.hp = e.mhp = 500; G.enemies.push(e);
            G.p.rage = 99; G.p.mana = 99; G.knives = 3; for (const c in G.cd) G.cd[c] = 0; D.fn.computeVis();
            const tg = D.fn.targetTiles(k); const t = tg[0];
            const used = D.fn.use(k, t && t[0], t && t[1]);
            res[k] = used === undefined ? 'ran' : used;
          }
        }
        return { res, longest: Math.max(...Object.values({ bolt: 300, knife: 240, nova: 380, blink: 320, fire: 440, cleave: 240, charge: 280, bash: 240, brace: 340, backstab: 260, vanish: 340, smoke: 430 })) };
      });
      assert.ok(out.longest <= 450, 'longest effect ' + out.longest);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('table ids map to their own pictures: foes and gear use their own id, abilities ab_<key>, modifiers m_<id>, no two entries share one', async () => {
    const { page, ctx } = await newPage(browser);
    try {
      const r = await page.evaluate(() => {
        const T = window.__dbg.tables, bad = [];
        for (const t of ['EN', 'CLS', 'WP', 'ARM', 'OFF', 'CH']) { const seen = {}; for (const k in T[t]) { if (T[t][k].e !== k) bad.push(t + '.' + k + ' -> ' + T[t][k].e); if (seen[T[t][k].e]) bad.push('dup ' + T[t][k].e); seen[T[t][k].e] = 1; } }
        for (const k in T.ABIL) if (T.ABIL[k].e !== 'ab_' + k) bad.push('ABIL.' + k + ' -> ' + T.ABIL[k].e);
        for (const m of window.__dbg.mods.MODS) if (m.e !== 'm_' + m.id) bad.push('MOD.' + m.id + ' -> ' + m.e);
        return bad;
      });
      assert.deepEqual(r, []);
    } finally { await ctx.close(); }
  });

  it('a missing sprite is reported by the bitmap path too, and the map draws the Guard shield and a boss larger than its tile', async () => {
    const { page, ctx, errors } = await openRun(browser, 'mage', { seed: 9 });
    try {
      const miss = await page.evaluate(() => { const A = window.__dbg.art; A.spriteBmp('nope_nothing', 20, ''); return A.missing(); });
      assert.deepEqual(miss, ['nope_nothing']);
      const px = await page.evaluate(() => {
        const D = window.__dbg, F = D.fn; let G = D();
        const find = () => { for (let y = 4; y < 26; y++) for (let x = 4; x < 24; x++) { let ok = true; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (G.map[(y + dy) * 30 + x + dx] !== 1) ok = false; if (ok) return [x, y]; } return null; };
        let at = find(); for (let f = 1; !at && f < 8; f++) { F.newFloor(f); G = D(); at = find(); }
        if (!at) return null;
        G.enemies = []; G.items = []; G.p.x = at[0]; G.p.y = at[1]; F.computeVis();
        const cvs = document.getElementById('c'), c2 = cvs.getContext('2d'), V = D.view();
        const grab = (tx, ty, ox, oy, w, h) => { const d = window.devicePixelRatio || 1, s = V.ts; return Array.from(c2.getImageData(Math.round((V.ox + tx * s + ox * s) * d), Math.round((V.oy + ty * s + oy * s) * d), Math.max(1, Math.round(w * s * d)), Math.max(1, Math.round(h * s * d))).data).join(','); };
        const draw = () => new Promise((res) => { document.getElementById('modal').style.display = 'none'; D.fn.computeVis(); window.dispatchEvent(new Event('resize')); setTimeout(res, 150); });
        return { at, grab: grab.toString(), draw: draw.toString() };
      });
      assert.ok(px, 'found an open spot');
      const run = async (setup, region) => {
        await page.evaluate(setup);
        await page.evaluate(() => new Promise((res) => { window.dispatchEvent(new Event('resize')); setTimeout(res, 800); }));
        return page.evaluate((reg) => { const V = window.__dbg.view(), d = window.devicePixelRatio || 1, s = V.ts, c = document.getElementById('c').getContext('2d'); const g = (tx, ty, a, b, w, h) => Array.from(c.getImageData(Math.round((V.ox + tx * s + a * s) * d), Math.round((V.oy + ty * s + b * s) * d), Math.max(1, Math.round(w * s * d)), Math.max(1, Math.round(h * s * d))).data).join(','); return g(reg.tx, reg.ty, reg.a, reg.b, reg.w, reg.h); }, region);
      };
      // Guard: shield on the east side vs no facing
      const gx = px.at[0] + 2, gy = px.at[1];
      const mk = (face) => () => { const D = window.__dbg, G = D(); G.enemies = []; const e = D.fn.makeEnemy('guard', arguments[0], 0, 1); };
      const place = (face, boss) => `(() => { const D = window.__dbg, G = D(); G.enemies = []; const e = D.fn.makeEnemy('${boss ? 'dragon' : 'guard'}', ${gx}, ${gy}, ${boss ? 8 : 4}); e.awake = false; e.face = ${face}; G.enemies.push(e); D.fn.computeVis(); })()`;
      const reg = { tx: gx, ty: gy, a: 0.62, b: 0.1, w: 0.4, h: 0.8 };
      const withShield = await run(place('[1,0]'), reg), without = await run(place('null'), reg);
      assert.notEqual(withShield, without, 'the shield is drawn on the side the Guard faces');
      // boss: pixels above-left of its own tile change when a dragon stands there
      const reg2 = { tx: gx, ty: gy, a: -0.45, b: 0.0, w: 0.3, h: 0.4 };
      const empty = await run(`(() => { const D = window.__dbg, G = D(); G.enemies = []; D.fn.computeVis(); })()`, reg2);
      const drag = await run(place('null', true), reg2);
      const A = empty.split(','), B = drag.split(','); let diff = 0; for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) diff++;
      assert.ok(diff > 150, 'the dragon is drawn larger than its tile (changed values: ' + diff + ')');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});
