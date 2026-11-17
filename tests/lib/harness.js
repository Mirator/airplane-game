// Shared Playwright helpers for the test suite. Playwright is expected to be installed globally (require('playwright')).
'use strict';
const path = require('path');
const { chromium } = require('playwright');

const GAME = path.resolve(process.env.GAME_HTML || path.join(__dirname, '..', '..', 'index.html'));
const URL = 'file://' + GAME;

// Seeded Math.random replacement (mulberry32) so test runs are reproducible.
function seedInit(seed) {
  let a = seed >>> 0;
  Math.random = function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// New page with error collection. opts: {w,h,seed,meta,reducedMotion}. meta pre-seeds the permanent save
// (default: help already seen, rogue + mage unlocked) - only if the page has no meta yet, so reloads keep progress.
async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: opts.w || 390, height: opts.h || 844 },
    reducedMotion: opts.reducedMotion ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('requestfailed', (r) => { if (!/^file:/.test(r.url())) errors.push('external request: ' + r.url()); });
  page.on('request', (r) => { if (!/^(file|data|blob|about):/.test(r.url())) errors.push('external request: ' + r.url()); });
  if (opts.seed != null) await page.addInitScript(seedInit, opts.seed);
  // Pre-seed the permanent save from the page itself, then reload once. (Doing this from addInitScript makes Chromium
  // intermittently lose the newest localStorage write across a later page.reload() - a test-environment quirk that
  // reproduces on the pre-refactor file too.)
  const meta = opts.meta || { seenHelp: 1, gold: 0, unl: { rogue: 1, mage: 1 } };
  await page.goto(URL);
  await page.evaluate((m) => { try { if (!localStorage.getItem('dcr_meta_v1')) localStorage.setItem('dcr_meta_v1', JSON.stringify(m)); } catch (e) {} }, meta);
  await page.reload();
  return { page, ctx, errors };
}

const CLASS_LABEL = { warrior: /Warrior/, rogue: /Rogue/, mage: /Mage/ };
async function startRun(page, cls) {
  await page.locator('#title button', { hasText: /New run/ }).click();
  await page.locator('#title button', { hasText: CLASS_LABEL[cls] }).click();
  await page.waitForFunction(() => !!window.__dbg() && document.getElementById('title').style.display === 'none');
}

const launch = () => chromium.launch();
module.exports = { GAME, URL, launch, newPage, startRun, seedInit };
