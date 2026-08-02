import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { NOTIFICATION_STYLES, type NotificationTone } from '@repx/shared';
import { TOAST } from '../lib/motion';
import { useToasts } from '../store/toasts';
import { Icon, type IconName } from './Icon';

/** Tone → palette. Toasts cannot introduce a colour; they can only select one. */
const TONES: Record<NotificationTone, { fg: string; bg: string }> = {
  brand: { fg: 'var(--brand)', bg: 'var(--brand-wash)' },
  gold: { fg: 'var(--gold)', bg: 'var(--gold-wash)' },
  info: { fg: 'var(--cyan)', bg: 'var(--cyan-wash)' },
  danger: { fg: 'var(--bad)', bg: 'var(--bad-wash)' },
  neutral: { fg: 'var(--text-2)', bg: 'var(--card-2)' },
};

/**
 * The toast stack.
 *
 * Lives at the app root so a toast raised during a page transition survives it —
 * mounting this per-screen was how the old build managed to lose the "achievement
 * unlocked" message exactly when the player navigated away from the result.
 */
export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const style = NOTIFICATION_STYLES[toast.category];
          const tone = TONES[style.tone];
          const body = (
            <>
              <span className="toast__icon" style={{ background: tone.bg, color: tone.fg }}>
                <Icon name={style.icon as IconName} size={18} />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="toast__t">{toast.title}</span>
                {toast.body && <span className="toast__b">{toast.body}</span>}
              </span>
              <button
                className="appbar__icon"
                style={{ width: 28, height: 28 }}
                onClick={(e) => {
                  e.preventDefault();
                  dismiss(toast.id);
                }}
                aria-label="Dismiss"
              >
                <Icon name="x" size={14} />
              </button>
            </>
          );

          return (
            <motion.div
              key={toast.id}
              layout
              variants={TOAST}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {toast.href ? (
                <Link to={toast.href} className="toast" onClick={() => dismiss(toast.id)}>
                  {body}
                </Link>
              ) : (
                <div className="toast">{body}</div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
