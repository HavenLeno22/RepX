# Motion System

> **Purpose:** The official animation and interaction specification. Every
> animation in RepX follows this document.
> **Version:** 1.0.0
> **Status:** Authoritative
> **Last Updated:** 2026-08-02
>
> **Implemented in** `frontend/src/lib/motion.ts` (tokens and variants),
> `frontend/src/components/motion.tsx` (CountUp, Reveal, Stagger),
> `frontend/src/lib/feedback.ts` (sound and haptic cues), and the transitions in
> `frontend/src/styles/global.css`.

---

## 1. Animation Philosophy

**Motion exists to explain what changed.**

If an animation is not telling the player where something came from, where it
went, or that it landed, it should not run. That single test resolves almost
every argument about whether something should move.

The corollary matters as much: **the absence of motion is also a decision**. An
element that appears with no transition is telling the player it was always there.
Sometimes that is exactly right.

RepX is used at a heart rate of 170, at arm's length, glanced at sideways. Motion
here is not decoration — it is the channel that carries information the player
cannot afford to read. A rep count that springs is felt peripherally; a rep count
that swaps has to be looked at.

---

## 2. Motion Principles

**Fast in, slow out.** Everything uses an ease with a quick start and a long
settle. An element that accelerates into place feels dropped; one that
decelerates feels placed.

**Nothing exceeds 420ms except a ceremony.** Above that, motion stops being
feedback and becomes a wait. The two exceptions — rank promotion and the podium —
are earned, once, at moments the player wants to last.

**Enter slower than you exit.** 190ms in, 120ms out. An exit that lingers is a
screen refusing to leave.

**One thing moves at a time.** If three elements animate simultaneously, none of
them communicated anything. Stagger, or pick one.

**Distance is small.** 8–12px of travel. Anything further reads as a slide
transition from a 2011 mobile framework.

**Never animate layout.** Only `transform` and `opacity`. The two exceptions —
progress-bar `width` and accordion `height` — are where the changing dimension
*is* the information.

**Interruptible.** Every animation can be overridden mid-flight by the next state.
A player who taps twice must never wait for the first tap's animation.

---

## 3. Animation Timing

| Token | Value | Use |
|---|---|---|
| `--t-instant` / `DURATION.instant` | 90ms | Press states, taps |
| `--t-fast` / `DURATION.fast` | 160ms | Hover, colour, small state changes |
| `--t-base` / `DURATION.base` | 240ms | The default. Card entrances, expands |
| `--t-slow` / `DURATION.slow` | 420ms | Progress fills, section reveals |
| `--t-ceremony` / `DURATION.ceremony` | 900ms | Promotion, podium, hero counters |

Four durations plus a ceremony. More than that and nobody can tell them apart;
fewer and a tooltip animates at the speed of a page.

---

## 4. Animation Curves

| Token | Value | Use |
|---|---|---|
| `--ease` / `EASE.standard` | `cubic-bezier(.22, 1, .36, 1)` | Almost everything |
| `--ease-sharp` / `EASE.sharp` | `cubic-bezier(.4, 0, 1, 1)` | Exits — get out of the way |
| `--ease-spring` / `EASE.spring` | `cubic-bezier(.34, 1.56, .64, 1)` | Anything that *lands* |

---

## 5. Animation Tokens

Physics, for anything that should feel like it has mass:

```ts
SPRING        = { type: 'spring', stiffness: 260, damping: 22, mass: 0.9 }
SPRING_TIGHT  = { type: 'spring', stiffness: 420, damping: 28 }
```

`SPRING` is for rank badges, result cards, modals and the momentum bar.
`SPRING_TIGHT` is for small elements — toasts, chips, the countdown digit — which
look sloppy on the softer one.

Named variants, all exported from `lib/motion.ts`: `PAGE`, `RISE`, `STAGGER`,
`STAGGER_CHILD`, `DIALOG`, `TOAST`.

---

## 6. Interaction Rules

**Every interaction acknowledges itself within 90ms.** No exceptions. On touch
there is no hover to confirm the target was hit, so a press that produces nothing
for 200ms reads as a missed tap and gets tapped again.

**Feedback is proportional to consequence.** A filter chip gets a colour change. A
match result gets a two-and-a-half-second sequence. A rank promotion takes over
the screen.

**Nothing celebrates twice.** If the result screen has already shown an
achievement, the toast for it is suppressed.

