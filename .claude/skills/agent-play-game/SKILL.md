---
name: agent-play-game
description: Drives an automated bot to play the local Cascade game in a recorded Playwright browser session, producing a .webm video. Use when the user wants a bot to play the game for them. Args (free-form): duration (e.g. "60s", "2m", "90") + optional behavior ("random" | "greedy" | "smart"). If duration is missing, ask. If behavior is missing, present all three options via AskUserQuestion.
---

# agent-play-game

When this skill fires, drive a Playwright-recorded bot through the Cascade game running at `http://localhost:5173`. Three behavior modes are supported.

## Parse arguments

`$ARGUMENTS` is free-form. Tokens may appear in any order.

- **Duration** — required. Accept any of:
  - `60s`, `90s` → seconds
  - `2m`, `1.5m` → minutes (× 60 → seconds)
  - bare number (e.g. `60`) → seconds
  - If missing or unparseable, ask the user for it.
- **Behavior** — optional. One of `random`, `greedy`, `smart` (case-insensitive). If missing, use `AskUserQuestion` to present the three options described below. Don't default silently.

Cap duration at 600 seconds (10 min) to keep recording sizes sane; warn if the user requested more.

## Behaviors

| Mode | What it does |
| --- | --- |
| `random` | Uniformly picks a valid placement at random. Plays chaotically, hits game-over fast. Good baseline. |
| `greedy` | Scores placements by lines cleared (×500) + monochrome line bonus (×400) + adjacency tightness + column-height penalty. No lookahead. |
| `smart`  | Greedy scoring *plus* post-clear board evaluation — penalizes holes, max column height, and uneven heights. Plays substantially longer than greedy. Still no multi-piece lookahead (kept fast for real-time recording). |

## Preflight

1. `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/` — must return `200`. If not, tell the user to run `npm run dev` and stop.
2. `ls ~/Library/Caches/ms-playwright/ffmpeg-*` — if no match, run `npx playwright install ffmpeg` (it's a ~1 MB download).

## Run the bot — delegate to a Sonnet subagent

Do **not** run the Playwright loop on the main (Opus) thread. The bot run is long, token-heavy, and decision-light — it's the textbook case for delegating to Sonnet.

1. Read `.claude/skills/agent-play-game/bot.template.js` from the project.
2. Substitute these placeholders in the file's text:
   - `{{BEHAVIOR}}` → the chosen behavior string (literal: `random`, `greedy`, or `smart`)
   - `{{SECONDS}}` → the duration in seconds as a number
   - `{{OUTPUT_PATH}}` → an absolute path like `/Users/<user>/dev/game/cascade-<behavior>-<timestamp>.webm` (use `pwd` + a `YYMMDD-HHMMSS` timestamp; never overwrite an existing file)
3. Spawn an `Agent` with `subagent_type: claude` and **`model: sonnet`**. The agent's prompt must be fully self-contained — the subagent has no conversation history. Include:
   - The substituted code block, ready to pass to `mcp__playwright__browser_run_code_unsafe`.
   - One sentence telling it to call that tool with the code, wait for the result, and return the result JSON verbatim.
   - The expected output path so the agent can confirm the file exists at the end.
4. When the agent returns its result, surface that result back to the user. Do not re-run the bot on the main thread, even if the subagent fails.

## Report back

When the bot returns, surface to the user:
- Number of moves played
- Final / restart count (the bot auto-restarts on game-over)
- A markdown link to the video file (relative to the project root)
- File size

Keep the report under ~5 lines. Don't paste the raw bot output.

## Failure modes

- If the dev server dies mid-recording, the bot's `decideMove` will fail. Catch and stop early; still save whatever video was produced.
- If Playwright's ffmpeg is missing, the `newContext` call throws with a clear hint; install ffmpeg and retry.
- Video format is `.webm`. If the user explicitly asks for `.mp4`, mention that system `ffmpeg` (via `brew install ffmpeg`) can convert it — but don't install it preemptively.
