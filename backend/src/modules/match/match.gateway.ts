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
  challengeIdSchema,
  createRoomSchema,
  getExercise,
  joinQueueSchema,
  joinRoomSchema,
  previewMatchRatings,
  roomExerciseSchema,
  sendChallengeSchema,
  submitFrameSchema,
  type MatchMode,
} from '@repx/shared';
import type { Server, Socket } from 'socket.io';
import { loadEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { ChallengeService } from '../challenge/challenge.service';
import { MatchmakingService, type QueueEntry } from '../matchmaking/matchmaking.service';
import { RoomsService } from '../rooms/rooms.service';
import { PresenceService } from '../social/presence.service';
import { TournamentsService } from '../tournaments/tournaments.service';
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
/**
 * Allowed origins for the socket, resolved per handshake.
 *
 * A function rather than an array, and that is the whole point. Decorator
 * arguments are evaluated when this module is first imported, which is before
 * anything has validated the environment — so the array form read raw
 * `process.env` at a moment when it may not be populated yet and silently fell
 * back to localhost. It also split on commas without trimming, so
 * `CORS_ALLOWED_ORIGINS="https://a.app, https://b.app"` produced the origin
 * `" https://b.app"` with a leading space: the REST API accepted that origin
 * (main.ts trims) and the WebSocket rejected it. The app loaded, and matchmaking
 * hung forever with a CORS error in the console — the worst kind of deploy bug,
 * because everything visible works.
 *
 * Resolving at handshake time means one parsed, trimmed list, shared with the
 * HTTP layer, after `loadEnv()` has vouched for it.
 */
function corsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  const allowed = loadEnv()
    .CORS_ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // A same-origin or non-browser client (the e2e harness, a native app) sends no
  // Origin header at all; there is nothing to check and nothing to protect.
  callback(null, !origin || allowed.includes(origin));
}

