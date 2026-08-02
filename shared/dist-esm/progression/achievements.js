/**
 * The achievement catalogue.
 *
 * Two rules keep achievements feeling like trophies rather than participation
 * stickers:
 *
 * 1. **Every achievement is measured, never granted.** Each one names a metric
 *    and a target, and the server evaluates the whole catalogue against a single
 *    stats snapshot. There is no bespoke unlock code anywhere, so an achievement
 *    can never be awarded by one code path and not another.
 * 2. **Rarity shares the ladder's colours.** Diamond looks like Diamond whether
 *    it is a rank or a trophy, so a player who has learned one has learned both.
 *
 * Because progress is derived from a snapshot rather than incremented, an
 * achievement added months from now retroactively reflects history instead of
 * only counting from the day it shipped.
 */
import { RANK_COLORS } from '../constants/palette';
export const RARITIES = ['bronze', 'silver', 'gold', 'diamond', 'master', 'grandmaster'];
export const RARITY_COLORS = {
    bronze: RANK_COLORS.bronze,
    silver: RANK_COLORS.silver,
    gold: RANK_COLORS.gold,
    diamond: RANK_COLORS.diamond,
    master: RANK_COLORS.master,
    grandmaster: RANK_COLORS.grandmaster,
};
/** XP paid out when an achievement unlocks, by rarity. */
export const RARITY_XP = {
    bronze: 100,
    silver: 250,
    gold: 600,
    diamond: 1200,
    master: 2500,
    grandmaster: 5000,
};
export const ACHIEVEMENTS = [
    /* ------------------------------------------------------------- ladder -- */
    { id: 'first-blood', name: 'First Blood', description: 'Your first ranked victory', category: 'ladder', rarity: 'bronze', icon: 'sword', metric: 'wins', target: 1 },
    { id: 'contender', name: 'Contender', description: '10 wins on the ladder', category: 'ladder', rarity: 'bronze', icon: 'sword', metric: 'wins', target: 10 },
    { id: 'ladder-climber', name: 'Ladder Climber', description: '50 wins on the ladder', category: 'ladder', rarity: 'silver', icon: 'trending-up', metric: 'wins', target: 50 },
    { id: 'veteran', name: 'Veteran', description: '250 wins on the ladder', category: 'ladder', rarity: 'gold', icon: 'shield', metric: 'wins', target: 250 },
    { id: 'gold-standard', name: 'Gold Standard', description: 'Reached Gold', category: 'ladder', rarity: 'silver', icon: 'medal', metric: 'peakRating', target: 1200 },
    { id: 'platinum-tier', name: 'Platinum Tier', description: 'Reached Platinum', category: 'ladder', rarity: 'gold', icon: 'medal', metric: 'peakRating', target: 1600 },
    { id: 'diamond-tier', name: 'Diamond Tier', description: 'Reached Diamond', category: 'ladder', rarity: 'diamond', icon: 'gem', metric: 'peakRating', target: 2000 },
    { id: 'master-tier', name: 'Master Tier', description: 'Reached Master', category: 'ladder', rarity: 'master', icon: 'crown', metric: 'peakRating', target: 2400 },
    { id: 'grandmaster-tier', name: 'Grandmaster', description: 'Reached Grandmaster', category: 'ladder', rarity: 'grandmaster', icon: 'crown', metric: 'peakRating', target: 2800 },
    /* ------------------------------------------------------------- volume -- */
    { id: 'century', name: 'Century', description: '100 verified reps', category: 'volume', rarity: 'bronze', icon: 'activity', metric: 'totalReps', target: 100 },
    { id: 'thousand-club', name: 'Thousand Club', description: '1,000 verified reps', category: 'volume', rarity: 'silver', icon: 'activity', metric: 'totalReps', target: 1000 },
    { id: 'ten-thousand', name: 'Iron Volume', description: '10,000 verified reps', category: 'volume', rarity: 'gold', icon: 'activity', metric: 'totalReps', target: 10000 },
    { id: 'hundred-thousand', name: 'Machine', description: '100,000 verified reps', category: 'volume', rarity: 'master', icon: 'zap', metric: 'totalReps', target: 100000 },
    { id: 'first-fifty', name: 'Fifty Fights', description: '50 matches played', category: 'volume', rarity: 'bronze', icon: 'swords', metric: 'matchesPlayed', target: 50 },
    { id: 'five-hundred', name: 'Five Hundred', description: '500 matches played', category: 'volume', rarity: 'gold', icon: 'swords', metric: 'matchesPlayed', target: 500 },
    /* -------------------------------------------------------- consistency -- */
    { id: 'back-to-back', name: 'Back to Back', description: '3 wins in a row', category: 'consistency', rarity: 'bronze', icon: 'flame', metric: 'longestStreak', target: 3 },
    { id: 'unstoppable', name: 'Unstoppable', description: '10 wins in a row', category: 'consistency', rarity: 'gold', icon: 'flame', metric: 'longestStreak', target: 10 },
    { id: 'untouchable', name: 'Untouchable', description: '25 wins in a row', category: 'consistency', rarity: 'master', icon: 'flame', metric: 'longestStreak', target: 25 },
    { id: 'week-one', name: 'Showing Up', description: '7 days in a row', category: 'consistency', rarity: 'bronze', icon: 'calendar', metric: 'dayStreak', target: 7 },
    { id: 'month-strong', name: 'Month Strong', description: '30 days in a row', category: 'consistency', rarity: 'gold', icon: 'calendar', metric: 'dayStreak', target: 30 },
    { id: 'year-of-reps', name: 'Year of Reps', description: '365 days in a row', category: 'consistency', rarity: 'grandmaster', icon: 'calendar', metric: 'dayStreak', target: 365 },
    { id: 'level-ten', name: 'Level 10', description: 'Reached level 10', category: 'consistency', rarity: 'bronze', icon: 'chevron-up', metric: 'level', target: 10 },
    { id: 'level-fifty', name: 'Level 50', description: 'Reached level 50', category: 'consistency', rarity: 'diamond', icon: 'chevron-up', metric: 'level', target: 50 },
    /* ------------------------------------------------------------ mastery -- */
    { id: 'flawless', name: 'Flawless', description: 'A match with every rep counted', category: 'mastery', rarity: 'silver', icon: 'check-circle', metric: 'flawlessMatches', target: 1 },
    { id: 'immaculate', name: 'Immaculate', description: '25 matches with every rep counted', category: 'mastery', rarity: 'diamond', icon: 'check-circle', metric: 'flawlessMatches', target: 25 },
    { id: 'perfect-form', name: 'Perfect Form', description: 'An S grade', category: 'mastery', rarity: 'silver', icon: 'star', metric: 'perfectGrades', target: 1 },
    { id: 'graded-master', name: 'Graded Master', description: '50 S grades', category: 'mastery', rarity: 'master', icon: 'star', metric: 'perfectGrades', target: 50 },
    { id: 'all-rounder', name: 'All-Rounder', description: 'A win in every exercise', category: 'mastery', rarity: 'gold', icon: 'grid', metric: 'exercisesWon', target: 7 },
    { id: 'comeback-kid', name: 'Comeback Kid', description: 'Won a match you were losing at halfway', category: 'mastery', rarity: 'silver', icon: 'rotate', metric: 'comebacks', target: 1 },
    { id: 'never-out', name: 'Never Out of It', description: '10 comeback wins', category: 'mastery', rarity: 'diamond', icon: 'rotate', metric: 'comebacks', target: 10 },
];
export const ACHIEVEMENTS_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
/**
 * Measures the whole catalogue against a snapshot. Pure, so the client can show
 * live progress from `/users/me/stats` without a second round trip, and the
 * server can use the identical function to decide what to persist.
 */
export function evaluateAchievements(metrics, unlockedAt = {}) {
    return ACHIEVEMENTS.map((def) => {
        const current = metrics[def.metric] ?? 0;
        const alreadyUnlocked = unlockedAt[def.id] !== undefined;
        return {
            ...def,
            current,
            // Once earned, always earned: a metric that can fall (rating, current
            // streak) must never silently revoke a trophy.
            unlocked: alreadyUnlocked || current >= def.target,
            progress: Math.max(0, Math.min(1, current / def.target)),
            unlockedAt: unlockedAt[def.id] ?? null,
        };
    });
}
export const RARITY_ORDER = {
    bronze: 0,
    silver: 1,
    gold: 2,
    diamond: 3,
    master: 4,
    grandmaster: 5,
};
//# sourceMappingURL=achievements.js.map