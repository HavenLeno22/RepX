# Testing

> **Purpose:** Define how RepX is tested so automated testing can be added
> easily as features are implemented, per the project's engineering requirements.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Backend Testing](#backend-testing)
3. [Frontend Testing](#frontend-testing)
4. [Exercise Plugin Testing](#exercise-plugin-testing)
5. [Real-Time/Integration Testing](#real-timeintegration-testing)
6. [CI Integration](#ci-integration)
7. [Open Questions](#open-questions)

## Current State

```bash
npm test         # 26 tests, offline, ~100ms — exercise engine + ELO
npm run test:e2e # full two-player match against a running API, ~25s
```

**`shared/src/exercise-engine/exercise-engine.test.ts` — 26 tests.** Squat
detection at both camera angles (a regression lock on the bug described in
[`EXERCISE_ENGINE.md`](EXERCISE_ENGINE.md#choosing-a-measure-the-squat-lesson)),
push-up depth and form rejection, all seven plugins counting and rejecting,
plugin-registry consistency, and ELO symmetry/K-factor/rating-floor behaviour.

Each of these pins down a specific way the counter used to lose a rep the player
had actually performed:

| Test | Regression it locks |
|---|---|
| `push-up: counts when the far arm is occluded` | Averaging an occluded limb halved the measured range of motion |
| `a brief loss of tracking does not throw away the rep` | One low-confidence frame reset the state machine mid-rep |
| `a sustained loss of tracking abandons the rep` | …but a real blackout must not be credited |
| `being out of frame reports a status, not a rejection per frame` | 30 rejections/second flooding the socket |
| `rep quality reflects depth` | Quality was pinned to one value on four of seven exercises |
| `jumping jack: counts a fast but humanly possible cadence` | Fast, clean reps were refused |
| `jumping jack: rejects a superhuman cadence` | …but the cadence floor must still hold, on every cycle |
| `plank: breaking form pauses scoring without resetting it` | Form-break coaching fired per frame |
| `a reset session behaves exactly like a fresh one` | `reset()` left state behind |

**`backend/test/match-e2e.mjs` — the full loop, committed.** Two real Socket.IO
clients sign in, queue, pair, stream synthetic squat landmarks in real time, and
settle. It asserts that queue status is pushed repeatedly and its band widens,
that `matchmaking:found` carries the server clock, that reps derived server-side
from the landmark stream actually count, that the opponent sees them, that no
per-frame chatter comes back, and that the final scoreline matches what both
players saw live.

Requires the API running (`npm run dev:backend`) and the demo seed. Streaming is
paced in real time on purpose — anti-cheat rejects a client whose timestamps
advance faster than the server's wall clock, so it cannot be fast-forwarded.

**It is repeatable, and that took a second attempt.** The band-widening check
originally read the widening off a real pairing between two seeded accounts
whose ratings were far enough apart to need it. That passed once and failed on
the next run: the match had moved those very ratings, so the gap was smaller and
the pair formed before the assertion could observe anything. The check now runs
with a single player in the queue, where nobody can be matched and the widening
is unambiguous, and the match is a separate phase. A test that mutates the state
it asserts against is worth less than no test, because it teaches you to ignore
its failures.

This existed for months as a throwaway script that was re-run by hand and then
deleted, which meant the highest-risk path in the product was only verified when
somebody remembered to verify it. That is the reason it is committed now.

**Still missing:**

- Backend unit tests for services in isolation (auth, ELO ledger, settlement).
- Frontend component tests.
- Anti-cheat attack cases as committed tests — each check was confirmed blocking
  a live attack by hand, which is the same fragile position the e2e test was in.

The exercise-engine tests were written only after a real user-reported bug. The
lesson worth keeping: the plugin architecture makes these tests trivial to
write, so there was never a good reason not to have them first.

## Testing Philosophy

Modules are designed for testability from the start (NestJS's DI makes
dependencies mockable by construction — see
[`docs/TECH_STACK.md`](TECH_STACK.md#backend-framework)). Every module in
[`docs/SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md#backend-module-boundaries)
is expected to ship with tests covering its public interface, not its
internals.

## Backend Testing

The real-time path is covered end-to-end by `backend/test/match-e2e.mjs` (above).
Still to add: Jest unit tests on services in isolation, and integration tests
against a real Postgres/Redis via Testcontainers or a docker-compose test
environment (see [`scripts/README.md`](../scripts/README.md)).

## Frontend Testing

*(Placeholder — Vitest + React Testing Library for component/hook tests on the
web client; Detox or Maestro for end-to-end flows once the React Native client
exists.)*

Note the split that already exists and should be preserved: everything with
real judgement in it — rep counting, ELO, rank derivation — lives in `shared/`
and is tested there without a DOM, a camera, or a network. The frontend is
presentation over those results, which is why its test gap is the least
alarming of the three.

## Exercise Plugin Testing

Because `ExercisePlugin` implementations (see
[`docs/EXERCISE_ENGINE.md`](EXERCISE_ENGINE.md#the-exerciseplugin-interface))
are pure functions over landmark sequences, they are unit-testable in isolation
against synthetic landmark fixtures — a plugin's rep-counting correctness never
requires a real device or camera. This is the single biggest testability payoff
of the plugin architecture.

**Generating fixtures works.** A valid push-up is a landmark frame with the body
line straight and the elbow angle interpolated 172° → 78° → 172° over ~24 frames
at 30fps. Invalid variants are trivial derivations: stop at 120° for a half rep,
displace the knee for a sagging hip line, repeat a frame for static input.

**One lesson worth encoding in the tests:** frame density matters. The rep state
machine smooths over a 3-frame window to reject model noise, so fixtures must
supply realistic ~30fps continuous motion. Coarse fixtures (5 frames per rep with
large angle jumps) make the smoother lag and drop the final rep — that is a
fixture artifact, not a defect, and a test suite should not accidentally encode
it as expected behaviour.

## Real-Time/Integration Testing

*(Placeholder — Socket.IO client test harness for simulating two-player match
flows end-to-end: matchmaking → match → rep events → result, per
[`docs/MULTIPLAYER.md`](MULTIPLAYER.md).)*

## CI Integration

`npm test` and `npm run typecheck` are both offline and fast enough to gate
every push. `npm run test:e2e` needs a running API and a seeded database, so it
belongs in a job that starts the backend first rather than in the fast path.

[`.github/workflows/ci-backend.yml`](../.github/workflows/ci-backend.yml) and
[`.github/workflows/ci-frontend.yml`](../.github/workflows/ci-frontend.yml) are
still placeholder jobs referencing `turbo run test`, which the repo no longer
uses — wiring them to the npm scripts above is outstanding.

## Open Questions

- Coverage targets/thresholds, if any, to enforce in CI.
- Load/performance testing tooling for the "thousands of concurrent matches"
  requirement (see [`docs/PERFORMANCE.md`](PERFORMANCE.md)).
