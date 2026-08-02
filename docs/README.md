# RepX Documentation

Full documentation index for RepX — "the Chess.com of fitness."

> **Start with [`IMPLEMENT.md`](IMPLEMENT.md)** — it records exactly what is
> built, what isn't, how to run it, and which founding decisions were revised
> during implementation (and why). Then [`GLOSSARY.md`](GLOSSARY.md) for domain
> vocabulary.

Docs marked **Living** describe the system as built. Docs marked **Draft**
describe intent that has not been implemented yet — the distinction is in each
file's header, and it is deliberate: a document that quietly describes something
that doesn't exist is worse than no document.

## Product

- [`PRODUCT_REQUIREMENTS.md`](PRODUCT_REQUIREMENTS.md) — vision, positioning, core loop, launch scope
- [`ROADMAP.md`](ROADMAP.md) — build phases from foundation to platform expansion
- [`USER_FLOW.md`](USER_FLOW.md) — end-to-end player journeys
- [`MONETIZATION.md`](MONETIZATION.md) — revenue model constraints (no pay-to-win)

## Design

The three authoritative design documents, in the order they should be read:

- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — **how it looks.** The locked palette,
  type, spacing, radius, shadows, elevation, icons and components
- [`PRODUCT_EXPERIENCE.md`](PRODUCT_EXPERIENCE.md) — **what each screen is for.**
  Navigation, user journey, information architecture, progression
- [`MOTION_SYSTEM.md`](MOTION_SYSTEM.md) — **how it moves.** Timing, curves,
  per-component specifications, reduced motion, sound and haptics

Supporting:

- [`FINAL_DESIGN_AUDIT.md`](FINAL_DESIGN_AUDIT.md) — the pre-launch review: what
  was fixed, what is still weak, and what should happen in v2
- [`UI_GUIDELINES.md`](UI_GUIDELINES.md) — screen-level UI rules
- [`ACCESSIBILITY.md`](ACCESSIBILITY.md) — accessibility commitments and open tensions

## Architecture & Engineering

- [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) — component map, module boundaries, scaling strategy
- [`TECH_STACK.md`](TECH_STACK.md) — every major technology choice, with trade-offs
- [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) — PostgreSQL + Redis data model
- [`API_SPECIFICATION.md`](API_SPECIFICATION.md) — REST endpoints and WebSocket events
- [`CODING_STANDARDS.md`](CODING_STANDARDS.md) — how code is written and organized
- [`ERROR_HANDLING.md`](ERROR_HANDLING.md) — error conventions across the stack
- [`PERFORMANCE.md`](PERFORMANCE.md) — responsiveness requirements at scale
- [`TESTING.md`](TESTING.md) — testing strategy per layer
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — build, release, and operate

## Core Product Systems

- [`AUTHENTICATION.md`](AUTHENTICATION.md) — Google, Apple, email login
- [`AI_ENGINE.md`](AI_ENGINE.md) — on-device pose estimation pipeline
- [`EXERCISE_ENGINE.md`](EXERCISE_ENGINE.md) — the exercise plugin architecture
- [`MATCHMAKING.md`](MATCHMAKING.md) — queueing and pairing
- [`MULTIPLAYER.md`](MULTIPLAYER.md) — live match lifecycle and real-time sync
- [`ELO_SYSTEM.md`](ELO_SYSTEM.md) — chess-style competitive rating
- [`ANTI_CHEAT.md`](ANTI_CHEAT.md) — how "only valid reps count" is enforced
- [`SECURITY.md`](SECURITY.md) — data and platform protection
- [`NOTIFICATIONS.md`](NOTIFICATIONS.md) — push and in-app messaging
- [`SETTINGS.md`](SETTINGS.md) — account and app preferences
- [`ANALYTICS.md`](ANALYTICS.md) — what's measured and why

## For Engineers

- [`PROMPTS/`](PROMPTS/) — templates for scaffolding new modules, exercises, endpoints, and screens

## Reading order for a new engineer

1. [`IMPLEMENT.md`](IMPLEMENT.md) — what phase we're in
2. [`GLOSSARY.md`](GLOSSARY.md) — vocabulary
3. [`PRODUCT_REQUIREMENTS.md`](PRODUCT_REQUIREMENTS.md) — what we're building
4. [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) → [`TECH_STACK.md`](TECH_STACK.md) — how it's built
5. [`ANTI_CHEAT.md`](ANTI_CHEAT.md) — why it's built that way (this document
   drives more architectural decisions than any other)
