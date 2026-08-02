/**
 * Exercise engine regression tests.
 *
 * Run with `npm test -w @repx/shared` (compiles first, then node:test).
 *
 * The squat cases exist because of a real production bug: detection originally
 * used a 2D knee angle, which is nearly flat when filmed head-on from a laptop
 * webcam, so genuine reps were silently rejected. Both camera angles are
 * asserted here so that regression cannot return unnoticed.
 *
 * The occlusion, dropout and feedback cases exist for the same reason at one
 * remove: each one pins down a way the counter used to lose reps that the
 * player had actually performed.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateRatingChange, expectedScore } from '../elo';
import { rankForRating } from '../constants/ranks';
import { getExercise, listExercises } from './registry';
const L = (x, y, visibility = 0.9) => ({ x, y, z: 0, visibility });
/** Linear interpolation, the only shape any of these fixtures needs. */
const lerp = (a, b, t) => a + (b - a) * t;
/**
 * Front-view squat at depth `d` (0 = standing, 1 = parallel).
 * Mirrors what a head-on camera sees: hip and shoulder descend together while
 * the knee travels toward the lens and barely moves vertically.
 */
function frontSquat(d) {
    const f = Array.from({ length: 33 }, () => L(0.5, 0.5));
    f[11] = L(0.44, 0.25 + 0.17 * d);
    f[12] = L(0.56, 0.25 + 0.17 * d);
    f[23] = L(0.46, 0.45 + 0.17 * d);
    f[24] = L(0.54, 0.45 + 0.17 * d);
    f[25] = L(0.45, 0.65 + 0.01 * d);
    f[26] = L(0.55, 0.65 + 0.01 * d);
    f[27] = L(0.46, 0.85);
    f[28] = L(0.54, 0.85);
    return f;
}
/** Side-view squat: the whole chain bends across the camera plane. */
function sideSquat(d) {
    const f = Array.from({ length: 33 }, () => L(0.5, 0.5));
    f[11] = L(0.5 - 0.06 * d, 0.25 + 0.19 * d);
    f[12] = L(0.5 - 0.06 * d, 0.26 + 0.19 * d);
    f[23] = L(0.5 + 0.03 * d, 0.45 + 0.17 * d);
    f[24] = L(0.5 + 0.03 * d, 0.46 + 0.17 * d);
    f[25] = L(0.5 + 0.12 * d, 0.65 + 0.03 * d);
    f[26] = L(0.5 + 0.12 * d, 0.66 + 0.03 * d);
    f[27] = L(0.5 + 0.02 * d, 0.85);
    f[28] = L(0.5 + 0.02 * d, 0.86);
    return f;
}
/**
 * Side-view push-up at the given elbow angle, body held in a straight line.
 *
 * `occludeRight` reproduces what a real side-on camera sends: the far arm is
 * behind the torso, so the model reports it with low confidence and pins it
 * near the top of its travel regardless of what the near arm is doing.
 */
