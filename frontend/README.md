# RepX — Frontend

React + TypeScript web client with in-browser AI pose estimation.

```bash
npm run dev -w @repx/frontend      # http://localhost:5173
```

## Why web and not React Native

The original decision was React Native. It changed because MediaPipe pose
estimation in RN requires native modules and a bare-workflow build — Android
Studio or Xcode configured before anyone could see a single rep counted. The
browser runs the identical model with no toolchain.

The mobile app is still the plan. Because every rep state machine, the ELO math,
and all API contracts live in `@repx/shared` (platform-agnostic — no DOM, no
Node), the React Native port reuses that wholesale and rewrites only UI and the
camera bridge. Full reasoning:
[`docs/TECH_STACK.md`](../docs/TECH_STACK.md#frontend-framework).

## Stack

- **Vite** + React 18 + TypeScript
- **@mediapipe/tasks-vision** — `PoseLandmarker`, GPU-delegated, `VIDEO` mode
- **socket.io-client** — live match transport
- **zustand** — auth and match state
- **framer-motion** — transitions and the rep-count spring
- Plain CSS with design tokens in `src/styles/global.css` (no UI framework —
  the visual language is specific enough that a component library would be
  fought more than used)

## Structure

```
src/
├── components/     # RankChip, TopBar
├── hooks/
│   └── useMatchSocket.ts   # binds server match events to the store (mounted once at root)
├── lib/
│   ├── api.ts       # REST client, token attach + transparent refresh-and-retry
│   ├── socket.ts    # Socket.IO singleton
│   └── pose.ts      # MediaPipe loading, camera, landmark conversion, skeleton
├── pages/
│   ├── Login.tsx        # auth (validates with the same zod schemas the server uses)
│   ├── Home.tsx         # rank card, record, top players
│   ├── Play.tsx         # exercise + mode picker, matchmaking
│   ├── Match.tsx        # THE ARENA — camera, pose overlay, live HUD
│   ├── Result.tsx       # outcome and rating change
│   ├── Profile.tsx      # stats, rating sparkline, match history
│   └── Leaderboard.tsx
├── store/          # auth.ts, match.ts (zustand)
└── styles/global.css   # design tokens + primitives
```

## The one thing to understand

`Match.tsx` runs a **local copy** of the exercise plugin for instant on-screen
feedback, and separately streams landmarks to the server, which independently
re-derives the real rep count. The number on screen is the server's. The local
session exists purely so the UI feels instant — it can never score a match. See
[`docs/ANTI_CHEAT.md`](../docs/ANTI_CHEAT.md).

## Notes

- Camera permission is required; the arena shows a clear recovery state if denied.
- The pose model (~5MB) downloads from a CDN on first use, then caches.
- `prefers-reduced-motion` is respected globally.
