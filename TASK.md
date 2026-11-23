# Task: add a SHIFT ("换挡") mechanic for GitHub Game Off 2026 (theme: SHIFT)

This is a small canvas platformer (game.js, index.html, style.css, assets/). Keep the art, feel, physics and existing systems (glide, wind, hearts, coins, checkpoint, completion). Use ONLY existing assets (you may tint/rotate/draw simple canvas shapes for UI). No external libraries, no network.

## Mechanic: Shift Gears
- The whole desert runs on gears with two gears: GEAR 1 and GEAR 2. Player toggles with either Shift key (ShiftLeft/ShiftRight), also KeyX/KeyK, and a new touch button labelled "换挡" (place it near the jump button; same style).
- Shifting has ~0.25 s cooldown, a satisfying feedback: short screen shake (1–2px), dust/spark particles at each gear platform, a gear indicator HUD (top-left or top-right: "GEAR 1"/"GEAR 2" with a small rotating gear drawn using the gear_platform art or canvas).
- What changes between gears (design it so the level REQUIRES shifting at least twice to finish, and rewards it with coins):
  1. Gear platforms (GEARS) move to a different position per gear (smoothly tween ~0.35 s; keep the hero riding them correctly — the existing carry logic uses previousY; extend to x if you slide them horizontally). Gear 1 = current bobbing layout. Gear 2 = they lock into a higher staircase / bridge layout that reaches places gear 1 cannot.
  2. The wind updraft is ON in gear 1 and OFF in gear 2 (wind sprite fades out). 
  3. Add one simple gate/obstacle near the end that is only passable in one gear (e.g. a section of ground_mid rises as a block in gear 1 and sinks in gear 2), so the player has to shift back.
  Re-place some coins so that some are reachable only in gear 1 and some only in gear 2. Total coins can stay ~19.
- Hero must never get stuck inside geometry after a shift: if a moving surface would overlap the hero, push hero up on top of it or skip.
- Add a short hint the first time (like existing hints): "Shift = 换挡 / shift gears" when approaching the first gear section.

## UI text
Keep Chinese text, and add short English beside it (international jam voters), e.g. title "狐兔 · 齿轮沙漠星  Foxbun: Gear Desert", button "点击开始 / Click to start", hints bilingual, completion "第一关完成！ Level clear!" plus show how many shifts were used. NOTE: check whether the UI font in style.css is a subset; if Chinese glyphs for "换挡" are missing from the subset, fall back to system font for those labels (don't break rendering).

## Quality
- No console errors. Game must still be completable start to finish on desktop keyboard and on mobile touch.
- Keep reduced code churn; well structured.
- Write a README.md for the repo: game name, Game Off 2026 / theme SHIFT, how SHIFT is used, controls, credits ("Art & design: FanPiny (@FanPiny). Built with AI-assisted tools in November 2026."), license MIT for code. Mention font license file in assets.
- At the end write PROGRESS.md summarizing changes and how you tested.
