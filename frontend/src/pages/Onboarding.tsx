import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { RANKS, rankForRating } from '@repx/shared';
import { Icon, type IconName } from '../components/Icon';
import { Emblem, Meter } from '../components/ui';
import { cue } from '../lib/feedback';
import { EASE, SPRING } from '../lib/motion';
import { useAuth } from '../store/auth';

const KEY = 'repx.onboarded';

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // Storage blocked — never trap someone in onboarding.
  }
}

interface Step {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: IconName;
  /** Each step has a live demonstration rather than an illustration. Showing the
   *  real component is both more convincing and one less thing to maintain. */
  demo: 'ladder' | 'ai' | 'match' | 'progress';
}

const STEPS: Step[] = [
  {
    id: 'what',
    eyebrow: 'What RepX is',
    title: 'Push-ups, but it counts for something',
    body: 'You are matched against a real person at your level, you both have sixty seconds, and the one who does more verified reps wins. That is the whole game.',
    icon: 'swords',
    demo: 'match',
  },
  {
    id: 'ai',
    eyebrow: 'How the AI works',
    title: 'Your camera never leaves this device',
    body: 'Pose estimation runs in your browser. Only 33 skeleton coordinates go to the server, which counts every rep again itself. Half a rep does not count — and you can see it not counting, live.',
    icon: 'brain',
    demo: 'ai',
  },
  {
    id: 'ranked',
    eyebrow: 'How ranked works',
    title: 'A rating that can go down',
    body: 'Chess-style ELO across seven tiers. Ten placement matches settle where you start. Beat someone stronger and you take more from them — that is what makes a win mean something.',
    icon: 'trending-up',
    demo: 'ladder',
  },
  {
    id: 'improve',
    eyebrow: 'How you improve',
    title: 'Every battle tells you what to fix',
    body: 'Each result carries a grade, your form accuracy and where the match was actually decided. Rating measures how good you are; XP and levels measure that you showed up, and they never go down.',
    icon: 'target',
    demo: 'progress',
  },
];

/**
 * Onboarding.
 *
 * Four screens, each one answering a question a new player would otherwise ask
 * in the middle of their first match — and each one showing the actual interface
 * rather than describing it. The AI step in particular exists because "is it
 * recording me?" is the single most common reason someone closes a
 * camera-based fitness app and does not come back.
 *
 * Skippable from the first frame. An unskippable tutorial is a wall in front of
 * the product for the returning user who reinstalled, and they are exactly the
 * user you least want to annoy.
 */
