# feat-7: UX polish — paint targeting + score prominence

**Version:** 0.7.0
**Status:** shipped
**Date:** 2026-05-16

## What

Two-part polish pass on visible UI:

### A — Paint power targeting bar

The targeting toolbar (axis toggle + 4 color swatches + cancel) used to
share the same grid area as the powers row. Fine on mobile where powers
is a full-width bottom strip, but **broken on desktop** where powers
became a 92 px left sidebar — the targeting bar's horizontal layout
overflowed the narrow column and overlapped neighbouring UI.

Fix:

- Targeting bar gets its **own grid area** between the board and the
  tray, on both mobile and desktop. Hides via the `[hidden]` attribute
  → the row collapses to 0 when not in paint mode.
- Powers row stays **visible but dimmed** during targeting (instead of
  fully hidden). Keeps the column layout stable on desktop and gives
  the player a visual reminder of which powers exist while they're
  mid-paint.

### B — Score prominence

The score readout was 22 px. Hard to read at distance and didn't feel
like the central number that everything in the game produces.

- Font size 22 px → **38 px**, weight 900, letterspacing tightened.
- Subtle **accent-cyan text-shadow** glow so the score reads as the
  game's hero number (not just "another stat").
- New **count-up animation** when the score changes: tweens from the
  previous displayed value to the new one over 200–700 ms (longer for
  bigger deltas), eased with `1 - (1-t)^3` so the early ticks move
  fast and settle in.
- New **`.bump` pulse** on increase: 0.45 s scale-up to 1.12× +
  yellow flash + brighter glow. Stacks visually with the count-up so
  a big payout *feels* big.

## How

- [src/style.css](../src/style.css):
  - `.score` font-size, font-weight, glow.
  - `.score.bump` keyframes (`scoreBump`).
  - `.targeting-bar` grid-area changed from `powers` → `targeting`.
  - Mobile `#app` grid: new `targeting` row inserted between `board`
    and `tray`. Empty row collapses when bar is `[hidden]`.
  - Desktop `#app` grid: same insertion in the right column;
    `powers` column unaffected.
  - `.powers.disabled` (opacity 0.35, pointer-events: none) for the
    dimmed state during targeting.
- [src/render.ts](../src/render.ts):
  - `renderScore` no longer sets `textContent` directly; it calls
    `animateScoreTo(state.score)` which manages a tracked
    `displayedScore` + a `requestAnimationFrame` tween.
  - On every score *increase*, `.score` gets a `.bump` class for
    ~450 ms.
  - `showTargetingBar` / `hideTargetingBar` now toggle
    `powersEl.classList.toggle('disabled', …)` instead of
    `powersEl.hidden = …`.

## Psych / UX reasoning

**Why score deserves the visual weight.** The score is the closed-loop
feedback for every clear, mono bonus, surge, cascade, and combo. With
v0.5.0's high-variance multiplier stack a single placement can land
anywhere from 80 points to 20,000 — and at 22 px white-on-dark the
number was almost decorative. Bumping it to 38 px + glow turns it into
the focal point of the topbar and makes the new variance *visible*.

**Why a count-up tween, not a snap.** Snap-to-new-value tells the
player "+1,200" but doesn't *show* it. A 400 ms count-up tween shows
each hundred ticking by, which the brain reads as a sustained reward
event — the same trick Cookie Clicker, idle games, and slot machines
use to extend the perceived duration of the dopamine peak (Schultz
2002 on phasic vs sustained reward signals). The eased curve means
even a small +30 gain reads as a *quick celebration*, not a snap.

**Why dim powers instead of hide them.** Hiding the powers row during
paint mode created a layout shift on desktop (the 92 px left column
went blank). Players in paint mode might also want to reconsider
their choice ("wait, was Wipe a better option here?") — keeping
powers visible-but-disabled preserves that context. Industry pattern:
context-switching modals in tool-heavy apps (Photoshop's tool-active
state, Figma's editing modes) almost always dim rather than hide.

## Files

- [src/style.css](../src/style.css) — score sizing/glow/bump,
  targeting grid-area, powers-disabled state
- [src/render.ts](../src/render.ts) — score count-up tween + bump
- [package.json](../package.json) — 0.6.2 → 0.7.0
