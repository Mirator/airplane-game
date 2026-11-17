// Regression: the run save must survive a HARD kill of the browser (not just a reload).
// Root cause it guards: Chromium batches localStorage commits (about one per minute), so a killed browser lost the newest
// localStorage writes - often the whole run save - and "Continue" was missing. The game mirrors the run into IndexedDB.
// Waits are on conditions (the mirror holds the value, the process is gone), never on fixed delays.
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { URL, CONC } = require('./lib/harness');

const pidsOf = (dir) => { try { return execFileSync('pgrep', ['-f', 'user-data-dir=' + dir]).toString().split('\n').filter(Boolean); } catch (e) { return []; } };
async function killBrowser(dir) {
  for (const pid of pidsOf(dir)) { try { process.kill(+pid, 'SIGKILL'); } catch (e) { /* gone */ } }
  for (let i = 0; i < 100 && pidsOf(dir).length; i++) await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(pidsOf(dir), [], 'browser processes are gone');
}
const launch = (dir) => chromium.launchPersistentContext(dir, { viewport: { width: 390, height: 844 } });
async function startWarrior(page) {
  await page.locator('#title button', { hasText: /New run/ }).click();
  await page.locator('#title button', { hasText: /Warrior/ }).click();
  await page.waitForFunction(() => !!window.__dbg() && document.getElementById('title').style.display === 'none');
  await page.evaluate(() => { document.getElementById('modal').style.display = 'none'; });
}
// the raw value of the IndexedDB mirror entry ('' = cleared, undefined = nothing written yet)
const idbRun = (page) => page.evaluate(() => new Promise((res) => {
  const rq = indexedDB.open('dcr_run_mirror', 1);
  rq.onupgradeneeded = () => rq.result.createObjectStore('s');
  rq.onsuccess = () => { const g = rq.result.transaction('s', 'readonly').objectStore('s').get('run2'); g.onsuccess = () => res(g.result === undefined ? null : g.result); };
  rq.onerror = () => res(null);
}));
const withDir = async (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emberfall-ud-'));
  const ctxs = [];
  try { await fn(dir, async () => { const c = await launch(dir); ctxs.push(c); return c; }); }
  finally { for (const c of ctxs) { try { await c.close(); } catch (e) { /* already dead */ } } fs.rmSync(dir, { recursive: true, force: true }); }
};

describe('save', { concurrency: CONC }, () => {
  it('Continue survives kill -9 of the browser right after a turn', () => withDir(async (dir, open) => {
    let ctx = await open();
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
    // the IndexedDB mirror (the thing that survives a kill) holds this very turn; localStorage may still be uncommitted
    await page.waitForFunction(async (t) => {
      const v = await new Promise((res) => { const rq = indexedDB.open('dcr_run_mirror', 1); rq.onsuccess = () => { const g = rq.result.transaction('s', 'readonly').objectStore('s').get('run2'); g.onsuccess = () => res(g.result); }; rq.onerror = () => res(null); });
      return !!v && JSON.parse(v).turn === t;
    }, turn);
    await killBrowser(dir);
    ctx = await open();
    page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(URL);
    const btn = page.locator('#title button', { hasText: /Continue run/ });
    await btn.waitFor({ timeout: 8000 });
    await btn.click();
    assert.equal(await page.evaluate(() => window.__dbg().turn), turn);
  }));

  it('a finished run is not resurrected by the mirror', () => withDir(async (dir, open) => {
    const ctx = await open();
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(URL);
    await startWarrior(page);
    await page.evaluate(() => { window.__dbg.fn.endTurn(); window.__dbg.api.finish('abandon'); });
    await page.waitForFunction(async () => {            // the mirror is cleared ('' = cleared)
      const v = await new Promise((res) => { const rq = indexedDB.open('dcr_run_mirror', 1); rq.onsuccess = () => { const g = rq.result.transaction('s', 'readonly').objectStore('s').get('run2'); g.onsuccess = () => res(g.result); }; rq.onerror = () => res(null); });
      return v === '';
    });
    await page.reload();
    // our read is queued behind the game's own boot-time sync of the mirror, so by the time it answers the sync has run
    assert.equal(await idbRun(page), '');
    assert.equal(await page.locator('#title button', { hasText: /Continue run/ }).count(), 0);
  }));
});
