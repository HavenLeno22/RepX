import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  MATCH_DURATION_SECONDS,
  previewMatchRatings,
  rankForRating,
  type ExerciseInfo,
  type MatchMode,
  type QueueStatusPayload,
} from '@repx/shared';
import { Avatar } from '../components/Avatar';
import { CameraPreview } from '../components/CameraPreview';
import { Icon, exerciseIcon, type IconName } from '../components/Icon';
import { CountUp } from '../components/motion';
import { Emblem, Meter } from '../components/ui';
import { get } from '../lib/api';
import { getStream, prepareArena, releaseCamera, useArena, warmModel } from '../lib/arena';
import { cue } from '../lib/feedback';
import { EASE } from '../lib/motion';
import { getSocket } from '../lib/socket';
import { useAuth } from '../store/auth';
import { useMatch } from '../store/match';

const MODES: { id: MatchMode; label: string; stake: string; icon: IconName }[] = [
  { id: 'ranked', label: 'Ranked', stake: 'Rating on the line', icon: 'trending-up' },
  { id: 'quick', label: 'Quick', stake: 'No rating change', icon: 'zap' },
  { id: 'friendly', label: 'Practice', stake: 'Nothing at stake', icon: 'target' },
];

/**
 * Play.
 *
 * The lobby's whole job is to get someone into a match with the stakes already
 * understood. Three things had to be true for that:
 *
 * - **The stakes are visible before you commit.** `+24 / −18`, computed with the
 *   same ELO function the server settles with, so the number shown is the number
 *   that happens.
 * - **The camera and model are ready before the queue is.** Entering the queue
 *   first meant the countdown could start — and the match go live — while a 5MB
 *   model was still downloading.
 * - **Searching is not a spinner.** It is the most anxious thirty seconds in the
 *   product, so it shows a real widening band, a real count of who else is
 *   waiting, and a live camera preview to fix your framing before it matters.
 */
