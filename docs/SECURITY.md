# Security

> **Purpose:** Define RepX's security posture for protecting user data and the
> platform itself, distinct from [`docs/ANTI_CHEAT.md`](ANTI_CHEAT.md) which
> covers competitive-integrity-specific threats.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Scope](#scope)
2. [Data Protection](#data-protection)
3. [Transport Security](#transport-security)
4. [API Security](#api-security)
5. [Secrets Management](#secrets-management)
6. [Dependency & Supply Chain](#dependency--supply-chain)
7. [Incident Response](#incident-response)
8. [Open Questions](#open-questions)

## Scope

This document covers platform/data security (protecting accounts, credentials,
personal data, and infrastructure). Competitive-integrity threats (fake reps,
ELO manipulation) are covered separately in
[`docs/ANTI_CHEAT.md`](ANTI_CHEAT.md) — the two overlap (e.g. device attestation
serves both) but are conceptually distinct concerns.

## Data Protection

- Passwords hashed with Argon2id (see
  [`docs/AUTHENTICATION.md`](AUTHENTICATION.md#supported-methods)) — never
  stored or logged in plaintext.
- Camera frames are processed on-device for pose extraction; only landmark data
  (not raw video/images) leaves the device for gameplay purposes (see
  [`docs/AI_ENGINE.md`](AI_ENGINE.md)) — this materially reduces the sensitivity
  of data in transit and at rest.
- PII (email, profile data) encrypted at rest via the managed database
  provider's encryption-at-rest; field-level encryption for especially sensitive
  fields to be evaluated during [`docs/DEPLOYMENT.md`](DEPLOYMENT.md) planning.

## Transport Security

- TLS 1.2+ enforced for all REST and WebSocket traffic — no plaintext `ws://`/
  `http://` in any non-local environment.
- Certificate pinning on mobile clients — evaluated as a hardening step post-launch.

## API Security

- All authenticated endpoints require a valid JWT access token (see
  [`docs/AUTHENTICATION.md`](AUTHENTICATION.md#token-strategy)); short expiry
  limits the blast radius of a leaked token.
- Rate limiting (Redis-backed, per
  [`docs/DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md#redis--real-time-keys)) on
  auth endpoints, matchmaking join, and any write-heavy endpoint.
- Input validation via the same zod schemas shared with the client (see
  [`docs/API_SPECIFICATION.md`](API_SPECIFICATION.md#conventions)) — never trust
  client-supplied data even though the shapes are shared.
- Standard OWASP Top 10 protections apply throughout: parameterized queries via
  Prisma (no raw SQL string interpolation), output encoding, CSRF not applicable
  to token-based mobile API but considered for any future web session-cookie
  flow, dependency vulnerability scanning (see below).

## Secrets Management

- No secrets committed to the repository — `.env.example` files document
  required variables without values (see `frontend/.env.example`,
  `backend/.env.example`).
- Production secrets managed via the hosting platform's secret manager (exact
  tool TBD alongside [`docs/DEPLOYMENT.md`](DEPLOYMENT.md)) — never via plain
  environment files in production.

## Dependency & Supply Chain

*(Placeholder — automated dependency vulnerability scanning (e.g. Dependabot/
`pnpm audit` in CI), lockfile integrity enforcement, policy on adding new
third-party dependencies.)*

## Incident Response

*(Placeholder — on-call/escalation process, disclosure policy, breach
notification obligations once real user data is live.)*

## Open Questions

- Formal penetration testing cadence once the product is live.
- Data retention/deletion policy (account deletion, GDPR/CCPA-style data
  export/erasure requests) — relevant as soon as the platform has EU/CA users.
- Bug bounty program timeline.
