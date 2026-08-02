import { bodyPoint, limbAngle } from '../geometry';
import { TwoPhaseRepSession } from '../rep-session';
import { LM } from '../types';
const LEFT_ARM = [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST];
const RIGHT_ARM = [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST];
function elbowAngle(frame) {
    return limbAngle(frame, LEFT_ARM, RIGHT_ARM);
}
/**
 * Hands must be overhead for this to be a pull-up rather than a curl.
 * Normalized y increases downward, so "above" means a smaller y.
 */
function handsOverhead(frame) {
    const wrist = bodyPoint(frame, LM.LEFT_WRIST, LM.RIGHT_WRIST);
    const shoulder = bodyPoint(frame, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER);
    return wrist.y < shoulder.y;
}
export const pullUpPlugin = {
    slug: 'pull-up',
    displayName: 'Pull-ups',
    version: '2.0.0',
    description: 'Full dead hang to chin over the bar. No kipping credit.',
    icon: '🏋️',
    scoring: 'reps',
    cameraHint: 'Camera side-on to the bar, far enough back to see your full hang.',
    requiredLandmarks: [
        [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
        [LM.LEFT_ELBOW, LM.RIGHT_ELBOW],
        [LM.LEFT_WRIST, LM.RIGHT_WRIST],
    ],
    createSession: () => new TwoPhaseRepSession({
        // The "bottom" of the state machine is the top of the pull — the point of
        // peak effort — so the tracked angle is smallest there, same as a push-up.
        measure: elbowAngle,
        bottomThreshold: 105,
        topThreshold: 150,
        requiredLandmarks: pullUpPlugin.requiredLandmarks,
        minRepMs: 550,
        formChecks: [
            {
                reason: 'Hands must be overhead on the bar',
                test: handsOverhead,
            },
        ],
    }),
};
//# sourceMappingURL=pull-up.plugin.js.map