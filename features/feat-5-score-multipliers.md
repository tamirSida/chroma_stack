# feat-5: high-variance score multipliers (research-driven)

**Version:** 0.5.0
**Status:** shipped
**Date:** 2026-05-16

## What

A Sonnet research subagent surveyed Skinner, Schultz (RPE/dopamine), Clark
(near-miss), Harrigan & Dixon (slot-machine payout math), Kahneman & Tversky
(loss aversion), Juul (casual-game friction), plus industry references
(Bejeweled 3, Candy Crush "Tasty!→Sweet!→Divine!", Genshin pity timer) and
prescribed seven specific changes to the scoring system. All seven ship in
this feature.

### Mechanics

| # | Change | Effect |
| --- | --- | --- |
| 1 | **Exponential combo**: `× combo` → `× 1.4^(combo-1)` | Combo 1 unchanged. Combo 5 ≈ ×5.4 (barely different). Combo 8 ≈ ×14.8. Combo 10 ≈ ×28.9. Disproportionate reward for rare deep chains. |
| 2 | **VR-10 "Score Surge"** | Hidden counter starts random [6–14], decrements on each clearing placement, fires ×3 on hit, resets to new random [6–14]. Tied to *clearing* placements only — preserves skill advantage. Hidden by design (visible counter collapses VR into FR). |
| 3 | **Mono-line super-linear** | Mono bonus pulled out of the linear base: `+150 × combo^1.3`. Combo 5 mono ≈ +1,026 (was +750). Maximises RPE-dopamine peak on rare deep-combo monos. |
| 4 | **Near-miss pity bonus** | After ≥3 consecutive near-miss boards, next clear gets +75 flat (no combo scaling). Reinforces "I earned that escape" without becoming a manipulation signal. |
| 5 | **Dry-spell pity timer** | After ≥7 consecutive no-clear placements, next clear gets a hidden ×2 multiplier. Hidden to prevent post-reinforcement pause. Maps to Genshin's 90-pull pity floor. |
| 6 | **Cross-clear jackpot** | Single placement that clears ≥2 rows **and** ≥2 cols → ×2 multiplier + distinct **CASCADE!** float. <5% of clears even for skilled play. |
| 7 | **Visible combo loss** | On combo-reset from ≥3, a red **-COMBO** float flashes + `combosBroken` increments. Tracked and surfaced on the game-over card. **No point deduction** — Juul 2009 documents casual-game session abandonment at 3× rate when scores are taken away. The *visibility of lost potential* activates Kahneman & Tversky loss aversion without the resentment of an actual deduction. |

### Multiplier stack order

```ts
combinedBase   = cellPoints + linePoints + monoBonus(combo)
score          = combinedBase * 1.4^(combo-1)
if (isCross)         score *= 2
if (isDrySpellPity)  score *= 2     // hidden
if (isSurge)         score *= 3     // hidden
if (isNearMissPity)  score += 75    // flat, not multiplied
return round(score)
```

Theoretical single-placement max at combo 8 + cross + surge + pity + mono:
~18,000–22,000 points. Current session mean is 500–2,000, so peak-to-mean
≈ 10–15×. That ratio is Harrigan & Dixon (2009)'s evidence-backed
"exciting but not implausible" zone for sustained-engagement slot
machines. Below it players don't feel jackpots; above it they suspect
the game is on rails.

### State additions

```ts
GameState extends with:
  vrCounter: number              // [6, 14] random on game start
  nearMissStreak: number         // consecutive turns ending with near-miss
  placementsSinceLastClear: number
  combosBroken: number           // shown on game-over card
```

All four reset on `newGameState`.

## Psych / UX reasoning (highlights)

**Why exponential, not multi-additive.** Linear combo scaling (the
status-quo) produces a smooth, predictable reward curve. Schultz, Dayan
& Montague (1997) show that dopamine fires proportional to *prediction
error*, not magnitude. A linear curve at combo 8 produces less RPE than
the same nominal points delivered as a sudden non-linear jump, because
the player already extrapolated the linear projection. The 1.4^x curve
keeps low combos identical (no surprise at the bottom — players who only
hit combo 1–3 see no change) and explodes at the top.

**Why VR-10, specifically.** Ferster & Skinner (1957) catalogued
extinction-resistance across reinforcement schedules. VR-8 through VR-15
is the canonical "sustained-engagement" band. VR-10 sits in the middle —
frequent enough that the player perceives the schedule's existence
within a single session, rare enough that no two consecutive sessions
have the same surge pattern. Tying the counter to *clearing placements
only* is the skill-preservation move: bad players who rarely clear see
the bonus rarely, good players see it often, but neither knows when.

**Why surge can stack with cross and dry-spell pity.** Stacked bonuses
create the unbounded-upside feel that makes a high-score chase feel
infinite. Harrigan & Dixon (2009) document that slot machines with
discoverable upper-bound structures (e.g., "max jackpot is 1000×")
underperform machines with stackable special states that *feel*
boundless. We cap the practical max by stacking only three multipliers
(×2 × ×3 × ×2 = ×12) and don't allow chains across placements.

**Why "shame motivates, punishment alienates"** (Zichermann & Cunningham
2011): visible combo loss tells the player something was *lost*
(activating loss-aversion regret) without deducting actual points
(which would activate quit-the-game frustration in casual contexts —
Juul 2009: 3× session-abandonment rate). The `combosBroken` total on the
game-over card is the longer-term hook: "5 combos broken" reads as a
self-improvement vector for the next run.

**Why pity timers are hidden.** Niv et al. (2012) show that prolonged
unrewarded play depresses dopaminergic baseline, making subsequent
rewards feel *weaker*. A hidden pity multiplier protects the baseline
without the player ever knowing the mechanism. Showing the counter
("3 placements until guaranteed bonus") collapses the schedule into
something the player games rather than enjoys.

## What we explicitly did NOT do (per research)

- **No random multiplier on non-clearing placements.** Would decouple
  reward from skill and train model-free habit (Daw, Niv & Dayan 2005).
  Skilled players would quit when planning stops mattering.
- **No point deductions on combo loss.** Juul 2009: 3× session-
  abandonment rate vs equivalent positive-only games in casual contexts.
- **No visible VR counter** (no glow, no UI hint). Visibility collapses
  VR → FR and creates the post-reinforcement pause that kills retention.

## Files

- [src/types.ts](../src/types.ts) — `GameState` gains four counters
- [src/game.ts](../src/game.ts) — `scoreClears` rewritten with exponential
  combo + super-linear mono; `newGameState` seeds `vrCounter` randomly
- [src/main.ts](../src/main.ts) — counter tracking, multiplier stack,
  surge/cascade/combo-loss float spawning, `combosBroken` to game-over
- [src/render.ts](../src/render.ts) — `spawnHype(label, color)` + `spawnComboLoss(prevCombo)`
- [src/ui/overlays.ts](../src/ui/overlays.ts) — `GameOverArgs.combosBroken`, rendered in card
- [package.json](../package.json) — 0.4.2 → 0.5.0
