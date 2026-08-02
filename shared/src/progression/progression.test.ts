/**
 * Progression regression tests.
 *
 * These cover the arithmetic that decides what a player is told they earned. It
 * is the kind of code that is easy to get subtly wrong and impossible to notice
 * — a level curve that is off by one is invisible until someone counts, and by
 * then it is in production and in their history.
 *
 * Run with the rest: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACHIEVEMENTS,
  MAX_LEVEL,
  currentSeason,
  dailyMissions,
  dayKey,
  evaluateAchievements,
  gradeForPerformance,
  levelForXp,
  weekKey,
  weeklyMissions,
  xpAtLevelStart,
  xpForMatch,
  xpToAdvance,
  type AchievementMetrics,
} from './index';

/* -------------------------------------------------------------- levels -- */

test('levels: zero XP is level 1 with nothing banked', () => {
  const state = levelForXp(0);
  assert.equal(state.level, 1);
  assert.equal(state.into, 0);
  assert.equal(state.progress, 0);
});

test('levels: the curve is continuous — no XP value lands between levels', () => {
  // Walk every boundary and check that one XP short is the level below and
  // exactly on it is the level above. An off-by-one here would strand players
  // permanently at 99% of a level.
  for (let level = 1; level < 30; level++) {
    const start = xpAtLevelStart(level);
    assert.equal(levelForXp(start).level, level, `XP ${start} should start level ${level}`);
    assert.equal(
      levelForXp(start - 1).level,
      Math.max(1, level - 1),
      `XP ${start - 1} should still be level ${level - 1}`,
    );
  }
});

test('levels: progress within a level is monotonic and bounded', () => {
  const need = xpToAdvance(5);
  const start = xpAtLevelStart(5);
  let last = -1;
  for (let i = 0; i < need; i++) {
    const { progress, level } = levelForXp(start + i);
    assert.equal(level, 5);
    assert.ok(progress >= 0 && progress < 1);
    assert.ok(progress > last, 'progress must increase with XP');
    last = progress;
  }
});

test('levels: the cap holds and does not overflow', () => {
  const huge = levelForXp(50_000_000);
  assert.equal(huge.level, MAX_LEVEL);
  assert.equal(huge.progress, 1);
});

/* ------------------------------------------------------------------ xp -- */

test('xp: a loss still pays out', () => {
  const award = xpForMatch({
    outcome: 'loss',
    mode: 'ranked',
    reps: 20,
    rejectedReps: 4,
    streak: 0,
    grade: 'C',
  });
  // The whole point of separating XP from rating: a player on a losing run must
  // still see something move forward, or they stop opening the app.
  assert.ok(award.total > 0, 'a defeat must earn XP');
});

test('xp: a win beats a loss for identical work', () => {
  const shared = { mode: 'ranked' as const, reps: 30, rejectedReps: 0, streak: 0, grade: 'A' as const };
  assert.ok(
    xpForMatch({ ...shared, outcome: 'win' }).total >
      xpForMatch({ ...shared, outcome: 'loss' }).total,
  );
});

test('xp: unranked modes earn less than ranked', () => {
  const shared = { outcome: 'win' as const, reps: 30, rejectedReps: 0, streak: 0, grade: 'A' as const };
  const ranked = xpForMatch({ ...shared, mode: 'ranked' }).total;
  assert.ok(xpForMatch({ ...shared, mode: 'quick' }).total < ranked);
  assert.ok(xpForMatch({ ...shared, mode: 'friendly' }).total < ranked);
});

test('xp: the streak bonus is capped', () => {
  const shared = { outcome: 'win' as const, mode: 'ranked' as const, reps: 20, rejectedReps: 0, grade: 'B' as const };
  const atFive = xpForMatch({ ...shared, streak: 5 }).total;
  const atFifty = xpForMatch({ ...shared, streak: 50 }).total;
  // Uncapped, a long streak would make a returning player's first match feel
  // worthless by comparison.
  assert.equal(atFive, atFifty);
});

test('xp: the line items add up to the total', () => {
  const award = xpForMatch({
    outcome: 'win',
    mode: 'ranked',
    reps: 25,
    rejectedReps: 2,
    streak: 3,
    grade: 'S',
  });
  const summed = award.lines.reduce((sum, line) => sum + line.xp, 0);
  assert.equal(summed, award.total, 'the breakdown shown to the player must reconcile');
});

/* --------------------------------------------------------------- grade -- */

test('grade: perfect form at pace beats sloppy volume', () => {
  const clean = gradeForPerformance({ reps: 34, rejectedReps: 0, opponentReps: 30, parReps: 34 });
  const sloppy = gradeForPerformance({ reps: 34, rejectedReps: 20, opponentReps: 30, parReps: 34 });
  assert.equal(clean, 'S');
  assert.ok(['C', 'D'].includes(sloppy));
});

test('grade: you can lose with a high grade', () => {
  // The grade rates the performance, not the outcome — a player outmatched on
  // rating still needs something to improve that is within their control.
  const grade = gradeForPerformance({ reps: 40, rejectedReps: 0, opponentReps: 55, parReps: 34 });
  assert.ok(['S', 'A'].includes(grade));
});

