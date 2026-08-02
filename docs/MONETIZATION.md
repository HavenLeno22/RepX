# Monetization

> **Purpose:** Define how RepX generates revenue without compromising
> competitive fairness.
> **Version:** 0.1.0
> **Status:** Draft — no monetization mechanics are confirmed; this document
> exists to hold the space and state the guiding constraint.
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Guiding Constraint](#guiding-constraint)
2. [Candidate Models](#candidate-models)
3. [Data Model Implications](#data-model-implications)
4. [Open Questions](#open-questions)

## Guiding Constraint

Whatever monetization model RepX adopts, it must never let payment influence
competitive outcomes — no pay-to-win mechanic is compatible with a product
whose entire value proposition is fair, ELO-based competition (see
[`docs/PRODUCT_REQUIREMENTS.md`](PRODUCT_REQUIREMENTS.md#vision) and
[`docs/ANTI_CHEAT.md`](ANTI_CHEAT.md#why-this-is-the-most-important-document)).
Any monetization proposal should be evaluated against this constraint first.

## Candidate Models

*(Placeholder — candidates to evaluate, consistent with the guiding constraint:
cosmetic customization, premium analytics/insights on a player's own
performance, expanded exercise library access, subscription tiers for
non-competitive features like extended match history or coaching insights.)*

## Data Model Implications

A `Subscription`/billing entity will be added to
[`docs/DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) once a model is chosen — noted
there as a placeholder already.

## Open Questions

- Business model and pricing — not yet decided; blocks this entire document
  beyond the guiding constraint above.
- Which launch phase monetization ships in (see
  [`docs/ROADMAP.md`](ROADMAP.md#phase-3--growth--scale)).
