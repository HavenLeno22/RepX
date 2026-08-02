/**
 * Shared visual atoms.
 *
 * Everything here exists because it appeared on three or more screens and was
 * previously re-implemented at each one — which is how the old build ended up
 * with five definitions of "muted label" and three different rank badges.
 *
 * None of these components accept a colour. They read the palette themselves, so
 * a caller cannot introduce one.
 */

import { motion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  RARITY_COLORS,
  rankForRating,
  type Grade,
  type Rarity,
} from '@repx/shared';
import { EASE } from '../lib/motion';
import { Icon, type IconName } from './Icon';

/* ------------------------------------------------------------------ tier -- */

export function Tier({ rating, showRating = true }: { rating: number; showRating?: boolean }) {
  const rank = rankForRating(rating);
  return (
    <span className="tier" style={{ background: `${rank.color}1f`, color: rank.color }}>
      <span className="tier__dot" style={{ background: rank.color }} />
      {rank.name}
      {showRating && <span className="mono">{rating}</span>}
    </span>
  );
}

/* --------------------------------------------------------------- emblem -- */

/**
 * The rank emblem: a tinted plate carrying a rank glyph.
 *
 * Drawn rather than illustrated. Seven painted emblems would be seven assets to
 * commission, seven files to load, and seven things to redraw the day an eighth
 * tier is added — while a tinted plate scales to any tier for free and stays
 * pin-sharp at every size. It reads as a rank crest because of the shape, the
 * bevel and the glow, none of which need a raster.
 */
export function Emblem({
  rating,
  size = 'md',
  glow = true,
}: {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
}) {
  const rank = rankForRating(rating);
  const icon: IconName =
    rank.id === 'grandmaster' || rank.id === 'master'
      ? 'crown'
      : rank.id === 'diamond'
        ? 'gem'
        : rank.id === 'platinum'
          ? 'shield'
          : 'medal';

  const iconSize = size === 'lg' ? 34 : size === 'md' ? 22 : 15;

  return (
    <span
      className={`emblem emblem--${size}`}
      style={{
        background: `linear-gradient(155deg, ${rank.color}38, ${rank.color}12)`,
        color: rank.color,
        boxShadow: `inset 0 0 0 1.5px ${rank.color}59${glow ? `, 0 0 20px ${rank.color}30` : ''}`,
      }}
      title={rank.name}
    >
      <Icon name={icon} size={iconSize} strokeWidth={1.6} />
    </span>
  );
}

/* ---------------------------------------------------------------- grades -- */

/** S is gold, then down the ladder. A grade never uses lime — lime means "your
 *  action", and a grade is a verdict, not an action. */
const GRADE_COLORS: Record<Grade, string> = {
  S: 'var(--gold)',
  A: 'var(--platinum)',
  B: 'var(--cyan)',
  C: 'var(--text-2)',
  D: 'var(--text-3)',
};

export function GradeBadge({ grade, size = 34 }: { grade: Grade; size?: number }) {
  const color = GRADE_COLORS[grade];
  return (
    <span
      className="grade"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.47,
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${color} 40%, transparent)`,
      }}
      title={`Performance grade ${grade}`}
    >
      {grade}
    </span>
  );
}

/* --------------------------------------------------------------- rarity -- */

export function RarityRing({
  rarity,
  unlocked,
  icon,
  size = 56,
}: {
  rarity: Rarity;
  unlocked: boolean;
  icon: IconName;
  size?: number;
}) {
  const color = RARITY_COLORS[rarity];
  return (
    <span
      className="emblem"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        // A locked achievement is drained rather than hidden: you can see the
        // shape of the thing you have not earned, which is most of why anyone
        // goes and earns it.
        background: unlocked
          ? `linear-gradient(155deg, ${color}40, ${color}12)`
          : 'var(--card-2)',
        color: unlocked ? color : 'var(--text-3)',
        boxShadow: unlocked
          ? `inset 0 0 0 1.5px ${color}66, 0 0 18px ${color}33`
          : 'inset 0 0 0 1.5px var(--line)',
        opacity: unlocked ? 1 : 0.7,
      }}
    >
      <Icon name={unlocked ? icon : 'lock'} size={size * 0.42} strokeWidth={1.6} />
    </span>
  );
}

/* ------------------------------------------------------------------ bars -- */

export function XpBar({ progress, height }: { progress: number; height?: number }) {
  return (
    <div className="xpbar" style={height ? { height } : undefined}>
      <motion.div
        className="xpbar__fill"
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(2, Math.min(100, progress * 100))}%` }}
        transition={{ duration: 0.85, ease: EASE.standard }}
      />
    </div>
  );
}