---

## 7. Accessibility Rules

**Reduced motion collapses duration; it does not remove animation.** State
changes still *happen* — an element that was going to fade in still appears, it
simply arrives instantly. Removing the animation entirely would mean removing the
state change with it in several places.

Purely decorative loops with no state behind them stop entirely: the Play
button's sheen, the XP bar's sheen, the pulse dot, and the skeleton shimmer.

Three sources, all honoured:

1. `@media (prefers-reduced-motion: reduce)` — the OS.
2. `:root[data-motion="reduced"]` — the in-app preference, which can override the
   OS in *either* direction.
3. `useReduced()` inside `components/motion.tsx`, so JS-driven animation
   (CountUp, Reveal, Stagger) lands on its final value immediately rather than
   animating at 1ms and flickering.

Settings offers System / Full / Reduced. "Full" does not defeat the OS media
query; it only stops the app adding a reduction the player did not ask for.

---

## 8. Reduced Motion Support

| Animation | Reduced behaviour |
|---|---|
| Page transition | Instant swap |
| CountUp | Renders the final number |
| Reveal / Stagger | Renders in place, visible |
| Progress and XP bars | Jump to final width |
| Confetti | Not rendered |
| Promotion ceremony | Still shown; emblem and text appear without spring |
| Play button sheen | Off |
| Pulse dot | Off (colour alone carries "live", plus the label) |
| Skeleton shimmer | Static block |

---

## 9. Loading States

**Never a blank screen. Never a bare spinner where a shape is known.**

- **Skeletons** for anything with a known shape, with a 1.4s linear shimmer
  across a 400% gradient. The skeleton must be the *height of what replaces it* —
  a skeleton of the wrong height is worse than a spinner, because the layout
  still jumps and you promised it would not.
- **Progressive loading.** The home screen renders its hero from already-loaded
  user state while battles, friends, the ladder and the live count arrive
  independently. Nothing waits on everything.
- **Staggered skeleton opacity** (`1 - i × 0.09`) so a list of placeholders fades
  toward the fold rather than presenting a wall of identical grey.
- **The one permitted spinner** is the app's initial auth check, where there is
  genuinely no known shape — we do not yet know whether this person has an
  account. It is lime, 26px, centred.
- **In-button spinners** replace the label, never sit beside it, so the button
  does not change width mid-press.

---

## 10. Success States

Celebratory, premium, rewarding — and proportional.

| Moment | Motion |
|---|---|
| Setting saved | An `alert--ok` fades in. Nothing more |
| Mission complete | Toast, `SPRING_TIGHT`, brand tone |
| Rep counted | The count springs at `stiffness: 400, damping: 18` |
| Achievement unlocked | Card scales in on `SPRING` with a rarity-coloured glow, staggered 160ms apart |
| Level up | XP bar fills, then the level number swaps with a `▲ from N` marker |
| Victory | Icon springs in from `scale .4, rotate −14°`; title lifts; 24 confetti pieces in **brand, gold and success only** |
| Rank promotion | Full-screen ceremony — see §14 |

**Confetti is palette-only.** A rainbow burst would put eight meaningless colours
on screen in a product where every colour means something. Twenty-four pieces,
once, on a win, never on a defeat.

---

## 11. Error States

**Errors do not shake, flash, or buzz aggressively.** A player who has just lost
their camera permission is already frustrated.

| Moment | Motion |
|---|---|
| Form validation | The alert fades in above the field, 160ms. No shake |
| Request failure | `ErrorState` — icon scales in at 0.9→1, message, retry button |
| Rep rejected | Coaching pill cross-fades in `glass--bad` with an 8px lift, `AnimatePresence mode="wait"` |
| Camera unavailable | Overlay fades in; icon and message are static |
| Defeat | Same layout, same timing, same care as victory. Only the colour and the closing line change. No confetti |

**A defeat is not a punishment.** It gets the full XP breakdown and a specific,
actionable line about what to fix — because the player who just lost is the one
who most needs a reason to press Play again.

---

## 12. Gesture Rules

- **Press:** `scale(.97)` at 90ms on every button; `scale(.975)` on selectable
  cards; `scale(.93)` on the raised Play tab, which is larger and needs more
  travel to read.
- **Tap targets** are 44×44px minimum, enforced by `min-height` on `.btn` and by
  the tab bar's height.
