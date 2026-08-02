/**
 * XP and levels.
 *
 * Rating and level answer two different questions on purpose, and keeping them
 * separate is the whole point of having both:
 *
 * - **Rating** answers "how good are you?" It can go down. It is zero-sum, and
 *   it is the thing the ladder is ordered by.
 * - **Level** answers "how much have you shown up?" It never goes down. Losing
 *   a match still earns XP, because a product that only rewards winning punishes
 *   exactly the players most likely to quit.
 *
 * That asymmetry is what lets the home screen always have something moving
 * forward, even during a losing streak.
 */
/** XP required to advance *from* the given level to the next one. */
export function xpToAdvance(level) {
    // Linear ramp with a ceiling: early levels come fast enough to teach the
    // system exists, later ones settle to about three matches each rather than
    // running away into a grind.
    return Math.min(1200, 120 + Math.max(0, level - 1) * 40);
}
/** Total lifetime XP needed to reach the start of `level`. */
export function xpAtLevelStart(level) {
    let total = 0;
    for (let l = 1; l < level; l++)
        total += xpToAdvance(l);
    return total;
}
export function levelForXp(totalXp) {
    let level = 1;
    let remaining = Math.max(0, Math.floor(totalXp));
    while (remaining >= xpToAdvance(level) && level < MAX_LEVEL) {
        remaining -= xpToAdvance(level);
        level += 1;
    }
    const need = xpToAdvance(level);
    return {
        level,
        into: level >= MAX_LEVEL ? need : remaining,
        need,
        progress: level >= MAX_LEVEL ? 1 : remaining / need,
        totalXp: Math.max(0, Math.floor(totalXp)),
    };
}
/** Levels stop here. A cap is honest; an infinite bar that never fills is not. */
export const MAX_LEVEL = 100;
/** Non-ranked modes earn less, so ranked stays the reason to press Play. */
const MODE_MULTIPLIER = {
    ranked: 1,
    quick: 0.6,
    friendly: 0.4,
};
const OUTCOME_XP = {
    win: 60,
    draw: 30,
    loss: 15,
};
export function xpForMatch(input) {
    const lines = [];
    lines.push({ label: 'Match played', xp: 40 });
    lines.push({
        label: input.outcome === 'win' ? 'Victory' : input.outcome === 'draw' ? 'Draw' : 'Defeat',
        xp: OUTCOME_XP[input.outcome],
    });
    if (input.reps > 0)
        lines.push({ label: `${input.reps} verified reps`, xp: input.reps * 2 });
    const gradeBonus = GRADE_XP[input.grade];
    if (gradeBonus > 0)
        lines.push({ label: `Grade ${input.grade}`, xp: gradeBonus });
    // Capped at five: a streak bonus that keeps compounding turns a good week into
    // an unbeatable lead, and makes coming back after a loss feel pointless.
    const streakBonus = Math.min(input.streak, 5) * 10;
    if (streakBonus > 0)
        lines.push({ label: `${input.streak} win streak`, xp: streakBonus });
    const raw = lines.reduce((sum, l) => sum + l.xp, 0);
    const total = Math.round(raw * MODE_MULTIPLIER[input.mode]);
    if (MODE_MULTIPLIER[input.mode] !== 1) {
        lines.push({
            label: `${input.mode} × ${MODE_MULTIPLIER[input.mode]}`,
            xp: total - raw,
        });
    }
    return { lines, total };
}
/* ---------------------------------------------------------------- grade -- */
/**
 * The letter on a battle card. Grades a *performance*, not an outcome — you can
 * lose with an S and win with a C, which is the point: it gives a player who is
 * outmatched on rating something to improve that is entirely within their
 * control.
 */
export const GRADES = ['S', 'A', 'B', 'C', 'D'];
const GRADE_XP = { S: 50, A: 30, B: 15, C: 5, D: 0 };
/**
 * Three components, weighted by how much of each the player actually controls:
 * form accuracy (50), pace against par (35), and margin against the opponent
 * (15). Margin is weighted lowest deliberately — it depends on who you were
 * matched with, and a grade that mostly measures your opponent is not feedback.
 *
 * Two things stop this being a pure weighted sum, and both exist because the
 * first version of it handed an **A** to a performance where a third of the reps
 * were thrown away for bad form:
 *
 * - **Accuracy is squared.** Linearly, going from 100% to 60% clean cost only 20
 *   of 100 points, which is not what "two in five of your reps did not count"
 *   should feel like.
 * - **Accuracy caps the grade outright.** Below 70% nothing above a C is
 *   reachable, and below 50% nothing above a D — no amount of volume can buy a
 *   good grade with bad form. That is the whole point of grading form separately
 *   from the result.
 */
export function gradeForPerformance(input) {
    const attempted = input.reps + input.rejectedReps;
    const accuracy = attempted > 0 ? input.reps / attempted : 0;
    const pace = Math.min(1, input.parReps > 0 ? input.reps / input.parReps : 0);
    const total = input.reps + input.opponentReps;
    const margin = total > 0 ? input.reps / total : 0.5;
    const score = accuracy * accuracy * 50 + pace * 35 + margin * 15;
    const ceiling = accuracy < 0.5 ? 'D' : accuracy < 0.7 ? 'C' : 'S';
    const earned = score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 55 ? 'B' : score >= 38 ? 'C' : 'D';
    // GRADES is ordered best-first, so the worse of the two is the higher index.
    return GRADES.indexOf(earned) > GRADES.indexOf(ceiling) ? earned : ceiling;
}
/** Rep counts a competent player reaches in a 60-second round. Used only as the
 *  pace baseline for grading — never as a target shown to the player. */
export const PAR_REPS = {
    'push-up': 34,
    squat: 42,
    'pull-up': 14,
    'sit-up': 38,
    'jumping-jack': 60,
    burpee: 20,
    plank: 55,
};
export function parRepsFor(slug) {
    return PAR_REPS[slug] ?? 30;
}
//# sourceMappingURL=xp.js.map