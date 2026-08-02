import { angleAt, bodyPoint } from '../geometry';
import { HoldSession } from '../rep-session';
import { LM } from '../types';
/** Shoulder-hip-ankle angle: ~180° is a straight, correct plank line. */
function bodyLineAngle(frame) {
    return angleAt(bodyPoint(frame, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER), bodyPoint(frame, LM.LEFT_HIP, LM.RIGHT_HIP), bodyPoint(frame, LM.LEFT_ANKLE, LM.RIGHT_ANKLE));
}
/** The body must be roughly horizontal — standing still is not a plank. */
function isHorizontal(frame) {
    const shoulder = bodyPoint(frame, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER);
    const ankle = bodyPoint(frame, LM.LEFT_ANKLE, LM.RIGHT_ANKLE);
    const rise = Math.abs(shoulder.y - ankle.y);
    const run = Math.abs(shoulder.x - ankle.x);
    return run > rise;
}
export const plankPlugin = {
    slug: 'plank',
    displayName: 'Plank',
    version: '2.0.0',
    description: 'Hold a straight line from shoulders to heels. One point per second.',
    icon: '🧱',
    scoring: 'hold',
    cameraHint: 'Camera side-on and low, 2–3m away, full body length in frame.',
    requiredLandmarks: [
        [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
        [LM.LEFT_HIP, LM.RIGHT_HIP],
        [LM.LEFT_ANKLE, LM.RIGHT_ANKLE],
    ],
    createSession: () => new HoldSession({
        requiredLandmarks: plankPlugin.requiredLandmarks,
        msPerPoint: 1000,
        formChecks: [
            {
                reason: 'Get into a horizontal plank position',
                test: isHorizontal,
            },
            {
                reason: 'Straighten up — hips too high or too low',
                test: (frame) => bodyLineAngle(frame) > 145,
            },
        ],
    }),
};
//# sourceMappingURL=plank.plugin.js.map