# Analytics

> **Purpose:** Define what RepX measures about product usage and competitive
> health, and how that data is collected.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Goals](#goals)
2. [Event Categories](#event-categories)
3. [Pipeline](#pipeline)
4. [Privacy](#privacy)
5. [Open Questions](#open-questions)

## Goals

Support the success metrics defined in
[`docs/PRODUCT_REQUIREMENTS.md`](PRODUCT_REQUIREMENTS.md#success-metrics) once
they're finalized, plus operational visibility into competitive health (match
completion rate, anti-cheat flag rate — see
[`docs/ANTI_CHEAT.md`](ANTI_CHEAT.md)).

## Event Categories

*(Placeholder — illustrative categories: account lifecycle (signup, first
match), engagement (session start/end, streaks), competitive (match started/
completed/forfeited, ELO change), monetization (see
[`docs/MONETIZATION.md`](MONETIZATION.md)).)*

## Pipeline

*(Placeholder — event ingestion approach; the `analytics` backend module (see
[`docs/SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md#backend-module-boundaries))
is the ingestion point, but whether events land in Postgres, a dedicated
warehouse, or a third-party product-analytics tool is undecided. Relates to the
time-series-store open question in
[`docs/TECH_STACK.md`](TECH_STACK.md#open-questions).)*

## Privacy

Analytics collection must respect the same data-protection principles as
[`docs/SECURITY.md`](SECURITY.md#data-protection) — no raw camera/video data is
ever collected for analytics purposes, only landmark-derived or event-level
data.

## Open Questions

- Build vs. buy for the analytics pipeline/warehouse.
- Data retention windows per event category.
