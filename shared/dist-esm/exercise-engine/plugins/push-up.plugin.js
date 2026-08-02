import { angleAt, bodyPoint, limbAngle } from '../geometry';
import { TwoPhaseRepSession } from '../rep-session';
import { LM } from '../types';
const LEFT_ARM = [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST];
const RIGHT_ARM = [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST];
/** Elbow angle, taken from whichever arm the camera can see. */
function elbowAngle(frame) {
    return limbAngle(frame, LEFT_ARM, RIGHT_ARM);
}
/** Shoulder-hip-knee angle: near 180° means a straight, unbroken plank line. */
function bodyLineAngle(frame) {
    return angleAt(bodyPoint(frame, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER), bodyPoint(frame, LM.LEFT_HIP, LM.RIGHT_HIP), bodyPoint(frame, LM.LEFT_KNEE, LM.RIGHT_KNEE));
}
export const pushUpPlugin = {
    slug: 'push-up',
    displayName: 'Push-ups',
    version: '3.0.0',
    description: 'Chest to the floor, arms locked at the top. Hips stay in line.',
    icon: '💪',
    scoring: 'reps',
    cameraHint: 'Phone on the floor to your side, 2–3m away, whole body visible.',
    requiredLandmarks: [
        [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
        [LM.LEFT_ELBOW, LM.RIGHT_ELBOW],
        [LM.LEFT_WRIST, LM.RIGHT_WRIST],
        [LM.LEFT_HIP, LM.RIGHT_HIP],
    ],
    createSession: () => new TwoPhaseRepSession({
        // Elbow angle is reliable here because a push-up is filmed side-on, where
        // the arm bends across the camera rather than toward it.
        measure: elbowAngle,
        bottomThreshold: 112,
        topThreshold: 150,
        requiredLandmarks: pushUpPlugin.requiredLandmarks,
        minRepMs: 450,
        formChecks: [
            {
                reason: 'Keep your hips in line — no sagging or piking',
                test: (frame) => bodyLineAngle(frame) > 130,
            },
        ],
    }),
};
//# sourceMappingURL=push-up.plugin.js.map