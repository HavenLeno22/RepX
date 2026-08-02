# Roadmap

> **Purpose:** Sequence RepX's build phases from the current playable core loop
> to a production launch capable of supporting millions of users.
> **Version:** 0.2.0
> **Status:** Living
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Phase 0 — Foundation ✅](#phase-0--foundation-)
2. [Phase 1 — Core Loop ✅](#phase-1--core-loop-)
3. [Phase 2 — Trustworthy (next)](#phase-2--trustworthy-next)
4. [Phase 3 — Social & Retention](#phase-3--social--retention)
5. [Phase 4 — Mobile & Scale](#phase-4--mobile--scale)
6. [Phase 5 — Platform](#phase-5--platform)
7. [Feature Backlog](#feature-backlog)

## Phase 0 — Foundation ✅

Repository scaffold, full documentation set, tooling. Complete.

## Phase 1 — Core Loop ✅

Complete and playable — see [`IMPLEMENT.md`](IMPLEMENT.md).

- `shared/` contract: zod schemas, ELO math, 7 exercise plugins.
- Backend: auth, users, exercises, matchmaking, live match engine, ELO,
  anti-cheat.
- Frontend: auth, dashboard, exercise picker, matchmaking, live arena with
  in-browser pose estimation, results, profile, leaderboard.
- Server-authoritative rep verification with anti-cheat screening.

## Phase 2 — Trustworthy (next)

Nothing here is a feature; it is what makes the existing product safe to put in
front of real users. **This should be done before building anything new.**

1. **Automated test suite** — the biggest gap. Exercise-plugin fixture tests,
   ELO unit tests, and an end-to-end two-player match test. See
   [`TESTING.md`](TESTING.md#-current-state--the-biggest-gap-in-the-project).
2. **Rate limiting** on auth and matchmaking endpoints
   ([`SECURITY.md`](SECURITY.md#api-security)).
3. **Google + Apple sign-in** ([`AUTHENTICATION.md`](AUTHENTICATION.md)).
4. **Cheat-flag escalation policy** — flags are recorded but nothing acts on
   them ([`ANTI_CHEAT.md`](ANTI_CHEAT.md#response-to-detected-cheating)).
5. **Error tracking and structured logging**
   ([`ERROR_HANDLING.md`](ERROR_HANDLING.md)).
6. **Onboarding practice mode** — a solo, unranked first exercise so a new
   player learns camera framing before their rating is at stake.
7. **Per-exercise ratings** — currently one global rating spans all exercises,
   which the design says is wrong and produces poor pairings. The data to split
   it is already recorded; the change is additive. See
   [`ELO_SYSTEM.md`](ELO_SYSTEM.md#per-exercise-vs-global-rating).
8. **Self-host the pose model** — first load currently depends on a CDN.

## Phase 3 — Social & Retention

The product brief's social layer, in dependency order:

- Friends and direct challenges; private rooms.
- Streaks and daily goals (the Duolingo mechanic — `currentStreak` and
  `longestStreak` already exist and are maintained).
- Achievements and season rewards.
- Push/in-app notifications ([`NOTIFICATIONS.md`](NOTIFICATIONS.md)).
- National/regional/friend leaderboards (global exists today).
- Match replay from the stored landmark stream.

## Phase 4 — Mobile & Scale

- **React Native client** reusing `shared/` wholesale — see
  [`TECH_STACK.md`](TECH_STACK.md#frontend-framework).
- **Device attestation** (Play Integrity / App Attest), which materially raises
  ranked integrity above what a browser can guarantee.
- **Postgres + Redis migration** and multi-node deployment with the Socket.IO
  Redis adapter ([`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md#scaling-strategy)).
- Load testing toward "thousands of concurrent matches"
  ([`PERFORMANCE.md`](PERFORMANCE.md)).
- Analytics pipeline ([`ANALYTICS.md`](ANALYTICS.md)).

## Phase 5 — Platform

- Tournaments and professional leagues.
- Clubs and teams.
- Spectator mode and streaming.
- AI personal trainer, workout plans, coach mode.
- Wearable/heart-rate integration.
- Desktop and TV clients.
- Monetization ([`MONETIZATION.md`](MONETIZATION.md)) — constrained by the
  no-pay-to-win rule.

## Feature Backlog

Everything from the product brief not yet placed above: custom challenges,
voice chat, cross-platform play, exercise replay sharing, seasonal ladder
resets, rating decay for inactivity.
