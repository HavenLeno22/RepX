# UI Guidelines

> **Purpose:** Practical, screen-level UI rules that implement
> [`docs/DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) consistently across the app.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Scope](#scope)
2. [Layout & Navigation](#layout--navigation)
3. [Match/HUD Screen Rules](#matchhud-screen-rules)
4. [Empty, Loading, and Error States](#empty-loading-and-error-states)
5. [Copy Guidelines](#copy-guidelines)
6. [Open Questions](#open-questions)

## Scope

Where [`docs/DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) defines tokens/components/
motion principles, this document defines how they're applied to specific
screens and states.

## Layout & Navigation

**Bottom tab bar on touch, left rail on desktop**, both rendering the same five
destinations from one list in `frontend/src/components/nav.tsx`. Play is the
raised middle tab.

Rules that apply to every screen:

- **Open with a `.head` strip**, not a heading-and-paragraph. Title on the left,
  and at most one chip on the right carrying the single most useful fact for
  that screen ("You're #4", "60s rounds").
- **Never introduce a screen.** If a screen needs explaining, the explanation
  belongs next to the control it describes.
- **Right-align every number**, in `--mono`, so columns of scores and ratings
  scan vertically and a changing digit never shifts the row.
- **The arena is the only full-bleed screen.** Everything else lives inside the
  content column with the chrome visible.

## Match/HUD Screen Rules

The in-match screen is the highest-stakes screen in the product: it must show
the camera feed, both rep counts, and time remaining without obscuring the
tracking area or demanding to be read.

- **Nothing sits in the middle third.** The player's body is there. Scores and
  clock live at the top, coaching and controls at the bottom, depth meter hard
  against the left edge.
- **Everything floating over the feed uses `.glass`** — one frosted pill style,
  tinted by severity, so overlay chrome never competes with the skeleton.
- **Colour carries the state**, so it can be read peripherally: green for
  accepted, amber for "the system cannot see you", red for a rejected rep.
- **The mirror is not optional.** Feed and skeleton are both `scaleX(-1)`;
  the player moves the way a mirror moves, not the way a video call does.
- **Coaching is one line, and it is about what to do next** — "So close, go a
  little deeper", not "rep rejected: insufficient range of motion".
- **Never say nothing.** Whenever a rep is not counting, the screen says why:
  the depth meter shows how far short the movement fell, and the status pill
  says whether the body is even in frame.

## Empty, Loading, and Error States

- **Empty**: `.empty` — icon, four-word title, one short line, and the action
  that resolves it. A player with no matches gets a "Find opponent" button, not
  an explanation of why the list is empty.
- **Loading**: `.skeleton` blocks in the shape of the content, so the layout
  holds still. Spinners only where the shape is genuinely unknown, and inside
  buttons for in-flight actions.
- **Blocked**: state it as a chip on the control it blocks ("Camera blocked" on
  the exercise panel header), not as an alert banner elsewhere on the page.
- **Errors**: `.alert--error` immediately above the thing that failed.

## Copy Guidelines

Competitive but encouraging, and above all **short**.

- Labels over sentences. `Ready`, not `Your camera is ready to go`.
- Second person, present tense, no hedging: "Go a little deeper".
- Never name internals in player-facing text. `Too fast to be a real rep`, not
  `minRepMs violation`.
- Numbers speak for themselves — `+24 / −18` needs no sentence around it.
- No exclamation marks. The scoreline supplies the drama.

## Open Questions

- Internationalization/localization requirements at launch.
