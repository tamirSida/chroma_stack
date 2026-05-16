# Chroma Stack — how to play

A color-block puzzle game. Drag polyominoes onto an 8×8 board, fill rows
or columns to clear them, chain clears for combo multipliers, and chase
the rare moments when a cleared line is all one color.

## The game in 30 seconds

You have an empty 8×8 grid and a tray of three pieces below it.

Drag a piece onto the board, drop it on empty squares, and it stays
there. When a row OR column fills all 8 squares, that line **clears** —
the squares empty out and you score points. Two or more clears in a row
build a **combo multiplier** that grows exponentially. Pieces come in
four colors; if every square in a cleared line is the same color, you
hit a **mono bonus** worth a lot extra.

The game ends when none of your three current tray pieces can fit
anywhere on the board.

## The board

- **8 × 8 squares**, empty at the start.
- Filled squares are colored blocks: red, blue, green, yellow.
- Cells pulse softly when they're one square away from completing a line.
  That's the **near-miss highlight** — a hint that the right placement
  here triggers a clear.

## The tray and pieces

- The tray holds **three pieces** at a time, below the board.
- Each piece is a polyomino of 1–5 squares: singles, dominoes, lines,
  L's, T's, plus signs, etc. **15 shapes in total**, sampled uniformly at
  random.
- Each piece is a single random color from the 4-color palette.
- When you drop a piece, that tray slot empties.
- When all three slots are empty, the tray **refills** with three fresh
  random pieces.

## Dragging and placing

- Tap-and-hold (or click-and-drag) a piece from the tray.
- While dragging, a **floating preview** appears 60 px above your
  finger / cursor so the finger never blocks what you're placing.
- A **ghost** on the board shows where the piece will land, snapped to
  grid cells.
- Cells that *would clear* if you released right now glow **white** —
  this is the **anticipation telegraph**. You see the cascade before
  you commit.
- Release on a valid spot → the piece commits. Release outside the
  board or on an invalid spot → it snaps back to the tray with a small
  shake.

## Clearing

After every placement, the board is checked for:

1. **Full rows** — any row with all 8 squares filled clears.
2. **Full columns** — same, vertically.

That's it. **There are no shape / cluster / color-match clears.** Only
full lines. (We tried cluster matching in earlier versions — it self-
cleared multi-cell pieces the instant they were placed. Not fun.)

## The twist: mono-line bonus

If a cleared row or column is made up of squares that are all the same
color, that's a **monochromatic line** — worth a big bonus and a
special **PURE!** float over the board.

Mono bonuses are the central skill expression: place pieces with their
colors in mind, set up a row or column where every square will be the
same color when it completes, and you'll outscore players who only chase
shape efficiency.

## Combos

- The combo counter starts at **×1** at the top of every game.
- Every placement that **clears** anything increments the combo by 1.
- A placement that clears **nothing** resets the combo to ×1.
- If your combo was ≥3 when it resets, a **red "−COMBO × N" flash**
  fires and the broken-combo count ticks. The game-over card shows
  how many combos you broke this game.

Combo growth is **exponential** (×1.4 per level):

| Combo | Multiplier |
| ----: | ---------: |
| ×1 | 1.0 |
| ×3 | ~1.96 |
| ×5 | ~3.84 |
| ×8 | ~14.76 |
| ×10 | ~28.93 |

So a 10-chain isn't worth 10× a single clear — it's worth ~29×. Deep
chains are the difference between a good run and a legendary one.

## Scoring formula

For every placement that clears something:

```
cellPoints = (squares cleared) × 10
linePoints = (rows + columns cleared) × 50
monoBonus  = (mono-line count) × 150 × combo^1.3
combined   = cellPoints + linePoints + monoBonus
score      = combined × 1.4^(combo - 1)
```

Then, on top of that, four hidden / visible multipliers can stack:

- **Cross-clear** — if a single placement clears ≥2 rows **and** ≥2
  columns at once: **×2** + a red **CASCADE!** float.
- **Score Surge** — once every ~10 clearing placements on average
  (hidden Variable-Ratio counter): **×3** + a yellow **SURGE × 3** float.
- **Dry-spell comeback** — if you've gone 7+ placements without a
  clear and you finally clear: hidden **×2** + an accent-colored
  **COMEBACK!** float.
- **Near-miss patience** — if you've had 3+ consecutive boards with
  near-miss cells and you finally clear: **+75 flat** + a green **+75**
  float.

Stacked, the theoretical max single placement (combo 8 + mono + cross +
surge + dry pity) tops out around **18,000–22,000 points**. Normal
session yields are 500–2,000.

## Coins

Score also earns **coins** at a 10:1 ratio (10 points = 1 coin).

Coins persist across games — locally and (if you sign in) to your
Firestore profile. They never decrease except by spending on Powers.

## Powers

Five spendable powers sit in a row under the tray. Each shows its cost
in coins. Tapping a power deducts the cost and runs the effect
immediately — no inventory, no separate store.

