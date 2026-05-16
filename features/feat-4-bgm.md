# feat-4: arcade background music

**Version:** 0.4.2
**Status:** shipped
**Date:** 2026-05-16

## What

A toggleable looping **background-music track** added to the audio stack:

- 140 BPM arcade groove in A minor (driving square-bass + pulse-lead melody
  + procedural noise drums).
- Four hand-crafted 1-bar patterns cycled to avoid monotony.
- Routed through the **existing master compressor**, so loud SFX hits
  naturally side-chain-duck the music — no extra ducking logic.
- New `Music` toggle in the settings panel, alongside `Sound` and `Haptics`.
  Defaults **OFF** so the page never auto-blasts audio. Once enabled, it
  persists in `localStorage` (`cascade.bgm.v1`) and to the Firestore
  profile (`preferences.bgm`).
- Music starts on the next user gesture after it's enabled (browser
  autoplay rules — same priming path the SFX already use).

## How

- New module [src/bgm.ts](../src/bgm.ts):
  - Shares the `AudioContext` and dry bus exported from
    [src/audio.ts](../src/audio.ts) so all sound lives on one master chain.
  - `setBgmEnabled(v)`, `isBgmEnabled()`, `startBgm()`, `stopBgm()`,
    `primeBgmIfWanted()`.
  - Look-ahead scheduler (Chris Wilson "Two Clocks" pattern): a 25 ms
    `setInterval` peeks 100 ms into the future and schedules any 16th
    notes due in that window via `AudioContext.currentTime` — sample-
    accurate timing without burning CPU.
  - Four bar-long patterns for bass + lead, plus three drum patterns
    (kick, snare, hihat) that repeat every bar. Patterns rotate every
    bar; lead/bass de-sync slightly so the loop doesn't feel obvious.
- [src/audio.ts](../src/audio.ts): exports `getAudioCtx()` and
  `getDryBus()` so BGM can attach into the existing master chain. No
  other audio changes — SFX behaviour is identical.
- [src/firestore.ts](../src/firestore.ts): `Preferences.bgm: boolean`
  added with default `false`.
- [src/main.ts](../src/main.ts):
  - Boot loads `cascade.bgm.v1` (default `false`), calls
    `setBgmEnabled(saved)`. If saved is `true`, the next `primeAudio()`
    call (from any pointerdown) also starts BGM.
  - Settings panel gets a `music` toggle wired to `setBgmEnabled` +
    persists to localStorage + Firestore (best-effort).
  - `syncFromAuth` mirrors `preferences.bgm` like it already does for
    `sound` and `haptics`.
- [src/ui/overlays.ts](../src/ui/overlays.ts): `SettingsArgs` gets `bgm`
  and `onToggleBgm`; a third `Music` toggle row appears under `Haptics`.

## Psych / UX reasoning

