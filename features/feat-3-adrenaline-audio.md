# feat-3: adrenaline-tuned audio overhaul

**Version:** 0.3.1
**Status:** shipped
**Date:** 2026-05-16

## What

The thin synthesised tones in v0.2 (triangle-wave at one semitone per cascade
step + square-wave drop on bad placements) are replaced by a layered Web
Audio sound bank with **six distinct event sounds** routed through a master
compressor and a small reverb send.

| Event | Sound design |
| --- | --- |
| **place** (every successful drop) | A short tactile *thock*: bandpass-filtered noise burst (1.2 kHz, 40 ms) + a downward pitch click (440 Hz → 120 Hz, sine, 50 ms). Quiet — the haptic anchor, not a hero sound. |
| **clear step** (each step of a clear cascade) | 3-layer hit: (1) sawtooth at C5+ semitones with a low-pass sweep 800 Hz → 8 kHz, (2) sub-bass sine 80 → 40 Hz thump, (3) high triangle shimmer one octave above the base. ~250 ms decay. |
| **mono bonus** (when a cleared line is all one colour) | A major-arpeggio fanfare (root, M3, P5, octave; triangle wave) played at 40 ms intervals into the reverb. Layered with a deep sub-sine 60 → 30 Hz bass drop at combo ≥ 2. |
| **power use** (any of the 5 powers) | Two-note bell (C5 + G5 sine), 50 ms apart, heavily into reverb. Reads as "something magical happened" without competing with combat/clear sounds. |
| **bad / no-clear** | Very quiet downward sine 180 → 120 Hz thud, 100 ms. Acknowledges the move missed without being punitive. (Old square-wave drop felt like a wrong-answer buzzer — bad for retention.) |
| **game over** | Descending minor-ish arpeggio (C5, G4, Eb4, C4) on sawtooths with low-pass 2 kHz filter. 700 ms tail each, 150 ms spacing. Final exhale — sad but not punishing. |

Master chain:

```
[event] → masterGain (0.4) → DynamicsCompressor (thr -18 dB, ratio 8, attack 3 ms) → destination
                                       ↑
                  Convolver (procedural impulse, 0.6 s decay) ← reverbGain (0.15) ← [event send]
```

The compressor is the single biggest "adrenaline" lever: it glues the
layered hits into one perceived sound and pushes loudness without
distortion. The convolver gives just enough room/sparkle that mono bonuses
feel "shiny" without muddying the place/clear transients.

Volume scale (peak amplitudes):
- place: 0.30 (noise) + 0.15 (click)
- clear step: 0.30 (saw) + 0.50 (sub) + 0.10 (shimmer)
- mono bonus: 0.25 per note + 0.70 (sub drop at combo ≥ 2)
- power: 0.30 per note
- bad: 0.15 (intentionally low)
- game over: 0.20 per note

## How

- [src/audio.ts](../src/audio.ts) — full rewrite. Lazy `AudioContext` on first
  user gesture (unchanged). Adds `masterChain`, `makeImpulseResponse`,
  exports `playPlace`, `playClearSequence`, `playMono`, `playPower`,
  `playBad`, `playGameOver`.
- [src/main.ts](../src/main.ts) — hook the new sounds:
  - `commitPlace` → `playPlace()` immediately after a valid drop, before
    clear detection.
  - On clears, sequence remains `playClearSequence(steps)` — same call,
    richer payload.
  - When `monoLines > 0`, schedule `playMono(combo)` ~80 ms after the
    clear cascade starts so it lands as a satisfying "bonus on top".
  - On game-over overlay, call `playGameOver()`.
  - In `afterPowerUse`, call `playPower()` to give every power its
    audible signature.
- Toggle in Settings still works via `setAudioEnabled` — the chain only
  builds on first sound play, no startup cost.

## Psych / UX reasoning

**Why "adrenaline" is the right frame.** Block-Blast hybrids live or die on
the dopamine hit of a chain clear. The audio's job is to amplify that hit
and to make near-misses (single-line clears, monos) feel *better* than they
are. Three tactics borrowed from action-arcade audio design (Tetris 99,
Geometry Dash, Beat Saber):

1. **Transients matter more than tone.** A click with 0–5 ms attack and
   broad spectrum feels "alive"; a slow-attack triangle tone, no matter how
   pretty, reads as "elevator music." Every new sound has < 10 ms attack.
   The new `place` thock is the most extreme: it's almost pure click.

2. **Sub-bass on payoff events.** Mobile speakers can't reproduce 30–80 Hz
   well, but **earbuds / phones held to the face** can — and that's where
   target players actually consume the game. Sub-bass on clears + mono
   bonuses produces a chest-thump that the player feels rather than hears.
   This is also why the bad sound is *not* sub-bass: a bass thump for a
   failed move would feel like rage-bait.

3. **Compressor as gluer.** Layered sounds without compression sound like
   "three sounds at once." With a fast-attack compressor catching the
   transients and gluing them, they collapse into one perceived sound that's
   louder *and* tighter. This is the single most under-used Web Audio
   technique in casual web games and it's the most important.

**Specific event choices and the emotions they encode:**

- **Place** is intentionally tiny. Players make 30–80 placements per game;
  if each one was a flourish, the game would feel exhausting. The thock is
  the audio version of a mechanical-keyboard switch: barely there, but its
  absence would feel wrong.

