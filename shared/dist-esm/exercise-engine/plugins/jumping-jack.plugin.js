import { bodyPoint, distance, pairMeasurable } from '../geometry';
import { TwoPhaseRepSession } from '../rep-session';
import { LM } from '../types';
/**
 * Tracks how far the hands are above the shoulders, scaled by torso length so
 * the measure is independent of the player's distance from the camera.
 * Positive = hands overhead, negative = hands at the sides.
 */
function handsOverheadRatio(frame) {
    const shoulder = bodyPoint(frame, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER);
    const hip = bodyPoint(frame, LM.LEFT_HIP, LM.RIGHT_HIP);
    const wrist = bodyPoint(frame, LM.LEFT_WRIST, LM.RIGHT_WRIST);
    const torso = distance(shoulder, hip);
    if (torso === 0)
        return 0;
    // y grows downward, so shoulder.y - wrist.y is positive when hands are higher.
    return (shoulder.y - wrist.y) / torso;
}
/**
 * Feet must also travel out and back — arms alone are not a jumping jack.
 *
 * Genuinely needs both ankles, so it passes when it cannot see them rather than
 * failing a rep on evidence it does not have.
 */
function feetApart(frame) {
    if (!pairMeasurable(frame, LM.LEFT_ANKLE, LM.RIGHT_ANKLE))
        return true;
    if (!pairMeasurable(frame, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER))
        return true;
    const shoulderWidth = distance(frame[LM.LEFT_SHOULDER], frame[LM.RIGHT_SHOULDER]);
    const ankleWidth = distance(frame[LM.LEFT_ANKLE], frame[LM.RIGHT_ANKLE]);
    if (shoulderWidth === 0)
        return true;
    return ankleWidth / shoulderWidth > 0.7;
}
export const jumpingJackPlugin = {
    slug: 'jumping-jack',
    displayName: 'Jumping Jacks',
    version: '3.0.0',
    description: 'Hands overhead and feet out, then all the way back to your sides.',
    icon: '⭐',
    scoring: 'reps',
    cameraHint: 'Face the camera, 2–3m away, full arm span in frame.',
    requiredLandmarks: [
        [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
        [LM.LEFT_WRIST, LM.RIGHT_WRIST],
        [LM.LEFT_HIP, LM.RIGHT_HIP],
    ],
    createSession: () => new TwoPhaseRepSession({
        measure: handsOverheadRatio,
        // Inverted: a *higher* ratio means deeper into the rep (hands overhead).
        invert: true,
        bottomThreshold: 0.25,
        topThreshold: -0.1,
        requiredLandmarks: jumpingJackPlugin.requiredLandmarks,
        minRepMs: 260,
        formChecks: [
            {
                reason: 'Jump your feet out too',
                test: feetApart,
            },
        ],
    }),
};
//# sourceMappingURL=jumping-jack.plugin.js.map