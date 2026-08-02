/**
 * Live match client state.
 *
 * Mirrors the server's match state machine (docs/MULTIPLAYER.md). Rep counts
 * here are whatever the *server* last confirmed — the local exercise session is
 * used only for instant coaching feedback, never to score the match.
 */

import type { MatchEndedPayload, MatchFoundPayload, PublicUser, QueueStatusPayload } from '@repx/shared';
import { create } from 'zustand';

export type MatchPhase = 'idle' | 'queued' | 'found' | 'active' | 'ended';

interface MatchState {
  phase: MatchPhase;
  queue: QueueStatusPayload | null;
  info: MatchFoundPayload | null;
  /** Server clock minus local clock, in ms. Added to `Date.now()` for timings. */
  clockOffset: number;
  /** Server timestamp at which the match goes live. */
  startsAt: number | null;
  endsAt: number | null;
  myReps: number;
  opponentReps: number;
  /** Transient coaching message, e.g. "Go deeper". */
  feedback: string | null;
  feedbackAt: number;
  /** Pulse counter — increments on every confirmed rep to drive animation. */
  repPulse: number;
  opponentDisconnected: boolean;
  result: (MatchEndedPayload & { opponent: PublicUser | null }) | null;

  setQueued: (queue: QueueStatusPayload) => void;
  setFound: (info: MatchFoundPayload) => void;
  setActive: (endsAt: number, serverNow: number) => void;
  setMyReps: (reps: number) => void;
  setOpponentReps: (reps: number) => void;
  setFeedback: (message: string) => void;
  setOpponentDisconnected: (value: boolean) => void;
  setResult: (result: MatchEndedPayload & { opponent: PublicUser | null }) => void;
  reset: () => void;
}

const IDLE = {
  phase: 'idle' as const,
  queue: null,
  info: null,
  startsAt: null,
  endsAt: null,
  myReps: 0,
  opponentReps: 0,
  feedback: null,
  repPulse: 0,
  opponentDisconnected: false,
  result: null,
};

export const useMatch = create<MatchState>((set) => ({
  ...IDLE,
  clockOffset: 0,
  feedbackAt: 0,

  setQueued: (queue) => set({ phase: 'queued', queue }),

  setFound: (info) =>
    set({
      ...IDLE,
      phase: 'found',
      info,
      startsAt: info.startsAt,
      // Every server payload carries the server's own clock so timings can be
      // expressed in server time. Without this the countdown ran on whatever
      // the device's clock said, which on a phone that has drifted by a few
      // seconds meant starting the match at visibly the wrong moment.
      clockOffset: info.serverNow - Date.now(),
    }),

  setActive: (endsAt, serverNow) =>
    set({ phase: 'active', endsAt, clockOffset: serverNow - Date.now() }),

  setMyReps: (reps) => set((s) => ({ myReps: reps, repPulse: s.repPulse + 1, feedback: null })),
  setOpponentReps: (reps) => set({ opponentReps: reps }),
  setFeedback: (message) => set({ feedback: message, feedbackAt: Date.now() }),
  setOpponentDisconnected: (value) => set({ opponentDisconnected: value }),
  setResult: (result) => set({ phase: 'ended', result }),
  reset: () => set({ ...IDLE }),
}));

/** The current time as the server would report it. */
export function serverTime(): number {
  return Date.now() + useMatch.getState().clockOffset;
}