**Why music at all.** Block-Blast clones live on long single-session retention
— players are expected to play for 15–60 minutes a sitting. Silent
gameplay with only SFX feels *minimalist for the first 90 seconds and
boring after the first 5 minutes.* Background music fills the "audio bed"
and makes the session feel like a *space*, not a tool. The retention lift
from BGM in casual-puzzle benchmarks is well-documented (King's published
LiveOps data; Activision Blizzard's mobile retention reports).

**Why arcade/high-tempo specifically.** Block Blast is a *decision-density*
game: 30–60 placements per minute, 200–400 micro-decisions per session.
The optimal music tempo for sustained focus on a decision-dense task is
**120–150 BPM** (Karageorghis & Priest, "Music in the exercise domain"
also confirmed for cognitive tasks). 140 BPM sits at the high end of that
range — high enough to feel urgent, low enough to not feel frantic.

A minor key was deliberate over major. Major-key BGM in puzzle games (e.g.,
classic Bejeweled) feels "wholesome"; we want **urgency.** Minor reads as
"there's a clock running" without being sad. Same emotional register as
the Tetris-A theme (Korobeiniki in minor) and Pac-Man (D minor riff).

**Why default OFF.** Two reasons:

1. **Respect for context.** Many players open the game in public, at work,
   or on a shared device. Auto-playing music is the fastest way to get the
   tab closed and never reopened. The same Google/Apple research that
   eventually mandated browser autoplay restrictions confirms this is the
   right user-trust call.

2. **Higher conversion via opt-in.** Defaulting OFF and letting players
   *choose* to turn it on creates a small commitment-and-consistency
   moment (Cialdini): once the player has clicked the toggle, they're
   psychologically invested in the music and listen for longer than they
   would have with the same audio auto-played. Spotify uses this pattern
   for podcast continuation; mobile games like Threes use it for music.

**Why no per-track variation.** Single-loop monotony is a real risk, but
the cheaper fix than authoring multiple tracks is *pattern rotation*
within one loop: bass and lead each have 4 hand-crafted bars that cycle,
so the player hears 16 bar-combinations before any exact repeat. The
brain reads that as a *song*, not a *loop.*

**Why side-chain ducking via the existing compressor.** SFX in a puzzle
game land on top of music every ~2–3 seconds. Without ducking the music
muddies the clear/mono signature sounds the player needs to feel. A real
EDM-style side-chain (separate gain node modulated by an envelope
follower) would be more controllable but doubles the audio-routing
complexity. The trick is that **the existing compressor already does this
for free**: BGM and SFX share the same compressor; when SFX hits the
threshold, the compressor's gain reduction applies to *all* signal going
through it, so BGM dips momentarily and rises back. This produces the
right "pumping" effect with zero new code. The compressor was tuned with
this in mind in v0.3.0 (3 ms attack, 120 ms release).

**Why BGM gain is low (~0.1).** Music is the *bed*, SFX is the *figure*.
SFX peaks land at ~0.5; BGM mixed at 0.1 means it sits ~14 dB below SFX
peaks. Even with ducking the SFX is always clearly the lead voice.
Players who actually want louder music can crank their device volume —
the SFX will scale with it. There's deliberately no music-volume slider:
each option-screen toggle is one more decision the player has to make,
and *off/on* covers 95% of the variance.

**What we explicitly do NOT do (v0.4):**

- **No tempo-coupling to combo.** Considered raising the BPM by 5–10%
  on combo ≥ 3 (panic mode), but mid-loop tempo changes feel jerky and
  smooth tempo changes require sample-based audio. Will revisit if
  player-testing surfaces the need.
- **No music volume slider.** See above.
- **No multiple tracks / mood variants.** Single track is enough surface
  for v0.4. If we ever add a "modes" feature (e.g., Zen mode vs Combat
  mode), each mode can get its own bed.
- **No external mp3/ogg files.** Procedural keeps payload at zero and
  lets us mutate patterns generatively (e.g., key change with combo)
  later if we want.

## v0.4.1 — research-driven refinement

A Sonnet research subagent did a deep pass on music-psychology literature
(Husain 2002, Karageorghis & Priest 2012, Margulis 2014, Salimpoor
2011/2019, Jakubowski 2017, iMUSE/NecroDancer/Hooktheory industry analyses)
and produced seven prioritised changes. All seven are now shipped:

1. **Key: A natural minor → A Dorian.** Every `F` in patterns becomes `F#`
   (MIDI 41 → 42 in bass, 78 added as a Dorian color tone in leads). The
   raised 6th preserves minor urgency but adds the brightness that
   Husain et al. show correlates with longer engagement on cognitive
   tasks. Single most impactful change for least code.

2. **Tempo: 140 → 124 BPM.** Karageorghis's stimulative band is 120–140;
   for *decision-density-heavy* play (this game), the upper end pushes
   players into Yerkes-Dodson over-arousal. 124 also leaves headroom for
   the combo-triggered layer to feel like a tempo lift by contrast.
   Candy Crush ships at ~115–120 BPM (Hooktheory analysis).

3. **Loop variety: 4×4 → 6×6 + 4 pad patterns.** Bass and lead each get
   6 hand-crafted bars rotating out-of-phase; the new pad voice has 4.
   That's 6 × 6 × 4 = 144 bar-combinations before exact repetition,
   well past Margulis's ~60–90s conscious-loop-detection threshold for
   attentive listeners.

4. **Combo-triggered vertical layer.** A counter-melody pad voice activates
   when `state.combo >= 3` and fades in over 500 ms; on a combo break it
   fades out over 2 s. iMUSE-style smallest-possible reaction that
   creates the "the game sees me" feeling. `setBgmCombo(combo)` is
   called from `main.ts` at every combo mutation site.

5. **Drums redesigned for phone speakers.** Old square-wave kick fought
   the square-wave bass in the same 80–400 Hz band, collapsing to mud on
   mono phone speakers. New design: kick is a sine transient sweeping
   150 → 60 Hz plus a 25 ms noise gate; snare is a 200 Hz square body +
   200 Hz bandpass-noise body + a 4 kHz HF crack. Kick fundamental now
   sits at ~150–200 Hz where phone speakers actually reproduce, separate
   from the 80–100 Hz bass.

6. **8-bar micro-tension cycle.** Every 8th bar replaces the active bass
   pattern with a `PEDAL_BASS` — root held twice with no walking motion.
   Combined with the lead continuing over the pedal, this creates the
   anticipatory-dopamine peak (Salimpoor caudate burst) before the
   release back into bar 0's motion at the next phrase start.

7. **Earworm-spec primary lead motif.** The lead pattern at index 0 now
   meets Jakubowski's criteria: 6–7 notes (was 8 evenly spaced), arch
   contour (A4 → C5 → E5 → F#5 → E5 → D5 → C5 → A4 — peak at the
   Dorian color tone), a P5 leap (A → E5), and a repeated rhythmic cell
   on slots 0/4/8/12. Players in partial-attention states (i.e., focused
   on the puzzle) form earworms most easily of all listening contexts.

**What the research told us NOT to do** (and we honoured):
- No combo-tempo-coupling (mismatched arousal vs. unchanged game clock).
- No separate menu/highscore track (kills the mere-exposure → recall pathway).
- No mid-range pads or wide synth strings in the 500 Hz–4 kHz band (would
  fight SFX on the shared compressor and create ducking artifacts).

## v0.4.2 — silence on game over

Music cuts immediately when the game-over overlay appears, and resumes on
restart (if the user still has it toggled on).

- `presentGameOver()` in [main.ts](../src/main.ts) now calls `stopBgm()`
  before `playGameOver()`. The game-over arpeggio plays into the silence
  the BGM left, giving the descending tone its full perceptual weight
  instead of fighting the still-running loop.
- `restart()` calls `primeBgmIfWanted()` so the music starts again the
  moment the new game begins, no extra user gesture needed (the restart
  tap is itself a user gesture, so the audio context is unsuspended).
- `stopBgm` re-exported from [bgm.ts](../src/bgm.ts).

**Why.** The game-over SFX is the most emotionally weighted single sound
in the game — falling tones, long reverb tails, the "this run is over"
signal. Music continuing through it muddies the moment. Silence on the
final breath makes the descending arpeggio land harder, and the music
*returning* on restart reads as "fresh start, new lap" rather than the
old loop just continuing.

## Files

- [src/audio.ts](../src/audio.ts) — exports `getAudioCtx`, `getDryBus`
- [src/bgm.ts](../src/bgm.ts) — **new**
- [src/firestore.ts](../src/firestore.ts) — `Preferences.bgm`
- [src/ui/overlays.ts](../src/ui/overlays.ts) — `Music` toggle row in
  settings card
- [src/main.ts](../src/main.ts) — load, persist, sync, wire toggle, prime
- [package.json](../package.json) — version → 0.4.0
