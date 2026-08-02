# Authentication

> **Purpose:** Define how users sign up, log in, and stay authenticated across
> Google, Apple, and email, and why the system is built the way it is.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Decision & Rationale](#decision--rationale)
2. [Supported Methods](#supported-methods)
3. [Token Strategy](#token-strategy)
4. [Account Linking](#account-linking)
5. [Security Considerations](#security-considerations)
6. [Open Questions](#open-questions)

## Decision & Rationale

RepX implements authentication itself (Passport.js strategies + JWT) rather than
delegating to a managed identity provider (Firebase Auth, Clerk, Auth0). Full
trade-off analysis in [`docs/TECH_STACK.md`](TECH_STACK.md#authentication).
Reasoning in short: at the "millions of users" scale this product targets,
per-MAU identity-provider billing and the difficulty of ever migrating off a
managed auth provider outweigh the faster initial setup they offer. We accept
owning session/token correctness ourselves in exchange for control and long-term
cost predictability.

## Supported Methods

1. **Google Sign-In** — OAuth 2.0 / OpenID Connect via `passport-google-oauth20`
   on the backend; native Google Sign-In SDK on the client for the best mobile
   UX (avoids an in-app browser hop).
2. **Sign in with Apple** — required by App Store guidelines whenever another
   third-party login is offered; implemented via Apple's identity token
   verification on the backend.
3. **Email + password** — ✅ **built and working.** Passwords hashed with
   **scrypt** (Node built-in), cost parameters `N=2^15, r=8, p=1`, 16-byte
   random salt, 64-byte key, constant-time verification.
   See `backend/src/modules/auth/password.ts`.

### Why scrypt and not Argon2id

Argon2id is the stronger choice on paper and was the original decision. In
practice the `argon2` npm package is a native addon: with no matching prebuild
it runs `node-gyp rebuild`, which requires a full C++ toolchain (Visual Studio
Build Tools on Windows). That made `npm install` fail outright — an onboarding
blocker for every engineer without that toolchain, in exchange for a marginal
security gain over another memory-hard, OWASP-listed KDF.

scrypt ships inside Node, has zero install surface, and is memory-hard. The
stored format is self-describing (`scrypt$N$r$p$salt$hash`), so cost parameters
can be raised — or the algorithm swapped to Argon2id in a container image where
the toolchain is guaranteed — without invalidating existing hashes.

**Status of the other two methods:** Google and Apple sign-in are designed here
but **not implemented**. Both need real OAuth credentials to be testable, and a
stub would be worse than an honest absence. `AuthIdentity` already models
multiple providers per user, so adding them is additive.

## Token Strategy

- **Access token**: short-lived JWT (15 min), sent as `Authorization: Bearer`,
  used for REST calls and to authenticate the initial WebSocket handshake.
- **Refresh token**: long-lived (30 days), stored server-side (hashed) so it can
  be revoked (logout, suspicious activity, account ban — see
  [`docs/ANTI_CHEAT.md`](ANTI_CHEAT.md)), rotated on every use (refresh token
  rotation — detects token theft if an old, already-used refresh token is
  replayed).
- Refresh tokens are delivered to the client as an httpOnly-equivalent secure
  storage mechanism appropriate to the platform (Keychain/Keystore via Expo
  SecureStore on mobile).

## Account Linking

A single `User` can have multiple `AuthIdentity` rows (see
[`docs/DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md#authidentity)) — e.g. a user who
signs up with email and later links Google. Linking requires the email on both
identities to match and be verified, to prevent account-takeover via an
unverified email claim.

## Security Considerations

- All OAuth identity tokens are verified server-side against the provider's
  public keys — the client is never trusted to assert "this is user X."
- Rate limiting on `/auth/login` and `/auth/register` (see
  [`docs/SECURITY.md`](SECURITY.md)) to mitigate credential stuffing.
- Device/session list and remote sign-out — planned, see
  [`docs/SETTINGS.md`](SETTINGS.md).

## Open Questions

- Email verification requirement before ranked play (relevant to
  [`docs/ANTI_CHEAT.md`](ANTI_CHEAT.md) — throwaway accounts are a common
  ELO-manipulation vector).
- Multi-factor authentication timeline (likely post-launch).
