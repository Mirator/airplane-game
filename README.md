# Depths of Emberfall

A turn-based fantasy roguelite dungeon crawler that runs in a browser: descend 8 floors, slay the dragon, die often, grow
stronger. Played by tap/click on a phone (portrait, ~390px wide) or laptop. Warrior / Rogue / Mage classes with four
abilities each (Rage, Mana and cooldown-plus-knives resource models), four equipment slots (weapon, armor, class-locked
off-hand, charm) whose items change the rules, enemy types that make different abilities the right answer, perks and
synergies, traps, shrines, a merchant, a locked treasure room, a permanent upgrade shop, autosave/Continue.

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
| `balance.js` | **All tunables.** `BAL` (scalar knobs by system: map, spawn, traps, combat, perks, AI, rage/mana, the 12 abilities, off-hand and charm numbers, shop, shrine, meta, floor modifiers `BAL.mod`, score `BAL.score`, Hard `BAL.hard`, achievement goals `BAL.ach`) plus the tables: enemies `EN`, classes `CLS` (with their ability `kit`), perks `PERKS`, synergies `SYN`, gear kinds `WP` / `ARM` / `OFF` / `CH`, traits `TR`, traps, unlocks, shop, modifiers `MODS`, Hard rules `HARD_RULES`, achievements `ACH` |
| `content.js` | themes (colours), sound tables, name lists, ability button defs `ABIL`, and the text generators (`abilityDesc`, `classBlurb`, `wpRule`, `armRule`, `offRule`, `charmRule`) that build every number shown in help / title / item text from `BAL` |
| `core.js`, `util.js`, `world.js` | storage keys + shared mutable state (`G`, view, effects state), tiny helpers (`rf` is the one RNG, see below), tile/entity queries |
| `records.js` | run score, personal records / streaks / Daily results, achievement checking (`earn`, `checkAchievements`), the toast |
| `save.js` | permanent meta save, achievements, run autosave / Continue (localStorage + IndexedDB mirror) |
| `mapgen.js`, `fov.js` | dungeon layout; line of sight, distance maps, path finding |
| `mods.js` | the 8 floor modifiers (water, collapsing tiles, stalker, ...), the two-way exit choice (`rollOpts`, `showBranch`) and the one map chip (modifier icon) |
| `enemies.js`, `combat.js`, `abilities.js` | AI, wind-ups, healers, dragon phases; damage, shields, status effects, resources, turn end; the 12 class abilities (`DO`), `useAbility`, spear reach |
| `items.js`, `perks.js`, `player.js` | gear slots, derived stats (`meleeAtk`, `mmax`, `spellMul`...), generation, comparison, pickup, consumables; perk pool / granting / synergies; XP |
| `features.js`, `run.js` | traps, shrine, merchant; run start, floor population, descend, end screen |
| `walk.js`, `input.js` | movement, auto-walk, Explore, tap handling; click/key listeners |
| `auto.js` | **Auto** (autopilot): one timer, one decision per tick through the same action functions a tap uses (`tryMove`, `useAbility`, `drink`, `descend`, the dialog buttons); dialog choices, class ability priorities, watchdog, the top-bar strip (indicator / speed / stop). Numbers: `BAL.auto`; perk and modifier priorities `AUTO_PERKS` / `AUTO_MODS` in balance.js |
| `modals.js`, `help.js`, `title.js`, `screens.js`, `hud.js` | UI screens (title + More, class picker with Details, upgrades; Records and Achievements), the ability row, the Items / Explore / Wait / Stairs row and the Items tray (Potion, Flames, Teleport), HUD |
| `render.js`, `minimap.js`, `effects.js`, `audio.js` | canvas drawing, minimap, juice (shake, float text), WebAudio |
| `main.js` | boot + the `window.__dbg` debug/test API (the test bots rely on it - keep it stable) |

## Run variety, goals and records

- **Floor modifiers.** Floors 2-7 can roll one of 8 modifiers (`MODS`: Dark, Flooded, Cursed ground, Horde, Hunted, Rich vein, Silent, Unstable). They are chosen on the way down: every exit below floor 1-6 offers two routes (`G.opts`, rolled by `rollOpts`) and each shows its theme and modifier. Both routes lead to the same depth, so the merchant floors (3, 6) always have their merchant. The modifier lives in `G.mod`, the route's theme variant in `G.variant`; `newFloor(f, {mod, v})` builds the floor.
- **One RNG.** All game logic calls `rf()` / `rnd()` / `pick()` (util.js). `rf()` is `Math.random` unless a Daily stream is installed, so the simulator and tests can still seed `Math.random`. A **Daily** run seeds each floor from the local date + depth + route, and the combat stream from the date (its state is saved in `G.rs`), so the same date gives the same dungeon. Only cosmetic effects use `Math.random` directly.
- **Records, score, achievements, Hard.** `BAL.score` defines the score; `meta.rec` keeps per-class records (normal and Hard separately), streaks and recent Daily results; `ACH` lists the 20 achievements. Hard (`BAL.hard`, `HARD_RULES`) unlocks with the first win; Dailies are never Hard.

