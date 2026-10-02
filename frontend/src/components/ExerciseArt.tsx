/**
 * Exercise pictograms.
 *
 * The product had no imagery at all — every exercise was represented by a
 * borrowed line icon, so "Pull-ups" was a trending-up arrow and "Sit-ups" was a
 * refresh symbol. Neither depicts a human being doing anything, which is a
 * strange gap in a product whose entire subject is a body in motion.
 *
 * These are drawn in the tradition of Olympic sport pictograms — Otl Aicher's
 * Munich '72 set and its descendants: a circle for the head, heavy rounded
 * strokes for the limbs, one figure caught at the most recognisable instant of
 * the movement. That vocabulary is chosen deliberately over illustration or
 * photography for three reasons:
 *
 *   1. It is the visual language of *competition signage*, which is exactly what
 *      RepX is. A photograph would say "fitness content"; a pictogram says
 *      "event".
 *   2. It inherits `currentColor`, so a figure is lime inside a selected card
 *      and muted inside a disabled one, with no second asset.
 *   3. It is geometry, not pixels — sharp at any size, no loading state, and it
 *      keeps working with the network off. That last point is a requirement
 *      rather than a nicety: RepX is used in gyms and garages.
 *
 * Every figure is drawn in the same 100×70 box against a common ground line at
 * y=62, so the set reads as one family and the athletes all stand on the same
 * floor.
 */

import type { CSSProperties } from 'react';

/**
 * The instant of each movement that a player recognises fastest.
 *
 * Push-up and plank are the pair most at risk of collapsing into the same
 * silhouette — both are a body held off the floor at a shallow angle. They are
 * separated the way they differ in life: the push-up rides *high* on a straight
 * vertical arm, the plank lies *low* on a forearm flat along the ground. Read at
 * card size, the height of the body is the tell.
 *
 * Anything that touches the floor in reality lands on the ground line at y=65
 * here. Anything airborne — the top of a burpee, a hanging pull-up — stops
 * visibly short of it, because a figure resting on a line it should be clear of
 * is the detail that makes a set of pictograms look approximate.
 */
const FIGURES: Record<string, JSX.Element> = {
  /* Top of the rep, riding high on a straight arm. */
  'push-up': (
    <>
      <circle cx="19" cy="23" r="7.5" />
      <path d="M26 27 L70 39 L93 62" />
      <path d="M30 29 L27 45 L33 63" />
    </>
  ),

  /* Thighs parallel, arms counterweighted forward. */
  squat: (
    <>
      <circle cx="45" cy="13" r="7.5" />
      <path d="M45 21 L40 38" />
      <path d="M40 38 L68 40 L65 63" />
      <path d="M44 25 L73 22" />
    </>
  ),

  /* Chin at the bar, feet hanging clear of the floor. */
  'pull-up': (
    <>
      <path d="M16 8 L84 8" />
      <path d="M38 11 L43 24" />
      <path d="M62 11 L57 24" />
      <circle cx="50" cy="29" r="7.5" />
      <path d="M50 37 L50 46" />
      <path d="M50 46 L43 57" />
      <path d="M50 46 L58 57" />
    </>
  ),

  /* Top of the curl — torso up, knees bent, hand at the temple. */
  'sit-up': (
    <>
      <circle cx="31" cy="24" r="7.5" />
      <path d="M36 30 L56 44" />
      <path d="M56 44 L77 35 L81 63" />
      <path d="M37 31 L27 18" />
    </>
  ),

  /* Full extension — the X, which is the whole point of the movement. */
  'jumping-jack': (
    <>
      <circle cx="50" cy="15" r="7.5" />
      <path d="M50 23 L50 42" />
      <path d="M50 27 L26 12" />
      <path d="M50 27 L74 12" />
      <path d="M50 42 L31 63" />
      <path d="M50 42 L69 63" />
    </>
  ),

  /* The jump at the top: arms overhead, feet tucked clear of the floor. */
  burpee: (
    <>
      <circle cx="50" cy="21" r="7.5" />
      <path d="M50 29 L50 42" />
      <path d="M50 31 L36 11" />
      <path d="M50 31 L64 11" />
      <path d="M50 42 L37 50 L43 56" />
      <path d="M50 42 L63 50 L57 56" />
    </>
  ),

  /* Held, not repeated — lying low on a forearm flat along the floor. */
  plank: (
    <>
      <circle cx="16" cy="38" r="7.5" />
      <path d="M23 42 L64 52 L93 63" />
      <path d="M26 44 L22 63 L47 63" />
    </>
  ),
};

/** Anything unmapped gets a neutral standing figure rather than an empty box. */
const FALLBACK = (
  <>
    <circle cx="50" cy="16" r="7.5" />
    <path d="M50 24 L50 44" />
    <path d="M50 29 L34 38" />
    <path d="M50 29 L66 38" />
    <path d="M50 44 L41 61" />
    <path d="M50 44 L59 61" />
  </>
);

export function ExerciseArt({
  slug,
  size = 96,
  ground = true,
  style,
}: {
  slug: string;
  /** Width in px. Height follows the 100:70 box. */
  size?: number;
  /** The floor the athlete stands on. Dropped when the figure sits inline. */
  ground?: boolean;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 100 70"
      width={size}
      height={size * 0.7}
      fill="none"
      stroke="currentColor"
      strokeWidth={7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={style}
    >
      {/* The ground line is deliberately thinner and dimmer than the athlete:
          it is the floor of the arena, not part of the body. */}
      {ground && (
        <path
          d="M6 65 L94 65"
          strokeWidth={3}
          opacity={0.28}
        />
      )}
      {FIGURES[slug] ?? FALLBACK}
    </svg>
  );
}
