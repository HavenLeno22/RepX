# Final Design Audit

> **Purpose:** The pre-launch design review. What was wrong, what was changed,
> what is still wrong, and what should happen next.
> **Version:** 1.0.0
> **Status:** Review complete — **not** a clean bill of health
> **Last Updated:** 2026-08-02
>
> Read alongside [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md),
> [`PRODUCT_EXPERIENCE.md`](PRODUCT_EXPERIENCE.md) and
> [`MOTION_SYSTEM.md`](MOTION_SYSTEM.md).

---

## Verdict

**Conditional pass.** The product is now internally coherent, visually
distinctive, and genuinely motivating. It would survive a design review at the
companies it is being measured against.

It is **not** ready to launch to millions of users, and the reasons are in
[§3](#3-remaining-weaknesses). None of them are design problems. All of them are
the same problem: this is a single-node application with no automated test
coverage above the pure-logic layer, and no amount of visual polish changes that.

Anyone reading this document for reassurance should read §3 first.

---

## 1. What was actually wrong

The brief described the application as "too empty, too static, too corporate,
too dashboard-like". Those are symptoms. The diagnosis was narrower and worse:

**The product computed things it never showed.** Every match produced a
performance quality score, a rejected-rep count, and an accuracy figure — all of
which were written to the database and then thrown away before the player saw
them. The result screen showed a rating delta and two buttons. The single most
emotionally significant moment in the product had one number in it.

**Nothing existed between matches.** There was no XP, no level, no streak beyond
a raw counter, no missions, no achievements, no season, no notifications, no
friends. The home screen was a dashboard *because there was nothing else for it
to be* — a screen cannot motivate action if the product contains no rewards to
motivate it with. This was the real problem, and no visual redesign could have
fixed it.

**The design system described a different product.** `DESIGN_SYSTEM.md`
specified an olive-green brand (`#7fa650`), warm beige surfaces and two
first-class themes. None of that is the locked RepX palette. A design document
that does not match the running application is worse than none, because people
trust it.

**Navigation had no room to grow.** Five destinations, hard-capped, with
Settings occupying one of them — a settings screen given equal billing with the
ladder.

**The interface was built from emoji.** ⚔️ 🏆 📊 ⚙️ 🏠 as the navigation icons.
They render as different artwork on every operating system, carry their own
colours (a brown handle and a grey blade next to Electric Lime), cannot inherit
`currentColor`, and sit on a baseline no two of them agree on. This single
decision put a hard ceiling on how finished the product could look, on hardware
nobody had tested.

---

## 2. What was changed

### 2.1 Colour — the locked palette, enforced

Implemented as [`shared/src/constants/palette.ts`](../shared/src/constants/palette.ts),
mirrored as CSS custom properties, and shared with the server so rank colours
cannot diverge between client and API.

**Findings from the colour audit:**

| Finding | Why it mattered | Fix |
|---|---|---|
| The entire design system used a different brand colour | The running app and its own specification disagreed | `global.css` rebuilt on the locked palette |
| Two themes, one palette | Every lime-on-white pairing either fails contrast or stops being Electric Lime | Dark-only, as a brand decision. The theme toggle became motion and contrast controls that do real work |
| **Avatar fallbacks generated 360 arbitrary hues** (`hsl(${hash} 42% 46%)`) | A locked palette with 360 unbudgeted colours in it is not locked. Several landed close enough to lime to dilute it, and none of them meant anything | Fallbacks now pick deterministically from the seven rank colours |
| `--brand-hi` referenced after deletion | Silent fallback to `unset` — the depth meter's "rep counted" state had no colour | Replaced with `--ok`, which is what it meant |
| Gold used as three different literal rgba values across four files | Podium, toast, notification and achievement gold were not the same gold | `--gold-wash` / `--gold-veil` / `--gold-edge` |
| White-on-camera written inline in six places at five alpha values | The text ramp is tuned for `--card`; over a moving camera image it is unreadable, so components invented their own | `--on-media` / `-2` / `-3` / `-line` |
| Lime bloom written as two different alphas on two screens | Sign-in and onboarding did not match | `--brand-bloom` |

**Audit result:** the only colour literals left outside `global.css` are four
neutral black shadows, one `#000` video letterbox, and two canvas fill styles —
canvas cannot read CSS custom properties, and both are documented in place as the
palette's own values.

### 2.2 Iconography — emoji eliminated

`frontend/src/components/Icon.tsx`: 44 hand-authored 24×24 stroke icons on one
grid, 1.75 weight, `currentColor` throughout, four sizes. Hand-authored rather
than a dependency because the whole set is smaller than the package's
tree-shaking metadata and it cannot drift on a minor upgrade.

Every emoji in the product is gone, including the exercise icons — `exerciseIcon(slug)`
maps to the set rather than rendering the server's emoji field.

### 2.3 Progression — the missing product

None of this existed. It is the largest change, and it is the one that turns a
dashboard into a platform.

| System | Where |
|---|---|
| XP, levels 1–100, itemised award breakdown | `shared/src/progression/xp.ts` |
| Performance grades S–D | ditto |
| 30 achievements, 6 rarity tiers, 4 categories | `shared/src/progression/achievements.ts` |
| Daily and weekly missions, deterministic rotation | `shared/src/progression/missions.ts` |
| 8-week seasons | `shared/src/progression/season.ts` |
| 8 notification categories with priority and tone | `shared/src/progression/notifications.ts` |
| Day streaks, flawless matches, comebacks | `backend/.../progression.service.ts` |
| Friends, requests, presence | `backend/.../social/` |

Three design decisions inside it are worth defending explicitly:

**Rating can fall; XP cannot.** Losing still earns XP. A product that only
rewards winning punishes exactly the players most likely to quit, and the home
screen would have nothing to show during a losing streak.

**Every achievement is measured, never granted.** The catalogue is evaluated
against one metrics snapshot, so there is no bespoke unlock path that one code
route can run and another forget — and an achievement added next year
retroactively reflects history rather than counting from its ship date.

**Missions have no claim button.** Completion pays out automatically. Making
someone tap to collect a reward they already earned is friction dressed up as
engagement.

### 2.4 A grading bug the tests caught

The first grading curve gave an **A** to a performance where 20 of 54 reps were
rejected for bad form. A weighted sum made accuracy cost only 20 of 100 points
between perfect and 63%.

Fixed in two ways: accuracy is now squared, and it **caps the grade outright** —
below 70% nothing above a C is reachable, below 50% nothing above a D. No amount
of volume buys a good grade with bad form, which is the entire point of grading
form separately from the result.

This is called out because it is the clearest evidence that the test suite is
doing real work rather than asserting that the code does what it does.

### 2.5 Screens

Every screen was rebuilt. Four did not exist.

| Screen | Change |
|---|---|
| **Home** | Rank-tinted hero with emblem, rating, points-to-promotion and the largest CTA in the product; XP and level; missions with a reset countdown; recent battles with grades; quick actions; season; friends online; closest achievement; top of the ladder. One request (`/users/me/summary`) instead of three waterfalled fetches |
| **Play** | Icon-led exercise grid; stakes shown as `+24 / −18` before commitment; rank progress; unbuilt modes stated plainly as "Soon" rather than as disabled buttons; matchmaking rebuilt as a radar sweep with the real widening band, live wait count and a camera preview |
| **Leaderboard** | Animated podium; global / country / friends scopes; debounced search; presence rings; streak flames; rank emblems; peak rating; friend-add inline; **a sticky "you" row that follows the player down the board** |
| **Profile** | Rank-tinted hero banner; emblem; level and XP; six stats; a self-drawing rating curve; an exercise-range radar built from *measured* win rate rather than invented attributes; per-exercise breakdown with a favourite marker; trophy case; recent battles |
| **Battles** *(new)* | Renamed from Match History. Aggregate record; result and exercise filters; expandable cards with grade, accuracy, rejected reps, duration, XP, rating, and a one-line analysis of what actually decided it |
| **Achievements** *(new)* | Rarity ladder legend; category filter; locked achievements shown drained with live progress rings; sorted so the next thing to chase is near the top |
| **Notifications** *(new)* | Three groups, day headers, relative timestamps, category-driven icon and tone, auto-mark-read on open |
| **Friends** *(new)* | Pending requests, presence-sorted list, rank emblems, add/remove |
| **Onboarding** *(new)* | Four interactive steps, each demonstrating the real interface. The AI step exists because *"is it recording me?"* is the most common reason someone abandons a camera-based fitness app |
| **Result** | Rebuilt as a staged 2.5-second ceremony: verdict → scoreline → rating → itemised XP → achievements → missions → promotion. A defeat gets identical care and a specific, actionable line |
| **Settings** | Grouped, and **every switch does something**: motion (three-way), high contrast, haptics, sound. Plus a plain-language explanation of what happens to camera data |
| **Sign-in** | Live season and live player count, because the fastest way to look like an empty app is to show nothing but a form |
| **Match** | Emoji removed, skeleton recoloured to the brand, countdown springs per digit, forfeit uses the semantic danger glass |

### 2.6 Motion

[`MOTION_SYSTEM.md`](MOTION_SYSTEM.md) is new and complete. Highlights:

- `CountUp` **counts from the current value, not from zero** — 1480 → 1504
  animates across 24 points, which is both faster to read and true to what
  happened.
- Staggers are **capped at 12 items**. A 100-row board at 35ms each takes 3.5
  seconds to finish arriving, at which point the animation is a wait.
- Reduced motion **collapses duration rather than removing animation**, so state
  changes still happen. Decorative loops stop entirely. Honoured from the OS, an
  in-app three-way setting, and inside the JS animation primitives.
- `lib/feedback.ts` makes sound and haptics **addressable before they exist** —
  18 named cues already called from every moment that deserves feedback. Haptics
  work today on Android.

### 2.7 Accessibility

- Every colour pairing measured; all six semantic colours exceed 6:1 on `--page`.
- **Colour is never the only signal.** Win/loss carries a word and an icon; rank
  and rarity always carry their name; presence carries a label; unread carries
  grouping and a timestamp.
- 44px minimum touch targets enforced at the `.btn` level.
- Real `<button>`/`<a>`/`<input>` elements throughout — no `div` with `onClick`.
- One focus treatment, `:focus-visible` only.
- `aria-pressed` / `aria-selected` / `aria-expanded` / `role="switch"` used
  correctly; toast stack is a polite live region.
- High-contrast mode honours `prefers-contrast: more` **and** an explicit switch.

---

## 3. Remaining weaknesses

Ordered by what would actually hurt at launch.

### Blocking

**1. There are no backend, frontend, or end-to-end automated tests.**
51 tests cover pure logic — the exercise engine, ELO, and now progression.
`ProgressionService`, `SocialService`, every controller, every React component
and every user flow are covered by nothing. The new code in this pass is the
*least* tested code in the repository, and it is the code that decides what
players are told they earned. This is the single largest risk in the project.

**2. Matchmaking, live match state and presence are in-memory.**
Correct for one node, wrong for many. Two servers means two independent
matchmaking queues and a friends list where nobody is ever online. Redis is
already named in `SYSTEM_ARCHITECTURE.md`; it is not optional at launch.

**3. `syncAchievements` and `syncMissions` run a full evaluation on every
settle.** Each does several queries per player per match, including a
`findMany` over all winning participations. At one match per second this is
fine; at a thousand it is a queue. The `metricsFor` snapshot should be cached or
narrowed to the achievements whose metric actually changed.

**4. Avatars are base64 data URLs in a database column.** Up to 1.4MB each,
returned in every leaderboard row. A 100-row board can be 140MB of JSON. This
predates this pass and is now much more visible because more screens show
avatars. Object storage before any real user volume.

### Serious

**5. The bundle is 535kB (159kB gzipped), up from 450kB.** Framer Motion is most
of the increase. It is not code-split, and the sign-in screen — the one a first-time
visitor waits on — pulls the whole animation library for four transitions.

**6. No error boundary.** A render error in any screen blanks the application.
There is a designed `ErrorState` component; nothing catches a throw.

**7. Friend requests have no rate limit and no block list.** `POST /friends/:id`
can be called in a loop. Notification spam is the obvious abuse; there is no way
for a player to stop it.

**8. Leaderboard search is `contains` on an unindexed column** with no minimum
length. A single-character search scans every user.

**9. The `/pulse` endpoint is unauthenticated and uncached.** Minor, but it is a
free read of live player counts on every sign-in page view.

### Cosmetic but real

**10. Direct challenges, private rooms, tournaments and AI Coach are shown as
"Soon" cards.** This is the honest presentation and it is still four dimmed cards
on the Play screen. If they are not built within a release or two they should be
removed, not left to age.

**11. `Battles.analyse()` is a heuristic labelled "Analysis".** The panel is
cyan, which the design system reserves for AI. Nothing false is claimed — every
sentence is derived from displayed numbers — but the visual language is writing a
cheque the implementation has not cashed.

**12. Country is a free-text field.** "UK", "U.K.", "United Kingdom" and
"england" are four different countries to the country leaderboard. It needs an
ISO list and a flag.

**13. Onboarding is gated on `localStorage`.** Clearing site data replays it.
Acceptable for now; it should be a user column.

**14. The radar chart needs three exercises and shows an empty state below that.**
Correct, but it means a new player's profile has a visible hole for their first
few sessions.

---

## 4. Recommendations for Version 2

**Ranked by expected impact per unit of effort.**

1. **Test the progression service.** It decides what players are told they
   earned. Start there, then the controllers, then a Playwright pass over the
   five primary screens.
2. **Direct challenges.** The friends graph, presence and matchmaking all exist;
   what is missing is an invite that pins two players to the same queue. It is
   the highest-value unbuilt feature and the one the Friends screen already
   promises.
3. **Redis for matchmaking, match state and presence.** Unblocks everything else.
4. **Object storage for avatars.**
5. **Equippable titles.** Achievements already carry names; letting a player wear
   one under their username on the leaderboard is a strong status mechanic for
   almost no new surface.
6. **Replays.** The landmark stream is already server-side. Storing it makes
   every battle card replayable and makes anti-cheat auditable by a human. This
   is the feature with the largest gap between "cheap given what exists" and
   "looks impossible".
7. **A real AI Coach.** `analyse()` is the seam. A model reading the landmark
   stream and returning specific form corrections is the product's most
   defensible differentiator, and the cyan visual language is already reserved.
8. **Tournaments.** Seasons, brackets and the podium component are in place.

---

## 5. Technical debt

| Item | Cost of leaving it |
|---|---|
| No tests above pure logic | Every future change is a manual regression pass |
| In-memory matchmaking / match / presence | Cannot scale past one node at all |
| Base64 avatars | Leaderboard payloads grow linearly with users |
| Framer Motion not code-split | ~90kB gzipped on first paint for a sign-in form |
| `metricsFor` re-queried per settle | Linear cost per match on a hot path |
| Progression fields denormalised on `User` | `totalReps`, `flawlessMatches`, `perfectGrades`, `comebacks` can drift from match history; nothing reconciles them |
| SQLite in development, PostgreSQL in production | The schema avoids native enums for this reason, but it is untested against Postgres |
| No API versioning | Any breaking payload change breaks every client at once |
| `dist/` build output committed in `shared/` | Stale artefacts can mask a broken build |

---

## 6. Design debt

| Item | Cost of leaving it |
|---|---|
| No brand mark | `assets/brand/` is still empty; the logo is a lightning icon in a lime square. It is defensible and it is not a wordmark |
| No illustration system | Empty states use icons in plates. It works; it is not distinctive |
| Charts are hand-drawn SVG | Correct at two charts. At six it becomes a library that should have been chosen deliberately |
| No dark/light choice | Deliberate, and it will be a support question. The answer needs to be written somewhere a user can find it |
| Tokens live only in the web app | A React Native client would duplicate them, which is the mistake the design system exists to prevent. Move to `assets/tokens/` before that happens |
| No visual regression testing | Nothing catches a screen that silently breaks at 380px |
| Motion is specified but not measured | No frame-rate budget is enforced in CI; 60fps is a claim, not a check |

---

## 7. Product opportunities

**The rating is the asset, and it is currently invisible outside the app.** A
public profile at `repx.dev/@username` showing rank, peak, radar and trophy case
would be the single cheapest growth mechanism available — the data, the layout
and the components all exist, and the `OptionalJwtGuard` already supports viewing
a profile you do not own.

**Comebacks are already detected and never celebrated.** `repsAtHalfway` is
tracked and feeds an achievement. A match won from behind is the most emotionally
valuable thing that happens in RepX and the result screen does not mention it.

**Grades are per-match and never aggregated.** "Your average grade this season"
is one query and a genuinely new reason to open the profile.

**Missions are global, not personal.** Everyone gets the same three. Missions
derived from a player's own weak exercises — which the radar already computes —
would be materially more motivating for the same mechanic.

**Nothing is spectatable.** Presence already knows who is `in-match`. Watching a
friend's momentum bar live is a small feature with a large social surface.

---

## 8. Long-term vision

RepX's defensible position is not the exercise tracking — that is commodity — it
is **a rating that means something because it cannot be faked**. Every strategic
decision should protect that:

- **Anti-cheat is the moat, not a feature.** The moment a rating can be bought or
  scripted, the ladder is worthless and so is the product. It should get more
  investment than any cosmetic system.
- **The rating should be portable.** A RepX rating that can be cited outside the
  app — a profile, an embed, an API — is what turns a fitness app into a
  governing body.
- **Seasons make the ladder repeatable.** They are the mechanism by which a
  three-year-old account and a three-week-old account can both be competing for
  something this month.
- **Social depth beats social breadth.** Rivals, guilds and spectating fit a
  competitive product. A feed does not, and would import a moderation burden this
  team cannot carry.
- **The AI Coach is the second product.** Verified reps plus a form model plus a
  rating is a personal trainer that can prove it works. That is a larger business
  than a leaderboard.

---

## 9. Verification performed

Not claims — these were run against the working tree:

- `npm run typecheck` — clean across shared, backend and frontend.
- `npm run build` — all three packages build; frontend 535kB / 159kB gzipped,
  MediaPipe still code-split into its own 136kB chunk.
- `npm test` — **51/51 pass**, up from 26. The 25 new tests cover the level
  curve's continuity and cap, XP asymmetry and the streak cap, breakdown
  reconciliation, the grade ceiling, achievement uniqueness and
  non-revocability, mission determinism and rotation, and season boundaries.
- `node prisma/seed.js` — runs clean against the migrated schema and creates the
  friendships and notifications the redesigned screens need to be reviewable.
- Colour audit — every non-token colour literal in `frontend/src` enumerated and
  either tokenised or documented in place.

**Not verified:** the arena needs a camera, so the redesigned match screen has
not been seen rendered. Neither has the promotion ceremony, which requires
actually crossing a tier. Both are the highest-risk unverified surfaces in this
pass.

---

## 10. Would this win an award?

**Awwwards / Red Dot / iF:** plausibly. The visual system is distinctive,
coherent and defensible, and the motion is specified rather than decorative.

**Apple Design Award:** not yet, and the reason is not visual. Apple's criteria
weigh *inclusivity* and *performance* alongside craft. The inclusivity work here
is genuine but unaudited by an actual assistive-technology user, and the
performance story is a claim rather than a measurement.

**Google Play Best App:** not applicable — there is no mobile app. The React
Native port is deferred in `IMPLEMENT.md` for good reasons, and shipping the web
app as a wrapped webview would fail on the one screen that matters most.

The honest position: **the design is award-standard; the engineering behind it is
not yet launch-standard.** Fixing that order is the work.
