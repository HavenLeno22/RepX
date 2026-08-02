# ELO System

> **Purpose:** Define how RepX calculates and updates competitive ratings,
> modeled directly on chess ELO as specified in the product brief.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Overview](#overview)
2. [Core Formula](#core-formula)
3. [K-Factor Design](#k-factor-design)
4. [New Player Placement](#new-player-placement)
5. [Per-Exercise vs. Global Rating](#per-exercise-vs-global-rating)
6. [Data Model](#data-model)
7. [Open Questions](#open-questions)

## Overview

Every ranked match produces a rating change for both participants using the
standard chess ELO algorithm, computed server-side by the `elo` module
immediately after `match-engine` finalizes a match result (see
[`docs/SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md#requestmatch-lifecycle)).
The client never computes an authoritative ELO change — it may optimistically
predict one using the shared, pure ELO math in `shared/src/elo/` (see
[`shared/README.md`](../shared/README.md)) for instant UI feedback, but the
server's computed value is always what's persisted and displayed.

## Core Formula

Standard ELO expected-score model:

```
Expected score for player A:
  E_A = 1 / (1 + 10^((R_B - R_A) / 400))

New rating:
  R_A' = R_A + K * (S_A - E_A)
```

Where `S_A` is the actual match outcome for player A (`1` win, `0` loss, `0.5`
draw — see [`docs/MULTIPLAYER.md`](MULTIPLAYER.md#open-questions) on whether
draws are possible), and `K` is the K-factor (below).

## K-Factor Design

**Implemented** in `shared/src/elo/index.ts`:

| Condition                                  | K   |
| ------------------------------------------ | --- |
| Fewer than 10 matches played (provisional) | 40  |
| Rating ≥ 2400                              | 10  |
| Everyone else                              | 20  |

Provisional accounts move fast so placement converges quickly toward true skill;
established and high-rated accounts move slowly so a rating stays trustworthy.
This mirrors the tiered K used by chess federations.

A **rating floor of 100** prevents a losing streak from driving a player to zero.

⚠️ These are reasoned starting values, not tuned ones — they were chosen from
chess precedent, not from RepX match data, because no such data exists yet.
Revisit once there is real volume; treat the current numbers as a hypothesis.

## Rank Tiers

Implemented in `shared/src/constants/ranks.ts`. Ranks are always **derived** from
rating via `rankForRating()` and never stored, so a tier cannot drift out of sync
with the rating it came from.

| Tier        | Rating    |
| ----------- | --------- |
| Bronze      | 0–799     |
| Silver      | 800–1199  |
| Gold        | 1200–1599 |
| Platinum    | 1600–1999 |
| Diamond     | 2000–2399 |
| Master      | 2400–2799 |
| Grandmaster | 2800+     |

New accounts start at **1000** (Gold floor is 1200, so most players begin in
Silver and climb).

## New Player Placement

_(Placeholder — provisional rating period design: starting rating, number of
placement matches before a rating is "established," and whether provisional
players are matched only against other provisional players to protect
established ratings from placement-period noise. Directly related to
[`docs/MATCHMAKING.md`](MATCHMAKING.md#open-questions).)_

## Per-Exercise vs. Global Rating

⚠️ **Designed per-exercise; currently implemented as a single global rating.**

The design position stands: a player's push-up ELO should be independent of
their squat ELO, because that skill does not transfer — the same reasoning by
which chess variants carry independent ratings. Matching a pull-up specialist
against a squat specialist on one blended number produces bad pairings and a
misleading ladder.

What exists today is one `User.rating` across all exercises. `EloHistory` links
to a `Match`, and `Match` carries `exerciseSlug`, so the data needed to split
ratings is already being recorded — the change is additive (a per-exercise
rating table plus matchmaking and leaderboard reads keyed by exercise), not a
migration of lost information. Tracked in [`ROADMAP.md`](ROADMAP.md).

## Data Model

Append-only `EloHistory` ledger, `User.currentElo` as a denormalized read cache
— see [`docs/DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md#elohistory) for the full
schema and the invariant that `currentElo` is never written independently of a
new `EloHistory` row.

## Open Questions

- Exact K-factor values and provisional-period length (needs real match-volume
  data to tune responsibly rather than launch with guessed constants).
- Rating decay for inactive players (common in competitive ladders to keep
  leaderboards meaningful) — not yet decided.
- Seasonal reset policy (soft reset toward the mean vs. no reset) — see
  [`docs/DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md#open-questions).
- Forfeit/disconnect scoring — depends on
  [`docs/MULTIPLAYER.md`](MULTIPLAYER.md#open-questions) being resolved first.
