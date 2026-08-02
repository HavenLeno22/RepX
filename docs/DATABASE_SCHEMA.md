# Database Schema

> **Purpose:** Define RepX's data model across PostgreSQL (system of record) and
> Redis (real-time layer), and the reasoning behind the split.
> **Version:** 0.2.0
> **Status:** Living — the entities below are implemented. Canonical source is
> `backend/prisma/schema.prisma`; this document explains the *why*.
> **Last Updated:** 2026-08-01

## Where it runs today

**SQLite** locally (zero install — `npm run setup` creates `backend/dev.db`),
with the schema written to stay **Postgres-portable on purpose**: no native
enums, no Postgres-only column types. `status`, `mode`, and `result` are plain
strings whose allowed values are enforced by the union types and zod schemas in
`shared/` — so the constraint lives in one place that both the client and server
already share, instead of being duplicated into the database and drifting.

Migrating to Postgres is a `provider` swap plus a fresh migration. Rationale in
[`TECH_STACK.md`](TECH_STACK.md#database).

Redis is **not** currently used; matchmaking queues and live match state are
in-memory. The Redis key design below remains the multi-node target.

## Table of Contents

1. [Why Two Data Stores](#why-two-data-stores)
2. [PostgreSQL — Core Entities](#postgresql--core-entities)
3. [Entity Relationships](#entity-relationships)
4. [Redis — Real-Time Keys](#redis--real-time-keys)
5. [Migration Strategy](#migration-strategy)
6. [Open Questions](#open-questions)

## Why Two Data Stores

See [`docs/TECH_STACK.md`](TECH_STACK.md#database) for the full trade-off
analysis. In short: durable, relational, transactional data (accounts, match
results, the ELO ledger) lives in PostgreSQL; ephemeral, high-frequency,
sub-millisecond-latency data (matchmaking queues, live in-progress match state,
cross-instance WebSocket pub/sub, leaderboards) lives in Redis. Nothing in Redis
is the sole copy of data that must survive a restart — anything durable is
written through to Postgres at the appropriate lifecycle point (e.g. on match
completion).

## PostgreSQL — Core Entities

Prose ERD for the founding schema (exact Prisma models to be authored during
implementation; field lists here are illustrative, not final):

### `User`
- `id`, `email` (unique, nullable if OAuth-only), `displayName`, `avatarUrl`
- `passwordHash` (nullable — only set for email/password accounts)
- `authProviders` → related `AuthIdentity[]` (one row per linked Google/Apple/
  email identity — see [`docs/AUTHENTICATION.md`](AUTHENTICATION.md))
- `currentElo`, `peakElo` (denormalized for fast profile/leaderboard reads;
  authoritative history lives in `EloHistory`)
- `createdAt`, `status` (active / suspended / banned — see [`docs/ANTI_CHEAT.md`](ANTI_CHEAT.md))

### `AuthIdentity`
- `id`, `userId` (FK → `User`), `provider` (`google` | `apple` | `email`),
  `providerUserId`, `createdAt`

### `Match`
- `id`, `exerciseId` (FK → `Exercise`), `mode` (`ranked` | `casual`), `status`
  (`pending` | `active` | `completed` | `forfeited` | `voided`)
- `startedAt`, `endedAt`
- `participants` → related `MatchParticipant[]`

### `MatchParticipant`
- `id`, `matchId` (FK → `Match`), `userId` (FK → `User`)
- `repCount` (server-confirmed, final), `result` (`win` | `loss` | `draw`)
- `eloBefore`, `eloAfter`, `eloDelta`

### `EloHistory`
- `id`, `userId` (FK → `User`), `matchId` (FK → `Match`)
- `eloBefore`, `eloAfter`, `delta`, `kFactor`, `createdAt`
- Authoritative, append-only ledger — `User.currentElo` is a derived cache of
  the latest row here, never written independently of it (write path always
  goes through `elo` module — see [`docs/ELO_SYSTEM.md`](ELO_SYSTEM.md)).

### `CheatFlag`
- `id`, `userId`, `matchId`, `reason`, `severity`, `details`, `createdAt`
- Written by the `anti-cheat` module at match settlement — see
  [`docs/ANTI_CHEAT.md`](ANTI_CHEAT.md#anomaly-detection).

### `RefreshToken`
- `id`, `userId`, `tokenHash`, `expiresAt`, `revokedAt`, `createdAt`
- Tokens are stored **hashed**, so a database read cannot mint sessions, and are
  rotated on every use — a replayed old token is detectable. See
  [`docs/AUTHENTICATION.md`](AUTHENTICATION.md#token-strategy).

*(Additional entities — `Subscription`/billing, `Notification`, `Device` — to be
added as [`docs/MONETIZATION.md`](MONETIZATION.md) and
[`docs/NOTIFICATIONS.md`](NOTIFICATIONS.md) are finalized.)*

### A note on `Exercise`

There is deliberately **no** `Exercise` table. The catalog is derived from the
plugin registry in `shared/` at runtime, so the list of exercises a client can
select is by construction the list the server can actually validate — the two
cannot drift. `Match.exerciseSlug` stores the slug as a plain string.

## Entity Relationships

```
User 1──* AuthIdentity
User 1──* RefreshToken
User 1──* MatchParticipant *──1 Match   (Match.exerciseSlug → plugin registry)
User 1──* EloHistory *──1 Match
User 1──* CheatFlag *──1 Match
```

## Redis — Real-Time Keys

Illustrative key design (exact naming convention to be finalized alongside
`match-engine` implementation):

| Purpose | Key pattern | Type |
|---|---|---|
| Matchmaking queue | `queue:{exerciseId}:{ratingBand}` | Sorted set (score = queue time) |
| Live match state | `match:{matchId}:state` | Hash |
| Live rep counters (in-progress) | `match:{matchId}:reps:{userId}` | String/counter |
| WebSocket pub/sub fan-out | `socket.io` adapter channels (managed by `@socket.io/redis-adapter`) | Pub/sub |
| Global leaderboard | `leaderboard:{exerciseId}:{season}` | Sorted set (score = ELO) |
| Rate limiting | `ratelimit:{userId}:{action}` | String w/ TTL |

## Migration Strategy

*(Placeholder — Prisma Migrate workflow, review process for schema changes,
seed-data strategy for local dev and staging.)*

## Open Questions

- Season/leaderboard reset cadence and whether historical seasons need their own
  archival table vs. Redis-only with periodic Postgres snapshotting.
- Whether `MatchParticipant.repCount` needs a rep-by-rep breakdown table for
  post-match review/replay, or whether that's covered by analytics event
  storage instead (see [`docs/ANALYTICS.md`](ANALYTICS.md)).
