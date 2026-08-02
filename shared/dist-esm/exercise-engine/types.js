/**
 * Exercise engine core types.
 *
 * Every exercise is a plugin implementing `ExercisePlugin`. No exercise-specific
 * logic may exist anywhere outside a plugin — see docs/EXERCISE_ENGINE.md.
 */
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
};
//# sourceMappingURL=types.js.map