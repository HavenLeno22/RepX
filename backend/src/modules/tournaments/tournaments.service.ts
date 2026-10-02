import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  type CreateTournamentInput,
  type TournamentDetail,
  type TournamentSummary,
  bracketSize,
  buildFirstRound,
  getExercise,
  matchesInRound,
  nextSlot,
  roundCount,
} from '@repx/shared';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Seasonal knockout tournaments.
 *
 * The bracket *mathematics* lives in `@repx/shared` and is unit-tested there.
 * This service owns the part that cannot be a pure function: persistence, the
 * state machine each slot moves through, and the cascade that runs when a result
 * lands.
 *
 * Two decisions shape everything here.
 *
 * **The whole bracket is materialised at draw time**, empty slots and all,
 * rather than a round being created when the previous one finishes. A bracket
 * you can only see one round of is not a bracket — players want to look at the
 * draw and find out who they would meet in the final. It also makes advancement
 * an update of a row that already exists rather than a create-or-update race.
 *
 * **A bye is a real match row with one empty side**, resolved instantly at draw
 * time. Modelling walkovers as an absence would put a special case into every
 * query; modelling them as a match with a `null` opponent and no `matchId` keeps
 * one code path and still records honestly that nobody played.
 */
@Injectable()
export class TournamentsService {
  private readonly logger = new Logger('Tournaments');

  constructor(private readonly prisma: PrismaService) {}

  /* ------------------------------------------------------------ reading -- */

