# API Specification

> **Purpose:** Define REST and WebSocket API conventions for RepX, and the
> founding endpoint/event catalog.
> **Version:** 0.2.0
> **Status:** Living — everything marked ✅ is implemented and exercised. All
> routes are prefixed `/api`.
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Conventions](#conventions)
2. [Authentication](#authentication)
3. [REST Endpoints](#rest-endpoints)
4. [WebSocket Events](#websocket-events)
5. [Error Format](#error-format)
6. [Versioning](#versioning)
7. [Open Questions](#open-questions)

## Conventions

- REST for resource CRUD and non-real-time operations; WebSocket (Socket.IO) for
  everything inside an active match, presence, and live notifications.
- All request/response and event payloads are defined as zod schemas in
  `shared/src/schemas/` and consumed by both client and server — this doc
  describes the contract; `shared/` is the executable source of truth.
- JSON only. `camelCase` field names. ISO 8601 timestamps.
- All authenticated routes require `Authorization: Bearer <accessToken>`.

## Authentication

See [`docs/AUTHENTICATION.md`](AUTHENTICATION.md) for the full flow. Summary of
the relevant endpoints:

| Method | Path | Purpose | |
|---|---|---|---|
| `POST` | `/api/auth/register` | Create an email/password account | ✅ |
| `POST` | `/api/auth/login` | Email/password login | ✅ |
| `POST` | `/api/auth/refresh` | Rotate refresh token, issue new access token | ✅ |
| `POST` | `/api/auth/logout` | Revoke the current refresh token | ✅ |
| `POST` | `/api/auth/google` | Exchange a Google ID token for a session | planned |
| `POST` | `/api/auth/apple` | Exchange an Apple identity token for a session | planned |

All three of register/login/refresh return the same `AuthResponse`:
`{ accessToken, refreshToken, user }`.

## REST Endpoints

| Method | Path | Purpose | |
|---|---|---|---|
| `GET` | `/api/users/me` | Current user profile | ✅ auth |
| `GET` | `/api/users/me/stats` | Full profile: rank, win rate, exercise breakdown, recent matches, rating history | ✅ auth |
| `GET` | `/api/users/:id/stats` | Another player's public stats | ✅ |
| `GET` | `/api/exercises` | Exercise catalog, served from the plugin registry | ✅ |
| `GET` | `/api/exercises/:slug` | Single exercise detail | ✅ |
| `GET` | `/api/leaderboard?limit=` | Global leaderboard by rating (max 100) | ✅ |
| `PATCH` | `/api/users/me` | Update profile/settings (username, bio, country, avatar) | ✅ auth |
| `GET` | `/api/matches/:id` | Single match summary | planned |
| `GET` | `/api/leaderboards/:exerciseSlug` | Per-exercise leaderboard | planned |

Matchmaking has no REST endpoint — it is WebSocket-only, being inherently a
real-time, stateful operation (see below).

## WebSocket Events

All ✅ implemented. The socket authenticates on handshake with
`auth: { token: <accessToken> }`; an unauthenticated socket is disconnected.
Full lifecycle in [`MULTIPLAYER.md`](MULTIPLAYER.md) and
[`MATCHMAKING.md`](MATCHMAKING.md).

### Client → Server

| Event | Payload |
|---|---|
| `matchmaking:join` | `{ exerciseSlug, mode }` |
| `matchmaking:leave` | `{}` |
| `match:landmarks` | `{ matchId, frameSeq, clientTimestamp, landmarks }` — 33 landmarks |
| `match:leave` | `{ matchId }` — forfeit |

`frameSeq` must strictly increase and `clientTimestamp` must advance no faster
than real time; both are enforced by anti-cheat, not merely conventions. See
[`ANTI_CHEAT.md`](ANTI_CHEAT.md#anomaly-detection).

### Server → Client

| Event | Payload |
|---|---|
| `matchmaking:queued` | `{ position, waitSeconds, ratingBand, searching }` — **pushed every second while queued** |
| `matchmaking:left` | `{}` |
| `matchmaking:found` | `{ matchId, exerciseSlug, mode, you, opponent, stakes: { win, loss }, countdownSeconds, durationSeconds, startsAt, serverNow }` |
| `match:started` | `{ matchId, endsAt, serverNow }` |
| `rep:counted` | `{ matchId, userId, repCount, quality, self }` — **authoritative** |
| `rep:rejected` | `{ matchId, reason }` — player-facing coaching text |
| `match:opponentProgress` | `{ matchId, userId, repCount }` |
| `match:opponentDisconnected` | `{ matchId, graceSeconds }` |
| `match:opponentReconnected` | `{ matchId }` — clears the disconnect banner |
| `match:resumed` | `{ matchId, exerciseSlug, endsAt, serverNow }` — sent on reconnect into a live match |
| `match:ended` | `{ matchId, result, yourReps, opponentReps, ratingBefore, ratingAfter, ratingDelta, opponent, flags }` |
| `error` | `{ code, message }` |

`matchmaking:found` includes `stakes`, the exact rating swing each outcome would
produce, computed with the shared ELO math so the client can show what is on the
line before the match starts.

**Every timing payload carries `serverNow` alongside its timestamp.** The client
subtracts it from its own clock once and expresses all match timing in server
time. Without it the countdown ran on whatever the device's clock said, which on
a phone that has drifted by a few seconds meant visibly starting at the wrong
moment; and the countdown itself was started whenever the client happened to
finish loading, not when the server began counting.

### Removed: `match:progress`

This event previously fired on **every landmark frame** — around thirty messages
per second per player — carrying a state-machine phase the client already derives
locally from its own copy of the plugin, and which no client listener ever read.
It is gone. Phase is local; only rep outcomes come from the server.

## Error Format

```json
{
  "error": {
    "code": "MATCH_NOT_FOUND",
    "message": "Human-readable description",
    "details": {}
  }
}
```

REST errors use standard HTTP status codes; WebSocket errors are emitted on a
dedicated `error` event with the same shape.

## Versioning

*(Placeholder — REST versioning strategy, e.g. `/v1/` prefix, and WebSocket
protocol versioning for backward compatibility across app releases.)*

## Open Questions

- Pagination convention (cursor vs offset) — likely cursor-based for match
  history and leaderboards given expected volume.
- Rate limiting policy per endpoint (see [`docs/SECURITY.md`](SECURITY.md)).
