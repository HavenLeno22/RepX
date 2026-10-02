import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { rankForRating } from '@repx/shared';
import { isPostgres } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { toPublicUser } from '../users/user.mapper';
import { PresenceService, type PresenceState } from './presence.service';

export interface FriendRow {
  id: string;
  username: string;
  avatarUrl: string | null;
  rating: number;
  rank: string;
  country: string | null;
  currentStreak: number;
  presence: PresenceState | 'offline';
  /** Set on incoming requests the player has not answered yet. */
  friendshipId?: string;
}

/**
 * Friends.
 *
 * Deliberately small: request, accept, remove, list. There is no feed, no
 * suggestions engine and no follower/following split, because the only job
 * friends do in a competitive product at this stage is make the ladder feel
 * populated by people rather than usernames — a friends filter on the
 * leaderboard and a list of who is online right now.
 */
@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
  ) {}

  /** Both sides of every accepted friendship for a user. */
  private async acceptedIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
  }

  async friends(userId: string): Promise<FriendRow[]> {
    const ids = await this.acceptedIds(userId);
    if (ids.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      orderBy: { rating: 'desc' },
    });
    const states = this.presence.statesFor(ids);

    return users.map((u) => ({
      id: u.id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      rating: u.rating,
      rank: rankForRating(u.rating).name,
      country: u.country,
      currentStreak: u.currentStreak,
      presence: states.get(u.id) ?? 'offline',
    }));
  }

  /** Requests waiting on this player's answer. */
  async incomingRequests(userId: string): Promise<FriendRow[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { addresseeId: userId, status: 'pending' },
      include: { requester: true },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.requester.id,
      username: r.requester.username,
      avatarUrl: r.requester.avatarUrl,
      rating: r.requester.rating,
      rank: rankForRating(r.requester.rating).name,
      country: r.requester.country,
      currentStreak: r.requester.currentStreak,
      presence: this.presence.stateOf(r.requester.id) ?? 'offline',
      friendshipId: r.id,
    }));
  }

  async request(userId: string, targetId: string): Promise<{ status: string }> {
    if (userId === targetId) throw new BadRequestException('You cannot add yourself');

    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('Player not found');

    // If they already asked us, accept theirs instead of stacking a mirror
    // request — pressing "Add" on someone who invited you should just work.
    const inverse = await this.prisma.friendship.findUnique({
      where: { requesterId_addresseeId: { requesterId: targetId, addresseeId: userId } },
    });
    if (inverse) {
      if (inverse.status === 'accepted') return { status: 'accepted' };
      await this.prisma.friendship.update({
        where: { id: inverse.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      });
      await this.notifyAccepted(userId, targetId);
      return { status: 'accepted' };
    }

    const existing = await this.prisma.friendship.findUnique({
      where: { requesterId_addresseeId: { requesterId: userId, addresseeId: targetId } },
    });
    if (existing) return { status: existing.status };

    await this.prisma.friendship.create({
      data: { requesterId: userId, addresseeId: targetId },
    });

    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.prisma.notification.create({
      data: {
        userId: targetId,
        category: 'challenge',
        title: 'Friend request',
        body: `${me.username} wants to compete with you.`,
        href: '/friends',
      },
    });

    return { status: 'pending' };
  }

  async accept(userId: string, friendshipId: string): Promise<{ status: string }> {
    const row = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!row || row.addresseeId !== userId) throw new NotFoundException('Request not found');

    await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'accepted', acceptedAt: new Date() },
    });
    await this.notifyAccepted(userId, row.requesterId);
    return { status: 'accepted' };
  }

  async remove(userId: string, otherId: string): Promise<{ removed: boolean }> {
    const result = await this.prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: userId, addresseeId: otherId },
          { requesterId: otherId, addresseeId: userId },
        ],
      },
    });
    return { removed: result.count > 0 };
  }

  private async notifyAccepted(accepterId: string, requesterId: string): Promise<void> {
    const accepter = await this.prisma.user.findUniqueOrThrow({ where: { id: accepterId } });
    await this.prisma.notification.create({
      data: {
        userId: requesterId,
        category: 'challenge',
        title: 'Friend added',
        body: `${accepter.username} accepted your request.`,
        href: '/friends',
      },
    });
  }

  /* -------------------------------------------------------- leaderboard -- */

  /**
   * The ladder, scoped. One method rather than three endpoints, because the
   * three scopes differ only in which players are eligible — and keeping the
   * ordering, the projection and the rank derivation in one place is what stops
   * the friends board and the global board disagreeing about what rank 1 means.
   */
  async leaderboard(params: {
    viewerId: string | null;
    scope: 'global' | 'friends' | 'country';
    country?: string | null;
    search?: string | null;
    limit: number;
  }) {
    const { viewerId, scope, limit } = params;

    let ids: string[] | undefined;
    if (scope === 'friends') {
      if (!viewerId) return [];
      // The player belongs on their own friends board — a board you are absent
      // from cannot answer "am I beating them?", which is the only reason to
      // open it.
      ids = [...(await this.acceptedIds(viewerId)), viewerId];
    }

    const country =
      scope === 'country'
        ? params.country ??
          (viewerId
            ? (await this.prisma.user.findUnique({ where: { id: viewerId } }))?.country ?? null
            : null)
        : null;

    if (scope === 'country' && !country) return [];

    const users = await this.prisma.user.findMany({
      where: {
        status: 'active',
        matchesPlayed: { gt: 0 },
        ...(ids ? { id: { in: ids } } : {}),
        ...(country ? { country } : {}),
        /**
         * Case-insensitive on both engines, which takes a conditional because
         * they disagree by default: SQLite's LIKE ignores ASCII case, and
         * PostgreSQL's does not. Left alone, searching "Mike" found mike in
         * development and nobody at all in production — and this search is how
         * one player finds another to challenge, so failing it quietly removes
         * a whole route into a match. `mode` cannot simply always be sent:
         * SQLite rejects it outright.
         */
        ...(params.search
          ? {
              username: {
                contains: params.search,
                ...(isPostgres() ? { mode: 'insensitive' as const } : {}),
              },
            }
          : {}),
      },
      orderBy: { rating: 'desc' },
      take: limit,
    });

    const states = this.presence.statesFor(users.map((u) => u.id));

    return users.map((u, i) => ({
      ...toPublicUser(u),
      rank: rankForRating(u.rating).name,
      position: i + 1,
      presence: states.get(u.id) ?? 'offline',
    }));
  }
}
