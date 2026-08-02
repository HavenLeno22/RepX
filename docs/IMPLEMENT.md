# Implement

> **Purpose:** The master index of RepX's current build phase — what exists,
> what's next, and how the rest of `docs/` fits together operationally. Read
> this first when picking up work on the repository.
> **Version:** 0.3.0
> **Status:** Living
> **Last Updated:** 2026-08-02

## Table of Contents

1. [Current Phase](#current-phase)
2. [How to Run It](#how-to-run-it)
3. [What Works Today](#what-works-today)
4. [What Does Not Exist Yet](#what-does-not-exist-yet)
5. [Decisions Revised During Implementation](#decisions-revised-during-implementation)
6. [Verification Performed](#verification-performed)
7. [How to Pick Up Work](#how-to-pick-up-work)

## Current Phase

**Phase 1 — Core Loop, playable.** The full competitive loop works end to end:
sign in → pick an exercise → matchmaking → live camera match with AI-verified
reps → ELO settlement → profile and leaderboard.

## How to Run It

Requires **Node 20+**. Nothing else — no Docker, no database server, no Python.

```bash
npm run setup     # install deps, build shared, create + seed the SQLite database
npm run dev       # starts backend (:4000) and frontend (:5173) together
```

Open **http://localhost:5173** and allow camera access.

To actually play a match you need two players. Open a second browser profile
(or an incognito window), sign in as a different account, and queue for the same
exercise. Seeded demo accounts all use password `repx1234`:

| Email | Rating |
|---|---|
| `rookie@repx.dev` | 1000 |
| `mike@repx.dev` | 1480 |
| `sasha@repx.dev` | 1725 |
| `pat@repx.dev` | 1190 |
| `rio@repx.dev` | 2040 |

Useful extras:

```bash
npm run dev:backend      # backend only
npm run dev:frontend     # frontend only
npm run build            # production build of all three packages
npm run typecheck        # typecheck all three packages
npm run db:studio        # browse the database in Prisma Studio
npm run db:setup         # re-create and re-seed the database
```

**First match loads a ~5MB pose model from a CDN** — that one download needs an
internet connection, and is cached afterwards. It now begins on the home screen
rather than after an opponent is found; see below.

```bash
npm test                 # 26 offline engine + ELO tests, ~100ms
npm run test:e2e         # full two-player match; needs the API running
```

## Recent Changes (v0.5) — progression, and the locked palette

The application had become internally inconsistent with its own design document,
and — more importantly — it computed rewards it never showed. Three themes:

**A product between matches.** XP, levels, performance grades, 30 achievements
across 6 rarity tiers, daily and weekly missions, 8-week seasons, notifications,
day streaks and friends did not exist. The home screen read as a dashboard
because there was nothing else for it to be. All of it now lives in
`shared/src/progression/` (pure, tested) and
`backend/src/modules/progression/` + `social/` (persistence and evaluation), and
the reward stack is resolved inside the settle transaction and sent with the
result rather than re-fetched — so the celebration cannot disagree with what was
written. See [`PRODUCT_EXPERIENCE.md`](PRODUCT_EXPERIENCE.md#12-progression-system).

**The locked palette, enforced.** `DESIGN_SYSTEM.md` specified an olive brand and
two themes; neither matched the official RepX palette. The palette is now defined
once in `shared/src/constants/palette.ts`, shared with the server, and mirrored
as CSS custom properties. Dark-only, as a brand decision. Emoji were removed
entirely in favour of a hand-authored 44-icon stroke set. The colour audit and
everything it found is in
[`FINAL_DESIGN_AUDIT.md`](FINAL_DESIGN_AUDIT.md#21-colour--the-locked-palette-enforced).

**Four new screens and a rebuild of the rest.** Battles (renamed from Match
History), Achievements, Notifications, Friends and Onboarding are new; Home,
Play, Leaderboard, Profile, Result, Settings, Sign-in and the arena were rebuilt
against [`PRODUCT_EXPERIENCE.md`](PRODUCT_EXPERIENCE.md). Motion is now specified
rather than ad hoc — see [`MOTION_SYSTEM.md`](MOTION_SYSTEM.md).

Also: a grading bug caught by a new test (63% form accuracy was earning an A),
avatar fallbacks no longer generate 360 unbudgeted colours, and the seed creates
friendships and notifications so the new screens are reviewable on a fresh
install.

## Recent Changes (v0.4)

Three themes, all driven by playtest feedback: reps that did not count,
matchmaking that raced the player, and a UI that read as a website.

**Reps that were performed but not counted.** Beyond the original squat
knee-angle bug, six more ways the engine discarded real repetitions: averaging
in an occluded limb, resetting on a single dropped frame, requiring every
landmark instead of either side of a pair, re-running bottom-only form checks
during the ascent, demanding a pause at the bottom, and spreading noise through
a mean instead of rejecting it with a median. Each now has a regression test.
Full write-up:
[`EXERCISE_ENGINE.md`](EXERCISE_ENGINE.md#counting-reps-the-camera-can-only-half-see).

**Matchmaking that raced the player.** The camera and pose model used to load
*after* an opponent was found, so a cold model download ran against a countdown
already ticking on the server — the match went live while the player watched a
spinner. The arena is now warmed before queueing. The search screen's "widening"
rating band, meanwhile, never widened: queue status was sent once at join. It is
now pushed every second. See
[`MATCHMAKING.md`](MATCHMAKING.md#being-ready-before-you-are-matched).

**A UI that read as a website.** Every screen opened with a heading and an
explanatory paragraph. Rebuilt against the Chess.com *app*: bottom tab bar on
touch, left rail on desktop, and prose replaced throughout with chips, segmented
controls, stat tiles and icon-led empty states. See
[`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md#no-prose).

Also: server-authoritative match clock, reconnect-into-match actually handled on
the client, per-frame `match:progress` chatter removed, MediaPipe code-split out
of the initial bundle, landmark uplink capped at 24fps, and the two-player
end-to-end match test committed instead of re-run by hand.

## What Works Today

- **Auth** — email/password registration and login, scrypt-hashed passwords,
  JWT access tokens with rotating refresh tokens, transparent refresh-and-retry
  on the client. (`backend/src/modules/auth/`)
- **Exercise engine** — 7 exercises as plugins: push-up, squat, pull-up, sit-up,
  jumping jack, burpee, plank. Each is a rep state machine over joint angles with
  its own form checks. (`shared/src/exercise-engine/`)
- **AI rep verification** — MediaPipe Pose runs in-browser on the webcam; the
  landmark stream (never the video) goes to the server, which re-runs the same
  plugin authoritatively. (`frontend/src/lib/pose.ts`, `backend/src/modules/match/`)
- **Anti-cheat** — replay detection, sequence-order enforcement, clock-forgery
  detection, static-input detection, subject-discontinuity detection, plus
  per-exercise range-of-motion and form rejection. (`backend/src/modules/anti-cheat/`)
- **Matchmaking** — ranked/quick/friendly queues keyed by exercise, with rating
  bands that widen the longer you wait. (`backend/src/modules/matchmaking/`)
- **Live multiplayer** — Socket.IO rooms, countdown → active → settled state
  machine, live opponent progress, disconnect grace period and forfeit.
- **ELO** — full chess-style rating with tiered K-factor, provisional placement
  period, append-only rating ledger, and 7 rank tiers Bronze→Grandmaster.
- **Progression** — XP and levels 1–100, S–D performance grades, 30 achievements
  across 6 rarity tiers, deterministic daily/weekly missions, 8-week seasons, day
  streaks, and notifications. All rewards are *measured* against a snapshot
  rather than granted, so nothing can be awarded by one code path and missed by
  another. (`shared/src/progression/`, `backend/src/modules/progression/`)
- **Social** — friends with requests and acceptance, live presence
  (online / queueing / in-match), and a leaderboard scoped global / country /
  friends. (`backend/src/modules/social/`)
- **UI** — sign-in, onboarding, home, play lobby, matchmaking, live arena with
  skeleton overlay, momentum bar and depth meter, result ceremony, battle
  history, achievements, notifications, friends, profile with rating curve and
  exercise radar, leaderboard with animated podium, and grouped settings.
  Dark-only on the locked palette, with real motion and contrast controls.
- **Tests** — 51 exercise-engine, ELO and progression regression tests
  (`npm test`).

## What Does Not Exist Yet

- **Google / Apple sign-in.** Designed in [`AUTHENTICATION.md`](AUTHENTICATION.md),
  not wired up — both need real OAuth credentials to be useful.
- **Mobile app.** See [Decisions Revised](#decisions-revised-during-implementation).
- **Tournaments, clubs, private rooms, direct friend challenges, monetization.**
  Still roadmap — see [`ROADMAP.md`](ROADMAP.md). Each is shown on the Play
  screen as a dimmed "Soon" card rather than a disabled control, because stating
  it plainly beats implying it already works.
- **Backend, frontend, and end-to-end tests.** The exercise engine, ELO and
  progression are covered; the server, the UI and every user flow are not. This
  is the largest risk in the project — see
  [`FINAL_DESIGN_AUDIT.md`](FINAL_DESIGN_AUDIT.md#blocking).
- **Redis, multi-node scaling, production deployment.** Matchmaking and live
  match state are in-memory, which is correct for one node and wrong for many.
  See [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md#scaling-strategy).

## Decisions Revised During Implementation

These differ from the original Phase 0 documents. Each is recorded with its
reason rather than quietly changed.

| Original | Now | Why |
|---|---|---|
| React Native / Expo mobile app | **React web app (Vite)** | MediaPipe pose estimation in React Native needs native modules and a bare-workflow build — Android Studio or Xcode required before a single rep could be seen. Web runs the identical model today with no toolchain. `shared/` holds all the logic, so the RN port reuses it and rewrites only UI. |
| pnpm + Turborepo | **npm workspaces** | pnpm was not installed and Turborepo added a build layer with no benefit at three packages. npm workspaces ships with Node. |
| PostgreSQL + Redis | **SQLite, Redis optional** | No Docker available locally. The Prisma schema deliberately avoids native enums and Postgres-only types so the production swap is a provider change plus a migration. |
| Argon2id password hashing | **scrypt** (Node built-in) | `argon2` is a native addon requiring `node-gyp rebuild` — a C++ toolchain — which broke `npm install` on Windows. scrypt is memory-hard and OWASP-listed. See `backend/src/modules/auth/password.ts`. |
| NestJS global `ValidationPipe` | **zod pipes only** | `ValidationPipe` pulls in `class-validator`/DTO decorators, duplicating validation that `shared/` schemas already do for both client and server. |

## Verification Performed

Not claims — these were run against the built application:

- All three packages build clean and typecheck clean.
- `npm test` — 26/26 pass.
- `npm run test:e2e` — **now a committed test rather than a throwaway script**,
  and run three times consecutively to confirm it is repeatable rather than
  passing once against convenient data. Each run: queue status pushed 5–6 times
  with the band widening 100 → 145; `matchmaking:found` carrying `startsAt` one
  countdown ahead of `serverNow`; two real Socket.IO clients paired; the server
  independently counting 10 reps vs 5 from streamed landmarks; zero
  `match:progress` messages coming back; the match settling 10–5 with ELO
  applied. Details in [`TESTING.md`](TESTING.md#current-state).
- REST surface exercised live: exercise catalog (7), register, login, token
  refresh rotation, `/users/me`, `/users/me/stats`, `/leaderboard`.
- Every frontend module transforms and the production build succeeds; the
  MediaPipe chunk splits out as intended (450kB main + 136kB vision).
- **Every screen rendered in headless Chrome over CDP**, signed in as a real
  seeded account: Home, Play, Leaderboard, Profile and Settings all mount with
  no console errors, and at a 390×844 mobile viewport the tab bar and app bar
  are visible, the rail is hidden, and there is no horizontal overflow. Worth
  noting what this does *not* cover: the arena needs a camera, so it is still
  unverified visually.
- **Anti-cheat suite**, all blocked: replayed identical frames, out-of-order
  sequence numbers, forged future timestamps, half-depth reps, sagging-hip form
  breaks. Still verified by hand — see [`TESTING.md`](TESTING.md).

## How to Pick Up Work

1. Read [`README.md`](README.md) (doc map) and [`GLOSSARY.md`](GLOSSARY.md).
2. Read [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) and
   [`TECH_STACK.md`](TECH_STACK.md) for the founding decisions.
3. Read [`ANTI_CHEAT.md`](ANTI_CHEAT.md) — it drives more architecture than any
   other document.
4. Check [`ROADMAP.md`](ROADMAP.md) for what comes next.
5. Use [`PROMPTS/`](PROMPTS/) templates when adding a module or exercise.
