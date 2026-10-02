import type { AuthResponse, OAuthProvider, PublicUser } from '@repx/shared';
import { create } from 'zustand';
import {
  ApiError,
  get as apiGet,
  loadStoredTokens,
  post,
  setSessionLostHandler,
  setTokenRefreshedHandler,
  setTokens,
} from '../lib/api';
import { connectSocket, disconnectSocket, updateSocketToken } from '../lib/socket';

interface AuthState {
  user: PublicUser | null;
  ready: boolean;
  register: (input: { email: string; username: string; password: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  /** Exchanges a verified provider ID token for a RepX session. */
  signInWithProvider: (
    provider: OAuthProvider,
    idToken: string,
    username?: string,
  ) => Promise<void>;
  logout: () => void;
  restore: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: PublicUser) => void;
}

export const useAuth = create<AuthState>((set, getState) => ({
  user: null,
  ready: false,

  setUser: (user) => set({ user }),

  async register(input) {
    const res = await post<AuthResponse>('/auth/register', input);
    applySession(res);
    set({ user: res.user });
  },

  async login(input) {
    const res = await post<AuthResponse>('/auth/login', input);
    applySession(res);
    set({ user: res.user });
  },

  async signInWithProvider(provider, idToken, username) {
    // The ID token is all the server needs — it verifies the signature and reads
    // the identity out of the verified claims, so nothing here is trusted.
    const res = await post<AuthResponse>('/auth/oauth', { provider, idToken, username });
    applySession(res);
    set({ user: res.user });
  },

  logout() {
    setTokens(null, null);
    disconnectSocket();
    set({ user: null });
  },

  async restore() {
    const stored = loadStoredTokens();
    if (!stored) {
      set({ ready: true });
      return;
    }
    try {
      const user = await apiGet<PublicUser>('/users/me');
      connectSocket(stored.access);
      set({ user, ready: true });
    } catch (error) {
      /**
       * Only a rejected session clears the session.
       *
       * This used to clear it on *any* failure, which meant the server merely
       * being unreachable — a restart, a dropped wifi, a deploy — deleted the
       * refresh token out of localStorage and dropped the player on the sign-in
       * screen. That is the worst possible response to a transient fault: the
       * credentials were still perfectly valid, and destroying them turned a
       * ten-second outage into "log in again", on a screen that could not have
       * logged them in either because the same server was still down.
       *
       * A network failure now leaves the stored tokens exactly where they are.
       * `App` retries the restore as soon as the API answers again, and the
       * player lands back in the app without typing anything.
       */
      const unreachable = error instanceof ApiError && error.status === 0;
      if (!unreachable) setTokens(null, null);
      set({ user: null, ready: true });
    }
  },

  async refreshUser() {
    if (!getState().user) return;
    try {
      set({ user: await apiGet<PublicUser>('/users/me') });
    } catch {
      /* non-fatal: keep the stale profile rather than blanking the UI */
    }
  },
}));

function applySession(res: AuthResponse): void {
  setTokens(res.accessToken, res.refreshToken);
  connectSocket(res.accessToken);
}

setSessionLostHandler(() => {
  disconnectSocket();
  useAuth.setState({ user: null });
});

setTokenRefreshedHandler((access) => updateSocketToken(access));
