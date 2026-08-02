# Product Experience

> **Purpose:** The official UX specification for RepX. What each screen is *for*,
> how players move between them, and what every page must contain.
> Every screen follows this document.
> **Version:** 1.0.0
> **Status:** Authoritative
> **Last Updated:** 2026-08-02
>
> Companions: [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) for how things look,
> [`MOTION_SYSTEM.md`](MOTION_SYSTEM.md) for how they move.

---

## The problem this document solves

RepX was a dashboard. It reported numbers accurately and gave a player no reason
to do anything. Opening it produced information, not intent.

A dashboard answers *what happened*. A competitive platform answers *what happens
next*. Every decision below follows from that one distinction: within two seconds
of opening the app, a player should know where they stand, what to do, and what
they get for doing it — and the largest, brightest thing on screen should be the
doing.

---

## 1. Navigation Philosophy

**Five destinations, identical and in the same order on every device.** Home,
Ranks, Play, Battles, Profile. Muscle memory is the cheapest speed a competitive
product can give a returning player, and it survives moving between a phone and a
laptop only if nothing moves.

**Play is the middle tab, and it is raised.** The primary action of the product
occupies the position a thumb reaches without moving, and it is the only element
in the chrome carrying the brand colour.

**Secondary destinations live in the rail, not the tab bar.** Achievements,
Friends, Notifications and Settings are one group below a divider on desktop. On
touch they are reached from the app bar (notifications) and the Profile screen —
which is where a player already goes to look at their own things. Five is the
most a thumb can hit reliably; a nine-item tab bar is a menu pretending to be
navigation.

**Which chrome is visible is decided in CSS, never in JavaScript.** No viewport
measuring, so the stylesheet and the component tree cannot drift apart.

**Depth is capped at two.** Every screen is reachable in at most two taps from
any other. There are no nested settings pages, no sub-tabs inside sub-tabs, and
no back button that means something different depending on how you arrived.

**The arena is full-bleed and has no chrome.** Nothing competes with the camera
feed. Leaving it is a deliberate act (Forfeit), never a stray tab tap.

---

## 2. User Journey

### First launch

Sign-in screen. It carries three checkable claims, the live season, and a live
count of players competing right now — because the fastest way to look like an
empty app is to show nothing but a form.

### Registration

Email, username, password. One screen, no email verification wall, no
questionnaire. The button says **Start competing**, not "Sign up".

### Onboarding

Four interactive screens, each answering a question a new player would otherwise
ask mid-match, and each showing the *actual interface* rather than an
illustration:

1. **What RepX is** — the match, demonstrated with a live momentum bar.
2. **How the AI works** — "your camera never leaves this device", demonstrated
   with the four-line data-flow. This screen exists because *"is it recording
   me?"* is the single most common reason someone closes a camera-based fitness
   app and does not come back.
3. **How ranked works** — the seven tiers, with the player's own position marked.
4. **How you improve** — grade, accuracy, XP, and the one-line analysis.

Skippable from the first frame. An unskippable tutorial is a wall in front of the
product for the returning user who reinstalled, and they are exactly the user you
least want to annoy.

### First match

Home → Play → pick an exercise → **Find an opponent**. The camera and pose model
are already warm (they start downloading on the home screen), so queueing does not
race a 5MB download against a countdown that is already ticking. The stakes
(`+24 / −18`) are shown before commitment, computed with the same ELO function
the server will settle with.

### Ranking

Ten placement matches. The home hero shows *"N placements left"* until they are
done, so provisional rating never looks like a broken rating.

### Progression

Every match produces four things a player can see: a rating change, a grade, XP
with an itemised breakdown, and one line explaining what actually decided it.
Crossing a tier triggers a full-screen ceremony.

### Returning users

The home screen is the answer. Rank and rating in the hero, XP and level, day
streak, today's missions with a countdown, recent battles, friends online, the
closest unearned achievement, and the season's remaining days. Nothing on it
requires a second tap to be useful.

### Daily users

Missions are the daily contract: three dailies and two weeklies, rotating
deterministically from the date. They are the difference between "I could play"
and "I need 12 more push-ups for 150 XP". Completion is automatic — no claim
button, because making someone tap to collect a reward they already earned is
friction dressed up as engagement.

### Competitive users

Leaderboard with global / country / friends scopes, an animated podium, a search,
and a **sticky row showing the player's own position** that follows them down the
board. Scrolling past your own position on a ladder is the one thing a ladder must
never let you do.

---

## 3. Information Architecture

