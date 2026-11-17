// Regression: the run save must survive a HARD kill of the browser (not just a reload).
// Root cause it guards: Chromium batches localStorage commits (about one per minute), so a killed browser lost the newest
// localStorage writes - often the whole run save - and "Continue" was missing. The game mirrors the run into IndexedDB.
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { URL } = require('./lib/harness');

const killBrowser = (dir) => {
  let pids = '';
  try { pids = execFileSync('pgrep', ['-f', 'user-data-dir=' + dir]).toString(); } catch (e) { /* none */ }
  for (const pid of pids.split('\n').filter(Boolean)) { try { process.kill(+pid, 'SIGKILL'); } catch (e) { /* gone */ } }
};
const launch = (dir) => chromium.launchPersistentContext(dir, { viewport: { width: 390, height: 844 } });
const startWarrior = async (page) => {
  await page.locator('#title button', { hasText: /New run/ }).click();
  await page.locator('#title button', { hasText: /Warrior/ }).click();
  await page.waitForFunction(() => !!window.__dbg() && document.getElementById('title').style.display === 'none');
  await page.evaluate(() => { document.getElementById('modal').style.display = 'none'; });
};

describe('save', () => {
  it('Continue survives kill -9 of the browser right after a turn', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emberfall-ud-'));
    let ctx = null, ctx0 = null;
    try {
      ctx = ctx0 = await launch(dir);
      let page = ctx.pages()[0] || await ctx.newPage();
      await page.goto(URL);
      await startWarrior(page);
      const turn = await page.evaluate(() => {
        const F = window.__dbg.fn;
        [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 0]].forEach((d) => F.tryMove(d[0], d[1]));
        F.tryMove(0, 0); window.__dbg.fn.endTurn();
        return window.__dbg().turn;
      });
      assert.ok(turn >= 1);
      await page.waitForTimeout(400); // let the IndexedDB transaction commit; localStorage would still be pending
      killBrowser(dir);
      await new Promise((r) => setTimeout(r, 500));
      try { await ctx.close(); } catch (e) { /* already dead */ }
      ctx = await launch(dir);
      page = ctx.pages()[0] || await ctx.newPage();
      await page.goto(URL);
      const btn = page.locator('#title button', { hasText: /Continue run/ });
      await btn.waitFor({ timeout: 4000 });
      await btn.click();
      assert.equal(await page.evaluate(() => window.__dbg().turn), turn);
      await ctx.close();
    } finally { for (const c of [ctx, ctx0]) { try { if (c) await c.close(); } catch (e) { /* closed */ } } fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('a finished run is not resurrected by the mirror', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emberfall-ud-'));
    let ctx = null, ctx0 = null;
    try {
      ctx = ctx0 = await launch(dir);
      let page = ctx.pages()[0] || await ctx.newPage();
      await page.goto(URL);
      await startWarrior(page);
      await page.evaluate(() => { window.__dbg.fn.endTurn(); window.__dbg.api.finish('abandon'); });
      await page.waitForTimeout(400);
      await page.reload();
      await page.waitForTimeout(400);
      assert.equal(await page.locator('#title button', { hasText: /Continue run/ }).count(), 0);
      await ctx.close();
    } finally { for (const c of [ctx, ctx0]) { try { if (c) await c.close(); } catch (e) { /* closed */ } } fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
