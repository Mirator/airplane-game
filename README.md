# Depths of Emberfall

A turn-based fantasy roguelite dungeon crawler that runs in a browser: descend 8 floors, slay the dragon, die often, grow
stronger. Played by tap/click on a phone (portrait, ~390px wide) or laptop. Warrior / Rogue / Mage classes with four
abilities each (Rage, Mana and cooldown-plus-knives resource models), four equipment slots (weapon, armor, class-locked
off-hand, charm) whose items change the rules, enemy types that make different abilities the right answer, perks and
synergies, shrines, a merchant, a locked treasure room, a permanent upgrade shop with blueprints, Heat levels, offline expeditions, autosave/Continue.

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
| `balance.js` | **All tunables.** `BAL` (scalar knobs by system: map, spawn, combat, perks, AI, rage/mana, the 12 abilities, off-hand and charm numbers, shop, shrine, meta, floor modifiers `BAL.mod`, score `BAL.score`, Hard `BAL.hard`, Heat `BAL.heat`, expeditions `BAL.exp`, blueprints `BAL.bp`, achievement goals `BAL.ach`) plus the tables: enemies `EN`, classes `CLS` (with their ability `kit`), perks `PERKS`, synergies `SYN`, gear kinds `WP` / `ARM` / `OFF` / `CH`, traits `TR`, unlocks, upgrades `UPG` / `PAIRS`, modifiers `MODS`, Hard rules `HARD_RULES`, `HEAT`, blueprints `BPS`, the generated expedition table `EXP_TABLE`, achievements `ACH` |
| `content.js` | themes (colours), sound tables, name lists, ability button defs `ABIL`, and the text generators (`abilityDesc`, `classBlurb`, `wpRule`, `armRule`, `offRule`, `charmRule`) that build every number shown in help / title / item text from `BAL` |
| `core.js`, `util.js`, `world.js` | storage keys + shared mutable state (`G`, view, effects state), tiny helpers (`rf` is the one RNG, see below), tile/entity queries |
| `idle.js` | **The idle / meta layer** (pure logic, no DOM): upgrade levels and prices (`upBuy`, `upSpent`), either/or pairs, Heat (`heatMax`, `heatAfterWin`), blueprints (`bpFound`, `bpBuy`, `bpRunDrop`, `bpTable`), the expedition outcome model (`expRow`, `expResult`, `expSend`, `expCollect`) and Auto's idle pay (`autoRate`, `autoPay`). Screens: `idleui.js` (Expeditions, report, Blueprints tab) and the Upgrades tabs / Heat picker in `title.js` |
| `records.js` | run score, personal records / streaks / Daily results, achievement checking (`earn`, `checkAchievements`), the toast |
| `save.js` | permanent meta save, achievements, run autosave / Continue (localStorage + IndexedDB mirror) |
| `mapgen.js`, `fov.js` | dungeon layout; line of sight, distance maps, path finding |
| `mods.js` | the 8 floor modifiers (water, collapsing tiles, stalker, ...), the two-way exit choice (`rollOpts`, `showBranch`) and the one map chip (modifier icon) |
| `enemies.js`, `combat.js`, `abilities.js` | AI, wind-ups, healers, dragon phases; damage, shields, status effects, resources, turn end; the 12 class abilities (`DO`), `useAbility`, spear reach |
| `items.js`, `perks.js`, `player.js` | gear slots, derived stats (`meleeAtk`, `mmax`, `spellMul`...), generation, comparison, pickup, consumables; perk pool / granting / synergies; XP |
| `features.js`, `run.js` | shrine, merchant; run start, floor population, descend, end screen |
| `walk.js`, `input.js` | movement, auto-walk, Explore, tap handling incl. the danger guard (`perilAt`: a red wind-up tile / about-to-break crack needs a second tap; tap-to-walk and Explore route around, or stop in front); click/key listeners |
| `auto.js` | **Auto** (autopilot): one timer, one decision per tick through the same action functions a tap uses (`tryMove`, `useAbility`, `drink`, `descend`, the dialog buttons); dialog choices, class ability priorities, watchdog, the top-bar strip (indicator / speed / stop). Numbers: `BAL.auto`; perk and modifier priorities `AUTO_PERKS` / `AUTO_MODS` in balance.js |
| `modals.js`, `help.js`, `title.js`, `screens.js`, `hud.js` | UI screens (title + More, class picker with Details, upgrades; Records and Achievements), the ability row, the Items / Explore / Wait / Stairs row and the Items tray (Potion, Flames, Teleport), HUD |
| `art.js`, `sprites.js` | **The art direction in one place.** `art.js`: palette constants (`PAL`, `Q`, the three floor themes `ENV`), the sprite engine (layers of SVG path data painted by one routine onto cached offscreen canvases for the map and as inline SVG for the interface: `ic('potion',20)` returns markup), tile painters (floor variants, walls with top + front face, water) and the fog helpers. `sprites.js`: every sprite and icon as flat vector layers (`def(id, [base, shadow, highlight], layers)`). Rule: flat fills, 2-3 tones, one uniform dark outline on every sprite, none on the environment. Table `e` fields (`EN`, `CLS`, `WP`, `ABIL`, ...) hold sprite ids. A missing id draws a magenta square and is listed by `__dbg.art.missing()` (a test keeps it empty). No emoji anywhere in the UI. |
| `render.js`, `minimap.js`, `effects.js`, `audio.js` | canvas drawing (blits cached sprites / tiles, smooth fog, light falloff), minimap, juice (shake, float text, on-map `callout`s, low-HP / elite watchers, attack lunge, death pop, one effect per ability in `drawVfx`; all <= 450 ms, no `Math.random`, none with reduced motion), WebAudio |
| `inspect.js` | long-press / right-click inspect card (drawn on the canvas) and the press-and-hold detection; `BAL.ui` holds its timings |
| `main.js` | boot + the `window.__dbg` debug/test API (the test bots rely on it - keep it stable) |

