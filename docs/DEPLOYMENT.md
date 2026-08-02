# Deployment

> **Purpose:** Define how RepX is built, released, and operated in production.
> **Version:** 0.1.0
> **Status:** Draft — infrastructure choices below are placeholders pending a
> dedicated infra decision (see [`docs/TECH_STACK.md`](TECH_STACK.md#infrastructure--hosting)).
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Environments](#environments)
2. [Backend Deployment](#backend-deployment)
3. [Frontend Deployment](#frontend-deployment)
4. [Database Migrations](#database-migrations)
5. [Rollback Strategy](#rollback-strategy)
6. [Open Questions](#open-questions)

## Environments

*(Placeholder — local / staging / production environment definitions and how
they map to `.env` files, e.g. `backend/.env.example`,
`frontend/.env.example`.)*

## Backend Deployment

*(Placeholder — containerized NestJS deployment target (candidates: ECS/
Fargate, GKE, Fly.io — see [`docs/TECH_STACK.md`](TECH_STACK.md#infrastructure--hosting)),
horizontal scaling policy for the WebSocket layer given the Redis-adapter
architecture in [`docs/SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md#scaling-strategy).)*

## Frontend Deployment

*(Placeholder — Expo EAS Build/Submit pipeline for iOS/Android app store
releases; over-the-air update policy via EAS Update for non-native changes.)*

## Database Migrations

*(Placeholder — Prisma Migrate workflow in CI/CD, zero-downtime migration
practices given live real-time traffic. See
[`docs/DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md#migration-strategy).)*

## Rollback Strategy

*(Placeholder — how a bad deploy is rolled back for both backend (redeploy
previous container image) and frontend (EAS Update rollback vs. app-store
release cadence constraints).)*

## Open Questions

- Managed Postgres/Redis providers to evaluate (candidates: RDS/Neon/Supabase;
  ElastiCache/Upstash).
- Multi-region deployment timeline.
