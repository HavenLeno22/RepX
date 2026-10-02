import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { CHALLENGE_EXPIRY_SECONDS, type MatchMode } from '@repx/shared';
import { randomUUID } from 'node:crypto';

export interface PendingChallenge {
  id: string;
  fromUserId: string;
  fromSocketId: string;
  toUserId: string;
  exerciseSlug: string;
  mode: MatchMode;
  createdAt: number;
  expiresAt: number;
}

export type ChallengeExpiredHandler = (challenge: PendingChallenge) => void;

/**
 * Direct challenges — one named player asking another for a match, bypassing
 * the queue.
 *
 * Held in memory rather than in the database on purpose. A challenge is valid
 * for forty-five seconds and is meaningless the moment either party's socket
 * goes away; persisting it would mean writing a row, scheduling a job to delete
 * it, and then still having to reconcile against live socket state. The
 * authoritative record of a challenge that *mattered* is the match it produced,
 * and that is persisted.
 *
 * Storage is keyed the same way the matchmaking queue is, so moving this to
 * Redis for multi-node is a swap of this class's internals with no caller
 * changes.
 */
@Injectable()
export class ChallengeService implements OnModuleDestroy {
  private readonly logger = new Logger('Challenge');
  private readonly byId = new Map<string, PendingChallenge>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private expiredHandler: ChallengeExpiredHandler | null = null;

  onModuleDestroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  onExpired(handler: ChallengeExpiredHandler): void {
    this.expiredHandler = handler;
  }

  /**
   * Opens a challenge.
   *
   * Returns `null` when an identical one is already open, so that hammering the
   * button cannot bury the recipient under a stack of prompts for the same
   * match — the first one stands and keeps its original expiry.
   */
  create(input: {
    fromUserId: string;
    fromSocketId: string;
    toUserId: string;
    exerciseSlug: string;
    mode: MatchMode;
  }): PendingChallenge | null {
    for (const existing of this.byId.values()) {
      if (existing.fromUserId === input.fromUserId && existing.toUserId === input.toUserId) {
        return null;
      }
    }

    const now = Date.now();
    const challenge: PendingChallenge = {
      id: randomUUID(),
      ...input,
      createdAt: now,
      expiresAt: now + CHALLENGE_EXPIRY_SECONDS * 1000,
    };

    this.byId.set(challenge.id, challenge);
    this.timers.set(
      challenge.id,
      setTimeout(() => {
        const expired = this.byId.get(challenge.id);
        this.remove(challenge.id);
        if (expired) this.expiredHandler?.(expired);
      }, CHALLENGE_EXPIRY_SECONDS * 1000),
    );

    this.logger.log(`${input.fromUserId} challenged ${input.toUserId} (${input.exerciseSlug})`);
    return challenge;
  }

  get(id: string): PendingChallenge | undefined {
    return this.byId.get(id);
  }

  /** Every challenge this user sent or received — used to clear their prompts. */
  involving(userId: string): PendingChallenge[] {
    return [...this.byId.values()].filter(
      (c) => c.fromUserId === userId || c.toUserId === userId,
    );
  }

  /**
   * Removes a challenge and cancels its expiry.
   *
   * Always go through here rather than deleting from the map: a stray timer left
   * running fires `onExpired` for a challenge that was already accepted, which
   * tells the challenger their live match timed out.
   */
  remove(id: string): PendingChallenge | undefined {
    const challenge = this.byId.get(id);
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.byId.delete(id);
    return challenge;
  }

  /** Drops everything involving a user — called when their socket disconnects. */
  clearFor(userId: string): PendingChallenge[] {
    const affected = this.involving(userId);
    for (const challenge of affected) this.remove(challenge.id);
    return affected;
  }
}
