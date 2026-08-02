import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import {
  RARITIES,
  RARITY_COLORS,
  RARITY_ORDER,
  RARITY_XP,
  type AchievementCategory,
  type AchievementProgress,
} from '@repx/shared';
import { Icon, type IconName } from '../components/Icon';
import { CountUp, Stagger, StaggerItem } from '../components/motion';
import { Empty, ErrorState, Meter, RarityRing, Stat } from '../components/ui';
import { get } from '../lib/api';
import { cue } from '../lib/feedback';
import { EASE } from '../lib/motion';

const CATEGORIES: { id: AchievementCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ladder', label: 'Ladder' },
  { id: 'volume', label: 'Volume' },
  { id: 'consistency', label: 'Consistency' },
  { id: 'mastery', label: 'Mastery' },
];

/**
 * Achievements.
 *
 * Two decisions make this feel like a trophy cabinet rather than a checklist:
 *
 * **Locked achievements are shown, not hidden.** You can see the shape of every
 * trophy you have not earned, with a live progress ring on it. A cabinet full of
 * empty slots is what makes anyone go and fill them; a cabinet that only shows
 * what you already own has nothing to say.
 *
 * **Rarity uses the rank ladder's colours.** Diamond looks like Diamond whether
 * it is a ladder position or a trophy, so nobody has to learn a second colour
 * language for the same idea.
 */
