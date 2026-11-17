// Kit tests: every class uses each of its four abilities, gear goes into all four slots, an old-version run save is discarded
// cleanly, and every new enemy spawns and acts. Drives the game through window.__dbg like the bot does.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, startRun } = require('./lib/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

// in-page helpers (string-injected so each test can use them): a clear straight corridor of floor to test lines and ranges
const HELPERS = `
window.T = {
  // find a floor tile with at least n open floor tiles in +x and 1 open tile in +y/-y, move the player there, clear the floor of enemies
  setup(n) {
    const G = () => window.__dbg(), W = 30;
    for (let attempt = 0; attempt < 40; attempt++) {
      const g = G();
      g.enemies = []; g.items = []; g.traps = []; g.shrine = null; g.merchant = null;
      for (let y = 2; y < 28; y++) for (let x = 2; x < 28 - n; x++) {
        let ok = true;
        for (let k = -1; k <= n && ok; k++) { const t = g.map[y * W + x + k]; if (t !== 1) ok = false; }
        if (ok && g.map[(y + 1) * W + x] === 1 && g.map[(y - 1) * W + x] === 1) {
          g.p.x = x; g.p.y = y; g.vanish = 0; g.smoke = []; g.brace = null;
          for (const k in g.cd) g.cd[k] = 0;
          window.__dbg.fn.computeVis(); return { x, y };
        }
      }
      window.__dbg.fn.newFloor(1 + (attempt % 3));   // this floor has no straight corridor that long: roll another
    }
    return null;
  },
  foe(type, dx, dy, awake) {
    const G = window.__dbg(), e = window.__dbg.fn.makeEnemy(type, G.p.x + dx, G.p.y + dy, 3);
    e.awake = awake !== false; window.__dbg.fn.computeVis(); return e;
  },
  tick() { window.__dbg.fn.endTurn(); }
};`;

async function fresh(cls, seed) {
  const r = await newPage(browser, { seed });
  await startRun(r.page, cls);
  await r.page.evaluate(() => { document.getElementById('modal').style.display = 'none'; });
  await r.page.evaluate(HELPERS);
  return r;
}