| Page | Route | Purpose — one sentence |
|---|---|---|
| **Home** | `/` | Answer "where do I stand, what do I do now, what's in it for me, who else is here" without a second tap. |
| **Play** | `/play` | Get the player into a match with the stakes already understood. |
| **Match** | `/match` | The arena. Full-bleed, no chrome, one exit. |
| **Result** | `/result` | Deliver every reward the match produced, in the order the player cares about them. |
| **Leaderboard** | `/leaderboard` | Show who is at the top and how far the player is from them. |
| **Battles** | `/battles` | Make past matches worth looking back through by explaining *why* each one happened. |
| **Achievements** | `/achievements` | A trophy cabinet with visible empty slots. |
| **Friends** | `/friends` | Who is online right now, and who is waiting on my answer. |
| **Notifications** | `/notifications` | Everything that happened to the player's standing, categorised. |
| **Profile** | `/profile` | A record, not a settings page. |
| **Settings** | `/settings` | Change how the product behaves. Every switch does something. |
| **Onboarding** | (gated) | Teach the four things, once, skippably. |
| **Sign in** | `/login` | Convince a stranger this is a live competition. |

### Future pages

Each has a defined home in the IA already: **Tournaments** under Play,
**Guilds** as a fourth leaderboard scope, **Marketplace** and **Season Pass**
as siblings of Achievements, **AI Coach** as a Play mode and a deepening of the
existing analysis panel, **Spectator** as a route into the arena without a
camera.

---

## 4. Home Experience

**The home screen must never feel empty, and no section may exist that does not
answer one of four questions.**

| Question | Sections |
|---|---|
| Where do I stand? | Hero: rank emblem, rating, tier chip, points to promotion, placements remaining |
| What do I do now? | **Play ranked** — the single largest interactive element on the screen — plus Quick Actions |
| What's in it for me? | Level and XP bar, day streak, today's missions with reset countdown, season card, closest achievement |
| Who else is here? | Live "N in a match" chip, friends online with presence, top of the ladder |

Plus **Recent battles**, which is both memory and motive: four rows with grade,
opponent, scoreline and rating change.

**Layout.** A full-width hero, then a two-column split: progress → missions →
recent battles → quick actions on the left; season → friends → achievements →
top of the ladder on the right. Collapses to one column at 900px in that order,
so the phone experience leads with progress and missions rather than with a
sidebar.

**One request backs the whole screen.** `/users/me/summary` returns level,
season, streak, missions, achievement counts and unread count together. The
previous build opened with three waterfalled fetches rendering three separate
skeletons that landed at three separate times, which is what made the app feel
like it was assembling itself in front of you.

**Empty-state rule.** Every panel here has a designed empty state that ends in an
action. A new account sees a *full* screen with four different invitations, not a
grid of "no data".

---

## 5. Play Experience

**The lobby's whole job is to get someone into a match with the stakes already
understood.**

Before every match, visible without a tap: current rating and rank progress,
expected rating change if you win and if you lose, exercise selection, match type,
round length, and the readiness of the camera and AI as a status chip — because
*"why is this taking so long"* is the question that chip exists to answer.

| Mode | Status | Notes |
|---|---|---|
| Ranked Match | Live | Rating on the line. The default. |
| Quick Match | Live | No rating change. |
| Practice | Live | Nothing at stake. |
| Challenge Friend | Designed, not built | Shown as "Soon" on a dimmed card — stating it plainly is better than a disabled button implying it exists, and better than silence implying it never will |
| Private Room | Designed, not built | As above |
| Tournament | Designed, not built | As above |
| AI Coach | Designed, not built | As above |
| Training Arena | Folded into Practice | A separate mode with no opponent and no stakes is Practice with extra steps |

**Matchmaking is not a spinner.** It is the most anxious thirty seconds in the
product, so it shows: three concentric brand-coloured pulses (one always
mid-flight, so it reads as a radar sweep rather than a loading state), elapsed
time, the **real** widening rating band pushed from the server every second, how
many others are waiting, the low/high bounds of the current band, a you-vs-?
pairing, and a **live camera preview** so framing can be fixed for free before
the countdown owns those seconds.

---

## 6. Leaderboard Experience

A list of usernames and numbers is the right shape for a scoreboard and the wrong
shape for the screen a competitive player checks most often. A ladder must answer
two things a list cannot: *who is at the top*, and *how far am I from them*.

**Podium.** Top three staged in visual order — second, first, third — with
plinths that grow from zero on mount, avatars ringed in silver/gold/bronze,
counting ratings, and country. It is the one piece of purely theatrical motion in
the product and it earns its place: this is the only screen whose job is to make
a position feel like a prize.

**Every row carries:** position, avatar with live presence, username, W/L record,
win rate, win-streak flame at 3+, country, rank emblem, rating in the rank's
colour, and peak rating. A friend-request button appears on rows that are not the
player's own.

**Scopes:** Global, Country, Friends. One endpoint, one `scope` parameter — the
ordering, the projection and the rank derivation stay in one place so the friends
board and the global board can never disagree about what rank 1 means. Season
scoping is inherent: ratings are seasonal.