- **No swipe navigation.** The arena is a fixed full-bleed surface and a stray
  horizontal swipe mid-set must never change screens.
- **No pull-to-refresh.** `overscroll-behavior-y: none` — the page must not
  rubber-band like a document.
- **No long-press menus.** Every action has a visible control.

---

## 13. Hover, Focus and Transition Rules

**Hover** (pointer devices only; hover styles are never the sole affordance):

| Element | Hover |
|---|---|
| Button (primary) | Glow expands. The colour does not change — the colour is already the answer |
| Button (outline) | Background wash + border brightens to `--text-3` |
| Card (`.panel--tap`) | `translateY(-2px)`, elevation +1, border warms |
| List row | `--hover` wash, 160ms |
| Rail link | `--hover` wash + text to full white |
| Panel link | Text to `--brand` |

**Focus.** One treatment, everywhere: 2px `--brand` outline at 2px offset,
`:focus-visible` only. Lime on near-black is the highest-contrast pairing in the
palette, which is exactly what a focus ring should be. Tooltips open on focus as
well as hover.

**Page transitions.** `PAGE` variants under `AnimatePresence mode="wait"`, keyed
on pathname: 8px lift and fade in at 190ms, 4px lift and fade out at 120ms.
`mode="wait"` matters — overlapping a 190ms exit with a 190ms enter produces a
visible cross-dissolve, which reads as a web page and not an app.

---

## 14. Component Motion Specifications

### Buttons

Never change instantly. Every primary button has all six states:

| State | Treatment |
|---|---|
| Rest | — |
| Hover | Glow expands, 160ms |
| Pressed | `scale(.97)`, 90ms |
| Loading | Spinner **replaces** the label so the width does not change |
| Success | The surrounding state changes; the button does not flash green |
| Disabled | `opacity: .42`, `cursor: not-allowed`. No transform on press |
| Focus | `--sh-focus` ring |

**The Play Ranked button is the most important control in the product** and is the
only element permitted its treatment: a resting sheen sweeps across it every 4.5
seconds — enough to read as alive in peripheral vision, slow enough never to nag —
and on hover the glow expands rather than the colour changing.

### Cards

Hover lift, shadow transition, border warming, press scale, and a selection state
that inverts the icon plate to lime. `.panel--tap` is only ever applied to a card
that actually navigates: a card that lifts but does nothing is a lie the interface
tells about itself.

### XP

The bar fills over 850ms on `EASE.standard` with a travelling highlight and a
leading-edge glow, so a gain reads as *arriving* rather than as a value being
redrawn. The number counts. Line items stagger in at 70ms each, so the reward can
be audited rather than taken on faith — players trust a number they can add up
themselves.

### Rank promotion

Fires **1.4 seconds after the result lands**, so it interrupts the rewards rather
than competing with the verdict.

1. Scrim fades in with a 10px backdrop blur.
2. Modal springs from `scale .9, y +20`.
3. Rank emblem springs from `scale .3, rotate −22°`.
4. A single ring in the rank colour expands from `scale .2` to `3.4` over 1.3s
   and fades — the "burst" without particles, which reads as expensive rather
   than as a party.
5. Text lifts in at +350ms; the tier meter fills to 100%.
6. `cue('promotion')` fires haptics and (when the pack ships) sound.

Dismissible immediately by scrim, button, or Escape. A celebration that traps you
stops being one on the second viewing.

### Leaderboard

Podium plinths grow from zero height, staggered 90ms, over 600ms. Ratings count
up over 1100ms. Rows stagger in at 35ms, **capped at row 12** — a 100-row board
at 35ms each takes three and a half seconds to finish arriving, at which point
the animation has stopped being polish and started being a wait. The pinned "you"
row springs up from +60px.

### Statistics and charts

Every number uses `CountUp`, which **counts from its current value, not from
zero** — a rating going 1480 → 1504 animates across 24 points rather than
sweeping up from nothing, which is both faster to read and true to what happened.
It uses `requestAnimationFrame` with ease-out-quart, so the DOM node receives
plain text and stays selectable and screen-reader-readable mid-animation.

The rating chart draws its path left to right over 1.1s (`pathLength` 0→1) with
the area fading in behind it. The radar scales from 0.4 with its origin at the
centre.

### Match results