@WebSocketGateway({
  cors: { origin: corsOrigin, credentials: true },
})
export class MatchGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger('MatchGateway');
  private readonly socketsByUser = new Map<string, string>();
  private readonly forfeitTimers = new Map<string, NodeJS.Timeout>();
  /** live match id → the bracket slot it is settling, for tournament matches. */
  private readonly tournamentMatches = new Map<string, string>();
  /** Players who have pressed Enter on a ready bracket slot, awaiting the other. */
  private readonly tournamentReady = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly matchmaking: MatchmakingService,
    private readonly engine: MatchEngineService,
    private readonly presence: PresenceService,
    private readonly challenges: ChallengeService,
    private readonly rooms: RoomsService,
    private readonly tournaments: TournamentsService,
  ) {}

  onModuleInit(): void {
    this.matchmaking.onPair((a, b) => this.startMatch(a, b));
    this.matchmaking.onStatus((socketId, status) => {
      this.server.sockets.sockets.get(socketId)?.emit('matchmaking:queued', status);
    });

    // A lapsed challenge has to tell both sides: the recipient so the prompt
    // disappears, the sender so they stop waiting on an answer that is not
    // coming.
    this.challenges.onExpired((challenge) => {
      this.emitToUser(challenge.fromUserId, 'challenge:expired', {
        challengeId: challenge.id,
      });
      this.emitToUser(challenge.toUserId, 'challenge:cancelled', {
        challengeId: challenge.id,
      });
    });
  }

  /** Sends to a user's current socket, if they have one. */
  private emitToUser(userId: string, event: string, payload: unknown): void {
    const socketId = this.socketsByUser.get(userId);
    if (!socketId) return;
    this.server.sockets.sockets.get(socketId)?.emit(event, payload);
  }

  private async queueEntryFor(
    userId: string,
    socketId: string,
    exerciseSlug: string,
    mode: MatchMode,
  ): Promise<QueueEntry | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return {
      userId: user.id,
      socketId,
      username: user.username,
      rating: user.rating,
      matchesPlayed: user.matchesPlayed,
      exerciseSlug,
      mode,
      joinedAt: Date.now(),
    };
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
        secret: loadEnv().JWT_ACCESS_SECRET,
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

    /**
     * A socket closing does not mean the player left.
     *
     * Reconnects arrive *before* the old socket's close event on any flaky
     * network — the client opens a new connection, `handleConnection` registers
     * it, and only then does the dead one time out. Everything below is keyed on
     * the user rather than the socket, so running it for a superseded socket
     * evicted a player from a room they were sitting in and cancelled challenges
     * they had just sent, on a connection that was already healthy again.
     *
     * The engine is safe from this on its own: `markDisconnected` matches by
     * socket id, and a reconnect has already rewritten the player's, so the
     * stale socket finds nothing to mark.
     */
    if (this.socketsByUser.get(data.userId) !== socket.id) return;
    this.socketsByUser.delete(data.userId);

    // Tear down anything that was waiting on this player's attention. A prompt
    // for a challenge from someone who has gone offline is worse than no prompt:
    // accepting it fails, and the failure is not the accepter's fault.
    for (const challenge of this.challenges.clearFor(data.userId)) {
      const other =
        challenge.fromUserId === data.userId ? challenge.toUserId : challenge.fromUserId;
      this.emitToUser(other, 'challenge:cancelled', { challengeId: challenge.id });
    }

    const room = this.rooms.leave(data.userId);
    if (room) this.broadcastRoom(room.code);

    // Standing at a bracket slot only counts while you are actually there. Left
    // behind, the entry both leaks and lies: the opponent arrives, is told both
    // players are ready, and the match fails to start against a ghost.
    this.clearTournamentReady(data.userId);

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

  /* ------------------------------------------------------- challenges -- */

  @SubscribeMessage('challenge:send')
  async sendChallenge(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const parsed = sendChallengeSchema.safeParse(body);
    if (!parsed.success) {
      socket.emit('error', { code: 'BAD_REQUEST', message: 'Invalid challenge' });
      return;
    }
    if (!getExercise(parsed.data.exerciseSlug)) {
      socket.emit('error', { code: 'NOT_FOUND', message: 'Unknown exercise' });
      return;
    }

    const data = socket.data as SocketData;
    if (parsed.data.toUserId === data.userId) {
      socket.emit('error', { code: 'BAD_REQUEST', message: 'You cannot challenge yourself' });
      return;
    }

    // Challenging someone who is not connected would open a prompt nobody can
    // answer, and the challenger would sit through the full expiry to find out.
    if (!this.socketsByUser.has(parsed.data.toUserId)) {
      socket.emit('challenge:unavailable', { reason: 'That player is offline' });
      return;
    }

    const [from, to] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: data.userId } }),
      this.prisma.user.findUnique({ where: { id: parsed.data.toUserId } }),
    ]);
    if (!from || !to) {
      socket.emit('error', { code: 'NOT_FOUND', message: 'Player not found' });
      return;
    }

    const challenge = this.challenges.create({
      fromUserId: from.id,
      fromSocketId: socket.id,
      toUserId: to.id,
      exerciseSlug: parsed.data.exerciseSlug,
      mode: parsed.data.mode,
    });
    if (!challenge) {
      socket.emit('challenge:unavailable', { reason: 'You already challenged that player' });
      return;
    }

    const summary = {
      challengeId: challenge.id,
      from: toPublicUser(from),
      to: toPublicUser(to),
      exerciseSlug: challenge.exerciseSlug,
      mode: challenge.mode,
      expiresAt: challenge.expiresAt,
    };

    socket.emit('challenge:sent', summary);
    this.emitToUser(to.id, 'challenge:incoming', summary);
  }

  @SubscribeMessage('challenge:accept')
  async acceptChallenge(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const parsed = challengeIdSchema.safeParse(body);
    if (!parsed.success) return;

    const data = socket.data as SocketData;
    const challenge = this.challenges.get(parsed.data.challengeId);

    // Only the person challenged can accept it, and only once.
    if (!challenge || challenge.toUserId !== data.userId) {
      socket.emit('challenge:unavailable', { reason: 'That challenge is no longer open' });
      return;
    }
    this.challenges.remove(challenge.id);

    // The challenger may have queued, started a match, or closed the tab during
    // the forty-five seconds this was open.
    const challengerSocketId = this.socketsByUser.get(challenge.fromUserId);
    const challengerLive = this.engine.findByUser(challenge.fromUserId);
    if (!challengerSocketId || (challengerLive && challengerLive.status !== 'finished')) {
      socket.emit('challenge:unavailable', { reason: 'That player is no longer available' });
      this.emitToUser(challenge.fromUserId, 'challenge:expired', { challengeId: challenge.id });
      return;
    }

    this.matchmaking.leave(challengerSocketId);
    this.matchmaking.leave(socket.id);

    const [challenger, accepter] = await Promise.all([
      this.queueEntryFor(
        challenge.fromUserId,
        challengerSocketId,
        challenge.exerciseSlug,
        challenge.mode,
      ),
      this.queueEntryFor(data.userId, socket.id, challenge.exerciseSlug, challenge.mode),
    ]);
    if (!challenger || !accepter) return;

    await this.startMatch(challenger, accepter);
  }

  @SubscribeMessage('challenge:decline')
  declineChallenge(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): void {
    const parsed = challengeIdSchema.safeParse(body);
    if (!parsed.success) return;

    const data = socket.data as SocketData;
    const challenge = this.challenges.get(parsed.data.challengeId);
    // Either party can end it: the recipient declines, the sender cancels.
    if (!challenge) return;
    if (challenge.toUserId !== data.userId && challenge.fromUserId !== data.userId) return;

    this.challenges.remove(challenge.id);
    const declined = challenge.toUserId === data.userId;
    this.emitToUser(challenge.fromUserId, declined ? 'challenge:declined' : 'challenge:cancelled', {
      challengeId: challenge.id,
    });
    this.emitToUser(challenge.toUserId, 'challenge:cancelled', { challengeId: challenge.id });
  }

  /* ------------------------------------------------------------ rooms -- */

  @SubscribeMessage('room:create')
  async createRoom(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<void> {
    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success || !getExercise(parsed.data.exerciseSlug)) {
      socket.emit('error', { code: 'BAD_REQUEST', message: 'Invalid room' });
      return;
    }

    const data = socket.data as SocketData;
    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) return;

    const room = this.rooms.create(
      {
        userId: user.id,
        socketId: socket.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        rating: user.rating,
        matchesPlayed: user.matchesPlayed,
      },
      parsed.data.exerciseSlug,
    );

    await socket.join(`room:${room.code}`);
    socket.emit('room:state', this.rooms.toState(room));
  }

  @SubscribeMessage('room:join')
  async joinRoom(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<void> {
    const parsed = joinRoomSchema.safeParse(body);
    if (!parsed.success) {
      socket.emit('room:error', { reason: 'A room code is six characters' });
      return;
    }

    const data = socket.data as SocketData;
    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) return;

    const result = this.rooms.join(
      {
        userId: user.id,
        socketId: socket.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        rating: user.rating,
        matchesPlayed: user.matchesPlayed,
      },
      parsed.data.code,
    );

    if (!result.ok) {
      socket.emit('room:error', { reason: result.reason });
      return;
    }

    await socket.join(`room:${result.room.code}`);
    this.broadcastRoom(result.room.code);
  }

  @SubscribeMessage('room:ready')
  async setRoomReady(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const data = socket.data as SocketData;
    const ready = typeof body === 'object' && body !== null && 'ready' in body
      ? Boolean((body as { ready: unknown }).ready)
      : true;

    const room = this.rooms.setReady(data.userId, ready);
    if (!room) return;
    this.broadcastRoom(room.code);

    if (!this.rooms.canStart(room)) return;

    // Both players agreed. Take the room down before starting so a reconnect
    // mid-match cannot drop anyone back into a lobby for a match already live.
    const [a, b] = room.occupants;
    const code = room.code;
    const exerciseSlug = room.exerciseSlug;
    this.rooms.close(code);
    this.server.to(`room:${code}`).emit('room:closed', { code });

    const entries = await Promise.all([
      // Private matches are 'friendly': a rating earned against an opponent you
      // hand-picked is not a rating, and letting these move ELO would make the
      // ladder farmable by two friends trading wins.
      this.queueEntryFor(a.userId, a.socketId, exerciseSlug, 'friendly'),
      this.queueEntryFor(b.userId, b.socketId, exerciseSlug, 'friendly'),
    ]);
    if (!entries[0] || !entries[1]) return;
    await this.startMatch(entries[0], entries[1]);
  }

  @SubscribeMessage('room:exercise')
  setRoomExercise(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): void {
    const parsed = roomExerciseSchema.safeParse(body);
    if (!parsed.success || !getExercise(parsed.data.exerciseSlug)) return;
    const data = socket.data as SocketData;
    const room = this.rooms.setExercise(data.userId, parsed.data.exerciseSlug);
    if (room) this.broadcastRoom(room.code);
  }

  @SubscribeMessage('room:leave')
  leaveRoom(@ConnectedSocket() socket: Socket): void {
    const data = socket.data as SocketData;
    const before = this.rooms.forUser(data.userId);
    const room = this.rooms.leave(data.userId);
    if (before) void socket.leave(`room:${before.code}`);
    socket.emit('room:left', {});
    if (room) this.broadcastRoom(room.code);
  }

  private broadcastRoom(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    this.server.to(`room:${code}`).emit('room:state', this.rooms.toState(room));
  }

  /** Withdraws a player from every bracket slot they were waiting at. */
  private clearTournamentReady(userId: string): void {
    for (const [tournamentMatchId, waiting] of this.tournamentReady) {
      if (!waiting.delete(userId)) continue;
      if (waiting.size === 0) this.tournamentReady.delete(tournamentMatchId);
      else {
        for (const other of waiting) {
          this.emitToUser(other, 'tournament:opponentLeft', { tournamentMatchId });
        }
      }
    }
  }

  /* ------------------------------------------------------ tournaments -- */

  /**
   * Enters a ready bracket slot.
   *
   * Both players must press Enter. A tournament match cannot start the instant a
   * slot opens — the players may be hours apart — so the first arrival waits and
   * the second one starts it, which is the same handshake the private room uses.
   */
  @SubscribeMessage('tournament:enter')
  async enterTournamentMatch(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    if (typeof body !== 'object' || body === null || !('tournamentMatchId' in body)) return;
    const tournamentMatchId = String((body as { tournamentMatchId: unknown }).tournamentMatchId);

    const data = socket.data as SocketData;
    const slot = await this.tournaments.playableSlot(tournamentMatchId);
    if (!slot) {
      socket.emit('tournament:error', { reason: 'That match is no longer waiting on you' });
      return;
    }
    if (slot.aUserId !== data.userId && slot.bUserId !== data.userId) {
      socket.emit('tournament:error', { reason: 'That is not your match' });
      return;
    }

    const waiting = this.tournamentReady.get(tournamentMatchId) ?? new Set<string>();
    waiting.add(data.userId);
    this.tournamentReady.set(tournamentMatchId, waiting);

    const opponentId = slot.aUserId === data.userId ? slot.bUserId : slot.aUserId;
    if (!waiting.has(opponentId)) {
      socket.emit('tournament:waiting', { tournamentMatchId, opponentId });
      this.emitToUser(opponentId, 'tournament:opponentWaiting', { tournamentMatchId });
      return;
    }

    this.tournamentReady.delete(tournamentMatchId);

    const opponentSocketId = this.socketsByUser.get(opponentId);
    if (!opponentSocketId) {
      socket.emit('tournament:error', { reason: 'Your opponent went offline' });
      return;
    }

    const entries = await Promise.all([
      this.queueEntryFor(data.userId, socket.id, slot.exerciseSlug, 'friendly'),
      this.queueEntryFor(opponentId, opponentSocketId, slot.exerciseSlug, 'friendly'),
    ]);
    if (!entries[0] || !entries[1]) return;

    await this.startMatch(entries[0], entries[1], tournamentMatchId);
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

  /**
   * Starts a match between two players.
   *
   * Four things reach this method — the queue, a direct challenge, a private
   * room, and a tournament slot — and they differ only in how the two players
   * found each other. Everything after that point (countdown, engine lifecycle,
   * settle) is identical, so they all build a pair of `QueueEntry` values and
   * come through here rather than each growing its own copy of the match
   * lifecycle.
   *
   * `tournamentMatchId` is the one piece of provenance that has to survive: it
   * is what lets the settle report a result back into the bracket.
   */
  private async startMatch(
    a: QueueEntry,
    b: QueueEntry,
    tournamentMatchId?: string,
  ): Promise<void> {
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

    if (tournamentMatchId) {
      this.tournamentMatches.set(match.id, tournamentMatchId);
      await this.tournaments.markLive(tournamentMatchId, match.id);
    }

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

    // Report into the bracket before telling the players, so that by the time
    // anyone refreshes the tournament the draw already reflects the result.
    const tournamentMatchId = this.tournamentMatches.get(matchId);
    if (tournamentMatchId) {
      this.tournamentMatches.delete(matchId);
      const winner = match.players.find((p) => outcomes.get(p.userId) === 'win');
      if (winner) {
        await this.tournaments.reportResult(tournamentMatchId, winner.userId);
      } else {
        // A draw cannot advance anyone. The slot reopens so the pair replay it
        // rather than the bracket stalling on a result that decided nothing.
        await this.tournaments.releaseSlot(tournamentMatchId);
      }
      for (const player of match.players) {
        this.emitToUser(player.userId, 'tournament:updated', { tournamentMatchId });
      }
    }

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