**Search** is debounced at 280ms and hides the podium while active, because a
podium of search results is meaningless.

**The sticky "you" row** pins to the bottom whenever the player is below third.

---

## 7. Profile Experience

**A profile is a record, not a settings page.** The old one opened with an "Edit"
button, which told a visitor the most interesting thing about this player was
that they could change their username. Edit is now a small outline button where
it belongs.

Every element is evidence:

- **Hero banner** tinted and textured in the player's rank colour, with a
  diagonal repeat so it is never an empty coloured bar.
- **Avatar** ringed in the rank colour, on a card-coloured plate.
- **Identity row:** tier chip, level chip, country, streak chip.
- **Rating, peak rating and emblem** given equal weight — for a player in a
  slump, peak is the number that says the ceiling is real.
- **Points to promotion** with the tier progress bar.
- **Level and XP bar.**
- **Six statistics:** battles, win rate, wins, losses, best streak, day streak.
- **Rating over time** — a hand-drawn SVG curve that draws itself left to right,
  with the total change called out.
- **Exercise range radar** — win rate per exercise. Chosen over an invented
  "power / endurance / flexibility" radar because this one is *measured*: the
  spikes are what you are good at and the dents are where rating is available.
- **By exercise** — per-exercise record, total reps, win-rate bar, and a
  FAVOURITE marker on the most-played.
- **Trophy case** — up to ten earned achievements with rarity rings.
- **Recent battles** — five, with a link to the full history.

**Titles and badges** are represented today by achievements and the tier chip.
Equippable titles are a v2 item; the trophy case is the surface they will attach
to.

---

## 8. Battle History

**Renamed from Match History, and the rename changed what the screen had to
contain.** A match history is a ledger. A battle history is a record you are
supposed to *want* to look back through.

**Header:** total battles, and four aggregate stats — wins, losses, verified
reps, XP earned.

**Filters:** result (All / Victories / Defeats) and exercise.

**Each battle card, collapsed:** result flag, performance grade, outcome word,
exercise, opponent, date, scoreline, rating change.

**Expanded:** accuracy, reps rejected, duration, XP earned, rating after, a
one-line **analysis**, the opponent with their rating, and a Rematch action.

**The analysis** is ordered by what is most actionable, not what is most
flattering: form problems first (fixable, and they cost real reps), then pace,
then margin. A defeat should always leave with something to work on.

> "5 reps were thrown out for form — at 71% accuracy that is the single biggest
> thing standing between you and a better result. Slow down at the bottom of the
> movement and let each rep register."

It is called AI analysis in the product because that is what it will be. Today it
is a deterministic summary derived from the same numbers shown above it — which
is honest (nothing is claimed that is not computed) and already useful. Swapping
the sentence generator for a model is a change behind one function, not across
the screen.

**Replay** is a v2 item. It is not shown as a disabled control.

---

## 9. Achievements

Two decisions make this a trophy cabinet rather than a checklist:

**Locked achievements are shown, not hidden.** You can see the shape of every
trophy you have not earned, with a live progress ring on it. A cabinet full of
empty slots is what makes anyone go and fill them.

**Rarity uses the rank ladder's colours.** Bronze, Silver, Gold, Diamond, Master,
Grandmaster — the same six, meaning the same six things.

**Every achievement is measured, never granted.** Each names a metric and a
target; the server evaluates the whole catalogue against one stats snapshot.
There is no bespoke unlock code that one code path can run and another forget —
and an achievement added months from now retroactively reflects history instead
of only counting from the day it shipped.

**Once earned, always earned.** Metrics that can fall (rating, current streak)
must never revoke a trophy.

**Sorted by usefulness:** unlocked first (by rarity), then locked by how close
they are — so the next thing to chase is near the top rather than buried
alphabetically.

**Categories:** Ladder, Volume, Consistency, Mastery. A rarity ladder across the
top doubles as the legend and as a map of what is left.

---

## 10. Notifications

Everything here is something that happened to the player's *standing*. Nothing is
marketing and nothing is a nudge to come back — the moment a notification centre
contains one of those it stops being read.

| Category | Tone | Priority | Example |
|---|---|---|---|
| Promotion | brand | 2 — takes over the screen | Promoted to Gold |
| Achievement | gold | 2 — takes over the screen | Flawless |
| Demotion | danger | 1 — toasts | Demoted to Silver |
| Mission | brand | 1 | Clean Sheet complete |
| Challenge | brand | 1 | Friend request |
| Tournament | gold | 1 | Round 2 starts in 10 minutes |
| Season | info | 1 | Final week |
| System | neutral | 0 — waits quietly | Level 12 |

Priority comes from the category, not the caller, so a rank promotion cannot be
raised quietly by one code path and loudly by another.

