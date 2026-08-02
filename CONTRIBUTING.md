# Contributing to RepX

## Status

This repository is in its pre-implementation phase. These guidelines describe the
intended contribution workflow once application code lands; some sections are
placeholders until CI and package scripts exist (see [`docs/IMPLEMENT.md`](docs/IMPLEMENT.md)).

## Before you start

1. Read [`docs/README.md`](docs/README.md) for the full documentation map.
2. Read [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md) and
   [`docs/SYSTEM_ARCHITECTURE.md`](docs/SYSTEM_ARCHITECTURE.md).
3. Check [`docs/ROADMAP.md`](docs/ROADMAP.md) to understand current priorities.
4. For adding a new exercise or backend module, use the templates in
   [`docs/PROMPTS/`](docs/PROMPTS/).

## Workflow

1. Create a branch from `main` using the pattern `type/short-description`
   (e.g. `feat/squat-exercise-plugin`, `fix/matchmaking-timeout`).
2. Keep changes scoped to a single module/concern — see the single-responsibility
   principle in [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md).
3. Write or update tests alongside code changes (see [`docs/TESTING.md`](docs/TESTING.md)).
4. Open a pull request using the template in
   [`.github/pull_request_template.md`](.github/pull_request_template.md).
5. CI must pass (lint, typecheck, test, build) before merge — see
   [`.github/workflows/`](.github/workflows/).
6. At least one approving review is required before merge.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`,
`docs:`, `refactor:`, `test:`, `chore:`) so `CHANGELOG.md` can eventually be
generated automatically.

## Code of conduct

All contributors are expected to follow [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Questions

Open a discussion or issue using the templates in
[`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/).