export function Onboarding() {
  const user = useAuth((s) => s.user);
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  function finish() {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // Storage blocked; the app still opens, onboarding simply shows again.
    }
    cue('tap');
    // A hard navigation rather than a router push: this component is rendered
    // *instead of* the app shell, so the shell has to mount fresh.
    window.location.assign('/');
  }

  return (
    <div className="onb">
      <div className="onb__glow" aria-hidden />

      <header className="onb__bar">
        <span className="row" style={{ gap: 'var(--s2)' }}>
          <span className="mark" style={{ width: 30, height: 30, borderRadius: 9 }}>
            <Icon name="zap" size={16} strokeWidth={2.2} />
          </span>
          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.7 }}>RepX</span>
        </span>
        <button className="btn btn--outline btn--sm" onClick={finish}>
          Skip
        </button>
      </header>

      <div className="onb__body">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.32, ease: EASE.standard }}
            className="onb__inner"
          >
            <div>
              <motion.span
                className="mark"
                initial={{ scale: 0.6, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={SPRING}
                style={{ width: 48, height: 48, borderRadius: 14, marginBottom: 'var(--s5)' }}
              >
                <Icon name={step.icon} size={24} strokeWidth={2} />
              </motion.span>

              <div className="t-caption brand">{step.eyebrow}</div>
              <h1 className="t-dlg" style={{ marginTop: 'var(--s2)' }}>
                {step.title}
              </h1>
              <p className="t-body-lg dim" style={{ marginTop: 'var(--s4)', maxWidth: 460 }}>
                {step.body}
              </p>
            </div>

            <Demo demo={step.demo} rating={user?.rating ?? 1000} username={user?.username ?? 'you'} />
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="onb__foot">
        {/* Progress as segments rather than dots: a dot says "there are four",
            a filling bar says "you are most of the way through". */}
        <div className="row" style={{ gap: 5, flex: 1, maxWidth: 200 }}>
          {STEPS.map((s, i) => (
            <span key={s.id} style={{ flex: 1 }}>
              <Meter progress={i <= index ? 1 : 0} thin />
            </span>
          ))}
        </div>

        <div className="row gap-sm">
          {index > 0 && (
            <button
              className="btn btn--outline"
              onClick={() => {
                setIndex(index - 1);
                cue('nav');
              }}
            >
              <Icon name="chevron-left" size={17} />
              Back
            </button>
          )}
          <button
            className="btn btn--play"
            onClick={() => {
              if (last) finish();
              else {
                setIndex(index + 1);
                cue('nav');
              }
            }}
          >
            {last ? 'Enter the arena' : 'Next'}
            <Icon name="chevron-right" size={17} strokeWidth={2.4} />
          </button>
        </div>
      </footer>

      <style>{`
        .onb {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .onb__glow {
          position: absolute;
          right: -180px;
          top: -180px;
          width: 640px;
          height: 640px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--brand-bloom), transparent 66%);
          pointer-events: none;
        }
        .onb__bar {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: calc(var(--safe-t) + var(--s5)) var(--s6) 0;
        }
        .onb__body {
          position: relative;
          flex: 1;
          display: grid;
          align-items: center;
          padding: var(--s6);
        }
        .onb__inner {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 420px);
          gap: var(--s12);
          align-items: center;
          max-width: 1000px;
          margin: 0 auto;
          width: 100%;
        }
        .onb__foot {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--s4);
          padding: 0 var(--s6) calc(var(--safe-b) + var(--s6));
        }
        @media (max-width: 900px) {
          .onb__inner { grid-template-columns: 1fr; gap: var(--s6); }
          .onb__body { padding: var(--s5); align-items: start; padding-top: var(--s8); }
          .onb__foot { padding: 0 var(--s5) calc(var(--safe-b) + var(--s5)); }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ demos -- */

function Demo({ demo, rating, username }: { demo: Step['demo']; rating: number; username: string }) {
  if (demo === 'ladder') {
    return (
      <div className="panel">
        <header className="panel__head">
          <span className="panel__title">Seven tiers</span>
          <span className="chip chip--brand">You start at 1000</span>
        </header>
        <div className="panel__body col gap-sm">
          {RANKS.map((rank, i) => (
            <motion.div
              key={rank.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3, ease: EASE.standard }}
              className="row"
              style={{
                gap: 'var(--s3)',
                padding: '7px 10px',
                borderRadius: 'var(--r-input)',
                background:
                  rankForRating(rating).id === rank.id ? 'var(--brand-wash)' : 'transparent',
              }}
            >
              <Emblem rating={rank.min} size="sm" glow={false} />
              <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: rank.color }}>
                {rank.name}
              </span>
              <span className="mono mute" style={{ fontSize: 12 }}>
                {rank.min}+
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (demo === 'ai') {
    return (
      <div className="panel">
        <header className="panel__head">
          <span className="panel__title">Live verification</span>
          <span className="chip chip--ai">
            <Icon name="brain" size={12} />
            On device
          </span>
        </header>
        <div className="panel__body col gap-sm">
          {[
            { label: 'Camera frame', on: false, note: 'Never leaves your device' },
            { label: '33 skeleton points', on: true, note: 'Sent to the server' },
            { label: 'Server re-counts the rep', on: true, note: 'The only count that scores' },
            { label: 'Half rep', on: false, note: 'Rejected, and shown to you live' },
          ].map((line, i) => (
            <motion.div
              key={line.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.09, duration: 0.3, ease: EASE.standard }}
              className="row"
              style={{
                gap: 'var(--s3)',
                padding: 'var(--s3)',
                borderRadius: 'var(--r-input)',
                background: 'var(--card-2)',
              }}
            >
              <Icon
                name={line.on ? 'check-circle' : 'x'}
                size={18}
                style={{ color: line.on ? 'var(--ok)' : 'var(--text-3)' }}
              />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 13.5 }}>{line.label}</span>
                <span className="t-sm mute" style={{ fontWeight: 500 }}>
                  {line.note}
                </span>
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (demo === 'progress') {
    return (
      <div className="panel">
        <header className="panel__head">
          <span className="panel__title">After every battle</span>
        </header>
        <div className="panel__body col gap-sm">
          {[
            { icon: 'star' as IconName, label: 'Performance grade', value: 'S to D', color: 'var(--gold)' },
            { icon: 'check-circle' as IconName, label: 'Form accuracy', value: '0–100%', color: 'var(--ok)' },
            { icon: 'zap' as IconName, label: 'XP earned', value: 'Win or lose', color: 'var(--brand)' },
            { icon: 'brain' as IconName, label: 'What decided it', value: 'One line', color: 'var(--cyan)' },
          ].map((row, i) => (
            <motion.div
              key={row.label}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.3, ease: EASE.standard }}
              className="row between"
              style={{ padding: 'var(--s3)', borderRadius: 'var(--r-input)', background: 'var(--card-2)' }}
            >
              <span className="row" style={{ gap: 'var(--s3)' }}>
                <Icon name={row.icon} size={17} style={{ color: row.color }} />
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{row.label}</span>
              </span>
              <span className="mono mute" style={{ fontSize: 12, fontWeight: 700 }}>
                {row.value}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // demo === 'match'
  return (
    <div className="panel">
      <header className="panel__head">
        <span className="panel__title">A battle</span>
        <span className="chip chip--ok">
          <span className="chip__dot chip__dot--pulse" />
          Live
        </span>
      </header>
      <div className="panel__body">
        <div className="row between" style={{ marginBottom: 'var(--s3)' }}>
          <span className="col">
            <span className="num" style={{ fontSize: 34, color: 'var(--you)' }}>
              14
            </span>
            <span className="stat__l">{username}</span>
          </span>
          <span className="t-caption mute">VS</span>
          <span className="col" style={{ alignItems: 'flex-end' }}>
            <span className="num" style={{ fontSize: 34, color: 'var(--them)' }}>
              11
            </span>
            <span className="stat__l">Opponent</span>
          </span>
        </div>

        {/* The momentum bar, exactly as it appears mid-match: your share of the
            reps so far. Readable in peripheral vision, which is the point —
            mid-set you are looking at your own body, not the screen. */}
        <div style={{ height: 10, borderRadius: 'var(--r-bar)', overflow: 'hidden', display: 'flex' }}>
          <motion.span
            initial={{ flex: 1 }}
            animate={{ flex: 14 }}
            transition={{ duration: 1, ease: EASE.standard }}
            style={{ background: 'var(--you)' }}
          />
          <motion.span
            initial={{ flex: 1 }}
            animate={{ flex: 11 }}
            transition={{ duration: 1, ease: EASE.standard }}
            style={{ background: 'var(--them)' }}
          />
        </div>

        <div className="row between" style={{ marginTop: 'var(--s4)' }}>
          <span className="chip">
            <Icon name="clock" size={12} />
            60 seconds
          </span>
          <span className="chip chip--brand">Most verified reps wins</span>
        </div>
      </div>
    </div>
  );
}
