# RepX

**The Chess.com of fitness.**

RepX turns bodyweight fitness into a competitive online sport. Players face off
in real time performing exercises — push-ups, pull-ups, squats, burpees, planks,
sit-ups, jumping jacks — while AI pose estimation verifies every repetition.
Only valid reps count. Wins and losses move your ELO rating exactly like chess.

## Status

✅ **Playable.** The full competitive loop works: sign in → pick an exercise →
matchmaking → live camera match with AI-verified reps → ELO settlement →
leaderboard. See [`docs/IMPLEMENT.md`](docs/IMPLEMENT.md) for exactly what is and
isn't built.

## Quick start

Requires **Node 20+**. No Docker, no database server, no Python.

```bash
npm run setup     # install, build shared, create + seed the SQLite database
npm run dev       # backend on :4000, frontend on :5173
```

Open **http://localhost:5173** and allow camera access.

A match needs two players — open a second browser profile or incognito window
and sign in as a different account. Seeded demo accounts all use password
`repx1234`: `rookie@repx.dev`, `mike@repx.dev`, `sasha@repx.dev`,
`pat@repx.dev`, `rio@repx.dev`.

> The first match downloads a ~5MB pose model from a CDN and caches it, so the
> very first load needs an internet connection.

## How a rep actually counts

This is the core of the product, and the reason the architecture looks the way
it does:

```
webcam → MediaPipe Pose (in your browser) → 33 body landmarks
   → local exercise plugin  → instant on-screen feedback  (NOT scored)
   → landmarks streamed to the server over WebSocket
   → anti-cheat screens the stream (replay, clock forgery, static input…)
   → the SAME exercise plugin re-runs server-side → this is what scores
   → rep:counted broadcast to both players
```

Your browser is never trusted. A tampered client can lie to itself; it cannot
manufacture a rep the server will accept. Full detail in
[`docs/ANTI_CHEAT.md`](docs/ANTI_CHEAT.md).

## Repository layout

```
RepX/
├── shared/       # Contract: zod schemas, ELO math, exercise plugins (runs on BOTH sides)
├── backend/      # NestJS API + Socket.IO gateway + Prisma
├── frontend/     # React + Vite web client with in-browser pose estimation
├── docs/         # Product, architecture, and engineering documentation
├── scripts/      # Dev/deploy tooling
├── assets/       # Brand assets and design tokens
├── .github/      # CI workflows and issue/PR templates
└── .vscode/      # Shared editor configuration
```

`shared/` is the load-bearing idea: exercise rep state machines and ELO math live
there and are imported unchanged by both the browser and the server, so
optimistic client feedback and authoritative server scoring can never drift apart.

## Commands

| Command | What it does |
|---|---|
| `npm run setup` | First-time install, build, database create + seed |
| `npm run dev` | Run backend and frontend together |
| `npm run dev:backend` / `npm run dev:frontend` | Run one side only |
| `npm run build` | Production build of all packages |
| `npm run typecheck` | Typecheck all packages |
| `npm run db:setup` | Re-create and re-seed the database |
| `npm run db:studio` | Browse the database in Prisma Studio |

## Documentation

Start at [`docs/README.md`](docs/README.md) — it indexes every document.
New engineers should read, in order:
[`IMPLEMENT.md`](docs/IMPLEMENT.md) → [`GLOSSARY.md`](docs/GLOSSARY.md) →
[`PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md) →
[`SYSTEM_ARCHITECTURE.md`](docs/SYSTEM_ARCHITECTURE.md) →
[`ANTI_CHEAT.md`](docs/ANTI_CHEAT.md).

Adding an exercise? Follow [`docs/PROMPTS/new-exercise.md`](docs/PROMPTS/new-exercise.md) —
it exists to keep exercise logic inside the plugin system.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and
[`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md).

## License

See [`LICENSE`](LICENSE).
