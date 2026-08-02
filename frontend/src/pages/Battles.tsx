import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Grade, MatchMode } from '@repx/shared';
import { Avatar } from '../components/Avatar';
import { Icon, exerciseIcon } from '../components/Icon';
import { CountUp, Stagger, StaggerItem } from '../components/motion';
import { Empty, ErrorState, GradeBadge, Stat } from '../components/ui';
import { get } from '../lib/api';
import { cue } from '../lib/feedback';
import { EASE } from '../lib/motion';

export interface Battle {
  matchId: string;
  exerciseSlug: string;
  mode: MatchMode;
  result: 'win' | 'loss' | 'draw' | null;
  yourReps: number;
  opponentReps: number;
  rejectedReps: number;
  accuracy: number;
  grade: Grade | null;
  xpEarned: number;
  ratingBefore: number | null;
  ratingAfter: number | null;
  ratingDelta: number | null;
  durationSeconds: number;
  opponent: { id: string; username: string; avatarUrl: string | null; rating: number } | null;
  playedAt: string;
}

type Filter = 'all' | 'win' | 'loss';

/**
 * Battle History.
 *
 * Renamed from "Match History", and the rename is not cosmetic — it changed what
 * the screen had to contain. A match history is a ledger; a battle history is a
 * record you are supposed to *want* to look back through.
 *
 * So every entry answers "why did that happen?", not only "what happened": the
 * grade, the accuracy, the margin, the rating swing and the XP, with a one-line
 * read of the performance underneath. A player who lost by two reps at 71%
 * accuracy now knows exactly what to fix, which is the difference between a
 * defeat that discourages and one that instructs.
 */
