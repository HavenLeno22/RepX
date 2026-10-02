# Deployment

> **Purpose:** How RepX is built, configured, released and operated outside a
> development machine — the API, the database, the web client, sign-in
> providers, and the Google Play package.
> **Version:** 1.0.0
> **Status:** Current — reflects the code in this repository
> **Last Updated:** 2026-10-02

## Table of Contents

1. [What a deployment consists of](#what-a-deployment-consists-of)
2. [The single-instance constraint](#the-single-instance-constraint)
3. [Configuration](#configuration)
4. [Database](#database)
5. [Backend deployment](#backend-deployment)
6. [Frontend deployment](#frontend-deployment)
7. [Wiring the domains together](#wiring-the-domains-together)
8. [Email](#email)
9. [Google and Apple sign-in](#google-and-apple-sign-in)
10. [Google Play (Trusted Web Activity)](#google-play-trusted-web-activity)
11. [Legal review](#legal-review)
12. [Pre-launch checklist](#pre-launch-checklist)
13. [Capacity](#capacity)
14. [Known limits](#known-limits)
15. [Rollback](#rollback)

---

## What a deployment consists of

| Piece | What it is | Where it comes from |
|---|---|---|
| API | NestJS + Socket.IO, one container | `backend/Dockerfile` |
| Database | PostgreSQL | Any managed provider |
| Web client | Static PWA bundle | `npm run build -w @repx/frontend` → `frontend/dist` |
| Mail | SMTP relay for verification and password-reset mail | Any SMTP provider |
| Sign-in | Google / Apple OAuth client IDs (optional) | Google Cloud Console, Apple Developer |
| Android app | Trusted Web Activity wrapping the deployed PWA | `android/` via Bubblewrap |

This document uses `repx.app` for the web client and `api.repx.app` for the API
as example hostnames. Keeping the two on separate hosts keeps the API's CORS
surface away from the static site, and `frontend/public/_headers` assumes that
shape.

## The single-instance constraint

**Run exactly one API instance.** Live match state, the matchmaking queue,
private rooms, pending challenges, presence and the rate limiter are all held in
memory in the API process:

```
match-engine.service.ts    matches, matchByUser
matchmaking.service.ts     queues, bySocket
rooms.service.ts           byCode, codeByUser
challenge.service.ts       byId, timers
presence.service.ts        byUser, userBySocket
```

Two instances would each hold part of the queue and neither would find the
other's players. Consequences:

- A deploy or a crash drops every in-progress match.
- Scaling is vertical (a bigger instance) until shared state moves to Redis and
  Socket.IO uses the Redis adapter for cross-node fan-out. `REDIS_URL` is
  reserved in `backend/.env.example` for that work.

## Configuration

### Backend

Every variable is validated at boot by `backend/src/config/env.ts`. With
`NODE_ENV=production` the server **refuses to start** if the JWT secrets are the
development placeholders, shorter than 32 characters or identical to each other,
if `PUBLIC_APP_URL` is not HTTPS, if any CORS origin is `http://`, or if
`SMTP_URL` is unset. Template: [`backend/.env.example`](../backend/.env.example).

| Variable | Required in production | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production` enables every strict check |
| `PORT` | no | Default `4000` |
| `DATABASE_PROVIDER` | yes | `postgresql` (read by `backend/scripts/set-provider.mjs`) |
| `DATABASE_URL` | yes | Include `sslmode=require` |
| `JWT_ACCESS_SECRET` | yes | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | yes | A different value, same command |
| `JWT_ACCESS_TTL` | no | Default `15m` |
| `PUBLIC_APP_URL` | yes | Origin that email links point to; must be HTTPS |
| `CORS_ALLOWED_ORIGINS` | yes | Comma-separated, exact origins, no `http://` |
| `TRUST_PROXY_HOPS` | behind a proxy | Number of reverse proxies in front; `1` behind one load balancer. Never higher than the real hop count |
| `SMTP_URL` | yes | Without it, password reset cannot work |
| `MAIL_FROM` | no | Default `RepX <no-reply@repx.app>` |
| `GOOGLE_CLIENT_ID` | for Google sign-in | Public identifier, not a secret |
| `APPLE_CLIENT_ID` | for Apple sign-in | The Services ID |

Both OAuth providers are implemented as ID-token verification against the
provider's published JWKS. That needs the client ID (the audience) but never a
client secret, so the API holds no third-party secret.

### Frontend

Everything here is **public**: Vite inlines `VITE_*` values into the shipped
bundle. Never put a secret in a frontend env file. Template:
[`frontend/.env.example`](../frontend/.env.example).

```bash
VITE_API_BASE_URL=https://api.repx.app
VITE_WS_URL=https://api.repx.app
VITE_GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com   # optional
VITE_APPLE_CLIENT_ID=                                          # optional
```

## Database

`backend/prisma/schema.prisma` serves both SQLite (development) and PostgreSQL
(every deployed environment). The schema avoids native enums and
PostgreSQL-only column types for that reason; allowed values for status, mode
and result columns are enforced by the Zod schemas in `@repx/shared`.

### Provider switch

Prisma does not allow `env()` in the datasource `provider`, so
`backend/scripts/set-provider.mjs` stamps it from `DATABASE_PROVIDER` before
every `db:*` script. A real environment variable takes precedence over
`backend/.env`.

```bash
# Local
DATABASE_PROVIDER=sqlite
DATABASE_URL="file:./dev.db"

# Production
DATABASE_PROVIDER=postgresql
DATABASE_URL="postgresql://user:password@host:5432/repx?schema=public&sslmode=require"
```

### Migrations

Development uses `npm run db:push`, which syncs the schema without migration
files and can drop columns. It is not suitable for production.

Before the first production deploy, create a migration baseline against
PostgreSQL and commit it:

```bash
cd backend
export DATABASE_PROVIDER=postgresql
export DATABASE_URL="postgresql://…"
npx prisma migrate dev --name init      # creates prisma/migrations/
```

From then on, run `npm run db:deploy -w @repx/backend` (`prisma migrate deploy`)
as a **release step**, before new containers take traffic. Do not run it on
container start: with more than one replica the migrations race, and a failed
migration takes down every instance instead of failing one deploy.

### Seeding

`npm run db:setup` seeds demo accounts with a published password. The seed
script refuses to run when `NODE_ENV=production` unless `SEED_DEMO_DATA=1` is
set deliberately (for example, on a staging environment). Leave it unset in
production.

Enable automated backups on the production database and test a restore once.

## Backend deployment

Any platform that runs a container works (Fly.io, Railway, Render, Google Cloud
Run, or a VM). Build from the **repository root** — the image needs `shared/`:

```bash
docker build -f backend/Dockerfile -t repx-api .
```

The image is multi-stage and runs as the non-root `node` user. Configure the
platform with:

- All backend environment variables above
- Liveness probe → `GET /api/health` (touches nothing)
- Readiness probe → `GET /api/ready` (round-trips the database; returns 503 when
  it is down)
- Release command → `npm run db:deploy -w @repx/backend`
- **Exactly one instance** (see [the single-instance constraint](#the-single-instance-constraint))
- WebSocket support. Most container platforms enable it by default; behind
  nginx, forward `Upgrade` and `Connection "upgrade"` headers.

## Frontend deployment

```bash
npm run build -w @repx/shared
npm run build -w @repx/frontend      # → frontend/dist
```

Deploy `frontend/dist` to any static host. **Cloudflare Pages** and **Netlify**
read `frontend/public/_headers` (CSP, HSTS, `Permissions-Policy`, cache policy)
and `frontend/public/_redirects` (SPA routing) automatically. Elsewhere, the
same rules have to be expressed in the platform's own configuration:

- **Vercel:** translate both files into `vercel.json` `headers` and `rewrites`.
- **nginx:** `try_files $uri /index.html;` for SPA routing, plus an exact-match
  `location` for `/.well-known/assetlinks.json` placed *before* it, and the
  headers from `_headers` as `add_header` directives.

Whatever the host, `/.well-known/assetlinks.json` and `/sw.js` must be served as
themselves, never rewritten to `index.html`.

> **Before deploying,** replace `api.repx.app` in the `connect-src` directive of
> `frontend/public/_headers` with the real API host, for **both** the `https://`
> and `wss://` entries. The WebSocket scheme is not covered by the HTTPS entry;
> getting it wrong shows up as matchmaking that never completes, with a CSP
> violation in the browser console.

## Wiring the domains together

| Where | Setting |
|---|---|
| Backend env | `PUBLIC_APP_URL=https://repx.app` |
| Backend env | `CORS_ALLOWED_ORIGINS=https://repx.app` |
| Frontend build env | `VITE_API_BASE_URL=https://api.repx.app` |
| Frontend build env | `VITE_WS_URL=https://api.repx.app` |
| `frontend/public/_headers` | `connect-src … https://api.repx.app wss://api.repx.app` |

## Email

Verification and password-reset mail go through SMTP. In development `SMTP_URL`
is left unset and mail is written to the server log with its link intact. In
production it is required.

Use any SMTP provider (Resend, Postmark, SendGrid, Amazon SES, …). Verify the
sending domain with SPF and DKIM, then set:

```bash
SMTP_URL=smtps://<user>:<password>@<smtp-host>:465
MAIL_FROM="RepX <no-reply@repx.app>"
```

Register a test account after deploying and confirm the mail reaches an inbox,
not a spam folder.

## Google and Apple sign-in

### Google

1. In <https://console.cloud.google.com>, create a project.
2. **APIs & Services → OAuth consent screen:** user type *External*; set the app
   name, support email, app domain, privacy policy URL (`https://repx.app/privacy`)
   and terms URL (`https://repx.app/terms`); add the authorised domain. Keep the
   default scopes (`openid`, `email`, `profile`) — requesting more triggers a
   verification review.
3. **Credentials → Create credentials → OAuth client ID:** application type
   *Web application*. Add the production origin and `http://localhost:5173` to
   *Authorised JavaScript origins*. No redirect URI is needed: RepX uses the
   ID-token flow, not the authorization-code flow.
4. Copy the client ID. The client secret is not used.
5. Set the **same** value in both places and redeploy both:
   `GOOGLE_CLIENT_ID` (backend) and `VITE_GOOGLE_CLIENT_ID` (frontend build).

To confirm: `GET /api/auth/providers` returns `{"google":true,…}`. The frontend
asks this endpoint before rendering sign-in buttons, so a deployment without a
server-side client ID shows no button rather than one that fails.

### Apple

Create a Services ID at <https://developer.apple.com> and set `APPLE_CLIENT_ID`
and `VITE_APPLE_CLIENT_ID`. It is only required for apps distributed through
the iOS App Store, which the TWA is not.

## Google Play (Trusted Web Activity)

RepX ships to Google Play as a Trusted Web Activity: a thin Android shell that
runs the deployed PWA full-screen in Chrome. There is no second codebase, and a
website deploy updates the app immediately. The mechanical build reference —
Bubblewrap commands, keystore handling, Digital Asset Links and version bumps —
is [`android/README.md`](../android/README.md).

### Prerequisites

- A Google Play developer account (one-time fee; identity verification can take
  several days)
- The PWA deployed on HTTPS — Bubblewrap builds against the live
  `manifest.webmanifest`
- Node 20+, JDK 17 and the Android SDK (`bubblewrap doctor` checks them)
- Public URLs for the privacy policy (`/privacy`) and account deletion
  (`/delete-account`). Both routes are reachable signed out; Play requires the
  deletion URL to work without an account.

### Digital Asset Links

The TWA hides the browser URL bar only when the site vouches for the app. Put
the **App signing key** SHA-256 fingerprint from *Play Console → Release → Setup
→ App signing* into `frontend/public/.well-known/assetlinks.json` (replacing
`REPLACE_WITH_SHA256_FROM_PLAY_CONSOLE_APP_SIGNING`) and redeploy the frontend.
With Play App Signing enabled, the local keystore's fingerprint is the wrong one.

### Play Console declarations

**Data safety** — what the code actually does:

| Question | Answer |
|---|---|
| Personal info | Email address and username — collected, not shared |
| Photos / videos | Not collected. Pose estimation runs on-device; only joint coordinates are transmitted, held in memory for the match and discarded on settlement |
| Fitness info | Exercise counts and match results |
| App activity | In-app actions and match history |
| Encrypted in transit | Yes |
| Deletion | Supported, at `/delete-account` |
| Tracking / ads | No |

**Content rating:** declare user-generated content (usernames, avatars, bios)
and user interaction (friends, challenges). **Target audience:** 13+.

**Release tracks:** internal testing → closed testing → production. New personal
developer accounts must run a closed test with a minimum number of testers for
a continuous period before promoting to production; check Play's current
requirement and plan for it.

### When to outgrow the TWA

A TWA has no Play Billing, no native push notifications (the shell is built with
`enableNotifications: false`), and does not reach the iOS App Store. Moving to
Capacitor becomes worthwhile when one of those is needed; on iOS, RepX is
installable as a PWA from Safari in the meantime.

## Legal review

The privacy policy (`frontend/src/pages/Privacy.tsx`) and terms of use
(`frontend/src/pages/Terms.tsx`) are written to describe accurately what the
software does. They have **not** been reviewed by counsel. Before taking real
users, have them reviewed, in particular against:

- GDPR / UK GDPR (lawful basis, international transfers)
- CCPA/CPRA
- Biometric privacy statutes such as Illinois BIPA, where it is unsettled
  whether skeletal pose estimation counts as a biometric identifier

The liability, warranty and governing-law sections of the terms are
placeholders, and the operator's legal name and postal address must be filled
in. The privacy policy is versioned by `CONSENT_VERSION` in `@repx/shared`;
bumping it makes the app ask for consent again before the next match.

## Pre-launch checklist

### Blocking

- [ ] `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` generated, different, never committed
- [ ] `NODE_ENV=production` on the API
- [ ] PostgreSQL provisioned, `DATABASE_PROVIDER=postgresql`, `sslmode=require`
- [ ] Migration baseline created and committed; `db:deploy` configured as the release step
- [ ] Automated database backups enabled and a restore tested
- [ ] `SMTP_URL` set, sending domain verified, test mail lands in an inbox
- [ ] `PUBLIC_APP_URL` and `CORS_ALLOWED_ORIGINS` are exact HTTPS origins
- [ ] `TRUST_PROXY_HOPS` matches the real proxy chain
- [ ] `connect-src` in `_headers` points at the real API host, `https://` and `wss://`
- [ ] `SEED_DEMO_DATA` unset in production
- [ ] `assetlinks.json` carries the Play Console fingerprint and is served as JSON with no redirect
- [ ] Android keystore backed up outside the repository
- [ ] Privacy policy, terms and account deletion reachable signed out

### Verification

- [ ] `npm run typecheck` and `npm test` pass
- [ ] `npm run test:e2e` passes against the deployed API (it sends mail and
      deletes accounts, and the `sensitive` rate-limit bucket allows 5 requests
      per hour, so run it sparingly)
- [ ] A new account registers and receives its verification email
- [ ] Password reset works end to end
- [ ] Google sign-in works; `/api/auth/providers` reports it
- [ ] A 1v1 match between two phones on different networks
- [ ] The Play app opens with no URL bar and shows the camera permission prompt
- [ ] Account deletion removes the account
- [ ] A match on a low-end Android device

### Operations

- [ ] Error tracking on API and web client
- [ ] Uptime monitoring on `/api/health`
- [ ] Searchable log retention
- [ ] The contact addresses printed in the app (`support@`, `privacy@`,
      `security@`, `abuse@`) are monitored

## Capacity

Browsing players (leaderboard, profile, lobby) cost little: occasional REST
calls and an idle WebSocket. The load is players in a live match. Each streams
pose landmarks at `STREAM_FPS = 24` (`frontend/src/pages/Match.tsx`), about
1.8 KB of JSON per frame, so roughly 44 KB/s inbound per player and 0.7 Mbit/s
per match. Server cost is dominated by `JSON.parse` on that stream; the
exercise maths is cheap.

| Concurrent matches | Inbound | Indicative instance |
|---|---|---|
| 25 | ~18 Mbit/s | 1 vCPU / 1 GB |
| 100 | ~71 Mbit/s | 2 vCPU / 4 GB |
| 200 | ~143 Mbit/s | 4 vCPU / 8 GB; check bandwidth limits |
| 400+ | ~285 Mbit/s | Requires Redis and multiple instances |

These are **calculated estimates** from the message rate and payload size, not
load-test results. `backend/test/match-e2e.mjs`, which drives two Socket.IO
clients through a full match, is the natural starting point for a load test.

What runs out first, in order: the single-instance ceiling, one CPU core
parsing landmark JSON (felt as late rep registration), bandwidth, then memory.
The cheapest levers are lowering `STREAM_FPS` (validate against the exercise
engine tests first) and sending landmarks as a packed numeric array instead of
JSON objects.

## Known limits

- **One API instance** — see above.
- **First match needs the internet.** The pose model (~5 MB) and its WASM
  runtime are fetched from a CDN on first use, then cached.
- **No push notifications.** Challenges reach a player only while the app is
  open.
- **iOS is PWA-only.** App Store distribution would need a native wrapper.
- **Avatars are stored as data URLs** in the `User` row; move them to object
  storage before significant volume.
- **Low-end devices.** The pose model is the heaviest part of the product; test
  on modest hardware.

## Rollback

- **API:** redeploy the previous image. Migrations are forward-only, so keep
  schema changes backward-compatible with the previous release (add columns
  before using them; drop them a release later).
- **Web client:** redeploy the previous `frontend/dist`. The service worker
  serves navigations network-first, so clients pick up the rolled-back build on
  their next load.
- **Android app:** usually nothing to do — the TWA loads the website. A new Play
  release is needed only when the shell itself changes.
