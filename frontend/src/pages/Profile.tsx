import { motion } from 'framer-motion';
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RARITY_COLORS,
  levelForXp,
  rankForRating,
  rankProgress,
  ratingToPromotion,
  type AchievementProgress,
  type PublicUser,
} from '@repx/shared';
import { Avatar } from '../components/Avatar';
import { Icon, exerciseIcon, type IconName } from '../components/Icon';
import { CountUp, Reveal } from '../components/motion';
import { Emblem, Empty, ErrorState, Meter, Panel, RarityRing, Stat, Tier, XpBar } from '../components/ui';
import { get } from '../lib/api';
import { EASE } from '../lib/motion';
import { useAuth } from '../store/auth';
import { useSummary } from '../store/summary';
import { BattleRow } from './Home';
import type { Battle } from './Battles';

interface Stats extends PublicUser {
  rank: string;
  winRate: number;
  exerciseBreakdown: { exerciseSlug: string; matches: number; wins: number; totalReps: number }[];
  ratingHistory: { rating: number; delta: number; at: string }[];
}

/**
 * The profile.
 *
 * A profile is a *record*, not a settings page — the old one opened with an
 * "Edit" button, which told a visitor the most interesting thing about this
 * player was that they could change their username.
 *
 * Every element here is evidence: a banner in your rank's colour, your emblem,
 * peak versus current, the shape of your rating over time, what you are good at
 * and what you avoid, and the trophies you have. Editing is a small outline
 * button, where it belongs.
 */