function pushUp(elbowDeg, opts = {}) {
    const { straight = true, occludeRight = false } = opts;
    const f = Array.from({ length: 33 }, () => L(0.5, 0.5));
    const armAt = (deg) => {
        const rad = (deg * Math.PI) / 180;
        const elbow = L(0.5, 0.6);
        return { elbow, wrist: L(elbow.x + 0.1 * Math.sin(rad), elbow.y - 0.1 * Math.cos(rad)) };
    };
    const near = armAt(elbowDeg);
    // The occluded arm is both wrong (frozen near lockout) and low-confidence.
    const far = armAt(occludeRight ? 170 : elbowDeg);
    const farVis = occludeRight ? 0.12 : 0.9;
    f[0] = L(0.42, 0.48);
    f[11] = L(0.5, 0.5);
    f[12] = L(0.5, 0.52, occludeRight ? 0.2 : 0.9);
    f[13] = near.elbow;
    f[14] = L(far.elbow.x, far.elbow.y + 0.02, farVis);
    f[15] = near.wrist;
    f[16] = L(far.wrist.x, far.wrist.y + 0.02, farVis);
    f[23] = L(0.65, 0.5);
    f[24] = L(0.65, 0.52);
    f[25] = L(0.8, straight ? 0.5 : 0.72);
    f[26] = L(0.8, straight ? 0.52 : 0.74);
    f[27] = L(0.92, straight ? 0.5 : 0.72);
    f[28] = L(0.92, straight ? 0.52 : 0.74);
    return f;
}
/** Front-view jumping jack: 0 = arms and feet in, 1 = hands overhead, feet out. */
function jumpingJack(d) {
    const f = Array.from({ length: 33 }, () => L(0.5, 0.5));
    const wristY = lerp(0.6, 0.15, d);
    const ankleSpread = lerp(0.03, 0.15, d);
    f[11] = L(0.4, 0.3);
    f[12] = L(0.6, 0.3);
    f[15] = L(lerp(0.36, 0.3, d), wristY);
    f[16] = L(lerp(0.64, 0.7, d), wristY);
    f[23] = L(0.45, 0.55);
    f[24] = L(0.55, 0.55);
    f[27] = L(0.5 - ankleSpread, 0.9);
    f[28] = L(0.5 + ankleSpread, 0.9);
    return f;
}
/** Side-view sit-up: 0 = shoulders on the floor, 1 = sat up past vertical. */
function sitUp(d) {
    const f = Array.from({ length: 33 }, () => L(0.5, 0.5));
    const sx = lerp(0.2, 0.55, d);
    const sy = lerp(0.7, 0.45, d);
    f[11] = L(sx, sy);
    f[12] = L(sx, sy + 0.01);
    f[23] = L(0.5, 0.72);
    f[24] = L(0.5, 0.73);
    f[25] = L(0.7, 0.6);
    f[26] = L(0.7, 0.61);
    f[27] = L(0.6, 0.78);
    f[28] = L(0.6, 0.79);
    return f;
}
/** Side-view burpee: 0 = standing tall, 1 = chest and hands on the floor. */
function burpee(d) {
    const f = Array.from({ length: 33 }, () => L(0.5, 0.5));
    f[11] = L(lerp(0.5, 0.3, d), lerp(0.3, 0.9, d));
    f[12] = L(lerp(0.5, 0.3, d), lerp(0.31, 0.9, d));
    f[23] = L(lerp(0.5, 0.5, d), lerp(0.55, 0.9, d));
    f[24] = L(lerp(0.5, 0.5, d), lerp(0.56, 0.91, d));
    f[27] = L(lerp(0.5, 0.85, d), lerp(0.95, 0.92, d));
    f[28] = L(lerp(0.5, 0.85, d), lerp(0.96, 0.93, d));
    f[15] = L(lerp(0.5, 0.2, d), lerp(0.6, 0.95, d));
    f[16] = L(lerp(0.5, 0.2, d), lerp(0.61, 0.96, d));
    return f;
}
/** Side-view plank, either held correctly or with the hips dropped. */
function plank(sagging = false) {
    const f = Array.from({ length: 33 }, () => L(0.5, 0.5));
    f[11] = L(0.25, sagging ? 0.45 : 0.5);
    f[12] = L(0.25, sagging ? 0.46 : 0.51);
    f[23] = L(0.5, sagging ? 0.62 : 0.52);
    f[24] = L(0.5, sagging ? 0.63 : 0.53);
    f[27] = L(0.8, sagging ? 0.45 : 0.54);
    f[28] = L(0.8, sagging ? 0.46 : 0.55);
    return f;
}
/** A frame the model could not find a body in at all. */
function noBody() {
    return Array.from({ length: 33 }, () => L(0.5, 0.5, 0));
}
/** Drives a plugin through `reps` cycles and returns every event it emitted. */
function run(slug, build, from, to, reps, options = {}) {
    const { rampFrames = 12, holdFrames = 5, frameMs = 33 } = options;
    const session = getExercise(slug).createSession();
    const events = [];
    let t = 0;
    const feedFrame = (frame) => {
        const event = session.processFrame(frame, t);
        if (event)
            events.push(event);
        t += frameMs;
    };
    const feed = (v) => feedFrame(build(v));
    feed(from);
    for (let r = 0; r < reps; r++) {
        for (let i = 1; i <= rampFrames; i++)
            feed(from + ((to - from) * i) / rampFrames);
        for (let h = 0; h < holdFrames; h++)
            feed(to);
        for (let i = rampFrames; i >= 1; i--)
            feed(from + ((to - from) * i) / rampFrames);
        for (let h = 0; h < holdFrames; h++)
            feed(from);
    }
    return { repCount: session.repCount, events };
}
const performReps = (slug, build, from, to, reps, options) => run(slug, build, from, to, reps, options).repCount;
const counted = (events) => events.filter((e) => e.type === 'rep_counted');
const rejected = (events) => events.filter((e) => e.type === 'rep_rejected');
/* ------------------------------------------------------------- squats -- */
test('squat: counts full reps filmed head-on (regression: knee-angle bug)', () => {
    assert.equal(performReps('squat', frontSquat, 0, 1, 5), 5);
});
test('squat: counts full reps filmed side-on', () => {
    assert.equal(performReps('squat', sideSquat, 0, 1, 5), 5);
});
test('squat: credits an honest half squat from either angle', () => {
    assert.equal(performReps('squat', frontSquat, 0, 0.72, 4), 4);
    assert.equal(performReps('squat', sideSquat, 0, 0.72, 4), 4);
});
test('squat: rejects shallow bobs that never reach depth', () => {
    assert.equal(performReps('squat', frontSquat, 0, 0.22, 5), 0);
});
/* ------------------------------------------------------------ push-ups -- */
test('push-up: counts full-depth reps', () => {
    assert.equal(performReps('push-up', (v) => pushUp(v), 172, 78, 4), 4);
});
test('push-up: rejects partial reps that never reach depth', () => {
    assert.equal(performReps('push-up', (v) => pushUp(v), 172, 130, 4), 0);
});
test('push-up: rejects reps performed with a sagging hip line', () => {
    assert.equal(performReps('push-up', (v) => pushUp(v, { straight: false }), 172, 78, 4), 0);
});
test('push-up: counts when the far arm is occluded by the body', () => {
    // Filmed side-on the far arm is always hidden. Averaging its low-confidence
    // position in with the near arm used to halve the measured range of motion
    // and reject every rep in the set.
    assert.equal(performReps('push-up', (v) => pushUp(v, { occludeRight: true }), 172, 78, 4), 4);
});
/* -------------------------------------------------- tracking robustness -- */
/**
 * One squat, where tracking cuts out at the bottom and only comes back once the
 * player is already standing again — the shape of a real dropout, where the
 * blackout hides the entire ascent.
 */
