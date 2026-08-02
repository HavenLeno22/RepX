/**
 * Pure geometry helpers shared by every exercise plugin.
 *
 * All math operates on normalized landmark coordinates, so it is resolution- and
 * device-independent.
 */

import type { Landmark, LandmarkRequirement, PoseFrame } from './types';

/**
 * Minimum model confidence for a landmark to be trusted.
 *
 * Kept deliberately forgiving: MediaPipe reports low visibility for legs in
 * ordinary indoor lighting, and rejecting those frames means rejecting real
 * reps. Integrity is enforced by anti-cheat and range-of-motion checks, not by
 * demanding a pristine skeleton.
 */
export const MIN_VISIBILITY = 0.35;

/**
 * Height of a joint above a reference point, measured in torso-lengths.
 *
 * This is the workhorse measure for exercises filmed from an unknown camera
 * angle, and the torso is the ruler for a specific reason: it is the one
 * segment that neither bends nor foreshortens appreciably during a squat,
 * burpee or sit-up, so it stays a constant unit while the legs do not.
 *
 * Two measures that seem reasonable and are *not* used, because both were
 * checked and both fail:
 *
 *  - **2D knee angle.** Filmed head-on from a laptop webcam, the knee travels
 *    toward the camera rather than across it, so a full squat barely changes
 *    the projected angle. Real reps measured as shallow and were rejected.
 *  - **Vertical span ÷ leg segment lengths.** Fails the same way: as the leg
 *    foreshortens, the segment lengths shrink in step with the span, so the
 *    ratio stays ~1.0 whether you are standing or at the bottom of a squat.
 *
 * Normalizing by the torso gives ~2.0 standing and ~1.15 at parallel from the
 * front *and* the side — a large, consistent signal either way.
 */
export function heightInTorsos(
  joint: Landmark,
  reference: Landmark,
  shoulder: Landmark,
  hip: Landmark,
): number {
  const torso = distance(shoulder, hip);
  if (torso === 0) return 2;
  // y grows downward, so reference.y - joint.y is positive when joint is higher.
  return (reference.y - joint.y) / torso;
}

/**
 * Interior angle at vertex `b` formed by points a-b-c, in degrees (0..180).
 * Computed in 2D — depth (z) from a single camera is too noisy to rely on.
 */
export function angleAt(a: Landmark, b: Landmark, c: Landmark): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;

  const dot = abx * cbx + aby * cby;
  const magAb = Math.hypot(abx, aby);
  const magCb = Math.hypot(cbx, cby);
  if (magAb === 0 || magCb === 0) return 0;

  const cos = Math.max(-1, Math.min(1, dot / (magAb * magCb)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Landmark, b: Landmark): Landmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility, b.visibility),
  };
}

/**
 * The best available estimate of a two-sided body point (both shoulders, both
 * hips, …), given that one side is routinely occluded.
 *
 * Plain `midpoint` averages the two sides unconditionally, which quietly drags
 * the result toward whichever side the model was guessing at: an occluded far
 * wrist can be reported at a plausible-looking but wrong position, and averaging
 * it in halves the measured range of motion. Weighting by confidence — and
 * ignoring a side outright once it drops below the trust floor — keeps the
 * measure anchored to the joint the camera can actually see.
 */
export function bodyPoint(frame: PoseFrame, left: number, right: number): Landmark {
  const a = frame[left];
  const b = frame[right];
  if (!a) return b ?? ORIGIN;
  if (!b) return a;

  const aOk = a.visibility >= MIN_VISIBILITY;
  const bOk = b.visibility >= MIN_VISIBILITY;
  if (aOk && !bOk) return a;
  if (bOk && !aOk) return b;

  // Both usable (or both poor): weight by confidence so the better-seen side
  // dominates, rather than letting a marginal landmark pull the point halfway.
  const wa = Math.max(a.visibility, 1e-6);
  const wb = Math.max(b.visibility, 1e-6);
  const total = wa + wb;
  return {
    x: (a.x * wa + b.x * wb) / total,
    y: (a.y * wa + b.y * wb) / total,
    z: (a.z * wa + b.z * wb) / total,
    visibility: Math.max(a.visibility, b.visibility),
  };
}

const ORIGIN: Landmark = { x: 0, y: 0, z: 0, visibility: 0 };

/** A three-joint chain (shoulder-elbow-wrist, hip-knee-ankle, …). */
export type Chain = readonly [number, number, number];

