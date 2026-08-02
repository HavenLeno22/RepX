# Performance

> **Purpose:** Define the performance requirements and strategy that keep RepX
> responsive under thousands of concurrent matches.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Requirements](#requirements)
2. [Client Performance](#client-performance)
3. [Server Performance](#server-performance)
4. [Real-Time Layer Performance](#real-time-layer-performance)
5. [Load Testing](#load-testing)
6. [Open Questions](#open-questions)

## Requirements

- The application must remain responsive with **thousands of concurrent
  matches** — the founding performance bar from the product brief.
- In-match feedback (rep confirmation) must feel instant — see the latency
  budget placeholder in [`docs/AI_ENGINE.md`](AI_ENGINE.md#latency-budget).

## Client Performance

60fps animation target; on-device pose inference must not compete with UI thread
rendering. On React Native this means landmark extraction off the JS thread via
native/worklet code (see
[`docs/TECH_STACK.md`](TECH_STACK.md#frontend-framework)).

Three measures already in place on the web client:

- **Pose estimation is dynamically imported.** `@mediapipe/tasks-vision` is by
  far the largest dependency in the app and no screen except the arena touches
  it. Splitting it out took the initial bundle from 575kB to 450kB (175kB →
  137kB gzipped); the lobby, leaderboard and profile no longer wait on it.
- **The model is warmed ahead of need.** It starts downloading on the home
  screen, so by the time a player picks an exercise it is usually already built.
  See [`MATCHMAKING.md`](MATCHMAKING.md#being-ready-before-you-are-matched) for
  why this is a correctness issue and not only a speed one.
- **Detection is gated on new camera frames.** The render loop runs at the
  display's refresh rate, but `detectForVideo` is only called when
  `video.currentTime` has actually advanced — on a 120Hz phone that is three
  inferences out of four skipped for free.

## Uplink budget

Landmark streaming is the only sustained upload in the product, and it runs for
the full 60 seconds of every match on whatever connection the player has.

- **Capped at 24 frames/second**, independent of render rate. The loop
  previously emitted once per animation frame, so a 120Hz device sent five times
  the data a 24fps stream needs — with no extra information in it, since the
  camera itself produces ~30fps.
- **Coordinates rounded to four decimals** before serialization. Normalized
  coordinates are meaningful to about a thousandth of the frame — a quarter of a
  pixel at 1080p — so full float precision was spending roughly two thirds of
  each payload on digits no measure can distinguish.
- **No per-frame downlink.** `match:progress` used to echo a phase back on every
  frame — ~30 messages/second/player, doubling socket traffic for data the client
  already derives locally. Removed; see
  [`API_SPECIFICATION.md`](API_SPECIFICATION.md#removed-matchprogress).

## Server Performance

- `match-engine` and `matchmaking` are the highest-QPS, most latency-sensitive
  modules — first candidates for dedicated scaling/service extraction (see
  [`docs/SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md#scaling-strategy)).
- Redis absorbs the high-frequency real-time read/write load so PostgreSQL
  isn't in the hot path of an active match (see
  [`docs/DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md#why-two-data-stores)).

## Real-Time Layer Performance

Socket.IO + Redis adapter fan-out is the mechanism that lets WebSocket traffic
scale horizontally across server instances (see
[`docs/TECH_STACK.md`](TECH_STACK.md#real-time-transport)) — this is the
architectural lynchpin of the "thousands of concurrent matches" requirement.

## Load Testing

*(Placeholder — tooling (e.g. Artillery/k6 with a Socket.IO plugin) and target
scenarios: concurrent matchmaking queue depth, concurrent active matches,
landmark-stream throughput per match.)*

## Open Questions

- Concrete latency/throughput SLOs per component.
- Autoscaling policy and trigger metrics.
