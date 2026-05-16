# feat-8: Gamified onboarding demo + in-game help

**Version:** 0.8.0
**Status:** shipped
**Date:** 2026-05-16

## What

Replaces what would otherwise be a static text-card tutorial with an
**on-board interactive demo** that plays the game *for* the player so
they see the core mechanics in motion instead of reading bullet points.

Two entry points:

1. **First-run** — fires automatically the first time a player enters
   the game (after the home screen choice or the auto-resume of a
   signed-in returning user). Gated by `cascade.howto.seen.v1` in
   localStorage so it only runs once per device.
2. **`?` button in topbar** — always available. Opens the same demo
   on demand. CTA copy adapts ("Skip" → "Close").

### Demo sequence

A full-screen dimmed + blurred backdrop appears. Everything outside the
board (topbar, tray, powers, targeting bar) goes `visibility: hidden`
— their grid slots remain so the board stays exactly where it was,
but the player only sees the board and a centered banner against the
backdrop. The banner has: section title, caption, progress dots
(3 steps), a main action button, and a small Skip/Close button in
the corner.

Each step plays its scripted animation **once on entry**, then the
button enables — the user reads, then taps **Next** (or **Got it**
on the last step) to advance. No auto-progress.

1. **Step 1 — OBJECTIVE.** Caption: *"Drop pieces to fill a row or
   column. A full line clears for points."* 8 cells of mixed colors
   drop into the middle row (~75 ms apart, with a pop animation per
   cell), then the row clears with regular clear animation +
   particles + `Good!` float. Next button enables. → Next.
2. **Step 2 — PURE.** Caption: *"Match colors — a same-color line
   scores way more. This is the big bonus to chase."* 8 **red**
   cells drop into the row, then the row clears with **PURE!**
   float, yellow **PURE!** hype text, board shake, and the
   mono-clear sound layered over the regular clear sequence. This
   is the focal moment of the demo. → Next.
3. **Step 3 — POWERS.** Caption: *"Earn coins from score, then
   spend them on powers below the tray to recover when stuck or set
   up combos."* The powers row is *un-hidden* (visibility flips back
   on) and pulses with a cyan glow ring + 2.5% scale animation
   against the dark backdrop, while everything else stays hidden. →
   Got it.

On dismiss (button finish or Skip): the board snapshot is restored,
near-miss recomputes, the seen-flag is set, the backdrop fades out
and the banner slides down.

### State safety

Before the demo runs, the current `state.board` is cloned. The demo
mutates the live board directly so the player sees the real animations
on the real grid. On finish (or Skip), the snapshot is restored and
near-miss is recomputed. Score, combo, coins, tray, and best are
**never touched** — the demo only writes to `state.board`. So pressing
`?` mid-game costs the player nothing.

### Skip

The Skip button sets a `cancelRequested` flag and flushes all pending
`setTimeout` waits immediately, so the demo unwinds in a frame and
finalizes through the same `finish()` path as a natural completion.
`finish()` is guarded against double-invocation (skip + `finally`
both call it).

## How

- [src/ui/onboarding.ts](../src/ui/onboarding.ts) **(new)** —
  - `runOnboardingDemo({ state, variant, onDone })` is the entry
    point. Builds the backdrop + banner, snapshots the board, runs
    the three-step sequence, restores on completion, fires
    `onDone` exactly once.
  - `dropCell(state, c, color, gap)` writes to `state.board[3][c]`,
    re-renders, plays a WAAPI pop animation on the cell, and awaits
    a configurable gap.
  - `triggerClear(state, mono)` builds the clear set from row 3,
    fires `animateClear` plus floats / hype / shake / SFX, then
    nulls the cells and re-renders.
  - `wait(ms)` registers each pending timeout so Skip can flush
    them all atomically.
  - `awaitClick()` returns a Promise that resolves when the user
    taps **Next** / **Got it**, or when Skip cancels — the same
    resolver is held by both buttons, so either path unblocks the
    step.
- [src/ui/overlays.ts](../src/ui/overlays.ts) — removed the prior
  text-card `showHowToPlay` export. The overlay module no longer
  owns onboarding.
- [index.html](../index.html) — added `<button class="icon-btn"
  id="btn-help" aria-label="How to play">?</button>` in the topbar
  `.actions` row.
- [src/main.ts](../src/main.ts) —
  - `HOWTO_SEEN_KEY = 'cascade.howto.seen.v1'`.
  - `hasSeenHowTo()` returns true on localStorage failure so private
    browsing doesn't loop the demo.
  - `openHowToPlay(variant)` calls `runOnboardingDemo` and persists
    the seen flag in `onDone`.
  - First-run trigger wired in `startGame()` and in the
    already-signed-in branch of `presentHomeIfNeeded()` (returning
    Google / email users who skip the home screen).
- [src/style.css](../src/style.css) — `.demo-banner` (fixed bottom
  banner with fade-in), `.demo-banner-title` / `-caption`,
  `.demo-progress` + `.demo-progress-dot.active` (animated pill
  expand), `.demo-skip`, `body.demo-running` (dims tray / powers /
  topbar actions to 35% and disables their pointer events),
  `.demo-spotlight` with a `demoSpotlightPulse` keyframe (cyan glow
  ring + slight scale).

## Psych / UX reasoning

**Why show, not tell.** Onboarding for casual puzzle games lives or
dies on activation energy. Reading a three-section card asks the
player to parse text, build a mental model, then dismiss it and try.
A demo collapses that gap — the player sees the row fill, the row
clear, the PURE animation fire, and instantly knows what the goal
shape of a great move looks like. The mono bonus *is* the game's
unique skill expression (and the source of its name), so seeing it
land in the first 10 seconds of the session is the right
prioritization.

**Why mutate the real board, not show a separate mini-board.** A
side-panel demo introduces a "this is just an example" layer that the
brain discounts. Playing the demo *on the actual grid* the player is
about to use establishes the spatial mental model they'll need
immediately. The state snapshot/restore makes this safe even when the
`?` button is pressed mid-game.

**Why dim the rest of the UI.** During the demo, the powers row, tray,
and topbar are visible but dimmed. This (a) shows the player what
those things *are* before they're explained, (b) prevents accidental
input during the scripted sequence, and (c) lets Step 4 spotlight the
powers row by un-dimming and pulsing it — a clear visual hierarchy
shift that draws the eye without needing a separate UI element.

**Why first-run, with a Skip.** Mandatory tutorials are the most-
skipped UX element in mobile gaming. Forcing the demo every session
or blocking play until completion would hurt retention. One auto-run
with a visible Skip button respects the player's autonomy; the `?`
icon is always there for the curious or for a refresher.

**Why localStorage instead of a Firestore profile field.** Tying the
seen-flag to a cloud profile would re-trigger the demo on every new
device for veteran players. Per-device feels right — a switch-phone
player might genuinely appreciate the refresher, and dismissing it
takes one tap.

## Files

- [src/ui/onboarding.ts](../src/ui/onboarding.ts) — demo controller,
  banner UI, cell-drop and clear sequences
- [src/ui/overlays.ts](../src/ui/overlays.ts) — removed prior
  static-card howto
- [index.html](../index.html) — `?` icon in topbar
- [src/main.ts](../src/main.ts) — first-run trigger, button wiring,
  localStorage flag
- [src/style.css](../src/style.css) — `.demo-banner`, progress dots,
  skip button, `body.demo-running` dim state, `.demo-spotlight`
  pulse
- [package.json](../package.json) — 0.7.0 → 0.8.0
