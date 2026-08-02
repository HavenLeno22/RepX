# Tech Stack

> **Purpose:** Record the chosen technologies for every layer of RepX, with the
> trade-offs considered and the reasoning behind each choice, so future engineers
> understand *why*, not just *what*.
> **Version:** 0.2.0
> **Status:** Living — reflects what is actually built. Rows marked ⚠️ were
> revised during implementation; the original reasoning is kept alongside the
> revision so the trade-off stays visible.
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Decision Summary](#decision-summary)
2. [Frontend Framework](#frontend-framework)
3. [Backend Framework](#backend-framework)
4. [Database](#database)
5. [Real-Time Transport](#real-time-transport)
6. [Authentication](#authentication)
7. [AI / Pose Estimation](#ai--pose-estimation)
8. [Monorepo Tooling](#monorepo-tooling)
9. [Infrastructure & Hosting](#infrastructure--hosting)
10. [Observability](#observability)
11. [Open Questions](#open-questions)

## Decision Summary

| Layer | Choice (as built) | Alternative considered |
|---|---|---|
| Frontend ⚠️ | **React + Vite (web)**; React Native planned | React Native/Expo, Flutter |
| Backend framework | NestJS (Node.js + TypeScript) | Express / Fastify |
| Primary database ⚠️ | **SQLite** for dev, Postgres-ready schema | PostgreSQL now, MongoDB |
| Real-time state ⚠️ | **In-memory**, Redis optional via `REDIS_URL` | Redis required |
| Transport | Socket.IO | raw `ws` |
| Auth ⚠️ | JWT + refresh rotation, **scrypt** hashing | Argon2id, Firebase Auth / Clerk |
| AI pose estimation | MediaPipe Pose (on-device) + server-side re-validation | Cloud-only inference |
| Monorepo tooling ⚠️ | **npm workspaces** | pnpm + Turborepo, Nx |

The ⚠️ revisions are summarized with rationale in
[`IMPLEMENT.md`](IMPLEMENT.md#decisions-revised-during-implementation) and
detailed in the relevant section below.

## Frontend Framework

**Decision (revised): React + Vite web client now; React Native mobile app next.**

### Why this changed

The original decision below (React Native via Expo) still holds for the *mobile*
product. It could not hold for the *first* build, for one concrete reason:
MediaPipe pose estimation in React Native requires native modules
(`react-native-vision-camera` frame processors plus a MediaPipe plugin), which
is not Expo Go compatible. Shipping it means a bare-workflow native build, so
every engineer — and the founder — would need Android Studio or a Mac with
Xcode configured before they could watch a single rep get counted.

The browser runs the identical MediaPipe model today with zero native
toolchain. Since the requirements already list Web as a target, building it
first is not scope creep — it is reordering.

**What makes this cheap to reverse:** all rep-detection state machines, ELO math,
and API contracts live in `shared/` and are platform-agnostic (no DOM, no Node).
A React Native client imports the same package and reimplements only the UI and
the camera bridge. The expensive, correctness-critical half is already portable.

### Original analysis (still the basis for the mobile decision)

### Requirements driving the decision

- Must ship to iOS and Android from one codebase, with Web as a near-term future
  target (not simultaneous, but not a rewrite either).
- Must support a real-time camera pipeline (pose estimation) with native module
  access.
- Must support premium, 60fps animation — the product is explicitly benchmarked
  against Apple Fitness and Valorant Ranked in feel.
- Team velocity and hiring pool matter for a startup.

### Options considered

**React Native (Expo)**
- ✅ TypeScript end-to-end: the same language as the backend and `shared/`
  package, so DTOs, zod schemas, and pure domain logic (e.g. ELO math) are written
  once and shared, not re-implemented per platform.
- ✅ Largest cross-platform mobile talent pool of the two options — easier hiring
  at startup speed.
- ✅ Reanimated 3 + React Native Skia give native-thread animation, closing most
  of the historical animation-smoothness gap with Flutter.
- ✅ React Native Web offers a credible, low-rewrite path to the web client
  described in requirements as a future target.
- ✅ Native modules (Kotlin/Swift) can wrap MediaPipe directly for the pose
  estimation pipeline — this is a solved, common integration pattern (e.g. via
  `react-native-vision-camera` frame processors).
- ⚠️ The JS thread / bridge (even with JSI in the New Architecture) means
  performance-critical work (pose landmark extraction) must be pushed to native
  or worklet code rather than JS — this is standard practice, not a blocker, but
  it's a discipline the team must maintain.

**Flutter**
- ✅ Own rendering engine (Skia/Impeller) painted identically on every platform —
  historically the most consistent, highest-ceiling animation performance of the
  two, with less risk of a "janky on one platform" surprise.
- ✅ Strong first-class Web and Desktop support today (ahead of RN Web's maturity).
- ❌ Dart is a second language the team must maintain alongside the TypeScript
  backend — no code/type sharing with `shared/`, so API contracts and domain
  logic (like ELO math) must be hand-duplicated or generated, which is exactly
  the kind of "duplicate logic" the project's engineering principles rule out.
- ❌ Smaller hiring pool than React Native/TypeScript engineers.

### Recommendation rationale

TypeScript-everywhere is the deciding factor: it lets `shared/` be a real,
type-safe contract between client and server rather than a documentation
convention, which matters enormously for a product where the client optimistically
predicts state (rep counts, ELO deltas) that the server must later authoritatively
confirm. Flutter's animation ceiling is real but React Native's New Architecture
(Fabric + JSI) plus Reanimated/Skia closes the gap enough that it's no longer a
deciding factor. **Revisit this decision if, in practice, RN's camera/frame-
processor pipeline proves unable to hit the latency budget in
[`docs/AI_ENGINE.md`](AI_ENGINE.md) — that is the one area where Flutter's native
camera plugin ecosystem could force a reconsideration.**

## Backend Framework

**Decision: NestJS on Node.js + TypeScript.**

- **NestJS** ✅ — Module/Controller/Provider structure with dependency injection
  is *enforced* by the framework, not left to convention. This directly serves
  the "enterprise-level code organization," "single responsibility," and "avoid
  duplicate logic" requirements without relying purely on code review discipline.
  First-class `@WebSocketGateway()` support maps cleanly onto the real-time match
  layer. Modules are natural seams for splitting into microservices later
  (matchmaking, match-engine, and anti-cheat are the most likely first splits —
  see [`docs/SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md)) without a rewrite.
- **Express / Fastify** ⚠️ — Lighter weight and slightly lower request overhead
  (Fastify especially), but neither imposes architecture — a team has to invent
  and enforce its own module boundaries, which is a real risk on a fast-growing
  codebase with many contributors over years. Fastify remains an option *under*
  NestJS (as its HTTP adapter) if raw throughput ever becomes a bottleneck, so
  choosing NestJS doesn't foreclose that option.

## Database

**Decision (revised): SQLite via Prisma today; PostgreSQL + Redis at production.**

Docker is not available in the current development environment, so requiring a
Postgres and Redis server to run the app would mean nothing runs at all. Instead:

- **SQLite** backs local development — zero install, `npm run setup` creates it.
- The Prisma schema is written to be **portable on purpose**: no native enums, no
  Postgres-only column types. Status/mode/result columns are plain strings whose
  allowed values are enforced by the union types and zod schemas in `shared/`, so
  the constraint has exactly one home rather than being duplicated in the
  database. Moving to Postgres is a `provider` change plus a fresh migration.
- **Redis is optional.** Matchmaking queues and live match state are in-memory,
  which is correct for a single node. `MatchmakingService` is deliberately keyed
  by `exercise:mode` exactly as the Redis sorted-set design describes, so the
  swap is internal to that class. Multi-node also requires the Socket.IO Redis
  adapter — see [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md#scaling-strategy).

The polyglot-persistence reasoning below is unchanged and remains the production
target.

### Original analysis (production target)

### Why not a single database

RepX has two fundamentally different data-access patterns:

1. **Durable, relational, correctness-critical data** — user accounts, match
   history, ELO rating ledger, exercise catalog, subscriptions/billing. This data
   needs ACID transactions (an ELO update and a match-result write must succeed
   or fail together) and relational integrity (a match references two users and
   an exercise; a rating change references a match). This is squarely
   PostgreSQL's strength.
2. **Ephemeral, high-frequency, low-latency data** — matchmaking queues, live
   match/rep state while a match is in progress, presence, and the pub/sub fan-out
   needed so a WebSocket event reaches a user regardless of which server instance
   they're connected to. This needs sub-millisecond in-memory operations at high
   throughput, and none of it needs to survive a restart. This is Redis's
   strength, not Postgres's.

### Options considered

- **PostgreSQL** ✅ (chosen for system-of-record) — mature, strong consistency
  guarantees, excellent TypeScript support via Prisma, battle-tested at scale
  (vertical scaling + read replicas + eventual sharding path via e.g. Citus if
  ever needed).
- **MongoDB** ❌ — Would avoid upfront schema design, but RepX's core entities
  (users, matches, ratings) are inherently relational and transactional; document
  modeling would just re-invent joins in application code and weaken the
  guarantees around the ELO ledger, which is effectively financial-grade data
  (it determines competitive standing and, per [`docs/MONETIZATION.md`](MONETIZATION.md),
  potentially ranked-tier paywalls).
- **Redis** ✅ (chosen for real-time layer, alongside Postgres, not instead of it)
  — matchmaking queues (lists/sorted sets), live match state (hashes, short TTL),
  Socket.IO's Redis adapter for cross-instance pub/sub, and global/seasonal
  leaderboards (sorted sets — `ZADD`/`ZREVRANGE` are a natural fit for rank
  queries).

Full schema-level detail in [`docs/DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md).

## Real-Time Transport

**Decision: WebSockets via Socket.IO, with the `@socket.io/redis-adapter`.**

- Socket.IO over raw `ws`: rooms/namespaces map directly onto "a match" and "a
  user's personal channel," automatic reconnection and packet buffering handle
  the flaky-mobile-network case gracefully, and the protocol falls back
  gracefully in constrained network conditions.
- The Redis adapter is what makes this horizontally scalable: without it, a
  WebSocket event can only reach clients connected to the *same* server process.
  With thousands of concurrent matches (per the performance requirement) spread
  across many server instances, cross-instance fan-out via Redis pub/sub is
  required, not optional.
- Full event catalog in [`docs/API_SPECIFICATION.md`](API_SPECIFICATION.md) and
  match lifecycle in [`docs/MULTIPLAYER.md`](MULTIPLAYER.md).

## Authentication

**Decision: Custom OAuth (Passport.js strategies) + email/password, JWT access/refresh tokens, owned in our Postgres.**

- **Custom (Passport.js + `passport-google-oauth20` + Sign in with Apple + local
  strategy)** ✅ — Full control of the user record from day one, no per-MAU
  vendor billing as the user base scales into the millions, and no migration
  project later when a managed provider's free tier or pricing model stops
  fitting. Cost: we own session/token security correctness ourselves.
- **Firebase Auth / Clerk** ⚠️ — Faster initial setup, handles a lot of edge
  cases out of the box. Trade-off is vendor lock-in on identity (a notoriously
  painful thing to migrate later) and per-user pricing that compounds at the
  "millions of users" scale this project is explicitly targeting. Reasonable
  choice for a scrappier MVP; not the recommendation here given the stated
  ambition.

Full design in [`docs/AUTHENTICATION.md`](AUTHENTICATION.md).

## AI / Pose Estimation

**Decision: MediaPipe Pose running on-device, landmark streams re-validated server-side.**

See [`docs/AI_ENGINE.md`](AI_ENGINE.md) and [`docs/ANTI_CHEAT.md`](ANTI_CHEAT.md)
for the full design. Summary of the stack choice: MediaPipe is Google's
production-grade, actively maintained pose-estimation model family with official
mobile-optimized (on-device, GPU-accelerated) builds — the alternative
(server-side video inference for every rep of every match) would not meet the
"responsive with thousands of concurrent matches" performance requirement and
would multiply bandwidth and inference cost by orders of magnitude.

## Monorepo Tooling

**Decision (revised): npm workspaces.**

pnpm was not installed in the development environment, and Turborepo's value —
cached, incremental task graphs — is close to zero across three packages that
build in under five seconds combined. npm workspaces ships with Node, needs no
global install, and gives the one thing actually required here: a single
lockfile with `@repx/shared` symlinked into both consumers.

Revisit when either is true: the repo grows past ~6 packages, or CI time becomes
a real cost. Neither is true yet, and adopting build tooling ahead of the
problem it solves is the kind of complexity this project's engineering
principles rule out.

**One implementation note worth knowing:** `shared/` dual-emits CommonJS *and*
ESM (`npm run build -w @repx/shared` runs `tsc` twice). NestJS consumes the CJS
build; Vite/Rollup needs the ESM build to statically analyse named exports —
without it, production builds fail with `"X" is not exported by shared/dist`.

### Original analysis (pnpm + Turborepo)

- **pnpm workspaces** — disk-efficient content-addressable store, strict by
  default, which prevents the "phantom dependency" bugs npm/yarn hoisting allows.
- **Turborepo** — incremental cached task running with remote caching in CI, so
  a PR touching only `frontend/` doesn't re-run `backend/` tests.

## Infrastructure & Hosting

*(Placeholder — to be filled in as infrastructure decisions are made. Candidates
to evaluate: containerized deployment (ECS/Fargate, GKE, or Fly.io) for the
NestJS API and Socket.IO layer, managed Postgres (RDS/Neon/Supabase) and managed
Redis (ElastiCache/Upstash), CDN for static/asset delivery. See
[`docs/DEPLOYMENT.md`](DEPLOYMENT.md).)*

## Observability

*(Placeholder — logging, metrics, tracing, and error-tracking stack to be
decided. Candidates: OpenTelemetry for tracing, Prometheus/Grafana or a managed
APM (Datadog/Honeycomb) for metrics, Sentry for error tracking. See
[`docs/PERFORMANCE.md`](PERFORMANCE.md).)*

## Open Questions

- At what MAU/match-volume threshold do we split `match-engine` out of the
  NestJS monolith into its own service?
- Do we need a dedicated time-series store (e.g. TimescaleDB or ClickHouse) for
  rep-by-rep telemetry once analytics needs grow past what Postgres aggregates
  comfortably handle? See [`docs/ANALYTICS.md`](ANALYTICS.md).
- Web client timeline and whether it stays React Native Web or becomes a
  separate Next.js app sharing only `shared/` and the design system.
