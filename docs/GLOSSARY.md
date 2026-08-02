# Glossary

> **Purpose:** Define RepX-specific vocabulary used consistently across all
> documentation, so terms don't drift in meaning between docs.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Terms](#terms)

## Terms

**Verified rep** — A repetition confirmed valid by the server's authoritative
`ExercisePlugin` state machine, as opposed to a client-side optimistic count.
Only verified reps affect match outcome and ELO. See
[`ANTI_CHEAT.md`](ANTI_CHEAT.md).

**Ranked match** — A match that affects both players' ELO ratings. Contrast
with **casual match**, which does not. See [`MATCHMAKING.md`](MATCHMAKING.md#ranked-vs-casual).

**ELO** — RepX's competitive rating system, modeled directly on chess ELO,
tracked per exercise. See [`ELO_SYSTEM.md`](ELO_SYSTEM.md).

**K-factor** — The constant in the ELO formula controlling how much a single
match result moves a player's rating. See
[`ELO_SYSTEM.md`](ELO_SYSTEM.md#k-factor-design).

**Exercise plugin** — A self-contained module implementing the `ExercisePlugin`
interface for one exercise (e.g. push-up, squat), encapsulating its rep state
machine and validity rules. New exercises are added by writing a new plugin,
never by modifying core matching/scoring code. See
[`EXERCISE_ENGINE.md`](EXERCISE_ENGINE.md).

**Landmark** — A single tracked body point (e.g. left elbow) output by
MediaPipe Pose, with x/y/z coordinates and a visibility confidence score. A
**landmark frame** is the full set of landmarks for one camera frame. See
[`AI_ENGINE.md`](AI_ENGINE.md).

**Match-engine** — The backend module owning the live match state machine and
WebSocket gateway for an active match. See
[`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md#backend-module-boundaries).

**Server-authoritative** — The principle that the server's computed state (rep
count, match result, ELO change) is always the value that counts, regardless of
what the client displayed optimistically. The single most important
architectural principle in RepX. See
[`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md#data-flow-a-verified-rep).

**Cheat flag** — A record raised by the `anti-cheat` module when a match or
account exhibits suspicious patterns. See
[`ANTI_CHEAT.md`](ANTI_CHEAT.md#response-to-detected-cheating).

**Placement match** — An early match for a new account used to establish an
initial ELO rating before it's considered "established." See
[`ELO_SYSTEM.md`](ELO_SYSTEM.md#new-player-placement).

**Streak** — Consecutive days of competitive activity, a Duolingo-influenced
engagement mechanic. See [`PRODUCT_REQUIREMENTS.md`](PRODUCT_REQUIREMENTS.md#positioning).