test('grade: a match with no reps is the floor, not a division by zero', () => {
  assert.equal(gradeForPerformance({ reps: 0, rejectedReps: 0, opponentReps: 0, parReps: 34 }), 'D');
});

test('grade: bad form caps the grade regardless of volume', () => {
  // Enormous volume, half of it rejected. Without the accuracy ceiling this
  // scored an A, which would have taught players that flailing faster works.
  const grade = gradeForPerformance({ reps: 60, rejectedReps: 60, opponentReps: 10, parReps: 34 });
  assert.equal(grade, 'C');
});

/* -------------------------------------------------------- achievements -- */

const BLANK: AchievementMetrics = {
  matchesPlayed: 0,
  wins: 0,
  currentStreak: 0,
  longestStreak: 0,
  rating: 1000,
  peakRating: 1000,
  totalReps: 0,
  level: 1,
  dayStreak: 0,
  flawlessMatches: 0,
  perfectGrades: 0,
  exercisesWon: 0,
  comebacks: 0,
};

test('achievements: every definition is unique and reachable', () => {
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  assert.equal(ids.size, ACHIEVEMENTS.length, 'duplicate achievement id');
  for (const achievement of ACHIEVEMENTS) {
    assert.ok(achievement.target > 0, `${achievement.id} has an unreachable target`);
    assert.ok(achievement.name.length > 0);
    assert.ok(achievement.icon.length > 0);
  }
});

test('achievements: a fresh account has unlocked nothing', () => {
  const unlocked = evaluateAchievements(BLANK).filter((a) => a.unlocked);
  assert.equal(unlocked.length, 0);
});

test('achievements: once earned, a falling metric cannot revoke it', () => {
  // Rating and current streak can both go down. A trophy that vanishes is worse
  // than one that was never awarded.
  const earned = evaluateAchievements({ ...BLANK, peakRating: 2100 });
  const diamond = earned.find((a) => a.id === 'diamond-tier');
  assert.ok(diamond?.unlocked);

  const later = evaluateAchievements(
    { ...BLANK, peakRating: 1400 },
    { 'diamond-tier': new Date().toISOString() },
  );
  assert.ok(later.find((a) => a.id === 'diamond-tier')?.unlocked, 'must stay earned');
});

test('achievements: progress is clamped to 0..1', () => {
  for (const achievement of evaluateAchievements({ ...BLANK, totalReps: 10_000_000 })) {
    assert.ok(achievement.progress >= 0 && achievement.progress <= 1);
  }
});

/* ------------------------------------------------------------ missions -- */

test('missions: the same day always yields the same set', () => {
  const a = dailyMissions('2026-08-02').map((m) => m.id);
  const b = dailyMissions('2026-08-02').map((m) => m.id);
  assert.deepEqual(a, b);
});

test('missions: a set never repeats a mission', () => {
  for (let day = 1; day <= 28; day++) {
    const key = `2026-08-${String(day).padStart(2, '0')}`;
    const ids = dailyMissions(key).map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate mission on ${key}`);
  }
});

test('missions: consecutive days are not identical sets', () => {
  // A rotation that returns the same three missions every day is not a rotation.
  let changed = 0;
  for (let day = 1; day < 28; day++) {
    const today = dailyMissions(`2026-08-${String(day).padStart(2, '0')}`).map((m) => m.id).join();
    const tomorrow = dailyMissions(`2026-08-${String(day + 1).padStart(2, '0')}`)
      .map((m) => m.id)
      .join();
    if (today !== tomorrow) changed += 1;
  }
  assert.ok(changed > 20, `rotation is too static: only ${changed}/27 days changed`);
});

test('missions: weekly sets are stable within a week and rotate between them', () => {
  assert.deepEqual(
    weeklyMissions('2026-W31').map((m) => m.id),
    weeklyMissions('2026-W31').map((m) => m.id),
  );
  assert.notDeepEqual(
    weeklyMissions('2026-W31').map((m) => m.id),
    weeklyMissions('2026-W32').map((m) => m.id),
  );
});

test('missions: period keys have the shape the database indexes on', () => {
  assert.match(dayKey(new Date('2026-08-02T22:00:00Z')), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(weekKey(new Date('2026-08-02T22:00:00Z')), /^\d{4}-W\d{2}$/);
});

/* -------------------------------------------------------------- season -- */

test('season: numbering starts at 1 and never gaps', () => {
  const first = currentSeason(new Date('2026-01-05T00:00:00Z'));
  assert.equal(first.number, 1);
  assert.equal(first.progress, 0);

  const lastDay = currentSeason(new Date('2026-03-01T00:00:00Z'));
  assert.equal(lastDay.number, 1);

  const second = currentSeason(new Date('2026-03-02T00:00:00Z'));
  assert.equal(second.number, 2, 'season 2 must begin the instant season 1 ends');
});

test('season: progress and days-left agree with each other', () => {
  const mid = currentSeason(new Date('2026-02-02T00:00:00Z'));
  assert.ok(mid.progress > 0 && mid.progress < 1);
  assert.ok(mid.daysLeft > 0 && mid.daysLeft <= 56);
  assert.equal(mid.endingSoon, mid.daysLeft <= 7);
});

test('season: a date before the epoch does not produce season zero', () => {
  const early = currentSeason(new Date('2025-06-01T00:00:00Z'));
  assert.equal(early.number, 1);
});
