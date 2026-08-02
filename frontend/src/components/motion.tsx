/**
 * Motion primitives.
 *
 * Three components cover almost every animation in RepX that is not a CSS
 * transition. They exist so that "a number that counts up" is one decision made
 * once, rather than eight components each easing a number slightly differently.
 *
 * Every one of them respects the reduced-motion preference by *landing on the
 * final state immediately* rather than by not rendering. A player who has asked
 * for less motion still gets the information.
 */

import { motion, useInView, type Variants } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RISE, STAGGER, STAGGER_CHILD } from '../lib/motion';
import { motionIsReduced, usePrefs } from '../store/prefs';

function useReduced(): boolean {
  const motionPref = usePrefs((s) => s.motion);
  return motionIsReduced({ motion: motionPref, highContrast: false, sound: false, haptics: false });
}

/* ---------------------------------------------------------------- CountUp -- */

export interface CountUpProps {
  value: number;
  /** Milliseconds. Longer for bigger, more meaningful numbers. */
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Renders `+` in front of positives. For rating deltas. */
  signed?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A number that counts to its value.
 *
 * Counts from wherever it currently is, not from zero — so a rating going
 * 1480 → 1504 animates across 24 points rather than sweeping up from nothing,
 * which is both faster to read and true to what happened.
 *
 * Uses `requestAnimationFrame` rather than a Framer `animate` so the DOM node
 * receives plain text: the value stays selectable and readable by a screen
 * reader mid-animation.
 */
export function CountUp({
  value,
  duration = 700,
  decimals = 0,
  prefix = '',
  suffix = '',
  signed = false,
  className,
  style,
}: CountUpProps) {
  const reduced = useReduced();
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const frame = useRef(0);

  useEffect(() => {
    if (reduced || duration <= 0) {
      setDisplay(value);
      from.current = value;
      return;
    }

    const start = performance.now();
    const origin = from.current;
    const delta = value - origin;
    if (delta === 0) return;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease-out-quart. Most of the distance is covered early, so the number is
      // legible almost immediately and the tail is the part that feels good.
      const eased = 1 - Math.pow(1 - t, 4);
      setDisplay(origin + delta * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else from.current = value;
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration, reduced]);

  const rounded = display.toFixed(decimals);
  const sign = signed && value > 0 ? '+' : '';

  return (
    <span className={className} style={style}>
      {sign}
      {prefix}
      {rounded}
      {suffix}
    </span>
  );
}

/* ----------------------------------------------------------------- Reveal -- */

/**
 * Lifts its children in when they scroll into view, once.
 *
 * `once: true` is not an optimisation — an element that re-animates every time
 * it scrolls back past is the difference between a page that feels alive and one
 * that feels like it is fidgeting.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduced = useReduced();

  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      variants={RISE}
      initial={reduced ? 'animate' : 'initial'}
      animate={inView || reduced ? 'animate' : 'initial'}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------------------------------------------- Stagger -- */

/**
 * A list whose children arrive one after another.
 *
 * The stagger is capped by `max`: a 100-row leaderboard at 35ms per row takes
 * three and a half seconds to finish arriving, at which point the animation has
 * stopped being polish and started being a wait. Rows past the cap all land
 * together at the cap's delay.
 */
export function Stagger({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduced = useReduced();
  return (
    <motion.div
      className={className}
      style={style}
      variants={STAGGER}
      initial={reduced ? 'animate' : 'initial'}
      animate="animate"
    >
      {children}
    </motion.div>
  );
}

/** A direct child of `Stagger`. */
export function StaggerItem({
  children,
  index = 0,
  max = 12,
  className,
  style,
}: {
  children: ReactNode;
  index?: number;
  max?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduced = useReduced();
  const variants: Variants = {
    initial: STAGGER_CHILD.initial as Variants['initial'],
    animate: {
      opacity: 1,
      y: 0,
      transition: { delay: Math.min(index, max) * 0.035, duration: 0.24, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <motion.div
      className={className}
      style={style}
      variants={variants}
      initial={reduced ? 'animate' : 'initial'}
      animate="animate"
    >
      {children}
    </motion.div>
  );
}
