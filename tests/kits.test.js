// Kit tests: every class uses each of its four abilities (cost, cooldown, effect), gear goes into all four slots and its rules
// work, an old-version run save is discarded cleanly, and every new enemy spawns and acts. Drives the game through window.__dbg
// like the bot does. Every test has its own browser context and runs concurrently with the others.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, startRun, openRun, quiet, HELPERS, CONC, reload } = require('./lib/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

async function fresh(cls, seed) {
  const r = await openRun(browser, cls, { seed });
  await r.page.evaluate(HELPERS);
  return r;
}

describe('kits', { concurrency: CONC }, () => {
  it('warrior: Bash, Cleave, Charge and Brace work; costs, cooldowns, rage gain/decay and refusals are right', async () => {
    const { page, ctx, errors } = await fresh('warrior', 11);
    try {
      const r = await page.evaluate(() => {
        const G = window.__dbg(), F = window.__dbg.fn, T = window.T, B = window.__dbg.tables.BAL, gear = window.__dbg.gear, out = {};
        out.spot = T.setup(7); G.p.rage = 0;
        out.noRage = F.whyNot('cleave');                       // refusal reason: needs rage / an enemy
        out.noTarget = F.whyNot('bash');
        // Bash: stuns, sets its cooldown (endTurn counts one turn off it)
        let e = T.foe('goblin', 1, 0); e.hp = e.mhp = 200;
        G.p.rage = 50;
        out.bash = F.use('bash', e.x, e.y); out.stunned = (e.stun > 0) || e.dead; out.bashCd = G.cd.bash; out.bashCdWant = gear.cdFor('bash') - 1;
        out.bashRage = G.p.rage; out.bashRageWant = 50 + B.rage.dealt;   // Bash costs no rage; the hit gives rage
        // Cleave: needs rage, hits BOTH neighbours, spends exactly its cost, gains rage per enemy hit
        T.setup(7);
        const a = T.foe('goblin', 1, 0), b = T.foe('goblin', 0, 1); a.hp = a.mhp = b.hp = b.mhp = 300; a.stun = b.stun = 5;
        G.p.rage = B.ability.cleave.rage - 1; out.cleaveShort = F.whyNot('cleave'); G.p.rage = 60;
        out.cleave = F.use('cleave'); out.cleaved = a.hp < 300 && b.hp < 300;
        out.cleaveRage = G.p.rage; out.cleaveRageWant = 60 - B.ability.cleave.rage + 2 * Math.round(B.rage.dealt / 2);
        // Charge: lands next to the target, stuns it, cannot target an adjacent or a too-far enemy
        T.setup(7); G.p.rage = 100; const x0 = G.p.x;
        const adj = T.foe('goblin', 1, 0); out.chargeAdjacent = F.targetTiles('charge').length; adj.dead = true; G.enemies = [];
        const c = T.foe('goblin', 4, 0); c.hp = c.mhp = 300;
        out.charge = F.use('charge', c.x, c.y); out.moved = G.p.x - x0; out.chargeStun = c.stun > 0;
        // Brace: sets the state, a braced hit hurts far less than an unbraced one, refused without rage
        T.setup(7); G.p.rage = 100; G.p.def = 0;
        const hit = (n) => { let s = 0; for (let i = 0; i < n; i++) { const hp = G.p.hp; G.p.hp = G.p.mhp = 9999; const g = T.foe('goblin', 1, 0); F.hurtPlayer(g, 40, true); s += 9999 - G.p.hp; g.dead = true; G.enemies = []; } return s / n; };
        out.plainHit = hit(6);
        G.p.def = 12; out.defHit = hit(6); G.p.def = 0;                 // BAL.combat.armorK = 12: 12 defense halves a hit
        out.brace = F.use('brace'); out.braceState = !!G.brace && G.brace.hits > 0;
        G.brace = { hits: 99, t: 99, reflect: 0 }; out.braceHit = hit(6); G.brace = null;
        G.p.rage = 0; out.noRageBrace = F.whyNot('brace');
        // rage: +dealt per melee hit, +taken per hit suffered, -decay per quiet turn
        T.setup(7); G.p.rage = 0; G.p.dodge = 0; const k = T.foe('goblin', 1, 0); k.hp = k.mhp = 500;
        F.playerAttack(k); out.rageDealt = G.p.rage;
        G.p.rage = 0; G.p.hp = G.p.mhp = 9999; F.hurtPlayer(k, 10, true); out.rageTaken = G.p.rage;
        T.setup(7); G.p.rage = 50; F.endTurn(); out.rageDecay = G.p.rage;
        // crits: a certain crit hits about twice as hard as a certain non-crit
        T.setup(7); G.p.atk = 50; const cr = T.foe('goblin', 1, 0); cr.hp = cr.mhp = 9999;
        G.p.crit = -5; let h0 = cr.hp; F.playerAttack(cr); out.hitPlain = h0 - cr.hp;
        G.p.crit = 5; h0 = cr.hp; F.playerAttack(cr); out.hitCrit = h0 - cr.hp;
        return out;
      });
      const B = { dealt: 8, taken: 12, decay: 4 };
      assert.match(r.noRage, /enemy next to you|rage/i);
      assert.match(r.noTarget, /next to you/i);
      assert.ok(r.bash && r.stunned);
      assert.equal(r.bashCd, r.bashCdWant); assert.ok(r.bashCd > 0, 'Bash has a cooldown');
      assert.equal(r.bashRage, r.bashRageWant);
      assert.match(r.cleaveShort, /needs \d+ rage/);
      assert.ok(r.cleave && r.cleaved, 'Cleave hits both neighbours');
      assert.equal(r.cleaveRage, r.cleaveRageWant, 'Cleave spends its rage and gains per hit');
      assert.equal(r.chargeAdjacent, 0, 'Charge cannot target an adjacent enemy');
      assert.ok(r.charge && r.moved === 3 && r.chargeStun);
      assert.ok(r.brace && r.braceState);
      assert.ok(r.defHit < r.plainHit * 0.65, `defense reduces damage taken: ${r.defHit} vs ${r.plainHit}`);
      assert.ok(r.hitCrit > r.hitPlain * 1.8, `a crit hits about twice as hard: ${r.hitCrit} vs ${r.hitPlain}`);
      assert.ok(r.braceHit < r.plainHit * 0.75, `a braced hit hurts far less: ${r.braceHit} vs ${r.plainHit}`);
      assert.match(r.noRageBrace, /needs \d+ rage/);
      assert.equal(r.rageDealt, B.dealt); assert.equal(r.rageTaken, B.taken); assert.equal(r.rageDecay, 50 - B.decay);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('mage: Bolt, Nova, Blink and Fireball work; mana is spent, regenerates per turn and per kill', async () => {
    const { page, ctx, errors } = await fresh('mage', 12);
    try {
      const r = await page.evaluate(() => {
        const G = window.__dbg(), F = window.__dbg.fn, T = window.T, B = window.__dbg.tables.BAL, out = {};
        T.setup(7); G.p.mana = G.p.mbase;
        let e = T.foe('goblin', 3, 0); e.hp = e.mhp = 200; const m0 = G.p.mana, mf0 = G.p.mf || 0;
        out.bolt = F.use('bolt', e.x, e.y); out.boltHit = e.hp < 200; out.boltMana = m0 - G.p.mana; out.boltWant = B.ability.bolt.mana - Math.floor(mf0 + B.mana.regen);   // the whole mana points regenerated in the turn it took (the fraction carries over)
        T.setup(7); G.p.mana = G.p.mbase;
        e = T.foe('goblin', 1, 0); e.hp = e.mhp = 200;
        out.nova = F.use('nova'); out.frozen = e.frz > 0;
        T.setup(7); G.p.mana = G.p.mbase; const x0 = G.p.x;
        out.blink = F.use('blink', G.p.x + 4, G.p.y); out.blinkMoved = G.p.x - x0;
        T.setup(7); G.p.mana = G.p.mbase;
        const a = T.foe('goblin', 4, 0), b = T.foe('goblin', 5, 0); a.hp = a.mhp = b.hp = b.mhp = 300;
        out.fire = F.use('fire', a.x, a.y); out.fireBoth = a.hp < 300 && b.hp < 300;
        G.p.mana = 0; out.noMana = F.whyNot('fire');
        // regeneration: per turn, and per kill
        T.setup(7); G.p.mana = 5; { let mf = G.p.mf || 0, want = 5; for (let i = 0; i < 3; i++) { mf += B.mana.regen; const w = Math.floor(mf); mf -= w; want += w; } out.regenWant = want; } for (let i = 0; i < 3; i++) F.endTurn(); out.regen = G.p.mana;
        T.setup(7); G.p.mana = 0; const v = T.foe('goblin', 2, 0, false); window.__dbg.api.killEnemy(v); out.killMana = G.p.mana; out.killWant = B.mana.perKill;
        return out;
      });
      assert.ok(r.bolt && r.boltHit); assert.equal(r.boltMana, r.boltWant, 'Bolt spends its mana');
      assert.ok(r.nova && r.frozen);
      assert.ok(r.blink && r.blinkMoved === 4);
      assert.ok(r.fire && r.fireBoth, 'Fireball blast covers neighbouring tiles');
      assert.match(r.noMana, /needs \d+ mana/);
      assert.equal(r.regen, r.regenWant, 'mana regenerates every turn (whole points, the fraction carries over)');
      assert.equal(r.killMana, r.killWant, 'a kill gives mana');
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

  it('rogue: Backstab (unaware / behind / frontal), Vanish, Throwing Knife (drops, can be picked up) and Smoke Bomb all work', async () => {
    const { page, ctx, errors } = await fresh('rogue', 13);
    try {
      const r = await page.evaluate(() => {
        const G = window.__dbg(), F = window.__dbg.fn, T = window.T, out = {};
        const prep = (face, awake) => { T.setup(7); G.p.atk = 30; G.p.crit = 0; G.p.hp = G.p.mhp; const e = T.foe('goblin', 1, 0, awake); e.hp = e.mhp = 400; if (face) e.face = face; return e; };   // big, steady damage so the comparison is not noise
        let e = prep(null, false);
        out.bsUnaware = F.use('backstab', e.x, e.y); const big = 400 - e.hp;
        e = prep([1, 0], true);                                // faces +x, the player is at -x: behind it
        out.behind = window.__dbg.gear.isBehind(e);
        out.bsBehind = F.use('backstab', e.x, e.y); const behindDmg = 400 - e.hp;
        e = prep([-1, 0], true);                               // faces the player
        out.front = window.__dbg.gear.isFront(e);
        out.bsAware = F.use('backstab', e.x, e.y); const weak = 400 - e.hp;
        out.bigVsWeak = big > weak * 2; out.behindVsWeak = behindDmg > weak * 2;
        // Vanish: enemies lose you. The adjacent goblin does not hit, and you are hidden for the set number of turns
        e = prep(null, true); G.p.hp = G.p.mhp; const hp0 = G.p.hp;
        out.vanish = F.use('vanish'); out.vanishTurns = G.vanish; out.vanishHp = G.p.hp === hp0; out.vanishAwake = e.awake;
        T.setup(7); const k0 = G.knives; e = T.foe('goblin', 4, 0, true); e.hp = e.mhp = 300;
        out.knife = F.use('knife', e.x, e.y); out.knivesLeft = k0 - G.knives;
        const dropped = G.items.find(i => i.t === 'knife'); out.knifeDropped = !!dropped;
        T.setup(7); G.items.push({ x: G.p.x + 1, y: G.p.y, t: 'knife', v: 0 }); G.knives = 1;   // a knife next to you
        F.tryMove(1, 0); out.pickedUp = G.knives === 2;
        T.setup(7); const a = T.foe('goblin', 4, 0), b = T.foe('goblin', 5, 0);
        out.smoke = F.use('smoke', a.x, a.y); out.smokeCloud = G.smoke.length === 1; out.blinded = a.blind === window.__dbg.tables.BAL.ability.smoke.blindTurns - 1 && !a.awake;   // blind for blindTurns, one already counted down
        out.cdSmoke = G.cd.smoke > 0;
        // sneak attack: a plain melee hit on an enemy that has not noticed you is a multiple of the same hit on an awake one
        const hitOn = (awake) => { T.setup(7); G.p.atk = 50; G.p.crit = -5; const t = T.foe('goblin', 1, 0, awake); t.hp = t.mhp = 9999; F.playerAttack(t); return 9999 - t.hp; };
        const unaware = hitOn(false), aware = hitOn(true); out.sneak = unaware > aware * 1.7;
        return out;
      });
      assert.ok(r.bsUnaware && r.bsBehind && r.bsAware && r.bigVsWeak, 'backstab: big on unaware, weak otherwise ' + JSON.stringify(r));
      assert.ok(r.behind && r.front, 'facing helpers');
      assert.ok(r.behindVsWeak, 'backstab from behind is a real backstab: ' + JSON.stringify(r));
      assert.ok(r.vanish && r.vanishTurns > 0 && r.vanishHp && r.vanishAwake === false, 'vanish: the adjacent enemy loses you ' + JSON.stringify(r));
      assert.ok(r.knife && r.knivesLeft === 1 && r.knifeDropped, 'knife thrown and dropped');
      assert.ok(r.pickedUp, 'knife picked up again');
      assert.ok(r.smoke && r.smokeCloud && r.blinded && r.cdSmoke);
      assert.ok(r.sneak, 'a sneak attack on an unaware enemy hits much harder');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('ability buttons: four per class, >=44px, targeted ones arm with a visible Cancel, disabled ones are greyed and say why in the log', async () => {
    const { page, ctx, errors } = await fresh('mage', 14);
    try {
      const geo = await page.evaluate(() => [...document.querySelectorAll('#bar2 button')].map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, t: b.textContent }; }));
      assert.equal(geo.length, 4);
      for (const g of geo) assert.ok(g.w >= 44 && g.h >= 44, JSON.stringify(g));
      await page.evaluate(() => { window.T.setup(7); window.T.foe('goblin', 3, 0); window.__dbg().p.mana = 30; });
      await quiet(page);   // the floor-start banner animation has ended (see quiet() in the harness for why that matters)
      await page.click('#a_0');                                            // Bolt: arms
      assert.equal(await page.evaluate(() => document.getElementById('a_0').classList.contains('armed')), true);
      // while a target is being picked nothing may cover the map: every point of the map area must hit the canvas
      const covered = await page.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(), bad = []; for (let y = r.top + 6; y < r.bottom; y += 12) for (let x = r.left + 6; x < r.right; x += 12) { const e = document.elementFromPoint(x, y); if (!e || e.id !== 'c') bad.push((e && (e.id || e.className)) + '@' + Math.round(x) + ',' + Math.round(y)); } return bad; });
      assert.deepEqual(covered, [], 'something overlays the map while targeting');
      // a real tap on an enemy standing low on the middle column (where the old floating Cancel button sat) casts the spell
      const box = await page.locator('#c').boundingBox();
      const ts = Math.max(28, Math.floor(Math.min(box.width, box.height) / 11.5));
      const k = Math.floor((box.height / 2 - 30) / ts);
      const low = await page.evaluate((k) => { const G = window.__dbg(); G.enemies.length = 0; G.p.x = 15; G.p.y = 10; for (let i = 0; i <= k; i++) G.map[(10 + i) * 30 + 15] = 1; const t = window.T.foe('goblin', 0, k); t.hp = t.mhp = 999; return true; }, k);
      await quiet(page);
      const ty = box.y + box.height / 2 + k * ts;
      assert.ok(low && ty > box.y + box.height - 8 - 44 - 10 && ty < box.y + box.height, 'the target tile is in the strip the Cancel button used to cover: ' + ty + ' in ' + JSON.stringify(box));
      await page.mouse.click(box.x + box.width / 2, ty);
      assert.ok(await page.evaluate(() => window.__dbg().enemies[0].hp < 999), 'the bottom-middle enemy was hit');
      await page.evaluate(() => { const G = window.__dbg(); G.enemies.length = 0; window.T.foe('goblin', 3, 0); G.p.mana = 30; G.cd.bolt = 0; });
      await quiet(page);
      await page.click('#a_0');
      await page.click('#a_0');                                            // the armed button is the Cancel
      assert.equal(await page.evaluate(() => document.getElementById('a_0').classList.contains('armed')), false);
      assert.equal(await page.evaluate(() => document.getElementById('a_3').classList.contains('dis')), false, 'Fireball is usable with mana');
      await page.evaluate(() => { window.__dbg().p.mana = 0; });
      await quiet(page);
      await page.click('#a_3');                                            // Fireball with no mana: refused, reason in the log, button greyed
      assert.match(await page.evaluate(() => window.__dbg().log.slice(-1)[0]), /needs \d+ mana/);
      assert.equal(await page.evaluate(() => document.getElementById('a_3').classList.contains('dis')), true, 'Fireball is greyed out without mana');
      // the bar's other buttons follow the state too: Potion needs a potion, Stairs needs the stairs
      const dis = (id) => page.evaluate((i) => document.getElementById(i).classList.contains('dis'), id);
      await page.evaluate(() => { const G = window.__dbg(); G.inv.pot = 0; G.enemies = []; window.__dbg.fn.endTurn(); });
      assert.equal(await dis('b_pot'), true, 'Potion is greyed out with none left'); assert.equal(await dis('b_down'), true, 'Stairs is greyed out away from the stairs');
      await page.evaluate(() => { const G = window.__dbg(); G.inv.pot = 2; const k = G.map.indexOf(2); G.p.x = k % 30; G.p.y = Math.floor(k / 30); window.__dbg.fn.endTurn(); });
      assert.equal(await dis('b_pot'), false); assert.equal(await dis('b_down'), false, 'Stairs is usable on the stairs');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('gear: equip a weapon, armor, off-hand and charm through the compare modal', async () => {
    const { page, ctx, errors } = await fresh('warrior', 15);
    try {
      const slots = [['weapon', 'axe', 'keen'], ['armor', 'plate', null], ['off', 'tower', null], ['charm', 'fang', null]];
      for (const [slot, kind, tr] of slots) {
        const cell = await page.evaluate(([s, k, t]) => { window.T.setup(5); return window.__dbg.spawnGear(s, k, t, 4); }, [slot, kind, tr]);
        assert.ok(cell, 'spawned ' + slot);
        await page.evaluate(([c]) => { const G = window.__dbg(); window.__dbg.fn.tryMove(c[0] - G.p.x, c[1] - G.p.y); }, [cell]);
        const title = await page.evaluate(() => document.querySelector('#modalBox h2').textContent);
        assert.match(title, /found/i);
        const body = await page.evaluate(() => document.getElementById('modalBox').textContent);
        assert.match(body, /replaces/);
        assert.ok(await page.locator('#modalBox .dlt').count() >= 1, 'stat changes are shown as chips');
        const cls = await page.locator('#modalBox .dlt').evaluateAll((els) => els.map((e) => e.className + '|' + e.textContent));
        for (const c of cls) assert.ok(/^dlt up\|\w+ \+\d+%?$|^dlt dn\|\w+ \u2212\d+%?$|^dlt same/.test(c), 'delta chip is signed and coloured: ' + c);
        assert.ok(await page.locator('#modalBox .rl').count() <= 2, 'at most two rule lines');
        assert.ok(body.replace(/Equip|Leave/g, '').split(/\s+/).length < 40, 'short: ' + body);
        await page.locator('#modalBox button', { hasText: /^Equip/ }).click();
        const got = await page.evaluate((s) => { const it = window.__dbg().p.eq[s]; return it && it.k; }, slot);
        assert.equal(got, kind, slot + ' equipped');
      }
      // the equipment screen lists all four slots
      await page.click('#gearBtn');
      const eqText = await page.evaluate(() => document.getElementById('modalBox').textContent);
      for (const w of ['Axe', 'Plate', 'Tower Shield', 'Vampire Fang']) assert.match(eqText, new RegExp(w));
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('gear rules: tier attack, spear reach, axe sweep, dagger sneak, plate/robe trade-offs, charms, off-hand class lock', async () => {
    const { page, ctx, errors } = await fresh('warrior', 16);
    try {
      const r = await page.evaluate(() => {
        const G = window.__dbg(), F = window.__dbg.fn, T = window.T, tb = window.__dbg.tables, gear = window.__dbg.gear, out = {};
        const eq = (slot, k, v, tr) => { G.p.eq[slot] = { t: slot, k, v: v || 0, tr: tr || null }; };
        eq('weapon', 'sword', 0); const atk0 = gear.statVec().attack; eq('weapon', 'sword', 7); out.tierAtk = gear.statVec().attack - atk0;   // +7 tier = +7 attack
        T.setup(7); eq('weapon', 'spear', 3); let e = T.foe('goblin', 2, 0); e.hp = e.mhp = 100;
        out.reach = F.reachOk(e); const hp0 = e.hp; out.reachHit = F.reachAttack(e) && e.hp < hp0;
        T.setup(7); eq('weapon', 'axe', 3); const a = T.foe('goblin', 1, 0), b = T.foe('goblin', 1, 1); a.hp = a.mhp = b.hp = b.mhp = 100;
        F.playerAttack(a); out.sweep = b.hp < 100;
        eq('weapon', 'sword', 0); const atkSword = gear.statVec().attack; eq('weapon', 'dagger', 0); out.daggerLower = gear.statVec().attack < atkSword; out.daggerCrit = gear.statVec().crit > 5;
        eq('weapon', 'sword', 0); const sm0 = gear.sneakMul(); eq('weapon', 'dagger', 0); out.daggerSneak = gear.sneakMul() > sm0;   // dagger: bigger sneak multiplier for anyone
        G.p.eq.armor = null; const d0 = gear.statVec().defense; eq('armor', 'plate', 3); out.plateDef = gear.statVec().defense - d0; out.plateDefWant = 3 + tb.ARM.plate.def;
        eq('armor', 'robe', 3); out.robeNoDef = gear.statVec().defense === G.p.def;
        eq('armor', 'leather', 3); out.leatherDodge = gear.statVec().dodge >= 10;
        // mana: robe raises max mana for a mage, plate lowers it and slows regen
        G.p.cls = 'mage'; G.p.mbase = 30; eq('armor', null); G.p.eq.armor = null; const m0 = gear.mmax();
        eq('armor', 'robe', 3); out.robeMana = gear.mmax() > m0; eq('armor', 'plate', 3); out.plateMana = gear.mmax() < m0;
        out.plateRegen = tb.ARM.plate.manaRegenMul < 1;
        // off-hand class lock: generated off-hands only ever belong to the class that finds them
        out.offLock = true;
        for (const cls of ['warrior', 'rogue', 'mage']) { G.p.cls = cls; for (let i = 0; i < 25; i++) { const o = gear.newGear('off', 3, false); if (tb.OFF[o.k].cls !== cls) out.offLock = false; } }
        G.p.cls = 'warrior';
        // charms: ward negates the first hit each floor; fang heals on a kill
        G.p.eq.charm = { t: 'charm', k: 'ward', v: 0, tr: null }; G.ssUsed = 0; const hp1 = G.p.hp;
        const g = T.foe('goblin', 1, 0); F.hurtPlayer(g, 20, true); out.wardFree = G.p.hp === hp1;
        T.setup(7); G.p.eq.charm = { t: 'charm', k: 'fang', v: 0, tr: null }; G.p.hp = 10; const f = T.foe('goblin', 3, 0, false); window.__dbg.api.killEnemy(f); out.fangHeal = G.p.hp > 10;
        return out;
      });
      assert.equal(r.tierAtk, 7, 'weapon tier adds attack');
      assert.equal(r.plateDef, r.plateDefWant, 'plate defense = tier + its own bonus');
      for (const k of Object.keys(r)) if (!/^(tierAtk|plateDef|plateDefWant)$/.test(k)) assert.ok(r[k], k + ' ' + JSON.stringify(r));
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('perks: stat perks change the stats, Second Wind saves you once per floor', async () => {
    const { page, ctx, errors } = await fresh('warrior', 26);
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, G = D(), F = D.fn, T = window.T, p = G.p, out = {};
        const atk0 = p.atk, mhp0 = p.mhp;
        D.grant('glass'); out.glassAtk = p.atk - atk0; out.glassHp = p.mhp; out.glassWant = Math.max(8, Math.round(mhp0 * 0.75));
        // level-up: enough XP gives a level, more max HP and a perk to choose
        const B = D.tables.BAL, need = B.xp.base + p.lvl * B.xp.perLevel, lvl0 = p.lvl, mhp1 = p.mhp;
        p.xp = need - 1; T.setup(7); D.api.killEnemy(T.foe('goblin', 3, 0, false));
        out.lvl = p.lvl - lvl0; out.lvlHp = p.mhp - mhp1; out.pending = G.pending; G.pending = 0;
        D.grant('second'); T.setup(7); p.hp = 5; p.dodge = 0;
        const g = T.foe('goblin', 1, 0);
        F.hurtPlayer(g, 500, true); out.saved = p.hp; out.used = !!G.swUsed;
        p.hp = 5; F.hurtPlayer(g, 500, true); out.second = p.hp;
        return out;
      });
      assert.equal(r.glassAtk, 5, 'Glass Cannon: +5 attack'); assert.equal(r.glassHp, r.glassWant, 'Glass Cannon: -25% max HP');
      assert.equal(r.lvl, 1, 'enough XP levels you up'); assert.ok(r.lvlHp > 0, 'a level gives max HP'); assert.equal(r.pending, 1, 'and a perk choice');
      assert.equal(r.saved, 1, 'Second Wind leaves you at 1 HP'); assert.ok(r.used);
      assert.ok(r.second <= 0, 'only once per floor');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('traps: spike damage (halved by Trapfinder), dart poison, alarm wakes every enemy', async () => {
    const { page, ctx, errors } = await fresh('warrior', 27);
    try {
      const r = await page.evaluate(() => {
        const D = window.__dbg, G = D(), F = D.fn, T = window.T, B = D.tables.BAL, p = G.p, out = {};
        T.setup(7); p.dodge = 0;
        const trap = (k) => { const t = { x: p.x, y: p.y, k, rev: 0, done: 0 }; G.traps = [t]; return t; };
        p.hp = p.mhp = 100; D.api.springPlayer(trap('spike')); out.spike = 100 - p.hp; out.spikeWant = B.trap.spikeBase + G.floor;
        p.hp = p.mhp = 100; D.api.springPlayer(trap('dart')); out.dartTurns = G.ppois && G.ppois.t; out.dartDmg = G.ppois && G.ppois.d;
        const hp0 = p.hp; F.endTurn(); out.dartTick = hp0 - p.hp; G.ppois = null;
        const e1 = T.foe('goblin', 3, 0, false), e2 = T.foe('rat', 4, 0, false);
        D.api.springPlayer(trap('alarm')); out.alarm = e1.awake && e2.awake;
        D.grant('trapper'); p.hp = p.mhp = 100; D.api.springPlayer(trap('spike')); out.spikeHalf = 100 - p.hp;
        return out;
      });
      assert.equal(r.spike, r.spikeWant, 'a spike trap hurts'); assert.equal(r.spikeHalf, Math.ceil(r.spikeWant / 2), 'Trapfinder halves it');
      assert.ok(r.dartTurns > 0 && r.dartTick === r.dartDmg, 'a dart poisons: damage every turn');
      assert.ok(r.alarm, 'an alarm wakes everything');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('an old-version run save is discarded cleanly: no crash, no Continue, one-line notice, meta intact', async () => {
    const { page, ctx, errors } = await newPage(browser, { seed: 21, meta: { seenHelp: 1, gold: 777, hp: 2, unl: { rogue: 1, mage: 1 } } });
    try {
      // a v1-shaped run (old key, old player fields)
      await page.evaluate(() => {
        localStorage.setItem('dcr_run_v1', JSON.stringify({ floor: 3, p: { cls: 'warrior', hp: 30, mhp: 42, wb: 2, ab: 1, wn: 'Mace', an: 'Rags', wt: null, at: null }, map: new Array(900).fill(1), enemies: [], items: [], turn: 99 }));
      });
      await reload(page);
      await page.waitForSelector('#titleBox button');
      assert.equal(await page.locator('#title button', { hasText: /Continue run/ }).count(), 0);
      assert.match(await page.locator('#titleBox').textContent(), /old run save/i);
      assert.equal(await page.evaluate(() => localStorage.getItem('dcr_run_v1')), null);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('dcr_meta_v1')).gold), 777);
      // same shape under the current key but without a version stamp is also discarded
      await page.evaluate(() => localStorage.setItem('dcr_run_v2', JSON.stringify({ floor: 2, p: { cls: 'mage', hp: 10, mhp: 24 }, map: new Array(900).fill(1) })));
      await reload(page);
      await page.waitForSelector('#titleBox button');
      assert.equal(await page.locator('#title button', { hasText: /Continue run/ }).count(), 0);
      await startRun(page, 'mage');                                       // a new run still starts normally
      assert.equal(await page.evaluate(() => window.__dbg().ver), 3);
      // a complete, well-formed run whose version stamp is unknown (1 = too old, 99 = from the future) is discarded too
      for (const ver of [1, 99]) {
        await page.evaluate(async (v) => {                       // tamper with the run in localStorage AND in the IndexedDB mirror
          const idb = (fn) => new Promise((res) => { const rq = indexedDB.open('dcr_run_mirror', 1); rq.onsuccess = () => fn(rq.result, res); });
          const read = () => idb((db, res) => { const g = db.transaction('s', 'readonly').objectStore('s').get('run2'); g.onsuccess = () => res(g.result); });
          window.__dbg.fn.save(); const ls = localStorage.getItem('dcr_run_v2');
          for (let i = 0; i < 500 && (await read()) !== ls; i++) await new Promise((r) => setTimeout(r, 10));   // the game's own mirror write has landed
          const o = JSON.parse(ls); o.ver = v; const js = JSON.stringify(o); localStorage.setItem('dcr_run_v2', js);
          await idb((db, res) => { const tx = db.transaction('s', 'readwrite'); tx.objectStore('s').put(js, 'run2'); tx.oncomplete = () => res(); });
        }, ver);
        await reload(page);
        await page.waitForSelector('#titleBox button');
        assert.equal(await page.locator('#title button', { hasText: /Continue run/ }).count(), 0, 'version ' + ver + ' run is not offered');
        await startRun(page, 'mage');
      }
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('enemies: hound speed, guard shield numbers, ogre pace, cultist heal, packs, wind-up telegraphs, dragon phases and enrage', async () => {
    const { page, ctx, errors } = await fresh('warrior', 22);
    try {
      const r = await page.evaluate(() => {
        const G = window.__dbg(), F = window.__dbg.fn, T = window.T, B = window.__dbg.tables.BAL, out = {};
        // hound: two steps per turn
        T.setup(8); G.p.hp = G.p.mhp = 500; let h = T.foe('hound', 6, 0); const d0 = h.x - G.p.x; F.enemiesAct(); out.houndSpeed = d0 - (h.x - G.p.x);
        // ogre acts only every other turn: four enemy turns = two steps
        T.setup(8); G.p.hp = G.p.mhp = 500; const og = T.foe('ogre', 6, 0); const o0 = og.x; for (let i = 0; i < 4; i++) F.enemiesAct(); out.ogreSteps = o0 - og.x;
        // guard: exact numbers through the shared damage path
        T.setup(8); let g = T.foe('guard', 1, 0); g.hp = g.mhp = 1000; g.face = [-1, 0];
        let hp = g.hp; g.stun = 0; F.hurtEnemy(g, 100, '#fff', false, 'melee'); out.exFront = hp - g.hp;
        g.face = [1, 0]; hp = g.hp; F.hurtEnemy(g, 100, '#fff', false, 'melee'); out.exBack = hp - g.hp;
        g.face = [1, 0]; hp = g.hp; F.hurtEnemy(g, 100, '#fff', false, 'ranged'); out.exRanged = hp - g.hp;
        g.face = [-1, 0]; g.stun = 1; hp = g.hp; F.hurtEnemy(g, 100, '#fff', false, 'ranged'); out.exStunned = hp - g.hp;
        // cultist heals a hurt ally instead of attacking
        T.setup(8); G.p.hp = G.p.mhp = 500; const gob = T.foe('goblin', 3, 1); gob.hp = 2; gob.mhp = 20; const c = T.foe('cultist', 4, 0);
        for (let i = 0; i < 3; i++) F.enemiesAct(); out.cultistHeal = gob.hp > 2;
        // wind-up telegraph: a marked attack does nothing if you are not on the marked tiles, and hurts if you are
        T.setup(8); G.p.hp = G.p.mhp = 500; const tr = T.foe('troll', 1, 0); tr.hp = tr.mhp = 500;
        tr.wind = { k: 'smash', tiles: [[G.p.x, G.p.y + 1], [G.p.x + 1, G.p.y + 1]], dx: 1, dy: 0 }; F.enemiesAct(); out.windMiss = G.p.hp === 500; out.windCd = tr.cd > 0;
        tr.cd = 0; tr.wind = { k: 'smash', tiles: [[G.p.x, G.p.y]], dx: 1, dy: 0 }; F.enemiesAct(); out.windHit = G.p.hp < 500;
        // swarms spawn as packs on their floors
        let pack = 0;
        for (let i = 0; i < 40; i++) { F.newFloor(1 + (i % 5)); const cnt = {}; for (const e of G.enemies) cnt[e.t] = (cnt[e.t] || 0) + 1; if ((cnt.rat || 0) >= 3 || (cnt.bat || 0) >= 4) pack++; }
        out.packs = pack;
        // dragon: summons whelps at 66% and 33%, enrages below its threshold (not before), enraged sweep
        F.newFloor(8); const dr = G.enemies.find(e => e.t === 'dragon'); G.p.hp = G.p.mhp = 9999;
        for (const [dx, dy] of [[-2, 0], [2, 0], [0, 2], [0, -2], [-3, 0], [3, 0]]) { if (G.map[(dr.y + dy) * 30 + dr.x + dx] === 1) { G.p.x = dr.x + dx; G.p.y = dr.y + dy; break; } }
        F.computeVis(); const atk0 = dr.atk; dr.awake = true;
        dr.hp = Math.ceil(dr.mhp * (B.enemyAi.enrageFrac + 0.05)); const keep = G.enemies.slice(); G.enemies = [dr]; F.enemiesAct(); out.earlyEnrage = !!dr.enraged;
        dr.hp = Math.floor(dr.mhp * (B.enemyAi.enrageFrac - 0.05)); dr.cd = 99; dr.wind = null; F.enemiesAct(); out.enraged = !!dr.enraged; out.enrageAtk = dr.atk > atk0; G.enemies = keep;
        dr.enraged = 0; dr.sm = 0;
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
      assert.equal(r.ogreSteps, 2, 'the ogre moves on every other turn only');
      const SF = 0.4, SR = 0.5;   // BAL.weapon.shieldFront / shieldRanged
      assert.equal(r.exFront, Math.round(100 * SF), 'guard front ' + JSON.stringify(r));
      assert.equal(r.exBack, 100, 'guard from behind: full damage');
      assert.equal(r.exRanged, Math.round(100 * SR), 'ranged from behind: reduced');
      assert.equal(r.exStunned, 100, 'stunned guard drops its shield');
      assert.ok(r.cultistHeal, 'cultist heals');
      assert.ok(r.windMiss && r.windCd, 'a wind-up on tiles you left deals nothing');
      assert.ok(r.windHit, 'a wind-up on the tile you stand on hurts');
      assert.ok(r.packs >= 5, 'swarm packs spawn: ' + r.packs);
      assert.equal(r.earlyEnrage, false, 'dragon is calm above its enrage threshold'); assert.ok(r.enraged && r.enrageAtk, 'dragon enrages below it and hits harder');
      assert.equal(r.whelps1, 4); assert.equal(r.whelps2, 12);   // thresholds 75% / 50% / 25%: 60% -> one wave, 20% -> two more
      assert.ok(r.whelpActed, 'whelps attack');
      assert.ok(r.sweepWind, 'enraged dragon starts a tail sweep when you are next to it');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});
