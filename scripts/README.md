# RepX — Scripts

Developer, build, and deployment tooling that doesn't belong inside a single
workspace package (`frontend/`, `backend/`, `shared/`).

## Status

🚧 Empty — no scripts exist yet. Populated as real operational needs arise (see
[`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) and [`docs/IMPLEMENT.md`](../docs/IMPLEMENT.md)).

## Anticipated contents

- `db/` — Prisma migration/seed helpers, backup/restore utilities.
- `ci/` — Shared logic invoked from `.github/workflows/`.
- `codegen/` — Generators for exercise plugin boilerplate (see
  [`docs/PROMPTS/new-exercise.md`](../docs/PROMPTS/new-exercise.md)) and API client
  types from `shared/` schemas.
- `local-dev/` — Docker Compose bring-up for local Postgres/Redis, seed data.

Scripts should be small, single-purpose, and documented at the top of the file —
prefer several focused scripts over one script with many flags.
