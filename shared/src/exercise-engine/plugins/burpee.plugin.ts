import { bodyPoint, distance } from '../geometry';
import { TwoPhaseRepSession } from '../rep-session';
import { LM, type ExercisePlugin, type PoseFrame } from '../types';

/**
 * Vertical position of the hips within the frame, scaled by torso length.
 * Standing tall gives a small value; dropping to the floor gives a large one.
 * Using a ratio rather than raw y keeps this stable across camera placements.
 */
function hipDropRatio(frame: PoseFrame): number {
  const shoulder = bodyPoint(frame, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER);
  const hip = bodyPoint(frame, LM.LEFT_HIP, LM.RIGHT_HIP);
  const ankle = bodyPoint(frame, LM.LEFT_ANKLE, LM.RIGHT_ANKLE);
  const torso = distance(shoulder, hip);
  if (torso === 0) return 0;
  // How close the hips have fallen toward ankle level, in torso-lengths.
  return (torso - (ankle.y - hip.y)) / torso;
}

/** At the bottom the hands must be planted — a squat is not a burpee. */
function handsDown(frame: PoseFrame): boolean {
  const wrist = bodyPoint(frame, LM.LEFT_WRIST, LM.RIGHT_WRIST);
  const hip = bodyPoint(frame, LM.LEFT_HIP, LM.RIGHT_HIP);
  return wrist.y > hip.y;
}

export const burpeePlugin: ExercisePlugin = {
  slug: 'burpee',
  displayName: 'Burpees',
  version: '2.0.0',
  description: 'Chest toward the floor, then explode back up to a full stand.',
  icon: '⚡',
  scoring: 'reps',
  cameraHint: 'Camera side-on and low, 3m away, so standing and floor both fit.',
  requiredLandmarks: [
    [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
    [LM.LEFT_HIP, LM.RIGHT_HIP],
    [LM.LEFT_ANKLE, LM.RIGHT_ANKLE],
    [LM.LEFT_WRIST, LM.RIGHT_WRIST],
  ],
  createSession: () =>
    new TwoPhaseRepSession({
      measure: hipDropRatio,
      // Inverted: a larger drop ratio means deeper into the rep.
      invert: true,
      bottomThreshold: 0.45,
      topThreshold: 0.1,
      requiredLandmarks: burpeePlugin.requiredLandmarks,
      minRepMs: 800,
      formChecks: [
        {
          reason: 'Hands to the floor at the bottom',
          test: handsDown,
        },
      ],
    }),
};
