import { motion } from 'framer-motion';

/**
 * Live range-of-motion gauge.
 *
 * The most frustrating failure in an AI-judged workout is a rep you believe was
 * good being silently ignored. This makes the judgement legible in real time:
 * the fill shows how deep you currently are, and the marked line is the depth
 * the rep must reach to count. Reaching the line turns the gauge green.
 */
export function DepthMeter({ completion, label }: { completion: number; label: string }) {
  const pct = Math.max(0, Math.min(1, completion)) * 100;
  const reached = completion >= 1;

  return (
    <div className="depth">
      <div className="depth__track">
        <motion.div
          animate={{ height: `${pct}%` }}
          transition={{ type: 'tween', duration: 0.09 }}
          className="depth__fill"
          style={{ background: reached ? 'var(--ok)' : 'var(--you)' }}
        />
        {/* the depth a rep has to reach */}
        <span className="depth__mark" style={{ background: reached ? 'var(--ok)' : 'var(--on-media)' }} />
      </div>

      <span className="depth__label" style={{ color: reached ? 'var(--ok)' : 'var(--on-media-3)' }}>
        {reached ? 'Depth reached' : label}
      </span>

      <style>{`
        .depth { display: flex; align-items: center; gap: 9px; }
        .depth__track {
          position: relative;
          width: 13px;
          /* Shrinks with the viewport so it never runs off a short phone screen. */
          height: clamp(120px, 30vh, 186px);
          border-radius: var(--r-full);
          background: var(--on-media-line);
          overflow: hidden;
          box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.4);
        }
        .depth__fill {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: var(--r-full);
        }
        .depth__mark {
          position: absolute;
          left: -3px;
          right: -3px;
          top: 0;
          height: 3px;
          box-shadow: 0 0 6px rgba(0, 0, 0, 0.6);
        }
        .depth__label {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.3px;
          text-transform: uppercase;
        }
        @media (max-width: 420px) {
          .depth__label { display: none; }
        }
      `}</style>
    </div>
  );
}
