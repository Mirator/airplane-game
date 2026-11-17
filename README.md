# Depths of Emberfall

A turn-based fantasy roguelite dungeon crawler that runs in a browser: descend 8 floors, slay the dragon, die often, grow
stronger. Played by tap/click on a phone (portrait, ~390px wide) or laptop. Warrior / Rogue / Mage classes, perks and
synergies, gear traits, traps, shrines, a merchant, a locked treasure room, a permanent upgrade shop, autosave/Continue.

It ships as **one self-contained `index.html`** (inline CSS + JS, zero external requests, works offline). GitHub Pages
publishes it via `.github/workflows/pages.yml`.

## `index.html` is generated - edit `src/`

`index.html` is a committed **build output**. Never edit it by hand: change `src/` and run `node build.js`
(plain Node, no dependencies, no `npm install`). `tests/build.test.js` fails if the committed file is stale.

## Layout

```
build.js                  assembles src/ into index.html (explicit, ordered file list - see JS_ORDER)
src/index.template.html   markup shell with {{STYLES}} / {{SCRIPT}} placeholders
src/styles.css            all CSS
src/js/*.js               game code; every file starts with a 1-3 line header saying what it holds
tests/                    test suite + tools (below)
```

All of `src/js/` is concatenated into **one IIFE**, so every file shares one scope (no imports/exports). Consequences:

- **Order matters** for top-level `const`/`let` and load-time statements. Function declarations hoist and can be used from
  any file; data tables and shared state must come before the first file that *executes* code using them. The order is the
  `JS_ORDER` array in `build.js` (data first, `main.js` last).
- A new file must be added to `JS_ORDER` (the build refuses to run if a file is missing/unlisted).

| file | holds |
|---|---|
| `balance.js` | **All tunables.** `BAL` (scalar knobs by system: map, spawn, traps, combat, perks, AI, abilities, shop, shrine, meta...) plus the tables: enemies `EN`, classes `CLS`/`LG`, perks `PERKS`, synergies `SYN`, gear traits `TR`, traps, unlocks, shop |
| `content.js` | themes (colours), sound tables, name lists, ability button defs |
| `core.js`, `util.js`, `world.js` | storage keys + shared mutable state (`G`, view, effects state), tiny helpers, tile/entity queries |
| `save.js` | permanent meta save, achievements, run autosave / Continue |
| `mapgen.js`, `fov.js` | dungeon layout; line of sight, distance maps, path finding |
| `enemies.js`, `combat.js`, `abilities.js` | AI and wind-ups; damage, status effects, turn end; dash/bash/vanish/bolt |
| `items.js`, `perks.js`, `player.js` | gear, drops, consumables; perk granting and synergies; XP |
| `features.js`, `run.js` | traps, shrine, merchant; run start, floor population, descend, end screen |
| `walk.js`, `input.js` | movement, auto-walk, Explore, tap handling; click/key listeners |
| `modals.js`, `help.js`, `title.js`, `hud.js` | UI screens, bottom bar, HUD |
| `render.js`, `minimap.js`, `effects.js`, `audio.js` | canvas drawing, minimap, juice (shake, float text), WebAudio |
| `main.js` | boot + the `window.__dbg` debug/test API (the test bots rely on it - keep it stable) |

## Build and test

```
node build.js          # regenerate index.html
node tests/run.js      # (or npm test) build check, map generation, smoke tests; non-zero exit on failure
node tests/sim.js      # slow balance simulator (not part of npm test), e.g. --runs 50 --seed 1
```

Needs Node 22 and Playwright installed globally (`require('playwright')`; Chromium). There are no package dependencies.

- `tests/build.test.js` - committed `index.html` equals a fresh build; no external requests.
- `tests/mapgen.test.js` - 200 generated floors: stairs/boss reachable, locked room sealed but optional, boss arena safe tiles.
- `tests/smoke.test.js` - each class at 390x844 and 1280x800 with random taps and bar/modal buttons: zero console/page
  errors, layout fits, reload + Continue restores turn/floor.
- `tests/sim.js` - bot campaigns: win rate, death floor and killer table per class and upgrade level (options documented in its header comment).
- `tests/equiv.js A.html B.html` - seeded determinism check between two builds (used to prove refactors change nothing);
  `tests/codecmp.js A.html [B.html]` - normalised source diff between two builds.
- `tests/lib/` - shared Playwright helpers and the in-page bot.

## Balance pass

Change numbers in `src/js/balance.js` only, then `node build.js`, `node tests/run.js`, `node tests/sim.js --runs 50`.
Descriptive text (perk/trait/unlock descriptions, help screen) still contains hand-written copies of some numbers and must
be updated alongside.
