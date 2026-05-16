# feat-2: powers + coin economy

**Version:** 0.2.0
**Status:** in-progress
**Date:** 2026-05-16

## What

A soft-currency economy ("coins") and five spendable **powers** that bend the
game's normal rules in the player's favor.

**Coin earning.** Every point scored mints `0.1` coins (rounded down on the
running balance). Coins are monotonically non-decreasing from earning —
only spending reduces them. Persisted to `localStorage` (`cascade.coins.v1`)
and synced to the Firestore user profile so the balance survives across
devices.

**Powers** (all are unlocked from the start; the gating is the coin cost):

| Power | Cost | Effect |
| --- | --- | --- |
| **Redo** | 50 | Restores the board, tray, score, combo, and coin balance to immediately before your last placement. Only the most recent move is recoverable; a second tap is a no-op until you place again. |
| **Shuffle pieces** | 80 | Re-rolls all three tray pieces (any already-used slot stays empty). |
| **Shuffle board** | 100 | Keeps every filled cell in place but re-colors them with fresh random colors. Same shape, new color distribution → instant mono-line opportunities. |
| **Color line** | 120 | Player picks a row OR column (1–8) and a color. The **already-filled** cells in that line are recoloured to the chosen color. Empty cells stay empty. The power does *not* auto-complete the line — it sets up a future mono-clear by aligning the colors of existing blocks. If the chosen line is entirely empty, the action is refused and no coins are spent. |
| **Clear board** | 250 | Wipes every filled cell. Tray, score, combo, coin balance untouched. Nuclear reset. |

A "power store" view is unnecessary: the five power buttons sit under the
tray, each showing its cost. A button is disabled (faded, not tappable) when
the player can't afford it. Tapping a power deducts coins and runs the
effect immediately — purchase and use are one action.

## How

- New `src/powers.ts`: defines `Power`, `POWER_DEFS`, and `applyPower(state, id, params)`.
  Pure functions where possible (effects mutate the passed `GameState`).
- `GameState` gains `coins: number` and `snapshot: GameState | null`. The
  snapshot is taken inside `commitPlace` right before `placeOnBoard` runs.
- `commitPlace` mints `Math.floor(scoreDelta * 0.1)` coins on every points
  gain, calls `saveCoins()` (localStorage + Firestore-best-effort).
- New `<div id="powers" class="powers">` row in [index.html](../index.html),
  rendered by `render.ts`'s `renderPowers(state, onUse)`. The handler is
  wired in `main.ts`.
- A small modal in `ui/overlays.ts` (`showColorLinePicker`) collects row/col
  + color for the Color-line power.

## Psych / UX reasoning

Five distinct effects, three loops:

1. **Sunk-cost reversal** (Redo).
   The single biggest source of rage-quit in Block-Blast-likes is a
   placement that wedges the board. Undo dissolves that rage and lets the
   player try a different micro-strategy. We deliberately cap the snapshot
   to one move so Redo *feels* precious (price tag stays low; scarcity stays
   high). One-step is also enough that the AI bots don't trivialise it.

2. **Reset valves at three intensities** (Shuffle pieces / Shuffle board /
   Clear board).
   Block Blast players quit primarily because the tray + board state
   becomes unworkable. Three escape hatches at increasing cost let the
   player titrate their bailout:

   - *Shuffle pieces* (cheap) — bad tray, fine board.
   - *Shuffle board* (medium) — fine tray, board needs different colors.
     Same positions, new colors → preserves the spatial planning the
     player just did while opening mono-line lottery tickets.
   - *Clear board* (expensive) — both broken. A power priced 5× the
     cheapest one makes the player *feel* the indulgence; rare use
     keeps it special.

3. **Agency over the central twist** (Color line).
   The mono-line bonus is the game's identity. Color-line is a **setup**
   power, not a payout: it aligns the colors of blocks the player has
   already placed, but the player still has to land a piece in the gap
   to trigger the clear. That preserves skill expression — you can't
   buy your way to easy points; you buy *better odds* on the points
   you were about to earn anyway. The teach-by-doing moment is still
   there: a player who recolours a 7/8 row red and then drops a red
   cell into the last slot gets a deliberate mono clear and immediately
   internalises that "matching colors is worth chasing." Refusing the
   purchase when the line is empty prevents the obvious newbie trap
   ("I paid 120 coins and nothing happened").

**Coin earning rate.** 0.1 coins per point is calibrated so:
- A clean game ending at ~500 points earns ~50 coins → exactly one Redo.
- A strong game at ~2000 points earns ~200 coins → enough to mix powers.
- The cheapest power is reachable in a single typical game (not 5 games).
  This is critical: if the cheapest power feels far away, the whole system
  reads as a vanity counter and players ignore it.

**Persistence is unobtrusive.** Coins live in `localStorage` immediately so
even offline-only / unauthenticated players can buy powers. The Firestore
sync is best-effort — a network failure never blocks a purchase. This
matches the "anonymous-first" auth posture we already chose in
[feat-2 of the original plan](../README.md): friction is the enemy.

**Variable-reinforcement layering.** The base game already has one VR
schedule (clear-chain combos). Powers add a second VR layer at a slower
cadence: every ~500 points earned, a new spendable item becomes
affordable. Two stacked schedules at different timescales is the dopamine
recipe behind every successful idle/puzzle hybrid (Candy Crush boosters,
Hay Day cash, Toon Blast lives).

**What we explicitly do NOT do:**
- No paid-currency tier ("gems"). Coins are the only resource. Resisting the
  temptation to add a F2P-style hard currency keeps the loop honest — every
  power is earnable purely by playing.
- No daily/weekly login bonus. Goes against the anonymous-first stance and
  forces account creation; we prefer "play another game and earn it" as
  the only acquisition channel.
- No power "inventory". One-tap-to-buy-and-use removes a UI surface and
  prevents hoarders from sitting on an unused stash that distorts coin
  earning balance.
- No ad-watch-for-coins, no in-app purchase. Out of scope for v0.2; we'll
  revisit if monetisation ever becomes a goal.

## Files

- [src/types.ts](../src/types.ts) — `GameState.coins`, `GameState.snapshot`
- [src/game.ts](../src/game.ts) — `newGameState` updated
- [src/powers.ts](../src/powers.ts) — **new**; power defs + effects
- [src/main.ts](../src/main.ts) — coin earn loop, power button wiring
- [src/render.ts](../src/render.ts) — `renderPowers`, `renderCoins`
- [src/ui/overlays.ts](../src/ui/overlays.ts) — `showColorLinePicker`
- [src/firestore.ts](../src/firestore.ts) — `coins` field on `UserProfile`
- [index.html](../index.html) — coins span in topbar, powers row container
- [src/style.css](../src/style.css) — `.coins`, `.powers`, `.power-btn`
- [package.json](../package.json) — version bump to 0.2.0