## Run variety, goals and records

- **Floor modifiers.** Floors 2-7 can roll one of 8 modifiers (`MODS`: Dark, Flooded, Cursed ground, Horde, Hunted, Rich vein, Silent, Unstable). They are chosen on the way down: every exit below floor 1-6 offers two routes (`G.opts`, rolled by `rollOpts`) and each shows its theme and modifier. Both routes lead to the same depth, so the merchant floors (3, 6) always have their merchant. The modifier lives in `G.mod`, the route's theme variant in `G.variant`; `newFloor(f, {mod, v})` builds the floor.
- **One RNG.** All game logic calls `rf()` / `rnd()` / `pick()` (util.js). `rf()` is `Math.random` unless a Daily stream is installed, so the simulator and tests can still seed `Math.random`. A **Daily** run seeds each floor from the local date + depth + route, and the combat stream from the date (its state is saved in `G.rs`), so the same date gives the same dungeon. Only cosmetic effects use `Math.random` directly.
- **Records, score, achievements, Heat.** `BAL.score` defines the score; `meta.rec` keeps per-class records (Heat 0 and Heat 1+ separately), streaks and recent Daily results; `ACH` lists the 20 achievements. Heat 1 (internally `BAL.hard`, `HARD_RULES`) unlocks with the first win; Dailies are always Heat 0.

## Auto

☰ menu → 🤖 Auto play (while it runs, the top bar shows an indicator, the speed button and Stop; the map stays bare) plays the run: explore, fight with the class's four abilities, loot, gear / perk / route / shrine / merchant choices, stairs, dragon. `autoStep()` makes one decision (one turn or one dialog choice); the timer (`autoTick`, exactly one pending `setTimeout`, 1x = `BAL.auto.tickMs`) just calls it, `__dbg.auto.runSync()` loops it for the simulator and tests. Dialogs carry `data-kind` / `data-k` labels (see `showModal`) so Auto picks buttons without parsing text; a chosen button is highlighted for `BAL.auto.flashMs` before it is pressed.

