import { angleAt, bodyPoint, limbAngle, pairMeasurable } from '../geometry';
import { TwoPhaseRepSession } from '../rep-session';
import { LM } from '../types';
const LEFT_LEG = [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE];
const RIGHT_LEG = [LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE];
/** Shoulder-hip-knee angle: large lying flat, small when sat all the way up. */
function hipAngle(frame) {
    return angleAt(bodyPoint(frame, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER), bodyPoint(frame, LM.LEFT_HIP, LM.RIGHT_HIP), bodyPoint(frame, LM.LEFT_KNEE, LM.RIGHT_KNEE));
}
/**
 * Knees stay bent — straight-leg thrashing is not a sit-up.
 *
 * Passes when the ankles cannot be seen at all: a form check exists to reject
 * form it can observe going wrong, not to punish the player for a camera
 * placement that crops their feet.
 */
function kneesBent(frame) {
    if (!pairMeasurable(frame, LM.LEFT_ANKLE, LM.RIGHT_ANKLE))
        return true;
    return limbAngle(frame, LEFT_LEG, RIGHT_LEG) < 140;
}
export const sitUpPlugin = {
    slug: 'sit-up',
    displayName: 'Sit-ups',
    version: '2.0.0',
    description: 'Shoulders to the floor, then all the way up past vertical.',
    icon: '🔥',
    scoring: 'reps',
    cameraHint: 'Lie side-on to the camera, knees bent, whole body in frame.',
    requiredLandmarks: [
        [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
        [LM.LEFT_HIP, LM.RIGHT_HIP],
        [LM.LEFT_KNEE, LM.RIGHT_KNEE],
    ],
    createSession: () => new TwoPhaseRepSession({
        measure: hipAngle,
        bottomThreshold: 100,
        topThreshold: 128,
        requiredLandmarks: sitUpPlugin.requiredLandmarks,
        minRepMs: 400,
        formChecks: [
            {
                reason: 'Keep your knees bent',
                test: kneesBent,
            },
        ],
    }),
};
//# sourceMappingURL=sit-up.plugin.js.map