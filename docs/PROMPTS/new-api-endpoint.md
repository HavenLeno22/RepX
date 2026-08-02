# Template: New API Endpoint or WebSocket Event

Use when adding a new REST endpoint or WebSocket event.

---

I'm adding a new [REST endpoint | WebSocket event]: **[METHOD + PATH, or EVENT NAME]**.

**Purpose:** [what does this let a client do?]

Context:
- Read [`docs/API_SPECIFICATION.md`](../API_SPECIFICATION.md) for existing
  conventions (naming, error format, auth requirements) — new endpoints/events
  must match the existing catalog's style, not introduce a new one.
- Identify which backend module owns this (see
  [`docs/SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md#backend-module-boundaries)).
  If no existing module owns it, use
  [`new-module.md`](new-module.md) first.
- Define the request/response (or event payload) shape as a zod schema in
  `shared/src/schemas/` — this is the single source of truth consumed by both
  client and server (see [`shared/README.md`](../../shared/README.md)).

Deliverables:
1. Zod schema(s) in `shared/`.
2. Controller method (REST) or gateway handler (WebSocket) in the owning
   module, using the shared schema for validation (see
   [`docs/SECURITY.md`](../SECURITY.md#api-security) — never trust client input
   even though the shape is shared).
3. Rate limiting applied if this is a write or resource-intensive read (see
   [`docs/SECURITY.md`](../SECURITY.md#api-security)).
4. Update [`docs/API_SPECIFICATION.md`](../API_SPECIFICATION.md)'s endpoint/
   event tables.
5. Tests: controller/gateway test plus a schema validation test for malformed
   input.
