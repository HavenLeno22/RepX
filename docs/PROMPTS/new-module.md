# Template: New Backend Module

Use when adding a new bounded-context module to `backend/src/modules/`.

---

I'm adding a new NestJS module to the RepX backend: **[MODULE_NAME]**.

**Responsibility:** [one sentence — what bounded context does this module own,
and what does it explicitly NOT own?]

Context:
- Read [`docs/SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md#backend-module-boundaries)
  for the existing module boundary table and how modules communicate (public
  service interfaces only — never reach into another module's Prisma models).
- Read [`docs/CODING_STANDARDS.md`](../CODING_STANDARDS.md) for single-
  responsibility and no-duplicate-logic expectations.
- If this module owns new Postgres entities, they must be added to
  [`docs/DATABASE_SCHEMA.md`](../DATABASE_SCHEMA.md) first (doc-first for schema
  changes), then reflected in `backend/prisma/schema.prisma`.
- If this module needs Redis state, follow the key-naming convention in
  [`docs/DATABASE_SCHEMA.md`](../DATABASE_SCHEMA.md#redis--real-time-keys).

Deliverables:
1. `backend/src/modules/[module-name]/` with `[module-name].module.ts`,
   `[module-name].service.ts`, `[module-name].controller.ts` (if it exposes
   REST) and/or `[module-name].gateway.ts` (if it exposes WebSocket events —
   see [`docs/API_SPECIFICATION.md`](../API_SPECIFICATION.md)).
2. Unit tests for the service's public methods (see
   [`docs/TESTING.md`](../TESTING.md#backend-testing)).
3. A short top-level doc comment on the module class stating its
   responsibility (per [`docs/CODING_STANDARDS.md`](../CODING_STANDARDS.md#comments--documentation)).
4. Update [`docs/SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md#backend-module-boundaries)'s
   module table to include the new module.

Do not implement functionality this module doesn't own — if you find yourself
reaching into another module's internals, stop and reconsider the boundary.