export function Play() {
  const user = useAuth((s) => s.user);
  const [exercises, setExercises] = useState<ExerciseInfo[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<MatchMode>('ranked');
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const phase = useMatch((s) => s.phase);
  const queue = useMatch((s) => s.queue);
  const reset = useMatch((s) => s.reset);
  const arenaStatus = useArena((s) => s.status);
  const arenaError = useArena((s) => s.error);

  useEffect(() => {
    void get<ExerciseInfo[]>('/exercises')
      .then((list) => {
        setExercises(list);
        setSelected((current) => current ?? list[0]?.slug ?? null);
      })
      .catch(() => {
        setExercises([]);
        setError('Could not reach the server. Check your connection and try again.');
      });

    // Pull the pose model down while the player browses. No permission prompt,
    // no camera light — just the slow part of the arena, done in advance.
    void warmModel().catch(() => undefined);
  }, []);

  const searching = phase === 'queued';
  const active = exercises?.find((e) => e.slug === selected);

  const stakes =
    user && mode === 'ranked'
      ? previewMatchRatings(
          { rating: user.rating, matchesPlayed: user.matchesPlayed },
          { rating: user.rating, matchesPlayed: user.matchesPlayed },
        )
      : null;

  async function startSearch() {
    if (!selected || starting) return;
    setError(null);
    setStarting(true);
    cue('tap');
    try {
      await prepareArena();
      getSocket()?.emit('matchmaking:join', { exerciseSlug: selected, mode });
    } catch {
      setError(useArena.getState().error ?? 'Could not start your camera. Check the permission and try again.');
      cue('error');
    } finally {
      setStarting(false);
    }
  }

  function cancelSearch() {
    getSocket()?.emit('matchmaking:leave');
    releaseCamera();
    reset();
  }

  if (searching) {
    return <Searching queue={queue} exercise={active} mode={mode} onCancel={cancelSearch} />;
  }

  const busyLabel =
    arenaStatus === 'model' ? 'Loading AI…' : arenaStatus === 'camera' ? 'Starting camera…' : null;

  return (
    <>
      <div className="head">
        <span className="head__t">Play</span>
        <span className="head__actions">
          <span className="chip">
            <Icon name="clock" size={13} />
            {MATCH_DURATION_SECONDS}s rounds
          </span>
          <ArenaChip status={arenaStatus} error={arenaError} />
        </span>
      </div>

      {error && (
        <div className="alert alert--error">
          <Icon name="info" size={17} style={{ marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid--sidebar">
        {/* ==================================================== exercises == */}
        <div className="col gap-md">
          <section className="panel">
            <header className="panel__head">
              <span className="panel__title">Choose your exercise</span>
            </header>
            <div className="panel__body">
              {exercises === null ? (
                <div className="grid grid--picks">
                  {Array.from({ length: 7 }, (_, i) => (
                    <div key={i} className="skeleton" style={{ height: 104 }} />
                  ))}
                </div>
              ) : (
                <div className="grid grid--picks">
                  {exercises.map((exercise, i) => {
                    const isSelected = exercise.slug === selected;
                    return (
                      <motion.button
                        key={exercise.slug}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.2), duration: 0.24, ease: EASE.standard }}
                        className="pick"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelected(exercise.slug);
                          cue('select');
                        }}
                      >
                        {isSelected && (
                          <span className="pick__check">
                            <Icon name="check" size={11} strokeWidth={3} />
                          </span>
                        )}
                        <span className="pick__icon">
                          <Icon name={exerciseIcon(exercise.slug)} size={19} />
                        </span>
                        <span className="pick__name">{exercise.displayName}</span>
                        <span className="pick__meta">
                          {exercise.scoring === 'hold' ? '1 pt / second' : 'Most reps wins'}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {active && (
                <>
                  <div className="divider" />
                  {/* The camera hint sits with the exercise it applies to, not in
                      an introduction at the top of the screen. */}
                  <div className="row" style={{ alignItems: 'flex-start', gap: 'var(--s3)' }}>
                    <Icon name="camera" size={17} style={{ color: 'var(--cyan)', marginTop: 2 }} />
                    <span className="t-sm dim" style={{ fontWeight: 500 }}>
                      {active.cameraHint}
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ------------------------------------------------- other ways */}
          <section className="panel">
            <header className="panel__head">
              <span className="panel__title">Other ways to play</span>
            </header>
            <div className="panel__body grid grid--picks">
              <Upcoming icon="users" name="Challenge a friend" meta="Queue into someone by name" />
              <Upcoming icon="lock" name="Private room" meta="Invite-only, no rating" />
              <Upcoming icon="medal" name="Tournaments" meta="Bracketed, seasonal" />
              <Upcoming icon="brain" name="AI Coach" meta="Form review after a set" />
            </div>
          </section>
        </div>

        {/* ====================================================== stakes == */}
        <div className="col gap-md">
          <section className="panel">
            <header className="panel__head">
              <span className="panel__title">Match type</span>
            </header>
            <div className="panel__body">
              <div className="seg" role="group" aria-label="Match type">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    className="seg__opt"
                    aria-pressed={mode === m.id}
                    onClick={() => {
                      setMode(m.id);
                      cue('select');
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="t-sm mute" style={{ marginTop: 'var(--s3)', textAlign: 'center' }}>
                {MODES.find((m) => m.id === mode)?.stake}
              </div>

              {stakes && user && (
                <>
                  <div className="divider" />
                  <div className="t-caption mute" style={{ marginBottom: 'var(--s3)' }}>
                    What's at stake
                  </div>
                  <div className="row between">
                    <div>
                      <span className="num" style={{ fontSize: 24, color: 'var(--win)' }}>
                        +{stakes.aWins.a.delta}
                      </span>
                      <div className="stat__l">If you win</div>
                    </div>
                    <Icon name="swords" size={20} style={{ color: 'var(--text-3)' }} />
                    <div style={{ textAlign: 'right' }}>
                      <span className="num" style={{ fontSize: 24, color: 'var(--loss)' }}>
                        {stakes.bWins.a.delta}
                      </span>
                      <div className="stat__l">If you lose</div>
                    </div>
                  </div>

                  <div className="divider" />
                  <div className="row" style={{ gap: 'var(--s3)' }}>
                    <Emblem rating={user.rating} size="md" />
                    <div style={{ flex: 1 }}>
                      <div className="row between" style={{ marginBottom: 5 }}>
                        <span className="t-caption mute">{rankForRating(user.rating).name}</span>
                        <span className="mono" style={{ fontSize: 13, fontWeight: 800 }}>
                          {user.rating}
                        </span>
                      </div>
                      <Meter
                        progress={
                          (user.rating - rankForRating(user.rating).min) /
                          Math.max(1, 400)
                        }
                        thin
                        color={rankForRating(user.rating).color}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          <button
            className="btn btn--play btn--lg btn--block"
            disabled={!selected || starting}
            onClick={() => void startSearch()}
          >
            {starting ? (
              <>
                <span className="spinner" />
                {busyLabel ?? 'Preparing…'}
              </>
            ) : (
              <>
                <Icon name="swords" size={21} strokeWidth={2.2} />
                Find an opponent
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

function Upcoming({ icon, name, meta }: { icon: IconName; name: string; meta: string }) {
  return (
    <div className="pick" style={{ opacity: 0.55, cursor: 'default' }} aria-disabled>
      <span className="pick__icon">
        <Icon name={icon} size={19} />
      </span>
      <span className="pick__name">{name}</span>
      <span className="pick__meta">{meta}</span>
      <span className="chip" style={{ marginTop: 8, padding: '2px 7px', fontSize: 10 }}>
        Soon
      </span>
    </div>
  );
}

/** Readiness of the camera and pose model, stated as a status rather than a
 *  sentence — and never as a silent nothing, because "why is this taking so
 *  long" is the question the chip exists to answer. */
function ArenaChip({ status, error }: { status: string; error: string | null }) {
  if (status === 'error') {
    return (
      <span className="chip chip--bad" title={error ?? undefined}>
        <span className="chip__dot" />
        Camera blocked
      </span>
    );
  }
  if (status === 'model') {
    return (
      <span className="chip chip--warn">
        <span className="chip__dot chip__dot--pulse" />
        Loading AI
      </span>
    );
  }
  if (status === 'camera') {
    return (
      <span className="chip chip--warn">
        <span className="chip__dot chip__dot--pulse" />
        Starting camera
      </span>
    );
  }
  return (
    <span className="chip chip--ai">
      <Icon name="brain" size={12} />
      AI ready
    </span>
  );
}

/* ------------------------------------------------------------- searching -- */

function Searching({
  queue,
  exercise,
  mode,
  onCancel,
}: {
  queue: QueueStatusPayload | null;
  exercise?: ExerciseInfo;
  mode: MatchMode;
  onCancel: () => void;
}) {
  const user = useAuth((s) => s.user);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // These change while you watch: the server pushes a fresh status every second,
  // so the band really does open up on screen as it opens up in the matchmaker.
  const band = queue?.ratingBand ?? 100;
  const rating = user?.rating ?? 1000;
  const alsoWaiting = Math.max(0, (queue?.searching ?? 1) - 1);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.32, ease: EASE.standard }}
      style={{ maxWidth: 480, margin: '0 auto' }}
    >
      <div className="panel">
        <div className="panel__body" style={{ padding: 'var(--s6)', textAlign: 'center' }}>
          {/* Concentric pulses in the brand colour. Three, offset by a third of
              the cycle each, so there is always one mid-flight — a single ring
              reads as a loading state, three read as a radar sweep. */}
          <div style={{ position: 'relative', width: 116, height: 116, margin: '0 auto var(--s5)' }}>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                animate={{ scale: [1, 1.6], opacity: [0.55, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '2px solid var(--brand)',
                }}
              />
            ))}
            <div
              style={{
                position: 'absolute',
                inset: 22,
                borderRadius: '50%',
                background: 'var(--brand-wash)',
                border: '1.5px solid var(--brand-edge)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--brand)',
              }}
            >
              <Icon name={exercise ? exerciseIcon(exercise.slug) : 'swords'} size={30} />
            </div>
          </div>

          <div className="t-h2">Finding an opponent</div>
          <div className="row" style={{ justifyContent: 'center', gap: 'var(--s2)', marginTop: 'var(--s2)' }}>
            <span className="chip">{exercise?.displayName ?? 'Match'}</span>
            <span className="chip" style={{ textTransform: 'capitalize' }}>
              {mode}
            </span>
          </div>

          <div
            className="row"
            style={{ justifyContent: 'center', gap: 'var(--s8)', margin: 'var(--s5) 0 var(--s4)' }}
          >
            <div>
              <div className="num" style={{ fontSize: 24 }}>
                {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
              </div>
              <div className="stat__l">Elapsed</div>
            </div>
            <div>
              <CountUp value={band} prefix="±" duration={400} className="num" style={{ fontSize: 24 }} />
              <div className="stat__l">Rating range</div>
            </div>
            <div>
              <div className="num" style={{ fontSize: 24 }}>
                {alsoWaiting}
              </div>
              <div className="stat__l">Also waiting</div>
            </div>
          </div>

          <div className="meter" style={{ position: 'relative' }}>
            <motion.div
              animate={{ width: `${Math.min(100, (band / 1500) * 100)}%` }}
              transition={{ duration: 0.9, ease: EASE.standard }}
              className="meter__fill"
              style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}
            />
          </div>
          <div className="row between" style={{ marginTop: 6 }}>
            <span className="mono mute" style={{ fontSize: 11.5 }}>
              {Math.max(0, rating - band)}
            </span>
            <span className="t-caption mute">Widening</span>
            <span className="mono mute" style={{ fontSize: 11.5 }}>
              {rating + band}
            </span>
          </div>

          {user && (
            <div
              className="row"
              style={{ justifyContent: 'center', gap: 'var(--s4)', margin: 'var(--s5) 0' }}
            >
              <Avatar username={user.username} src={user.avatarUrl} size={44} ring="var(--you)" />
              <span className="t-caption mute">VS</span>
              <motion.div
                animate={{ opacity: [0.35, 1, 0.35] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="avatar"
                style={{ width: 44, height: 44, boxShadow: '0 0 0 2px var(--them)' }}
              >
                <Icon name="search" size={18} />
              </motion.div>
            </div>
          )}

          {/* The camera is already live by now — so show it, and let them fix
              their framing before the countdown rather than during it. */}
          <CameraPreview stream={getStream()} />

          <button className="btn btn--outline btn--block" style={{ marginTop: 'var(--s4)' }} onClick={onCancel}>
            Cancel search
          </button>
        </div>
      </div>
    </motion.div>
  );
}
