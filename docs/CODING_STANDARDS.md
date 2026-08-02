# Coding Standards

> **Purpose:** Define how code is written across RepX so it stays maintainable
> and understandable by an engineer joining years from now.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Guiding Principles](#guiding-principles)
2. [TypeScript Conventions](#typescript-conventions)
3. [Module Boundaries](#module-boundaries)
4. [Comments & Documentation](#comments--documentation)
5. [Linting & Formatting](#linting--formatting)
6. [Naming](#naming)
7. [Open Questions](#open-questions)

## Guiding Principles

- **Single responsibility per module** — every backend module owns one bounded
  context (see [`docs/SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md#backend-module-boundaries)).
  If a change requires touching two unrelated modules, that's a signal the
  boundary is wrong.
- **No hardcoded exercise logic outside `exercise-engine`** — this is the single
  most important standing rule in the codebase (see
  [`docs/EXERCISE_ENGINE.md`](EXERCISE_ENGINE.md)). Code review should reject any
  PR that special-cases an exercise slug (`if (exercise === 'push-up')`) anywhere
  outside a plugin file.
- **Don't duplicate logic across `frontend/` and `backend/`** — anything that
  must behave identically on both sides (schemas, ELO math, constants) lives in
  `shared/` (see [`shared/README.md`](../shared/README.md)).
- **Prefer explicit over clever.** Code is read far more often than written;
  optimize for the next engineer's comprehension.
- **No premature abstraction.** Duplicate a few lines before introducing a
  shared helper for a pattern that's only appeared twice.

## TypeScript Conventions

- `strict: true` everywhere (see `tsconfig.base.json`) — no `any` without a
  documented reason.
- Runtime boundaries (API input, WebSocket payloads) are validated with the
  same zod schemas used to generate types — types alone are not a trust
  boundary (see [`docs/SECURITY.md`](SECURITY.md#api-security)).

## Module Boundaries

Backend modules communicate through their public service interfaces only —
never by importing another module's Prisma models or internal classes directly.
See [`docs/PROMPTS/new-module.md`](PROMPTS/new-module.md) for the scaffold every
new module follows.

## Comments & Documentation

- Comment the *why*, not the *what* — a comment explaining a non-obvious
  constraint or workaround is valuable; a comment restating what the next line
  does is not.
- Every module gets a short top-level doc comment describing its
  responsibility, matching the table in
  [`docs/SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md#backend-module-boundaries).

## Linting & Formatting

ESLint + Prettier, enforced in CI (see
[`.github/workflows/`](../.github/workflows/)) and on save (see
[`.vscode/settings.json`](../.vscode/settings.json)). Exact rule set to be
finalized when `frontend/`/`backend/` gain real source code.

## Naming

*(Placeholder — file naming conventions, exercise slug format, event naming
conventions cross-referenced with [`docs/API_SPECIFICATION.md`](API_SPECIFICATION.md).)*

## Open Questions

- Whether to adopt a formal architecture decision record (ADR) process for
  future significant technical decisions, given [`docs/TECH_STACK.md`](TECH_STACK.md)
  already establishes the pattern of documenting trade-offs inline.
