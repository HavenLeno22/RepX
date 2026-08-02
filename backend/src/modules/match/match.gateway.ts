import { Logger, type OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  COUNTDOWN_SECONDS,
  MATCH_DURATION_SECONDS,
  RECONNECT_GRACE_SECONDS,
  getExercise,
  joinQueueSchema,
  previewMatchRatings,
  submitFrameSchema,
} from '@repx/shared';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchmakingService, type QueueEntry } from '../matchmaking/matchmaking.service';
import { PresenceService } from '../social/presence.service';
import { toPublicUser } from '../users/user.mapper';
import { MatchEngineService } from './match-engine.service';

interface SocketData {
  userId: string;
  username: string;
}

/**
 * The real-time surface of RepX: matchmaking, live match sync, and the landmark
 * stream that rep verification runs on.
 *
 * Event names and payloads are the ones catalogued in docs/API_SPECIFICATION.md.
 */
@WebSocketGateway({
  cors: { origin: (process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:5173').split(','), credentials: true },
})
export class MatchGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger('MatchGateway');
  private readonly socketsByUser = new Map<string, string>();
  private readonly forfeitTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly matchmaking: MatchmakingService,
    private readonly engine: MatchEngineService,
    private readonly presence: PresenceService,
  ) {}

  onModuleInit(): void {
    this.matchmaking.onPair((a, b) => this.startMatch(a, b));
    this.matchmaking.onStatus((socketId, status) => {
      this.server.sockets.sockets.get(socketId)?.emit('matchmaking:queued', status);
    });
  }

  /* ------------------------------------------------------ connection -- */

  async handleConnection(socket: Socket): Promise<void> {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      socket.emit('error', { code: 'UNAUTHORIZED', message: 'Missing token' });
      socket.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; username: string }>(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
      });
      const data = socket.data as SocketData;
      data.userId = payload.sub;
      data.username = payload.username;
      this.socketsByUser.set(payload.sub, socket.id);
      this.presence.connect(payload.sub, socket.id);

      // If this player reconnects into a live match, cancel their forfeit.
      const existing = this.engine.findByUser(payload.sub);
      if (existing && existing.status !== 'finished') {
        const timer = this.forfeitTimers.get(payload.sub);
        if (timer) {
          clearTimeout(timer);
          this.forfeitTimers.delete(payload.sub);
        }
        const player = existing.players.find((p) => p.userId === payload.sub);
        if (player) {
          player.connected = true;
          player.socketId = socket.id;
        }
        await socket.join(existing.id);
        socket.emit('match:resumed', {
          matchId: existing.id,
          exerciseSlug: existing.exerciseSlug,
          endsAt: existing.endsAt,
          serverNow: Date.now(),
        });
        // Clear the opponent's "they disconnected" banner.
        socket.to(existing.id).emit('match:opponentReconnected', { matchId: existing.id });
      }
    } catch {
      socket.emit('error', { code: 'UNAUTHORIZED', message: 'Invalid token' });
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    const data = socket.data as SocketData;
    this.matchmaking.leave(socket.id);
    this.presence.disconnect(socket.id);
    if (!data?.userId) return;

    if (this.socketsByUser.get(data.userId) === socket.id) {
      this.socketsByUser.delete(data.userId);
    }

    const match = this.engine.markDisconnected(socket.id);
    if (!match || match.status === 'finished') return;

    // Grace period before forfeiting — mobile networks drop constantly.
    const timer = setTimeout(() => {
      this.forfeitTimers.delete(data.userId);
      const live = this.engine.get(match.id);
      if (!live || live.status === 'finished') return;
      const player = live.players.find((p) => p.userId === data.userId);
      if (player?.connected) return;
      this.engine.forfeit(match.id, data.userId);
      void this.endMatch(match.id);
    }, RECONNECT_GRACE_SECONDS * 1000);

    this.forfeitTimers.set(data.userId, timer);
    this.server.to(match.id).emit('match:opponentDisconnected', {
      matchId: match.id,
      graceSeconds: RECONNECT_GRACE_SECONDS,
    });
  }

  /* ----------------------------------------------------- matchmaking -- */

  @SubscribeMessage('matchmaking:join')
  async joinQueue(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const parsed = joinQueueSchema.safeParse(body);
    if (!parsed.success) {
      socket.emit('error', { code: 'BAD_REQUEST', message: 'Invalid queue request' });
      return;
    }
    if (!getExercise(parsed.data.exerciseSlug)) {
      socket.emit('error', { code: 'NOT_FOUND', message: 'Unknown exercise' });
      return;
    }

    const data = socket.data as SocketData;

    // Queueing from a second tab while a match is live would strand the match
    // the player is already in, so send them back to it instead.
    const live = this.engine.findByUser(data.userId);
    if (live && live.status !== 'finished') {
      socket.emit('match:resumed', {
        matchId: live.id,
        exerciseSlug: live.exerciseSlug,
        endsAt: live.endsAt,
        serverNow: Date.now(),
      });
      return;
    }

    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) return;

    const entry: QueueEntry = {
      userId: user.id,
      socketId: socket.id,
      username: user.username,
      rating: user.rating,
      matchesPlayed: user.matchesPlayed,
      exerciseSlug: parsed.data.exerciseSlug,
      mode: parsed.data.mode,
      joinedAt: Date.now(),
    };

    this.presence.setState(user.id, 'queueing');
    this.matchmaking.join(entry);

    // `join` runs a pairing pass synchronously, so by this point the player may
    // already be in a match. Emitting a null status here — the old behaviour —
    // flashed an empty search screen over the top of the match they just found.
    const status = this.matchmaking.status(socket.id);
    if (status) socket.emit('matchmaking:queued', status);
  }

  @SubscribeMessage('matchmaking:leave')
  leaveQueue(@ConnectedSocket() socket: Socket): void {
    this.matchmaking.leave(socket.id);
    const data = socket.data as SocketData;
    if (data?.userId) this.presence.setState(data.userId, 'online');
    socket.emit('matchmaking:left', {});
  }

  /* ----------------------------------------------------------- match -- */

  @SubscribeMessage('match:landmarks')
  submitFrame(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): void {
    const parsed = submitFrameSchema.safeParse(body);
    if (!parsed.success) return;

    const data = socket.data as SocketData;
    const { matchId, frameSeq, clientTimestamp, landmarks } = parsed.data;

    const result = this.engine.submitFrame(
      matchId,
      data.userId,
      landmarks,
      frameSeq,
      clientTimestamp,
    );

    if (result.kind === 'counted') {
      socket.emit('rep:counted', {
        matchId,
        userId: data.userId,
        repCount: result.repCount,
        quality: result.quality ?? 1,
        self: true,
      });
      socket.to(matchId).emit('match:opponentProgress', {
        matchId,
        userId: data.userId,
        repCount: result.repCount,
      });
      return;
    }

    if (result.kind === 'rejected') {
      socket.emit('rep:rejected', { matchId, reason: result.reason ?? 'Invalid rep' });
    }

    // 'progress' and 'ignored' are deliberately silent. Progress used to be
    // echoed back on every single frame — thirty messages a second per player,
    // carrying a phase the client already derives locally, and which no client
    // listener ever read.
  }

  @SubscribeMessage('match:leave')
  async leaveMatch(@ConnectedSocket() socket: Socket): Promise<void> {
    const data = socket.data as SocketData;
    const match = this.engine.findByUser(data.userId);
    if (!match) return;
    this.engine.forfeit(match.id, data.userId);
    await this.endMatch(match.id);
  }

  /* --------------------------------------------------------- internal -- */

  private async startMatch(a: QueueEntry, b: QueueEntry): Promise<void> {
    this.presence.setState(a.userId, 'in-match');
    this.presence.setState(b.userId, 'in-match');

    const match = await this.engine.create({
      exerciseSlug: a.exerciseSlug,
      mode: a.mode,
      players: [a, b].map((e) => ({
        userId: e.userId,
        username: e.username,
        socketId: e.socketId,
        rating: e.rating,
        matchesPlayed: e.matchesPlayed,
      })),
    });

    const users = await this.prisma.user.findMany({
      where: { id: { in: [a.userId, b.userId] } },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    const preview = previewMatchRatings(
      { rating: a.rating, matchesPlayed: a.matchesPlayed },
      { rating: b.rating, matchesPlayed: b.matchesPlayed },
    );

    const startsAt = Date.now() + COUNTDOWN_SECONDS * 1000;
    const missing: string[] = [];

    for (const [self, opponent] of [
      [a, b],
      [b, a],
    ] as const) {
      const socket = this.server.sockets.sockets.get(self.socketId);
      if (!socket) {
        missing.push(self.userId);
        continue;
      }
      await socket.join(match.id);

      const selfIsA = self.userId === a.userId;
      const winDelta = selfIsA ? preview.aWins.a.delta : preview.bWins.b.delta;
      const lossDelta = selfIsA ? preview.bWins.a.delta : preview.aWins.b.delta;

      const selfUser = byId.get(self.userId);
      const opponentUser = byId.get(opponent.userId);
      if (!selfUser || !opponentUser) continue;

      socket.emit('matchmaking:found', {
        matchId: match.id,
        exerciseSlug: match.exerciseSlug,
        mode: match.mode,
        you: toPublicUser(selfUser),
        opponent: toPublicUser(opponentUser),
        stakes: { win: winDelta, loss: lossDelta },
        countdownSeconds: COUNTDOWN_SECONDS,
        durationSeconds: MATCH_DURATION_SECONDS,
        startsAt,
        serverNow: Date.now(),
      });
    }

    // A socket can vanish between being pulled off the queue and the match being
    // created. Settling immediately beats making the player who *is* present
    // stand in front of their camera for a full minute against a ghost.
    if (missing.length > 0) {
      for (const userId of missing) this.engine.forfeit(match.id, userId);
      await this.endMatch(match.id);
      return;
    }

    // Countdown, then go live, then settle when the clock runs out.
    const startTimer = setTimeout(() => {
      void (async () => {
        const endsAt = await this.engine.start(match.id);
        if (endsAt === null) return;
        this.server.to(match.id).emit('match:started', {
          matchId: match.id,
          endsAt,
          serverNow: Date.now(),
        });

        const endTimer = setTimeout(
          () => void this.endMatch(match.id),
          MATCH_DURATION_SECONDS * 1000,
        );
        match.timers.push(endTimer);
      })();
    }, COUNTDOWN_SECONDS * 1000);

    match.timers.push(startTimer);
  }

  private async endMatch(matchId: string): Promise<void> {
    const settled = await this.engine.finalize(matchId);
    if (!settled) return;

    const { match, ratings, outcomes, flags, rewards } = settled;

    for (const player of match.players) {
      const socket = this.server.sockets.sockets.get(player.socketId);
      const opponent = match.players.find((p) => p.userId !== player.userId);
      const rating = ratings.get(player.userId);
      if (!socket || !opponent) continue;

      const opponentUser = await this.prisma.user.findUnique({ where: { id: opponent.userId } });
      const reward = rewards.get(player.userId);

      socket.emit('match:ended', {
        matchId,
        result: outcomes.get(player.userId) ?? 'draw',
        yourReps: player.reps,
        opponentReps: opponent.reps,
        ratingBefore: rating?.before ?? player.rating,
        ratingAfter: rating?.after ?? player.rating,
        ratingDelta: rating?.delta ?? 0,
        opponent: opponentUser ? toPublicUser(opponentUser) : null,
        flags: flags.get(player.userId) ?? [],

        // The reward stack, resolved server-side in the same settle. Sent rather
        // than re-fetched so the celebration can never disagree with what was
        // actually persisted.
        exerciseSlug: match.exerciseSlug,
        rejectedReps: player.rejected,
        grade: reward?.grade ?? 'C',
        xp: reward?.xp ?? { lines: [], total: 0 },
        levelBefore: reward?.levelBefore ?? 1,
        levelAfter: reward?.levelAfter ?? 1,
        tierChange: reward?.tierChange ?? null,
        unlocked: reward?.unlocked ?? [],
        missionsCompleted: reward?.missionsCompleted ?? [],
      });

      this.presence.setState(player.userId, 'online');
      void socket.leave(matchId);
    }
  }
}