function squatThroughBlackout(blackoutFrames) {
    const session = getExercise('squat').createSession();
    let t = 0;
    const feed = (frame) => {
        session.processFrame(frame, t);
        t += 33;
    };
    for (let i = 0; i <= 12; i++)
        feed(frontSquat(i / 12));
    for (let h = 0; h < 4; h++)
        feed(frontSquat(1));
    for (let b = 0; b < blackoutFrames; b++)
        feed(noBody());
    for (let h = 0; h < 6; h++)
        feed(frontSquat(0));
    return session.repCount;
}
test('a brief loss of tracking does not throw away the rep in progress', () => {
    // ~200ms of dropped frames, which is a routine confidence dip rather than the
    // player leaving. The bottom of the rep was observed and the top is observed,
    // so the rep stands. Resetting on the first bad frame — the old behaviour —
    // silently ate reps that had genuinely been performed.
    assert.equal(squatThroughBlackout(6), 1);
});
test('a sustained loss of tracking abandons the rep rather than guessing', () => {
    // ~660ms unobserved. Long enough that nothing can be claimed about what
    // happened in the gap, so no rep is credited for it.
    assert.equal(squatThroughBlackout(20), 0);
});
test('being out of frame reports a status, not a rejection per frame', () => {
    const session = getExercise('squat').createSession();
    const events = [];
    for (let i = 0; i < 60; i++) {
        const event = session.processFrame(noBody(), i * 33);
        if (event)
            events.push(event);
    }
    // ~2 seconds of no body. This used to emit 60 rejections — one per frame —
    // which flooded the socket and inflated the player's rejected-rep count.
    const complaints = rejected(events);
    assert.ok(complaints.length >= 1, 'the player must still be told');
    assert.ok(complaints.length <= 3, `expected a throttled status, got ${complaints.length} events`);
    assert.ok(complaints.every((e) => e.reason === 'Get your full body in frame'));
});
/* ------------------------------------------------------------- quality -- */
test('rep quality reflects depth on torso-normalized measures', () => {
    const deep = counted(run('squat', frontSquat, 0, 1, 3).events);
    const shallow = counted(run('squat', frontSquat, 0, 0.6, 3).events);
    assert.equal(deep.length, 3);
    assert.equal(shallow.length, 3);
    // Scoring used to divide overshoot by a fixed constant sized for degrees,
    // which pinned every torso-normalized exercise to the same value forever.
    assert.ok(deep[0].quality > shallow[0].quality, 'depth must move the score');
    assert.ok(shallow[0].quality < 0.95, `barely-legal rep scored ${shallow[0].quality}`);
    assert.equal(deep[0].quality, 1);
});
/* --------------------------------------------------- remaining exercises -- */
test('jumping jack: counts a fast but humanly possible cadence', () => {
    // ~2.5 reps/second. The rep is barely paused at the top of the travel, which
    // is exactly how the movement is performed well.
    assert.equal(performReps('jumping-jack', jumpingJack, 0, 1, 6, { rampFrames: 6, holdFrames: 0 }), 6);
});
test('jumping jack: rejects a superhuman cadence', () => {
    // ~6 reps/second — below the plugin's minimum plausible rep time.
    const { repCount, events } = run('jumping-jack', jumpingJack, 0, 1, 6, {
        rampFrames: 2,
        holdFrames: 0,
    });
    assert.ok(repCount < 3, `expected most reps refused, counted ${repCount}`);
    assert.ok(rejected(events).some((e) => e.reason === 'Too fast to be a real rep'));
});
test('jumping jack: rejects arms-only reps with the feet together', () => {
    const feetTogether = (d) => {
        const frame = jumpingJack(d);
        frame[27] = L(0.47, 0.9);
        frame[28] = L(0.53, 0.9);
        return frame;
    };
    assert.equal(performReps('jumping-jack', feetTogether, 0, 1, 4), 0);
});
test('sit-up: counts full reps and rejects crunches that stop short', () => {
    assert.equal(performReps('sit-up', sitUp, 0, 1, 4), 4);
    assert.equal(performReps('sit-up', sitUp, 0, 0.25, 4), 0);
});
test('burpee: counts full reps and rejects a squat with no floor contact', () => {
    assert.equal(performReps('burpee', burpee, 0, 1, 3), 3);
    assert.equal(performReps('burpee', burpee, 0, 0.4, 3), 0);
});
/* --------------------------------------------------------------- plank -- */
test('plank: scores one point per second held', () => {
    const session = getExercise('plank').createSession();
    for (let i = 0; i <= 40; i++)
        session.processFrame(plank(), i * 100);
    assert.equal(session.repCount, 4, 'four seconds held');
});
test('plank: breaking form pauses scoring without resetting it', () => {
    const session = getExercise('plank').createSession();
    const events = [];
    const feed = (frame, t) => {
        const event = session.processFrame(frame, t);
        if (event)
            events.push(event);
    };
    for (let i = 0; i <= 20; i++)
        feed(plank(), i * 100);
    const held = session.repCount;
    assert.equal(held, 2);
    for (let i = 21; i <= 60; i++)
        feed(plank(true), i * 100);
    assert.equal(session.repCount, held, 'a broken plank must not accrue points');
    // …and must not shout about it forty times either.
    const complaints = rejected(events);
    assert.ok(complaints.length <= 4, `expected throttled coaching, got ${complaints.length}`);
    for (let i = 61; i <= 90; i++)
        feed(plank(), i * 100);
    assert.ok(session.repCount > held, 'recovering form resumes scoring');
});
/* ------------------------------------------------------------ registry -- */
test('registry: every plugin is self-consistent', () => {
    for (const plugin of listExercises()) {
        assert.ok(plugin.slug.length > 0, 'slug');
        assert.ok(plugin.requiredLandmarks.length > 0, `${plugin.slug} requiredLandmarks`);
        assert.equal(getExercise(plugin.slug), plugin, `${plugin.slug} resolves from registry`);
        const session = plugin.createSession();
        assert.equal(session.repCount, 0, `${plugin.slug} starts at zero`);
    }
});
test('registry: a reset session behaves exactly like a fresh one', () => {
    for (const plugin of listExercises()) {
        if (plugin.scoring !== 'reps')
            continue;
        const session = plugin.createSession();
        for (let i = 0; i < 40; i++)
            session.processFrame(frontSquat((i % 12) / 12), i * 33);
        session.reset();
        assert.equal(session.repCount, 0, `${plugin.slug} rep count`);
        assert.equal(session.completion, 0, `${plugin.slug} completion`);
        assert.equal(session.phase, 'ready', `${plugin.slug} phase`);
    }
});
/* ----------------------------------------------------------------- elo -- */
test('elo: expected score is symmetric and favours the higher rating', () => {
    assert.equal(expectedScore(1500, 1500), 0.5);
    assert.ok(expectedScore(1800, 1500) > 0.5);
    assert.ok(Math.abs(expectedScore(1800, 1500) + expectedScore(1500, 1800) - 1) < 1e-9, 'expected scores must sum to 1');
});
test('elo: beating a stronger opponent is worth more than beating a weaker one', () => {
    const upset = calculateRatingChange({ rating: 1500, opponentRating: 1900, matchesPlayed: 30, outcome: 'win' });
    const expectedWin = calculateRatingChange({ rating: 1500, opponentRating: 1100, matchesPlayed: 30, outcome: 'win' });
    assert.ok(upset.delta > expectedWin.delta);
});
test('elo: provisional accounts move faster than established ones', () => {
    const provisional = calculateRatingChange({ rating: 1500, opponentRating: 1500, matchesPlayed: 2, outcome: 'win' });
    const established = calculateRatingChange({ rating: 1500, opponentRating: 1500, matchesPlayed: 50, outcome: 'win' });
    assert.ok(provisional.delta > established.delta);
});
test('elo: rating never falls below the floor', () => {
    const change = calculateRatingChange({ rating: 100, opponentRating: 2500, matchesPlayed: 90, outcome: 'loss' });
    assert.ok(change.after >= 100);
});
test('ranks: derive correctly and never gap', () => {
    assert.equal(rankForRating(0).id, 'bronze');
    assert.equal(rankForRating(1000).id, 'silver');
    assert.equal(rankForRating(2900).id, 'grandmaster');
});
//# sourceMappingURL=exercise-engine.test.js.map