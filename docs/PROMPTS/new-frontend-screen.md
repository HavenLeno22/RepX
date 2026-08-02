# Template: New Frontend Screen

Use when adding a new screen to the React Native app.

---

I'm adding a new screen to RepX: **[SCREEN_NAME]**.

**Purpose:** [what does the user accomplish on this screen?]
**Feature area:** [which `frontend/src/features/<feature>/` does this belong to?]

Context:
- Read [`frontend/README.md`](../../frontend/README.md#planned-structure) for
  the feature-first folder layout.
- Read [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) and
  [`docs/UI_GUIDELINES.md`](../UI_GUIDELINES.md) — use existing design-system
  components/tokens; don't hand-roll styling that duplicates an existing
  component.
- Read [`docs/USER_FLOW.md`](../USER_FLOW.md) to confirm where this screen sits
  in the broader journey (what leads to it, what it leads to).
- If this screen calls the API, define/reuse the relevant `shared/` schema
  (see [`docs/API_SPECIFICATION.md`](../API_SPECIFICATION.md)) rather than
  hand-typing the response shape.

Deliverables:
1. Screen component in `frontend/src/features/[feature]/screens/`.
2. Navigation entry (see `frontend/app/` Expo Router structure).
3. Loading/empty/error states per
   [`docs/UI_GUIDELINES.md`](../UI_GUIDELINES.md#empty-loading-and-error-states).
4. Accessibility pass per [`docs/ACCESSIBILITY.md`](../ACCESSIBILITY.md)
   (screen reader labels, dynamic type, reduced-motion respect for any
   animation).
5. Component/hook tests (see
   [`docs/TESTING.md`](../TESTING.md#frontend-testing)).