export function Profile() {
  const user = useAuth((s) => s.user);
  const summary = useSummary((s) => s.summary);

  const [stats, setStats] = useState<Stats | null>(null);
  const [battles, setBattles] = useState<Battle[] | null>(null);
  const [achievements, setAchievements] = useState<AchievementProgress[] | null>(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    void get<Stats>('/users/me/stats').then(setStats).catch(() => setError(true));
    void get<Battle[]>('/users/me/battles?limit=5').then(setBattles).catch(() => setBattles([]));
    void get<AchievementProgress[]>('/users/me/achievements')
      .then(setAchievements)
      .catch(() => setAchievements([]));
  }

  useEffect(load, []);

  if (error) {
    return (
      <div className="panel">
        <ErrorState message="Could not load your profile" onRetry={load} />
      </div>
    );
  }

  if (!stats || !user) {
    return (
      <div className="col gap-md">
        <div className="skeleton" style={{ height: 230 }} />
        <div className="skeleton" style={{ height: 96 }} />
        <div className="grid grid--split">
          <div className="skeleton" style={{ height: 260 }} />
          <div className="skeleton" style={{ height: 260 }} />
        </div>
      </div>
    );
  }

  const rank = rankForRating(stats.rating);
  const level = levelForXp(stats.xp);
  const toPromotion = ratingToPromotion(stats.rating);
  const earned = (achievements ?? []).filter((a) => a.unlocked);
  const favourite = [...stats.exerciseBreakdown].sort((a, b) => b.matches - a.matches)[0];

  return (
    <div className="col gap-md">
      {/* ==================================================== hero banner == */}
      <motion.section
        className="panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE.standard }}
        style={{ overflow: 'hidden', borderColor: `${rank.color}2e` }}
      >
        <div
          style={{
            height: 120,
            position: 'relative',
            background: `linear-gradient(120deg, ${rank.color}33, ${rank.color}0d 55%, var(--card))`,
          }}
        >
          {/* A repeating diagonal in the rank colour. Cheap, resolution-free
              texture that stops the banner reading as an empty coloured bar. */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.5,
              backgroundImage: `repeating-linear-gradient(115deg, ${rank.color}14 0 2px, transparent 2px 18px)`,
            }}
          />
        </div>

        <div className="panel__body" style={{ marginTop: -46, position: 'relative' }}>
          <div className="row wrap-row" style={{ alignItems: 'flex-end', gap: 'var(--s4)' }}>
            <div style={{ boxShadow: '0 0 0 4px var(--card)', borderRadius: 'var(--r-avatar)' }}>
              <Avatar username={stats.username} src={stats.avatarUrl} size={88} ring={rank.color} />
            </div>

            <div style={{ flex: 1, minWidth: 180, paddingBottom: 4 }}>
              <div className="t-h1" style={{ fontSize: 26 }}>
                {stats.username}
              </div>
              <div className="row wrap-row" style={{ gap: 'var(--s2)', marginTop: 6 }}>
                <Tier rating={stats.rating} showRating={false} />
                <span className="chip chip--brand">
                  <Icon name="chevron-up" size={12} />
                  Level {level.level}
                </span>
                {stats.country && (
                  <span className="chip">
                    <Icon name="globe" size={12} />
                    {stats.country}
                  </span>
                )}
                {stats.currentStreak >= 3 && (
                  <span className="chip chip--warn">
                    <Icon name="flame" size={12} />
                    {stats.currentStreak} streak
                  </span>
                )}
              </div>
            </div>

            <Link to="/settings" className="btn btn--outline btn--sm" style={{ marginBottom: 4 }}>
              <Icon name="settings" size={15} />
              Edit
            </Link>
          </div>

          {stats.bio && (
            <p className="t-body dim" style={{ marginTop: 'var(--s4)', maxWidth: 640 }}>
              {stats.bio}
            </p>
          )}

          {/* Rating, peak and emblem together. Peak is given the same weight as
              current on purpose: for a player in a slump, peak is the number that
              says the ceiling is real. */}
          <div
            className="row wrap-row"
            style={{ gap: 'var(--s6)', marginTop: 'var(--s5)', alignItems: 'center' }}
          >
            <Emblem rating={stats.rating} size="lg" />
            <div>
              <CountUp
                value={stats.rating}
                duration={950}
                className="num"
                style={{ fontSize: 42, color: rank.color, display: 'block', lineHeight: 1 }}
              />
              <div className="stat__l">Fitness rating</div>
            </div>
            <div>
              <span className="num" style={{ fontSize: 26, color: 'var(--text-2)', display: 'block' }}>
                {stats.peakRating}
              </span>
              <div className="stat__l">Peak</div>
            </div>
            {toPromotion !== null && (
              <div style={{ flex: 1, minWidth: 180, maxWidth: 320 }}>
                <div className="row between" style={{ marginBottom: 6 }}>
                  <span className="t-caption mute">To promotion</span>
                  <span className="mono" style={{ fontSize: 12.5, fontWeight: 800 }}>
                    {toPromotion} pts
                  </span>
                </div>
                <Meter progress={rankProgress(stats.rating)} color={rank.color} />
              </div>
            )}
          </div>

          <div className="divider" />

          <div className="row between" style={{ marginBottom: 6 }}>
            <span className="t-caption mute">Level {level.level}</span>
            <span className="mono mute" style={{ fontSize: 12, fontWeight: 700 }}>
              {level.into} / {level.need} XP
            </span>
          </div>
          <XpBar progress={level.progress} />
        </div>
      </motion.section>

      {/* ======================================================== stats == */}
      <div className="grid grid--stats">
        <Stat value={<CountUp value={stats.matchesPlayed} />} label="Battles" icon="swords" />
        <Stat
          value={<CountUp value={Math.round(stats.winRate * 100)} suffix="%" />}
          label="Win rate"
          color={stats.winRate >= 0.5 ? 'var(--win)' : undefined}
        />
        <Stat value={<CountUp value={stats.wins} />} label="Wins" color="var(--win)" />
        <Stat value={<CountUp value={stats.losses} />} label="Losses" color="var(--loss)" />
        <Stat value={<CountUp value={stats.longestStreak} />} label="Best streak" color="var(--gold)" icon="flame" />
        <Stat
          value={<CountUp value={summary?.dayStreak ?? stats.dayStreak} />}
          label="Day streak"
          color="var(--brand)"
          icon="calendar"
        />
      </div>

      {/* ================================================ charts + range == */}
      <div className="grid grid--split">
        <Reveal>
          <Panel title="Rating over time">
            {stats.ratingHistory.length < 2 ? (
              <Empty
                icon="bar-chart"
                title="Not enough ranked matches"
                hint="Two ranked results draw a curve"
                cta="Play ranked"
                ctaTo="/play"
              />
            ) : (
              <RatingChart points={stats.ratingHistory.map((h) => h.rating)} color={rank.color} />
            )}
          </Panel>
        </Reveal>

        <Reveal delay={0.05}>
          <Panel title="Exercise range">
            {stats.exerciseBreakdown.length < 3 ? (
              <Empty
                icon="grid"
                title="Play three exercises"
                hint="Your range chart needs at least three to draw"
                cta="Pick another"
                ctaTo="/play"
              />
            ) : (
              <Radar breakdown={stats.exerciseBreakdown} />
            )}
          </Panel>
        </Reveal>
      </div>

      {/* ================================================== by exercise == */}
      <Reveal delay={0.08}>
        <Panel title="By exercise" flush>
          {stats.exerciseBreakdown.length === 0 ? (
            <Empty
              icon="dumbbell"
              title="No completed battles"
              hint="Every exercise you fight in gets tracked here"
              cta="Fight your first"
              ctaTo="/play"
            />
          ) : (
            <div className="list">
              {[...stats.exerciseBreakdown]
                .sort((a, b) => b.matches - a.matches)
                .map((row) => {
                  const rate = row.matches > 0 ? row.wins / row.matches : 0;
                  return (
                    <div key={row.exerciseSlug} className="listrow">
                      <span
                        className="empty__icon"
                        style={{ margin: 0, width: 36, height: 36, borderRadius: 'var(--r-input)' }}
                      >
                        <Icon name={exerciseIcon(row.exerciseSlug)} size={17} />
                      </span>
                      <span className="listrow__main">
                        <span className="listrow__name" style={{ textTransform: 'capitalize' }}>
                          {row.exerciseSlug.replace('-', ' ')}
                          {favourite?.exerciseSlug === row.exerciseSlug && (
                            <span
                              className="t-caption"
                              style={{ color: 'var(--gold)', marginLeft: 8, letterSpacing: 0.8 }}
                            >
                              FAVOURITE
                            </span>
                          )}
                        </span>
                        <span className="listrow__sub">{row.totalReps.toLocaleString()} reps total</span>
                      </span>
                      <span style={{ width: 90 }}>
                        <Meter progress={rate} thin color={rate >= 0.5 ? 'var(--win)' : 'var(--text-3)'} />
                      </span>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 800, width: 48, textAlign: 'right' }}>
                        {row.wins}/{row.matches}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </Panel>
      </Reveal>

      {/* ================================================== trophy case == */}
      <Reveal delay={0.1}>
        <Panel title="Trophy case" action="All achievements" actionTo="/achievements">
          {achievements === null ? (
            <div className="skeleton" style={{ height: 76 }} />
          ) : earned.length === 0 ? (
            <Empty
              icon="medal"
              title="No trophies yet"
              hint="Your first win earns one"
              cta="Play ranked"
              ctaTo="/play"
            />
          ) : (
            <div className="row wrap-row" style={{ gap: 'var(--s3)' }}>
              {earned.slice(0, 10).map((achievement) => (
                <Link
                  key={achievement.id}
                  to="/achievements"
                  className="col"
                  style={{ alignItems: 'center', gap: 6, width: 74, textAlign: 'center' }}
                  title={achievement.description}
                >
                  <RarityRing
                    rarity={achievement.rarity}
                    unlocked
                    icon={achievement.icon as IconName}
                    size={48}
                  />
                  <span
                    className="t-caption"
                    style={{
                      color: RARITY_COLORS[achievement.rarity],
                      letterSpacing: 0.3,
                      fontSize: 9.5,
                      lineHeight: 1.25,
                      textTransform: 'none',
                    }}
                  >
                    {achievement.name}
                  </span>
                </Link>
              ))}
              {earned.length > 10 && (
                <Link
                  to="/achievements"
                  className="col"
                  style={{ alignItems: 'center', justifyContent: 'center', width: 74, gap: 6 }}
                >
                  <span className="empty__icon" style={{ margin: 0, width: 48, height: 48 }}>
                    <Icon name="plus" size={18} />
                  </span>
                  <span className="t-caption mute" style={{ fontSize: 9.5 }}>
                    {earned.length - 10} more
                  </span>
                </Link>
              )}
            </div>
          )}
        </Panel>
      </Reveal>

      {/* ================================================ recent battles == */}
      <Reveal delay={0.12}>
        <Panel title="Recent battles" action="Full history" actionTo="/battles" flush>
          {battles === null ? (
            <div className="panel__body">
              <div className="skeleton" style={{ height: 60 }} />
            </div>
          ) : battles.length === 0 ? (
            <Empty
              icon="history"
              title="No battles yet"
              hint="They will all be recorded here"
              cta="Find an opponent"
              ctaTo="/play"
            />
          ) : (
            <div className="list">
              {battles.map((battle) => (
                <BattleRow key={battle.matchId} battle={battle} />
              ))}
            </div>
          )}
        </Panel>
      </Reveal>
    </div>
  );
}

/* ----------------------------------------------------------- rating chart -- */

/**
 * The rating curve.
 *
 * Hand-drawn SVG rather than a charting library: one chart does not justify
 * 40kB of dependency, and a library would need overriding on every axis, grid
 * line and tooltip to obey the palette anyway.
 *
 * The line draws itself in on mount — a rating history is a story with a
 * direction, and drawing it left to right is the cheapest way to say so.
 */
function RatingChart({ points, color }: { points: number[]; color: string }) {
  // Scoped so a second chart on the same page cannot capture this one's fill.
  const uid = useId().replace(/:/g, '');
  const w = 100;
  const h = 40;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * w,
    y: h - ((p - min) / range) * h,
  }));

  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const last = points[points.length - 1];
  const change = last - points[0];

  return (
    <>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 132, overflow: 'visible' }}
        role="img"
        aria-label={`Rating from ${points[0]} to ${last}`}
      >
        <defs>
          <linearGradient id={`ratingFill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          {/*
            The line draws itself by having a window widen across it, rather than
            by animating `pathLength`.

            `pathLength` is the usual way to do this and it is wrong here: Framer
            implements it as a stroke-dash pattern measured in user units, while
            `vectorEffect="non-scaling-stroke"` asks for a stroke measured in
            screen pixels, and `preserveAspectRatio="none"` stretches the two
            spaces apart by a different factor on each axis. The three cannot all
            be satisfied, and the visible result is a finished line left with
            gaps chewed out of it. A clip is measured in one space only, so it
            cannot disagree with itself.
          */}
          <clipPath id={`ratingReveal-${uid}`}>
            <motion.rect
              x={0}
              y={-8}
              height={h + 16}
              initial={{ width: 0 }}
              animate={{ width: w }}
              transition={{ duration: 1.1, ease: EASE.standard }}
            />
          </clipPath>
        </defs>
        <motion.path
          d={area}
          fill={`url(#ratingFill-${uid})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          clipPath={`url(#ratingReveal-${uid})`}
        />
      </svg>

      <div className="row between" style={{ marginTop: 'var(--s3)' }}>
        <span className="t-caption mute">Low {min}</span>
        <span
          className="mono"
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: change >= 0 ? 'var(--win)' : 'var(--loss)',
          }}
        >
          {change >= 0 ? '+' : ''}
          {change} over {points.length} matches
        </span>
        <span className="t-caption mute">High {max}</span>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ radar -- */