/**
 * The angle of a limb, read from whichever side the camera can actually see.
 *
 * Averaging the two sides unconditionally — the original approach — is only
 * correct when both are visible. Filmed side-on, which is how push-ups and
 * pull-ups are meant to be filmed, the far arm is occluded for the whole set
 * and the model's guess at it is close to the near arm's *previous* position.
 * Averaging that in compressed the measured range of motion enough to push
 * honest full-depth reps back above the bottom threshold.
 *
 * So: trust both sides only when both are trustworthy, and weight them by
 * confidence when they are.
 */
export function limbAngle(frame: PoseFrame, left: Chain, right: Chain): number {
  const lc = chainConfidence(frame, left);
  const rc = chainConfidence(frame, right);

  if (lc < MIN_VISIBILITY && rc < MIN_VISIBILITY) return 0;
  if (lc < MIN_VISIBILITY) return angleOfChain(frame, right);
  if (rc < MIN_VISIBILITY) return angleOfChain(frame, left);

  return (angleOfChain(frame, left) * lc + angleOfChain(frame, right) * rc) / (lc + rc);
}

/** A chain is only as trustworthy as its least-visible joint. */
export function chainConfidence(frame: PoseFrame, chain: Chain): number {
  let lowest = 1;
  for (const index of chain) {
    const landmark = frame[index];
    if (!landmark) return 0;
    lowest = Math.min(lowest, landmark.visibility);
  }
  return lowest;
}

function angleOfChain(frame: PoseFrame, chain: Chain): number {
  return angleAt(frame[chain[0]], frame[chain[1]], frame[chain[2]]);
}

/**
 * True when a pair of landmarks is well enough seen to judge form from.
 *
 * Form checks use this to distinguish "I can see this and it is wrong" from
 * "I cannot see this" — only the former should cost the player a rep.
 */
export function pairMeasurable(frame: PoseFrame, a: number, b: number): boolean {
  return visible(frame[a]) && visible(frame[b]);
}

/**
 * True if every requirement is satisfied: a bare index must itself be visible,
 * a left/right pair needs only one of its two sides. See `LandmarkRequirement`
 * for why "either side" is the right rule.
 */
export function landmarksVisible(frame: PoseFrame, required: readonly LandmarkRequirement[]): boolean {
  for (const requirement of required) {
    if (typeof requirement === 'number') {
      if (!visible(frame[requirement])) return false;
    } else if (!visible(frame[requirement[0]]) && !visible(frame[requirement[1]])) {
      return false;
    }
  }
  return true;
}

function visible(landmark: Landmark | undefined): boolean {
  return landmark !== undefined && landmark.visibility >= MIN_VISIBILITY;
}

/**
 * Maps a value from one range to a 0..1 completion fraction, clamped.
 * Used to drive the "how deep are you in this rep" progress ring.
 */
export function normalize(value: number, from: number, to: number): number {
  if (from === to) return 0;
  return Math.max(0, Math.min(1, (value - from) / (to - from)));
}

/**
 * Outlier-rejecting smoother for noisy measures.
 *
 * A plain moving average was the original approach and it has the wrong failure
 * mode: one bad model frame is not damped, it is *spread* across the window, so
 * a single spurious spike near a threshold could trip a phantom rep and a
 * single dropout could cancel a real one. Taking the median of the last three
 * samples first discards a lone spike completely, whatever its size; the light
 * exponential pass after it removes the remaining jitter without adding the
 * extra frame of lag that a wider window costs.
 *
 * Net effect at 30fps: ~1 frame of latency, and single-frame noise of any
 * magnitude is rejected rather than averaged in.
 */
export class Smoother {
  private readonly window: number[] = [];
  private smoothed: number | null = null;

  /**
   * @param alpha Exponential weight for the newest median, 0..1. 0.6 keeps the
   *   counter feeling attached to the body; lower values visibly trail it.
   */
  constructor(private readonly alpha = 0.6) {}

  push(value: number): number {
    this.window.push(value);
    if (this.window.length > 3) this.window.shift();

    const median = medianOf(this.window);
    this.smoothed = this.smoothed === null ? median : this.smoothed + this.alpha * (median - this.smoothed);
    return this.smoothed;
  }

  get value(): number {
    return this.smoothed ?? 0;
  }

  /** True once enough samples have arrived for the median to mean anything. */
  get primed(): boolean {
    return this.window.length >= 2;
  }

  reset(): void {
    this.window.length = 0;
    this.smoothed = null;
  }
}

function medianOf(values: number[]): number {
  if (values.length === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