- The menu's Auto button states the terms first ("Pays ~N gold per 10 min at 1×, not run gold. Tap again"); the second tap starts it. When a path to the foes is blocked by other foes Auto goes through them (`push`) instead of wandering off; the watchdog line names a healing Cultist when that is the reason.
- Any tap on the map (swallowed: it never also moves you), a dialog, a bar button, a key press or a hidden page switches it off; the run save keeps `G.auto = {on, used, noticed}` but a loaded run always comes back paused.
- Watchdog: no new tile / kill / floor / new low of enemy HP for `BAL.auto.stuckTurns` turns, or `BAL.auto.idleTicks` decisions in a row that use no turn, switches Auto off with a log line.
- **Auto earns the idle rate, not run gold.** The turns Auto plays (`G.auto.t`; the same at 1x / 2x / 4x and in the simulator) are paid at the 30-minute expedition rate at the current upgrade power and best manual floor (`autoPerTurn`). A run that was only partly Auto keeps the manual share of its run gold (`G.auto.t` = turns Auto played; Heat multiplies that share, not the idle pay). Auto runs find no blueprints. It used to bank half the run gold, which at 4-16 turns/s measured as a 3-8x better farm than playing. Records, the Daily and achievements count as before; the recap says "Auto run: idle pay N gold".
- It is deliberately a simple player (no kiting, no retreating or resting, fixed ability priorities). `node tests/sim.js --auto ...` measures it on the same seeds and upgrade levels as the test bot (`tests/lib/autolib.js` replaces only `BOT.runOne`; the bot itself is untouched).

## Idle and meta layer

