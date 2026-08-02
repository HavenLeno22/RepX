# Template: Bug Fix

Use for investigating and fixing a defect.

---

I'm investigating a bug in RepX: **[SHORT DESCRIPTION]**.

**Observed behavior:** [what happens]
**Expected behavior:** [what should happen]
**Steps to reproduce:** [if known]
**Affected module(s):** [see [`docs/SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md#backend-module-boundaries)
or `frontend/src/features/`]

Investigation approach:
1. Identify the owning module/feature and read its relevant doc(s) in `docs/`
   before touching code — understand the intended behavior first.
2. Find the root cause — per [`docs/CODING_STANDARDS.md`](../CODING_STANDARDS.md),
   fix the underlying issue, not a symptom-level workaround.
3. If the bug involves a rep-counting or ELO discrepancy, check whether it's a
   client/server divergence (expected — client is optimistic, see
   [`docs/SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md#data-flow-a-verified-rep))
   vs. an actual server-side defect (a real bug).
4. Write a regression test that fails before the fix and passes after (see
   [`docs/TESTING.md`](../TESTING.md)).

Deliverables:
1. Root-cause fix, scoped to the actual defect — no unrelated refactoring in
   the same change.
2. Regression test.
3. `CHANGELOG.md` entry under `[Unreleased]`.
