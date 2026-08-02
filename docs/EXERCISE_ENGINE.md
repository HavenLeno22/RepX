# Exercise Engine

> **Purpose:** Define the plugin architecture that lets RepX support many
> exercises (push-ups, pull-ups, squats, burpees, planks, and future additions)
> without hardcoding exercise-specific logic anywhere in the core system.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Why a Plugin Architecture](#why-a-plugin-architecture)
2. [The `ExercisePlugin` Interface](#the-exerciseplugin-interface)
3. [Plugin Registry](#plugin-registry)
4. [Rep State Machine Pattern](#rep-state-machine-pattern)
5. [Client/Server Symmetry](#clientserver-symmetry)
6. [Adding a New Exercise](#adding-a-new-exercise)
7. [Open Questions](#open-questions)

## Why a Plugin Architecture

The product brief explicitly requires: "Design the AI layer so new exercises can
easily be added. Avoid hardcoding exercise logic. Exercise detection should be
modular." Concretely, this means `match-engine`, `matchmaking`, `elo`, and every
other core module must depend only on the *shape* of an exercise (via a common
interface), never on which specific exercise is being played. Adding "jumping
jacks" next quarter should mean writing one new plugin file and registering it —
not touching matchmaking, the WebSocket gateway, or ELO code.

## The `ExercisePlugin` Interface

✅ Implemented in `shared/src/exercise-engine/types.ts`. Plugins live in
`shared/src/exercise-engine/plugins/` — **in `shared/`, not the backend**, so the
exact same state machine runs in the browser (optimistic) and on the server
(authoritative). Two implementations could disagree; one cannot.

```ts
interface ExercisePlugin {
  slug: string;              // e.g. "push-up"
  displayName: string;
  version: string;           // bump on ANY rep-validity logic change
  description: string;
  icon: string;
  scoring: 'reps' | 'hold';  // counted reps vs isometric hold (plank)
  requiredLandmarks: LandmarkRequirement[];
  cameraHint: string;        // setup guidance shown before the match
  createSession(): ExerciseSession;
}

// A bare index demands that landmark. A pair demands *either* side.
type LandmarkRequirement = number | readonly [number, number];

interface ExerciseSession {
  processFrame(frame: PoseFrame, timestampMs: number): RepEvent | null;
  readonly repCount: number;
  readonly phase: string;    // drives the UI coaching hint
  readonly completion: number; // 0..1 into the current rep — the depth meter
  reset(): void;
}

type RepEvent =
  | { type: 'rep_counted'; quality: number; phase: string }
  | { type: 'rep_rejected'; reason: string; phase: string }
  | { type: 'progress'; phase: string; completion: number };
```

`rep_rejected` carries a **player-facing** reason ("Go deeper — full range of
motion") rather than an error code, because in this product a rejected rep is
coaching, not a failure.

## Choosing a measure: the squat lesson

The squat plugin originally tracked **2D knee angle** and it was wrong in real
use — players reported correct reps not counting.

The cause: filmed head-on from a laptop webcam (what most people actually have),
the knee travels *toward* the lens rather than across it. A full squat barely
changes the projected knee angle, so genuine reps measured as shallow and were
silently rejected. Worse, the threshold was set deeper than parallel.

The second attempt — vertical span ÷ summed leg-segment lengths — was checked
before shipping and **also failed**: as the leg foreshortens, the segment
lengths shrink in step with the span, so the ratio sits at ~1.0 whether you are
standing or at the bottom of a squat.

What works is normalizing by the **torso**, the one segment that neither bends
nor foreshortens appreciably during the movement. Measured hip height above the
ankles reads ~2.0 standing and ~1.15 at parallel — from the front *and* the
side.

| Measure | Front view | Side view | Usable? |
|---|---|---|---|
| 2D knee angle | almost flat | good | ❌ |
| span ÷ leg segments | 1.00 → 0.98 | 1.00 → 0.75 | ❌ |
| **height in torso-lengths** | **2.00 → 1.15** | **2.00 → 1.14** | ✅ |

**The general rule for new plugins:** pick a measure normalized by something
that does not change during the exercise, and verify it at both camera angles
before shipping. `heightInTorsos()` in `geometry.ts` exists for this. Locked in
by regression tests in `shared/src/exercise-engine/exercise-engine.test.ts`.

Thresholds across all exercises were also loosened at the same time. The
governing principle: **under-counting a real rep is a far worse product failure
than crediting a slightly shallow one.** A player who cannot trust the counter
stops playing; a player who gets an occasional generous rep does not.

## Shipped Exercises

| Slug | Tracked measure | Scoring |
|---|---|---|
| `push-up` | Elbow angle + hip-line form check | reps |
| `squat` | Hip height in torso-lengths + torso-fold check | reps |
| `pull-up` | Elbow angle + hands-overhead check | reps |
| `sit-up` | Hip angle + knees-bent check | reps |
| `jumping-jack` | Hands-overhead ratio + feet-apart check | reps |
| `burpee` | Hip-drop ratio + hands-to-floor check | reps |
| `plank` | Body-line angle + horizontal check | hold (1 pt/sec) |

## Counting reps the camera can only half see

Choosing a good measure is necessary but not sufficient. A second family of
lost-rep bugs came from treating pose output as cleaner than it is, and each one
had the same shape: the player performed the rep, and the engine threw it away.

**Either side, not both sides.** `requiredLandmarks` used to be a flat list of
indices, all of which had to clear the visibility floor. Filmed side-on — how
push-ups and pull-ups are *supposed* to be filmed — the far arm and leg are
occluded by the near ones for most of every rep, and MediaPipe reports their
visibility accordingly. The gate failed on the majority of frames in a correctly
filmed set. Requirements are now left/right pairs and either side satisfies one.

**Measure from the side you can see.** For the same reason, averaging both sides
is wrong when one of them is a guess: the model tends to park an occluded joint
near the visible one's *previous* position, and averaging that in compressed the
measured range of motion enough to push honest full-depth reps back above the
bottom threshold. `limbAngle()` and `bodyPoint()` in `geometry.ts` weight by
confidence and drop a side entirely once it falls below the trust floor.

**Ride out dropouts.** Losing tracking for a frame or two is routine. The state
machine used to reset on the first such frame, discarding a rep that was
physically half-complete. It now holds its phase across gaps shorter than 330ms
and abandons the rep only past that, where nothing honest can be claimed about
what happened in between.

**Judge form at depth, not on the way back up.** Form checks run while the
session is in its `bottom` phase, and that phase spans the return journey too.
Re-checking throughout meant any rule that is only true at the bottom failed the
instant the player started back — a jumping jack was rejected for "jump your
feet out too" because the feet had, correctly, come back together. Checks now
evaluate only on frames where the measure is actually past the bottom threshold.

**Reject spikes rather than averaging them.** The smoother was a two-frame mean,
which spreads a bad frame instead of removing it. It is now a median of three
followed by a light exponential pass: a lone spike of any magnitude is discarded
outright, at a cost of about one frame of latency.

**Unmeasurable is not the same as wrong.** A form check that cannot see what it
is checking now passes. `kneesBent` cannot judge knees whose ankles are out of
frame, and failing the rep for that punished the player for their camera
placement rather than their form.

## Avoiding Seven Separate Rep Counters

Nearly every counted exercise is the same shape: a tracked value crosses a
"bottom" threshold and returns past a "top" threshold. Implementing that
independently seven times would produce seven subtly different, separately
buggy counters.

Instead `shared/src/exercise-engine/rep-session.ts` provides two shared
machines, and plugins configure them declaratively:

- **`TwoPhaseRepSession`** — threshold crossing with an `invert` flag (for
  exercises where a *higher* value means deeper), form checks evaluated at the
  bottom, outlier-rejecting smoothing against model noise, half-rep rejection,
  tolerance for brief tracking dropouts, and a `minRepMs` cadence floor.
- **`HoldSession`** — isometric holds; accrues time only while form holds, and
  clamps per-frame deltas so a stalled stream cannot inflate the score.

### Rep quality

`rep_counted` carries a `quality` in 0.6..1, scaled by how far past the bottom
threshold the rep actually travelled, **as a fraction of that exercise's own
threshold span**. It was previously divided by a fixed constant sized for
degrees, which meant every torso-normalized exercise — squat, burpee, jumping
jack, sit-up — scored the same value on every rep no matter how it was
performed, quietly making average-quality meaningless for four of the seven.

### The cadence floor

`minRepMs` bounds a full cycle, not the pause at the bottom. An earlier version
also required a minimum dwell at the deepest point, which penalised exactly the
athletes who perform these well — a clean jumping jack passes through the
overhead position in two frames. The cycle clock also restarts on *rejected*
cycles, not only counted ones: restarting it only on counted reps let a
machine-gun cadence through at precisely half rate, because each rejected rep
left the previous accepted one as the reference point.

### Feedback is a status, not a stream

`rep_rejected` covers two different things and they are throttled differently.
Discrete, per-attempt verdicts — a rep that failed a form check, a rep that was
too fast — are always emitted, because each is a separate attempt the player
needs told about. Continuous states, like being out of frame, are emitted at
most once every 1.5 seconds. They used to fire on every frame, which at 30fps
meant thirty rejections a second flooding the socket, incrementing the player's
rejected-rep counter, and making the on-screen coaching flicker unreadably.

A plugin file is therefore ~40 lines of geometry and thresholds, with the
state-machine correctness solved once.

- `match-engine` calls `plugin.createSession()` once per participant at match
  start and feeds every incoming landmark frame through
  `session.processFrame()` — it never inspects landmarks itself.
- Each plugin encapsulates its own joint-angle thresholds and phase logic
  (e.g. a push-up plugin tracks elbow angle transitioning below/above threshold
  angles in a down→up sequence; a plank plugin tracks a sustained hold rather
  than a rep count at all — the interface accommodates both via `RepEvent`
  being exercise-defined, not assumed to always be "up/down counting").

## Plugin Registry

`shared/src/exercise-engine/registry.ts` holds a `Map<slug, ExercisePlugin>` and
is the **only** place that knows the full set of exercises. The backend's
`/exercises` endpoint serves this registry directly, so the catalog a client can
choose from is by construction the set the server can validate — there is no
separate database table to fall out of sync with the code.

Adding an exercise is: write the plugin file, add one line to the registry.
No changes to matchmaking, the match engine, ELO, or the UI. See
[`PROMPTS/new-exercise.md`](PROMPTS/new-exercise.md).

## Rep State Machine Pattern

Each plugin is expected to implement its rep logic as an explicit finite state
machine over joint angles/positions (e.g. `neutral → descending → bottom →
ascending → neutral` for a push-up), rather than ad hoc frame-to-frame
comparisons — this keeps validity rules auditable (relevant for anti-cheat
disputes, see [`docs/ANTI_CHEAT.md`](ANTI_CHEAT.md)) and testable in isolation
per exercise.

## Client/Server Symmetry

The *same* plugin module — literally the same file, imported from `@repx/shared` —
runs on the client (optimistic, for instant feedback) and the server
(authoritative). See
[`AI_ENGINE.md`](AI_ENGINE.md#on-device-vs-server-side-split).

Plugin `version` exists so a mismatch between the client's bundled plugin and
the server's is detectable. The server is always authoritative regardless; a
version mismatch is a signal the client needs updating before its optimistic
feedback can be expected to agree. *(Version comparison is not yet enforced at
match start — a known gap.)*

## Adding a New Exercise

See [`docs/PROMPTS/new-exercise.md`](PROMPTS/new-exercise.md) for the concrete
step-by-step template an engineer follows. At a high level: implement
`ExercisePlugin`, write unit tests against recorded/synthetic landmark
sequences (see [`docs/TESTING.md`](TESTING.md)), register in the plugin
registry, add the `Exercise` catalog row, add any exercise-specific UI copy/
iconography.

## Open Questions

- Exercises that aren't naturally "counted" (planks — timed holds) vs. counted
  (push-ups) — whether `RepEvent` needs a third variant or planks model as
  "one rep per N seconds held."
- Multi-person framing requirements (does the camera need to see the full body
  for every exercise, or only relevant limbs?) — affects plugin confidence
  thresholds in [`docs/AI_ENGINE.md`](AI_ENGINE.md).
- Versioned plugin rollout strategy (can two app versions with different plugin
  versions ever match each other?).
