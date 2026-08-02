import type { PublicUser } from '@repx/shared';

/** Shape of a User row, narrowed to only what the public projection needs. */
export interface UserRow {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  country: string | null;
  rating: number;
  peakRating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  longestStreak: number;
  xp: number;
  dayStreak: number;
  createdAt: Date;
}

/**
 * Single place that decides what of a user is public. Everything that returns a
 * user to a client goes through here, so email/passwordHash can never leak by
 * someone forgetting to strip them at one call site.
 */
export function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    country: user.country,
    rating: user.rating,
    peakRating: user.peakRating,
    matchesPlayed: user.matchesPlayed,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    xp: user.xp,
    dayStreak: user.dayStreak,
    createdAt: user.createdAt.toISOString(),
  };
}