## Auto

☰ menu → 🤖 Auto play (while it runs, the top bar shows an indicator, the speed button and Stop; the map stays bare) plays the run: explore, fight with the class's four abilities, loot, gear / perk / route / shrine / merchant choices, stairs, dragon. `autoStep()` makes one decision (one turn or one dialog choice); the timer (`autoTick`, exactly one pending `setTimeout`, 1x = `BAL.auto.tickMs`) just calls it, `__dbg.auto.runSync()` loops it for the simulator and tests. Dialogs carry `data-kind` / `data-k` labels (see `showModal`) so Auto picks buttons without parsing text; a chosen button is highlighted for `BAL.auto.flashMs` before it is pressed.

- Any tap on the map (swallowed: it never also moves you), a dialog, a bar button, a key press or a hidden page switches it off; the run save keeps `G.auto = {on, used, noticed}` but a loaded run always comes back paused.
- Watchdog: no new tile / kill / floor / new low of enemy HP for `BAL.auto.stuckTurns` turns, or `BAL.auto.idleTicks` decisions in a row that use no turn, switches Auto off with a log line.
- A run in which Auto made any decision banks `BAL.auto.goldMul` of its gold (`finish()`), shows "Auto run - half gold" on the recap and is tagged Auto in the Records lists (`rec[..].aruns/awins`, `meta.aruns`, `meta.dly[..].auto`). Records, the Daily and achievements count as usual.
- It is deliberately a simple player (no kiting, no retreating or resting, fixed ability priorities). `node tests/sim.js --auto ...` measures it on the same seeds and upgrade levels as the test bot (`tests/lib/autolib.js` replaces only `BOT.runOne`; the bot itself is untouched).

## Build and test

```
node build.js          # regenerate index.html
node tests/run.js      # (or npm test) the whole suite, about 10 s on 4 cores; non-zero exit on failure
npm run mutate         # mutation check of the suite: implants ~100 realistic bugs one at a time, about 15-25 min
node tests/sim.js      # slow balance simulator (not part of npm test), e.g. --runs 50 --seed 1
```

Needs Node 22 and Playwright installed globally (`require('playwright')`; Chromium). There are no package dependencies.

**Running the suite.** `tests/run.js` starts one `node --test` process per test file (in parallel, one per CPU core) and prints one line per
file plus every failing test. Inside a file the tests run concurrently, each in its own browser context (fresh localStorage / IndexedDB).
Options: `--bail` (stop at the first failure), `--jobs N`, and file-name words (`node tests/run.js kits auto`). `TEST_CONCURRENCY=N`
changes how many tests of one file run at once (default 4). The suite is CPU-bound (headless Chromium, ~35 core-seconds), so it gets faster
with cores; tests wait on conditions, never on fixed delays, and no assertion has an upper time bound, so it stays green on a loaded machine.

