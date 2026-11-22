# Backlog (open findings; one line each)

## Balance (needs its own pass, see CLAUDE.md)
- Fresh game is a wall: bot wins ~2% (Warrior, 50 runs) with no upgrades; playthrough died on floor 4 in 10 of 14 fresh runs (before the last softening).
- Heavy (3000 gold) smoke after the last softening: Warrior 70 / Mage 63 / Rogue 63 % vs band 40-50. Maxed Warrior 78 % vs 60-70. No full table since.
- Expedition pay table (`EXP_TABLE`) not recalibrated after the last balance change; README balance/expedition tables are stale.

## Open findings from review loop 2
- Flames and Teleport items have no keyboard shortcut.
- Camera jumps when an ability is armed at 1366 px wide (N-A8).
- Blueprint cards for classes the player does not own.
- "Tap ..." wording shown to keyboard players.
- Auto recap says "Auto played 1 turns"; no test for the singular (mutation MX52 survives).
- Mutation MA12 (dragon head not redrawn on top) is only caught by an unrelated flaky test.

## Tests
- Kill map (`tests/mutate-map.json`) covers 10 of 305 mutations; `npm run mutate:fast` needs one full `npm run mutate` to fill it (3 h+, ask first).
- ~78 fixed sleeps in older test files; flaky under load: auto "reload: the run resumes PAUSED", fixes2 N19, fixpass keyboard shot, ux2 long-press.
- Suite takes 60-70 s (target 60).

## Never verified
- Real phone, tablet touch, Safari/Firefox. Heat 3-5 in play.
