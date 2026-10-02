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

/* -------------------------------------------------- verification & reset -- */

export const requestPasswordResetSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

/**
 * The same minimum as registration, enforced from one constant so the two can
 * never disagree — a reset form that accepts a weaker password than signup is a
 * downgrade attack on your own policy.
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/* ----------------------------------------------------------------- oauth -- */

export const OAUTH_PROVIDERS = ['google', 'apple'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/**
 * Sign-in with a provider ID token.
 *
 * The client completes the provider's own flow and hands the resulting ID token
 * here; the server verifies it against the provider's published JWKS. Nothing
 * about the user — not the email, not the subject id — is trusted from the
 * request body, because all of it is inside the signed token and taking it from
 * anywhere else would let a caller sign in as anyone.
 *
 * `username` is the one exception, and only for a first-time signup: providers
 * do not supply a ladder name, so the client may suggest one. It is ignored when
 * the account already exists.
 */
export const oauthSignInSchema = z.object({
  provider: z.enum(OAUTH_PROVIDERS),
  idToken: z.string().min(1),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only')
    .optional(),
});
export type OAuthSignInInput = z.infer<typeof oauthSignInSchema>;

/* --------------------------------------------------------------- consent -- */

/**
 * The version of the privacy terms a player agreed to.
 *
 * Bumping this string is what re-prompts everyone: consent to an earlier policy
 * is not consent to a later one, so the check is equality against the current
 * version rather than "has consented at all".
 */
export const CONSENT_VERSION = '2026-08-03';

export const grantConsentSchema = z.object({
  version: z.string().min(1),
});
export type GrantConsentInput = z.infer<typeof grantConsentSchema>;

/**
 * Account deletion.
 *
 * Requires the user to type their own username. A deletion that happens on one
 * click is a deletion that happens by accident, and this one cascades through
 * every match, rating and trophy the person ever earned.
 */
export const deleteAccountSchema = z.object({
  confirmUsername: z.string().min(1),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

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

  /**
   * Sent as a boolean rather than the stored timestamp: the client only ever
   * asks "should I show the confirm-your-address banner", and shipping the exact
   * moment of verification to every viewer of a public profile is more than that
   * question needs.
   */
  emailVerified: z.boolean(),
  /** The privacy terms version this player accepted, or null if they never have. */
  consentVersion: z.string().nullable(),
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

/* ------------------------------------------------------------ challenge -- */

/**
 * A direct challenge: one named player asking one other for a match, outside the
 * queue entirely. The exercise and mode are fixed by the challenger, so the
 * person accepting knows exactly what they are agreeing to before they say yes.
 */
export const sendChallengeSchema = z.object({
  toUserId: z.string().min(1),
  exerciseSlug: z.string().min(1),
  mode: z.enum(MATCH_MODES),
});
export type SendChallengeInput = z.infer<typeof sendChallengeSchema>;

export const challengeIdSchema = z.object({ challengeId: z.string().min(1) });
export type ChallengeIdInput = z.infer<typeof challengeIdSchema>;

export interface ChallengeSummary {
  challengeId: string;
  from: PublicUser;
  to: PublicUser;
  exerciseSlug: string;
  mode: MatchMode;
  expiresAt: number;
}

/* ----------------------------------------------------------------- room -- */

/**
 * A private room. Unranked by definition — the whole point is to play someone
 * you chose, and a rating earned against an opponent you picked is not a rating.
 */
export const createRoomSchema = z.object({
  exerciseSlug: z.string().min(1),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const joinRoomSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .length(6, 'A room code is six characters'),
});
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;

export const roomExerciseSchema = z.object({
  exerciseSlug: z.string().min(1),
});

export interface RoomOccupant {
  userId: string;
  username: string;
  avatarUrl: string | null;
  rating: number;
  ready: boolean;
}

export interface RoomState {
  code: string;
  hostId: string;
  exerciseSlug: string;
  occupants: RoomOccupant[];
}

/* ----------------------------------------------------------- tournament -- */

export const TOURNAMENT_STATUSES = ['open', 'live', 'finished', 'cancelled'] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const tournamentIdSchema = z.object({ tournamentId: z.string().min(1) });

export const createTournamentSchema = z.object({
  name: z.string().min(3).max(60),
  exerciseSlug: z.string().min(1),
  /** Registration cap. Bracket size is derived from who actually turns up. */
  maxEntrants: z.number().int().min(2).max(128),
});
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

export interface TournamentEntrantSummary {
  userId: string;
  username: string;
  avatarUrl: string | null;
  rating: number;
  seed: number | null;
  eliminated: boolean;
}

export interface TournamentMatchSummary {
  id: string;
  round: number;
  position: number;
  aUserId: string | null;
  bUserId: string | null;
  winnerId: string | null;
  /** The live match this bracket slot is being played out in, once it starts. */
  matchId: string | null;
  status: 'pending' | 'ready' | 'live' | 'done';
}

export interface TournamentSummary {
  id: string;
  name: string;
  exerciseSlug: string;
  status: TournamentStatus;
  maxEntrants: number;
  entrantCount: number;
  /** Present once the draw is made. */
  rounds: number;
  championId: string | null;
  createdAt: string;
  startedAt: string | null;
}

export interface TournamentDetail extends TournamentSummary {
  entrants: TournamentEntrantSummary[];
  matches: TournamentMatchSummary[];
  /** Whether the viewer is registered. */
  joined: boolean;
  /** The viewer's next playable bracket slot, if it is their turn. */
  yourMatchId: string | null;
}

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
