import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { QUEUE_TICK_MS, bandForWait, type MatchMode, type QueueStatusPayload } from '@repx/shared';

export interface QueueEntry {
  userId: string;
  socketId: string;
  username: string;
  rating: number;
  matchesPlayed: number;
  exerciseSlug: string;
  mode: MatchMode;
  joinedAt: number;
}

export type PairHandler = (a: QueueEntry, b: QueueEntry) => void | Promise<void>;
export type StatusHandler = (socketId: string, status: QueueStatusPayload) => void;

/**
 * Queueing and opponent search.
 *
 * Storage is in-memory, which is correct for a single node. The queue is keyed
 * by exercise + mode exactly as the Redis sorted-set design in
 * docs/DATABASE_SCHEMA.md describes, so moving to Redis for multi-node is a
 * swap of this class's internals — no caller changes. See docs/MATCHMAKING.md.
 */
@Injectable()
export class MatchmakingService implements OnModuleDestroy {
  private readonly logger = new Logger('Matchmaking');
  private readonly queues = new Map<string, QueueEntry[]>();
  private readonly bySocket = new Map<string, string>();
  private pairHandler: PairHandler | null = null;
  private statusHandler: StatusHandler | null = null;
  private readonly ticker: NodeJS.Timeout;

  constructor() {
    // Re-evaluate pairings on a fixed tick so rating bands widen over time even
    // when nobody new joins, and push the widened band out to everyone waiting.
    this.ticker = setInterval(() => void this.tick(), QUEUE_TICK_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.ticker);
  }

  onPair(handler: PairHandler): void {
    this.pairHandler = handler;
  }

  /** Called once per tick for every socket still waiting. */
  onStatus(handler: StatusHandler): void {
    this.statusHandler = handler;
  }

  join(entry: QueueEntry): void {
    this.leave(entry.socketId);
    const key = queueKey(entry.exerciseSlug, entry.mode);
    const queue = this.queues.get(key) ?? [];
    queue.push(entry);
    this.queues.set(key, queue);
    this.bySocket.set(entry.socketId, key);
    this.logger.log(`${entry.username} queued for ${key} (${queue.length} waiting)`);
    void this.tick();
  }

  leave(socketId: string): void {
    const key = this.bySocket.get(socketId);
    if (!key) return;
    const queue = this.queues.get(key);
    if (queue) {
      this.queues.set(
        key,
        queue.filter((e) => e.socketId !== socketId),
      );
    }
    this.bySocket.delete(socketId);
  }

  isQueued(socketId: string): boolean {
    return this.bySocket.has(socketId);
  }

  /** Queue position and current search band, for the waiting-screen UI. */
  status(socketId: string): QueueStatusPayload | null {
    const key = this.bySocket.get(socketId);
    if (!key) return null;
    const queue = this.queues.get(key) ?? [];
    const index = queue.findIndex((e) => e.socketId === socketId);
    if (index === -1) return null;

    const waitSeconds = Math.floor((Date.now() - queue[index].joinedAt) / 1000);
    return {
      position: index + 1,
      waitSeconds,
      ratingBand: bandForWait(waitSeconds),
      searching: queue.length,
    };
  }

  private async tick(): Promise<void> {
    if (this.pairHandler) await this.pair();
    this.broadcastStatus();
  }

  private async pair(): Promise<void> {
    // Snapshot the keys first: pairing mutates `queues` as players leave it.
    for (const key of [...this.queues.keys()]) {
      const queue = this.queues.get(key);
      if (!queue || queue.length < 2) continue;

      // Oldest first, so nobody starves while newer players get matched.
      const sorted = [...queue].sort((a, b) => a.joinedAt - b.joinedAt);
      const paired = new Set<string>();

      for (const candidate of sorted) {
        if (paired.has(candidate.socketId)) continue;

        const waitSeconds = (Date.now() - candidate.joinedAt) / 1000;
        const band = bandForWait(waitSeconds);

        // Closest rating within the band, not merely the first one found: with
        // three or more people waiting, taking whoever appeared first produced
        // needlessly lopsided pairings while a much closer opponent sat idle.
        let opponent: QueueEntry | null = null;
        let bestGap = Number.POSITIVE_INFINITY;
        for (const other of sorted) {
          if (other.socketId === candidate.socketId) continue;
          if (other.userId === candidate.userId) continue;
          if (paired.has(other.socketId)) continue;

          const gap = Math.abs(other.rating - candidate.rating);
          // Either player having waited long enough is grounds to pair them.
          const otherBand = bandForWait((Date.now() - other.joinedAt) / 1000);
          if (gap > Math.max(band, otherBand)) continue;
          if (gap < bestGap) {
            bestGap = gap;
            opponent = other;
          }
        }
        if (!opponent) continue;

        paired.add(candidate.socketId);
        paired.add(opponent.socketId);
        this.leave(candidate.socketId);
        this.leave(opponent.socketId);

        try {
          await this.pairHandler!(candidate, opponent);
        } catch (error) {
          this.logger.error(`Failed to start match: ${String(error)}`);
        }
      }
    }
  }

  private broadcastStatus(): void {
    const handler = this.statusHandler;
    if (!handler) return;

    for (const socketId of this.bySocket.keys()) {
      const status = this.status(socketId);
      if (status) handler(socketId, status);
    }
  }
}

function queueKey(exerciseSlug: string, mode: MatchMode): string {
  return `${exerciseSlug}:${mode}`;
}
