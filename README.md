# Cascade

A mobile-first block-puzzle game fusing Block Blast (line clears) with Candy
Crush (color-match clusters). Built with Vite + vanilla TypeScript. Firebase
Auth + Firestore power the leaderboard and cross-device save.

## Stack

- **Vite + vanilla TypeScript** — no framework, fast HMR, tiny static build.
- **Firebase 11** — anonymous auth on load, upgrade to Google or email/password.
- **Firestore** — user profiles + daily and all-time leaderboards.

The game runs locally without Firebase configured (anonymous-only, no
leaderboard). Once you fill in `.env`, all online features light up.

## Running locally

```bash
npm install
cp .env.example .env     # then paste in your Firebase web config
npm run dev
```

The dev server prints a `Network:` URL — open it on a phone over LAN to test
touch handling, haptics, and safe-area padding.

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
3. **Authentication → Settings → Authorized domains** — add `localhost` (for
   dev) and your Netlify domain.
4. **Firestore Database** — create database, start in Production mode.
5. Copy the web config from **Project settings → General → Your apps** into
   `.env` as the six `VITE_FIREBASE_*` variables.
6. Deploy security rules and the composite index:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add        # link to your project
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   Or paste `firestore.rules` and the daily-leaderboard index manually in the
   Firebase Console.

## Netlify deploy

1. Push to GitHub.
2. Connect the repo in the Netlify dashboard. `netlify.toml` already sets the
   build command, publish directory, and CSP/COOP headers (the latter are
   required for Google sign-in popup to work).
3. **Site settings → Environment variables** — add the six `VITE_FIREBASE_*`
   keys. Vite reads them at build time.
4. After the first deploy, add the Netlify URL to **Firebase → Auth → Settings
   → Authorized domains**.

## Files

| Path | Role |
| --- | --- |
| `index.html` | App shell — score bar, board, tray, action buttons. |
| `src/main.ts` | Boot + game loop + integration glue. |
| `src/game.ts` | Pure logic: placement, clear detection, scoring, near-miss. |
| `src/pieces.ts` | 15 polyomino shapes + random spawner. |
| `src/render.ts` | DOM mutation: board, tray, particles, animations. |
| `src/input.ts` | Pointer Events: drag preview, snap math, drop dispatch. |
| `src/audio.ts` | Lazy Web Audio: ascending semitone tones. |
| `src/haptics.ts` | `navigator.vibrate` wrapper with feature detection. |
| `src/firebase.ts` | App init (no-ops if `.env` missing). |
| `src/auth.ts` | Anonymous boot, Google/email link & merge. |
| `src/firestore.ts` | Profile R/W, leaderboard submit + queries. |
| `src/ui/overlays.ts` | Game-over card, settings, sign-in, leaderboard. |
| `src/ui/toast.ts` | Transient toast messages. |
| `firestore.rules` | Server-side write guards (monotonic score-only-increase). |
| `firestore.indexes.json` | Composite index for the daily leaderboard. |
| `netlify.toml` | Build command, CSP/COOP headers. |

## Security notes

- The Firebase web `apiKey` is not a secret. Protection comes from
  **Firestore Security Rules** (in `firestore.rules`) + **Authorized
  Domains** in the Firebase Console. Don't try to "hide" the API key.
- The rules enforce **monotonic score-only-increases** and a 1,000,000 score
  cap. That blocks trivial DevTools tampering and decrement attacks. A
  determined attacker can still write a fake high score once. If that
  becomes a problem, enable **App Check** with reCAPTCHA Enterprise — free
  up to 10K assessments/month and blocks ~all script-kiddie writes.

## Design decisions

- **Anonymous auth on load.** The most addictive pattern in casual mobile
  gaming (Wordle, NYT Games, Threes) is zero friction to first play. Sign-in
  CTAs fire only when the player has something worth saving (new personal
  best). localStorage is the fallback so iOS Safari's anonymous-UID rotation
  doesn't feel like data loss.
- **Daily + All-time leaderboard, with "Your rank" always shown.** Daily
  creates a habit-loop trigger; all-time provides aspirational ceiling;
  showing rank/percentile keeps non-top-50 players engaged.
- **`signInWithPopup` only.** `signInWithRedirect` is broken on current
  Chrome/Safari without a reverse-proxy at `/__/auth/*`, which Netlify
  doesn't trivially support.
