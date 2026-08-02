# Error Handling

> **Purpose:** Define consistent error handling conventions across backend and
> frontend so failures are predictable, debuggable, and never silently swallowed.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Principles](#principles)
2. [Backend Error Handling](#backend-error-handling)
3. [Frontend Error Handling](#frontend-error-handling)
4. [Real-Time Error Handling](#real-time-error-handling)
5. [Open Questions](#open-questions)

## Principles

- Fail loudly in development, gracefully in production — never swallow an
  error silently in either environment.
- Errors are typed and structured (see
  [`docs/API_SPECIFICATION.md`](API_SPECIFICATION.md#error-format)), never bare
  strings, so clients can branch on `error.code` reliably.
- Only handle errors that can actually occur at a given boundary — don't add
  defensive handling for scenarios internal code guarantees can't happen (see
  [`docs/CODING_STANDARDS.md`](CODING_STANDARDS.md#guiding-principles)).

## Backend Error Handling

*(Placeholder — NestJS exception filters mapping domain errors to the shared
error format; distinction between expected domain errors (e.g. `MATCH_NOT_FOUND`)
and unexpected system errors (logged with full context, returned to the client
as a generic 500).)*

## Frontend Error Handling

*(Placeholder — global error boundary strategy, retry/backoff for transient
network failures, user-facing error copy per
[`docs/UI_GUIDELINES.md`](UI_GUIDELINES.md#copy-guidelines).)*

## Real-Time Error Handling

WebSocket errors use the dedicated `error` event (see
[`docs/API_SPECIFICATION.md`](API_SPECIFICATION.md#error-format)). Mid-match
errors (e.g. a landmark frame fails validation) must not silently drop the
match — see [`docs/MULTIPLAYER.md`](MULTIPLAYER.md#disconnection-handling) for
the broader resilience story.

## Open Questions

- Error tracking/aggregation tool (see
  [`docs/TECH_STACK.md`](TECH_STACK.md#observability)).
