import { Injectable } from '@nestjs/common';
import { calculateRatingChange, type MatchOutcome } from '@repx/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface AppliedRating {
  userId: string;
  before: number;
  after: number;
  delta: number;
}

/**
 * Owns rating calculation and the append-only rating ledger.
 *
 * `User.rating` is a denormalized cache of the latest EloHistory row and is only
 * ever written here, inside the same transaction that appends the ledger entry —
 * so the cache cannot drift from the ledger. See docs/ELO_SYSTEM.md.
 */
@Injectable()
export class EloService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Applies rating changes for both players of a completed ranked match.
   * Unranked modes skip rating entirely but still record win/loss counters.
   *
   * `counted` is the separate axis: a match voided by anti-cheat records what
   * happened on each participant row but must not move the career record either.
   * Withholding only the rating still let a fabricated frame stream buy a win in
   * the win column, a streak, and every achievement measured against those —
   * which is most of what a cheat is actually farming.
   */
  async applyMatchResult(params: {
    matchId: string;
    ranked: boolean;
    counted?: boolean;
    players: { userId: string; outcome: MatchOutcome }[];
  }): Promise<AppliedRating[]> {
    const { matchId, ranked, players } = params;
    const counted = params.counted ?? true;
    if (players.length !== 2) return [];

    const rows = await this.prisma.user.findMany({
      where: { id: { in: players.map((p) => p.userId) } },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));

    const results: AppliedRating[] = [];

    for (const player of players) {
      const me = byId.get(player.userId);
      const opponentEntry = players.find((p) => p.userId !== player.userId);
      const opponent = opponentEntry ? byId.get(opponentEntry.userId) : undefined;
      if (!me || !opponent) continue;

      const change = ranked
        ? calculateRatingChange({
            rating: me.rating,
            opponentRating: opponent.rating,
            matchesPlayed: me.matchesPlayed,
            outcome: player.outcome,
          })
        : { before: me.rating, after: me.rating, delta: 0, kFactor: 0, expected: 0 };

      const won = player.outcome === 'win';
      const drew = player.outcome === 'draw';
      const nextStreak = won ? me.currentStreak + 1 : 0;

      await this.prisma.$transaction(async (tx) => {
        if (counted) {
          await tx.user.update({
            where: { id: me.id },
            data: {
              rating: change.after,
              peakRating: Math.max(me.peakRating, change.after),
              matchesPlayed: { increment: 1 },
              wins: won ? { increment: 1 } : undefined,
              losses: !won && !drew ? { increment: 1 } : undefined,
              draws: drew ? { increment: 1 } : undefined,
              currentStreak: nextStreak,
              longestStreak: Math.max(me.longestStreak, nextStreak),
            },
          });
        }

        await tx.matchParticipant.updateMany({
          where: { matchId, userId: me.id },
          data: {
            result: player.outcome,
            ratingBefore: change.before,
            ratingAfter: change.after,
            ratingDelta: change.delta,
          },
        });

        if (ranked) {
          await tx.eloHistory.create({
            data: {
              userId: me.id,
              matchId,
              ratingBefore: change.before,
              ratingAfter: change.after,
              delta: change.delta,
              kFactor: change.kFactor,
            },
          });
        }
      });

      results.push({
        userId: me.id,
        before: change.before,
        after: change.after,
        delta: change.delta,
      });
    }

    return results;
  }
}
