import { Injectable } from '@nestjs/common';

/**
 * Who is online, and what they are doing.
 *
 * In memory on purpose, and correct for one node — presence is the most
 * disposable state in the product, and the failure mode of losing it (a friend
 * shows offline for thirty seconds) costs nothing. Moving to Redis is the same
 * change matchmaking needs; see docs/SYSTEM_ARCHITECTURE.md#scaling-strategy.
 *
 * A user can hold several sockets at once (two tabs, a phone and a laptop), so
 * this counts sockets rather than storing a boolean — otherwise closing one tab
 * marks a player offline while they are mid-match in another.
 */
export type PresenceState = 'online' | 'queueing' | 'in-match';

interface Entry {
  sockets: Set<string>;
  state: PresenceState;
  since: number;
}

@Injectable()
export class PresenceService {
  private readonly byUser = new Map<string, Entry>();
  private readonly userBySocket = new Map<string, string>();

  connect(userId: string, socketId: string): void {
    this.userBySocket.set(socketId, userId);
    const entry = this.byUser.get(userId);
    if (entry) {
      entry.sockets.add(socketId);
      return;
    }
    this.byUser.set(userId, { sockets: new Set([socketId]), state: 'online', since: Date.now() });
  }

  /** Returns the user the socket belonged to, if this was their last one. */
  disconnect(socketId: string): string | null {
    const userId = this.userBySocket.get(socketId);
    this.userBySocket.delete(socketId);
    if (!userId) return null;

    const entry = this.byUser.get(userId);
    if (!entry) return null;

    entry.sockets.delete(socketId);
    if (entry.sockets.size > 0) return null;

    this.byUser.delete(userId);
    return userId;
  }

  setState(userId: string, state: PresenceState): void {
    const entry = this.byUser.get(userId);
    if (entry) {
      entry.state = state;
      entry.since = Date.now();
    }
  }

  stateOf(userId: string): PresenceState | null {
    return this.byUser.get(userId)?.state ?? null;
  }

  onlineCount(): number {
    return this.byUser.size;
  }

  /** How many players are currently in a live match — the "live now" figure the
   *  home and play screens show, which has to be real to be worth showing. */
  inMatchCount(): number {
    let n = 0;
    for (const entry of this.byUser.values()) if (entry.state === 'in-match') n += 1;
    return n;
  }

  statesFor(userIds: string[]): Map<string, PresenceState> {
    const out = new Map<string, PresenceState>();
    for (const id of userIds) {
      const state = this.byUser.get(id)?.state;
      if (state) out.set(id, state);
    }
    return out;
  }
}