| Power | Cost | Effect |
| --- | --- | --- |
| **Undo** | 50 | Restores the board, tray, score, combo, and coin balance to immediately before your last placement. One-shot — the snapshot regenerates each placement, so you can only undo the most recent move. |
| **Reroll** | 80 | Re-rolls the three tray pieces. Any already-used slot stays empty. |
| **Recolor** | 100 | Keeps every filled cell in place but **re-colors them randomly** with fresh colors. Instant mono-line opportunities if you get lucky. |
| **Paint** | 120 | Enter targeting mode: pick an **axis** (Row / Column) and a **color**, then tap any cell on the board. That cell's row or column has its **already-filled** squares re-painted in your chosen color. Empty cells stay empty. This is a setup power — you still have to clear the line yourself, but if you fill the gap with the right color, you guarantee a mono bonus. Picking an empty line is refused with no coin charge. |
| **Wipe** | 250 | Clears every filled cell on the board. Tray, score, combo, and coins untouched. Nuclear reset for a board that's just hopeless. |

Greyed-out (faded) buttons mean you can't afford the power or can't use
it right now (e.g., Undo when there's no last move to undo).

## Game over

Triggered when **no piece in the current tray can fit anywhere** on
the board.

The game-over card shows:

- Final score, with **"New Best!"** if you set a personal record.
- Best score ever (across all sessions on this device + cloud profile).
- **Near-miss summary** — "You were 1 cell away from clearing N more
  line(s)" if any near-miss cells were unresolved at the end.
- **Combos broken** — how many ≥3 combo chains you lost to no-clear
  placements this game.
- **Save your high score** prompt (Google / email) when you're playing
  as a guest and just set a new best.
- **Play Again** button.

Restart triggers: tap **Play Again**, tap anywhere on the card, press
**Enter** or **Space**. The restart completes in <300 ms.

## Audio + haptics + music

Three independent toggles in the settings panel:

- **Sound** — SFX. Place clicks, clear chimes, mono fanfares, screen-
  shake hits, game-over arpeggio.
- **Music** — a procedural 124 BPM arcade loop in A Dorian. Activates
  a counter-melody layer when your combo hits ×3. Cuts on game-over
  and resumes on restart. Defaults **off** — auto-blasting music
  feels rude on first launch.
- **Haptics** — short vibrate pulses on clears and powers, on phones
  that support `navigator.vibrate`.

All three persist in `localStorage` and sync to your Firestore profile
if signed in.

## Leaderboard

Tap the trophy icon (top-right). Two tabs:

- **Today** — top 50 scores submitted today (UTC day). Resets at
  midnight UTC.
- **All-time** — top 50 scores ever, across all players.

If your score isn't in the top 50, a pinned **"You: #N · top X%"** row
shows your current rank.

Available only when signed in (anonymous or full account). Guests
playing without Firebase configured see local-only scores.

## Sign in / guest

Three options on the home screen:

- **Continue with Google** — popup, one tap, fastest path.
- **Sign in with email** — email + password modal, with sign-up and
  forgot-password flows.
- **Play as guest** — start playing immediately. Your scores save
  locally and to an anonymous Firebase profile, but iOS Safari can
  rotate that profile's ID every 7+ days, so the cloud copy of your
  best score can quietly disappear. **Sign in any time** from settings
  to make the save permanent — your guest progress merges into the
  new account automatically.

## Strategy tips

1. **Plan for mono lines.** When you have two same-colored pieces in
   the tray, look for a row or column you can build up entirely in that
   color. Worth ~3× as much as a multi-color clear at the same combo.

2. **Don't burn your combo on cheap clears.** A no-clear placement
   resets combo to ×1. If the only place a piece fits would *break*
   your combo, look for a different piece in the tray that does clear,
   or use **Undo** strategically.

3. **Use Paint to convert near-misses into monos.** If you have a row
   with 7 cells filled in mixed colors and you can place a 1-cell piece
   in the last gap, that's a regular line clear. Use Paint first to
   recolor those 7 cells to match your incoming piece, and the same
   clear becomes a mono bonus worth way more.

4. **The Score Surge is hidden — don't try to game it.** It's a
   variable-ratio reward (~1 in 10 clears) and is invisible by design.
   Just keep clearing well and surges will come.

5. **Save Wipe for genuine emergencies.** At 250 coins, it's a heavy
   investment. Most stuck boards can be salvaged with Reroll (80) or
   Paint (120). Wipe is for when both the tray and the board are
   broken.

6. **Cross-clears are rare but huge.** When you spot a placement that
   would simultaneously clear ≥2 rows AND ≥2 columns, that's a
   **CASCADE** worth ×2 on top of everything else. Plus a mono bonus
   if the cleared lines happen to be one-color. The biggest single-
   placement payouts in the game live here.

7. **Sign in if you care about your high score.** Anonymous Firebase
   UIDs rotate roughly every 7+ days on iOS Safari. Your local best
   survives in localStorage, but the cloud leaderboard entry doesn't.