- **Upgrades** (`UPG`, `PAIRS`): six many-level boosts (Hardy, Sharpened, Padded, Supplies, Greed, Insight = XP) and three either/or pairs (Edge: Keen crit | Vicious damage; Vigor: Regrowth | Lifedrinker; Scrolls: Flames | Teleport) with one level counter each; the variant can be swapped for `BAL.upg.switchFee` once the pair has a level. Price of level l+1 = `base*(l+1)*(1+BAL.upg.rise*l)` (the old shop curve, rise 0.3), times a surcharge `1 + BAL.upg.lateRise*(l-late+1)` (lateRise 0.8) from `late` on. The first levels of the five old boosts are exactly the old ones (Sharpened and Padded now stop at level 3, Hardy's last three levels give +4 each); later levels give much less (diminishing returns). "Upgrade power" = gold put into levels (`upSpent`).
- **Heat 0-5** (`HEAT`, `BAL.heat`): Heat 1 is the old Hard rule set (`BAL.hard` numbers, `G.hard` still drives them in code; players only ever read "Heat 1"); Heat 2 +2 foes per floor, 3 tougher key elites, 4 potions heal 30% less, 5 the dragon enrages at 80% and breathes sooner. Gold and score x1.5 / 1.75 / 2 / 2.25 / 2.5. A win at the highest unlocked Heat opens the next (Dailies never count). Hard records (`meta.rec.h`) hold every Heat >= 1.
- **Blueprints** (`BPS`, 20 items marked `bp: 'c' | 'r' | 'b'` in `WP` / `OFF` / `CH` / `PERKS`): not in the loot pool until found AND bought (`meta.bp[id]` 1 = found, 2 = bought; `bpTable`, `classOffs`, `perkPool` filter). Tier c drops from expeditions, r from manual runs reaching floor 5+, b from killing the dragon or Heat 1+ runs reaching floor 5+. Auto runs find none.
- **Expeditions** (`BAL.exp`, `idle.js`): up to two heroes (second slot `BAL.exp.secondSlot` gold) for 30 min / 2 h / 8 h. `expResult(rec, now)` is a pure function of the record `{cls, dur, t0, seed, pw}` (stored at the start: power is snapshotted), the clock and the found blueprints, so a reload cannot reroll it; elapsed time is clamped to 0..8 h and to the trip length, an early Recall pays the part done. One delve per `delveMin` minutes: each draws the floor it ended on from the class row of `EXP_TABLE` (blended between the calibrated upgrade powers), and pays that floor's mean gold / kills scaled so the trip averages `rate x manual gold per hour` (30 min 0.33, 2 h 0.30, 8 h 0.25 of it: best rate short, best total long). It is an outcome model, not the real engine: the real engine renders and is built around DOM events, it was not run headless.
- **Calibrating the model:** `node tests/calibrate.js [--runs 60] [--seed 1] [--levels ...]` plays bot runs (`tests/sim.js`, Heat 0) at fresh / 800 / 3000 / 9000 / maxed gold, records per class and level the share of runs ending on each floor (or winning), mean gold and kills there, mean turns and manual gold per hour (mean gold per run / (turns x 1.2 s)), and rewrites the block between `// BEGIN EXP_TABLE` and `// END EXP_TABLE` in `balance.js`. Then `node build.js`. Re-run it after any balance change that moves win rates or gold.
- **Expedition economy (gated by the player).** A hero never delves deeper than the deepest floor the player reached in MANUAL play (`meta.bestM`, min 1; Auto stairs do not count, and neither does a floor Auto played more than half of (`G.fm` stores the turn and Auto-turn count at the floor's start); an older save starts with its `best`). 8 h gold = `BAL.exp.gph[bestFloor-1] x (1 + boost(upgrade power))`; 30 min pays x1.25 per hour, 2 h x1.12 (best rate short, best total long). `EXP_TABLE` only gives the shape of a delve now. Gold per 8 h trip (upgrade power fresh 0 / mid 560 / heavy 2054 / maxed 14844; gold spent on levels at the sim's fresh / mid 800 / heavy 3000 / maxed budgets; regenerated by `tests/calibrate.js` after the fix-pass balance change):

| best floor | fresh | mid | heavy | maxed |
|---|---|---|---|---|
| 1 | 64 | 81 | 99 | 150 |
| 2 | 84 | 106 | 130 | 197 |
| 4 | 320 | 405 | 494 | 750 |
| 8 | 632 | 800 | 977 | 1481 |

  A 30 min trip pays about 0.08x and a 2 h trip 0.28x of the 8 h figure (best rate per hour short, best total long). A rough pacing model puts buying everything (upgrades, unlocks, second slot, blueprints, ~22 400 gold) at 2 to 3 weeks of twice-daily 8 h trips plus normal play (model only, not measured with players).
- **Auto pay:** by turns Auto played (same at 1x / 2x / 4x), at the 30 min rate for the best manual floor and upgrade power (`autoPerTurn`). `runBank()` gives the number banked (the recap says it); the HUD gold is always the purse the merchant spends, and while Auto runs the top bar shows its idle pay so far (`+N pay`) separately.
- **Saves:** `meta.mv` = 2. An old (mv 1) save is migrated once at boot: gold, unlocks and records are kept, old levels become the same-named new levels (capped at the new maximum), the difference to what the old level gave becomes a permanent veteran bonus `meta.leg` (no stat ever drops), a win means Heat 1 is unlocked, a Hard toggle that was on selects Heat 1, the flat fields are removed. Every idle field is re-validated on every boot (`cleanMeta`); a damaged one is replaced, never an exception.

## Build and test

**`npm run release-check` for every release** (build + whole suite + a balance smoke: 3 classes x 30 runs at heavy, seed 1; the smoke prints win rates and fails only on crashes, not on bands; under 5 minutes). `npm run mutate`, full balance tables (`tests/sim.js` with 100 runs x 2 seeds) and `tests/calibrate.js` run only on special occasions: a balance rework, changes to the test suite, before a milestone.

```
node build.js          # regenerate index.html
node tests/run.js      # (or npm test) the whole suite, about 50 s on 4 cores (213 tests; ~0.3 CPU-s of every test is just opening a page); non-zero exit on failure
npm run mutate:new     # only mutations not yet in tests/mutate-map.json (the ones a feature just added), ~1 min each
npm run mutate:fast    # every mutation, but only against the test file(s) that caught it last time (kill map); falls back to the whole suite when they pass
                       # process rules, testing tiers and the timeline stamps (tests/stamp.js -> TIMELINE.tsv) are in CLAUDE.md
npm run mutate         # mutation check of the suite: implants 305 realistic bugs one at a time (the MX* entries cover the fix pass), about 3.5 h on 4 cores
node tests/sim.js      # slow balance simulator (not part of npm test), e.g. --runs 50 --seed 1
```

`tests/calibrate.js` regenerates the expedition table (see Idle and meta layer).

Needs Node 22 and Playwright installed globally (`require('playwright')`; Chromium). There are no package dependencies.

**Running the suite.** `tests/run.js` starts one `node --test` process per test file (in parallel, one per CPU core) and prints one line per
file plus every failing test. Inside a file the tests run concurrently, each in its own browser context (fresh localStorage / IndexedDB).
Options: `--bail` (stop at the first failure), `--jobs N`, and file-name words (`node tests/run.js kits auto`). `TEST_CONCURRENCY=N`
changes how many tests of one file run at once (default 4). The suite is CPU-bound (headless Chromium, ~70 core-seconds), so it gets faster
with cores. Timing rule: no assertion depends on a tight real-time margin. Windows under test are stretched (`BAL.ui.modalGraceMs` / `burstMs` set large in the test) or the page clock is moved by hand (`page.clock`), and waits are on page state (`waitForFunction`, `__dbg.walking()`). Short `waitForTimeout` settle sleeps remain in some older files (lower bounds only, nothing is asserted about how long something took); Playwright wait ceilings (3-15 s) only fail a test that is stuck.

- `tests/build.test.js` - committed `index.html` equals a fresh build; no external requests; one inline script and style.
- `tests/mapgen.test.js` - 120 generated floors (15 per depth): stairs/boss reachable, locked room sealed but optional, boss arena safe tiles.
- `tests/features.test.js` - modifiers (generation over many seeds and each rule), exit choice by touch, locked treasure room (key drop, door), merchant, Daily seeding (floors independent of history, seeded combat), records / streaks / fastest win / achievements, gold banking and Hard, save migrations.
- `tests/kits.test.js` - each class's four abilities with their costs, cooldowns and resource gain/decay; gear slots and rules; perks; the old-save load (removed traps / Trapfinder); enemy behaviours (hound, ogre, guard numbers, cultist, wind-up telegraphs, dragon phases and enrage); ability-button states; an old-version run save is discarded.
- `tests/smoke.test.js` - random play (in-page, real DOM events) at 390x844 and 1280x800: zero console/page errors, layout fits; reload + Continue restores the whole saved run field by field.
- `tests/auto.test.js` - Auto: a floor per class, tap / key / hidden page hand control back without moving, reload resumes paused, idle pay + recap label, watchdog, dialogs (gear / perk / path / shrine / merchant), one timer under rapid toggling, layout.
- `tests/fixes.test.js`, `tests/fixes2.test.js` - the playtest / art-review fix pass, all with real pointer and keyboard input (two files so they run side by side): the camera frames every targetable or in-sight foe (portrait and 1280x800, every map edge), stale-tile and diagonal taps never walk, event dialogs ignore a tap for ~400 ms (and a tap that began before them), Escape, Explore picks up seen loot, gear card text, Auto's cost notice, the rotate hint, number merging, boss visibility, enemy-phase timing.
- `tests/fixpass.test.js` - the review / play-test fix pass: one set of armed-ability rules (Wait / Space / Explore cancel, descend and potion disarm, own lit tile casts), the Mage shot (range, 30-45% of a Bolt, keys, projectile), deferred picks (Equip, Back, grace, Fisher-Yates), Heat wording and the first-win line, purse vs Auto pay, the best-floor share gate, dragon blueprint rate, death card delay and keyboard grace (page clock), toasts, Reset across two tabs, expedition clock clamp, Explore blocked by a foe, every dialog by keyboard (focus ring, trap, Enter / Esc), key chips vs icons, the wide side panel and In sight list, landscape windows.
- `tests/idle.test.js` - migration (a real old-format save at level 8, damaged new fields), the expedition model (determinism, 8 h cap, negative time, early collect, rates, scaling), the expedition screens, upgrades and pairs, the Blueprints tab, blueprint lock -> found -> unlocked -> loot pool and drops, what each of the 20 items does, Heat unlock chain and rules, Heat 1 = Hard.
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
Current bot targets (fresh 4-9% since the fix pass): fresh character about 5-8% wins; mid (800 gold) 10-25%; heavy (3000) 40-50%; everything maxed (`--levels maxed=999999`) about 60-70% (see below); no class more than ~1.5x another; dragon beaten about 35-50% of the time by mid characters that reach floor 8; a median win takes at most ~1400 turns. `--hard` / `--heat N` play on Heat N (Heat 1 should win about a third to a half as often as Heat 0 at the same level), `--bp all` gives every blueprint, `--up '{"hp":5}'` sets levels directly. **What "gold spent" means in the sim:** the first purchases follow the old fixed order (`SEQ` in botlib.js: HP, attack, HP, potions, defense, Warlord, ...), after that always the cheapest remaining upgrade level or unlock, pairs set per class (`PAIR_PICK`), never blueprints. `sim.js` also prints gold per run and per hour (1.2 s per turn) for every cell. **Early game knobs** (the start was softened without touching later floors, because XP is the currency that pays for the late game - cutting kills everywhere made heavy runs 15-25 points worse): `BAL.spawn.earlyCut` (fewer enemy groups on floors 1-2), `BAL.enemy.early` (hp / attack multiplier on floors 1-4 only), rat packs of 2-3 (XP per rat raised to match), the Ogre first appears on floor 4, the Mage's mana flow (`BAL.mana`, Nova cost / cooldown) and Charge's rage cost. Always compare against a baseline measured with the SAME bot (`--file` takes an older `index.html`); two seeds, 100+ runs per cell. `sim.js` prints Wait taps per run (all / with a foe in sight / spent resting for mana): a Mage whose best play is waiting 20 turns per fight is a balance bug.
**Last full table** (fix pass; heat 0, 3 classes x 4 levels x 2 seeds x 100 runs, pooled, win%): fresh W 2.5 / M 5.5 / R 1.5 (band 4-9: Warrior and Rogue miss), mid 26 / 25 / 25.5 (band 10-25: 0.5 over), heavy 50.5 / 56 / 53 (band 40-50: 3 over), maxed 64.5 / 65.5 / 73.5 (band 60-70: Rogue 3.5 over). The class spread is within 1.5x everywhere except fresh. 5 of 2400 runs stalled (0.2%). Before the pass: fresh 7 / 6 / 3.5, mid 31 / 20.5 / 23.5, heavy 61.5 / 41.5 / 60, maxed 85.5 / 55 / 88, with ~8% of runs stalled and left out. The fix-pass changes: dragon 1700 HP / 68 attack (was 1500 / 58), Mage shot range 4 and spell-based damage (x0.52), Mage mana regen 0.8 and 2 per kill, Sharpened and Padded stop at level 3, Hardy's last three levels give +4. **The old stalls were a bot bug**: the bot kept walking back onto gear it had declined (`it.skip` stays on the floor) and Unstable floors, which add extra gear, held 8 of 10 stalls; Explore and Auto already skipped declined gear.
Whenever you change win rates or gold, re-run `tests/calibrate.js` so expeditions and Auto's idle pay follow.
Help, title, ability, gear and enemy text is generated from `BAL`. The older perk / unlock descriptions (`+12 max HP` etc.) are still hand-written copies.

## Saves

Meta progress (`dcr_meta_v1`: gold, upgrade levels, blueprints, Heat, expeditions, unlocks, records, achievements, Daily results) is never reset; fields added later get defaults at boot (`META_DEFAULTS` in save.js) and old formats are migrated (see Idle and meta layer). The run save is versioned (`SAVE_VER` = 3, key `dcr_run_v2`, IndexedDB entry `run2`). A v2 run (from before modifiers) is accepted and upgraded on Continue: it has no modifier, the exit choice is rolled when it reaches the stairs, and run-history achievements (no potions, no dragon hits) are skipped for it because its history is unknown. Anything older is discarded on boot with a one-line notice on the title screen.

## UI rules (declutter pass)

- The map carries only the minimap and, on a modified floor, one modifier icon. Nothing may cover tiles while an ability is armed (tested): the minimap is hidden while aiming.
- **Camera** (`camPlan` in render.js): the player is centred, unless an armed ability has targets (or the "Enemy in sight" stop met awake foes) outside the normal view; then the camera frames the player plus all of them (pan, and zoom out down to `BAL.ui.camMinTs` = 22 px tiles; sight is 7 so a box never needs more than 15 tiles). Unframed, awake foes in sight but off screen get a red edge arrow. Taps use `view.ox / oy / ts` (the framed values), never a recomputed formula.
- **Taps never act on what is gone.** A tap on an EMPTY tile is ignored when a foe left or died on it in the turn just resolved (< `staleMs`), or when it is the tile the previous tap attacked (< `burstMs` after the last one, renewed by each ignored tap). A foe on the tile now is attacked as usual. Melee is straight only: tapping a diagonal foe never steps (it says why); Cleave and Nova still reach diagonals.
- **Dialog grace.** A dialog opened by a game event (level-up, gear underfoot, shrine, exit choice, merchant, end of run) ignores real taps for `BAL.ui.modalGraceMs` (400 ms) and any tap whose finger went down before it opened; the same grace holds back Enter / Space (a focused button's native press and Enter with nothing focused). Clicks made through the DOM (Auto, bots) and menus the player opened (including the perk dialog opened from the badge / P) are not delayed. The death card appears `BAL.ui.deathMs` (650 ms) after the lethal hit, input locked meanwhile. The test harness sets both to 0 (most tests tap dialogs at once); `newPage(..., {grace: true})` keeps the real values.
- **Level-up is asynchronous.** A level gives its stats at once; the perk choice becomes a pending pick: options are rolled ONCE when the level is gained (`rollPick`: Fisher-Yates, exactly pool-1 draws; `G.picks` = `[{l, o:[ids]}]`, saved with the run; an older save keeps its pending count and the options are rolled when the dialog first opens). A pulsing count badge sits on the gear button (`#perkBadge`; tap it or press P: the same dialog, with Equipment (Back returns to the pick) and Later buttons; Esc closes it, the pick stays pending; Equip never reopens it). Several pending picks are offered one after another. Tapping Stairs with a pick pending shows the dialog once per floor first. The recap says in one line how many picks went unspent. Auto and the sim bots spend picks at once (`spendNow` / `AUTO.on`; `__dbg.setSpendNow`).
- **Armed abilities, one rule set.** Self / area abilities (Cleave, Nova, Brace, Vanish; `tg:'self'`) are armed by the first tap (no cost, area and foes drawn); the button then says **Use**: the button again, the number key again, Enter, a tap on yourself or on a lit tile uses it; Esc, Wait, Space, Explore, or a tap elsewhere (consumed, never walks) cancels. Aimed abilities say **Cancel**: the button cancels, a lit tile casts (your own tile only when it is lit: Smoke, Fireball). A lit tile is always a valid target. An armed ability never survives a turn that is not its own (potion, new floor); with an arrow key a self ability prints how to use it. Auto and the bots call `useAbility` directly.
- **Mage free shot** (`BAL.shot`: range 4, mul 0.52; abilities.js `canShoot` / `mageShot`): tapping or clicking a visible foe within range and line of sight, or pressing an arrow / WASD key toward a foe in range in that line, fires a ranged shot instead of walking / meleeing: no mana, no cooldown, one turn; damage = spell attack (attack + gear, staff and arcana count) x mul, about 35-45% of a Bolt at equal gear; crit / sneak / lifesteal / poison apply, ranged shield rules as Bolt; a small pale bolt with a trail is drawn (Bolt's head is larger). The Mage's mana economy (`BAL.mana` regen 0.8, 2 per kill) pays for it. Auto and the bot shoot when Bolt is not worth it.
- Touch-primary devices (`pointer:coarse` and `hover:none`) held landscape below 500 px tall get a rotate hint over a RUN (`#rot`, CSS only, body class `inrun`; the run is untouched, Auto pauses); title screens and desktop windows are never covered.
- **Responsive layout** (styles.css, last sections): portrait = bars under the map (column max 900 px; on tablets the bars/HUD max 600 px). Landscape (width >= 640, height >= 480, aspect >= 1.1) = CSS grid, map left, side panel right: 280-330 px below 960 px wide; from 960 px a 380-520 px designed column: larger type (`--fs` 15 / 16 / 17 px at 960 / 1400 / 1800), HUD, an **In sight** list (visible foes by distance: icon, name, HP bar; a click inspects the foe and rings it on the map, `hlFoe`), a log that takes the free height (`LOGN` 30, oldest lines cut), abilities, actions. Tile size = ~11.5 tiles across the short side, clamped 28..`BAL.ui.camMaxTs` (64). From 1180 px wide, dialogs and title-side screens use a wider card with larger type and the lists in two columns (title: art left, buttons right). Canvas backing = css size x devicePixelRatio. Dialog boxes max 440 / 520 px on phones, centred.
- **Keys** (input.js): arrows / WASD move or attack (same danger guard as a tap; a held key never confirms; a Mage shoots a foe in range in that line), 1-4 abilities (while aiming, arrows fire at the nearest target in line), Space or . wait, E explore, I items, Q potion, P perk / equipment, Enter or > stairs (only on them), Esc cancels aim / closes tray / closes the top dialog / opens the menu. **Dialogs are keyboard-complete**: the top dialog (or title-side screen) owns every key; Tab and the arrows move a gold focus ring between its enabled buttons and never leave it (the game under it is `inert`), Enter presses the focused one, Esc presses the one marked `data-esc` (Back / Leave / Later / Stay here / Cancel; the end card has none); the reset confirmations focus Cancel first. Key hints on buttons (`body.kb`, CSS only; Space and Enter show as one glyph) appear after the first key press, never on touch-first devices, and never sit on an icon. Right-click inspects.
- **Reset** (More > Reset all progress): two dialogs (Cancel is the big default; the red button moves from last to first), the 400 ms grace applies to both, both buttons are disabled while the erase runs. `wipeAll()` (save.js) removes only this game's localStorage keys, clears and deletes the IndexedDB mirror and re-initialises `meta` in memory. Another open tab hears it through the `storage` event, stops saving and reloads (its old meta can no longer be written back); the IndexedDB connection closes on `versionchange` so the delete is not blocked.
- Bottom: four ability buttons, then Items / Explore / Wait / Stairs. Items opens `#tray` (Potion, Flames, Teleport); the tray is drawn over the log strip only.
- Text budgets (tests/ui.test.js): class tagline <= 45 chars; ability / perk / trait / charm / off-hand / weapon / armor / modifier lines <= 55; path risk / gain <= 30. Longer rules sit behind a tap (class Details, the gear screen).
- Names: Potion, Flames (the scroll; Fireball is the mage spell), Teleport, Upgrades (permanent, title) vs Merchant (in-run), Sound.
