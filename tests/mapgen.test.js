// Map generation test: build 200 floors through the real newFloor() pipeline and check the invariants the game relies on.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, startRun } = require('./lib/harness');

let browser, ctx, page, errors, report;
before(async () => {
  browser = await launch();
  ({ page, ctx, errors } = await newPage(browser, { seed: 20240229 }));
  await startRun(page, 'warrior');
  report = await page.evaluate(() => {
    const g = window.__dbg(), F = window.__dbg.fn, { W, H, MAXF } = F.dim;
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // BFS over tiles for which pass(tile) is true; doors (3 closed, 4 open) are passable, locked door (5) is not
    const flood = (sx, sy, pass) => {
      const seen = new Set([sy * W + sx]), q = [[sx, sy]];
      for (let i = 0; i < q.length; i++) {
        const [x, y] = q[i];
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy, k = ny * W + nx;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k) || !pass(g.map[k])) continue;
          seen.add(k); q.push([nx, ny]);
        }
      }
      return seen;
    };
    const out = { floors: 0, fails: [], treasure: 0, bossFloors: 0, minSafe: 1e9 };
    for (let i = 0; i < 200; i++) {
      const f = 1 + (i % MAXF);
      F.newFloor(f); out.floors++;
      const p = g.p, tag = 'floor ' + f + ' #' + i;
      let target = g.map.indexOf(2);
      const dragon = g.enemies.find((e) => e.t === 'dragon');
      if (target < 0) { if (!dragon) { out.fails.push(tag + ': no stairs and no dragon'); continue; } target = dragon.y * W + dragon.x; }
      else if (f === MAXF) out.fails.push(tag + ': stairs on the last floor');
      const open = flood(p.x, p.y, (t) => t !== 0 && t !== 5);          // locked room NOT entered
      if (!open.has(target)) out.fails.push(tag + ': stairs/boss unreachable with doors passable');
      for (const e of g.enemies) if (!open.has(e.y * W + e.x) && !e.elite) out.fails.push(tag + ': enemy ' + e.t + ' unreachable');
      if (g.treasure) {                                                  // locked room is optional but must be sealed and unlockable
        out.treasure++;
        const d = g.treasure.door;
        if (g.map[d[1] * W + d[0]] !== 5) out.fails.push(tag + ': treasure door tile not locked');
        const full = flood(p.x, p.y, (t) => t !== 0);
        if (!full.has(d[1] * W + d[0] + 1) && !full.has(d[1] * W + d[0] - 1) && !full.has((d[1] + 1) * W + d[0]) && !full.has((d[1] - 1) * W + d[0])) out.fails.push(tag + ': locked door not adjacent to reachable floor');
        if (!g.enemies.some((e) => e.elite)) out.fails.push(tag + ': locked room without key-carrying elite');
      }
      if (f === MAXF) {                                                  // boss arena
        out.bossFloors++;
        if (!dragon) { out.fails.push(tag + ': no dragon'); continue; }
        // The dragon's breath only winds up when the player is within 1 tile of its row/column. Count arena floor tiles outside that cross.
        let safe = 0;
        for (let y = dragon.y - 4; y <= dragon.y + 4; y++) for (let x = dragon.x - 5; x <= dragon.x + 5; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H || g.map[y * W + x] === 0) continue;
          if (Math.abs(x - dragon.x) > 1 && Math.abs(y - dragon.y) > 1) safe++;
        }
        out.minSafe = Math.min(out.minSafe, safe);
        if (safe < 40) out.fails.push(tag + ': only ' + safe + ' safe arena tiles');
        if (Math.abs(p.x - dragon.x) + Math.abs(p.y - dragon.y) < 3) out.fails.push(tag + ': player starts next to the dragon');
      }
    }
    return out;
  });
});
after(async () => { await ctx.close(); await browser.close(); });

describe('mapgen', () => {
  it('generated 200 floors', () => assert.equal(report.floors, 200));
  it('stairs / boss reachable on every floor with doors passable and the locked room unopened', () => assert.deepEqual(report.fails, []));
  it('exercises locked rooms and the boss arena', () => {
    assert.ok(report.treasure > 20, 'treasure rooms: ' + report.treasure);
    assert.equal(report.bossFloors, 25);
    assert.ok(report.minSafe >= 40, 'min safe tiles ' + report.minSafe);
  });
  it('no page errors', () => assert.deepEqual(errors, []));
});
