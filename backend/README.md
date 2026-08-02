# RepX — Backend

NestJS + TypeScript. REST API, Socket.IO match gateway, and authoritative
AI rep verification.

```bash
npm run db:setup -w @repx/backend   # generate client, create + seed the database
npm run dev -w @repx/backend        # http://localhost:4000/api
```

Copy `.env.example` to `.env` first (`npm run setup` at the repo root does all
of this for you).

## Data stores

- **SQLite** via Prisma today (`backend/dev.db`) — zero install. The schema is
  written to stay Postgres-portable: no native enums, no Postgres-only types.
- **Redis** is optional and currently unused. Matchmaking queues and live match
  state are in-memory, which is correct for one node. See
  [`docs/DATABASE_SCHEMA.md`](../docs/DATABASE_SCHEMA.md).

## Modules

```
src/
├── modules/
│   ├── auth/           # register/login/refresh/logout, scrypt hashing, JWT guard
│   ├── users/          # profile, full stats, leaderboard  (user.mapper.ts is the
│   │                   #   single place deciding what of a user is public)
│   ├── exercises/      # catalog served straight from the shared plugin registry
│   ├── matchmaking/    # queues keyed by exercise:mode, widening rating bands
│   ├── match/
│   │   ├── match-engine.service.ts   # authoritative live match state + rep verification
│   │   └── match.gateway.ts          # Socket.IO: queue, landmarks, lifecycle, disconnects
│   ├── elo/            # rating calculation + append-only ledger
│   └── anti-cheat/     # stream integrity screening
├── common/             # exception filter, zod validation pipe
└── prisma/             # PrismaService + module
```

## The critical path

`match.gateway.ts` → `match-engine.service.ts` → `AntiCheatSession.inspect()` →
`ExerciseSession.processFrame()`.

A landmark frame is screened for integrity **before** it reaches the exercise
plugin, and only the plugin can increment a rep. The client's own count is never
read from the wire. This is the whole basis of competitive fairness — see
[`docs/ANTI_CHEAT.md`](../docs/ANTI_CHEAT.md).

## Conventions

- Request validation is **zod only**, using the exact schemas from
  `@repx/shared` that the client uses. No `class-validator`, no DTO decorators —
  that would duplicate rules that already exist in one shared place.
- Modules talk through public services, never by importing another module's
  Prisma models.
- `EloService` is the only writer of `User.rating`, and it always writes the
  `EloHistory` ledger row in the same transaction, so the denormalized rating
  cannot drift from the ledger.