/**
 * Exercise range.
 *
 * Plots win rate per exercise. Chosen over the more common "power / endurance /
 * flexibility" radar because those would be invented numbers — this one is
 * measured, and it says something the player can act on: the spikes are what you
 * are good at, and the dents are where rating is available.
 */
function Radar({
  breakdown,
}: {
  breakdown: { exerciseSlug: string; matches: number; wins: number }[];
}) {
  const axes = breakdown.map((b) => ({
    label: b.exerciseSlug.replace('-', ' '),
    value: b.matches > 0 ? b.wins / b.matches : 0,
  }));

  const size = 200;
  const centre = size / 2;
  const radius = size / 2 - 34;

  const point = (index: number, scale: number) => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    return {
      x: centre + Math.cos(angle) * radius * scale,
      y: centre + Math.sin(angle) * radius * scale,
    };
  };

  const shape = axes
    .map((a, i) => {
      // Floored at 8% so an exercise with no wins still has a visible vertex —
      // a polygon that collapses to the centre reads as missing data rather than
      // as a weakness.
      const p = point(i, Math.max(0.08, a.value));
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="col" style={{ alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Win rate by exercise">
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            key={scale}
            points={axes.map((_, i) => Object.values(point(i, scale)).join(',')).join(' ')}
            fill="none"
            stroke="var(--line-soft)"
            strokeWidth={1}
          />
        ))}
        {axes.map((_, i) => {
          const p = point(i, 1);
          return <line key={i} x1={centre} y1={centre} x2={p.x} y2={p.y} stroke="var(--line-soft)" strokeWidth={1} />;
        })}

        <motion.path
          d={`${shape} Z`}
          fill="var(--cyan)"
          fillOpacity={0.16}
          stroke="var(--cyan)"
          strokeWidth={2}
          strokeLinejoin="round"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE.standard }}
          style={{ transformOrigin: `${centre}px ${centre}px` }}
        />

        {axes.map((axis, i) => {
          const p = point(i, 1.2);
          return (
            <text
              key={axis.label}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--text-3)"
              fontSize={8.5}
              fontWeight={700}
              style={{ textTransform: 'capitalize' }}
            >
              {axis.label}
            </text>
          );
        })}
      </svg>

      <span className="t-caption mute" style={{ marginTop: 'var(--s2)' }}>
        Win rate by exercise
      </span>
    </div>
  );
}
