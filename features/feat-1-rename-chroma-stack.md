# feat-1: rename to Chroma Stack

**Version:** 0.1.1
**Status:** shipped
**Date:** 2026-05-16

## What

The browser tab title changed from `Cascade — color block puzzle` to `Chroma Stack`.

## How

One-line edit to `<title>` in [index.html](../index.html). All internal
identifiers (localStorage keys `cascade.best.v1` / `cascade.audio.v1` /
`cascade.haptics.v1`, the agent-play-game skill's output filenames, the
`features/feat-*` directory) intentionally kept the old name to avoid
orphaning existing saved-best scores and breaking the skill's pathing.

## Psych / UX reasoning

A name is the first signal a player receives. "Cascade" is descriptive of the
clear *mechanic* (water-flowing-down imagery) — fine, but the mechanic is line
clear, not gravity-cascade, so the word over-promised.

"Chroma Stack" leads with the two things the game is actually about:

- **Chroma** — color matters (mono-line bonus is the central twist).
- **Stack** — you're stacking polyominoes onto a board.

Short, two syllables each, easy to say. No competing app on the App Store with
this exact name (low-effort check). Reads well at icon size if the game ever
ships as a PWA.

## Files

- [index.html](../index.html) — `<title>` element
