# Product Requirements

> **Purpose:** Define what RepX is, who it's for, and what the product must do —
> the source requirements every other doc in this repository implements.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Vision](#vision)
2. [Positioning](#positioning)
3. [Core Loop](#core-loop)
4. [Launch Feature Set](#launch-feature-set)
5. [Non-Goals (for now)](#non-goals-for-now)
6. [Success Metrics](#success-metrics)
7. [Open Questions](#open-questions)

## Vision

RepX transforms bodyweight fitness into a competitive online sport. Players
compete head-to-head, in real time, performing exercises — push-ups, pull-ups,
squats, burpees, planks, and future exercises — with every repetition verified
by AI-powered pose estimation. Only valid repetitions count. Wins and losses move
a player's ELO rating exactly as in chess.

## Positioning

RepX sits at the intersection of:

- **Chess.com** — ranked ladder, ELO, competitive clarity and trust.
- **Duolingo** — habit formation, streaks, daily-engagement polish.
- **Discord** — social presence, community around competition.
- **Valorant Ranked** — competitive integrity, anti-cheat as a core feature, not
  an afterthought.
- **Strava** — activity culture, personal records, social proof of effort.
- **Apple Fitness** — premium motion design and physical-activity UX.

The product must feel premium in every interaction — this is a design and
performance requirement, not just a tagline (see
[`docs/DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) and [`docs/PERFORMANCE.md`](PERFORMANCE.md)).

## Core Loop

1. Player opens the app, selects an exercise, enters matchmaking
   ([`docs/MATCHMAKING.md`](MATCHMAKING.md)).
2. Player is paired against a similarly-rated opponent.
3. Both players perform the exercise in front of their camera; reps are
   verified live ([`docs/AI_ENGINE.md`](AI_ENGINE.md),
   [`docs/EXERCISE_ENGINE.md`](EXERCISE_ENGINE.md)).
4. Match resolves; ELO updates for both players
   ([`docs/ELO_SYSTEM.md`](ELO_SYSTEM.md)).
5. Player sees result, rating change, and returns to queue or reviews profile/
   leaderboard progress.

## Launch Feature Set

| Feature | Status |
|---|---|
| Email account creation and login | ✅ built |
| Google / Apple sign-in | ⬜ designed, not built |
| Ranked, quick, and friendly 1v1 matches | ✅ built |
| 7 exercises: push-up, squat, pull-up, sit-up, jumping jack, burpee, plank | ✅ built |
| Live AI rep verification, server-authoritative | ✅ built |
| Anti-cheat stream screening + form/ROM rejection | ✅ built |
| ELO rating, ranks, placement period, rating ledger | ✅ built |
| Global leaderboard | ✅ built |
| Profile: stats, rating history, match history | ✅ built |
| Per-exercise leaderboards | ⬜ |
| Push notifications | ⬜ |

⚠️ **Ratings are currently global, not per-exercise** — a single rating spans all
exercises. [`ELO_SYSTEM.md`](ELO_SYSTEM.md#per-exercise-vs-global-rating) argues
per-exercise is correct (push-up skill does not transfer to pull-ups), and the
schema can support it, but it is not yet implemented. This is a real known
divergence between the design and the build.

## Non-Goals (for now)

- Group/team matches beyond 1v1 (see [`docs/MATCHMAKING.md`](MATCHMAKING.md#open-questions)).
- Spectator mode (see [`docs/MULTIPLAYER.md`](MULTIPLAYER.md#spectator-mode)).
- Equipment-based exercises requiring object detection beyond body landmarks.
- Web client at launch (mobile-first; see
  [`docs/TECH_STACK.md`](TECH_STACK.md#frontend-framework)).

## Success Metrics

*(Placeholder — north-star and supporting metrics to be defined with product/
growth: D1/D7/D30 retention, ranked matches per active user per week,
match-completion rate, anti-cheat flag rate as a trust/integrity signal. See
[`docs/ANALYTICS.md`](ANALYTICS.md).)*

## Open Questions

- Founding exercise set — confirm push-ups/pull-ups/squats/burpees/planks are
  the true v1 set or subject to change based on AI Engine feasibility per
  exercise (see [`docs/EXERCISE_ENGINE.md`](EXERCISE_ENGINE.md)).
- Solo/practice mode (non-competitive, for onboarding new users to the camera/
  rep-verification flow before their first ranked match).
