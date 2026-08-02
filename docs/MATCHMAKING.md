# Matchmaking

> **Purpose:** Define how RepX pairs players into fair, timely matches.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Goals](#goals)
2. [Queueing Model](#queueing-model)
3. [Pairing Algorithm](#pairing-algorithm)
4. [Ranked vs. Casual](#ranked-vs-casual)
5. [Relationship to Match Engine](#relationship-to-match-engine)
6. [Open Questions](#open-questions)

## Goals

- Fast: minimize time-to-match without sacrificing fairness.
- Fair: pair players of comparable skill (ELO) on the same exercise.
- Abuse-resistant: resistant to queue manipulation (see
  [`docs/ANTI_CHEAT.md`](ANTI_CHEAT.md) for ELO-manipulation vectors like
  smurfing/boosting, which matchmaking design must account for).

## Queueing Model

Players entering the queue (`matchmaking:join` — see
[`docs/API_SPECIFICATION.md`](API_SPECIFICATION.md#websocket-events)) are held in
a queue keyed by `{exerciseSlug}:{mode}` and ordered by entry time. Rating bands
start narrow and widen the longer a player waits, trading pairing precision for
wait time — the standard competitive-ladder pattern, modeled after Chess.com per
the product brief.

**Storage note:** the queue is currently in-memory, which is correct and
sufficient for a single backend node. It is keyed exactly as the Redis
sorted-set design in [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md#redis--real-time-keys)
describes, so moving to Redis for multi-node is a change to this one class's
internals with no caller changes.

## Pairing Algorithm

**Implemented** in `backend/src/modules/matchmaking/matchmaking.service.ts`.
Widening schedule (`MATCHMAKING_BANDS` in `shared/src/constants/match.ts`):

| Time in queue | Accepts opponents within |
|---|---|
| 0s | ±100 rating |
| 10s | ±250 |
| 20s | ±500 |
| 35s | ±1500 (effectively anyone) |

Bands are **interpolated between these steps**, not jumped. A stepped band left
the search screen showing an unchanging number for ten seconds and then leaping,
which reads as a stalled app rather than a widening search.

A ticker re-evaluates every queue once per second, so bands widen over time even
when nobody new joins. Candidates are considered **oldest-first** so no one
starves while newer players get matched around them. Each player's band is
computed from *their own* wait time, and a pair forms when either side's band
covers the gap.

Within a candidate's band the **closest rating** is chosen, not the first
acceptable one found. With three or more people waiting, taking whoever queued
earliest produced needlessly lopsided pairings while a much closer opponent sat
idle two places down the queue.

Not yet handled: regional/latency-aware pairing, and any preference for avoiding
an immediate rematch against the same opponent.

## Queue status is pushed, not sampled

The server emits `matchmaking:queued` to every waiting socket on every tick,
carrying position, wait time, current band, and how many players are in that
exact queue.

This was originally sent exactly once, at join. The search screen therefore
displayed the *initial* ±100 band for the entire wait while captioning it
"widening as you wait" — the band really was widening in the matchmaker, but the
player was watching a frozen number and had no way to tell the search was alive.
Anything the search screen claims is happening has to be observable on the
search screen.

One related ordering bug: `matchmaking:join` runs a pairing pass synchronously,
so a player can already be in a match by the time the handler returns. It used
to emit a null status regardless, which flashed an empty search screen over the
top of the match that had just been found. Status is now emitted only if the
player is genuinely still queued.

## Being ready before you are matched

Queueing requires the arena to be live: pose model built, camera streaming.
`frontend/src/lib/arena.ts` warms the model from the home screen (no permission
prompt), takes the camera when the player commits to searching, and only then is
`matchmaking:join` sent.

The original order was the reverse — camera and model started *after* an
opponent was found — which put a multi-second cold model download directly in
the path of a countdown that had already begun on the server. On a first visit
the match went live while the player was still looking at a spinner, and the
reps lost in that window were unrecoverable. Ordering is the whole fix.

A side benefit: because the camera is already open while searching, the search
screen shows a live preview. Framing gets corrected during the wait instead of
during the countdown.

## Ranked vs. Casual

- **Ranked**: affects ELO (see [`docs/ELO_SYSTEM.md`](ELO_SYSTEM.md)), stricter
  pairing tolerance, may require account standing checks (email verified, no
  active cheat flags).
- **Casual**: no ELO impact, looser pairing, available to newer/unranked
  accounts to build placement data.

## Relationship to Match Engine

Matchmaking's only output is: two (or more) `userId`s + an `exerciseSlug` +
`mode`, handed to `match-engine` to create the actual `Match` (see
[`docs/SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md#requestmatch-lifecycle)
and [`docs/MULTIPLAYER.md`](MULTIPLAYER.md)). Matchmaking itself holds no match
state once a pairing is made.

## Open Questions

- Placement matches for new accounts (provisional rating period, similar to
  chess rating systems) — see [`docs/ELO_SYSTEM.md`](ELO_SYSTEM.md#open-questions).
- Party/friend-challenge queueing (direct invite vs. ladder queue).
- Support for >2 player matches (e.g. leaderboard-style group sessions) — v1
  scope assumes 1v1.
