import type { AuthResponse, PublicUser } from '@repx/shared';
import { create } from 'zustand';
import {
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
    } catch {
      setTokens(null, null);
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
