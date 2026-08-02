/**
 * Motion tokens — the JavaScript half of docs/MOTION_SYSTEM.md.
 *
 * These mirror the `--t-*` and `--ease-*` custom properties in `global.css`
 * exactly. Framer Motion cannot read CSS variables for durations, so the values
 * live in both places; keeping them in one exported object at least means the
 * duplication is one file rather than sixty inline literals.
 *
 * The philosophy in one line: **motion exists to explain what changed.** If an
 * animation is not telling the player where something came from, where it went,
 * or that it landed, it should not run.
 */

import type { Transition, Variants } from 'framer-motion';

export const DURATION = {
  instant: 0.09,
  fast: 0.16,
  base: 0.24,
  slow: 0.42,
  ceremony: 0.9,
} as const;

export const EASE = {
  /** The workhorse: fast out of the gate, long settle. */
  standard: [0.22, 1, 0.36, 1],
  /** Exits — get out of the way. */
  sharp: [0.4, 0, 1, 1],
  /** Anything that *lands*: a number changing, a badge arriving. */
  spring: [0.34, 1.56, 0.64, 1],
} as const;

/** The physical spring used wherever an element should feel like it has mass —
 *  rank badges, the momentum bar, result cards. */
export const SPRING: Transition = { type: 'spring', stiffness: 260, damping: 22, mass: 0.9 };
/** A tighter spring for small elements, which look sloppy on the softer one. */
export const SPRING_TIGHT: Transition = { type: 'spring', stiffness: 420, damping: 28 };

export const TRANSITION: Transition = { duration: DURATION.base, ease: EASE.standard };

/**
 * Page transition.
 *
 * Screens transition as *views*, not repaints: each route lifts and fades in
 * keyed on its path, the way a native stack pushes, rather than the document
 * swapping in place. Deliberately short — 190ms is under the threshold where
 * navigation starts to feel like it is being performed at you.
 */
export const PAGE: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.19, ease: EASE.standard } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12, ease: EASE.sharp } },
};

/** A section arriving on a screen. */
export const RISE: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE.standard } },
};

/**
 * Staggered lists.
 *
 * The per-child delay is capped in `Stagger` rather than here: a 60-row
 * leaderboard staggered at 30ms each takes 1.8 seconds to finish arriving, which
 * stops being elegant somewhere around row eight.
 */
export const STAGGER: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};

export const STAGGER_CHILD: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.standard } },
};

/** Modals and dialogs: scale from just under 1, never from 0 — scaling from
 *  zero reads as a cartoon, scaling from 0.96 reads as a surface arriving. */
export const DIALOG: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: SPRING },
  exit: { opacity: 0, scale: 0.98, y: 4, transition: { duration: DURATION.fast } },
};

/** Toasts enter from the side they live on and leave the same way. */
export const TOAST: Variants = {
  initial: { opacity: 0, x: 24, scale: 0.96 },
  animate: { opacity: 1, x: 0, scale: 1, transition: SPRING_TIGHT },
  exit: { opacity: 0, x: 24, scale: 0.96, transition: { duration: DURATION.fast } },
};