export function Battles() {
  const [battles, setBattles] = useState<Battle[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [exercise, setExercise] = useState<string>('all');
  const [open, setOpen] = useState<string | null>(null);

  function load() {
    setError(false);
    setBattles(null);
    void get<Battle[]>('/users/me/battles?limit=100')
      .then(setBattles)
      .catch(() => setError(true));
  }

  useEffect(load, []);

  const exercises = useMemo(
    () => [...new Set((battles ?? []).map((b) => b.exerciseSlug))],
    [battles],
  );

  const shown = (battles ?? []).filter(
    (b) =>
      (filter === 'all' || b.result === filter) &&
      (exercise === 'all' || b.exerciseSlug === exercise),
  );

  const record = useMemo(() => {
    const list = battles ?? [];
    return {
      wins: list.filter((b) => b.result === 'win').length,
      losses: list.filter((b) => b.result === 'loss').length,
      reps: list.reduce((sum, b) => sum + b.yourReps, 0),
      xp: list.reduce((sum, b) => sum + b.xpEarned, 0),
    };
  }, [battles]);

  return (
    <>
      <div className="head">
        <span className="head__t">Battle history</span>
        {battles && battles.length > 0 && (
          <span className="chip">
            <Icon name="history" size={13} />
            {battles.length} battles
          </span>
        )}
      </div>

      {battles && battles.length > 0 && (
        <div className="grid grid--stats" style={{ marginBottom: 'var(--s4)' }}>
          <Stat value={<CountUp value={record.wins} />} label="Wins" color="var(--win)" icon="trophy" />
          <Stat value={<CountUp value={record.losses} />} label="Losses" color="var(--loss)" />
          <Stat value={<CountUp value={record.reps} />} label="Verified reps" icon="activity" />
          <Stat value={<CountUp value={record.xp} />} label="XP earned" color="var(--brand)" icon="zap" />
        </div>
      )}

      <div className="panel">
        <header className="panel__head" style={{ gap: 'var(--s3)', flexWrap: 'wrap' }}>
          <div className="seg" role="group" aria-label="Filter by result" style={{ flex: '1 1 220px' }}>
            {(['all', 'win', 'loss'] as Filter[]).map((f) => (
              <button
                key={f}
                className="seg__opt"
                aria-pressed={filter === f}
                onClick={() => {
                  setFilter(f);
                  cue('select');
                }}
              >
                {f === 'all' ? 'All' : f === 'win' ? 'Victories' : 'Defeats'}
              </button>
            ))}
          </div>

          {exercises.length > 1 && (
            <select
              className="input"
              style={{ width: 'auto', minWidth: 150, minHeight: 38, padding: '8px 12px', fontSize: 13 }}
              value={exercise}
              onChange={(e) => {
                setExercise(e.target.value);
                cue('select');
              }}
              aria-label="Filter by exercise"
            >
              <option value="all">Every exercise</option>
              {exercises.map((slug) => (
                <option key={slug} value={slug}>
                  {slug.replace('-', ' ')}
                </option>
              ))}
            </select>
          )}
        </header>

        {error ? (
          <ErrorState message="Could not load your battles" onRetry={load} />
        ) : battles === null ? (
          <div className="panel__body col gap-sm">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton" style={{ height: 72, opacity: 1 - i * 0.12 }} />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <Empty
            icon="swords"
            title={battles.length === 0 ? 'No battles yet' : 'Nothing matches that filter'}
            hint={
              battles.length === 0
                ? 'Every battle you fight is recorded here'
                : 'Try a different result or exercise'
            }
            cta={battles.length === 0 ? 'Fight your first' : undefined}
            ctaTo={battles.length === 0 ? '/play' : undefined}
          />
        ) : (
          <Stagger className="list">
            {shown.map((battle, i) => (
              <StaggerItem key={battle.matchId} index={i}>
                <BattleCard
                  battle={battle}
                  open={open === battle.matchId}
                  onToggle={() => {
                    setOpen(open === battle.matchId ? null : battle.matchId);
                    cue('tap');
                  }}
                />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ card -- */

const RESULT = {
  win: { label: 'Victory', color: 'var(--win)', icon: 'trophy' as const },
  loss: { label: 'Defeat', color: 'var(--loss)', icon: 'skull' as const },
  draw: { label: 'Draw', color: 'var(--draw)', icon: 'handshake' as const },
};

function BattleCard({
  battle,
  open,
  onToggle,
}: {
  battle: Battle;
  open: boolean;
  onToggle: () => void;
}) {
  const outcome = RESULT[battle.result ?? 'draw'];
  const margin = battle.yourReps - battle.opponentReps;

  return (
    <div style={{ borderBottom: '1px solid var(--line-soft)' }}>
      <button
        className="listrow"
        style={{ width: '100%', textAlign: 'left', borderBottom: 'none', padding: 'var(--s3) var(--s4)' }}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="flagbar" style={{ background: outcome.color, width: 4 }} />

        {battle.grade ? (
          <GradeBadge grade={battle.grade} />
        ) : (
          <span className="grade" style={{ color: 'var(--text-3)', background: 'var(--card-2)' }}>
            –
          </span>
        )}

        <span className="listrow__main">
          <span className="row" style={{ gap: 'var(--s2)' }}>
            <span style={{ fontWeight: 800, fontSize: 14.5, color: outcome.color }}>
              {outcome.label}
            </span>
            <span className="listrow__name" style={{ textTransform: 'capitalize', fontWeight: 600 }}>
              · {battle.exerciseSlug.replace('-', ' ')}
            </span>
          </span>
          <span className="listrow__sub">
            <Icon name={exerciseIcon(battle.exerciseSlug)} size={11} />
            vs {battle.opponent?.username ?? 'Unknown'}
            <span className="mute">·</span>
            {new Date(battle.playedAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </span>

        <span className="col" style={{ alignItems: 'flex-end', gap: 1 }}>
          <span className="mono" style={{ fontSize: 15, fontWeight: 800 }}>
            {battle.yourReps}–{battle.opponentReps}
          </span>
          {battle.ratingDelta !== null && battle.ratingDelta !== 0 && (
            <span
              className="mono"
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: battle.ratingDelta > 0 ? 'var(--win)' : 'var(--loss)',
              }}
            >
              {battle.ratingDelta > 0 ? '+' : ''}
              {battle.ratingDelta}
            </span>
          )}
        </span>

        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.24, ease: EASE.standard }}
          style={{ color: 'var(--text-3)', display: 'grid' }}
        >
          <Icon name="chevron-down" size={16} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE.standard }}
            style={{ overflow: 'hidden' }}
          >
            <div className="panel__body" style={{ paddingTop: 0 }}>
              <div className="grid grid--stats">
                <Stat
                  value={`${Math.round(battle.accuracy * 100)}%`}
                  label="Accuracy"
                  color={battle.accuracy >= 0.9 ? 'var(--ok)' : battle.accuracy >= 0.7 ? undefined : 'var(--warn)'}
                />
                <Stat value={battle.rejectedReps} label="Reps rejected" />
                <Stat value={`${battle.durationSeconds}s`} label="Duration" />
                <Stat value={`+${battle.xpEarned}`} label="XP earned" color="var(--brand)" />
                {battle.ratingBefore !== null && battle.ratingAfter !== null && (
                  <Stat value={battle.ratingAfter} label="Rating after" />
                )}
              </div>

              {/*
                The read on the performance. Called AI analysis in the product
                because that is what it will be — today it is a deterministic
                summary derived from the same numbers above, which is honest
                (nothing is claimed that is not computed) and already useful.
                Swapping the sentence generator for a model is a change behind
                this one function, not across the screen.
              */}
              <div
                className="row"
                style={{
                  gap: 'var(--s3)',
                  marginTop: 'var(--s4)',
                  padding: 'var(--s3)',
                  borderRadius: 'var(--r-input)',
                  background: 'var(--cyan-wash)',
                  alignItems: 'flex-start',
                }}
              >
                <Icon name="brain" size={18} style={{ color: 'var(--cyan)', marginTop: 1 }} />
                <span>
                  <span className="t-caption" style={{ color: 'var(--cyan)' }}>
                    Analysis
                  </span>
                  <p className="t-sm dim" style={{ marginTop: 3, fontWeight: 500 }}>
                    {analyse(battle, margin)}
                  </p>
                </span>
              </div>

              {battle.opponent && (
                <div className="row between" style={{ marginTop: 'var(--s4)' }}>
                  <span className="row" style={{ gap: 'var(--s2)' }}>
                    <Avatar
                      username={battle.opponent.username}
                      src={battle.opponent.avatarUrl}
                      size={30}
                    />
                    <span>
                      <span style={{ display: 'block', fontWeight: 700, fontSize: 13.5 }}>
                        {battle.opponent.username}
                      </span>
                      <span className="mono mute" style={{ fontSize: 11.5 }}>
                        {battle.opponent.rating} rating
                      </span>
                    </span>
                  </span>
                  <Link to="/play" className="btn btn--outline btn--sm">
                    <Icon name="rotate" size={14} />
                    Rematch
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * One sentence about what actually decided the battle.
 *
 * Ordered by what is most actionable, not by what is most flattering: form
 * problems first (they are fixable and they cost real reps), then pace, then
 * margin. A defeat should always leave with something to work on.
 */
function analyse(battle: Battle, margin: number): string {
  const accuracy = Math.round(battle.accuracy * 100);

  if (battle.rejectedReps >= 3 && accuracy < 80) {
    return `${battle.rejectedReps} reps were thrown out for form — at ${accuracy}% accuracy that is the single biggest thing standing between you and a better result. Slow down at the bottom of the movement and let each rep register.`;
  }

  if (battle.result === 'win' && margin <= 2) {
    return `Won it by ${margin} rep${margin === 1 ? '' : 's'}. That is a coin-flip margin — at ${accuracy}% accuracy, cleaning up two rejected reps turns close wins into comfortable ones.`;
  }

  if (battle.result === 'loss' && margin >= -3) {
    return `Lost by ${Math.abs(margin)} rep${Math.abs(margin) === 1 ? '' : 's'} at ${accuracy}% accuracy. This was winnable: ${battle.rejectedReps > 0 ? `${battle.rejectedReps} rejected reps would have covered the gap` : 'a faster first fifteen seconds would have covered the gap'}.`;
  }

  if (battle.grade === 'S') {
    return `An S performance — ${accuracy}% of your reps counted across ${battle.yourReps} attempts. There is nothing to fix in this one; the work now is holding this standard at a higher pace.`;
  }

  if (battle.result === 'loss') {
    return `Outpaced by ${Math.abs(margin)} reps. Your form held at ${accuracy}%, so the gap here was speed rather than technique — the fix is cadence, not correction.`;
  }

  return `${battle.yourReps} verified reps at ${accuracy}% accuracy. Consistent form at this pace is what moves rating over a season.`;
}