  async list(): Promise<TournamentSummary[]> {
    const rows = await this.prisma.tournament.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { entrants: true } } },
    });

    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      exerciseSlug: t.exerciseSlug,
      status: t.status as TournamentSummary['status'],
      maxEntrants: t.maxEntrants,
      entrantCount: t._count.entrants,
      rounds: t.rounds,
      championId: t.championId,
      createdAt: t.createdAt.toISOString(),
      startedAt: t.startedAt?.toISOString() ?? null,
    }));
  }

  async detail(id: string, viewerId: string): Promise<TournamentDetail> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        entrants: { include: { user: true }, orderBy: { createdAt: 'asc' } },
        matches: { orderBy: [{ round: 'asc' }, { position: 'asc' }] },
      },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');

    // The viewer's next playable slot: ready, and they are one of the two named
    // players. Anything else — pending, live, already decided — is not theirs to
    // start.
    const yours = tournament.matches.find(
      (m) =>
        m.status === 'ready' &&
        (m.aUserId === viewerId || m.bUserId === viewerId),
    );

    return {
      id: tournament.id,
      name: tournament.name,
      exerciseSlug: tournament.exerciseSlug,
      status: tournament.status as TournamentSummary['status'],
      maxEntrants: tournament.maxEntrants,
      entrantCount: tournament.entrants.length,
      rounds: tournament.rounds,
      championId: tournament.championId,
      createdAt: tournament.createdAt.toISOString(),
      startedAt: tournament.startedAt?.toISOString() ?? null,
      entrants: tournament.entrants.map((e) => ({
        userId: e.userId,
        username: e.user.username,
        avatarUrl: e.user.avatarUrl,
        rating: e.user.rating,
        seed: e.seed,
        eliminated: e.eliminated,
      })),
      matches: tournament.matches.map((m) => ({
        id: m.id,
        round: m.round,
        position: m.position,
        aUserId: m.aUserId,
        bUserId: m.bUserId,
        winnerId: m.winnerId,
        matchId: m.matchId,
        status: m.status as 'pending' | 'ready' | 'live' | 'done',
      })),
      joined: tournament.entrants.some((e) => e.userId === viewerId),
      yourMatchId: yours?.id ?? null,
    };
  }

  /* ------------------------------------------------------------ writing -- */

  async create(input: CreateTournamentInput): Promise<TournamentSummary> {
    if (!getExercise(input.exerciseSlug)) {
      throw new BadRequestException('Unknown exercise');
    }

    const created = await this.prisma.tournament.create({
      data: {
        name: input.name,
        exerciseSlug: input.exerciseSlug,
        maxEntrants: input.maxEntrants,
      },
    });

    this.logger.log(`Created tournament "${created.name}" (${created.id})`);
    return {
      id: created.id,
      name: created.name,
      exerciseSlug: created.exerciseSlug,
      status: 'open',
      maxEntrants: created.maxEntrants,
      entrantCount: 0,
      rounds: 0,
      championId: null,
      createdAt: created.createdAt.toISOString(),
      startedAt: null,
    };
  }

  async join(tournamentId: string, userId: string): Promise<void> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { _count: { select: { entrants: true } } },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    if (tournament.status !== 'open') {
      throw new BadRequestException('Registration for this tournament has closed');
    }
    if (tournament._count.entrants >= tournament.maxEntrants) {
      throw new BadRequestException('This tournament is full');
    }

    // The unique constraint on (tournamentId, userId) is the real guard against
    // double registration; catching it here turns a race into a no-op rather
    // than a 500.
    try {
      await this.prisma.tournamentEntry.create({ data: { tournamentId, userId } });
    } catch {
      return;
    }
  }

  async leave(tournamentId: string, userId: string): Promise<void> {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Tournament not found');
    if (tournament.status !== 'open') {
      throw new BadRequestException('You cannot withdraw once the draw is made');
    }
    await this.prisma.tournamentEntry.deleteMany({ where: { tournamentId, userId } });
  }

  /* --------------------------------------------------------------- draw -- */

  /**
   * Makes the draw and opens the first round.
   *
   * Seeds by rating, materialises every slot in every round, then resolves byes
   * — which can cascade, because a field of five gives the top seed a walkover
   * into a round-two slot that may itself still be waiting.
   */
  async start(tournamentId: string, actorId: string): Promise<void> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { entrants: { include: { user: true } } },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    if (tournament.status !== 'open') {
      throw new BadRequestException('This tournament has already started');
    }
    if (tournament.entrants.length < 2) {
      throw new BadRequestException('A tournament needs at least two entrants');
    }

    /**
     * Only an entrant may close registration.
     *
     * RepX has no admin role, so the draw is made by whoever is playing in it —
     * but that is a *narrower* permission than "anyone signed in", and the check
     * was missing entirely. Without it a stranger could close registration on
     * every open tournament the instant it had two entrants, permanently locking
     * out everyone still on their way. The client already only offers the button
     * to entrants; this is the half that cannot be skipped.
     */
    if (!tournament.entrants.some((e) => e.userId === actorId)) {
      throw new ForbiddenException('Only someone entered in this tournament can make the draw');
    }

    const entrants = tournament.entrants.map((e) => ({
      userId: e.userId,
      rating: e.user.rating,
    }));
    const rounds = roundCount(entrants.length);
    const size = bracketSize(entrants.length);
    const firstRound = buildFirstRound(entrants);

    await this.prisma.$transaction(async (tx) => {
      // Seeds, recorded so the bracket can be explained after the fact.
      const bySeed = new Map<string, number>();
      for (const pairing of firstRound) {
        if (pairing.aUserId && pairing.aSeed) bySeed.set(pairing.aUserId, pairing.aSeed);
        if (pairing.bUserId && pairing.bSeed) bySeed.set(pairing.bUserId, pairing.bSeed);
      }
      for (const [userId, seed] of bySeed) {
        await tx.tournamentEntry.updateMany({
          where: { tournamentId, userId },
          data: { seed },
        });
      }

      // Round 0 as drawn.
      for (const pairing of firstRound) {
        const bothKnown = pairing.aUserId !== null && pairing.bUserId !== null;
        await tx.tournamentMatch.create({
          data: {
            tournamentId,
            round: 0,
            position: pairing.position,
            aUserId: pairing.aUserId,
            bUserId: pairing.bUserId,
            status: bothKnown ? 'ready' : 'pending',
          },
        });
      }

      // Every later round, empty, so the whole draw is visible from the start.
      for (let round = 1; round < rounds; round++) {
        const count = matchesInRound(entrants.length, round);
        for (let position = 0; position < count; position++) {
          await tx.tournamentMatch.create({
            data: { tournamentId, round, position, status: 'pending' },
          });
        }
      }

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: 'live', rounds, startedAt: new Date() },
      });
    });

    await this.resolveByes(tournamentId);
    this.logger.log(
      `Draw made for ${tournament.name}: ${entrants.length} entrants, ${size}-slot bracket`,
    );
  }

  /**
   * Walks the bracket resolving any slot that has only one player in it.
   *
   * Loops rather than recursing one level, because advancing a bye can create
   * another one: in a five-player draw, seed 1 walks over into round two and may
   * land opposite a slot whose own feeder was also a bye.
   */
  private async resolveByes(tournamentId: string): Promise<void> {
    for (let pass = 0; pass < 16; pass++) {
      const matches = await this.prisma.tournamentMatch.findMany({
        where: { tournamentId, status: 'pending' },
        orderBy: [{ round: 'asc' }, { position: 'asc' }],
      });

      // A slot is a walkover when exactly one side is filled *and* nothing can
      // still arrive in the other — which for round 0 is true immediately, and
      // for later rounds only once the feeding match is decided.
      let changed = false;
      for (const match of matches) {
        const filled = [match.aUserId, match.bUserId].filter(Boolean).length;
        if (filled !== 1) continue;
        if (match.round > 0 && !(await this.feedersDecided(tournamentId, match.round, match.position))) {
          continue;
        }

        const winnerId = match.aUserId ?? match.bUserId!;
        await this.prisma.tournamentMatch.update({
          where: { id: match.id },
          data: { winnerId, status: 'done' },
        });
        await this.advance(tournamentId, match.round, match.position, winnerId);
        changed = true;
      }

      if (!changed) return;
    }
  }

  /** Both matches feeding a slot have a winner. */
  private async feedersDecided(
    tournamentId: string,
    round: number,
    position: number,
  ): Promise<boolean> {
    const feeders = await this.prisma.tournamentMatch.findMany({
      where: {
        tournamentId,
        round: round - 1,
        position: { in: [position * 2, position * 2 + 1] },
      },
    });
    return feeders.length > 0 && feeders.every((f) => f.status === 'done');
  }

  /* --------------------------------------------------------- advancement -- */

  /**
   * Records a result and moves the winner on.
   *
   * Called by the match gateway when a tournament match settles, so the bracket
   * can never disagree with the match that produced it.
   */
  async reportResult(tournamentMatchId: string, winnerId: string): Promise<void> {
    const match = await this.prisma.tournamentMatch.findUnique({
      where: { id: tournamentMatchId },
    });
    if (!match || match.status === 'done') return;

    const loserId = match.aUserId === winnerId ? match.bUserId : match.aUserId;

    await this.prisma.tournamentMatch.update({
      where: { id: match.id },
      data: { winnerId, status: 'done' },
    });
    if (loserId) {
      await this.prisma.tournamentEntry.updateMany({
        where: { tournamentId: match.tournamentId, userId: loserId },
        data: { eliminated: true },
      });
    }

    await this.advance(match.tournamentId, match.round, match.position, winnerId);
    await this.resolveByes(match.tournamentId);
  }

  /** Places a winner in their next slot, opening it when both sides are known. */
  private async advance(
    tournamentId: string,
    round: number,
    position: number,
    winnerId: string,
  ): Promise<void> {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) return;

    // Winning the final ends the tournament rather than advancing anywhere.
    if (round >= tournament.rounds - 1) {
      await this.prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'finished', championId: winnerId, endedAt: new Date() },
      });
      this.logger.log(`${tournament.name} won by ${winnerId}`);
      return;
    }

    const next = nextSlot(round, position);
    const target = await this.prisma.tournamentMatch.findFirst({
      where: { tournamentId, round: next.round, position: next.position },
    });
    if (!target) return;

    const updated = await this.prisma.tournamentMatch.update({
      where: { id: target.id },
      data: next.slot === 'a' ? { aUserId: winnerId } : { bUserId: winnerId },
    });

    if (updated.aUserId && updated.bUserId && updated.status === 'pending') {
      await this.prisma.tournamentMatch.update({
        where: { id: updated.id },
        data: { status: 'ready' },
      });
    }
  }

  /* ------------------------------------------------- gateway integration -- */

  /** The two players owed a match in this slot, if it is genuinely playable. */
  async playableSlot(
    tournamentMatchId: string,
  ): Promise<{ tournamentId: string; exerciseSlug: string; aUserId: string; bUserId: string } | null> {
    const match = await this.prisma.tournamentMatch.findUnique({
      where: { id: tournamentMatchId },
      include: { tournament: true },
    });
    if (!match || match.status !== 'ready') return null;
    if (!match.aUserId || !match.bUserId) return null;
    return {
      tournamentId: match.tournamentId,
      exerciseSlug: match.tournament.exerciseSlug,
      aUserId: match.aUserId,
      bUserId: match.bUserId,
    };
  }

  async markLive(tournamentMatchId: string, matchId: string): Promise<void> {
    await this.prisma.tournamentMatch.updateMany({
      where: { id: tournamentMatchId, status: 'ready' },
      data: { status: 'live', matchId },
    });
  }

  /** A match that never produced a winner returns its slot to the queue. */
  async releaseSlot(tournamentMatchId: string): Promise<void> {
    await this.prisma.tournamentMatch.updateMany({
      where: { id: tournamentMatchId, status: 'live' },
      data: { status: 'ready', matchId: null },
    });
  }
}
