import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RARITY_COLORS, levelForXp, rankForRating } from '@repx/shared';
import { Icon, exerciseIcon, type IconName } from '../components/Icon';
import { MomentumBar } from '../components/MomentumBar';
import { CountUp } from '../components/motion';
import { Emblem, GradeBadge, Meter, Stat, XpBar } from '../components/ui';
import { cue } from '../lib/feedback';
import { EASE, SPRING } from '../lib/motion';
import { useAuth } from '../store/auth';
import { useMatch } from '../store/match';
import { useSummary } from '../store/summary';

const OUTCOME = {
  win: { title: 'Victory', color: 'var(--win)', icon: 'trophy' as IconName },
  loss: { title: 'Defeat', color: 'var(--loss)', icon: 'skull' as IconName },
  draw: { title: 'Draw', color: 'var(--draw)', icon: 'handshake' as IconName },
};

/**
 * The result.
 *
 * This is the emotional peak of the product and it used to be a rating delta and
 * two buttons. Everything a match produced — the grade, the XP and where it came
 * from, the level, the trophies, the missions — was computed and then thrown
 * away before the player saw it.
 *
 * The sequence now is deliberate and staged, in the order a player cares about
 * things: the outcome, the scoreline, the rating, then the rewards, one after
 * another rather than all at once. Roughly 2.5 seconds end to end — long enough
 * to feel like a ceremony, short enough that pressing Play again never has to
 * wait for it.
 *
 * **A defeat is not a punishment.** It gets the same layout, the same XP
 * breakdown and the same care — only the colour and the closing line change. The
 * one thing it does not get is confetti.
 */
