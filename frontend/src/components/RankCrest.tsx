/**
 * The rank crest.
 *
 * In a ranked game the tier badge is the single most-looked-at object in the
 * product: it is the thing a player is working toward, the thing they screenshot,
 * and the thing that has to feel earned. RepX was drawing it as a rounded square
 * with a borrowed line icon inside — the same treatment as a settings row.
 *
 * This is heraldry instead: a struck shield, tinted by tier, lit from above like
 * every other object in the arena. The escalation is structural rather than
 * decorative, so the shape of the crest tells you where someone stands before
 * the colour or the label does:
 *
 *   Bronze · Silver · Gold      the plain shield
 *   Platinum · Diamond          + wings
 *   Master · Grandmaster        + wings + crown
 *
 * That is the same logic real rank ladders use — a Grandmaster crest should be
 * visibly *more object* than a Bronze one, not merely a different hue, because
 * hue alone is invisible to a good fraction of players.
 *
 * Drawn rather than illustrated, for the reason the codebase already gives for
 * the emblem it replaces: seven painted crests would be seven assets to
 * commission and seven things to redraw the day an eighth tier is added, while a
 * tinted plate scales to any tier for free and stays sharp at every size.
 */

import { useId } from 'react';
import { rankForRating, rankIndex } from '@repx/shared';
import { Icon, type IconName } from './Icon';

/* The shield, and the two flourishes that escalate it. One coordinate system,
   so the pieces always register against each other. */
const SHIELD =
  'M60 18 L98 30 L98 70 C98 94 80 110 60 122 C40 110 22 94 22 70 L22 30 Z';
const SHIELD_INNER =
  'M60 27 L91 36 L91 69 C91 88 76 101 60 111 C44 101 29 88 29 69 L29 36 Z';
const WING_LEFT = 'M22 42 L4 34 L11 46 L0 51 L19 58 Z';
const WING_RIGHT = 'M98 42 L116 34 L109 46 L120 51 L101 58 Z';
const CROWN = 'M60 0 L68 10 L80 3 L77 16 L43 16 L40 3 L52 10 Z';

/** The glyph at the centre, escalating with the tier the same way the plate does. */
function glyphFor(rankId: string): IconName {
  if (rankId === 'grandmaster' || rankId === 'master') return 'crown';
  if (rankId === 'diamond') return 'gem';
  if (rankId === 'platinum') return 'shield';
  return 'medal';
}

const SIZES = { sm: 34, md: 54, lg: 92 } as const;

export function RankCrest({
  rating,
  size = 'md',
  glow = true,
}: {
  rating: number;
  size?: keyof typeof SIZES;
  glow?: boolean;
}) {
  const rank = rankForRating(rating);
  const tier = rankIndex(rating);
  const uid = useId().replace(/:/g, '');

  const width = SIZES[size];
  const wings = tier >= 3; // Platinum and above
  const crown = tier >= 5; // Master and above
  const color = rank.color;

  return (
    <span
      className="crest"
      style={{
        width,
        height: width * (128 / 120),
        // The tier's own colour becomes the light it throws. Kept off the small
        // size, where a glow on a 34px badge in a dense list is just noise.
        filter: glow && size !== 'sm' ? `drop-shadow(0 0 ${width * 0.16}px ${color}55)` : undefined,
      }}
      title={`${rank.name} · ${rating}`}
    >
      <svg viewBox="0 0 120 128" width="100%" height="100%" aria-hidden>
        <defs>
          {/* Struck metal: a hot top edge falling to a shaded base. Three stops,
              because two reads as a flat wash and four reads as plastic. */}
          <linearGradient id={`face-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="46%" stopColor={color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={color} stopOpacity="0.22" />
          </linearGradient>
          {/* The recessed face the glyph sits on — darker than the rim, so the
              rim reads as a raised border catching the key light. */}
          <linearGradient id={`inner-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.72" />
          </linearGradient>
        </defs>

        {wings && (
          <g fill={color} opacity="0.62">
            <path d={WING_LEFT} />
            <path d={WING_RIGHT} />
          </g>
        )}

        {crown && <path d={CROWN} fill={color} opacity="0.9" />}

        <path d={SHIELD} fill={`url(#face-${uid})`} />
        {/* The lit rim. Drawn as a stroke on the same path so it can never drift
            out of register with the fill. */}
        <path d={SHIELD} fill="none" stroke={color} strokeWidth="3" opacity="0.85" />
        <path d={SHIELD_INNER} fill={`url(#inner-${uid})`} />
        <path d={SHIELD_INNER} fill="none" stroke={color} strokeWidth="1.5" opacity="0.4" />
      </svg>

      {/* The glyph rides on top rather than inside the SVG, so it inherits the
          icon family's stroke spec instead of being a second drawing of it. */}
      <span className="crest__glyph" style={{ color }}>
        <Icon name={glyphFor(rank.id)} size={width * 0.3} strokeWidth={1.9} />
      </span>
    </span>
  );
}
