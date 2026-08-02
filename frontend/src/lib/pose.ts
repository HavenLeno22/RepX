/**
 * On-device pose estimation.
 *
 * MediaPipe Pose Landmarker runs entirely in the browser: camera frames never
 * leave the device, only the 33 derived landmarks are streamed to the server for
 * authoritative verification. See docs/AI_ENGINE.md.
 *
 * Note: the WASM runtime and model weights are fetched from a CDN on first use,
 * so the very first load needs an internet connection. They are cached after.
 */

import type { PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import type { Landmark } from '@repx/shared';

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

/**
 * Builds the pose landmarker, loading the MediaPipe library on demand.
 *
 * The import is dynamic rather than top-level so the tasks-vision bundle — by
 * far the largest dependency in the app — stays out of the initial download.
 * The lobby, leaderboard and profile screens never touch pose estimation, and
 * making them wait on it made the app feel like a heavy web page on first open.
 */
export function loadPoseLandmarker(): Promise<PoseLandmarker> {
  landmarkerPromise ??= (async () => {
    const vision = await import('@mediapipe/tasks-vision');
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_ROOT);
    return vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    });
  })();

  return landmarkerPromise;
}

/**
 * Converts a MediaPipe result into the shared `Landmark[]` contract.
 * Returns null when no person is detected in the frame.
 */
export function toPoseFrame(result: PoseLandmarkerResult): Landmark[] | null {
  const pose = result.landmarks?.[0];
  if (!pose || pose.length === 0) return null;

  return pose.map((lm) => ({
    x: lm.x,
    y: lm.y,
    z: lm.z ?? 0,
    // MediaPipe marks visibility optional; treat missing as fully visible since
    // the landmark was emitted at all.
    visibility: typeof lm.visibility === 'number' ? lm.visibility : 1,
  }));
}

/** Landmark index pairs forming the skeleton drawn over the camera feed. */
export const SKELETON: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 31], [28, 32],
];

/**
 * Opens the camera. Deliberately independent of any video element so the stream
 * can be acquired before the arena is on screen — see `lib/arena.ts`.
 */
export async function startCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: false,
  });
}

/** Attaches an already-open stream to a video element and starts playback. */
export async function attachCamera(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
  if (video.srcObject !== stream) video.srcObject = stream;
  if (video.paused) await video.play();
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * Trims a landmark frame to four decimal places before it goes over the wire.
 *
 * Normalized coordinates are meaningful to about a thousandth of the frame —
 * a quarter of a pixel on a 1080p feed — so full float precision was spending
 * roughly two thirds of the payload on digits no measure can distinguish. At
 * thirty frames a second on a phone connection, that is the difference between
 * a comfortable stream and a stuttering one.
 */
export function compactFrame(frame: Landmark[]): Landmark[] {
  return frame.map((lm) => ({
    x: Math.round(lm.x * 1e4) / 1e4,
    y: Math.round(lm.y * 1e4) / 1e4,
    z: Math.round(lm.z * 1e4) / 1e4,
    visibility: Math.round(lm.visibility * 1e3) / 1e3,
  }));
}