export function Result() {
  const result = useMatch((s) => s.result);
  const reset = useMatch((s) => s.reset);
  const user = useAuth((s) => s.user);
  const refreshSummary = useSummary((s) => s.refresh);
  const navigate = useNavigate();
  const [ceremony, setCeremony] = useState(false);

  useEffect(() => {
    if (!result) {
      navigate('/play', { replace: true });
      return;
    }
    cue(result.result === 'win' ? 'victory' : 'defeat');
    // Progression changed, so the badge, the level and the missions in the nav
    // are all stale until this lands.
    void refreshSummary();

    if (result.tierChange === 'promotion') {
      const id = setTimeout(() => setCeremony(true), 1400);
      return () => clearTimeout(id);
    }
  }, [result, navigate, refreshSummary]);

  if (!result || !user) return null;

  const outcome = OUTCOME[result.result];
  const gained = result.ratingDelta > 0;
  const levelledUp = result.levelAfter > result.levelBefore;
  const level = levelForXp(user.xp);
  const attempted = result.yourReps + result.rejectedReps;
  const accuracy = attempted > 0 ? result.yourReps / attempted : 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE.standard }}
        style={{ maxWidth: 520, margin: '0 auto' }}
        className="col gap-md"
      >
        {/* ================================================= the verdict == */}
        <section className="panel" style={{ borderColor: `color-mix(in srgb, ${outcome.color} 30%, transparent)` }}>
          <div
            style={{
              padding: 'var(--s6) var(--s5) var(--s5)',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
              background: `linear-gradient(180deg, color-mix(in srgb, ${outcome.color} 14%, transparent), transparent)`,
            }}
          >
            {result.result === 'win' && <Confetti />}

            <motion.div
              initial={{ scale: 0.4, rotate: -14, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ ...SPRING, delay: 0.1 }}
              style={{
                width: 76,
                height: 76,
                margin: '0 auto',
                borderRadius: 22,
                display: 'grid',
                placeItems: 'center',
                color: outcome.color,
                background: `color-mix(in srgb, ${outcome.color} 14%, transparent)`,
                boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${outcome.color} 40%, transparent)`,
              }}
            >
              <Icon name={outcome.icon} size={36} strokeWidth={1.6} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.35, ease: EASE.standard }}
              className="t-dlg"
              style={{ color: outcome.color, marginTop: 'var(--s3)' }}
            >
              {outcome.title}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.34 }}
              className="row"
              style={{ justifyContent: 'center', gap: 'var(--s2)', marginTop: 'var(--s2)' }}
            >
              <span className="chip" style={{ textTransform: 'capitalize' }}>
                <Icon name={exerciseIcon(result.exerciseSlug)} size={12} />
                {result.exerciseSlug.replace('-', ' ')}
              </span>
              <span className="chip">
                <GradeBadge grade={result.grade} size={16} />
                Grade {result.grade}
              </span>
            </motion.div>
          </div>

          <div className="panel__body" style={{ paddingTop: 0 }}>
            {/* Reuses the in-match bar so the final scoreline reads exactly as it
                did while playing. */}
            <div
              style={{
                background: 'var(--surface)',
                padding: 'var(--s3) var(--s4)',
                borderRadius: 'var(--r-card)',
                marginBottom: 'var(--s4)',
              }}
            >
              <MomentumBar
                compact
                you={{ username: user.username, avatarUrl: user.avatarUrl, reps: result.yourReps }}
                them={{
                  username: result.opponent?.username ?? 'Opponent',
                  avatarUrl: result.opponent?.avatarUrl,
                  reps: result.opponentReps,
                }}
              />
            </div>

            {/* ------------------------------------------------ rating -- */}
            {result.ratingDelta !== 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4, ease: EASE.standard }}
                className="row"
                style={{
                  justifyContent: 'center',
                  gap: 'var(--s4)',
                  padding: 'var(--s4)',
                  borderRadius: 'var(--r-card)',
                  background: 'var(--card-2)',
                }}
              >
                <span className="mono mute" style={{ fontSize: 17 }}>
                  {result.ratingBefore}
                </span>
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ ...SPRING, delay: 0.62 }}
                  style={{
                    color: gained ? 'var(--win)' : 'var(--loss)',
                    fontWeight: 900,
                    fontSize: 17,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <Icon name={gained ? 'chevron-up' : 'chevron-down'} size={16} strokeWidth={2.6} />
                  {gained ? '+' : ''}
                  {result.ratingDelta}
                </motion.span>
                <CountUp
                  value={result.ratingAfter}
                  duration={900}
                  className="num"
                  style={{ fontSize: 30, color: rankForRating(result.ratingAfter).color }}
                />
                <Emblem rating={result.ratingAfter} size="sm" glow={false} />
              </motion.div>
            ) : (
              <div className="row" style={{ justifyContent: 'center', padding: 'var(--s2) 0 var(--s4)' }}>
                <span className="chip">Unranked · no rating change</span>
              </div>
            )}

            {/* ---------------------------------------------- performance -- */}
            <div className="grid grid--stats" style={{ marginTop: 'var(--s4)' }}>
              <Stat value={result.yourReps} label="Your reps" />
              <Stat
                value={`${Math.round(accuracy * 100)}%`}
                label="Accuracy"
                color={accuracy >= 0.9 ? 'var(--ok)' : accuracy >= 0.7 ? undefined : 'var(--warn)'}
              />
              <Stat value={result.rejectedReps} label="Rejected" color={result.rejectedReps > 0 ? 'var(--warn)' : undefined} />
            </div>

            {result.flags.length > 0 && (
              <div className="alert alert--error" style={{ marginTop: 'var(--s4)' }}>
                <Icon name="info" size={17} style={{ marginTop: 1 }} />
                <span>
                  <strong>Integrity flags:</strong> {result.flags.join(', ')}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ==================================================== rewards == */}
        <motion.section
          className="panel"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.4, ease: EASE.standard }}
        >
          <header className="panel__head">
            <span className="panel__title">Rewards</span>
            <span className="chip chip--brand">
              <Icon name="zap" size={12} />+{result.xp.total} XP
            </span>
          </header>
          <div className="panel__body">
            {/* Every line item, so the reward can be audited rather than taken on
                faith. Players trust a number they can add up themselves. */}
            <div className="col" style={{ gap: 7 }}>
              {result.xp.lines.map((line, i) => (
                <motion.div
                  key={line.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 + i * 0.07, duration: 0.26, ease: EASE.standard }}
                  className="row between"
                >
                  <span className="t-sm dim">{line.label}</span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: line.xp >= 0 ? 'var(--text)' : 'var(--text-3)',
                    }}
                  >
                    {line.xp >= 0 ? '+' : ''}
                    {line.xp}
                  </span>
                </motion.div>
              ))}
            </div>

            <div className="divider" />

            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="t-caption mute">
                Level {result.levelAfter}
                {levelledUp && (
                  <span style={{ color: 'var(--brand)', marginLeft: 6 }}>
                    ▲ from {result.levelBefore}
                  </span>
                )}
              </span>
              <span className="mono mute" style={{ fontSize: 12, fontWeight: 700 }}>
                {level.into} / {level.need} XP
              </span>
            </div>
            <XpBar progress={level.progress} />

            {result.unlocked.length > 0 && (
              <>
                <div className="divider" />
                <div className="t-caption mute" style={{ marginBottom: 'var(--s3)' }}>
                  Achievements unlocked
                </div>
                <div className="col gap-sm">
                  {result.unlocked.map((achievement, i) => (
                    <motion.div
                      key={achievement.id}
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ ...SPRING, delay: 1.3 + i * 0.16 }}
                      className="row"
                      style={{
                        gap: 'var(--s3)',
                        padding: 'var(--s3)',
                        borderRadius: 'var(--r-input)',
                        background: `color-mix(in srgb, ${RARITY_COLORS[achievement.rarity]} 12%, transparent)`,
                        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${RARITY_COLORS[achievement.rarity]} 34%, transparent)`,
                      }}
                    >
                      <span
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          display: 'grid',
                          placeItems: 'center',
                          color: RARITY_COLORS[achievement.rarity],
                          background: 'var(--card)',
                        }}
                      >
                        <Icon name={achievement.icon as IconName} size={17} />
                      </span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>
                          {achievement.name}
                        </span>
                        <span
                          className="t-caption"
                          style={{ color: RARITY_COLORS[achievement.rarity], letterSpacing: 0.7 }}
                        >
                          {achievement.rarity}
                        </span>
                      </span>
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            {result.missionsCompleted.length > 0 && (
              <>
                <div className="divider" />
                <div className="t-caption mute" style={{ marginBottom: 'var(--s3)' }}>
                  Missions complete
                </div>
                {result.missionsCompleted.map((mission) => (
                  <div key={mission.id} className="row between" style={{ marginBottom: 6 }}>
                    <span className="row" style={{ gap: 7 }}>
                      <Icon name="check-circle" size={15} style={{ color: 'var(--brand)' }} />
                      <span className="t-sm" style={{ fontWeight: 600 }}>
                        {mission.name}
                      </span>
                    </span>
                    <span className="mono brand" style={{ fontSize: 13, fontWeight: 800 }}>
                      +{mission.xp}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </motion.section>

        {/* ================================================= next action == */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.35, ease: EASE.standard }}
          className="col gap-sm"
        >
          {/* A defeat gets a reason to go again, not a consolation. */}
          {result.result !== 'win' && (
            <div className="alert alert--info" style={{ marginBottom: 0 }}>
              <Icon name="brain" size={17} style={{ marginTop: 1 }} />
              <span>
                {result.rejectedReps > 2
                  ? `${result.rejectedReps} reps were thrown out for form. Cleaning those up is worth more than going faster.`
                  : Math.abs(result.yourReps - result.opponentReps) <= 3
                    ? 'Three reps in it. That is one good fifteen seconds away from a different result.'
                    : 'Your form held. The gap was pace — try a shorter, faster cadence next round.'}
              </span>
            </div>
          )}

          <div className="row gap-sm">
            <button
              className="btn btn--play btn--lg btn--block"
              onClick={() => {
                cue('tap');
                reset();
                navigate('/play');
              }}
            >
              <Icon name="rotate" size={19} strokeWidth={2.2} />
              Play again
            </button>
            <button
              className="btn btn--outline btn--lg"
              onClick={() => {
                reset();
                navigate('/battles');
              }}
            >
              <Icon name="history" size={18} />
            </button>
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {ceremony && (
          <Promotion rating={result.ratingAfter} onClose={() => setCeremony(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

/* --------------------------------------------------------------- confetti -- */

/**
 * Confetti, in the palette only.
 *
 * Twenty-four pieces, all in brand, gold or success — a rainbow burst would put
 * eight colours on screen that mean nothing, in a product where every colour
 * means something. It runs once, for a win, and never for a defeat.
 */
function Confetti() {
  const colors = ['var(--brand)', 'var(--gold)', 'var(--ok)'];
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: 24 }, (_, i) => {
        const angle = (i / 24) * Math.PI * 2;
        const distance = 90 + (i % 5) * 26;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={{
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance + 70,
              opacity: 0,
              rotate: (i % 2 ? 1 : -1) * 260,
              scale: 0.5,
            }}
            transition={{ duration: 1.5 + (i % 4) * 0.22, ease: 'easeOut', delay: 0.14 }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '34%',
              width: i % 3 === 0 ? 5 : 7,
              height: i % 3 === 0 ? 9 : 5,
              borderRadius: 1.5,
              background: colors[i % colors.length],
            }}
          />
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- promotion -- */

/**
 * The promotion ceremony.
 *
 * Takes over the screen, because crossing a tier is the rarest and most
 * significant thing that happens in RepX and burying it in a card would be the
 * design equivalent of mumbling. It fires 1.4 seconds after the result lands, so
 * it interrupts the rewards rather than competing with the verdict.
 *
 * It is dismissible immediately and by any means — backdrop, button, Escape.
 * A celebration that traps you stops being one on the second viewing.
 */
function Promotion({ rating, onClose }: { rating: number; onClose: () => void }) {
  const rank = rankForRating(rating);

  useEffect(() => {
    cue('promotion');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="modal-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Promoted to ${rank.name}`}
    >
      <motion.div
        className="modal"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={SPRING}
        onClick={(e) => e.stopPropagation()}
        style={{
          textAlign: 'center',
          borderColor: `${rank.color}59`,
          background: `linear-gradient(180deg, ${rank.color}1f, var(--card) 55%)`,
        }}
      >
        <div style={{ padding: 'var(--s10) var(--s6) var(--s6)', position: 'relative', overflow: 'hidden' }}>
          {/* A single expanding ring in the rank colour — the "burst" without
              particles, which reads as expensive rather than as a party. */}
          <motion.div
            initial={{ scale: 0.2, opacity: 0.85 }}
            animate={{ scale: 3.4, opacity: 0 }}
            transition={{ duration: 1.3, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              left: '50%',
              top: 96,
              width: 120,
              height: 120,
              marginLeft: -60,
              marginTop: -60,
              borderRadius: '50%',
              border: `2px solid ${rank.color}`,
            }}
          />

          <motion.div
            initial={{ scale: 0.3, rotate: -22 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ ...SPRING, delay: 0.12 }}
            style={{ display: 'grid', placeItems: 'center', position: 'relative' }}
          >
            <Emblem rating={rating} size="lg" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <div className="t-caption" style={{ color: rank.color, marginTop: 'var(--s5)' }}>
              Promoted
            </div>
            <div className="t-dlg" style={{ color: rank.color, marginTop: 4 }}>
              {rank.name}
            </div>
            <div className="t-body dim" style={{ marginTop: 'var(--s2)' }}>
              You crossed into {rank.name} at {rating} rating.
            </div>

            <div style={{ margin: 'var(--s5) auto 0', maxWidth: 260 }}>
              <Meter progress={1} color={rank.color} />
            </div>
          </motion.div>
        </div>

        <div className="panel__body" style={{ paddingTop: 0 }}>
          <button className="btn btn--primary btn--block" onClick={onClose}>
            Continue
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
