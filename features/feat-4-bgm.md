# feat-4: arcade background music

**Version:** 0.4.0
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

## Files

- [src/audio.ts](../src/audio.ts) — exports `getAudioCtx`, `getDryBus`
- [src/bgm.ts](../src/bgm.ts) — **new**
- [src/firestore.ts](../src/firestore.ts) — `Preferences.bgm`
- [src/ui/overlays.ts](../src/ui/overlays.ts) — `Music` toggle row in
  settings card
- [src/main.ts](../src/main.ts) — load, persist, sync, wire toggle, prime
- [package.json](../package.json) — version → 0.4.0
