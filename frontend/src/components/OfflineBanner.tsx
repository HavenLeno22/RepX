/**
 * "Cannot reach the server" banner.
 *
 * Exists because the failure it reports used to be invisible. When the API is
 * down, every screen's own fetch fails independently, and each one rendered its
 * own local error — "Could not load your battles", "Could not load the
 * leaderboard" — with no indication that the cause was shared and nothing to do
 * about it. Someone looking at that reasonably concludes the app is broken,
 * because from where they are sitting it is indistinguishable from an app that
 * is broken.
 *
 * One banner, stated plainly, turns a confusing app into a waiting one.
 *
 * It only appears after a request has actually failed to connect — it is not a
 * `navigator.onLine` check, which lies in both directions (it reports true on a
 * captive portal, and says nothing about whether *this* server is up).
 */

import { useEffect, useState } from 'react';
import { get } from '../lib/api';
import { useConnection } from '../store/connection';
import { Icon } from './Icon';

export function OfflineBanner() {
  const reachable = useConnection((s) => s.reachable);
  const [checking, setChecking] = useState(false);

  /**
   * While the server is down, re-check on a timer so the banner clears itself
   * when it comes back. Ten seconds is slow enough to be free and fast enough
   * that nobody sits looking at a stale banner after a backend restart.
   */
  useEffect(() => {
    if (reachable) return;

    const id = setInterval(() => {
      void get('/health').catch(() => {
        // The handler inside `api` already recorded the outcome either way.
      });
    }, 10_000);

    return () => clearInterval(id);
  }, [reachable]);

  if (reachable) return null;

  async function retryNow() {
    setChecking(true);
    try {
      await get('/health');
      // Reachable again. Reload rather than re-running every screen's fetch by
      // hand — the app was rendered against failed requests, and a reload is the
      // honest way to get consistent state back. The session survives this,
      // because a network failure no longer clears the stored tokens.
      window.location.reload();
    } catch {
      // Still down. The banner stays; the interval keeps trying.
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="offline" role="status" aria-live="polite">
      <Icon name="info" size={16} />
      <span className="offline__text">
        Can&rsquo;t reach the RepX server. Your connection is fine — the app will come back on its
        own.
      </span>
      <button type="button" className="offline__retry" onClick={() => void retryNow()} disabled={checking}>
        {checking ? 'Checking…' : 'Retry'}
      </button>

      <style>{`
        .offline {
          position: fixed;
          left: 50%;
          transform: translateX(-50%);
          bottom: calc(var(--s5) + var(--safe-b));
          z-index: 900;
          display: flex;
          align-items: center;
          gap: var(--s3);
          max-width: min(560px, calc(100vw - var(--s6)));
          padding: var(--s3) var(--s4);
          border-radius: 999px;
          background: var(--bad-wash);
          box-shadow: inset 0 0 0 1px var(--bad-edge), 0 12px 32px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(12px);
          color: var(--bad);
        }
        .offline__text {
          font-size: 13px;
          line-height: 1.35;
          color: var(--text);
        }
        .offline__retry {
          flex-shrink: 0;
          border: 0;
          border-radius: 999px;
          padding: 6px 12px;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          background: var(--bad);
          color: var(--brand-ink);
        }
        .offline__retry:disabled { opacity: 0.6; cursor: default; }
        /* The tab bar owns the bottom of the screen on mobile. */
        @media (max-width: 900px) {
          .offline { bottom: calc(var(--s16) + var(--safe-b)); }
        }
      `}</style>
    </div>
  );
}
