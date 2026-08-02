# RepX — Shared

The contract between the RepX client and server, consumed by both as
`@repx/shared`.

Everything here is **platform-agnostic**: no DOM, no Node, no database. That
constraint is what lets the same exercise rep state machines and the same ELO
math run in the browser (optimistically, for instant feedback) and on the server
(authoritatively, for scoring) with no possibility of the two disagreeing.

It is also what makes the future React Native client cheap — it imports this
package unchanged.

## Contents

```
src/
├── constants/
│   ├── ranks.ts        # 7 rank tiers, rankForRating(), starting rating, placement count
│   └── match.ts        # modes, statuses, countdown/duration, matchmaking band schedule
├── elo/                # expected score, tiered K-factor, rating change, stakes preview
├── exercise-engine/
│   ├── types.ts        # ExercisePlugin, ExerciseSession, RepEvent, landmark indices
│   ├── geometry.ts     # joint angles, distance, visibility gate, smoothing
│   ├── rep-session.ts  # TwoPhaseRepSession + HoldSession — shared state machines
│   ├── plugins/        # push-up, squat, pull-up, sit-up, jumping-jack, burpee, plank
│   └── registry.ts     # the only place that knows the full exercise set
└── schemas/            # zod schemas for every REST body and WebSocket payload
```

## Build

```bash
npm run build -w @repx/shared
```

**Dual emit, deliberately:** `tsc` runs twice — CommonJS to `dist/` for NestJS,
ESM to `dist-esm/` for Vite. Rollup cannot statically analyse named exports from
CommonJS, so without the ESM build the frontend production build fails with
`"rankForRating" is not exported by shared/dist/index.js`.

The backend and frontend both resolve this package through npm workspaces, so
after changing anything here run the build before the consumers pick it up.

## What does not belong here

Anything touching a database, filesystem, camera, or platform API. If a change
needs one of those, it belongs in `backend/` or `frontend/` — keeping this
package pure is the whole point.
