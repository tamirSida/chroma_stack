# Chroma Stack

A mobile-first color-block puzzle game. Drag polyominoes onto an 8×8
grid, fill rows or columns to clear them, chain clears for exponential
combos, hunt mono-colored line bonuses. Built with Vite + vanilla
TypeScript. Firebase Auth + Firestore power the leaderboard and
cross-device save.

- **Player-facing rules and flow:** [GAME.md](GAME.md)
- **Per-feature design + psych/UX rationale:** [features/](features/)
- **Project-scoped assistant rules:** [CLAUDE.md](CLAUDE.md)

## Stack

- **Vite + vanilla TypeScript** — no framework, fast HMR, tiny static build.
- **Firebase 11** — anonymous auth on load, upgrade to Google or email/password.
- **Firestore** — user profiles + daily and all-time leaderboards.
- **Web Audio API** — synthesised SFX + 124 BPM A-Dorian arcade BGM, no external samples.

The game runs locally without Firebase configured (anonymous-only, no
leaderboard, coins persist in `localStorage` only). Once you fill in
`.env`, the leaderboard, cross-device sync, and Google/email sign-in
light up.

## Running locally

```bash
npm install
cp .env.example .env     # then paste your Firebase web config (see below)
npm run dev
```

The dev server prints a `Network:` URL — open it on a phone over LAN to
test touch handling, haptics, safe-area padding.

```bash
npm run build            # tsc + vite build -> ./dist
npm run preview          # serve the production build locally
```

## Firebase project setup (one-time)

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method** — enable:
   - Anonymous
   - Google
   - Email/Password
3. **Authentication → Settings → Authorized domains** — add `localhost`
   (for dev) and your Netlify domain.
4. **Firestore Database** — create the database, start in Production mode.
5. Copy the web config from **Project settings → General → Your apps**
   into `.env` as the six `VITE_FIREBASE_*` variables.
6. Deploy security rules and the composite index:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   Or paste [firestore.rules](firestore.rules) and the daily-leaderboard
   index manually in the Firebase Console.

## Netlify deploy

1. Push to GitHub.
2. Connect the repo in the Netlify dashboard. [netlify.toml](netlify.toml)
   already sets the build command, publish directory, and CSP/COOP
   headers (the latter are required for Google sign-in popup to work).
3. **Site settings → Environment variables** — add the six
   `VITE_FIREBASE_*` keys. Vite reads them at build time.
4. After the first deploy, add the Netlify URL to **Firebase → Auth →
   Settings → Authorized domains**.

## File map

| Path | Role |
| --- | --- |
| `index.html` | App shell — score bar, board, tray, powers row, targeting bar, action buttons. |
| `src/main.ts` | Boot + game loop + integration glue. |
| `src/types.ts` | Shared types — `GameState`, `Piece`, `ClearResult`, etc. |
| `src/game.ts` | Pure logic: placement, clear detection, scoring (exp combo + super-linear mono), near-miss. |
| `src/pieces.ts` | 15 polyomino shapes + random spawner. |
| `src/powers.ts` | Power definitions (Undo, Reroll, Recolor, Paint, Wipe) + effects + snapshot/restore. |
| `src/render.ts` | DOM mutation: board, tray, powers row, particles, hype floats, animations. |
| `src/input.ts` | Pointer Events: drag preview, snap math, drop dispatch. |
| `src/audio.ts` | Lazy Web Audio: layered SFX through a master compressor + procedural reverb. |
| `src/bgm.ts` | Procedural arcade BGM scheduler (Two-Clocks pattern). 124 BPM A Dorian. |
| `src/haptics.ts` | `navigator.vibrate` wrapper with feature detection. |
| `src/firebase.ts` | App init (no-ops if `.env` missing). |
| `src/auth.ts` | Anonymous boot, Google/email link & merge, sign-out. |
| `src/firestore.ts` | Profile R/W, leaderboard submit + queries, coin sync. |
| `src/ui/home.ts` | Home screen (banner + Google / email / guest CTAs). |
| `src/ui/overlays.ts` | Game-over card, settings, sign-in, leaderboard. |
| `src/ui/toast.ts` | Transient toast messages. |
| `src/ui/icons.ts` | Inline SVG icons (multi-colour Google G). |
| `firestore.rules` | Server-side write guards (monotonic score-only-increase + score cap). |
| `firestore.indexes.json` | Composite index for the daily leaderboard. |
| `firebase.json` / `.firebaserc` | Firebase CLI config (rules + indexes deploy targets). |
| `netlify.toml` | Build command, CSP/COOP headers. |
| `features/feat-*.md` | Per-feature design notes (what / how / psych-UX reasoning). |
| `playwright-media/` | Generated screenshots and videos (gitignored). |
| `.claude/skills/agent-play-game/` | Slash command that drives a bot through the game and records a video. |