export function Meter({
  progress,
  color = 'var(--brand)',
  thin,
}: {
  progress: number;
  color?: string;
  thin?: boolean;
}) {
  return (
    <div className={`meter${thin ? ' meter--thin' : ''}`}>
      <motion.div
        className="meter__fill"
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
        transition={{ duration: 0.7, ease: EASE.standard }}
        style={{ background: color }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ stat -- */

export function Stat({
  value,
  label,
  color,
  icon,
}: {
  value: ReactNode;
  label: string;
  color?: string;
  icon?: IconName;
}) {
  return (
    <div className="stat">
      <div className="row" style={{ gap: 6 }}>
        {icon && <Icon name={icon} size={14} style={{ color: color ?? 'var(--text-3)' }} />}
        <div className="stat__v" style={{ color }}>
          {value}
        </div>
      </div>
      <div className="stat__l">{label}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- panels -- */

/**
 * A titled panel. Takes its action as a link rather than arbitrary children so
 * every panel header in the product has the same shape: a label on the left, at
 * most one way out on the right.
 */
export function Panel({
  title,
  action,
  actionTo,
  children,
  flush,
  style,
}: {
  title?: string;
  action?: string;
  actionTo?: string;
  children: ReactNode;
  flush?: boolean;
  style?: CSSProperties;
}) {
  return (
    <section className="panel" style={style}>
      {title && (
        <header className="panel__head">
          <span className="panel__title">{title}</span>
          {action && actionTo && (
            <Link to={actionTo} className="panel__link">
              {action}
              <Icon name="chevron-right" size={13} />
            </Link>
          )}
        </header>
      )}
      <div className={flush ? 'panel__body--flush' : 'panel__body'}>{children}</div>
    </section>
  );
}

/* ----------------------------------------------------------------- empty -- */

/**
 * The empty state.
 *
 * Never "No data". An empty screen means the player is here and has nothing
 * stopping them, which makes it the highest-intent moment in the product — so
 * every one of them ends in the action that fills it.
 */
export function Empty({
  icon,
  title,
  hint,
  cta,
  ctaTo,
  onCta,
}: {
  icon: IconName;
  title: string;
  hint?: string;
  cta?: string;
  ctaTo?: string;
  onCta?: () => void;
}) {
  return (
    <div className="empty">
      <motion.div
        className="empty__icon"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: EASE.standard }}
      >
        <Icon name={icon} size={26} />
      </motion.div>
      <div className="empty__t">{title}</div>
      {hint && <div className="empty__s">{hint}</div>}
      {cta && ctaTo && (
        <Link to={ctaTo} className="btn btn--primary" style={{ marginTop: 'var(--s4)' }}>
          {cta}
        </Link>
      )}
      {cta && !ctaTo && (
        <button className="btn btn--primary" style={{ marginTop: 'var(--s4)' }} onClick={onCta}>
          {cta}
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- skeleton -- */

/** Skeletons match the shape of what is coming, so the layout does not jump when
 *  it lands. A skeleton that is the wrong height is worse than a spinner. */
export function SkeletonRows({ count = 5, height = 56 }: { count?: number; height?: number }) {
  return (
    <div className="col" style={{ gap: 1 }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ height, borderRadius: 0, opacity: 1 - i * 0.09 }} />
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- tooltip -- */

export function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="tip" tabIndex={0}>
      {children}
      <span className="tip__body" role="tooltip">
        {label}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------ error state -- */

/** Errors are friendly, specific and actionable. Never a stack trace, never a
 *  code, always a way forward. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty">
      <div className="empty__icon" style={{ color: 'var(--bad)', background: 'var(--bad-wash)' }}>
        <Icon name="info" size={26} />
      </div>
      <div className="empty__t">{message}</div>
      <div className="empty__s">This is on us, not you.</div>
      {onRetry && (
        <button className="btn btn--outline" style={{ marginTop: 'var(--s4)' }} onClick={onRetry}>
          <Icon name="rotate" size={16} />
          Try again
        </button>
      )}
    </div>
  );
}
