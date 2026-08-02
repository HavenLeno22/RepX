# User Flow

> **Purpose:** Map the end-to-end journeys a player takes through RepX, from
> first open to ranked competition.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Onboarding](#onboarding)
2. [Ranked Match Flow](#ranked-match-flow)
3. [Post-Match Flow](#post-match-flow)
4. [Profile & Progression](#profile--progression)
5. [Open Questions](#open-questions)

## Onboarding

1. Sign up (Google / Apple / email — [`docs/AUTHENTICATION.md`](AUTHENTICATION.md)).
2. Camera and pose-tracking permission grant + calibration check (framing
   guidance so on-device inference has a usable view — see
   [`docs/AI_ENGINE.md`](AI_ENGINE.md)).
3. *(Placeholder: guided practice rep — a non-competitive first exercise attempt
   so the player experiences rep verification before their first ranked match.
   See [`docs/PRODUCT_REQUIREMENTS.md`](PRODUCT_REQUIREMENTS.md#open-questions).)*
4. Placement matches to establish an initial rating
   ([`docs/ELO_SYSTEM.md`](ELO_SYSTEM.md#new-player-placement)).

## Ranked Match Flow

```
Select exercise → Enter queue (docs/MATCHMAKING.md)
  → Opponent found → Pre-match countdown (docs/MULTIPLAYER.md)
  → Active match: live camera + rep verification (docs/AI_ENGINE.md)
  → Match ends → Result + ELO change (docs/ELO_SYSTEM.md)
```

## Post-Match Flow

Result screen → rating change → option to rematch / return to queue / view
updated leaderboard position.

## Profile & Progression

*(Placeholder — profile screen contents: current ratings per exercise, match
history, streaks, personal records. See
[`docs/PRODUCT_REQUIREMENTS.md`](PRODUCT_REQUIREMENTS.md#launch-feature-set).)*

## Open Questions

- Whether onboarding requires a mandatory practice rep before first ranked
  queue, or if that's optional/skippable.
- Re-engagement flows (streak reminders, rank-decay warnings — depends on
  [`docs/ELO_SYSTEM.md`](ELO_SYSTEM.md#open-questions) decay policy).
