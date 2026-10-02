/**
 * The official RepX palette. **Locked.**
 *
 * This file is the single source of truth for every colour in the product. The
 * CSS custom properties in `frontend/src/styles/global.css` mirror it exactly,
 * and anything that needs a colour in TypeScript (rank tiers, achievement
 * rarities, chart series) imports it from here rather than writing a hex.
 *
 * The rule that makes the palette worth locking: **every colour carries one
 * meaning, everywhere.** Lime is never decoration, cyan is never a success
 * state, red never appears on anything the player is supposed to want. A player
 * should be able to identify a RepX screenshot from the colours alone, and
 * should be able to read a screen they have never seen because the colours
 * already told them what each element is.
 *
 * See docs/DESIGN_SYSTEM.md § 2 for the usage rules this encodes.
 */

/* ------------------------------------------------------------- surfaces -- */

/**
 * The page itself. Near-black, never pure black — pure black next to a live
 * camera feed is harsh, and the arena is where players spend the most time.
 *
 * The surface ramp carries a deliberate blue-steel undertone rather than being
 * neutral grey. Neutral grey under a lime accent reads as office software; the
 * cool cast reads as floodlit metal, and it costs nothing to have.
 */
export const BACKGROUND = '#07080C';
/** Chrome and inset regions that sit behind cards. */
export const SURFACE = '#0E1016';
/** Every card, panel and raised container. */
export const CARD = '#15181F';
/** Hairlines, dividers, card outlines. */
export const BORDER = '#2B303C';

/* ---------------------------------------------------------------- brand -- */

/** Electric Lime — the RepX identity. Reserved: primary CTA, current rank, XP,
 *  progress, selection, live indicators. Scarcity is what makes it read as
 *  important, so it is never used as a decorative fill. */
export const PRIMARY = '#B6FF3B';
/** Neon Cyan — AI, analytics, data visualisation, informational states. */
export const SECONDARY = '#33F3FF';

/* ------------------------------------------------------------ semantics -- */

export const SUCCESS = '#3DFF87';
export const WARNING = '#FFD54A';
export const DANGER = '#FF4D67';
/** Information reuses Neon Cyan — informational and analytical are the same
 *  register, and splitting them would put two blues on screen at once. */
export const INFO = SECONDARY;

/* ----------------------------------------------------------------- text -- */

export const TEXT = '#FFFFFF';
export const TEXT_SECONDARY = '#A7ADB8';
export const TEXT_MUTED = '#6F7580';

/* ---------------------------------------------------------------- ranks -- */

/** Rank colours, ordered exactly as the ladder is. Consumed by `RANKS` in
 *  `ranks.ts` and by achievement rarity, which deliberately shares the ladder's
 *  visual language so "Diamond" means the same thing in both places. */
export const RANK_COLORS = {
  bronze: '#B87333',
  silver: '#C7CDD8',
  gold: '#FFD54A',
  platinum: '#39D98A',
  diamond: '#5CCEFF',
  master: '#B84DFF',
  grandmaster: '#FF3D81',
} as const;

export type RankColorKey = keyof typeof RANK_COLORS;

/* ------------------------------------------------------------ semantics -- */

/**
 * Competitor identity. Held across the momentum bar, avatar rings, the pose
 * skeleton and the result screen so the mapping is learned exactly once.
 *
 * You are lime — the same colour as your rank, your XP and your primary action,
 * because in a competitive product the player's own colour should be the brand.
 * The opponent is red, which is also the danger colour: an opponent pulling
 * ahead *is* the threat state, so the overlap is intentional rather than a
 * collision.
 */
export const YOU = PRIMARY;
export const THEM = DANGER;

export const WIN = SUCCESS;
export const LOSS = DANGER;
export const DRAW = TEXT_SECONDARY;

/* ------------------------------------------------------------- opacity -- */

/**
 * The only alpha values allowed. Arbitrary opacity is how a palette quietly
 * becomes forty colours, so tinting goes through these steps.
 *
 * - `wash` — a colour behind text of that same colour (chips, badges)
 * - `veil` — a colour behind a large surface (rank banner, hero glow)
 * - `edge` — a colour as a border against a dark surface
 * - `glow`  — a colour as a shadow
 */
export const ALPHA = {
  wash: 0.12,
  veil: 0.2,
  edge: 0.35,
  glow: 0.45,
  solid: 1,
} as const;

/** `alpha('#B6FF3B', ALPHA.wash)` → `rgba(182, 255, 59, 0.12)`. */
export function alpha(hex: string, a: number): string {
  const v = hex.replace('#', '');
  const n = parseInt(
    v.length === 3
      ? v
          .split('')
          .map((c) => c + c)
          .join('')
      : v,
    16,
  );
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
