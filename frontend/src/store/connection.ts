import { create } from 'zustand';
import { setReachabilityHandler } from '../lib/api';

/**
 * Whether the API answered the most recent request.
 *
 * Deliberately not `navigator.onLine`. That flag reports whether the device
 * thinks it has *a* network, which is a different question and a less useful
 * one: it stays true on a captive portal, and it says nothing at all about
 * whether the RepX server is running. What matters to the app is only ever
 * "did our API respond", so that is what this tracks.
 */
interface ConnectionState {
  reachable: boolean;
  setReachable: (reachable: boolean) => void;
}

export const useConnection = create<ConnectionState>((set) => ({
  reachable: true,
  // Compared before setting so a healthy app does not re-render every component
  // subscribed to this store on every single successful request.
  setReachable: (reachable) => set((state) => (state.reachable === reachable ? state : { reachable })),
}));

/**
 * Registered at module load, not inside a component.
 *
 * This matters and it was a real bug: the very first request the app makes is
 * the session restore in `App`, and it happens while the app is still rendering
 * its boot spinner — before any banner component has mounted. A handler
 * registered in a `useEffect` is installed *after* that request has already
 * failed, so the one failure most worth reporting was the one guaranteed to be
 * missed, and the app silently fell through to the sign-in screen instead.
 *
 * Importing this module is enough to arm it. `App` does, via OfflineBanner.
 */
setReachabilityHandler((reachable) => {
  useConnection.getState().setReachable(reachable);
});
