/**
 * Runtime-validated API and WebSocket contracts.
 *
 * These schemas are the single source of truth for every payload crossing the
 * client/server boundary: the backend validates with them, the frontend infers
 * its types from them. Types alone are not a trust boundary — see
 * docs/SECURITY.md.
 */
import { z } from 'zod';
import { MATCH_MODES } from '../constants/match';
import { LANDMARK_COUNT } from '../exercise-engine/types';
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
export const loginSchema = z.object({
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
});
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
export const authResponseSchema = z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    user: publicUserSchema,
});
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
export const submitFrameSchema = z.object({
    matchId: z.string().min(1),
    /** Monotonic per-match sequence number — replay/reorder detection. */
    frameSeq: z.number().int().nonnegative(),
    clientTimestamp: z.number(),
    landmarks: poseFrameSchema,
});
export const matchIdSchema = z.object({ matchId: z.string().min(1) });
//# sourceMappingURL=index.js.map