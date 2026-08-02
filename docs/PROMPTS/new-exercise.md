# Template: New Exercise

Use when adding a new exercise (e.g. jumping jacks, lunges) to RepX. This is
the template that most directly enforces the "never hardcode exercise logic"
requirement — follow it exactly.

---

I'm adding a new exercise to RepX: **[EXERCISE_NAME]** (slug: `[exercise-slug]`).

Context:
- Read [`docs/EXERCISE_ENGINE.md`](../EXERCISE_ENGINE.md) in full — this
  defines the `ExercisePlugin` interface and the rule that all exercise-specific
  logic lives inside the plugin, never in `match-engine`, `matchmaking`, `elo`,
  or anywhere else.
- Read [`docs/AI_ENGINE.md`](../AI_ENGINE.md) for the landmark data format the
  plugin receives.
- Read [`docs/ANTI_CHEAT.md`](../ANTI_CHEAT.md) — the same plugin runs on both
  client (optimistic) and server (authoritative); rep-validity thresholds must
  be designed to be gameable-resistant (e.g. require full range-of-motion
  joint-angle transitions, not just a single frame threshold).

Deliverables:
1. Define the rep state machine for [EXERCISE_NAME]: what phases does a valid
   rep pass through (e.g. neutral → descending → bottom → ascending → neutral),
   and what joint angles/positions define each phase transition?
2. Implement `[exercise-slug].plugin.ts` conforming to the `ExercisePlugin`
   interface (see [`docs/EXERCISE_ENGINE.md`](../EXERCISE_ENGINE.md#the-exerciseplugin-interface)).
3. Register the plugin in the exercise-engine's plugin registry.
4. Add a fixture library of recorded/synthetic landmark sequences: at least one
   known-valid rep sequence and several known-invalid sequences (partial range
   of motion, wrong exercise entirely, replayed/static frames) — see
   [`docs/TESTING.md`](../TESTING.md#exercise-plugin-testing).
5. Unit tests asserting the plugin correctly accepts the valid fixtures and
   rejects the invalid ones.
6. Add the `Exercise` catalog row (slug, display name, plugin version) per
   [`docs/DATABASE_SCHEMA.md`](../DATABASE_SCHEMA.md#exercise).
7. Add any exercise-specific UI copy/iconography per
   [`docs/UI_GUIDELINES.md`](../UI_GUIDELINES.md).

Explicitly do NOT: add any `if (exercise === '[exercise-slug]')`-style special
case outside the plugin file. If the existing `ExercisePlugin` interface can't
express something this exercise needs, stop and propose an interface change in
[`docs/EXERCISE_ENGINE.md`](../EXERCISE_ENGINE.md) first — don't work around it
with a special case.