- `tests/build.test.js` - committed `index.html` equals a fresh build; no external requests; one inline script and style.
- `tests/mapgen.test.js` - 120 generated floors (15 per depth): stairs/boss reachable, locked room sealed but optional, boss arena safe tiles.
- `tests/features.test.js` - modifiers (generation over many seeds and each rule), exit choice by touch, locked treasure room (key drop, door), merchant, Daily seeding (floors independent of history, seeded combat), records / streaks / fastest win / achievements, gold banking and Hard, save migrations.
- `tests/kits.test.js` - each class's four abilities with their costs, cooldowns and resource gain/decay; gear slots and rules; perks; traps; enemy behaviours (hound, ogre, guard numbers, cultist, wind-up telegraphs, dragon phases and enrage); ability-button states; an old-version run save is discarded.
- `tests/smoke.test.js` - random play (in-page, real DOM events) at 390x844 and 1280x800: zero console/page errors, layout fits; reload + Continue restores the whole saved run field by field.
- `tests/auto.test.js` - Auto: a floor per class, tap / key / hidden page hand control back without moving, reload resumes paused, half gold + recap label, watchdog, dialogs (gear / perk / path / shrine / merchant), one timer under rapid toggling, layout.
- `tests/save.test.js` - run save survives `kill -9` of the browser (IndexedDB mirror), a finished run is not resurrected.
- `tests/sim.js` - bot campaigns: win rate, death floor and killer table per class and upgrade level (options documented in its header comment, including `--hard` and `--force <modifier>`; `--botcfg '{"kite":0,"snipe":0,"choke":0}'` switches the bot's human-style tactics off for A/B runs, `--lib` swaps the bot file).
- `tests/lib/` - shared Playwright helpers (`harness.js`) and the in-page bots.

**Test helpers worth knowing** (`tests/lib/harness.js`): `openRun` starts a run through the game's own `startRun()`; `newPage` seeds the
permanent save and `Math.random`; `reload(page)` reloads without losing the newest localStorage write (Chromium flushes it lazily and a
page loaded right afterwards can miss it); `quiet(page)` waits until the bar stops being re-rendered before a real click on a bar button
(a press that straddles a re-render is not delivered as a click); animation frames run at 10/s in tests (`{frames: 'full'}` opts out).

**Mutation check.** `tests/mutate.js` copies the repo to a temporary folder, applies ONE bug from its list (`MUTATIONS`, plain data: file,
exact `find` text, replacement), rebuilds, runs the suite and records which test caught it or that it SURVIVED. The real `src/` is never
written (nothing to restore, even after a crash or Ctrl-C) and is fingerprinted before and after. A kill must reproduce: the failing file
is re-run and a mutation that no longer fails is reported FLAKY and counted as not killed. Exit code 1 if any mutation survived.

```
node tests/mutate.js                 # all mutations, each run stops at its first failing test
node tests/mutate.js --only M07,save # some ids or areas (combat, warrior, mage, rogue, gear, enemies, modifiers, save, auto, ...)
node tests/mutate.js --all           # whole suite per mutation: lists EVERY test that fails (kill matrix, slower)
node tests/mutate.js --check         # only check that every mutation still applies to src/ (run this after editing src/)
```

When a change to `src/` makes a mutation's `find` text disappear the run stops with `INVALID`: update that entry. A SURVIVED line means
the suite would not notice that bug: add or tighten a test (prefer an assertion in an existing test over a new browser session).

## Balance pass

Change numbers in `src/js/balance.js` only, then `node build.js`, `node tests/run.js`, `node tests/sim.js --runs 60 --levels fresh=0,mid=800,heavy=3000` (cells under 60 runs are noise; +-6 points at 60).
Floor modifiers: `node tests/sim.js --force <id> --levels heavy=3000 --runs 40` makes every exit on floors 2-7 offer only that modifier, which exaggerates its effect - each one should land within roughly +-10 points of the unmodified heavy win rate (the bot's route heuristic prefers safe routes, `BRANCH_SCORE` in botlib.js, so unforced runs see modifiers on only about a quarter of floors). `--hard` plays on Hard; its target is about a third to a half of the normal win rate at the same upgrade level.
Current bot targets: fresh character about 3-5% wins; mid (800 banked gold) 10-18%; heavy (3000) 40-50%; no class more than ~1.5x another; dragon beaten about 35-50% of the time by mid characters that reach floor 8; a median win takes at most ~1400 turns. `sim.js` also prints the share of ability uses per class: if one ability is over ~60% of a class's uses the kit has failed its purpose - change costs or enemies until it is not.
The bot (`tests/lib/botlib.js`) uses all four abilities per class (`warriorAct`, `mageAct`, `rogueAct`) and equips gear with `gscore`; teach it any new ability or item or the numbers mean nothing.
Help, title, ability, gear and enemy text is generated from `BAL`. The older perk / unlock descriptions (`+12 max HP` etc.) are still hand-written copies.

## Saves

Meta progress (`dcr_meta_v1`: gold, shop levels, unlocks, records, achievements, Daily results, Hard toggle) is never reset; fields added later get defaults at boot (`META_DEFAULTS` in save.js). The run save is versioned (`SAVE_VER` = 3, key `dcr_run_v2`, IndexedDB entry `run2`). A v2 run (from before modifiers) is accepted and upgraded on Continue: it has no modifier, the exit choice is rolled when it reaches the stairs, and run-history achievements (no potions, no dragon hits) are skipped for it because its history is unknown. Anything older is discarded on boot with a one-line notice on the title screen.

## UI rules (declutter pass)

- The map carries only the minimap and, on a modified floor, one modifier icon. Nothing may cover tiles while an ability is armed (tested).
- Bottom: four ability buttons, then Items / Explore / Wait / Stairs. Items opens `#tray` (Potion, Flames, Teleport); the tray is drawn over the log strip only.
- Text budgets (tests/ui.test.js): class tagline <= 45 chars; ability / perk / trait / charm / off-hand / weapon / armor / modifier lines <= 55; path risk / gain <= 30. Longer rules sit behind a tap (class Details, the gear screen).
- Names: Potion, Flames (the scroll; Fireball is the mage spell), Teleport, Upgrades (permanent, title) vs Merchant (in-run), Sound.
