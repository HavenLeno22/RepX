import { Injectable, Logger } from '@nestjs/common';
import {
  COUNTDOWN_SECONDS,
  MATCH_DURATION_SECONDS,
  getExercise,
  type ExerciseSession,
  type MatchMode,
  type PoseFrame,
} from '@repx/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AntiCheatService, type AntiCheatSession } from '../anti-cheat/anti-cheat.service';
import { EloService } from '../elo/elo.service';
import { ProgressionService, type MatchRewards } from '../progression/progression.service';

export interface LivePlayer {
  userId: string;
  username: string;
  socketId: string;
  rating: number;
  matchesPlayed: number;
  session: ExerciseSession;
  guard: AntiCheatSession;
  reps: number;
  /** Reps the exercise plugin refused. A rep-level stat, shown on the result. */
  rejected: number;
  /** Frames anti-cheat refused to even look at. Not a rep stat. */
  blockedFrames: number;
  /**
   * Rep count at the halfway whistle.
   *
   * Exists solely so "won after trailing at halfway" is answerable, which turns
   * a comeback — the most satisfying thing that can happen in a 60-second match
   * — into something the product can actually notice and reward.
   */
  repsAtHalfway: number;
  /** Last time this player was told a frame was blocked, for throttling. */
  lastBlockNoticeAt: number;
  qualitySum: number;
  connected: boolean;
  forfeited: boolean;
}

export interface LiveMatch {
  id: string;
  exerciseSlug: string;
  mode: MatchMode;
  players: LivePlayer[];
  status: 'countdown' | 'active' | 'finished';
  endsAt: number;
  timers: NodeJS.Timeout[];
}

export interface FrameResult {
  kind: 'counted' | 'rejected' | 'progress' | 'ignored';
  repCount: number;
  quality?: number;
  reason?: string;
  phase?: string;
}

/** Shortest gap between "your frames are being refused" notices, in ms. */
const BLOCK_NOTICE_INTERVAL_MS = 2000;

/**
 * Authoritative live-match state and rep verification.
 *
 * Every rep that counts is derived here, on the server, by running the exercise
 * plugin over the landmark stream the client sent. The client's own count is
 * never read. See docs/ANTI_CHEAT.md and docs/MULTIPLAYER.md.
 */
