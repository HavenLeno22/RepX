# Design System

> **Purpose:** The single source of truth for every visual decision in RepX.
> Every screen, component and animation follows this document.
> **Version:** 1.0.0
> **Status:** Authoritative
> **Last Updated:** 2026-08-02
>
> **Implemented in** `frontend/src/styles/global.css` (tokens and primitives) and
> `shared/src/constants/palette.ts` (colour, shared with the server).
> Companion documents: [`PRODUCT_EXPERIENCE.md`](PRODUCT_EXPERIENCE.md) for what
> each screen is *for*, [`MOTION_SYSTEM.md`](MOTION_SYSTEM.md) for how things
> move.

---

## 1. Brand Identity

**Mission.** Make getting stronger something people do because they want to win,
not because they should exercise.

**Vision.** Bodyweight fitness as a ranked, spectatable sport with a real ladder,
real seasons and a rating anyone can look up.

**Brand personality.** Sharp, honest, competitive, unsentimental. RepX is a
referee, not a cheerleader. It never congratulates you for opening the app, and
it never lies to you about a rep that did not count.

**Core emotions**, in the order the product should produce them: *anticipation*
before a match, *pressure* during it, *clarity* after it, *pull* to go again.

**Design philosophy.** Three rules, in priority order when they conflict:

1. **Legible before beautiful.** This product is used mid-set, at arm's length,
   glanced at sideways while your heart rate is at 170. If a decision trades
   legibility for elegance, legibility wins.
2. **Every element earns its place.** A screen is not an article and a card is
   not decoration. If a label, a number, a chip or an icon can carry it, it does
   not get to be a sentence.
3. **Never fake it.** No placeholder switches, no invented statistics, no
   "coming soon" dressed as a feature. A product that lies in small ways is not
   trusted in large ones — and this one is asking to be trusted with a rating.

**Visual language.** Near-black surfaces, one electric accent, heavy type, tight
tracking, monospaced numbers, geometric stroke icons, generous negative space
around the primary action and dense information everywhere else.

**Product identity.** A dark arena with one bright light on the thing you should
do next.

**Target audience.** Competitive people who exercise, not exercisers who might
compete. They have played a ranked ladder before — chess, Valorant, League — and
they will judge this one against those. Secondary: people who bounce off habit
apps because streaks alone are not a reason.

**Competitive positioning.** Strava tracks. Duolingo nags. Peloton instructs.
RepX *ranks*. The nearest reference point is Chess.com, not a fitness app — the
problem is the same one: showing a rating, a record and a rank constantly,
on a phone, without becoming a spreadsheet.

---

## 2. Color System

**The palette is locked.** It is defined once in
[`shared/src/constants/palette.ts`](../shared/src/constants/palette.ts) and
mirrored as CSS custom properties in `global.css`. Nothing in the application
writes a hex value. Adding a colour means adding a *semantic token*, not a
literal.

