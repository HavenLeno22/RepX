import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PLACEMENT_MATCHES,
  msUntilDailyReset,
  rankForRating,
  rankProgress,
  ratingToPromotion,
  type PublicUser,
} from '@repx/shared';
import { Avatar } from '../components/Avatar';
import { Icon, exerciseIcon } from '../components/Icon';
import { CountUp, Reveal, Stagger, StaggerItem } from '../components/motion';
import { Emblem, Empty, GradeBadge, Meter, Panel, Stat, XpBar } from '../components/ui';
import { get } from '../lib/api';
import { warmModel } from '../lib/arena';
import { EASE } from '../lib/motion';
import { useAuth } from '../store/auth';
import { useSummary } from '../store/summary';
import type { Battle } from './Battles';

interface Friend {
  id: string;
  username: string;
  avatarUrl: string | null;
  rating: number;
  presence: 'online' | 'queueing' | 'in-match' | 'offline';
}

/**
 * Home.
 *
 * The old home screen was a dashboard: three panels reporting numbers, and a
 * link to somewhere else. The problem was not that it lacked content — it is
 * that nothing on it was a *reason to press play in the next five seconds*.
 *
 * Every section here answers one of four questions, in this order:
 *   1. Where do I stand?      (rank, rating, points to promotion)
 *   2. What do I do now?      (the Play CTA, and it is the largest thing here)
 *   3. What's in it for me?   (XP, missions, streak, season)
 *   4. Who else is here?      (friends, live count, the top of the ladder)
 *
 * Anything that answers none of those does not belong on this screen.
 */
