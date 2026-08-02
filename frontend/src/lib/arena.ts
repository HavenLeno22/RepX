/**
 * Arena readiness — camera and pose model, prepared before they are needed.
 *
 * The original flow started the camera and downloaded the pose model *after* an
 * opponent had been found, which put a multi-second cold download directly in
 * the path of a countdown that had already started on the server. On a first
 * visit the match went live while the player was still looking at a loading
 * spinner, and they lost every rep of that window. Nothing about that is
 * recoverable after the fact, so the fix is ordering: warm the model while the
 * player is choosing an exercise, take the camera when they commit to
 * searching, and only enter the queue once both are actually live.
 *
 * Both resources are singletons held here for the lifetime of the session —
 * the model because it is expensive to build, the camera because re-acquiring
 * it between matches makes the preview flicker black on every rematch.
 */

import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { create } from 'zustand';
import { loadPoseLandmarker, startCamera, stopCamera } from './pose';

export type ArenaStatus = 'idle' | 'model' | 'camera' | 'ready' | 'error';

interface ArenaState {
  status: ArenaStatus;
  error: string | null;
  set: (status: ArenaStatus, error?: string | null) => void;
}

export const useArena = create<ArenaState>((set) => ({
  status: 'idle',
  error: null,
  set: (status, error = null) => set({ status, error }),
}));

let landmarker: PoseLandmarker | null = null;
let stream: MediaStream | null = null;
let warming: Promise<PoseLandmarker> | null = null;

/**
 * Downloads and builds the pose model. Safe to call repeatedly and safe to
 * abandon — no permission prompt, so it can run the moment the lobby opens.
 */
export function warmModel(): Promise<PoseLandmarker> {
  if (landmarker) return Promise.resolve(landmarker);
  warming ??= (async () => {
    const { status } = useArena.getState();
    if (status === 'idle' || status === 'error') useArena.getState().set('model');
    try {
      landmarker = await loadPoseLandmarker();
      if (useArena.getState().status === 'model') useArena.getState().set('idle');
      return landmarker;
    } catch (error) {
      warming = null;
      useArena.getState().set('error', describe(error));
      throw error;
    }
  })();
  return warming;
}

/**
 * Brings the whole arena up: model built, camera streaming, ready to score.
 * Resolves only when a real match could start this instant.
 */
export async function prepareArena(): Promise<void> {
  try {
    if (!landmarker) {
      useArena.getState().set('model');
      await warmModel();
    }

    if (!isStreamLive(stream)) {
      useArena.getState().set('camera');
      stream = await startCamera();
    }

    useArena.getState().set('ready');
  } catch (error) {
    useArena.getState().set('error', describe(error));
    throw error;
  }
}

export function getLandmarker(): PoseLandmarker | null {
  return landmarker;
}

export function getStream(): MediaStream | null {
  return isStreamLive(stream) ? stream : null;
}

/**
 * Hands the camera back. The pose model is deliberately kept — it costs nothing
 * to hold and rebuilding it is the expensive part.
 */
export function releaseCamera(): void {
  stopCamera(stream);
  stream = null;
  if (useArena.getState().status !== 'error') useArena.getState().set('idle');
}

function isStreamLive(candidate: MediaStream | null): candidate is MediaStream {
  return candidate !== null && candidate.getVideoTracks().some((track) => track.readyState === 'live');
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'NotAllowedError') {
      return 'Camera access was denied. Allow it in your browser settings, then try again.';
    }
    if (error.name === 'NotFoundError') return 'No camera found on this device.';
    if (error.name === 'NotReadableError') {
      return 'Your camera is already in use by another app.';
    }
    return error.message;
  }
  return 'Could not start the camera or pose model.';
}
