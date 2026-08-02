# Prompt Templates

Reusable prompt templates for implementing common categories of change in
RepX, whether the engineer using them is human or an AI coding assistant. Each
template captures the context and constraints an implementer needs *without*
re-deriving them from scratch every time — the relevant architectural
constraints (module boundaries, no hardcoded exercise logic, server-authoritative
state, etc.) are baked into the template itself.

## How to use these

1. Pick the template matching the kind of change you're making.
2. Fill in the bracketed placeholders with specifics.
3. Paste the filled-in prompt to whoever/whatever is implementing the change —
   it front-loads the context they need from `docs/` so they don't have to
   rediscover it.

## Available templates

- [`new-module.md`](new-module.md) — scaffold a new NestJS backend module
- [`new-exercise.md`](new-exercise.md) — add a new exercise via the plugin system
- [`new-api-endpoint.md`](new-api-endpoint.md) — add a REST endpoint or WebSocket event
- [`new-frontend-screen.md`](new-frontend-screen.md) — add a new app screen
- [`bug-fix.md`](bug-fix.md) — structured bug investigation and fix
- [`code-review.md`](code-review.md) — review a change against RepX's standards

These templates are living documents — update them as real implementation
experience reveals gaps or better patterns.
