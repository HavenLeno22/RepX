import { angleAt, bodyPoint, heightInTorsos } from '../geometry';
import { TwoPhaseRepSession } from '../rep-session';
import { LM, type ExercisePlugin, type PoseFrame } from '../types';

/**
 * Hip height above the ankles, measured in torso-lengths.
 *
 * ~2.0 standing tall, ~1.55 at a half squat, ~1.15 at parallel or below.
 *
 * This replaces the original 2D knee-angle measure, which was wrong in practice:
 * filmed from a laptop webcam in front of the player, the knee travels toward
 * the camera instead of across it, so a full squat barely moved the projected
 * angle and correct reps were silently rejected. See `heightInTorsos` for the
 * measures that were tried and rejected.
 */
function hipHeight(frame: PoseFrame): number {
  const shoulder = bodyPoint(frame, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER);
  const hip = bodyPoint(frame, LM.LEFT_HIP, LM.RIGHT_HIP);
  const ankle = bodyPoint(frame, LM.LEFT_ANKLE, LM.RIGHT_ANKLE);
  return heightInTorsos(hip, ankle, shoulder, hip);
}

/** Guards against bending at the waist instead of sitting down into the squat. */
function torsoAngle(frame: PoseFrame): number {
  return angleAt(
    bodyPoint(frame, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER),
    bodyPoint(frame, LM.LEFT_HIP, LM.RIGHT_HIP),
    bodyPoint(frame, LM.LEFT_KNEE, LM.RIGHT_KNEE),
  );
}

export const squatPlugin: ExercisePlugin = {
  slug: 'squat',
  displayName: 'Squats',
  version: '3.0.0',
  description: 'Sit down to at least a half squat, then stand all the way up.',
  icon: '🦵',
  scoring: 'reps',
  cameraHint: 'Stand 2–3m back, whole body in frame. Front-on or side-on both work.',
  requiredLandmarks: [
    [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
    [LM.LEFT_HIP, LM.RIGHT_HIP],
    [LM.LEFT_ANKLE, LM.RIGHT_ANKLE],
  ],
  createSession: () =>
    new TwoPhaseRepSession({
      measure: hipHeight,
      // Deliberately forgiving: 1.55 is roughly a half squat, above parallel.
      // Under-counting a real rep is a far worse product failure than
      // crediting a slightly shallow one.
      bottomThreshold: 1.55,
      topThreshold: 1.8,
      requiredLandmarks: squatPlugin.requiredLandmarks,
      minRepMs: 450,
      formChecks: [
        {
          reason: 'Chest up — sit down, don’t fold forward',
          test: (frame) => torsoAngle(frame) > 35,
        },
      ],
    }),
};
