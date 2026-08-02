import { Injectable, Logger } from '@nestjs/common';
import {
  ACHIEVEMENTS_BY_ID,
  RARITY_XP,
  crossedTier,
  currentSeason,
  dailyMissions,
  dayKey,
  evaluateAchievements,
  gradeForPerformance,
  levelForXp,
  parRepsFor,
  rankForRating,
  resolveMissions,
  weekKey,
  weeklyMissions,
  xpForMatch,
  type AchievementMetrics,
  type AchievementProgress,
  type AppNotification,
  type Grade,
  type MatchMode,
  type MissionCounters,
  type MissionState,
  type NotificationCategory,
  type Rarity,
  type XpAward,
} from '@repx/shared';
import { PrismaService } from '../../prisma/prisma.service';

/** Everything one player earned from one match. Assembled inside the settle so
 *  the result screen celebrates exactly what was written to the database. */
export interface MatchRewards {
  grade: Grade;
  xp: XpAward;
  levelBefore: number;
  levelAfter: number;
  tierChange: 'promotion' | 'demotion' | null;
  unlocked: { id: string; name: string; rarity: Rarity; icon: string }[];
  missionsCompleted: { id: string; name: string; xp: number }[];
}

export interface SettlePlayer {
  userId: string;
  reps: number;
  rejectedReps: number;
  opponentReps: number;
  /** Reps each player had at the halfway whistle — the comeback test. */
  repsAtHalfway: number;
  opponentRepsAtHalfway: number;
  outcome: 'win' | 'loss' | 'draw';
  ratingBefore: number;
  ratingAfter: number;
}

const DAY_MS = 86400000;

/**
 * Owns everything that goes up and never comes down: XP, levels, day streaks,
 * achievements, missions and the notifications they produce.
 *
 * Kept deliberately separate from `EloService`. Rating is zero-sum and
 * adversarial; progression is personal and monotonic. Mixing them is how you end
 * up with a system where losing a match silently erases progress a player
 * genuinely made, which is the single fastest way to lose the players who need
 * the encouragement most.
 *
 * Every reward here is *measured*, never granted: the achievement catalogue and
 * the mission catalogue in `@repx/shared` are evaluated against a snapshot, so
 * there is no bespoke unlock code that one code path can run and another forget.
 */
@Injectable()
export class ProgressionService {
  private readonly logger = new Logger('Progression');

  constructor(private readonly prisma: PrismaService) {}

  /* ------------------------------------------------------------- settle -- */

  /**
   * Called once per settled match, after ELO has been applied, with both
   * players. Returns each player's reward stack keyed by user id.
   */
  async applyMatch(params: {
    matchId: string;
    mode: MatchMode;
    exerciseSlug: string;
    players: SettlePlayer[];
  }): Promise<Map<string, MatchRewards>> {
    const rewards = new Map<string, MatchRewards>();

    for (const player of params.players) {
      try {
        rewards.set(player.userId, await this.applyForPlayer(params, player));
      } catch (err) {
        // A failure to award XP must never lose a settled match. The rating is
        // already committed; progression degrades to "no bonus this time".
        this.logger.error(`Progression failed for ${player.userId}: ${String(err)}`);
      }
    }

    return rewards;
  }

