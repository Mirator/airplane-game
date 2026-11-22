# Working rules for this repo (Depths of Emberfall)

`index.html` is generated: edit `src/`, run `node build.js`. All tuning numbers live in `src/js/balance.js`. See README.md for structure.

## Process for a feature (target: 1.5-2.5 h, measured in TIMELINE.tsv)

1. **One item per release.** Do not bundle unrelated changes; queue them and ship one after another.
2. **Acceptance criteria first** (5 min, agreed with the owner before any code): 3-8 checkable lines, including the numbers
   (viewports, "no empty area larger than X", damage as % of Y, pay per hour vs what a real new player earns - not what the bot earns).
   If the feature involves an economy or a damage number, compute it on paper against real-player figures before building.
3. **Build** (cheaper model). Finish with `npm run release-check` only (about 2 min).
4. **Review** by a stronger model, 15-20 min: the diff plus screenshots of the changed screens. A player-style playthrough is
   scoped to what changed (about 30 min), not every screen at every size.
5. **One fix pass.** An item is "fixed" only if the reviewer's exact repro was run before and no longer reproduces after;
   otherwise report "partly" or "not". Small-scope fix passes may use the stronger model.
6. `npm run release-check`, look at the screenshots, publish, commit.

Stamp every stage: `node tests/stamp.js "<feature>" "<stage>" start|end` (stages: criteria, build, release-check, review,
playthrough, fix, mutate-new, balance, publish). Agents must do this themselves; the file is committed.

## Testing tiers

| When | What | Time |
|---|---|---|
| Every release | `npm run release-check` (build + suite + 90-run smoke) | ~2 min, hard limit 5 |
| Feature added implanted bugs | `npm run mutate:new` (only mutations not yet in `tests/mutate-map.json`) | ~1 min per new mutation |
| Tests or shared code changed a lot | `npm run mutate:fast` (each mutation against the test file that caught it last time) | target 20-30 min |
| Special occasion, ask the owner first | `npm run mutate` (whole suite per mutation, refreshes the kill map) | 3 h+ |
| Special occasion, ask the owner first | full balance table, `tests/calibrate.js`, full playthrough at all sizes | 30-90 min each |

A mutation whose `find` string no longer applies makes every mutation run refuse to start: after changing code, run
`node tests/mutate.js --check` and re-point the broken entries in the same change.

## Balance is not part of feature work

Features ship with the smoke numbers only. Do not tune `balance.js` inside a feature unless the feature is the balance change.
Balance gets its own pass after several features: tune on a subset (1 class, 50 runs, 1 seed), at most 5 rounds, then one full
table (3 classes x 4 levels x 2 seeds x 100 runs), then `tests/calibrate.js` once. Cells within 5 points of a band are reported
as misses, not re-tuned. Bands: fresh 4-9% per class, mid(800) 10-25%, heavy(3000) 40-50%, maxed 60-70%, no class >1.5x another.

## Standing rules

- Estimates: quote the measured time of the closest earlier stage from TIMELINE.tsv, not a guess.
- Long checks never run on a busy machine (parallel load makes timing tests fail falsely).
- No onboarding/tutorial work unless asked. No pull requests unless asked.
- UI: phone portrait first, short texts, nothing covers map tiles while an ability is armed, do not rewrite DOM that has not changed.
