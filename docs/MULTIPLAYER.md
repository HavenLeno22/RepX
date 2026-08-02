# Multiplayer

> **Purpose:** Define the real-time match experience — how two players compete
> live, and how the system keeps their state in sync.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Match Lifecycle](#match-lifecycle)
2. [Real-Time Transport](#real-time-transport)
3. [State Synchronization](#state-synchronization)
4. [Disconnection Handling](#disconnection-handling)
5. [Spectator Mode](#spectator-mode)
6. [Open Questions](#open-questions)

## Match Lifecycle

```
pending → countdown → active → completed
                             ↘ forfeited (disconnect / manual leave)
                             ↘ voided (anti-cheat invalidation — see docs/ANTI_CHEAT.md)
```

Full state machine ownership sits in the `match-engine` backend module (see
[`docs/SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md#backend-module-boundaries)).
Event-by-event detail in [`docs/API_SPECIFICATION.md`](API_SPECIFICATION.md#websocket-events).

## Real-Time Transport

Socket.IO over WebSocket, with the Redis adapter for cross-instance fan-out.
Full rationale in [`docs/TECH_STACK.md`](TECH_STACK.md#real-time-transport). Each
match is a Socket.IO room; both participants' clients join on `matchmaking:found`.

## State Synchronization

- **Server-authoritative**: `match-engine` is the single source of truth for
  match state, timer, and (via `exercise-engine`) confirmed rep counts.
- **Client-optimistic**: the client shows its own on-device rep count instantly
  for responsiveness, then reconciles against server-confirmed `rep:counted`
  events (see [`docs/AI_ENGINE.md`](AI_ENGINE.md#pipeline-overview)). Any
  divergence resolves in favor of the server.
- Opponent progress (`match:opponentProgress`) is sent once per *confirmed rep*,
  not per frame — the event rate is bounded by how fast a human can move.

### One clock, and it belongs to the server

Every timing payload (`matchmaking:found`, `match:started`, `match:resumed`)
carries `serverNow` next to its timestamp. The client subtracts it from its own
clock once and expresses all match timing in server time.

This closes two separate desyncs that were both visible in play:

- **Clock drift.** Timings ran against `Date.now()` on a device that may be
  several seconds off, so the countdown and the match clock could both be
  visibly wrong.
- **Countdown started by the client.** The pre-match countdown was a local timer
  begun whenever the arena screen finished loading. On a cold pose-model
  download that was seconds after the server had started counting, so the screen
  still read "3… 2… 1" while the match was live and reps were being scored. The
  countdown is now derived from `startsAt`, and the arena is loaded before
  queueing so the gap does not exist in the first place — see
  [`MATCHMAKING.md`](MATCHMAKING.md#being-ready-before-you-are-matched).

## Disconnection Handling

**Implemented.** A dropped socket during an active match does not end it
immediately — mobile and home networks drop constantly, and instant forfeit
would make the ladder feel arbitrary.

1. On disconnect, the player is marked disconnected and a **15-second grace
   timer** starts (`RECONNECT_GRACE_SECONDS` in `shared/src/constants/match.ts`).
2. The opponent is told immediately via `match:opponentDisconnected` so the UI
   can explain the pause rather than looking frozen.
3. If the player reconnects within the window, the gateway cancels the forfeit,
   rebinds their new socket to the match, rejoins the room, and emits
   `match:resumed` with the unchanged `endsAt`. The opponent gets
   `match:opponentReconnected` so their disconnect banner clears. **The match
   clock never pauses** — time lost to a disconnect is time lost, which removes
   any incentive to disconnect strategically when behind.
4. If the window expires, the player forfeits and the match settles normally: a
   forfeit is scored as a loss and moves ELO exactly like a played loss. This is
   deliberate — a rage-quit must not be cheaper than a defeat.

The server emits `match:resumed`; the **client now acts on it**. It previously
did not, which made the whole grace period decorative: a player who dropped and
came back landed on the lobby screen while their match played on without them
and settled as a forfeit anyway. A reconnect with no local record of the match —
a hard page reload — returns the player to the lobby rather than into a
half-built arena.

Match status is recorded as `forfeited` rather than `completed` so forfeits stay
distinguishable in history and in any future abuse analysis.

**A missing socket at match start is settled immediately.** A player's socket
can vanish between being pulled off the queue and the match being created; the
match used to start anyway, leaving the player who *was* present standing in
front of their camera for a full minute against a ghost.

## Spectator Mode

*(Placeholder — future: allow friends/followers to watch a live match. Not in
scope for launch; noted here so `match-engine`'s room model is designed to not
preclude it later — e.g. a spectator joins the room in a read-only role rather
than requiring a parallel system.)*

## Resolved

- **Disconnect/forfeit** — see above.
- **Countdown** — 5 seconds (`COUNTDOWN_SECONDS`), enough to get into position
  after seeing the opponent, short enough not to kill momentum between matches.
- **Match length** — 60 seconds (`MATCH_DURATION_SECONDS`).
- **Draws** — possible on equal rep count at the timer, scored as `S = 0.5` in
  the ELO formula.

## Open Questions

- Opponent-progress broadcast rate under load — currently every confirmed rep is
  relayed immediately, which is fine at one node but should be throttled or
  batched once concurrency is real.
- Best-of-N series and rematch flow.
- Whether the grace period should scale with how much match time remains.
