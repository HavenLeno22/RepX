/**
 * Exercise engine core types.
 *
 * Every exercise is a plugin implementing `ExercisePlugin`. No exercise-specific
 * logic may exist anywhere outside a plugin — see docs/EXERCISE_ENGINE.md.
 */

/** A single body landmark in normalized [0..1] image space. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  /** Model confidence that this landmark is actually visible, 0..1. */
  visibility: number;
}

/** MediaPipe Pose emits exactly 33 landmarks per frame, in this fixed order. */
export const LANDMARK_COUNT = 33;

export const LM = {
  NOSE: 0,
  LEFT_EYE: 2,
  RIGHT_EYE: 5,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

/** One frame of pose data. */
export type PoseFrame = Landmark[];

/**
 * What a plugin needs to see in order to judge a frame.
 *
 * A bare index demands that exact landmark. A pair demands *either* side — which
 * is what the body actually offers: filmed side-on, the far arm and leg are
 * occluded by the near ones for most of every rep, and MediaPipe reports their
 * visibility accordingly. Demanding both sides meant a correctly-performed
 * side-on push-up failed the visibility gate on the majority of its frames and
 * stopped counting. Every measure is built from left/right pairs, so either side
 * is enough to compute it. See docs/EXERCISE_ENGINE.md.
 */
export type LandmarkRequirement = number | readonly [number, number];

/** Result of feeding one frame to an exercise session. */
export type RepEvent =
  | { type: 'rep_counted'; quality: number; phase: string }
  | { type: 'rep_rejected'; reason: string; phase: string }
  | { type: 'progress'; phase: string; completion: number };

export interface ExerciseSession {
  /**
   * Feed one pose frame. Returns an event if something notable happened, or
   * null if the frame was unremarkable.
   *
   * Implementations MUST be deterministic: the same frame sequence must produce
   * the same events on client and server, or optimistic UI will drift from the
   * authoritative count.
   */
  processFrame(frame: PoseFrame, timestampMs: number): RepEvent | null;
  /** Current confirmed rep count for this session. */
  readonly repCount: number;
  /** Current state-machine phase, for UI coaching hints. */
  readonly phase: string;
  /**
   * 0..1 progress into the current rep. Surfaced as a live depth meter so the
   * player can see how far they still have to travel for the rep to count,
   * rather than guessing why one didn't register.
   */
  readonly completion: number;
  reset(): void;
}

export interface ExercisePlugin {
  /** Stable identifier, matches Exercise.slug in the database. */
  slug: string;
  displayName: string;
  /** Bump on ANY change to rep-validity logic. See docs/EXERCISE_ENGINE.md. */
  version: string;
  /** Short coaching description shown in the exercise picker. */
  description: string;
  /** Emoji/icon used by the UI. */
  icon: string;
  /**
   * Whether this exercise is scored by counting reps or by holding a position.
   * Held exercises emit one "rep" per second sustained.
   */
  scoring: 'reps' | 'hold';
  /** Landmarks that must be visible for a frame to be usable. */
  requiredLandmarks: LandmarkRequirement[];
  /** Setup guidance shown before the match starts. */
  cameraHint: string;
  createSession(): ExerciseSession;
}
