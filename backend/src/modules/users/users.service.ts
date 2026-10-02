import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { rankForRating, type PublicUser, type UpdateProfileInput } from '@repx/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { toPublicUser } from './user.mapper';

export interface UserStats extends PublicUser {
  rank: string;
  winRate: number;
  exerciseBreakdown: { exerciseSlug: string; matches: number; wins: number; totalReps: number }[];
  recentMatches: {
    matchId: string;
    exerciseSlug: string;
    result: string | null;
    yourReps: number;
    opponentReps: number;
    opponentUsername: string;
    ratingDelta: number | null;
    playedAt: string;
  }[];
  ratingHistory: { rating: number; delta: number; at: string }[];
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Player not found');
    return toPublicUser(user);
  }

  /** Full profile payload backing the profile screen. */
  async getStats(id: string): Promise<UserStats> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Player not found');

    /**
     * Forfeits count.
     *
     * This asked for `status: 'completed'` only, while the win/loss counters on
     * the User row are incremented for forfeited matches too — so a player who
     * won on a walkover saw the win in their record and in their rating, and
     * then could not find the match anywhere on their own profile. The battle
     * history and the mission counters already include forfeits; this was the
     * one place that disagreed. Voided matches stay out, deliberately: they
     * settled nothing and moved nothing.
     */
    const participations = await this.prisma.matchParticipant.findMany({
      where: { userId: id, match: { status: { in: ['completed', 'forfeited'] } } },
      include: {
        match: { include: { participants: { include: { user: true } } } },
      },
      orderBy: { match: { endedAt: 'desc' } },
      take: 50,
    });

    const breakdown = new Map<string, { matches: number; wins: number; totalReps: number }>();
    for (const p of participations) {
      const entry = breakdown.get(p.match.exerciseSlug) ?? { matches: 0, wins: 0, totalReps: 0 };
      entry.matches += 1;
      if (p.result === 'win') entry.wins += 1;
      entry.totalReps += p.repCount;
      breakdown.set(p.match.exerciseSlug, entry);
    }

    const recentMatches = participations.slice(0, 15).map((p) => {
      const opponent = p.match.participants.find((other) => other.userId !== id);
      return {
        matchId: p.matchId,
        exerciseSlug: p.match.exerciseSlug,
        result: p.result,
        yourReps: p.repCount,
        opponentReps: opponent?.repCount ?? 0,
        opponentUsername: opponent?.user.username ?? 'Unknown',
        ratingDelta: p.ratingDelta,
        playedAt: (p.match.endedAt ?? p.match.createdAt).toISOString(),
      };
    });

    const history = await this.prisma.eloHistory.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return {
      ...toPublicUser(user),
      rank: rankForRating(user.rating).name,
      winRate: user.matchesPlayed > 0 ? user.wins / user.matchesPlayed : 0,
      exerciseBreakdown: [...breakdown.entries()].map(([exerciseSlug, v]) => ({
        exerciseSlug,
        ...v,
      })),
      recentMatches,
      ratingHistory: history.map((h) => ({
        rating: h.ratingAfter,
        delta: h.delta,
        at: h.createdAt.toISOString(),
      })),
    };
  }

  async updateProfile(id: string, input: UpdateProfileInput): Promise<PublicUser> {
    if (input.username) {
      const taken = await this.prisma.user.findFirst({
        where: { username: input.username, NOT: { id } },
      });
      if (taken) throw new ConflictException('That username is taken');
    }

    const user = await this.prisma.user.update({
      where: { id },
      // Only the keys actually present are written, so omitting a field leaves
      // it untouched while explicitly sending null clears it.
      data: {
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
    });

    return toPublicUser(user);
  }

}
