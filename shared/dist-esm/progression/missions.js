/**
 * Daily and weekly missions.
 *
 * Missions exist to answer one question the moment the app opens: *what am I
 * doing today?* An open-ended "play a match" is a decision; "12 more push-ups
 * for 150 XP" is an instruction, and instructions get followed.
 *
 * The rotation is **derived from the date, not stored**. Everyone sees the same
 * missions on the same day, the set is reproducible from a date string alone,
 * and there is no scheduler, no cron, and nothing to back-fill if the server was
 * down at midnight.
 */
export const EMPTY_COUNTERS = {
    matches: 0,
    wins: 0,
    reps: 0,
    exercises: 0,
    flawlessMatches: 0,
    perfectGrades: 0,
    rankedMatches: 0,
};
const DAILY_POOL = [
    { id: 'd-play-2', name: 'Warm Up', description: 'Play 2 matches', metric: 'matches', target: 2, xp: 100, icon: 'swords' },
    { id: 'd-play-4', name: 'On the Grind', description: 'Play 4 matches', metric: 'matches', target: 4, xp: 180, icon: 'swords' },
    { id: 'd-win-1', name: 'Take One', description: 'Win a match', metric: 'wins', target: 1, xp: 120, icon: 'trophy' },
    { id: 'd-win-3', name: 'Triple Threat', description: 'Win 3 matches', metric: 'wins', target: 3, xp: 250, icon: 'trophy' },
    { id: 'd-reps-60', name: 'Sixty Strong', description: '60 verified reps', metric: 'reps', target: 60, xp: 120, icon: 'activity' },
    { id: 'd-reps-150', name: 'Volume Day', description: '150 verified reps', metric: 'reps', target: 150, xp: 220, icon: 'activity' },
    { id: 'd-mix-2', name: 'Mix It Up', description: '2 different exercises', metric: 'exercises', target: 2, xp: 140, icon: 'grid' },
    { id: 'd-ranked-2', name: 'On the Ladder', description: '2 ranked matches', metric: 'rankedMatches', target: 2, xp: 160, icon: 'trending-up' },
    { id: 'd-flawless-1', name: 'Clean Sheet', description: 'A match with every rep counted', metric: 'flawlessMatches', target: 1, xp: 200, icon: 'check-circle' },
];
const WEEKLY_POOL = [
    { id: 'w-play-15', name: 'Week of Work', description: 'Play 15 matches', metric: 'matches', target: 15, xp: 700, icon: 'swords' },
    { id: 'w-win-8', name: 'Winning Week', description: 'Win 8 matches', metric: 'wins', target: 8, xp: 900, icon: 'trophy' },
    { id: 'w-reps-800', name: 'Eight Hundred', description: '800 verified reps', metric: 'reps', target: 800, xp: 800, icon: 'activity' },
    { id: 'w-mix-5', name: 'Complete Athlete', description: '5 different exercises', metric: 'exercises', target: 5, xp: 750, icon: 'grid' },
    { id: 'w-grade-3', name: 'Straight S', description: '3 S grades', metric: 'perfectGrades', target: 3, xp: 1000, icon: 'star' },
];
/** How many of each pool are active at once. Three dailies is the most a player
 *  reads before it becomes a checklist rather than a nudge. */
export const DAILY_COUNT = 3;
export const WEEKLY_COUNT = 2;
/** `2026-08-02` — the period key for dailies. UTC, so the set never rotates
 *  twice for a player who crosses a timezone. */
export function dayKey(at = new Date()) {
    return at.toISOString().slice(0, 10);
}
/** `2026-W31` — the period key for weeklies, ISO week starting Monday. */
export function weekKey(at = new Date()) {
    const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
    // ISO weeks are numbered by the Thursday they contain.
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
/** Small deterministic string hash — same key, same missions, on every node. */
function hash(key) {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function pick(pool, key, count) {
    // Walk the pool from a hashed offset with a co-prime stride, so consecutive
    // days land on genuinely different sets rather than sliding by one.
    const start = hash(key) % pool.length;
    const stride = 1 + (hash(key + '#') % (pool.length - 1));
    const chosen = [];
    const seen = new Set();
    let i = start;
    while (chosen.length < Math.min(count, pool.length)) {
        if (!seen.has(i)) {
            seen.add(i);
            chosen.push(pool[i]);
        }
        i = (i + stride) % pool.length;
        if (seen.size >= pool.length)
            break;
    }
    return chosen;
}
export function dailyMissions(key = dayKey()) {
    return pick(DAILY_POOL, key, DAILY_COUNT);
}
export function weeklyMissions(key = weekKey()) {
    return pick(WEEKLY_POOL, key, WEEKLY_COUNT);
}
export function resolveMissions(defs, period, periodKey, counters, claimed = {}) {
    return defs.map((def) => {
        const current = counters[def.metric] ?? 0;
        return {
            ...def,
            period,
            periodKey,
            current: Math.min(current, def.target),
            progress: Math.max(0, Math.min(1, current / def.target)),
            complete: current >= def.target,
            claimedAt: claimed[def.id] ?? null,
        };
    });
}
/** Milliseconds until the daily set rotates — powers the countdown chip. */
export function msUntilDailyReset(now = new Date()) {
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    return next - now.getTime();
}
/** Milliseconds until the weekly set rotates (next Monday 00:00 UTC). */
export function msUntilWeeklyReset(now = new Date()) {
    const daysToMonday = (8 - (now.getUTCDay() || 7)) % 7 || 7;
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToMonday);
    return next - now.getTime();
}
//# sourceMappingURL=missions.js.map