**RepX is dark-only.** This is a brand decision, not a missing feature. An arena
has the lights down; every lime-on-white pairing either fails contrast or stops
being Electric Lime. Accessibility is served instead by a high-contrast mode and
a reduced-motion mode, both of which are real settings that change real
behaviour. See [§12](#12-accessibility).

### Core tokens

| Role | Token | Value | Contrast on `--page` |
|---|---|---|---|
| Background | `--page` | `#09090B` | — |
| Surface | `--surface` | `#111217` | — |
| Cards | `--card` | `#1A1B22` | — |
| Card (raised) | `--card-2` | `#21232B` | — |
| Elevation 3 | `--e3` | `#282A34` | — |
| Borders | `--line` | `#2A2D36` | — |
| Borders (subtle) | `--line-soft` | `#1F2229` | — |
| Primary brand | `--brand` | `#B6FF3B` Electric Lime | 15.6:1 |
| Ink on brand | `--brand-ink` | `#09090B` | 15.6:1 on lime |
| Secondary brand | `--cyan` | `#33F3FF` Neon Cyan | 12.8:1 |
| Success | `--ok` | `#3DFF87` | 13.9:1 |
| Warning | `--warn` | `#FFD54A` | 13.3:1 |
| Danger | `--bad` | `#FF4D67` | 6.1:1 |
| Information | `--info` | = `--cyan` | 12.8:1 |
| Primary text | `--text` | `#FFFFFF` | 18.5:1 |
| Secondary text | `--text-2` | `#A7ADB8` | 8.1:1 |
| Muted text | `--text-3` | `#6F7580` | 4.6:1 |

### Rank colours

| Rank | Token | Value |
|---|---|---|
| Bronze | `--bronze` | `#B87333` |
| Silver | `--silver` | `#C7CDD8` |
| Gold | `--gold-rank` | `#FFD54A` |
| Platinum | `--platinum` | `#39D98A` |
| Diamond | `--diamond` | `#5CCDFF` |
| Master | `--master` | `#B84DFF` |
| Grandmaster | `--grandmaster` | `#FF3D81` |

Achievement rarity reuses this exact ladder. Diamond looks like Diamond whether
it is a ladder position or a trophy, so nobody learns two colour languages for
one idea.

### Semantic tokens

| Meaning | Token | Resolves to |
|---|---|---|
| You, in any competitive context | `--you` | `--brand` |
| Your opponent | `--them` | `--bad` |
| Victory | `--win` | `--ok` |
| Defeat | `--loss` | `--bad` |
| Draw | `--draw` | `#A7ADB8` |
| Reward / premium / victory | `--gold` | `#FFD54A` |
| Hover wash | `--hover` | `rgba(255,255,255,0.04)` |
| Press wash | `--press` | `rgba(255,255,255,0.05)` |
| Modal scrim | `--overlay` | `rgba(4,4,6,0.76)` |
| Camera scrim | `--scrim` | `rgba(9,9,11,0.6)` |

**Draw is grey on purpose.** A draw is the *absence* of a result; giving it a
fourth hue implies it is one.

### Usage rules

**Electric Lime is the RepX identity, and scarcity is what makes it work.**
Reserved for: the primary CTA, the player's own current rank, XP and progress,
selection state, live indicators, and the "this is you" marker. It is never a
decorative fill and never appears twice as a primary action on one screen. If
two things on a screen are lime, one of them is wrong.

**Neon Cyan is the machine.** AI, analytics, performance graphs, data
visualisation and informational states. The AI-analysis panel on a battle card,
the exercise-range radar, and the "AI ready" chip are cyan; nothing a player
*does* is.

**Danger Red only appears for**: errors, demotions, destructive actions,
warnings, and the opponent. The overlap between "opponent" and "danger" is
intentional — an opponent pulling ahead *is* the threat state.

**Gold represents**: rewards, achievements, victory, premium. Never a control.

**Never assign a colour without a meaning.** A player should be able to read a
screen they have never seen because the colours already told them what each
element is.

### Opacity rules

Arbitrary alpha is how a locked palette quietly becomes forty colours. Only these
steps are permitted, exposed as `ALPHA` in `palette.ts` and as `-wash` / `-veil`
/ `-edge` / `-glow` token suffixes:

| Step | Alpha | Use |
|---|---|---|
| `wash` | 0.12 | A colour behind text of the same colour (chips, badges) |
| `veil` | 0.20 | A colour behind a large surface (rank banner, hero bloom) |
| `edge` | 0.35 | A colour as a border on a dark surface |
| `glow` | 0.45 | A colour as a shadow |

Disabled elements use `opacity: 0.42` on the whole element, never a lightened
colour — a greyed-out lime is a new colour.

### Gradient rules

Gradients are **tints of one hue**, never blends of two brand colours. Permitted:

- A rank colour at 20%→0% across a hero or banner.
- `#86D321 → #B6FF3B` inside the XP bar (one hue, two values).
- A vertical black scrim over the camera feed.

Forbidden: lime→cyan, any rainbow, any gradient on text, any gradient on a
border.

### Glow rules

Glow is a `box-shadow` in a palette colour at the `glow` step. It marks exactly
three things: the Play button, a rank emblem, and an unlocked achievement.
Everything else uses a neutral shadow. Glow on an ordinary card is how a design
system starts looking cheap.

---

## 3. Typography

**One family: Inter.** Variable weights 400–900. It holds up at 10px in a caption
and at 60px in a display, its numerals are unambiguous, and it does not have a
personality that competes with the content.

**One monospace: JetBrains Mono**, for every number. Rep counts, ratings, timers
and leaderboard positions are all `font-variant-numeric: tabular-nums`, so a
changing digit never reflows the layout — which matters enormously when the count
updates mid-set and you are reading it out of the corner of your eye.

| Style | Class | Size | Weight | Tracking | Line height |
|---|---|---|---|---|---|
| Display XL | `.t-dxl` | `clamp(38, 7vw, 60)` | 900 | −2.4px | 1.02 |
| Display Large | `.t-dlg` | `clamp(30, 5vw, 42)` | 900 | −1.6px | 1.06 |
| Heading 1 | `.t-h1` | 28px | 800 | −1.0px | 1.14 |
| Heading 2 | `.t-h2` | 22px | 800 | −0.6px | 1.20 |
| Heading 3 | `.t-h3` | 18px | 700 | −0.3px | 1.30 |
| Heading 4 | `.t-h4` | 15.5px | 700 | −0.1px | 1.35 |
| Body Large | `.t-body-lg` | 16px | 400 | 0 | 1.55 |
| Body | `.t-body` | 14.5px | 400 | 0 | 1.55 |
| Small | `.t-sm` | 13px | 600 | 0 | 1.50 |
| Caption | `.t-caption` | 11.5px | 800 | +0.8px, uppercase | 1.30 |
| Button text | `.btn` | 14.5px | 700 | 0 | 1 |
| Statistics | `.stat__v` | 24px | 800 mono | −1.0px | 1.10 |
| Leaderboard numbers | `.num-board` | 15px | 800 mono | −0.04em | 1 |
| Hero numbers | `.num-hero` | `clamp(40, 8vw, 56)` | 800 mono | −0.04em | 1 |
| Ratings (in-line) | `.num` | inherited | 800 mono | −0.04em | 1 |

**Display sizes carry heavy negative tracking** because at 40px+ Inter's default
spacing reads editorial rather than athletic.

**Caption is the floor.** 11.5px is legible only because it is 800-weight,
uppercase and widely tracked. Nothing below it exists, and `--text-3` is never
used below 13px.

---

## 4. Spacing System

An 8px system with 4 and 12 as the half-steps that dense competitive UI needs.

| Token | Value | Typical use |
|---|---|---|
| `--s1` | 4px | Icon-to-label inside a chip |
| `--s2` | 8px | Related elements in a row |
| `--s3` | 12px | Card internal gaps, list row gaps |
| `--s4` | 16px | Panel body padding, gap between cards |
| `--s5` | 20px | Section internal padding |
| `--s6` | 24px | Page gutter (desktop), hero padding |
| `--s8` | 32px | Gap between unrelated groups |
| `--s10` | 40px | Empty-state vertical padding |
| `--s12` | 48px | Onboarding column gap |
| `--s16` | 64px | Sign-in column gap |
| `--s20` | 80px | Page bottom padding |
| `--s24` | 96px | Reserved |
| `--s32` | 128px | Reserved |

Never use a raw pixel value where a token exists. A one-off `padding: 18px` is
how eight screens end up with eight different button paddings.

---

## 5. Border Radius

| Element | Token | Value |
|---|---|---|
| Badges, tier chips | `--r-badge` | 4px |
| Inputs, small controls | `--r-input` | 10px |
| Buttons | `--r-btn` | 12px |
| Images, camera preview | `--r-image` | 12px |
| Cards, panels | `--r-card` | 16px |
| Dialogs, modals | `--r-dialog` | 20px |
| Progress bars, XP bars | `--r-bar` | 999px |
| Profile pictures | `--r-avatar` | 999px |
| Chips, pills | `--r-full` | 999px |

Radius increases with surface size. A 20px radius on a 32px badge reads as a
mistake; a 4px radius on a modal reads as unfinished.

---

## 6. Shadows

| Level | Token | Value |
|---|---|---|
| Small | `--sh-sm` | `0 1px 2px rgba(0,0,0,.4)` |
| Medium | `--sh-md` | `0 4px 14px rgba(0,0,0,.4)` |
| Large | `--sh-lg` | `0 12px 32px rgba(0,0,0,.5)` |
| Floating | `--sh-float` | `0 20px 48px rgba(0,0,0,.6)` |
| Glow | `--sh-glow` | `0 0 24px var(--brand-glow)` |
| Focus | `--sh-focus` | `0 0 0 3px var(--brand-edge)` |
| Hover | — | one level up from rest + `translateY(-2px)` |
| Pressed | `--sh-pressed` | `inset 0 2px 6px rgba(0,0,0,.45)` |

On a near-black background a shadow alone is nearly invisible, so **elevation is
a pair**: surface colour and shadow move together. A card that lifts without
lightening reads as a sticker, not an object.

---

## 7. Elevation

| Level | Surface | Shadow | Contains |
|---|---|---|---|
| 0 | `--page` | none | The page itself |
| 1 | `--card` | `--sh-sm` | Panels, cards, list surfaces |
| 2 | `--card-2` | `--sh-md` | Insets inside a card: stats, missions, selected picks |
| 3 | `--e3` | `--sh-lg` | Hover state of level 2, tooltips |
| 4 | `--card` + `--line` border | `--sh-float` | Modals, toasts, the pinned "you" row |

Nothing goes above level 4. A stack deeper than that means the information
architecture is wrong, not that a fifth shadow is needed.

---

## 8. Iconography

**One family, hand-authored:** `frontend/src/components/Icon.tsx`. 24×24 grid,
1.75 stroke, round caps and joins, no fills, `currentColor` throughout.

**Emoji are banned.** They render as different artwork on every operating system,
carry their own colours (⚔️ puts a brown handle and grey blade next to Electric
Lime), cannot inherit `currentColor`, and sit on a baseline no two of them agree
on. A navigation rail built from them cannot look intentional on any device you
did not personally test.

### Sizes

| Size | Value | Use |
|---|---|---|
| Small | 16px | Inside chips, list-row metadata, inline with `.t-sm` |
| Medium | 20px | Buttons, navigation, panel headers |
| Large | 24px | Empty states, section leads |
| Hero | 32–40px | Onboarding, result screens, ceremonies |

### Rules

- An icon never appears alone as a control unless it also carries an
  `aria-label` **and** a tooltip.
- Icons are decorative to a screen reader by default (`aria-hidden`), because
  they always accompany a label. Passing `aria-label` overrides this.
- Never scale an icon between the four sizes. A 22px icon is a mistake.
- Stroke weight goes to 2.0–2.4 only on the brand mark and the Play button, where
  the icon sits on a saturated fill and 1.75 disappears.
- Exercise icons come from `exerciseIcon(slug)`, not from the server's `icon`
  field — which is still an emoji and is no longer rendered.

---

## 9. Motion System

Summarised here; the full specification, including tokens, physics, gesture and
haptic rules, is [`MOTION_SYSTEM.md`](MOTION_SYSTEM.md).

**Philosophy: motion exists to explain what changed.** If an animation is not
telling the player where something came from, where it went, or that it landed,
it should not run.

**Durations** — `--t-instant` 90ms, `--t-fast` 160ms, `--t-base` 240ms,
`--t-slow` 420ms, `--t-ceremony` 900ms. Four plus a ceremony: more than that and
nobody can tell them apart.

**Easing** — `--ease` `cubic-bezier(.22,1,.36,1)` for almost everything;
`--ease-sharp` for exits; `--ease-spring` for anything that *lands*.

| Moment | Treatment |
|---|---|
| Hover | `translateY(-2px)` + one elevation level, 160ms |
| Button press | `scale(.97)`, 90ms |
| Card | Lift on hover, press on tap, border warms |
| Page transition | Fade + 8px lift, 190ms in / 120ms out, `mode="wait"` |
| Loading | Skeletons with a 1.4s shimmer. Never a bare spinner where a shape is known |
| Number counting | `CountUp`, 700–1100ms, ease-out-quart, counts *from current* not zero |
| Progress | Width transition 420ms; XP bar has a travelling sheen |
| XP | Bar fills, number counts, line items stagger in at 70ms |
| Rank promotion | Full-screen ceremony: emblem spring, expanding ring, 1.4s after the result |
| Achievement | Spring-scale card with a rarity-coloured glow, staggered at 160ms |
| Notification | Slide from the edge it lives on, spring, stack capped at 3 |
| Modal | Scale from 0.96 + 8px lift on a spring. Never from zero |

**Reduced motion collapses duration rather than removing animation**, so state
changes still *happen* — an element that was going to fade in still appears, it
simply arrives instantly. Purely decorative loops (the Play sheen, the pulse dot)
stop entirely.

---

## 10. Components

All primitives live as CSS classes in `global.css`; composed components live in
`frontend/src/components/`. They are classes rather than React components on
purpose: the previous build had them as inline style objects duplicated across
every page, which is how eight screens ended up with five definitions of "muted
text".

| Component | Implementation | Notes |
|---|---|---|
| Button | `.btn` + `--primary` `--ghost` `--outline` `--danger` `--ai` `--play`, sizes `--sm` `--lg` `--icon` `--block` | 44px minimum height on every variant |
| Card / Panel | `.panel`, `Panel` | `.panel--tap` adds lift; only applied to surfaces that navigate |
| Leaderboard row | `BoardRow` in `pages/Leaderboard.tsx` | Position, avatar+presence, record, streak, emblem, rating, peak |
| Player card | `Podium` in `pages/Leaderboard.tsx` | Top three only |
| Exercise card | `.pick` | Selectable; icon plate inverts to lime when selected |
| Statistic card | `.stat`, `Stat` | Monospaced value, uppercase caption, optional icon and colour |
| Achievement card | `Card` in `pages/Achievements.tsx` | Locked state is drained, not hidden; live progress ring |
| Input | `.input`, `.field`, `.field__label`, `.field__hint` | 16px font stops iOS zoom on focus |
| Dropdown | `select.input` | Native, deliberately — a custom listbox is an accessibility liability for one filter |
| Modal / Dialog | `.modal-scrim` + `.modal`, `DIALOG` variants | Dismissible by scrim, button and Escape |
| Navigation | `Rail`, `AppBar`, `TabBar` in `components/nav.tsx` | One destination list, five primary in both chromes |
| Sidebar | `.rail` | Primary group, divider, secondary group, user footer |
| Avatar | `Avatar` | Deterministic fallback from the seven rank colours; optional presence ring |
| Badge | `.chip` + tone modifiers | `--brand` `--ok` `--warn` `--bad` `--ai` `--gold` |
| Rank badge | `Tier`, `Emblem` | `Tier` is the inline chip; `Emblem` is the drawn crest, three sizes |
| Progress bar | `.meter`, `Meter` | Thin variant for inline use |
| XP bar | `.xpbar`, `XpBar` | Travelling sheen, leading-edge glow |
| Charts | `RatingChart`, `Radar` in `pages/Profile.tsx` | Hand-drawn SVG; one chart does not justify 40kB |
| Notification | `Toasts` + `pages/Notifications.tsx` | Priority and tone come from the category, not the caller |
| Tooltip | `.tip`, `Tip` | Opens on hover *and* focus |
| Tabs | `.tabs`, `.seg` | `.seg` for 2–4 exclusive options, `.tabs` for page content |
| Search | `.search` | Debounced 280ms |
| Empty states | `.empty`, `Empty` | Icon, four words, and the action that fills it |
| Loading skeleton | `.skeleton`, `SkeletonRows` | Must match the shape of what is coming |
| Grade badge | `GradeBadge` | S gold → D muted; never lime, because a grade is a verdict not an action |
| Rarity ring | `RarityRing` | Locked shows a padlock at 70% opacity |
| Error state | `ErrorState` | Friendly, specific, with a retry |

---

## 11. Responsive Design

| Breakpoint | Width | Layout |
|---|---|---|
| Ultra-wide | ≥1600px | `--content` widens to 1320px; the column stops growing rather than stretching |
| Desktop | 1181–1599px | Left rail, 1160px content cap, sidebar at 340px |
| Laptop | 901–1180px | Left rail, sidebar narrows to 300px before it wraps |
| Tablet | 421–900px | App bar + tab bar, single column, picks at 116px minimum |
| Mobile | ≤420px | Picks fixed at 2 columns, cards single column, toasts full width above the tab bar |

**The chrome switch happens in CSS, never in JavaScript.** No viewport measuring,
so the stylesheet and the component tree cannot drift apart.

**Grid system.** One `.grid` class with four modifiers — `--stats` (auto-fit
112px), `--picks` (auto-fill 144px), `--cards` (auto-fill 240px), `--split`
(1fr 1fr), `--sidebar` (1fr + 340px). All two-column layouts collapse to one at
900px.

**Container widths.** Content is capped at `--content`; forms at 680px; the
result screen at 520px; the searching panel at 480px. A form that spans 1160px
is unreadable regardless of how much room there is.

**Spacing scales down, not away.** Page gutters go `--s6` → `--s3` at 900px;
internal card padding does not change, because dense information is dense at
every size.

---

## 12. Accessibility

**Contrast.** Every text-on-surface pairing meets WCAG AA at its size. The
measured ratios are in [§2](#2-color-system). `--text-3` (4.6:1) is the floor and
is never used below 13px or for anything essential. All six semantic colours
exceed 6:1 on `--page`.

**Colour is never the only signal.** Every place colour carries meaning, a second
channel carries it too:

| Signal | Colour | Also |
|---|---|---|
| Win / loss | green / red | The words "Victory" / "Defeat", and a trophy / skull icon |
| You on the leaderboard | lime | A "YOU" label and a left border |
| Rank | seven hues | The rank name, always written out |
| Achievement rarity | six hues | The rarity name, always written out |
| Unread notification | lime dot | Grouped under "Today" with a relative timestamp |
| Presence | green / amber / lime | A text label in the row and on the avatar's `title` |

This is what makes the product usable with any form of colour blindness. The two
hardest pairings — Success `#3DFF87` against Warning `#FFD54A` for deuteranopia,
and Master `#B84DFF` against Grandmaster `#FF3D81` for protanopia — are separated
by 22 and 19 points of luminance respectively, and both always carry a label.

**Keyboard navigation.** Every interactive element is a real `<button>`,
`<a>`, `<input>` or `<select>`. No `div` with an `onClick`. Tab order follows
document order, which follows visual order. Modals close on Escape. The
achievement and battle expanders use `aria-expanded`. Segmented controls use
`aria-pressed`; tabs use `aria-selected`; switches use `role="switch"` with
`aria-checked`.

**Focus indicators.** One treatment everywhere: a 2px `--brand` outline at 2px
offset. Lime on near-black is the highest-contrast pairing in the palette, which
is exactly what a focus ring should be. `:focus-visible` only, so a mouse click
does not leave a ring behind.

**Minimum touch sizes.** 44×44px on every interactive element, enforced by
`min-height: 44px` on `.btn` and by the tab bar's height. Press feedback is
`scale(.97)` rather than a hover colour, because hover does not exist on the
device most players use.

**Motion.** `prefers-reduced-motion` is honoured automatically, and Settings
carries an explicit three-way control (System / Full / Reduced) that writes
`data-motion` on `<html>`. Reduced collapses durations to 0.01ms and stops
decorative loops entirely.

**Contrast mode.** `prefers-contrast: more` is honoured automatically, and
Settings carries a High Contrast switch that lifts every border and brightens the
secondary text ramp.

**Live regions.** The toast stack is `role="status" aria-live="polite"`, so a
promotion or an achievement is announced without stealing focus.

---

## 13. Design Principles

**Consistency.** One button, one card, one empty state, one focus ring, one
shadow scale. Every screen should look like it was made by the same person on the
same day. A new screen should be assemblable entirely from this document.

**Hierarchy.** Every screen has exactly one primary action, and it is always the
largest, brightest thing on it. If a screen has two, one of them is secondary and
has not been styled that way yet.

**Clarity.** No prose where a chip will do. The test applied throughout: if a
label, a number, a chip or an icon can carry it, it is not allowed to be a
sentence. Reading is something you do *before* you start exercising.

**Performance.** Only `transform` and `opacity` are animated. No layout
thrash, no animated `width` outside progress bars (where it is the point), no
`filter` on scroll. 60fps is a floor, not a target. See
[`PERFORMANCE.md`](PERFORMANCE.md).

**Accessibility.** Non-negotiable, and specified above rather than deferred.

**Responsiveness.** One codebase, two chromes, five breakpoints, no horizontal
scroll at any width. Wide content scrolls inside its own container.

**Athletic feeling.** Heavy weights, tight tracking, monospaced numbers, high
contrast, no rounded softness above 20px. Nothing in RepX should look gentle.

**Competitive feeling.** Rating, rank and record are visible from every screen.
Stakes are shown before you commit. Results are precise and unflattering.

**Premium quality.** The difference between good and expensive is entirely in the
things nobody asks for: the sheen on the Play button, the number that counts from
its current value rather than from zero, the sticky row that means you never
scroll past yourself, the skeleton that is exactly the height of what replaces
it.

---

## 14. UI Writing

**Voice.** Second person, present tense, active. Confident, never chirpy. RepX
tells you what happened and what to do next; it does not congratulate you for
existing.

**Button wording.** A verb and its object. Never "Submit", "OK", or "Continue"
where something specific is true.

| Instead of | Write |
|---|---|
| Submit | Save changes |
| Start | Find an opponent |
| OK | Continue |
| View all | All battles |
| Sign in | Enter the arena |
| Retry | Try again |

**Error messages.** Say what happened, whose fault it is, and what to do. Never
show a code, never blame the user, never say "unexpected".

> "Could not start your camera. Check the permission and try again."
> "Could not reach the server. Check your connection and try again."
> "That username is taken."

Error states get "This is on us, not you." underneath, and a retry button.

**Success messages.** Short and specific. "Profile saved." not "Your changes have
been saved successfully!"

**Notifications.** Title is the event; body is the consequence.

> **Promoted to Gold** — You crossed into Gold at 1204 rating.
> **Clean Sheet complete** — A match with every rep counted — +200 XP.

**Empty states.** Four words and an action. Never "No data".

| Screen | Title | Hint | Action |
|---|---|---|---|
| Battles | No battles yet | Your first one is 60 seconds away | Fight your first |
| Achievements | No trophies yet | Your first win earns one | Play ranked |
| Friends | No rivals yet | A ladder is more fun when you know who is above you | Browse the leaderboard |
| Notifications | Nothing yet | Promotions, trophies and missions land here | Go earn something |
| Leaderboard | Nobody has competed yet | Win a ranked match to claim the top spot | Play ranked |
| Rating chart | Not enough ranked matches | Two ranked results draw a curve | Play ranked |

**Tooltips.** One line, no full stop, only where the label genuinely cannot
explain itself.

**Numbers.** Always numerals, never words. Always with their unit or label.
Thousands separated. Ratings and reps never rounded.

---

## 15. Future Expansion

The system is built to absorb these without a redesign. Each entry names the
mechanism that already exists.

| Feature | What already carries it |
|---|---|
| **Tournaments** | `tournament` notification category with gold tone and a medal icon; the podium component generalises to a bracket's top three; `Season` gives the calendar frame |
| **Guilds / Clubs** | The friends graph (`Friendship`) generalises to membership; the leaderboard's `scope` parameter takes a fourth value without a new endpoint; rank emblems scale to guild crests |
| **Marketplace** | Gold is already the reward/premium colour and is used for nothing else; `.chip--gold` and `RarityRing` cover item rarity |
| **Streaming / Spectator** | The arena's `.glass` overlay language and `MomentumBar` are already designed to be read at a distance; `PresenceService` already knows who is `in-match` |
| **AI Coach** | Neon Cyan is reserved for it; `.btn--ai`, `.chip--ai` and the analysis panel on battle cards are the pattern; `analyse()` in `Battles.tsx` is the seam where a model replaces a heuristic |
| **Workout Builder** | `.pick` is already a selectable card grid; the exercise registry is the data source |
| **Wearables** | `Stat` and `Meter` cover any new metric; the `cue()` layer in `lib/feedback.ts` is where haptics from a watch would arrive |
| **Season Pass / Battle Pass** | `XpBar`, `Season` and the mission system are the whole mechanic; a pass is a second track over the same XP |
| **Coach Mode** | The `MaybeAuthedRequest` guard already supports viewing a profile you do not own; `Radar` and `RatingChart` are the review surface |
| **Esports** | Seasons, ELO, the rating ledger and anti-cheat exist; what is missing is scheduling, not design language |

**The rule for all of it:** a new feature may add a *semantic token*, never a new
hue. If it needs a colour, it needs a meaning, and if it needs a meaning that is
not in [§2](#2-color-system), that is a product conversation before it is a
design one.
