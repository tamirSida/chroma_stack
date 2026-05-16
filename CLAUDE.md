# Chroma Stack — project guide

This file is loaded into the assistant's context on every session in this
repo. Treat the rules here as binding for any work in this project.

## Playwright media

All Playwright artifacts — screenshots, videos, traces, anything produced
by `mcp__playwright__*` tools — must be written to the project's
`playwright-media/` directory at the repo root. Never write `.png` /
`.webm` / `.mp4` files to the project root itself.

- `mcp__playwright__browser_take_screenshot` calls must pass a `filename`
  that begins with `playwright-media/` (e.g. `playwright-media/foo.png`).
- `mcp__playwright__browser_run_code_unsafe` scripts that use Playwright's
  `recordVideo` must save via `video.saveAs('/abs/path/playwright-media/<name>.webm')`
  with a `YYMMDD-HHMMSS` timestamp in `<name>`. Never overwrite an
  existing file in there.
- The MCP's own auto-generated logs/snapshots live in `.playwright-mcp/`
  (created by the tool, not us) — that's separate and stays where it is.

`playwright-media/` is gitignored. If a specific artifact (e.g. a hero
demo video) should be committed, the user will `git add -f` it
explicitly. Do not commit anything from this directory automatically.

## Feature documentation

Every new feature gets a doc at `features/feat-<N>-<kebab-name>.md` with
this format: frontmatter-style `Version`, `Status`, `Date` lines; a
`What`, `How`, and `Psych / UX reasoning` section; a `Files` list. Bump
`package.json` version when you ship a feature. Patch releases that
refine an existing feature can append a `## v0.X.Y` section to the
existing doc instead of creating a new one.

## Playwright work goes to a Sonnet subagent

Long Playwright loops (video recording, automated game-play, multi-step
smoke tests) are delegated to a Sonnet subagent via the `Agent` tool with
`model: sonnet` and `subagent_type: claude`. Main-thread Opus stays for
design and code decisions. One-off probes (a single screenshot, a single
drag) stay on the main thread — overhead of a subagent isn't worth it.
The `agent-play-game` skill already enforces this for its own runs.

## No auto-Playwright after code changes

Do not proactively spin up Playwright to "verify in the browser" after a
code change. Typecheck, ship, report. The user triggers UI verification
explicitly when they want it.
