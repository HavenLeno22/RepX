/**
 * Runtime-validated API and WebSocket contracts.
 *
 * These schemas are the single source of truth for every payload crossing the
 * client/server boundary: the backend validates with them, the frontend infers
 * its types from them. Types alone are not a trust boundary — see
 * docs/SECURITY.md.
 */

import { z } from 'zod';
import { MATCH_MODES, type MatchMode } from '../constants/match';
import { LANDMARK_COUNT } from '../exercise-engine/types';
import type { Rarity } from '../progression/achievements';
import type { Grade, XpAward } from '../progression/xp';

/* ------------------------------------------------------------------ auth -- */

export const registerSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

/* ------------------------------------------------------------------ user -- */

export const publicUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  country: z.string().nullable(),
  rating: z.number(),
  peakRating: z.number(),
  matchesPlayed: z.number(),
  wins: z.number(),
  losses: z.number(),
  draws: z.number(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  /** Lifetime XP. Level is always derived from it with `levelForXp` rather than
   *  stored, so the two can never disagree. */
  xp: z.number(),
  /** Consecutive calendar days with at least one match. */
  dayStreak: z.number(),
  createdAt: z.string(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

/** Roughly 1.4MB of base64 — enough for a generous avatar, small enough to
 *  keep out of the "someone posts a 20MB PNG into the database" territory. */
const MAX_AVATAR_CHARS = 1_400_000;

export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only')
    .optional(),
  bio: z.string().max(160, 'Bio must be 160 characters or fewer').nullable().optional(),
  country: z.string().max(56).nullable().optional(),
  avatarUrl: z
    .string()
    .max(MAX_AVATAR_CHARS, 'That image is too large — try a smaller one')
    .refine((v) => v.startsWith('data:image/'), 'Avatar must be an image')
    .nullable()
    .optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: publicUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

/* ------------------------------------------------------------- landmarks -- */

export const landmarkSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  visibility: z.number().min(0).max(1),
});

export const poseFrameSchema = z.array(landmarkSchema).length(LANDMARK_COUNT);

/* --------------------------------------------------- websocket: client→server -- */

export const joinQueueSchema = z.object({
  exerciseSlug: z.string().min(1),
  mode: z.enum(MATCH_MODES),
});
export type JoinQueueInput = z.infer<typeof joinQueueSchema>;

export const submitFrameSchema = z.object({
  matchId: z.string().min(1),
  /** Monotonic per-match sequence number — replay/reorder detection. */
  frameSeq: z.number().int().nonnegative(),
  clientTimestamp: z.number(),
  landmarks: poseFrameSchema,
});
export type SubmitFrameInput = z.infer<typeof submitFrameSchema>;

export const matchIdSchema = z.object({ matchId: z.string().min(1) });

/* --------------------------------------------------- websocket: server→client -- */

export interface QueueStatusPayload {
  position: number;
  waitSeconds: number;
  ratingBand: number;
  /** How many players are waiting in this exact queue, including you. */
  searching: number;
}

export interface MatchFoundPayload {
  matchId: string;
  exerciseSlug: string;
  mode: MatchMode;
  opponent: PublicUser;
  you: PublicUser;
  stakes: { win: number; loss: number };
  countdownSeconds: number;
  durationSeconds: number;
  /**
   * Server clock at the moment the match goes live, and the server's idea of
   * "now" alongside it.
   *
   * The client used to run the countdown off its own timer, started whenever it
   * happened to finish loading the pose model. On a cold model download that
   * was several seconds after the server's countdown began, so the arena still
   * read "3…2…1" while the match was already live and reps were being scored.
   * Both fields together let the client correct for clock skew and show the
   * countdown the server is actually keeping.
   */
  startsAt: number;
  serverNow: number;
}

export interface MatchStartedPayload {
  matchId: string;
  endsAt: number;
  serverNow: number;
}

/** Sent when a player reconnects into a match that is still running. */
export interface MatchResumedPayload {
  matchId: string;
  exerciseSlug: string;
  endsAt: number;
  serverNow: number;
}

export interface RepUpdatePayload {
  matchId: string;
  userId: string;
  repCount: number;
  quality: number;
  /** Present only on the acting player's own socket. */
  self: boolean;
}

export interface RepRejectedPayload {
  matchId: string;
  reason: string;
}

export interface MatchEndedPayload {
  matchId: string;
  result: 'win' | 'loss' | 'draw';
  yourReps: number;
  opponentReps: number;
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  opponent: PublicUser;
  flags: string[];

  /**
   * Everything the result screen needs to run its ceremony, resolved on the
   * server in the same transaction that settled the match.
   *
   * These used to be absent, which meant the result screen could only show a
   * rating delta — the single most rewarding moment in the product had exactly
   * one number in it. Sending the whole reward stack here (rather than making
   * the client re-fetch and reconcile) also guarantees the celebration matches
   * what was actually persisted.
   */
  exerciseSlug: string;
  /** Reps the engine rejected, so accuracy can be shown honestly. */
  rejectedReps: number;
  grade: Grade;
  xp: XpAward;
  levelBefore: number;
  levelAfter: number;
  /** Set when this match crossed a tier boundary in either direction. */
  tierChange: 'promotion' | 'demotion' | null;
  /** Achievements this match unlocked, already persisted. */
  unlocked: { id: string; name: string; rarity: Rarity; icon: string }[];
  /** Missions this match completed. */
  missionsCompleted: { id: string; name: string; xp: number }[];
}
