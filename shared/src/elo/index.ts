/**
 * ELO rating math — pure functions, no I/O.
 *
 * Lives in `shared/` specifically so the client can optimistically preview a
 * rating change the instant a match ends while the server computes the
 * authoritative value with the identical formula. See docs/ELO_SYSTEM.md.
 */

import { PLACEMENT_MATCHES } from '../constants/ranks';

export type MatchOutcome = 'win' | 'loss' | 'draw';

/** Actual score S used by the ELO formula. */
export function scoreForOutcome(outcome: MatchOutcome): number {
  if (outcome === 'win') return 1;
  if (outcome === 'draw') return 0.5;
  return 0;
}

/**
 * Expected score for player A against player B.
 * E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * K-factor controls rating volatility.
 *
 * Provisional accounts move fast so placement converges quickly; established
 * and high-rated accounts move slowly so a rating stays trustworthy. Mirrors
 * the tiered K used by chess federations.
 */
export function kFactor(rating: number, matchesPlayed: number): number {
  if (matchesPlayed < PLACEMENT_MATCHES) return 40;
  if (rating >= 2400) return 10;
  return 20;
}

export interface RatingChange {
  before: number;
  after: number;
  delta: number;
  kFactor: number;
  expected: number;
}

/** Compute the rating change for one player in one match. */
export function calculateRatingChange(params: {
  rating: number;
  opponentRating: number;
  matchesPlayed: number;
  outcome: MatchOutcome;
}): RatingChange {
  const { rating, opponentRating, matchesPlayed, outcome } = params;
  const k = kFactor(rating, matchesPlayed);
  const expected = expectedScore(rating, opponentRating);
  const delta = Math.round(k * (scoreForOutcome(outcome) - expected));
  // Rating floor of 100 — a player can never be driven to zero/negative.
  const after = Math.max(100, rating + delta);
  return { before: rating, after, delta: after - rating, kFactor: k, expected };
}

/**
 * Preview both players' rating changes for a hypothetical result. Used by the
 * client to show "+18 / -18" stakes before and during a match.
 */
export function previewMatchRatings(
  a: { rating: number; matchesPlayed: number },
  b: { rating: number; matchesPlayed: number },
): { aWins: { a: RatingChange; b: RatingChange }; bWins: { a: RatingChange; b: RatingChange } } {
  return {
    aWins: {
      a: calculateRatingChange({ rating: a.rating, opponentRating: b.rating, matchesPlayed: a.matchesPlayed, outcome: 'win' }),
      b: calculateRatingChange({ rating: b.rating, opponentRating: a.rating, matchesPlayed: b.matchesPlayed, outcome: 'loss' }),
    },
    bWins: {
      a: calculateRatingChange({ rating: a.rating, opponentRating: b.rating, matchesPlayed: a.matchesPlayed, outcome: 'loss' }),
      b: calculateRatingChange({ rating: b.rating, opponentRating: a.rating, matchesPlayed: b.matchesPlayed, outcome: 'win' }),
    },
  };
}