export function Home() {
  const user = useAuth((s) => s.user);
  const summary = useSummary((s) => s.summary);

  const [battles, setBattles] = useState<Battle[] | null>(null);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [top, setTop] = useState<PublicUser[] | null>(null);
  const [pulse, setPulse] = useState<{ online: number; inMatch: number } | null>(null);

  useEffect(() => {
    void get<Battle[]>('/users/me/battles?limit=4').then(setBattles).catch(() => setBattles([]));
    void get<Friend[]>('/friends').then(setFriends).catch(() => setFriends([]));
    void get<PublicUser[]>('/leaderboard?limit=5').then(setTop).catch(() => setTop([]));
    void get<{ online: number; inMatch: number }>('/pulse').then(setPulse).catch(() => undefined);

    // Start the pose model download from the home screen. By the time the player
    // reaches the lobby and picks an exercise it is usually already in memory,
    // which is what makes entering a match feel instant rather than making the
    // player wait through a 5MB download after an opponent is already waiting.
    void warmModel().catch(() => undefined);
  }, []);

  if (!user) return null;

  const rank = rankForRating(user.rating);
  const toPromotion = ratingToPromotion(user.rating);
  const placementsLeft = PLACEMENT_MATCHES - user.matchesPlayed;
  const winRate = user.matchesPlayed > 0 ? Math.round((user.wins / user.matchesPlayed) * 100) : 0;
  const online = (friends ?? []).filter((f) => f.presence !== 'offline');

  return (
    <div className="col gap-md">
      <Hero
        username={user.username}
        rating={user.rating}
        rankColor={rank.color}
        rankName={rank.name}
        progress={rankProgress(user.rating)}
        toPromotion={toPromotion}
        placementsLeft={placementsLeft}
        playersInMatch={pulse?.inMatch ?? 0}
      />

      <div className="grid grid--sidebar">
        {/* ================================================= main column == */}
        <div className="col gap-md">
          {/* --------------------------------------------------- progress */}
          <Reveal>
            <Panel title="Progress">
              <div className="row between" style={{ marginBottom: 'var(--s2)' }}>
                <span className="row" style={{ gap: 'var(--s2)' }}>
                  <span className="chip chip--xp">
                    <Icon name="chevron-up" size={13} />
                    Level {summary?.level.level ?? 1}
                  </span>
                  {summary && summary.dayStreak > 0 && (
                    <span className="chip chip--warn">
                      <Icon name="flame" size={13} />
                      {summary.dayStreak} day{summary.dayStreak === 1 ? '' : 's'}
                    </span>
                  )}
                </span>
                <span className="mono mute" style={{ fontSize: 12, fontWeight: 700 }}>
                  {summary ? `${summary.level.into} / ${summary.level.need} XP` : '—'}
                </span>
              </div>

              <XpBar progress={summary?.level.progress ?? 0} />

              <div className="grid grid--stats" style={{ marginTop: 'var(--s4)' }}>
                <Stat value={<CountUp value={user.matchesPlayed} />} label="Battles" />
                <Stat value={<CountUp value={user.wins} />} label="Wins" color="var(--win)" icon="trophy" />
                <Stat value={<CountUp value={winRate} suffix="%" />} label="Win rate" />
                <Stat
                  value={<CountUp value={user.currentStreak} />}
                  label="Streak"
                  color={user.currentStreak > 0 ? 'var(--gold)' : undefined}
                  icon={user.currentStreak > 0 ? 'flame' : undefined}
                />
              </div>
            </Panel>
          </Reveal>

          {/* --------------------------------------------------- missions */}
          <Reveal delay={0.04}>
            <Missions summary={summary} />
          </Reveal>

          {/* ---------------------------------------------- recent battles */}
          <Reveal delay={0.08}>
            <Panel title="Recent battles" action="All battles" actionTo="/battles" flush>
              {battles === null ? (
                <div className="panel__body">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8 }} />
                  ))}
                </div>
              ) : battles.length === 0 ? (
                <Empty
                  icon="swords"
                  title="No battles yet"
                  hint="Your first one is 60 seconds away"
                  cta="Find an opponent"
                  ctaTo="/play"
                />
              ) : (
                <Stagger className="list">
                  {battles.map((battle, i) => (
                    <StaggerItem key={battle.matchId} index={i}>
                      <BattleRow battle={battle} />
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </Panel>
          </Reveal>

          {/* -------------------------------------------------- quick play */}
          <Reveal delay={0.12}>
            <Panel title="Quick actions">
              <div className="grid grid--picks">
                <QuickAction to="/play" icon="swords" name="Ranked match" meta="Rating on the line" />
                <QuickAction to="/play" icon="target" name="Practice" meta="No rating change" />
                <QuickAction to="/leaderboard" icon="trophy" name="Leaderboard" meta="See the ladder" />
                <QuickAction to="/achievements" icon="medal" name="Achievements" meta="Chase a trophy" />
              </div>
            </Panel>
          </Reveal>
        </div>

        {/* ===================================================== sidebar == */}
        <div className="col gap-md">
          <Reveal delay={0.02}>
            <SeasonCard summary={summary} />
          </Reveal>

          <Reveal delay={0.06}>
            <Panel title="Friends online" action="All" actionTo="/friends" flush>
              {friends === null ? (
                <div className="panel__body">
                  <div className="skeleton" style={{ height: 44 }} />
                </div>
              ) : online.length === 0 ? (
                <Empty
                  icon="users"
                  title={friends.length === 0 ? 'No friends yet' : 'Nobody online'}
                  hint={
                    friends.length === 0
                      ? 'Add rivals from the leaderboard'
                      : 'They will show up here when they are'
                  }
                  cta={friends.length === 0 ? 'Find players' : undefined}
                  ctaTo={friends.length === 0 ? '/leaderboard' : undefined}
                />
              ) : (
                <div className="list">
                  {online.slice(0, 5).map((friend) => (
                    <Link key={friend.id} to="/friends" className="listrow">
                      <Avatar
                        username={friend.username}
                        src={friend.avatarUrl}
                        size={32}
                        presence={friend.presence}
                      />
                      <span className="listrow__main">
                        <span className="listrow__name">{friend.username}</span>
                        <span className="listrow__sub">
                          {friend.presence === 'in-match'
                            ? 'In a match'
                            : friend.presence === 'queueing'
                              ? 'Searching'
                              : 'Online'}
                        </span>
                      </span>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 800 }}>
                        {friend.rating}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
          </Reveal>

          <Reveal delay={0.1}>
            <AchievementCard summary={summary} />
          </Reveal>

          <Reveal delay={0.14}>
            <Panel title="Top of the ladder" action="Full board" actionTo="/leaderboard" flush>
              {top === null ? (
                <div className="panel__body">
                  <div className="skeleton" style={{ height: 44 }} />
                </div>
              ) : top.length === 0 ? (
                <Empty icon="trophy" title="Nobody has competed yet" hint="Claim the top spot" cta="Play ranked" ctaTo="/play" />
              ) : (
                <div className="list">
                  {top.map((row, i) => (
                    <div key={row.id} className="listrow" style={{ minHeight: 46, padding: '9px 16px' }}>
                      <span
                        className="mono"
                        style={{
                          width: 16,
                          fontSize: 12.5,
                          fontWeight: 800,
                          color: i === 0 ? 'var(--gold)' : 'var(--text-3)',
                        }}
                      >
                        {i + 1}
                      </span>
                      <Avatar username={row.username} src={row.avatarUrl} size={26} />
                      <span className="listrow__main">
                        <span className="listrow__name" style={{ fontSize: 13.5 }}>
                          {row.username}
                        </span>
                      </span>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 800 }}>
                        {row.rating}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ hero -- */

/**
 * The hero.
 *
 * Carries the three things a competitive player checks before anything else —
 * rank, rating, and how far to the next tier — and the one action the whole
 * product exists for, at a size that makes it impossible to mistake for
 * anything else.
 *
 * The rank colour tints the panel. That is the only place a rank colour is used
 * as a large surface, and it is what makes a Diamond player's home screen feel
 * different from a Bronze player's without a single extra asset.
 */
function Hero({
  username,
  rating,
  rankColor,
  rankName,
  progress,
  toPromotion,
  placementsLeft,
  playersInMatch,
}: {
  username: string;
  rating: number;
  rankColor: string;
  rankName: string;
  progress: number;
  toPromotion: number | null;
  placementsLeft: number;
  playersInMatch: number;
}) {
  return (
    <motion.section
      className="panel"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE.standard }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${rankColor}1a 0%, var(--card) 46%, var(--card) 100%)`,
        borderColor: `${rankColor}2e`,
      }}
    >
      {/* The arena floor, running under the hero only. Home is the one screen
          that should feel like standing in the venue rather than reading about
          it, and the grid is what gives the panel a ground plane. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'var(--tx-grid)',
          opacity: 0.9,
          pointerEvents: 'none',
        }}
      />

      {/* A single soft bloom in the rank colour. Not decoration for its own sake:
          it is what makes the panel read as *your* rank rather than a container
          that happens to mention it. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: -80,
          top: -110,
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${rankColor}33, transparent 66%)`,
          pointerEvents: 'none',
        }}
      />

      {/* The stripe every start gate and piece of gym equipment carries, run down
          the leading edge in the player's own rank colour. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: `linear-gradient(180deg, ${rankColor}, transparent)`,
          pointerEvents: 'none',
        }}
      />

      <div className="panel__body" style={{ position: 'relative', padding: 'var(--s6)' }}>
        <div className="row between wrap-row" style={{ gap: 'var(--s5)', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 240, flex: 1 }}>
            <div className="row" style={{ gap: 'var(--s3)' }}>
              <Emblem rating={rating} size="lg" />
              <div>
                <div className="t-caption mute">Welcome back</div>
                {/* The player's name is the headline of their own card, so it is
                    lettered like a fighter's on a bill rather than set as a
                    subheading. */}
                <div className="t-h1" style={{ marginTop: 1 }}>
                  {username}
                </div>
                <div className="row" style={{ gap: 'var(--s2)', marginTop: 6 }}>
                  <span
                    className="tier"
                    style={{ background: `${rankColor}1f`, color: rankColor }}
                  >
                    <span className="tier__dot" style={{ background: rankColor }} />
                    {rankName}
                  </span>
                  {placementsLeft > 0 && (
                    <span className="chip chip--warn">{placementsLeft} placements left</span>
                  )}
                </div>
              </div>
            </div>

            <div className="row" style={{ gap: 'var(--s6)', marginTop: 'var(--s5)' }}>
              <div>
                <CountUp
                  value={rating}
                  duration={900}
                  className="num num-hero"
                  style={{ color: rankColor, display: 'block', lineHeight: 1 }}
                />
                <div className="stat__l">Fitness rating</div>
              </div>
              {toPromotion !== null && (
                <div style={{ flex: 1, minWidth: 150, maxWidth: 260 }}>
                  <div className="row between" style={{ marginBottom: 6 }}>
                    <span className="t-caption mute">To promotion</span>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 800 }}>
                      {toPromotion}
                    </span>
                  </div>
                  <Meter progress={progress} color={rankColor} />
                </div>
              )}
            </div>
          </div>

          {/* The primary action. Deliberately the single largest interactive
              element on the screen — if a player only ever notices one thing
              here, this has to be it. */}
          <div className="col gap-sm" style={{ minWidth: 220, flex: '0 1 260px' }}>
            <Link to="/play" className="btn btn--play btn--lg btn--block">
              <Icon name="swords" size={21} strokeWidth={2.2} />
              Play ranked
            </Link>
            <div className="row" style={{ justifyContent: 'center', gap: 'var(--s2)' }}>
              <span className="chip">60-second rounds</span>
              {playersInMatch > 0 && (
                <span className="chip chip--ok">
                  <span className="chip__dot chip__dot--pulse" />
                  {playersInMatch} in a match
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/* -------------------------------------------------------------- missions -- */

function Missions({ summary }: { summary: ReturnType<typeof useSummary.getState>['summary'] }) {
  const [resetIn, setResetIn] = useState(msUntilDailyReset());

  useEffect(() => {
    const id = setInterval(() => setResetIn(msUntilDailyReset()), 30_000);
    return () => clearInterval(id);
  }, []);

  const hours = Math.floor(resetIn / 3_600_000);
  const minutes = Math.floor((resetIn % 3_600_000) / 60_000);

  if (!summary) {
    return (
      <Panel title="Today's missions">
        <div className="skeleton" style={{ height: 132 }} />
      </Panel>
    );
  }

  const missions = [...summary.missions.daily, ...summary.missions.weekly];
  const done = missions.filter((m) => m.complete).length;

  return (
    <section className="panel">
      <header className="panel__head">
        <span className="panel__title">Missions</span>
        <span className="row" style={{ gap: 'var(--s2)' }}>
          <span className="chip">
            {done}/{missions.length} done
          </span>
          <span className="chip">
            <Icon name="clock" size={12} />
            {hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`}
          </span>
        </span>
      </header>
      <div className="panel__body col gap-sm">
        {missions.map((mission, i) => (
          <motion.div
            key={`${mission.period}-${mission.id}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04, duration: 0.28, ease: EASE.standard }}
            className="row"
            style={{
              gap: 'var(--s3)',
              padding: 'var(--s3)',
              borderRadius: 'var(--r-input)',
              // A finished mission is progress, not an action, so it is struck in
              // brass. Lime on this row would compete with the Play button for
              // the same glance and lose the product its only urgent colour.
              background: mission.complete ? 'var(--brass-wash)' : 'var(--card-2)',
              boxShadow: mission.complete
                ? 'inset 0 0 0 1px var(--brass-edge)'
                : 'inset 0 1px 0 var(--bevel)',
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 'var(--r-input)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                background: mission.complete ? 'var(--brass)' : 'var(--card)',
                color: mission.complete ? '#2a1c05' : 'var(--text-3)',
              }}
            >
              <Icon name={mission.complete ? 'check' : (mission.icon as never)} size={17} />
            </span>

            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="row between" style={{ gap: 'var(--s2)' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{mission.name}</span>
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: mission.complete ? 'var(--brass-lit)' : 'var(--text-3)',
                  }}
                >
                  +{mission.xp}
                </span>
              </span>
              <span
                className="row between"
                style={{ gap: 'var(--s3)', marginTop: 5, alignItems: 'center' }}
              >
                <span style={{ flex: 1 }}>
                  <Meter
                    progress={mission.progress}
                    thin
                    color={mission.complete ? 'var(--brass)' : 'var(--text-3)'}
                  />
                </span>
                <span className="mono mute" style={{ fontSize: 11.5, fontWeight: 700 }}>
                  {mission.current}/{mission.target}
                </span>
              </span>
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- season -- */

function SeasonCard({ summary }: { summary: ReturnType<typeof useSummary.getState>['summary'] }) {
  if (!summary) {
    return (
      <Panel title="Season">
        <div className="skeleton" style={{ height: 88 }} />
      </Panel>
    );
  }

  const { season } = summary;

  return (
    <section className="panel">
      <header className="panel__head">
        <span className="panel__title">Season {season.number}</span>
        <span className={`chip ${season.endingSoon ? 'chip--warn' : ''}`}>
          {season.daysLeft} day{season.daysLeft === 1 ? '' : 's'} left
        </span>
      </header>
      <div className="panel__body">
        <div className="t-h3" style={{ marginBottom: 2 }}>
          {season.name}
        </div>
        <div className="t-sm mute" style={{ marginBottom: 'var(--s4)' }}>
          {season.endingSoon
            ? 'Final week — your rank locks in when it ends'
            : 'Your rank locks in when the season ends'}
        </div>
        <Meter progress={season.progress} color={season.endingSoon ? 'var(--warn)' : 'var(--cyan)'} />
        <div className="row between" style={{ marginTop: 6 }}>
          <span className="t-caption mute">{Math.round(season.progress * 100)}% elapsed</span>
          <span className="t-caption mute">
            Ends {new Date(season.endsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- achievements -- */

function AchievementCard({
  summary,
}: {
  summary: ReturnType<typeof useSummary.getState>['summary'];
}) {
  if (!summary) {
    return (
      <Panel title="Achievements">
        <div className="skeleton" style={{ height: 88 }} />
      </Panel>
    );
  }

  const { achievements } = summary;
  const nearest = achievements.nearest;

  return (
    <Panel title="Achievements" action="All" actionTo="/achievements">
      <div className="row between" style={{ marginBottom: 'var(--s3)' }}>
        <span className="num" style={{ fontSize: 22 }}>
          {achievements.unlocked}
          <span className="mute" style={{ fontSize: 15 }}> / {achievements.total}</span>
        </span>
        <span className="chip chip--gold">
          <Icon name="medal" size={13} />
          Unlocked
        </span>
      </div>

      <Meter progress={achievements.unlocked / Math.max(1, achievements.total)} color="var(--gold)" />

      {nearest && (
        <>
          <div className="divider" />
          {/* The closest locked achievement, not a random one. "You are 3 wins
              from Ladder Climber" is a reason to play; a grid of things you have
              not done is a reason to close the app. */}
          <div className="t-caption mute" style={{ marginBottom: 6 }}>
            Closest
          </div>
          <div className="row" style={{ gap: 'var(--s2)' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 14, display: 'block' }}>{nearest.name}</span>
              <span className="t-sm mute">{nearest.description}</span>
            </span>
            <span className="mono" style={{ fontSize: 12.5, fontWeight: 800 }}>
              {nearest.current}/{nearest.target}
            </span>
          </div>
          <div style={{ marginTop: 8 }}>
            <Meter progress={nearest.progress} thin color="var(--gold)" />
          </div>
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ bits -- */

function QuickAction({
  to,
  icon,
  name,
  meta,
}: {
  to: string;
  icon: Parameters<typeof Icon>[0]['name'];
  name: string;
  meta: string;
}) {
  return (
    <Link to={to} className="pick">
      <span className="pick__icon">
        <Icon name={icon} size={19} />
      </span>
      <span className="pick__name">{name}</span>
      <span className="pick__meta">{meta}</span>
    </Link>
  );
}

export function BattleRow({ battle }: { battle: Battle }) {
  return (
    <Link to="/battles" className="listrow">
      <span className="flagbar" style={{ background: resultColor(battle.result) }} />
      {battle.grade && <GradeBadge grade={battle.grade} size={30} />}
      <span className="listrow__main">
        <span className="listrow__name" style={{ textTransform: 'capitalize' }}>
          {battle.exerciseSlug.replace('-', ' ')}
        </span>
        <span className="listrow__sub">
          <Icon name={exerciseIcon(battle.exerciseSlug)} size={11} />
          vs {battle.opponent?.username ?? 'Unknown'}
        </span>
      </span>
      <span className="mono" style={{ fontSize: 13.5, fontWeight: 800 }}>
        {battle.yourReps}–{battle.opponentReps}
      </span>
      {battle.ratingDelta !== null && battle.ratingDelta !== 0 && (
        <span
          className="mono"
          style={{
            fontSize: 13,
            fontWeight: 800,
            width: 40,
            textAlign: 'right',
            color: battle.ratingDelta > 0 ? 'var(--win)' : 'var(--loss)',
          }}
        >
          {battle.ratingDelta > 0 ? '+' : ''}
          {battle.ratingDelta}
        </span>
      )}
    </Link>
  );
}

export function resultColor(result: string | null): string {
  if (result === 'win') return 'var(--win)';
  if (result === 'loss') return 'var(--loss)';
  return 'var(--draw)';
}