## Security notes

- The Firebase web `apiKey` is **not a secret**. Protection comes from
  **Firestore Security Rules** (in [firestore.rules](firestore.rules))
  plus **Authorized Domains** in the Firebase Console. Don't try to
  "hide" the API key.
- The rules enforce **monotonic score-only-increases** and a 1,000,000
  score cap. That blocks trivial DevTools tampering and decrement
  attacks. A determined attacker can still write a fake high score once.
  If that becomes a problem, enable **App Check** with reCAPTCHA
  Enterprise — free up to 10K assessments/month and blocks ~all
  script-kiddie writes.

## Design highlights

- **Anonymous-first auth.** Open game → start playing instantly. Sign-in
  CTAs fire at peak motivation (new personal best). The most retention-
  positive pattern in casual mobile (Wordle, NYT Games, Threes).
- **Skill game with slot-machine-shaped score variance.** Exponential
  combo (`× 1.4^(combo-1)`) + variable-ratio Score Surge (hidden
  ~1-in-10) + cross-clear jackpot + monochromatic-line super-linear
  bonus. Peak single-placement to median ratio sits at ~10–15× — the
  evidence-backed sweet spot for sustained engagement without feeling
  on rails (Harrigan & Dixon 2009). See [feat-5](features/feat-5-score-multipliers.md).
- **Procedural music + SFX through a shared compressor.** Music side-
  chain-ducks under loud SFX naturally because everything routes through
  one compressor. Zero sample files. See [feat-3](features/feat-3-adrenaline-audio.md)
  and [feat-4](features/feat-4-bgm.md).
- **Anonymous → permanent account upgrade with merge.** Sign in mid-
  game and your anon best score + coins merge into the new account.
  iOS Safari rotates anonymous UIDs every 7+ days, so the upgrade prompt
  is timed to fire when the player has something worth saving.
- **Daily + all-time leaderboard with rank display.** Daily creates a
  habit-loop trigger; all-time provides aspirational ceiling; pinned
  "You: #N · top X%" keeps non-top-50 players engaged.
- **`signInWithPopup` only.** `signInWithRedirect` is broken on current
  Chrome/Safari without a reverse-proxy at `/__/auth/*` (Netlify can't
  trivially provide one).

## Feature index

| # | Feature | Doc | Version |
| ---: | --- | --- | ---: |
| 1 | Rename Cascade → Chroma Stack | [feat-1](features/feat-1-rename-chroma-stack.md) | 0.1.1 |
| 2 | Powers + coin economy | [feat-2](features/feat-2-powers-and-coins.md) | 0.2.0 |
| 3 | Adrenaline-tuned audio | [feat-3](features/feat-3-adrenaline-audio.md) | 0.3.1 |
| 4 | Arcade background music | [feat-4](features/feat-4-bgm.md) | 0.4.2 |
| 5 | High-variance score multipliers | [feat-5](features/feat-5-score-multipliers.md) | 0.5.0 |
| 6 | Home screen (banner + login or guest) | [feat-6](features/feat-6-home-screen.md) | 0.6.2 |
| 7 | UX polish — paint targeting + score prominence | [feat-7](features/feat-7-ux-polish.md) | 0.7.0 |
| 8 | Onboarding overlay + in-game help | [feat-8](features/feat-8-onboarding.md) | 0.8.0 |

## Bot / video recording

`/agent-play-game <duration> <behavior>` drives a Playwright bot through
the game and records a webm to `playwright-media/`. Behaviors:

- `random` — uniformly picks valid placements
- `greedy` — heuristic scoring (lines, monos, tightness, height
  penalty)
- `smart` — greedy + post-clear board evaluation (holes, height,
  unevenness)

Examples: `/agent-play-game 60s greedy`, `/agent-play-game 2m smart`.
The bot run is delegated to a Sonnet subagent to keep token cost low.
See [.claude/skills/agent-play-game/](.claude/skills/agent-play-game/).