See §10 and §11. The full sequence is ~2.5 seconds: verdict (0–350ms) →
scoreline → rating (500ms) → rewards panel (750ms) → XP line items (900ms+) →
achievements (1300ms+) → promotion ceremony (1400ms). Long enough to feel like a
ceremony, short enough that pressing Play again never has to wait for it.

### Achievements

Unlock animation: rarity-coloured glow, `SPRING` scale-in, staggered 160ms.
Locked cards are drained rather than hidden — 70% opacity, a padlock in place of
the icon, and a live progress ring.

### Notifications

Enter from the edge they live on (`x: +24`) on `SPRING_TIGHT`, exit the same way
at 160ms. `layout` animation reflows the stack when one is dismissed. Stack capped
at three — beyond that a stack stops being a set of messages and becomes a wall,
and the fourth one is the one nobody reads. Oldest falls off the top rather than
the newest being dropped: the most recent thing that happened is always on screen.

Motion hierarchy by category: promotion and achievement interrupt (priority 2),
mission / challenge / tournament / season / demotion toast (priority 1), system
waits quietly in the notification centre (priority 0).

### Micro-interactions

Every one of these has a specified transition: switch knob (`SPRING`-eased
translate + background), checkbox, `select` (native), toggle, slider, tab
underline (2px lime bar), input focus ring, modal, tooltip (opacity + 2px lift),
search (280ms debounce, no spinner), filter (`aria-pressed` background swap),
accordion (`height: auto` at 300ms), and the countdown digit (`SPRING` per digit —
it is the moment the match becomes real, and a number that simply swaps reads as
a clock rather than as a start).

---

## 15. Sound

**Not implemented — deliberately addressable.**

`assets/sound/` is empty and there is no audio in the bundle. What exists is
`lib/feedback.ts`, where **every moment in the product that deserves feedback
already calls `cue()`**. Shipping sound later is adding files to one map, not
hunting through forty components for the places a click happens.

That ordering matters. Retrofitting feedback into a finished interface is how you
end up with sound on the three buttons someone remembered and silence on the rest.

The cue catalogue: `tap`, `select`, `toggle`, `nav`, `countdown`, `match-found`,
`rep`, `rep-rejected`, `victory`, `defeat`, `xp`, `level-up`, `promotion`,
`demotion`, `achievement`, `mission-complete`, `notification`, `error`.

**Sound is off by default.** A fitness app is frequently opened somewhere sound
would be unwelcome, and an unrequested noise on first launch is the fastest way to
be closed and never reopened. The switch is live in Settings today.

---

## 16. Haptics

Same architecture, and working today on Android Chrome. iOS Safari ignores
`navigator.vibrate`, so the calls are harmless no-ops there until the app is
wrapped natively.

| Strength | Pattern (ms) | Fired by |
|---|---|---|
| Light | `8` | Taps, selections, navigation, rep counted |
| Medium | `16` | Countdown ticks, defeat |
| Heavy | `28` | Match found |
| Success | `12, 40, 20` | Victory, level up, promotion, achievement, mission |
| Warning | `18, 60, 18` | Rep rejected, demotion |
| Error | `26, 50, 26, 50, 26` | Failures — distinguishable without looking at the screen |

Haptics are **on** by default and switchable in Settings.

---

## 17. Performance

**Animations must never cost frames.** Smoothness beats complexity, always.

- Only `transform` and `opacity` are animated. The two exceptions are progress
  `width` and accordion `height`, both of which are the information.
- No `filter` or `backdrop-filter` transitions. Blur is set once and left alone.
- `AnimatePresence mode="wait"` means only one page tree is mounted at a time.
- Staggers are capped so a long list does not schedule 100 delayed animations.
- `useInView({ once: true })` on every reveal — an element that re-animates each
  time it scrolls past is the difference between a page that feels alive and one
  that feels like it is fidgeting.
- `CountUp` cancels its `requestAnimationFrame` on unmount and on value change.
- The confetti burst is 24 absolutely-positioned spans on `transform` only, and
  runs once.

**Target: 60fps minimum**, including on a mid-range Android running pose
estimation at the same time — which is the actual worst case, and why the arena's
motion budget is deliberately the smallest in the product.

---

## 18. The Standard

If Apple were reviewing this for a Design Award, the question would not be
*"is there enough motion?"* — it would be *"does any of it exist for its own
sake?"*

Every animation in this document names the thing it communicates. Anything that
cannot is not in the product.