**Grouped by day** (Today / Yesterday / date) and filterable into three groups —
Competition, Rewards, Social. Eight tabs would be a filing cabinet.

**Opening the screen marks everything read.** Unread is a lime dot, not a bolder
row: a list where half the rows are heavier reads as broken rather than as sorted.

---

## 11. Empty States

**Never "No data".** An empty screen means the player is here and has nothing
stopping them, which makes it the highest-intent moment in the product. Every one
of them is an icon, four words, one line of encouragement, and the action that
fills it.

The full table is in [`DESIGN_SYSTEM.md` §14](DESIGN_SYSTEM.md#14-ui-writing).

Loading states follow the same rule inverted: **skeletons, not spinners**, for
anything with a known shape, and the skeleton must match the height of what
replaces it. A skeleton of the wrong height is worse than a spinner, because the
layout still jumps *and* you promised it would not.

---

## 12. Progression System

Rating and level answer two different questions, and keeping them separate is the
entire point of having both:

- **Rating** answers *how good are you?* It is zero-sum, it can go down, and it
  orders the ladder.
- **Level** answers *how much have you shown up?* It never goes down. Losing
  still earns XP.

That asymmetry is what lets the home screen always have something moving forward,
even during a losing streak — and a product that only rewards winning punishes
exactly the players most likely to quit.

| System | Mechanic |
|---|---|
| **XP** | Participation 40 · outcome 60/30/15 · 2 per verified rep · grade bonus up to 50 · streak bonus capped at 5 wins · mode multiplier (ranked ×1, quick ×0.6, practice ×0.4) |
| **Levels** | 1–100. `120 + (level−1) × 40` XP to advance, capped at 1200 — roughly three matches per level at the top end |
| **Ranks** | Seven tiers, Bronze → Grandmaster, derived from rating and never stored |
| **Season progress** | Fixed 8-week seasons computed from a constant epoch. Season 4 begins the instant Season 3 ends whether or not anything ran at midnight |
| **Daily missions** | Three, rotating deterministically from the UTC date. Same set for everyone, same day |
| **Weekly missions** | Two, on the ISO week |
| **Rewards** | Mission XP paid automatically on completion. Achievement XP by rarity: 100 → 5,000 |
| **Titles** | Represented by achievements today; equippable titles are v2 |
| **Badges** | Rank emblems and rarity rings |
| **Streaks** | Win streak (resets on loss) and day streak (consecutive calendar days with a match). Both feed achievements |

**The reward stack is resolved server-side inside the settle transaction and sent
with the result**, rather than re-fetched by the client. The celebration therefore
cannot disagree with what was actually persisted.

---

## 13. Future Expansion

| Feature | Where it lands | What already exists |
|---|---|---|
| **Guilds / Teams** | Fourth leaderboard scope; a Guild page beside Friends | The friendship graph, the scoped leaderboard, presence |
| **Tournaments** | A Play mode and a bracket page | The `tournament` notification category, the podium, seasons |
| **Streaming / Spectator** | A route into the arena without a camera | `.glass` overlay language, `MomentumBar`, `PresenceService` already tracking `in-match` |
| **Marketplace** | Sibling of Achievements | Gold is already the reward colour and is used for nothing else; `RarityRing` covers item rarity |
| **AI Coach** | A Play mode; a deepening of the battle analysis panel | Neon Cyan reserved, `.btn--ai`, and `analyse()` as the seam where a model replaces a heuristic |
| **Wearables** | A settings group and new `Stat` tiles | `cue()` in `lib/feedback.ts` is where external haptics arrive |
| **Community** | A feed is deliberately *not* planned | Friends, presence and the ladder carry social weight without a timeline to moderate |
| **Esports** | Seasons, ELO, the rating ledger and anti-cheat all exist | What is missing is scheduling and broadcast, not design language |

---

## Page Design Rules

Every page in RepX has all of these. A page missing one is not finished.

| Requirement | Enforced how |
|---|---|
| **Hero section** | A `.head` strip with a title and one chip carrying the fact that mattered — or, on Home and Profile, a full hero panel |
| **Primary action** | Exactly one, and it is the largest, brightest element on the screen |
| **Statistics** | A `grid--stats` row of monospaced numbers, above the fold |
| **Progress** | A meter, an XP bar, or a mission — something moving forward |
| **Social element** | Friends, presence, the ladder, or an opponent |
| **Secondary actions** | Outline or ghost buttons only. Never two primaries |
| **Helpful content** | The one line that explains the thing it sits next to. Never an introductory paragraph |
| **Empty state** | Designed, with a CTA. Never "No data" |
| **Responsive layout** | Two chromes, five breakpoints, no horizontal overflow at any width |
| **Micro animations** | Entrance, hover, press, and one thing that counts or fills |
