# AI Engine

> **Purpose:** Define how RepX uses pose estimation to detect and verify
> exercise repetitions, and the split of responsibility between on-device and
> server-side inference.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Decision & Rationale](#decision--rationale)
2. [Pipeline Overview](#pipeline-overview)
3. [On-Device vs. Server-Side Split](#on-device-vs-server-side-split)
4. [Landmark Data Format](#landmark-data-format)
5. [Latency Budget](#latency-budget)
6. [Relationship to Exercise Engine](#relationship-to-exercise-engine)
7. [Open Questions](#open-questions)

## Decision & Rationale

**MediaPipe Pose** (Google) is the pose-estimation model, run **on-device** on
the client. ✅ Implemented — `@mediapipe/tasks-vision` `PoseLandmarker` running
in the browser against the webcam (`frontend/src/lib/pose.ts`), GPU-delegated,
in `VIDEO` running mode at the display refresh rate.

"On-device" today means **in the user's browser**; when the React Native client
ships it will mean the same model via native bindings. The server contract is
identical either way, which is the point of putting the boundary at the landmark
stream rather than at the platform.

> **Operational note:** the WASM runtime and ~5MB model weights are fetched from
> a CDN on first use and cached. First load therefore needs an internet
> connection. Self-hosting these assets is the obvious hardening step and is not
> yet done.

Trade-off summary (full context in
[`docs/TECH_STACK.md`](TECH_STACK.md#ai--pose-estimation)):

- On-device inference gives the low latency required for a *competitive,
  real-time* product — round-tripping raw video to a server for every frame of
  every rep, for thousands of concurrent matches, would blow both the latency
  budget and the bandwidth/inference-cost budget.
- MediaPipe ships production-grade, actively maintained, GPU/NPU-accelerated
  builds for both iOS and Android, with a stable landmark output format
  (33 body landmarks, x/y/z + visibility) that's well suited to the joint-angle
  math exercise detection needs.
- Running inference on-device also means we never need to transmit a user's raw
  camera feed off their device for gameplay purposes — a meaningful privacy
  property (see [`docs/SECURITY.md`](SECURITY.md)).

**Critically, on-device inference does not mean the client is trusted.** The
client extracts landmarks and streams the landmark sequence (not raw video) to
the server, and the server re-runs the same exercise state machine on that
stream before crediting a rep. This is what makes on-device inference compatible
with a competitive, ELO-ranked product — see
[`docs/ANTI_CHEAT.md`](ANTI_CHEAT.md) for the full threat model.

## Pipeline Overview

```
Camera frame (client)
  → MediaPipe Pose (on-device, native module)
  → 33 body landmarks (x, y, z, visibility) per frame
  → local ExercisePlugin.processFrame() → optimistic local rep count (UI feedback only)
  → landmark frame batched/streamed over WebSocket → server
  → server ExercisePlugin.processFrame() (authoritative) → confirmed rep count
  → anti-cheat anomaly checks on the same stream
```

## On-Device vs. Server-Side Split

| Concern | Runs on-device | Runs server-side |
|---|---|---|
| Pose landmark extraction (camera → skeleton) | ✅ (source of truth for landmarks — camera never leaves device) | — |
| Rep state machine (is this a valid rep?) | ✅ (optimistic, for instant UI feedback) | ✅ (authoritative — this result is what counts) |
| Anomaly/cheat detection | — | ✅ exclusively (client must never see or influence this logic) |
| Final rep count / match result | Displayed, not trusted | Authoritative |

## Landmark Data Format

Landmark frames are defined as a shared zod schema in `shared/src/schemas/` (see
[`docs/API_SPECIFICATION.md`](API_SPECIFICATION.md#websocket-events),
`match:landmarks` event) so client and server agree on the exact shape without
hand-syncing two implementations. Each frame includes: 33 landmarks
(`{x, y, z, visibility}`), a monotonic `frameSeq`, and a client `timestamp` used
by anti-cheat for timing-consistency checks (see
[`docs/ANTI_CHEAT.md`](ANTI_CHEAT.md)).

## Latency Budget

The player never waits on the network to see feedback: a **local copy of the
same exercise plugin** runs on every frame and drives the on-screen phase and
skeleton immediately. The server's `rep:counted` then reconciles the
authoritative count, typically within one RTT.

That split is why the client is allowed to be optimistic without being trusted —
see [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md#data-flow-a-verified-rep).

*(Not yet measured: formal per-stage budgets for inference time, RTT, and
server plugin processing under load. Needed before the "thousands of concurrent
matches" claim in [`PERFORMANCE.md`](PERFORMANCE.md) can be made honestly.)*

## Frame Rate and Bandwidth

Landmarks are currently emitted on **every** animation frame, which is more than
rep detection needs and more than is wise at scale — 33 landmarks × ~60fps per
player is real bandwidth. Downsampling to ~15–20fps is very likely sufficient
(the rep state machine smooths over 3 frames regardless) and is a known
optimization, not yet applied. The trade-off against anti-cheat fidelity is
noted in Open Questions.

## Relationship to Exercise Engine

The AI Engine is exercise-agnostic — it only produces landmark streams. All
exercise-specific logic (what counts as a valid push-up vs. squat, joint angle
thresholds, rep-phase state machines) lives in the **Exercise Engine**'s plugin
system, never here. See [`docs/EXERCISE_ENGINE.md`](EXERCISE_ENGINE.md).

## Open Questions

- Frame sampling rate for the network stream (every frame vs. downsampled) —
  bandwidth vs. anti-cheat fidelity trade-off.
- Fallback behavior when on-device inference confidence is low (poor lighting,
  partial framing) — reject the rep attempt vs. prompt the user to reposition.
- Future exercises requiring equipment/object detection (e.g. jump rope) beyond
  pure body-landmark tracking.
