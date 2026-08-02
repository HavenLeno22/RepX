# Anti-Cheat

> **Purpose:** Define how RepX guarantees "only valid repetitions count" — the
> core trust guarantee of a competitive fitness product.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Why This Is the Most Important Document](#why-this-is-the-most-important-document)
2. [Threat Model](#threat-model)
3. [Defense Layers](#defense-layers)
4. [Server-Side Rep Re-Validation](#server-side-rep-re-validation)
5. [Anomaly Detection](#anomaly-detection)
6. [Device Attestation](#device-attestation)
7. [Response to Detected Cheating](#response-to-detected-cheating)
8. [Open Questions](#open-questions)

## Why This Is the Most Important Document

RepX's entire value proposition depends on competitive integrity — an ELO rating
that can be manipulated is worthless, and a fitness game where reps can be faked
is not a sport. Every architectural decision elsewhere in this repo that touches
rep counting is downstream of the rule stated in
[`docs/SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md#data-flow-a-verified-rep):
**the client's local rep count is never authoritative.**

## Threat Model

| Vector | Description | Primary defense |
|---|---|---|
| Fake landmark injection | Client sends fabricated landmark data instead of real camera output | Device attestation + statistical plausibility checks on landmark sequences |
| Replay attack | Replaying a previously recorded valid rep's landmark sequence | Per-frame monotonic sequence numbers + timestamp binding to the live match session |
| Modified client | Tampered app build that reports reps without real movement, or bypasses on-device inference entirely | Server-side re-validation (below) — the modified client can lie to itself, not to the server |
| Camera spoofing | Presenting a pre-recorded video to the camera | Depth/liveness signals where available (device-dependent); flagged as a research area, not solved at launch (see Open Questions) |
| ELO manipulation (smurfing/boosting) | Colluding accounts intentionally losing to inflate a partner's rating | Statistical anomaly detection on match patterns (unusually consistent win-trading between two accounts) |
| Account farming | Cheap throwaway accounts to dodge bans or manipulate placement | Account standing requirements for ranked play (see [`docs/AUTHENTICATION.md`](AUTHENTICATION.md#open-questions)) |

## Defense Layers

Anti-cheat is **defense in depth**, not a single mechanism:

1. **Server-side rep re-validation** (primary, always-on) — the server is the
   sole authority on whether a rep counted, full stop.
2. **Anomaly detection** (statistical, always-on) — flags suspicious patterns
   even when individual reps look locally valid.
3. **Device attestation** (platform-level, always-on) — establishes the app is
   running on a genuine, unmodified OS/app build.
4. **Human review** (manual, triggered) — high-severity flags route to review
   before permanent action (see [Response to Detected Cheating](#response-to-detected-cheating)).

## Server-Side Rep Re-Validation

As described in [`docs/AI_ENGINE.md`](AI_ENGINE.md) and
[`docs/EXERCISE_ENGINE.md`](EXERCISE_ENGINE.md): the client streams pose
landmarks (not raw video, not a rep count) to the server, and the server runs
the *same* `ExercisePlugin` logic on that stream. A rep only counts if the
server's own state machine independently confirms it. This single design
decision is what makes on-device inference (chosen for latency — see
[`docs/TECH_STACK.md`](TECH_STACK.md#ai--pose-estimation)) compatible with a
competitive product: the client can be fully compromised and, at worst, it can
only *fail to report* valid reps to itself — it cannot manufacture reps the
server will accept.

## Anomaly Detection

### Implemented and verified

Every check below runs on the server in `AntiCheatSession.inspect()`
(`backend/src/modules/anti-cheat/anti-cheat.service.ts`), **before** the frame
ever reaches the exercise plugin — a rejected frame cannot contribute to a rep.
Each was confirmed blocking a live attack against the running server:

| Check | Attack it stops | Flag |
|---|---|---|
| Strictly increasing `frameSeq` | Replaying a previously captured rep, reordering frames | `out_of_order_frames` |
| Client clock must advance | Rewinding time to replay a window | `non_monotonic_clock` |
| Client delta ≤ server wall-clock delta + 750ms | Fast-forwarding timestamps to fake a faster cadence | `accelerated_clock` |
| Positional fingerprint repetition (>15 identical frames) | Feeding a frozen frame or looped still image | `static_input` |
| Torso-size continuity (ratio outside 0.55–1.8) | Splicing feeds, or a different person stepping in | `subject_discontinuity` |

Plus per-exercise validity enforced by the plugin itself:

- **Range of motion** — a descent that never reaches depth is rejected with
  "Go deeper — full range of motion", not counted.
- **Form** — e.g. push-ups reject a sagging or piked hip line; squats reject
  folding forward; jumping jacks require the feet to travel, not just the arms.
- **Implausible speed** — reps faster than the exercise's `minRepMs` are rejected.

Flags are persisted to `CheatFlag` at match settlement and returned to the
client on `match:ended`, so a flagged match is visible rather than silent.

### Blocked frames are not rejected reps

The two are counted separately, and conflating them made both numbers useless.

A blocked *frame* is an integrity verdict about one sample of input. A rejected
*rep* is a coaching verdict about an attempt the player made. They previously
shared a counter, so a single stuttering network connection could report
hundreds of "rejected reps" on a clean set — and every one of those blocked
frames also sent the player a message, at thirty frames a second.

Now: blocked frames accumulate in `blockedFrames` and notify the player at most
once every two seconds; `rejectedReps` — the number shown on the result screen —
counts only reps the exercise plugin actually refused. Neither change weakens
the check itself. A blocked frame still never reaches the plugin.

### Still to build

- Win-trading / collusion detection across an account's match history (needs
  match volume before the statistics mean anything).
- Cross-match behavioural profiling and escalation from repeated low-severity
  flags.
- Camera liveness / spoof detection (presenting a pre-recorded video to the
  webcam is **not** currently detected — see Open Questions).

## Device Attestation

**Not implemented.** Platform-native attestation — Google Play Integrity API
(Android) and Apple DeviceCheck/App Attest (iOS) — verifies the app is a
genuine, unmodified build on a non-rooted device before allowing ranked play.

Note this is inherently a *mobile* defense and has no equivalent on the web
client that exists today: a browser can always be scripted. On web, the
server-side re-validation and stream-integrity checks above are the entire
defense, which is a real and honest limitation of shipping web-first. Ranked
integrity guarantees will be materially stronger once the native app ships.

## Response to Detected Cheating

**Today:** the offending frames are discarded (so the reps simply never count),
a `CheatFlag` row is written at settlement with a severity, and the flags are
surfaced to the player on the result screen. No automated suspension or ban.

**Still to design:** the escalation ladder — how many flags of what severity
lead to voiding a match outright, temporary ranked suspension, or a permanent
ban; whether low-severity flags compound; and an appeals process. `User.status`
(`active`/`suspended`/`banned`) already exists and is enforced at login, so the
enforcement point is in place ahead of the policy.

## Open Questions

- Camera liveness/spoof detection approach and which devices support the
  necessary depth/IR sensors — likely a tiered feature (better protection on
  capable hardware, baseline protection everywhere).
- Whether repeated low-severity flags should compound toward action, or only
  high-severity flags trigger review.
- How anti-cheat interacts with [`docs/MULTIPLAYER.md`](MULTIPLAYER.md)'s
  disconnect/forfeit handling (a disconnect immediately after a cheat flag is
  itself a signal).