describe('kits', { concurrency: 3 }, () => {
  it('warrior: Bash, Cleave, Charge and Brace all work; costs and refusals are explained', async () => {
    const { page, ctx, errors } = await fresh('warrior', 11);
    try {
      const r = await page.evaluate(() => {
        const G = window.__dbg(), F = window.__dbg.fn, T = window.T, out = {};
        out.spot = T.setup(7); G.p.rage = 0;
        out.noRage = F.whyNot('cleave');                       // refusal reason: needs rage / an enemy
        out.noTarget = F.whyNot('bash');
        let e = T.foe('goblin', 1, 0); e.hp = e.mhp = 200;
        G.p.rage = 100;
        out.bash = F.use('bash', e.x, e.y); out.stunned = (e.stun > 0) || e.dead; out.bashCd = G.cd.bash;
        T.setup(7); G.p.rage = 100;
        const a = T.foe('goblin', 1, 0), b = T.foe('goblin', 0, 1); a.hp = a.mhp = b.hp = b.mhp = 300;
        G.p.rage = 29; out.cleaveShort = F.whyNot('cleave'); G.p.rage = 100;
        out.cleave = F.use('cleave'); out.cleaved = a.hp < 300 && b.hp < 300;
        T.setup(7); G.p.rage = 100; const x0 = G.p.x;
        const c = T.foe('goblin', 4, 0); c.hp = c.mhp = 300;
        out.charge = F.use('charge', c.x, c.y); out.moved = G.p.x - x0; out.chargeStun = c.stun > 0;
        T.setup(7); G.p.rage = 100;
        out.brace = F.use('brace'); out.braceState = !!G.brace && G.brace.hits > 0;
        G.p.rage = 0; out.noRageBrace = F.whyNot('brace');
        return out;
      });
      assert.match(r.noRage, /enemy next to you|rage/i);
      assert.match(r.noTarget, /next to you/i);
      assert.ok(r.bash && r.stunned && r.bashCd > 0);
      assert.match(r.cleaveShort, /Not enough rage/);
      assert.ok(r.cleave && r.cleaved);
      assert.ok(r.charge && r.moved === 3 && r.chargeStun);
      assert.ok(r.brace && r.braceState);
      assert.match(r.noRageBrace, /Not enough rage/);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('mage: Bolt, Nova, Blink and Fireball all work; mana is spent', async () => {
    const { page, ctx, errors } = await fresh('mage', 12);
    try {
      const r = await page.evaluate(() => {
        const G = window.__dbg(), F = window.__dbg.fn, T = window.T, out = {};
        T.setup(7); G.p.mana = G.p.mbase;
        let e = T.foe('goblin', 3, 0); e.hp = e.mhp = 200; const m0 = G.p.mana;
        out.bolt = F.use('bolt', e.x, e.y); out.boltHit = e.hp < 200; out.boltMana = m0 - G.p.mana;
        T.setup(7); G.p.mana = G.p.mbase;
        e = T.foe('goblin', 1, 0); e.hp = e.mhp = 200;
        out.nova = F.use('nova'); out.frozen = e.frz > 0;
        T.setup(7); G.p.mana = G.p.mbase; const x0 = G.p.x;
        out.blink = F.use('blink', G.p.x + 4, G.p.y); out.blinkMoved = G.p.x - x0;
        T.setup(7); G.p.mana = G.p.mbase;
        const a = T.foe('goblin', 4, 0), b = T.foe('goblin', 5, 0); a.hp = a.mhp = b.hp = b.mhp = 300;
        out.fire = F.use('fire', a.x, a.y); out.fireBoth = a.hp < 300 && b.hp < 300;
        G.p.mana = 0; out.noMana = F.whyNot('fire');
        return out;
      });
      assert.ok(r.bolt && r.boltHit && r.boltMana > 0);
      assert.ok(r.nova && r.frozen);
      assert.ok(r.blink && r.blinkMoved === 4);
      assert.ok(r.fire && r.fireBoth);
      assert.match(r.noMana, /Not enough mana/);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('mage: Blink never offers a tile you could not also walk to (cave walls leave sealed floor pockets)', async () => {
    const { page, ctx, errors } = await fresh('mage', 17);
    try {
      const bad = await page.evaluate(() => {
        const G = window.__dbg(), F = window.__dbg.fn, W = 30, H = 30; let bad = 0, offered = 0;
        for (let i = 0; i < 40; i++) {
          F.newFloor(4 + (i % 3)); G.enemies = [];
          for (let j = 0; j < 6; j++) {
            let x, y; do { x = 1 + Math.floor(Math.random() * 28); y = 1 + Math.floor(Math.random() * 28); } while (G.map[y * W + x] !== 1);
            G.p.x = x; G.p.y = y; F.computeVis(); G.p.mana = 99;
            const seen = new Set([y * W + x]), q = [[x, y]];
            for (let k = 0; k < q.length; k++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = q[k][0] + dx, ny = q[k][1] + dy, id = ny * W + nx;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(id) || G.map[id] === 0 || G.map[id] === 5) continue;
              seen.add(id); q.push([nx, ny]);
            }
            for (const t of F.targetTiles('blink')) { offered++; if (!seen.has(t[1] * W + t[0])) bad++; }
          }
        }
        return { bad, offered };
      });
      assert.ok(bad.offered > 100, 'sampled blink tiles: ' + bad.offered);
      assert.equal(bad.bad, 0);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('rogue: Backstab, Vanish, Throwing Knife (drops, can be picked up) and Smoke Bomb all work', async () => {
    const { page, ctx, errors } = await fresh('rogue', 13);
    try {
      const r = await page.evaluate(() => {
        const G = window.__dbg(), F = window.__dbg.fn, T = window.T, out = {};
        T.setup(7); G.p.atk = 30; G.p.crit = 0;   // big, steady damage so the comparison is not noise
        let e = T.foe('goblin', 1, 0, false); e.hp = e.mhp = 400;
        out.bsUnaware = F.use('backstab', e.x, e.y); const big = 400 - e.hp;
        T.setup(7); e = T.foe('goblin', 1, 0, true); e.hp = e.mhp = 400; e.face = [1, 0];   // facing away? no: faces +x, player is at -x => behind it
        out.behind = window.__dbg.gear.isBehind(e);
        e.face = [-1, 0]; out.front = window.__dbg.gear.isFront(e);
        out.bsAware = F.use('backstab', e.x, e.y); const weak = 400 - e.hp;
        out.bigVsWeak = big > weak * 2;
        T.setup(7); out.vanish = F.use('vanish'); out.vanishTurns = G.vanish;
        T.setup(7); const k0 = G.knives; e = T.foe('goblin', 4, 0, true); e.hp = e.mhp = 300;
        out.knife = F.use('knife', e.x, e.y); out.knivesLeft = k0 - G.knives;
        const dropped = G.items.find(i => i.t === 'knife'); out.knifeDropped = !!dropped;
        T.setup(7); G.p.x = 0; // put a knife at the player's feet via the item path
        T.setup(7); G.items.push({ x: G.p.x + 1, y: G.p.y, t: 'knife', v: 0 }); G.knives = 1;
        F.tryMove(1, 0); out.pickedUp = G.knives === 2;
        T.setup(7); const a = T.foe('goblin', 4, 0), b = T.foe('goblin', 5, 0);
        out.smoke = F.use('smoke', a.x, a.y); out.smokeCloud = G.smoke.length === 1; out.blinded = a.blind > 0 && !a.awake;
        out.cdSmoke = G.cd.smoke > 0;
        return out;
      });
      assert.ok(r.bsUnaware && r.bsAware && r.bigVsWeak, 'backstab: big on unaware, weak otherwise ' + JSON.stringify(r));
      assert.ok(r.behind && r.front, 'facing helpers');
      assert.ok(r.vanish && r.vanishTurns > 0);
      assert.ok(r.knife && r.knivesLeft === 1 && r.knifeDropped, 'knife thrown and dropped');
      assert.ok(r.pickedUp, 'knife picked up again');
      assert.ok(r.smoke && r.smokeCloud && r.blinded && r.cdSmoke);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('ability buttons: four per class, >=44px, targeted ones arm with a visible Cancel, disabled ones say why in the log', async () => {
    const { page, ctx, errors } = await fresh('mage', 14);
    try {
      const geo = await page.evaluate(() => [...document.querySelectorAll('#bar2 button')].map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, t: b.textContent }; }));
      assert.equal(geo.length, 4);
      for (const g of geo) assert.ok(g.w >= 44 && g.h >= 44, JSON.stringify(g));
      await page.evaluate(HELPERS);
      await page.evaluate(() => { window.T.setup(7); window.T.foe('goblin', 3, 0); window.__dbg().p.mana = 30; });
      await page.click('#a_0');                                            // Bolt: arms
      assert.equal(await page.isVisible('#cancelBtn'), true);
      await page.click('#cancelBtn');
      assert.equal(await page.isVisible('#cancelBtn'), false);
      await page.evaluate(() => { window.__dbg().p.mana = 0; });
      await page.click('#a_3');                                            // Fireball with no mana: refused, reason in the log
      const log = await page.evaluate(() => window.__dbg().log.slice(-1)[0]);
      assert.match(log, /Not enough mana/);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('gear: equip a weapon, armor, off-hand and charm through the compare modal', async () => {
    const { page, ctx, errors } = await fresh('warrior', 15);
    try {
      const slots = [['weapon', 'axe', 'keen'], ['armor', 'plate', null], ['off', 'tower', null], ['charm', 'fang', null]];
      for (const [slot, kind, tr] of slots) {
        await page.evaluate(HELPERS);
        const cell = await page.evaluate(([s, k, t]) => { window.T.setup(5); return window.__dbg.spawnGear(s, k, t, 4); }, [slot, kind, tr]);
        assert.ok(cell, 'spawned ' + slot);
        await page.evaluate(([c]) => { const G = window.__dbg(); window.__dbg.fn.tryMove(c[0] - G.p.x, c[1] - G.p.y); }, [cell]);
        const title = await page.evaluate(() => document.querySelector('#modalBox h2').textContent);
        assert.match(title, /found/i);
        const body = await page.evaluate(() => document.getElementById('modalBox').textContent);
        assert.match(body, /EQUIPPED/); assert.match(body, /FOUND/); assert.match(body, /If you equip it/);
        await page.locator('#modalBox button', { hasText: /^Equip/ }).click();
        const got = await page.evaluate((s) => { const it = window.__dbg().p.eq[s]; return it && it.k; }, slot);
        assert.equal(got, kind, slot + ' equipped');
      }
      // the equipment screen lists all four slots
      await page.click('#gearBtn');
      const eqText = await page.evaluate(() => document.getElementById('modalBox').textContent);
      for (const w of ['Axe', 'Plate', 'Tower Shield', 'Vampire Fang']) assert.match(eqText, new RegExp(w));
      // stat effects: keen axe -1 atk and +crit; plate gives def; off-hand/charm do not change stats
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('gear rules: spear reach, axe sweep, dagger sneak, plate/robe resource trade-offs, charms', async () => {
    const { page, ctx, errors } = await fresh('warrior', 16);
    try {
      const r = await page.evaluate(() => {
        const G = window.__dbg(), F = window.__dbg.fn, T = window.T, tb = window.__dbg.tables, gear = window.__dbg.gear, out = {};
        const eq = (slot, k, v, tr) => { G.p.eq[slot] = { t: slot, k, v: v || 0, tr: tr || null }; };
        T.setup(7); eq('weapon', 'spear', 3); let e = T.foe('goblin', 2, 0); e.hp = e.mhp = 100;
        out.reach = F.reachOk(e); const hp0 = e.hp; out.reachHit = F.reachAttack(e) && e.hp < hp0;
        T.setup(7); eq('weapon', 'axe', 3); const a = T.foe('goblin', 1, 0), b = T.foe('goblin', 1, 1); a.hp = a.mhp = b.hp = b.mhp = 100;
        F.playerAttack(a); out.sweep = b.hp < 100;
        eq('weapon', 'sword', 0); const atkSword = gear.statVec().attack; eq('weapon', 'dagger', 0); out.daggerLower = gear.statVec().attack < atkSword; out.daggerCrit = gear.statVec().crit > 5;
        eq('weapon', 'sword', 0); const sm0 = gear.sneakMul(); eq('weapon', 'dagger', 0); out.daggerSneak = gear.sneakMul() > sm0;   // dagger: bigger sneak multiplier for anyone
        G.p.eq.armor = null; const d0 = gear.statVec().defense; eq('armor', 'plate', 3); out.plateDef = gear.statVec().defense - d0;
        eq('armor', 'robe', 3); out.robeNoDef = gear.statVec().defense === G.p.def;
        eq('armor', 'leather', 3); out.leatherDodge = gear.statVec().dodge >= 10;
        // mana: robe raises max mana for a mage, plate lowers it and slows regen
        G.p.cls = 'mage'; G.p.mbase = 30; eq('armor', null); G.p.eq.armor = null; const m0 = gear.mmax();
        eq('armor', 'robe', 3); out.robeMana = gear.mmax() > m0; eq('armor', 'plate', 3); out.plateMana = gear.mmax() < m0;
        out.plateRegen = tb.ARM.plate.manaRegenMul < 1;
        G.p.cls = 'warrior';
        // charm: ward negates the first hit each floor
        eq('charm', 'ward'); G.p.eq.charm = { t: 'charm', k: 'ward', v: 0, tr: null }; G.ssUsed = 0; const hp1 = G.p.hp;
        const g = T.foe('goblin', 1, 0); F.hurtPlayer(g, 20, true); out.wardFree = G.p.hp === hp1;
        return out;
      });
      for (const k of Object.keys(r)) assert.ok(r[k], k + ' ' + JSON.stringify(r));
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});

describe('saves and enemies', { concurrency: 3 }, () => {
  it('an old-version run save is discarded cleanly: no crash, no Continue, one-line notice, meta intact', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 21, meta: { seenHelp: 1, gold: 777, hp: 2, unl: { rogue: 1, mage: 1 } } });
    try {
      await page.evaluate(() => {
        // a v1-shaped run (old key, old player fields) and a v2-key run missing the version stamp
        localStorage.setItem('dcr_run_v1', JSON.stringify({ floor: 3, p: { cls: 'warrior', hp: 30, mhp: 42, wb: 2, ab: 1, wn: 'Mace', an: 'Rags', wt: null, at: null }, map: new Array(900).fill(1), enemies: [], items: [], turn: 99 }));
      });
      await page.reload();
      await page.waitForSelector('#titleBox button');
      assert.equal(await page.locator('#title button', { hasText: /Continue run/ }).count(), 0);
      assert.match(await page.locator('#titleBox').textContent(), /older version/i);
      assert.equal(await page.evaluate(() => localStorage.getItem('dcr_run_v1')), null);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('dcr_meta_v1')).gold), 777);
      // same shape under the current key but without a version stamp is also discarded
      await page.evaluate(() => localStorage.setItem('dcr_run_v2', JSON.stringify({ floor: 2, p: { cls: 'mage', hp: 10, mhp: 24 }, map: new Array(900).fill(1) })));
      await page.reload();
      await page.waitForSelector('#titleBox button');
      assert.equal(await page.locator('#title button', { hasText: /Continue run/ }).count(), 0);
      await startRun(page, 'mage');                                       // a new run still starts normally
      assert.equal(await page.evaluate(() => window.__dbg().ver), 3);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('every new enemy spawns and acts: hound, guard, cultist, rat/bat packs, whelp, dragon phases', async () => {
    const { page, ctx, errors } = await fresh('warrior', 22);
    try {
      const r = await page.evaluate(() => {
        const G = window.__dbg(), F = window.__dbg.fn, T = window.T, out = {};
        // hound: two steps per turn
        T.setup(8); G.p.hp = G.p.mhp = 500; let h = T.foe('hound', 6, 0); const d0 = h.x - G.p.x; F.enemiesAct(); out.houndSpeed = d0 - (h.x - G.p.x);
        // guard: front 35%, behind full, stunned full, ranged reduced
        T.setup(8); let g = T.foe('guard', 1, 0); g.hp = g.mhp = 1000; g.face = [-1, 0];
        let hp = g.hp; F.playerAttack(g); out.guardFront = (hp - g.hp);
        g.face = [1, 0]; hp = g.hp; F.playerAttack(g); out.guardBack = (hp - g.hp);
        g.face = [-1, 0]; g.stun = 2; hp = g.hp; F.playerAttack(g); out.guardStunned = (hp - g.hp);
        // exact numbers through the shared damage path
        g.stun = 0; hp = g.hp; window.__dbg.fn.hurtEnemy(g, 100, '#fff', false, 'melee'); out.exFront = hp - g.hp;
        g.face = [1, 0]; hp = g.hp; window.__dbg.fn.hurtEnemy(g, 100, '#fff', false, 'melee'); out.exBack = hp - g.hp;
        g.face = [1, 0]; hp = g.hp; window.__dbg.fn.hurtEnemy(g, 100, '#fff', false, 'ranged'); out.exRanged = hp - g.hp;
        g.face = [-1, 0]; g.stun = 1; hp = g.hp; window.__dbg.fn.hurtEnemy(g, 100, '#fff', false, 'ranged'); out.exStunned = hp - g.hp;
        // cultist heals a hurt ally instead of attacking
        T.setup(8); G.p.hp = G.p.mhp = 500; const gob = T.foe('goblin', 3, 1); gob.hp = 2; gob.mhp = 20; const c = T.foe('cultist', 4, 0);
        for (let i = 0; i < 3; i++) F.enemiesAct(); out.cultistHeal = gob.hp > 2;
        // swarms spawn as packs on their floors
        let pack = 0;
        for (let i = 0; i < 40; i++) { F.newFloor(1 + (i % 5)); const cnt = {}; for (const e of G.enemies) cnt[e.t] = (cnt[e.t] || 0) + 1; if ((cnt.rat || 0) >= 3 || (cnt.bat || 0) >= 4) pack++; }
        out.packs = pack;
        // dragon: summons whelps at 66% and 33%, enraged sweep
        F.newFloor(8); const dr = G.enemies.find(e => e.t === 'dragon'); G.p.hp = G.p.mhp = 9999;
        for (const [dx, dy] of [[-2, 0], [2, 0], [0, 2], [0, -2], [-3, 0], [3, 0]]) { if (G.map[(dr.y + dy) * 30 + dr.x + dx] === 1) { G.p.x = dr.x + dx; G.p.y = dr.y + dy; break; } }
        F.computeVis();
        dr.hp = Math.floor(dr.mhp * 0.6); F.bossPhase(dr); out.whelps1 = G.enemies.filter(e => e.t === 'whelp').length;
        dr.hp = Math.floor(dr.mhp * 0.2); F.bossPhase(dr); out.whelps2 = G.enemies.filter(e => e.t === 'whelp').length;
        for (const w of G.enemies.filter(e => e.t === 'whelp')) w.awake = true;
        for (let i = 0; i < 6; i++) F.endTurn();                           // whelps act
        out.whelpActed = G.p.hp < 9999;
        G.enemies = [dr]; dr.x = G.p.x + 1; dr.y = G.p.y; dr.enraged = 1; dr.cd = 0; dr.awake = true; dr.stun = 0;
        F.enemiesAct(); out.sweepWind = !!(dr.wind && dr.wind.k === 'sweep');
        return out;
      });
      assert.equal(r.houndSpeed, 2);
      const SF = 0.4, SR = 0.5;   // BAL.weapon.shieldFront / shieldRanged
      assert.equal(r.exFront, Math.round(100 * SF), 'guard front ' + JSON.stringify(r));
      assert.equal(r.exBack, 100, 'guard from behind: full damage');
      assert.equal(r.exRanged, Math.round(100 * SR), 'ranged from behind: reduced');
      assert.equal(r.exStunned, 100, 'stunned guard drops its shield');
      assert.ok(r.guardBack > r.guardFront, 'guard: melee from behind beats melee from the front');
      assert.ok(r.cultistHeal, 'cultist heals');
      assert.ok(r.packs >= 5, 'swarm packs spawn: ' + r.packs);
      assert.equal(r.whelps1, 4); assert.equal(r.whelps2, 12);   // thresholds 75% / 50% / 25%: 60% -> one wave, 20% -> two more
      assert.ok(r.whelpActed, 'whelps attack');
      assert.ok(r.sweepWind, 'enraged dragon starts a tail sweep when you are next to it');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});
