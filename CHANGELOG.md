# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed — reps that were performed but not counted

Every item here is a way the engine discarded a repetition the player had
actually done. Details and rationale in
[`docs/EXERCISE_ENGINE.md`](docs/EXERCISE_ENGINE.md#counting-reps-the-camera-can-only-half-see).

- **An occluded limb dragged the measurement.** Both sides of a joint were
  averaged unconditionally, but filmed side-on — how push-ups and pull-ups are
  meant to be filmed — the far limb is hidden and the model parks it near the
  near limb's previous position. Averaging that in compressed the measured range
  of motion enough to push honest full-depth reps back above the threshold.
  Measurement is now confidence-weighted and drops an untrusted side entirely.
- **A frame of lost tracking reset the rep.** Visibility gating required *every*
  listed landmark, and any failure reset the state machine immediately. Both are
  now tolerant: requirements are left/right pairs where either side suffices, and
  an in-progress rep survives gaps shorter than 330ms.
- **Form checks ran on the way back up.** They evaluate during the whole `bottom`
  phase, which includes the return, so any rule true only at depth failed the
  moment the player started back — jumping jacks were rejected for "jump your
  feet out too" *because the feet had correctly come back together*. Checks now
  evaluate only at depth, and a check that cannot see what it is judging passes
  instead of failing.
- **Fast clean reps were refused.** The cadence guard also demanded a minimum
  pause at the bottom, penalising exactly the athletes who perform these well.
  The guard is now on the full cycle only — and its clock restarts on rejected
  cycles too, closing a hole where a machine-gun cadence got through at half
  rate because each rejected rep left the last accepted one as the reference.
- **Noise was averaged instead of rejected.** The 2-frame mean spread a bad
  frame rather than removing it. Replaced with a median-of-3 plus a light
  exponential pass: a lone spike of any magnitude is discarded outright.
- **Rep quality was meaningless on four of seven exercises.** Depth overshoot was
  divided by a constant sized for degrees, so every torso-normalized exercise
  scored identically on every rep. Now scaled by each exercise's own span.
- **"Get your full body in frame" fired on every frame** — 30 rejections a
  second, each incrementing the player's rejected-rep count. Continuous states
  are now throttled; per-attempt verdicts still always fire.
- **`reset()` left state behind**, so a reused session carried the previous
  rep's depth into the next one's quality score.

Earlier in this cycle, and unchanged:

- **Squats were not counting.** Detection used a 2D knee angle, which is nearly
  flat when filmed head-on from a laptop webcam, so genuine reps were silently
  rejected. Replaced with hip height normalized by torso length — consistent
  from the front and the side. Thresholds relaxed across all seven exercises on
  the principle that under-counting a real rep is worse than crediting a
  slightly shallow one.

### Fixed — matchmaking and live match

- **The camera and AI model loaded *after* an opponent was found**, putting a
  multi-second cold download in the path of a countdown already running on the
  server. On a first visit the match went live while the player watched a
  spinner, and those reps were unrecoverable. The model now warms from the home
  screen, the camera opens when the player commits to searching, and the queue
  is only joined once both are live.
- **The search screen's "widening" rating band never widened.** Queue status was
  sent once, at join, so the number was frozen for the whole wait while captioned
  as if it were moving. It is now pushed every second, carries how many players
  are in that queue, and the band interpolates between steps instead of jumping.
- **The countdown ran on the client's own clock**, started whenever the arena
  finished loading and measured against a device clock that may have drifted.
  Timing payloads now carry the server's clock and the absolute start time.
- **Reconnecting into a live match did nothing.** The server sent
  `match:resumed`; no client listener existed, so a player who dropped and came
  back sat in the lobby while their match settled as a forfeit.
- **Queueing from a second tab during a live match** stranded the first match.
- **A match whose player's socket vanished at creation** ran its full minute
  anyway, leaving the present player competing against a ghost.
- **`match:progress` was emitted on every landmark frame** — roughly 30 messages
  per second per player, carrying a phase the client derives locally and no
  listener read. Removed.
- **Anti-cheat frame blocks were counted as rejected reps**, so one stuttering
  connection could report hundreds of rejected reps on a clean set. The two are
  now separate, and block notices are throttled.
- **The socket kept its original access token**, so the first reconnect after
  that token expired was rejected and never recovered — the player silently
  stopped receiving match events.
- **Instant pairing flashed an empty search screen** over the match just found.

### Changed — the frontend is an app, not a web page

Reference is now the Chess.com *app* rather than its site. See
[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md#structure) and
[`docs/UI_GUIDELINES.md`](docs/UI_GUIDELINES.md).

- **Bottom tab bar on touch**, left rail on desktop, both driven by one
  destination list so the two cannot drift. Play is the raised middle tab.
- **No prose.** Every screen opened with a heading and an explanatory paragraph;
  the pattern had spread to camera guidance, empty states, stakes explanations
  and the search screen. Replaced with chips, segmented controls, stat tiles,
  coloured numbers and icon-led empty states. The rule applied throughout: if a
  label, number, chip or icon can carry it, it may not be a sentence.
- **Touch conventions**: safe-area insets, 44px targets, press-scale instead of
  hover, 16px inputs so iOS stops zooming the login form, no rubber-banding.
- **Skeletons instead of spinners** for content with a known shape, so the
  layout stops collapsing and jumping when data lands.
- **Screens transition as views**, keyed on route, the way a native stack pushes.
- **Shared CSS primitives** (`.panel`, `.pick`, `.seg`, `.chip`, `.listrow`,
  `.meter`, `.empty`, `.glass`) replacing inline style objects duplicated across
  eight screens — which is how the app ended up with eight button paddings and
  five definitions of "muted text".
- **Live camera preview while searching**, so framing is corrected during the
  wait rather than during the countdown.
- **Arena HUD** rebuilt on one frosted-pill style, with the middle third of the
  screen kept clear because that is where the player's body is.

### Fixed — blank page on a rebuilt `shared`

- **`vite.config.ts` forced `@repx/shared` to be pre-bundled.** Vite's dependency
  cache is keyed on a package's declared identity, not on the contents of its
  build output, so every rebuild of `shared` left the dev server serving a stale
  bundle of it. Because the failure surfaces as a missing *named export*, the
  entire module graph fails to link and the app renders a **blank white page**
  with one `does not provide an export named …` line in the console — nothing
  that points at caching. Vite excludes linked workspace packages by default for
  exactly this reason; the override is removed. If you hit this on an older
  checkout, delete `frontend/node_modules/.vite`.

### Changed — performance

- **MediaPipe is dynamically imported**, cutting the initial bundle from 575kB
  to 450kB (175kB → 137kB gzipped). No screen but the arena needs it.
- **Landmark uplink capped at 24fps** and coordinates rounded to four decimals.
  The loop previously emitted once per animation frame, so a 120Hz phone sent
  five times the data a camera can produce, at a precision no measure can
  distinguish.

### Added — UI overhaul and profiles

- **Test suite** — 26 exercise-engine and ELO regression tests (`npm test`),
  including camera-angle coverage locking in the squat fix and one case per
  lost-rep bug listed above.
- **Committed end-to-end match test** (`npm run test:e2e`) — two real Socket.IO
  clients queue, pair, stream landmarks in real time, and settle, asserting the
  scoreline the players saw. Previously a throwaway script re-run by hand.
- **Light and dark themes** with a toggle, persisted, defaulting to the
  OS preference and applied before first paint.
- **Settings page** — avatar upload (downscaled in-browser), username, bio,
  country, theme, sign out.
- **Avatars** everywhere, with deterministic initials fallback.
- **Momentum bar** — tug-of-war between both players, blue vs red.
- **Depth meter** — live range-of-motion gauge so a rejected rep is never a
  mystery.
- **Body-detection status** during the countdown, catching bad framing before
  the match starts.
- **Rebuilt layout** around a Chess.com-style persistent left rail and panels.
- **Richer matchmaking** — search timer, visualized widening rating band,
  stakes preview.
- `PATCH /api/users/me`; `User.avatarUrl`, `bio`, `country`.

### Added — playable core loop

- **`shared/`** — platform-agnostic contract package: zod schemas for every API
  and WebSocket payload, ELO math with tiered K-factor, 7 rank tiers, and the
  exercise plugin engine.
- **Exercise engine** — 7 exercises as plugins (push-up, squat, pull-up, sit-up,
  jumping jack, burpee, plank) built on two shared rep state machines
  (`TwoPhaseRepSession`, `HoldSession`) with per-exercise form checks.
- **Backend** — NestJS with auth (register/login/refresh/logout, scrypt hashing,
  rotating refresh tokens), users/stats, exercise catalog, matchmaking with
  widening rating bands, Socket.IO match gateway, authoritative match engine,
  ELO ledger, and anti-cheat.
- **Anti-cheat** — server-side screening for replayed frames, out-of-order
  sequence numbers, forged timestamps, static input, and subject discontinuity,
  plus per-exercise range-of-motion and form rejection.
- **Frontend** — React + Vite web client with in-browser MediaPipe pose
  estimation, live skeleton overlay, competitive HUD, matchmaking, results,
  profile with rating sparkline, and global leaderboard.
- Repository scaffold, CI skeletons, editor config, and the full `docs/` set.

### Changed — decisions revised during implementation

Each is recorded with rationale in
[`docs/IMPLEMENT.md`](docs/IMPLEMENT.md#decisions-revised-during-implementation).

- Frontend is a **React web app**, not React Native — MediaPipe in RN needs a
  native toolchain before anything runs. Mobile remains planned; `shared/` makes
  the port cheap.
- **npm workspaces** replace pnpm + Turborepo.
- **SQLite** for development with a Postgres-portable schema; Redis optional.
- **scrypt** replaces Argon2id — `argon2` is a native addon that broke
  `npm install` without a C++ toolchain.
- NestJS global `ValidationPipe` removed in favour of zod pipes only.

### Known gaps

- No backend unit tests or frontend component tests. The exercise engine and the
  full match loop are covered; services in isolation and UI components are not.
  See [`docs/TESTING.md`](docs/TESTING.md).
- Anti-cheat attack cases are verified by hand rather than by committed tests.
- CI workflows still reference `turbo run test`, which the repo no longer uses.
- Google/Apple sign-in designed but not implemented.
- No rate limiting; cheat flags are recorded but nothing acts on them.
- Single-node only (in-memory matchmaking and match state).
- Plugin `version` is not compared between client and server at match start.
