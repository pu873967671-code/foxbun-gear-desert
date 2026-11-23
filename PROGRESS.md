# Progress

- Added two shiftable gear layouts, moving-platform carry and overlap handling, gear-dependent wind, opposing shutters, coin placement, feedback particles and shake, and a rotating gear HUD.
- Added keyboard and touch shifting, a first-use hint, bilingual interface text, and shift totals on completion. The new Chinese shift labels use a system font fallback.
- Added README with controls, credits, and license information.

## Verification

- Read the movement, collision, checkpoint, input, rendering, and completion paths against the level geometry. The first shutter opens in Gear 2 and the second opens in Gear 1, requiring at least two shifts; the raised platforms provide a route across the gap.
- `node --check game.js` passed.
- Ran a Node VM check of gear tween endpoints, wind fade, cooldown, shutter overlap handling, and level reset; all passed.
- Browser playthrough and visual inspection were not available in this environment.