  private async applyForPlayer(
    params: { matchId: string; mode: MatchMode; exerciseSlug: string },
    player: SettlePlayer,
  ): Promise<MatchRewards> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: player.userId } });

    const grade = gradeForPerformance({
      reps: player.reps,
      rejectedReps: player.rejectedReps,
      opponentReps: player.opponentReps,
      parReps: parRepsFor(params.exerciseSlug),
    });

    const xp = xpForMatch({
      outcome: player.outcome,
      mode: params.mode,
      reps: player.reps,
      rejectedReps: player.rejectedReps,
      streak: user.currentStreak,
      grade,
    });

    const levelBefore = levelForXp(user.xp).level;

    // A flawless match is one where the engine threw nothing away. It is the
    // only stat here that rewards *form* independently of effort or outcome.
    const flawless = player.reps > 0 && player.rejectedReps === 0;
    const comeback =
      player.outcome === 'win' && player.repsAtHalfway < player.opponentRepsAtHalfway;

    const today = dayKey();
    const dayStreak = nextDayStreak(user.lastPlayedOn, user.dayStreak, today);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        xp: { increment: xp.total },
        totalReps: { increment: player.reps },
        flawlessMatches: flawless ? { increment: 1 } : undefined,
        perfectGrades: grade === 'S' ? { increment: 1 } : undefined,
        comebacks: comeback ? { increment: 1 } : undefined,
        dayStreak,
        lastPlayedOn: today,
      },
    });

    await this.prisma.matchParticipant.updateMany({
      where: { matchId: params.matchId, userId: user.id },
      data: { grade, xpEarned: xp.total },
    });

    const tierChange =
      params.mode === 'ranked' ? crossedTier(player.ratingBefore, player.ratingAfter) : null;

    if (tierChange) {
      const rank = rankForRating(player.ratingAfter);
      await this.notify(
        user.id,
        tierChange,
        tierChange === 'promotion' ? `Promoted to ${rank.name}` : `Demoted to ${rank.name}`,
        tierChange === 'promotion'
          ? `You crossed into ${rank.name} at ${player.ratingAfter} rating.`
          : `You fell to ${rank.name}. Win it back at ${player.ratingAfter} rating.`,
        '/profile',
      );
    }

    const unlocked = await this.syncAchievements(user.id);
    const missionsCompleted = await this.syncMissions(user.id);

    // Achievement and mission XP is paid on top, in one write rather than one
    // per reward, so a match that completes three things is still a single row
    // update rather than a burst.
    const bonusXp =
      unlocked.reduce((sum, a) => sum + RARITY_XP[a.rarity], 0) +
      missionsCompleted.reduce((sum, m) => sum + m.xp, 0);

    const totalXpAfter = updated.xp + bonusXp;
    if (bonusXp > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { xp: { increment: bonusXp } },
      });
    }

    const levelAfter = levelForXp(totalXpAfter).level;
    if (levelAfter > levelBefore) {
      await this.notify(
        user.id,
        'system',
        `Level ${levelAfter}`,
        `You reached level ${levelAfter}.`,
        '/profile',
      );
    }

    return { grade, xp, levelBefore, levelAfter, tierChange, unlocked, missionsCompleted };
  }

  /* ------------------------------------------------------- achievements -- */

  /** Builds the metric snapshot the catalogue is measured against. */
  private async metricsFor(userId: string): Promise<AchievementMetrics> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    // Distinct exercises with at least one win. Cheap enough per settle, and
    // derived rather than counted so it cannot drift.
    const wonExercises = await this.prisma.matchParticipant.findMany({
      where: { userId, result: 'win' },
      select: { match: { select: { exerciseSlug: true } } },
      distinct: ['matchId'],
    });
    const exercisesWon = new Set(wonExercises.map((p) => p.match.exerciseSlug)).size;

    return {
      matchesPlayed: user.matchesPlayed,
      wins: user.wins,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      rating: user.rating,
      peakRating: user.peakRating,
      totalReps: user.totalReps,
      level: levelForXp(user.xp).level,
      dayStreak: user.dayStreak,
      flawlessMatches: user.flawlessMatches,
      perfectGrades: user.perfectGrades,
      exercisesWon,
      comebacks: user.comebacks,
    };
  }

  /** Persists any achievement that has newly met its target, and notifies. */
  private async syncAchievements(
    userId: string,
  ): Promise<{ id: string; name: string; rarity: Rarity; icon: string }[]> {
    const [metrics, existing] = await Promise.all([
      this.metricsFor(userId),
      this.prisma.achievementUnlock.findMany({ where: { userId } }),
    ]);

    const already = new Set(existing.map((e) => e.achievementId));
    const earned = evaluateAchievements(metrics).filter((a) => a.unlocked && !already.has(a.id));

    const fresh: { id: string; name: string; rarity: Rarity; icon: string }[] = [];

    for (const a of earned) {
      // The unique constraint is the real guard: two matches settling at once
      // for the same player must not double-award.
      const created = await this.prisma.achievementUnlock
        .create({ data: { userId, achievementId: a.id } })
        .catch(() => null);
      if (!created) continue;

      fresh.push({ id: a.id, name: a.name, rarity: a.rarity, icon: a.icon });
      await this.notify(userId, 'achievement', a.name, a.description, '/achievements');
    }

    return fresh;
  }

  async achievementsFor(userId: string): Promise<AchievementProgress[]> {
    const [metrics, unlocks] = await Promise.all([
      this.metricsFor(userId),
      this.prisma.achievementUnlock.findMany({ where: { userId } }),
    ]);

    const unlockedAt: Record<string, string> = {};
    for (const u of unlocks) unlockedAt[u.achievementId] = u.createdAt.toISOString();

    return evaluateAchievements(metrics, unlockedAt);
  }

  /* ------------------------------------------------------------ missions -- */

  /**
   * Recomputes this period's counters from match history rather than
   * incrementing them.
   *
   * Slightly more work per settle, and worth it: an incremented counter that
   * misses one write is wrong forever and invisible, while a derived one
   * self-heals on the next match. It also makes "distinct exercises played
   * today" expressible at all.
   */
  private async countersSince(userId: string, since: Date): Promise<MissionCounters> {
    const rows = await this.prisma.matchParticipant.findMany({
      where: { userId, match: { status: { in: ['completed', 'forfeited'] }, endedAt: { gte: since } } },
      include: { match: { select: { exerciseSlug: true, mode: true } } },
    });

    const exercises = new Set<string>();
    const counters: MissionCounters = {
      matches: 0,
      wins: 0,
      reps: 0,
      exercises: 0,
      flawlessMatches: 0,
      perfectGrades: 0,
      rankedMatches: 0,
    };

    for (const row of rows) {
      counters.matches += 1;
      if (row.result === 'win') counters.wins += 1;
      counters.reps += row.repCount;
      if (row.match.mode === 'ranked') counters.rankedMatches += 1;
      if (row.repCount > 0 && row.rejectedReps === 0) counters.flawlessMatches += 1;
      if (row.grade === 'S') counters.perfectGrades += 1;
      exercises.add(row.match.exerciseSlug);
    }

    counters.exercises = exercises.size;
    return counters;
  }

  private static startOfDay(now = new Date()): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private static startOfWeek(now = new Date()): Date {
    const day = now.getUTCDay() || 7; // Monday = 1
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (day - 1)),
    );
  }

  async missionsFor(userId: string): Promise<{ daily: MissionState[]; weekly: MissionState[] }> {
    const now = new Date();
    const dKey = dayKey(now);
    const wKey = weekKey(now);

    const [dayCounters, weekCounters, rows] = await Promise.all([
      this.countersSince(userId, ProgressionService.startOfDay(now)),
      this.countersSince(userId, ProgressionService.startOfWeek(now)),
      this.prisma.missionProgress.findMany({
        where: { userId, periodKey: { in: [dKey, wKey] } },
      }),
    ]);

    const claimed: Record<string, string> = {};
    for (const row of rows) {
      if (row.claimedAt) claimed[row.missionId] = row.claimedAt.toISOString();
    }

    return {
      daily: resolveMissions(dailyMissions(dKey), 'daily', dKey, dayCounters, claimed),
      weekly: resolveMissions(weeklyMissions(wKey), 'weekly', wKey, weekCounters, claimed),
    };
  }

  /**
   * Marks newly completed missions and pays them out. `claimedAt` doubles as the
   * paid flag — there is no separate claim step, because making a player tap to
   * collect a reward they already earned is friction dressed up as engagement.
   */
  private async syncMissions(userId: string): Promise<{ id: string; name: string; xp: number }[]> {
    const { daily, weekly } = await this.missionsFor(userId);
    const completed: { id: string; name: string; xp: number }[] = [];

    for (const mission of [...daily, ...weekly]) {
      if (!mission.complete || mission.claimedAt) continue;

      const created = await this.prisma.missionProgress
        .create({
          data: {
            userId,
            missionId: mission.id,
            period: mission.period,
            periodKey: mission.periodKey,
            progress: mission.target,
            claimedAt: new Date(),
          },
        })
        .catch(() => null);
      if (!created) continue;

      completed.push({ id: mission.id, name: mission.name, xp: mission.xp });
      await this.notify(
        userId,
        'mission',
        `${mission.name} complete`,
        `${mission.description} — +${mission.xp} XP`,
        '/',
      );
    }

    return completed;
  }

  /* ------------------------------------------------------- notifications -- */

  private async notify(
    userId: string,
    category: NotificationCategory,
    title: string,
    body: string,
    href: string | null,
  ): Promise<void> {
    await this.prisma.notification.create({
      data: { userId, category, title, body, href },
    });
  }

  async notificationsFor(userId: string, limit = 50): Promise<AppNotification[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows.map((n) => ({
      id: n.id,
      category: n.category as NotificationCategory,
      title: n.title,
      body: n.body,
      href: n.href,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async markNotificationsRead(userId: string, ids?: string[]): Promise<{ unread: number }> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    const unread = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return { unread };
  }

  /* --------------------------------------------------------- the summary -- */

  /** One call backing the home screen, so opening the app is a single request
   *  rather than six waterfalled ones. */
  async summaryFor(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const [missions, achievements, unread] = await Promise.all([
      this.missionsFor(userId),
      this.achievementsFor(userId),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    const level = levelForXp(user.xp);
    const recentUnlock = achievements
      .filter((a) => a.unlockedAt)
      .sort((a, b) => (a.unlockedAt! < b.unlockedAt! ? 1 : -1))[0];

    return {
      level,
      season: currentSeason(),
      dayStreak: user.dayStreak,
      missions,
      unreadNotifications: unread,
      achievements: {
        unlocked: achievements.filter((a) => a.unlocked).length,
        total: achievements.length,
        recent: recentUnlock ?? null,
        /** The closest locked achievement — a concrete next thing to chase. */
        nearest:
          achievements
            .filter((a) => !a.unlocked)
            .sort((a, b) => b.progress - a.progress)[0] ?? null,
      },
    };
  }

  /* -------------------------------------------------------- battle history -- */

  /**
   * Battle history. Richer than the profile's recent-match strip: every battle
   * carries its grade, accuracy and XP, so a player can read *why* a result
   * happened rather than only that it did.
   */
  async battlesFor(userId: string, limit = 50) {
    const rows = await this.prisma.matchParticipant.findMany({
      where: { userId, match: { status: { in: ['completed', 'forfeited'] } } },
      include: { match: { include: { participants: { include: { user: true } } } } },
      orderBy: { match: { endedAt: 'desc' } },
      take: limit,
    });

    return rows.map((p) => {
      const opponent = p.match.participants.find((o) => o.userId !== userId);
      const attempted = p.repCount + p.rejectedReps;
      return {
        matchId: p.matchId,
        exerciseSlug: p.match.exerciseSlug,
        mode: p.match.mode,
        result: p.result,
        yourReps: p.repCount,
        opponentReps: opponent?.repCount ?? 0,
        rejectedReps: p.rejectedReps,
        accuracy: attempted > 0 ? p.repCount / attempted : 0,
        grade: (p.grade as Grade | null) ?? null,
        xpEarned: p.xpEarned,
        ratingBefore: p.ratingBefore,
        ratingAfter: p.ratingAfter,
        ratingDelta: p.ratingDelta,
        durationSeconds: p.match.durationSeconds,
        opponent: opponent
          ? {
              id: opponent.userId,
              username: opponent.user.username,
              avatarUrl: opponent.user.avatarUrl,
              rating: opponent.user.rating,
            }
          : null,
        playedAt: (p.match.endedAt ?? p.match.createdAt).toISOString(),
      };
    });
  }
}

/**
 * Day-streak arithmetic, kept as a free function because it is pure and the one
 * piece of this file most worth testing in isolation.
 *
 * Played today → unchanged (a second match must not double-count).
 * Played yesterday → extend. Anything older, or never → reset to 1.
 */
export function nextDayStreak(
  lastPlayedOn: string | null,
  currentStreak: number,
  today: string,
): number {
  if (lastPlayedOn === today) return Math.max(1, currentStreak);

  const yesterday = new Date(new Date(`${today}T00:00:00Z`).getTime() - DAY_MS)
    .toISOString()
    .slice(0, 10);

  return lastPlayedOn === yesterday ? currentStreak + 1 : 1;
}

/** Exported for the achievements catalogue tests. */
export { ACHIEVEMENTS_BY_ID };
