/**
 * Competitive rank tiers derived from a player's ELO rating.
 *
 * Ranks are a *presentation* of rating, never a stored source of truth — always
 * derive with `rankForRating()` so the tier can never drift out of sync with the
 * rating it came from. See docs/ELO_SYSTEM.md.
 *
 * Colours come from the locked palette (`palette.ts`) and are shared with
 * achievement rarity on purpose: "Diamond" should mean the same thing, and look
 * the same, whether it is a ladder position or a trophy.
 */
import { RANK_COLORS } from './palette';
export const RANKS = [
    { id: 'bronze', name: 'Bronze', min: 0, color: RANK_COLORS.bronze },
    { id: 'silver', name: 'Silver', min: 800, color: RANK_COLORS.silver },
    { id: 'gold', name: 'Gold', min: 1200, color: RANK_COLORS.gold },
    { id: 'platinum', name: 'Platinum', min: 1600, color: RANK_COLORS.platinum },
    { id: 'diamond', name: 'Diamond', min: 2000, color: RANK_COLORS.diamond },
    { id: 'master', name: 'Master', min: 2400, color: RANK_COLORS.master },
    { id: 'grandmaster', name: 'Grandmaster', min: 2800, color: RANK_COLORS.grandmaster },
];
/** The rating every new account starts at. */
export const STARTING_RATING = 1000;
/** Matches required before a rating is considered established (not provisional). */
export const PLACEMENT_MATCHES = 10;
export function rankForRating(rating) {
    let current = RANKS[0];
    for (const rank of RANKS) {
        if (rating >= rank.min)
            current = rank;
    }
    return current;
}
export function rankIndex(rating) {
    return RANKS.findIndex((r) => r.id === rankForRating(rating).id);
}
/** The tier above the player's current one, or null at Grandmaster. */
export function nextRank(rating) {
    return RANKS[rankIndex(rating) + 1] ?? null;
}
/**
 * Progress (0..1) through the current rank toward the next one.
 * Grandmaster is the terminal tier and always reports 1.
 */
export function rankProgress(rating) {
    const index = rankIndex(rating);
    const next = RANKS[index + 1];
    if (!next)
        return 1;
    const floor = RANKS[index].min;
    return Math.max(0, Math.min(1, (rating - floor) / (next.min - floor)));
}
/**
 * Rating points still needed for promotion — the number the home screen puts in
 * front of the player, because "148 to Gold" motivates a match and "62%" does
 * not.
 */
export function ratingToPromotion(rating) {
    const next = nextRank(rating);
    return next ? Math.max(0, next.min - rating) : null;
}
/** True when one rating crossed a tier boundary the other did not — the trigger
 *  for the promotion and demotion ceremonies. */
export function crossedTier(before, after) {
    const a = rankIndex(before);
    const b = rankIndex(after);
    if (b > a)
        return 'promotion';
    if (b < a)
        return 'demotion';
    return null;
}
//# sourceMappingURL=ranks.js.map