@Injectable()
export class MatchEngineService {
  private readonly logger = new Logger('MatchEngine');
  private readonly matches = new Map<string, LiveMatch>();
  private readonly matchByUser = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly elo: EloService,
    private readonly antiCheat: AntiCheatService,
    private readonly progression: ProgressionService,
  ) {}

  get(matchId: string): LiveMatch | undefined {
    return this.matches.get(matchId);
  }

  findByUser(userId: string): LiveMatch | undefined {
    const id = this.matchByUser.get(userId);
    return id ? this.matches.get(id) : undefined;
  }

  async create(params: {
    exerciseSlug: string;
    mode: MatchMode;
    players: {
      userId: string;
      username: string;
      socketId: string;
      rating: number;
      matchesPlayed: number;
    }[];
  }): Promise<LiveMatch> {
    const plugin = getExercise(params.exerciseSlug);
    if (!plugin) throw new Error(`Unknown exercise: ${params.exerciseSlug}`);

    const record = await this.prisma.match.create({
      data: {
        exerciseSlug: params.exerciseSlug,
        mode: params.mode,
        status: 'countdown',
        durationSeconds: MATCH_DURATION_SECONDS,
        participants: {
          create: params.players.map((p) => ({ userId: p.userId })),
        },
      },
    });

    const match: LiveMatch = {
      id: record.id,
      exerciseSlug: params.exerciseSlug,
      mode: params.mode,
      status: 'countdown',
      endsAt: 0,
      timers: [],
      players: params.players.map((p) => ({
        ...p,
        session: plugin.createSession(),
        guard: this.antiCheat.createSession(),
        reps: 0,
        rejected: 0,
        blockedFrames: 0,
        repsAtHalfway: 0,
        lastBlockNoticeAt: 0,
        qualitySum: 0,
        connected: true,
        forfeited: false,
      })),
    };

    this.matches.set(match.id, match);
    for (const p of match.players) this.matchByUser.set(p.userId, match.id);

    this.logger.log(`Match ${match.id} created: ${params.players.map((p) => p.username).join(' vs ')}`);
    return match;
  }

  /** Flips a countdown match to active and returns its end timestamp. */
  async start(matchId: string): Promise<number | null> {
    const match = this.matches.get(matchId);
    if (!match || match.status !== 'countdown') return null;

    match.status = 'active';
    match.endsAt = Date.now() + MATCH_DURATION_SECONDS * 1000;

    await this.prisma.match.update({
      where: { id: matchId },
      data: { status: 'active', startedAt: new Date() },
    });

    const halfway = setTimeout(() => {
      for (const player of match.players) player.repsAtHalfway = player.reps;
    }, (MATCH_DURATION_SECONDS * 1000) / 2);
    match.timers.push(halfway);

    return match.endsAt;
  }

  /**
   * Verifies one landmark frame for one player.
   *
   * Anti-cheat screens the frame first; only frames that survive reach the
   * exercise plugin, and only the plugin can increment a rep count.
   */
  submitFrame(
    matchId: string,
    userId: string,
    frame: PoseFrame,
    frameSeq: number,
    clientTimestamp: number,
  ): FrameResult {
    const match = this.matches.get(matchId);
    if (!match || match.status !== 'active') {
      return { kind: 'ignored', repCount: 0 };
    }

    const player = match.players.find((p) => p.userId === userId);
    if (!player || player.forfeited) return { kind: 'ignored', repCount: 0 };

    const verdict = player.guard.inspect(frame, frameSeq, clientTimestamp);
    if (!verdict.accept) {
      // Anti-cheat works at the frame level, not the rep level. Counting each
      // blocked frame as a rejected *rep* made the number on the result screen
      // meaningless — one stuttering network could show hundreds of "rejected
      // reps" for a clean set — and telling the player about every one of them
      // at thirty frames a second was noise, not feedback.
      player.blockedFrames += 1;
      const notify = clientTimestamp - player.lastBlockNoticeAt >= BLOCK_NOTICE_INTERVAL_MS;
      if (!notify) return { kind: 'ignored', repCount: player.reps };
      player.lastBlockNoticeAt = clientTimestamp;
      return { kind: 'rejected', repCount: player.reps, reason: verdict.reason };
    }

    const event = player.session.processFrame(frame, clientTimestamp);
    if (!event) return { kind: 'progress', repCount: player.reps, phase: player.session.phase };

    if (event.type === 'rep_counted') {
      player.reps = player.session.repCount;
      player.qualitySum += event.quality;
      return {
        kind: 'counted',
        repCount: player.reps,
        quality: event.quality,
        phase: event.phase,
      };
    }

    if (event.type === 'rep_rejected') {
      player.rejected += 1;
      return { kind: 'rejected', repCount: player.reps, reason: event.reason };
    }

    return { kind: 'progress', repCount: player.reps, phase: event.phase };
  }

  markDisconnected(socketId: string): LiveMatch | null {
    for (const match of this.matches.values()) {
      const player = match.players.find((p) => p.socketId === socketId);
      if (player) {
        player.connected = false;
        return match;
      }
    }
    return null;
  }

  forfeit(matchId: string, userId: string): void {
    const match = this.matches.get(matchId);
    const player = match?.players.find((p) => p.userId === userId);
    if (player) player.forfeited = true;
  }

  /**
   * Settles a match: determines the result, applies ratings, persists
   * participant stats, and records any anti-cheat flags raised during play.
   */
  async finalize(matchId: string): Promise<{
    match: LiveMatch;
    ratings: Map<string, { before: number; after: number; delta: number }>;
    outcomes: Map<string, 'win' | 'loss' | 'draw'>;
    flags: Map<string, string[]>;
    rewards: Map<string, MatchRewards>;
  } | null> {
    const match = this.matches.get(matchId);
    if (!match || match.status === 'finished') return null;
    match.status = 'finished';
    for (const timer of match.timers) clearTimeout(timer);

    const [a, b] = match.players;
    const outcomes = new Map<string, 'win' | 'loss' | 'draw'>();

    if (a.forfeited && !b.forfeited) {
      outcomes.set(a.userId, 'loss');
      outcomes.set(b.userId, 'win');
    } else if (b.forfeited && !a.forfeited) {
      outcomes.set(a.userId, 'win');
      outcomes.set(b.userId, 'loss');
    } else if (a.reps > b.reps) {
      outcomes.set(a.userId, 'win');
      outcomes.set(b.userId, 'loss');
    } else if (b.reps > a.reps) {
      outcomes.set(a.userId, 'loss');
      outcomes.set(b.userId, 'win');
    } else {
      outcomes.set(a.userId, 'draw');
      outcomes.set(b.userId, 'draw');
    }

    for (const player of match.players) {
      await this.prisma.matchParticipant.updateMany({
        where: { matchId, userId: player.userId },
        data: {
          repCount: player.reps,
          rejectedReps: player.rejected,
          averageQuality: player.reps > 0 ? player.qualitySum / player.reps : 0,
        },
      });
      await this.antiCheat.recordFlags(player.userId, matchId, player.guard.flags);
    }

    const applied = await this.elo.applyMatchResult({
      matchId,
      ranked: match.mode === 'ranked',
      players: match.players.map((p) => ({
        userId: p.userId,
        outcome: outcomes.get(p.userId) ?? 'draw',
      })),
    });

    const anyForfeit = match.players.some((p) => p.forfeited);
    await this.prisma.match.update({
      where: { id: matchId },
      data: { status: anyForfeit ? 'forfeited' : 'completed', endedAt: new Date() },
    });

    const ratings = new Map(applied.map((r) => [r.userId, r]));
    const flags = new Map(match.players.map((p) => [p.userId, [...p.guard.flags]]));

    // Progression runs last and deliberately after the rating is committed: XP,
    // achievements and missions all read post-match state, and none of them may
    // be able to fail a settle that has already happened.
    const rewards = await this.progression.applyMatch({
      matchId,
      mode: match.mode,
      exerciseSlug: match.exerciseSlug,
      players: match.players.map((p) => {
        const other = match.players.find((o) => o.userId !== p.userId);
        const rating = ratings.get(p.userId);
        return {
          userId: p.userId,
          reps: p.reps,
          rejectedReps: p.rejected,
          opponentReps: other?.reps ?? 0,
          repsAtHalfway: p.repsAtHalfway,
          opponentRepsAtHalfway: other?.repsAtHalfway ?? 0,
          outcome: outcomes.get(p.userId) ?? 'draw',
          ratingBefore: rating?.before ?? p.rating,
          ratingAfter: rating?.after ?? p.rating,
        };
      }),
    });

    this.matches.delete(matchId);
    for (const p of match.players) this.matchByUser.delete(p.userId);

    this.logger.log(`Match ${matchId} finalized: ${a.username} ${a.reps} — ${b.reps} ${b.username}`);
    return { match, ratings, outcomes, flags, rewards };
  }
}
