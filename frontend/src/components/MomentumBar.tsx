import { motion } from 'framer-motion';
import { Avatar } from './Avatar';

interface Side {
  username: string;
  avatarUrl?: string | null;
  reps: number;
}

/**
 * Tug-of-war between the two competitors.
 *
 * Starts dead even and the divider slides toward whoever is behind, so the
 * lead is readable in peripheral vision — which matters, because mid-set the
 * player is looking at their own body, not the screen. The share is capped so
 * a blowout never collapses the losing side to nothing and becomes unreadable.
 *
 * Sizes come from CSS clamp rather than fixed pixels: the same component is on
 * a phone held two metres away and on a laptop at arm's length, and the scores
 * have to stay legible at both.
 */
export function MomentumBar({ you, them, compact = false }: { you: Side; them: Side; compact?: boolean }) {
  const total = you.reps + them.reps;
  const raw = total === 0 ? 0.5 : you.reps / total;
  // Clamp to 8%..92% so both names/scores stay legible at any scoreline.
  const share = Math.max(0.08, Math.min(0.92, raw));
  const lead = you.reps - them.reps;

  return (
    <div className={`momentum${compact ? ' momentum--compact' : ''}`}>
      <Avatar username={you.username} src={you.avatarUrl} size={compact ? 38 : 48} ring="var(--you)" />

      <div className="momentum__mid">
        <div className="momentum__scores">
          <motion.span
            key={`you-${you.reps}`}
            initial={{ scale: 1.18 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            className="momentum__n"
            style={{ color: 'var(--you)' }}
          >
            {you.reps}
          </motion.span>

          <span className="momentum__lead">
            {lead === 0 ? 'Level' : lead > 0 ? `+${lead} you` : `+${-lead} them`}
          </span>

          <motion.span
            key={`them-${them.reps}`}
            initial={{ scale: 1.18 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            className="momentum__n"
            style={{ color: 'var(--them)' }}
          >
            {them.reps}
          </motion.span>
        </div>

        <div className="momentum__bar">
          <motion.div
            animate={{ width: `${share * 100}%` }}
            transition={{ type: 'spring', stiffness: 130, damping: 20 }}
            className="momentum__fill"
          />
          {/* centre reference so "even" is unambiguous */}
          <span className="momentum__centre" />
        </div>

        <div className="momentum__names">
          <span>You</span>
          <span className="momentum__them">{them.username}</span>
        </div>
      </div>

      <Avatar username={them.username} src={them.avatarUrl} size={compact ? 38 : 48} ring="var(--them)" />

      <style>{`
        .momentum {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
        }
        .momentum__mid { flex: 1; min-width: 0; }
        .momentum__scores {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 5px;
        }
        .momentum__n {
          font-family: var(--mono);
          font-size: clamp(24px, 7vw, 32px);
          font-weight: 800;
          line-height: 1;
          letter-spacing: -1.4px;
        }
        .momentum--compact .momentum__n { font-size: clamp(20px, 5.5vw, 25px); }
        .momentum__lead {
          font-size: 10.5px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--on-media-3);
          white-space: nowrap;
          padding: 0 6px;
        }
        .momentum__bar {
          position: relative;
          height: 14px;
          border-radius: var(--r-full);
          overflow: hidden;
          background: var(--them);
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.35);
        }
        .momentum--compact .momentum__bar { height: 11px; }
        .momentum__fill {
          position: absolute;
          inset: 0;
          right: auto;
          background: var(--you);
          border-radius: var(--r-full) 0 0 var(--r-full);
        }
        .momentum__centre {
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 2px;
          margin-left: -1px;
          background: var(--on-media-2);
        }
        .momentum__names {
          display: flex;
          justify-content: space-between;
          margin-top: 4px;
          font-size: 11.5px;
          font-weight: 700;
          color: var(--on-media-2);
          gap: 10px;
        }
        .momentum__them {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 45%;
        }
      `}</style>
    </div>
  );
}
