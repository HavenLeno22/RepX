# Template: Code Review

Use to review a change against RepX's standards before merge.

---

Review this change to RepX: **[PR / DIFF DESCRIPTION]**.

Check against:
1. **Module boundaries** — does it respect
   [`docs/SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md#backend-module-boundaries)?
   Does any module reach into another module's internals/Prisma models
   directly?
2. **No hardcoded exercise logic** — per
   [`docs/EXERCISE_ENGINE.md`](../EXERCISE_ENGINE.md), reject any
   exercise-slug special-casing outside a plugin file.
3. **Server-authoritative principle** — per
   [`docs/SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md#data-flow-a-verified-rep),
   does anything treat client-reported state (rep counts, match results) as
   trusted without server confirmation?
4. **Shared logic** — per [`docs/CODING_STANDARDS.md`](../CODING_STANDARDS.md),
   is any logic duplicated between `frontend/` and `backend/` that should live
   in `shared/` instead?
5. **Validation at boundaries** — per
   [`docs/SECURITY.md`](../SECURITY.md#api-security), is all external input
   (API, WebSocket) validated via a shared zod schema?
6. **Tests** — per [`docs/TESTING.md`](../TESTING.md), does the change include
   tests appropriate to its layer?
7. **No unnecessary abstraction or scope creep** — per
   [`docs/CODING_STANDARDS.md`](../CODING_STANDARDS.md#guiding-principles), flag
   speculative generalization or changes beyond the stated scope.
8. **Docs updated** — if the change affects architecture, API surface, or a
   documented decision, is the relevant `docs/` file updated in the same
   change?

Report findings ranked by severity, with the specific file/line and the
concrete failure scenario each finding would cause.
