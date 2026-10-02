import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_IDLE_TIMEOUT_MS,
  type RoomState,
} from '@repx/shared';
import { randomInt } from 'node:crypto';

export interface RoomOccupantRecord {
  userId: string;
  socketId: string;
  username: string;
  avatarUrl: string | null;
  rating: number;
  matchesPlayed: number;
  ready: boolean;
}

export interface Room {
  code: string;
  hostId: string;
  exerciseSlug: string;
  occupants: RoomOccupantRecord[];
  createdAt: number;
  /**
   * Last time anybody did anything in this room.
   *
   * Separate from `createdAt` because the sweeper is an *idle* timeout: two
   * friends picking an exercise, warming up and trading rematches are using the
   * room, and closing it out from under them at a fixed age would take their
   * code away mid-conversation.
   */
  lastActiveAt: number;
}

/** A room holds exactly two players — RepX is a 1v1 product. */
const ROOM_CAPACITY = 2;

/**
 * Private rooms: invite-only, unranked, two players, one shareable code.
 *
 * Unranked is not a limitation, it is the definition. A rating earned against an
 * opponent you hand-picked is not a rating, and letting private matches move ELO
 * would make the ladder trivially farmable by two friends taking turns losing.
 *
 * Like the queue and challenges, rooms live in memory: a room is a rendezvous
 * point that exists only while both people are connected to it. What gets
 * persisted is the match it produces.
 */
@Injectable()
export class RoomsService implements OnModuleDestroy {
  private readonly logger = new Logger('Rooms');
  private readonly byCode = new Map<string, Room>();
  private readonly codeByUser = new Map<string, string>();
  private readonly sweeper: NodeJS.Timeout;

  constructor() {
    // Rooms whose occupants all vanished without a clean leave — a closed laptop,
    // a killed tab — would otherwise hold their code forever.
    this.sweeper = setInterval(() => this.sweep(), 60_000);
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }

  create(host: Omit<RoomOccupantRecord, 'ready'>, exerciseSlug: string): Room {
    // A player can only be in one room; creating a second leaves the first.
    this.leave(host.userId);

    const room: Room = {
      code: this.freshCode(),
      hostId: host.userId,
      exerciseSlug,
      occupants: [{ ...host, ready: false }],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    this.byCode.set(room.code, room);
    this.codeByUser.set(host.userId, room.code);
    this.logger.log(`${host.username} opened room ${room.code}`);
    return room;
  }

  /**
   * Joins by code.
   *
   * Returns a discriminated result rather than throwing, because every failure
   * here is a thing the player needs told in plain words — a typo, a room that
   * filled up, a room that closed — and none of them is exceptional.
   */
  join(
    occupant: Omit<RoomOccupantRecord, 'ready'>,
    code: string,
  ): { ok: true; room: Room } | { ok: false; reason: string } {
    const room = this.byCode.get(code.toUpperCase());
    if (!room) return { ok: false, reason: 'No room with that code' };

    const already = room.occupants.find((o) => o.userId === occupant.userId);
    if (already) {
      // Rejoining from a new tab or after a reconnect: take over the slot rather
      // than refusing, which would lock a player out of their own room.
      already.socketId = occupant.socketId;
      // Readiness does not survive the round trip. Coming back on a new
      // connection and still counting as ready could start a match the moment
      // the other player pressed theirs, in front of a camera that is not up.
      already.ready = false;
      this.codeByUser.set(occupant.userId, room.code);
      room.lastActiveAt = Date.now();
      return { ok: true, room };
    }

    if (room.occupants.length >= ROOM_CAPACITY) {
      return { ok: false, reason: 'That room is full' };
    }

    this.leave(occupant.userId);
    room.occupants.push({ ...occupant, ready: false });
    this.codeByUser.set(occupant.userId, room.code);
    room.lastActiveAt = Date.now();
    this.logger.log(`${occupant.username} joined room ${room.code}`);
    return { ok: true, room };
  }

  /**
   * Removes a player from whatever room they are in.
   *
   * When the host leaves, the room does not die — the remaining player is
   * promoted. Collapsing the room would eject someone who did nothing wrong and
   * invalidate a code they may have already shared.
   */
  leave(userId: string): Room | null {
    const code = this.codeByUser.get(userId);
    if (!code) return null;
    this.codeByUser.delete(userId);

    const room = this.byCode.get(code);
    if (!room) return null;

    room.occupants = room.occupants.filter((o) => o.userId !== userId);

    if (room.occupants.length === 0) {
      this.byCode.delete(code);
      return null;
    }

    if (room.hostId === userId) {
      room.hostId = room.occupants[0].userId;
    }
    // Any change to the roster invalidates readiness — you agreed to play the
    // person who was in the room, not whoever replaces them.
    for (const occupant of room.occupants) occupant.ready = false;
    return room;
  }

  setReady(userId: string, ready: boolean): Room | null {
    const room = this.forUser(userId);
    if (!room) return null;
    const occupant = room.occupants.find((o) => o.userId === userId);
    if (occupant) occupant.ready = ready;
    room.lastActiveAt = Date.now();
    return room;
  }

  /** Host-only. Changing the exercise clears readiness for the same reason. */
  setExercise(userId: string, exerciseSlug: string): Room | null {
    const room = this.forUser(userId);
    if (!room || room.hostId !== userId) return null;
    room.exerciseSlug = exerciseSlug;
    for (const occupant of room.occupants) occupant.ready = false;
    room.lastActiveAt = Date.now();
    return room;
  }

  forUser(userId: string): Room | null {
    const code = this.codeByUser.get(userId);
    return code ? (this.byCode.get(code) ?? null) : null;
  }

  get(code: string): Room | null {
    return this.byCode.get(code.toUpperCase()) ?? null;
  }

  /** Ready to start when it is full and everybody has said so. */
  canStart(room: Room): boolean {
    return room.occupants.length === ROOM_CAPACITY && room.occupants.every((o) => o.ready);
  }

  close(code: string): void {
    const room = this.byCode.get(code);
    if (!room) return;
    for (const occupant of room.occupants) this.codeByUser.delete(occupant.userId);
    this.byCode.delete(code);
  }

  /** The client-facing shape — socket ids and rating internals stay server-side. */
  toState(room: Room): RoomState {
    return {
      code: room.code,
      hostId: room.hostId,
      exerciseSlug: room.exerciseSlug,
      occupants: room.occupants.map((o) => ({
        userId: o.userId,
        username: o.username,
        avatarUrl: o.avatarUrl,
        rating: o.rating,
        ready: o.ready,
      })),
    };
  }

  private freshCode(): string {
    // 32^6 is about a billion, and only a handful of rooms are ever open at
    // once, so a collision is a curiosity rather than a scaling concern. Retry
    // rather than coordinate.
    for (let attempt = 0; attempt < 20; attempt++) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      }
      if (!this.byCode.has(code)) return code;
    }
    throw new Error('Could not allocate a room code');
  }

  /**
   * Closes rooms nobody is using.
   *
   * Measured from the last thing that happened in the room, not from when it was
   * opened. Against `createdAt` this was an *age* limit wearing an idle timeout's
   * name: two people who opened a room, warmed up, played and went again had it
   * closed under them the moment the clock ran out, taking the code they had
   * already shared with it.
   */
  private sweep(): void {
    const cutoff = Date.now() - ROOM_IDLE_TIMEOUT_MS;
    for (const [code, room] of this.byCode) {
      if (room.occupants.length === 0 || room.lastActiveAt < cutoff) {
        this.close(code);
        this.logger.log(`Swept idle room ${code}`);
      }
    }
  }
}