export function Achievements() {
  const [items, setItems] = useState<AchievementProgress[] | null>(null);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState<AchievementCategory | 'all'>('all');
  const [hideUnlocked, setHideUnlocked] = useState(false);

  function load() {
    setError(false);
    setItems(null);
    void get<AchievementProgress[]>('/users/me/achievements')
      .then(setItems)
      .catch(() => setError(true));
  }

  useEffect(load, []);

  const stats = useMemo(() => {
    const list = items ?? [];
    const unlocked = list.filter((a) => a.unlocked);
    return {
      unlocked: unlocked.length,
      total: list.length,
      xp: unlocked.reduce((sum, a) => sum + RARITY_XP[a.rarity], 0),
      rarest: unlocked.sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity])[0] ?? null,
    };
  }, [items]);

  const shown = (items ?? [])
    .filter((a) => (category === 'all' || a.category === category) && (!hideUnlocked || !a.unlocked))
    // Unlocked first, then by how close the rest are — so the next thing to
    // chase is always near the top rather than buried alphabetically.
    .sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      if (a.unlocked) return RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
      return b.progress - a.progress;
    });

  return (
    <>
      <div className="head">
        <span className="head__t">Achievements</span>
        {items && (
          <span className="chip chip--gold">
            <Icon name="medal" size={13} />
            {stats.unlocked} of {stats.total}
          </span>
        )}
      </div>

      {items && (
        <>
          <div className="grid grid--stats" style={{ marginBottom: 'var(--s4)' }}>
            <Stat value={<CountUp value={stats.unlocked} />} label="Unlocked" color="var(--gold)" icon="medal" />
            <Stat
              value={<CountUp value={Math.round((stats.unlocked / Math.max(1, stats.total)) * 100)} suffix="%" />}
              label="Completion"
            />
            <Stat value={<CountUp value={stats.xp} />} label="XP from trophies" color="var(--brand)" icon="zap" />
            <Stat
              value={stats.rarest ? stats.rarest.rarity[0].toUpperCase() + stats.rarest.rarity.slice(1) : '—'}
              label="Rarest earned"
              color={stats.rarest ? RARITY_COLORS[stats.rarest.rarity] : undefined}
            />
          </div>

          {/* The rarity ladder, always visible. It is the legend for every colour
              on this screen and doubles as a map of what is left. */}
          <div className="panel" style={{ marginBottom: 'var(--s4)' }}>
            <div className="panel__body row wrap-row" style={{ gap: 'var(--s3)' }}>
              {RARITIES.map((rarity) => {
                const all = (items ?? []).filter((a) => a.rarity === rarity);
                const got = all.filter((a) => a.unlocked).length;
                return (
                  <div key={rarity} style={{ flex: '1 1 120px', minWidth: 110 }}>
                    <div className="row between" style={{ marginBottom: 5 }}>
                      <span
                        className="t-caption"
                        style={{ color: RARITY_COLORS[rarity], letterSpacing: 0.7 }}
                      >
                        {rarity}
                      </span>
                      <span className="mono mute" style={{ fontSize: 11 }}>
                        {got}/{all.length}
                      </span>
                    </div>
                    <Meter
                      progress={all.length ? got / all.length : 0}
                      thin
                      color={RARITY_COLORS[rarity]}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="row wrap-row" style={{ gap: 'var(--s3)', marginBottom: 'var(--s4)' }}>
        <div className="seg" role="group" aria-label="Category" style={{ flex: '1 1 320px' }}>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className="seg__opt"
              aria-pressed={category === c.id}
              onClick={() => {
                setCategory(c.id);
                cue('select');
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button
          className="btn btn--outline btn--sm"
          aria-pressed={hideUnlocked}
          onClick={() => {
            setHideUnlocked(!hideUnlocked);
            cue('toggle');
          }}
        >
          <Icon name={hideUnlocked ? 'check-circle' : 'grid'} size={15} />
          {hideUnlocked ? 'Showing locked' : 'Show all'}
        </button>
      </div>

      {error ? (
        <div className="panel">
          <ErrorState message="Could not load your achievements" onRetry={load} />
        </div>
      ) : items === null ? (
        <div className="grid grid--cards">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 122 }} />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="panel">
          <Empty
            icon="medal"
            title="Everything here is earned"
            hint="Switch category, or go and earn a rarer one"
            cta="Play ranked"
            ctaTo="/play"
          />
        </div>
      ) : (
        <Stagger className="grid grid--cards">
          {shown.map((achievement, i) => (
            <StaggerItem key={achievement.id} index={i} max={16}>
              <Card achievement={achievement} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ card -- */

function Card({ achievement }: { achievement: AchievementProgress }) {
  const color = RARITY_COLORS[achievement.rarity];

  return (
    <motion.article
      className="panel"
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2, ease: EASE.standard }}
      style={{
        height: '100%',
        borderColor: achievement.unlocked ? `${color}3d` : 'var(--line-soft)',
        background: achievement.unlocked
          ? `linear-gradient(150deg, ${color}12, var(--card) 58%)`
          : 'var(--card)',
      }}
    >
      <div className="panel__body col" style={{ gap: 'var(--s3)', height: '100%' }}>
        <div className="row" style={{ gap: 'var(--s3)', alignItems: 'flex-start' }}>
          <RarityRing
            rarity={achievement.rarity}
            unlocked={achievement.unlocked}
            icon={achievement.icon as IconName}
            size={48}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="row between" style={{ gap: 6 }}>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 14.5,
                  letterSpacing: -0.2,
                  color: achievement.unlocked ? 'var(--text)' : 'var(--text-2)',
                }}
              >
                {achievement.name}
              </span>
            </div>
            <span className="t-caption" style={{ color, letterSpacing: 0.7 }}>
              {achievement.rarity}
            </span>
            <p className="t-sm mute" style={{ marginTop: 4, fontWeight: 500 }}>
              {achievement.description}
            </p>
          </div>
        </div>

        <div style={{ marginTop: 'auto' }}>
          {achievement.unlocked ? (
            <div className="row between">
              <span className="chip" style={{ background: `${color}1f`, color }}>
                <Icon name="check" size={12} />
                Earned
              </span>
              <span className="mono mute" style={{ fontSize: 11.5, fontWeight: 700 }}>
                +{RARITY_XP[achievement.rarity]} XP
              </span>
            </div>
          ) : (
            <>
              <div className="row between" style={{ marginBottom: 5 }}>
                <span className="t-caption mute">Progress</span>
                <span className="mono" style={{ fontSize: 11.5, fontWeight: 800 }}>
                  {achievement.current.toLocaleString()} / {achievement.target.toLocaleString()}
                </span>
              </div>
              <Meter progress={achievement.progress} thin color={color} />
            </>
          )}
        </div>
      </div>
    </motion.article>
  );
}