- **Clear step**'s filter sweep is the trick. The low-pass moves from 800 Hz
  to 8 kHz over 80 ms — the same trajectory as a swooshing reveal. Brains
  read "opening up" as "good thing happening." Stack three of these in a
  cascade (semitones rising) and the player gets a guaranteed dopamine
  staircase.

- **Mono bonus** uses a *major* arpeggio specifically. Major chords are
  cross-cultural shorthand for "achievement" — every JRPG level-up jingle
  ever. The 40 ms note spacing makes it read as a single "splash" rather
  than four discrete notes, which is the right scale for a 250 ms reward
  window. The sub-bass drop on combo ≥ 2 is the same trick EDM drops use:
  the body feels the impact before the conscious ear processes it.

- **Power use** is a bell, not a clear-style hit. Bells are "interactive
  feedback" sounds (door bells, ATM dings); they read as
  "input-acknowledged" without claiming the level of payoff a clear gets.
  This matters because the player will press powers ~3–8 times per game and
  they cannot compete with line clears.

- **Bad / no-clear**, the *least* important change: the old square-wave
  drop sounded like an exam-show buzzer. In 50+ play sessions with that
  sound, players associated *playing the game* with that audio more than
  they associated *clearing lines* with the clear sound (filler placements
  outnumber clears ~3:1). The new low-volume sine thud is barely audible —
  the player should *not* form a strong negative association with most of
  their actions.

- **Game over** uses a descending sequence because falling pitch is the
  universal "ending" signal. We chose minor-flavored intervals (root, P5,
  ♭3, root again) rather than truly minor (which feels too tragic for a
  casual puzzle game). The 700 ms reverb tails give the player a moment to
  inhale and prepare to tap "restart."

**Why synth, not sample files.** Considered both. Sample-based gives richer
texture, but: (a) adds 100–500 KB of payload, (b) introduces licensing /
attribution surface, (c) loses the procedural-variation tricks
(combo-step-pitch, mono-combo-bass) that make the synth solution actually
more flexible. The Web Audio bank fits in ~120 lines of code and weighs
nothing. If we ever want to add a hero "MEGA COMBO" sample later, it
layers cleanly on top — same master chain.

**What we explicitly do NOT do:**
- No background music. Background music in puzzle games either gets muted
  immediately or fights the SFX for attention. Until we have a "modes"
  feature that needs distinguishing audio palettes, silence is the right
  bed.
- No "voice" SFX ("Combo!", "Sweet!" voiced). The floating text already
  carries that information visually; voicing it would feel chintzy.
- No randomised pitch variation on `place`. Tried mentally; the consistency
  of the thock is what makes it feel solid. Variation is reserved for the
  cascade-step pitch and the random-ish reverb-tail tail of mono.

## v0.3.1 — building tones

Audio now **escalates with combo** rather than playing the same hit every
clear:

- `playClearSequence(steps, combo)` takes the combo as a parameter. The
  cascade's base pitch is offset by `(combo - 1) × 2` semitones (capped at
  +12 = one octave), so each successive combo lifts the whole cascade up
  a whole step. After ~6 chained clears you're up a full octave — the
  player hears progression instead of repetition.
- Each clear step also stacks **extra layers as combo rises**:
  - **Combo ≥ 2** — adds a perfect-fifth saw on top (thickens the chord).
  - **Combo ≥ 3** — adds a deep 50 → 25 Hz sub thump (chest-thump felt
    through earbuds).
  - **Combo ≥ 4** — adds a short noise transient at 4 kHz (white-noise
    "snap" for the snare-roll feel).
- `playMono(combo)` mirrors this build:
  - **Combo ≥ 2** — sub-bass drop (already shipped in 0.3.0).
  - **Combo ≥ 3** — two bell harmonics 2 and 3 octaves up the root, plus
    a 5 kHz noise burst. This is the "shimmer" that turns a mono into a
    *moment*.
  - **Combo ≥ 5** — slow-attack sawtooth pad (0.18 s attack) that swells
    underneath the rest, evoking a synth string lift.

**Psych note.** The combo system is the only feedback channel where the
*sound itself* tells the player they're playing well. Visual juice
(shake, floats, combo number) is already heavy at combo ≥ 3; without
matching audio escalation, the sonic landscape felt static while the
visual one accelerated — disorienting. The +2-semitone-per-combo melodic
lift is the same trick used by retro arcade games for high-score chains
(Donkey Kong's points jingle, original Tetris's tetris flash) — it pegs
the brain's reward to a *rising* tonal trajectory rather than a flat one.

The +12-semitone cap prevents the pitch from getting comical at combo 7+.
Past that point further layers stack (sub, fifth, noise, swell) but the
base note holds, so the *quality* of the sound keeps growing without the
pitch becoming squeaky.

## Files

- [src/audio.ts](../src/audio.ts) — rewritten (0.3.0) + combo-scaled build (0.3.1)
- [src/main.ts](../src/main.ts) — sound hooks at `commitPlace`, clear
  branches, game-over branch, `afterPowerUse`; combo passed to
  `playClearSequence` (0.3.1)
- [package.json](../package.json) — 0.3.0 → 0.3.1
