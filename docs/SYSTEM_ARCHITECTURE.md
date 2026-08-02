# System Architecture

> **Purpose:** Describe how RepX's major components fit together, the boundaries
> between them, and how the system scales to thousands of concurrent matches.
> **Version:** 0.2.0
> **Status:** Living — reflects the implemented system.
> **Last Updated:** 2026-08-01

## Table of Contents

1. [High-Level Overview](#high-level-overview)
2. [Component Diagram](#component-diagram)
3. [Backend Module Boundaries](#backend-module-boundaries)
4. [Request/Match Lifecycle](#requestmatch-lifecycle)
5. [Scaling Strategy](#scaling-strategy)
6. [Data Flow: A Verified Rep](#data-flow-a-verified-rep)
7. [Failure Modes & Resilience](#failure-modes--resilience)
8. [Open Questions](#open-questions)

## High-Level Overview

RepX is a **modular monolith at launch, designed to fracture into services along
its module boundaries** as load demands it — not a premature microservices
architecture, and not an undifferentiated monolith either. The NestJS backend
(see [`docs/TECH_STACK.md`](TECH_STACK.md#backend-framework)) is organized into
domain modules with explicit boundaries (below); each module is a candidate
future service, but nothing is split out until real load data justifies the
operational cost of doing so.

Two data stores back the system for different reasons: **PostgreSQL** as the
durable system of record, **Redis** as the real-time/ephemeral layer (full
rationale in [`docs/TECH_STACK.md`](TECH_STACK.md#database) and
[`docs/DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md)).

The client (React Native) runs on-device pose estimation for immediate user
feedback, but **the server is the sole source of truth for whether a rep counted**
— this is the architectural backbone of anti-cheat (see
[`docs/ANTI_CHEAT.md`](ANTI_CHEAT.md)) and is non-negotiable for a competitive,
ranked product.

## Component Diagram

```
┌─────────────────────────┐
│   React Native Client    │
│  ┌────────────────────┐  │
│  │ MediaPipe (on-device)│  │  ← local pose landmarks, local (optimistic) rep count
│  └────────────────────┘  │
│  Socket.IO client · HTTP client
└───────────┬───────────────┘
            │ WSS (landmark stream + match events) / HTTPS (REST)
            ▼
┌─────────────────────────────────────────────────────────┐
│                  NestJS Backend (modular)                 │
│  ┌────────┐ ┌─────────────┐ ┌──────────────┐ ┌─────────┐ │
│  │  auth  │ │ matchmaking │ │ match-engine │ │   elo   │ │
│  └────────┘ └─────────────┘ └──────────────┘ └─────────┘ │
│  ┌────────────────┐ ┌────────────┐ ┌──────────────────┐   │
│  │ exercise-engine │ │ anti-cheat │ │ notifications /   │   │
│  │  (plugin registry)│ │            │ │ analytics         │   │
│  └────────────────┘ └────────────┘ └──────────────────┘   │
└───────────┬──────────────────────────────┬────────────────┘
            │                              │
            ▼                              ▼
   ┌─────────────────┐           ┌───────────────────┐
   │   PostgreSQL      │           │       Redis        │
   │ (system of record)│           │ (queues, live match │
   │  users · matches ·│           │  state, WS pub/sub, │
   │  elo_history ·    │           │  leaderboards)      │
   │  exercises        │           │                     │
   └─────────────────┘           └───────────────────┘
```

## Backend Module Boundaries

Each module owns its data access and exposes a narrow public interface to other
modules — no module reaches into another's Prisma models directly. See
[`docs/PROMPTS/new-module.md`](PROMPTS/new-module.md) for the scaffold every new
module follows.

| Module | Responsibility | Owns | |
|---|---|---|---|
| `auth` | Registration, login, session issuance, token rotation | `User` credentials, `RefreshToken` | ✅ |
| `users` | Profile, stats, leaderboard | `User` profile fields | ✅ |
| `matchmaking` | Queueing, opponent search, band widening | in-memory queues | ✅ |
| `match` | Live match state machine, WebSocket gateway, rep verification | in-memory live-match state | ✅ |
| `elo` | Rating calculation and ledger | `EloHistory`, `User.rating` | ✅ |
| `anti-cheat` | Stream integrity screening, flags | `CheatFlag` | ✅ |
| `exercises` | Serves the catalog | — (registry lives in `shared/`) | ✅ |
| `notifications` | Push/in-app notifications | delivery state | planned |
| `analytics` | Event ingestion | event store | planned |

**The exercise engine deliberately lives in `shared/`, not the backend.** It has
to run identically in the browser and on the server; a backend-only module would
force a second client implementation, and two implementations of a rep state
machine will eventually disagree. See
[`EXERCISE_ENGINE.md`](EXERCISE_ENGINE.md#clientserver-symmetry).

Full responsibilities in each module's own doc: [`docs/MATCHMAKING.md`](MATCHMAKING.md),
[`docs/MULTIPLAYER.md`](MULTIPLAYER.md), [`docs/ELO_SYSTEM.md`](ELO_SYSTEM.md),
[`docs/EXERCISE_ENGINE.md`](EXERCISE_ENGINE.md), [`docs/ANTI_CHEAT.md`](ANTI_CHEAT.md).

## Request/Match Lifecycle

1. Client authenticates (`auth` module) → receives access/refresh JWT pair.
2. Client requests a match (`matchmaking` module) → placed in a Redis queue keyed
   by exercise type + rating band.
3. `matchmaking` pairs two (or more) queued players → creates a `Match` row in
   Postgres (status `pending`) and live match state in Redis → both clients
   receive a `match:found` WebSocket event with a room ID.
4. Clients join the match's Socket.IO room. `match-engine` runs the match state
   machine (countdown → active → complete).
5. During the active phase, each client streams pose-landmark frames over the
   WebSocket. `match-engine` forwards them to `exercise-engine`, which runs the
   relevant `ExercisePlugin`'s rep state machine server-side and emits
   `rep:counted` events back to both clients when a rep is confirmed valid.
6. `anti-cheat` observes the same stream for anomalies (see
   [`docs/ANTI_CHEAT.md`](ANTI_CHEAT.md)) and can flag or invalidate reps in
   real time.
7. On match completion, `match-engine` finalizes the result, `elo` computes and
   persists the rating change for both players, and the match row moves to
   `completed` in Postgres. Live Redis state for that match is cleared.

## Scaling Strategy

> **Current reality: single node.** Matchmaking queues and live match state are
> in-memory, and the Socket.IO Redis adapter is not installed. Running two
> instances today would break matchmaking (players queued on different nodes
> never meet) and match events (a message would not reach an opponent connected
> elsewhere). The design below is the target, and the boundaries are already
> drawn so it is a contained change rather than a rewrite.

- **Backend instances** scale horizontally behind a load balancer; Socket.IO's
  Redis adapter ensures WebSocket events reach the correct client regardless of
  which instance they're connected to.
- **Matchmaking and match-engine** are the highest-frequency, most latency-
  sensitive modules — they are the first candidates to split into standalone
  services if a single NestJS process becomes a bottleneck (see
  [`docs/TECH_STACK.md`](TECH_STACK.md#open-questions)).
- **PostgreSQL** scales vertically first, then via read replicas for
  leaderboard/history reads; sharding (e.g. Citus) is a later-stage option, not
  a launch requirement.
- **Redis** scales via clustering once queue/match volume outgrows a single
  primary; matchmaking queues are already partitioned by exercise type + rating
  band, which naturally shards well.

## Data Flow: A Verified Rep

This is the most architecturally important flow in the product — it's where
"fair competition" is actually enforced, not just described:

```
Client camera → MediaPipe (on-device) → landmark sequence
   → local ExercisePlugin copy → optimistic UI rep count (instant feedback)
   → landmark sequence streamed to server over WebSocket
   → server-side ExercisePlugin (same plugin, authoritative) validates the rep
   → anti-cheat anomaly checks run against the same stream
   → server emits rep:counted (confirmed) or rep:rejected
   → client reconciles optimistic count with server-confirmed count
```

The client's local count is *never* trusted for match outcome — it exists purely
for perceived responsiveness. Full detail: [`docs/AI_ENGINE.md`](AI_ENGINE.md),
[`docs/EXERCISE_ENGINE.md`](EXERCISE_ENGINE.md), [`docs/ANTI_CHEAT.md`](ANTI_CHEAT.md).

## Failure Modes & Resilience

**Handled:** client disconnect mid-match (15s grace, reconnect resumes the same
match, expiry forfeits — see
[`MULTIPLAYER.md`](MULTIPLAYER.md#disconnection-handling)); expired access
tokens (transparent refresh-and-retry on the client); camera permission denial
(explicit recovery state in the arena); unknown exercise slug or malformed
payload (rejected at the gateway by the shared zod schema).

**Not handled — known and honest:** a backend restart loses all in-flight
matches, because live match state is in-memory. Persisted matches are left in
`active` status with no settlement path. This is acceptable for single-node
development and is **not** acceptable for production; it is the same work item
as moving live state to Redis. See [Scaling Strategy](#scaling-strategy).

## Open Questions

- Reconnection grace period and forfeit rules for a dropped connection mid-match.
- At what point does `anti-cheat` need its own service boundary (likely early,
  given it must never share fate with `match-engine` if we want to keep
  validating disputed matches after the fact)?
- Multi-region strategy once latency-sensitive users are geographically spread.
