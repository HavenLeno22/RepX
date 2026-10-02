/**
 * Challenges and private rooms.
 *
 * Kept out of the match store on purpose. `useMatch` owns one thing — the state
 * machine of a match you are in — and folding "somebody is asking you to play"
 * into it would mean every screen that reads match phase re-renders when an
 * unrelated invite arrives.
 *
 * All of this is server-authoritative: the store holds what the last socket
 * event said and never predicts. A challenge that looks accepted locally but was
 * not is worse than a half-second of latency.
 */

import { create } from 'zustand';
import type { ChallengeSummary, RoomState } from '@repx/shared';

interface LobbyState {
  /** A challenge someone has sent you, awaiting an answer. */
  incoming: ChallengeSummary | null;
  /** A challenge you sent, awaiting theirs. */
  outgoing: ChallengeSummary | null;
  /** The private room you are in. */
  room: RoomState | null;
  /** The last thing that went wrong, for the dialog that caused it. */
  error: string | null;

  setIncoming: (challenge: ChallengeSummary | null) => void;
  setOutgoing: (challenge: ChallengeSummary | null) => void;
  setRoom: (room: RoomState | null) => void;
  setError: (message: string | null) => void;
  /** Clears a challenge by id, whichever side of it we are on. */
  clearChallenge: (challengeId: string) => void;
  reset: () => void;
}

export const useLobby = create<LobbyState>((set, get) => ({
  incoming: null,
  outgoing: null,
  room: null,
  error: null,

  setIncoming: (incoming) => set({ incoming }),
  setOutgoing: (outgoing) => set({ outgoing }),
  setRoom: (room) => set({ room }),
  setError: (error) => set({ error }),

  clearChallenge: (challengeId) => {
    const { incoming, outgoing } = get();
    set({
      incoming: incoming?.challengeId === challengeId ? null : incoming,
      outgoing: outgoing?.challengeId === challengeId ? null : outgoing,
    });
  },

  reset: () => set({ incoming: null, outgoing: null, room: null, error: null }),
}));
