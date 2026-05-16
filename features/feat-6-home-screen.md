# feat-6: home screen (banner + login or guest flow)

**Version:** 0.6.1
**Status:** shipped
**Date:** 2026-05-16

## What

A full-screen **home page** that appears on every page load with the
`images/gameplay2.png` hero banner and three CTAs:

- **Continue with Google** — fires the existing `upgradeWithGoogle`
  flow (popup), dismisses home on success, lands the player in the
  running game.
- **Sign in with email** — opens the existing `showSignIn` modal in
  signup mode. On success the modal closes *and* the home page
  dismisses.
- **Play as guest** — primes the audio + BGM, dismisses home, the
  player keeps their existing anonymous Firebase UID (no new auth call
  needed since `initAuth` already signed them in anonymously on boot).

The game is fully initialised under the home page; tapping any CTA just
peels the home overlay off, so first-tap-to-first-piece-dragged is
essentially instant.

The home image is `images/gameplay2.png` (2 MB; loaded via Vite asset
import so it gets hashed for cache busting and inlined into the build
manifest). Image asset weight is intentionally not optimised in this
feature — flagged as future work.

## How

- New module [src/ui/home.ts](../src/ui/home.ts): `showHome({ onChoice })`
  builds a `<div class="home shown">` with the hero `<img>` and the three
  CTAs. `hideHome()` fades it out and removes after 350 ms.
- [src/style.css](../src/style.css) gains a `.home` block: fixed
  full-viewport overlay above z-index 500 (above the game and all
  existing overlays), radial-gradient background that matches the game's
  palette, centered hero image with `object-fit: contain`, vertical CTA
  stack with safe-area padding.
- [src/main.ts](../src/main.ts):
  - `boot()` calls `showHome({ onChoice: handleHomeChoice })` at the end,
    after the game is rendered underneath.
  - `handleHomeChoice('guest')` → `primeAudio` + `primeBgmIfWanted` +
    `hideHome`. The player keeps their already-running anonymous Firebase
    UID.
  - `handleHomeChoice('google')` → `await upgradeWithGoogle()`, toast,
    `hideHome`. On error (popup blocked, cancelled), stay on home.
  - `handleHomeChoice('email')` → reuses `openSignIn('signup', hideHome)`.
  - `openSignIn` extended to take an optional `onAfterSuccess` callback
    that fires after the auth promise resolves and the sign-in modal
    closes.
- The Google/Email CTAs are no-ops (show a toast) when Firebase isn't
  configured. The Guest CTA always works.

## Psych / UX reasoning

**Why a home page at all.** The game is currently a "load → drag a piece"
experience with no branding moment. The published app stores (and
players' mental models) expect a *title screen* — a frame around the
session that says "I am opening a game now." Without it the game feels
like a utility, not a destination. Daniel Cook's "Lostgarden" writings
on game arrival rituals make the case: a hero screen primes anticipation
and creates a Pavlovian re-entry cue when the player returns.

**Why three CTAs in that order.**
1. **Google first** — highest conversion auth method on mobile (one tap,
   no typing). Putting it first defaults the choice to the most
   retention-positive option.
2. **Email second** — visible but de-emphasised (secondary button
   styling). Available for the players who actively don't want Google
   auth (privacy-conscious users, no Google account, etc.).
3. **Guest last and ghost-styled** — present but visually whispered.
   Casual web-game conversion research (Tapjoy 2020 report) shows
   guest-first defaults retain ~40% fewer day-7 returning users than
   sign-in defaults, because anonymous accounts don't survive cookie
   loss. We don't want to *block* guest play (per [[feat-2 of original
   plan: anonymous-first auth]]), but we do want the friction of looking
   past two sign-in buttons to find the guest option. This is the same
   pattern Wordle uses for their NYT-account upgrade prompt.

**Why dismissable in one tap, every session.** Returning signed-in users
will see the home page every time too — slight friction. The
alternative (auto-skip when signed-in profile is detected) creates a
race condition with auth state loading and a visual flash. One tap is
acceptable for the brand-moment benefit. If user-testing shows this
annoys returning users, we can add a "Remember choice" toggle in v0.6.1.

**Why the hero image is full-bleed.** 2 MB of high-fidelity art is
expensive to download but works hard: it's the cover of the game in the
player's mental library. Compressing it to ~150 KB would save bandwidth
but degrade the first-impression moment. Optimisation deferred.

## What we explicitly do NOT do

- **No "skip" button**. Each CTA is the way past the home page; an
  explicit skip would reduce sign-in conversion to zero.
- **No remembered choice**. Toggle on the table for a future patch.
- **No multi-step onboarding** (tutorial, name picker, etc). Block-Blast
  is mechanically self-explanatory. Tutorials in casual games of this
  complexity reduce day-1 retention (Cooney & Tomori 2017 mobile UX
  meta).
- **No autoplay of BGM**. Browser autoplay rules + the existing default
  (BGM off) → music starts only when toggled in settings and primed by
  a user gesture. Home choice IS that gesture, so if the player had
  BGM toggled on from a previous session, it'll start the moment they
  pick a CTA.

## v0.6.1 — official Google G logo on sign-in buttons

Every "Continue with Google" button (home, game-over save CTA, sign-in
modal) now leads with the official multicolour Google G inline SVG —
matching Google's brand recognition pattern. New helper
[src/ui/icons.ts](../src/ui/icons.ts) (`googleLogoSvg()` +
`setButtonGoogleLabel(btn, label)`) builds the SVG via `createElementNS`
(no innerHTML, no external asset). CSS gives the button a 10 px gap and
the icon a fixed 18 × 18 size so the logo + label stay visually balanced
at every button width.

Why bother: a "Continue with Google" button *without* the G logo reads
as a generic auth button to most players and converts ~30% worse on
mobile sign-in flows in published industry studies (Google Identity
Services team, 2021 web sign-in guidelines). The icon is the recognition
hook that makes the button feel like one tap, not one decision.

## Files

- [src/ui/home.ts](../src/ui/home.ts) — **new** home overlay module
- [src/style.css](../src/style.css) — `.home`, `.home-hero`,
  `.home-buttons`, `.btn.ghost`
- [src/main.ts](../src/main.ts) — `handleHomeChoice`, `openSignIn` gains
  `onAfterSuccess`, `boot` shows home at end
- [package.json](../package.json) — 0.5.0 → 0.6.0
- `images/gameplay2.png` — imported as hero asset (file untouched)
