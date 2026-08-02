/**
 * Thin REST client.
 *
 * Handles token attachment and one transparent refresh-and-retry on 401, so
 * screens never deal with token lifecycle. See docs/AUTHENTICATION.md.
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onSessionLost: (() => void) | null = null;
let onTokenRefreshed: ((access: string) => void) | null = null;

export function setTokens(access: string | null, refresh: string | null): void {
  accessToken = access;
  refreshToken = refresh;
  if (access && refresh) {
    localStorage.setItem('repx.tokens', JSON.stringify({ access, refresh }));
    onTokenRefreshed?.(access);
  } else {
    localStorage.removeItem('repx.tokens');
  }
}

/** Notified whenever a fresh access token lands, so the socket can adopt it. */
export function setTokenRefreshedHandler(handler: (access: string) => void): void {
  onTokenRefreshed = handler;
}

export function loadStoredTokens(): { access: string; refresh: string } | null {
  const raw = localStorage.getItem('repx.tokens');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { access: string; refresh: string };
    accessToken = parsed.access;
    refreshToken = parsed.refresh;
    return parsed;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setSessionLostHandler(handler: () => void): void {
  onSessionLost = handler;
}

async function raw<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const err = (body as { error?: { message?: string; code?: string } } | null)?.error;
    throw new ApiError(
      err?.message ?? 'Request failed',
      err?.code ?? 'ERROR',
      response.status,
    );
  }

  return body as T;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await raw<T>(path, init);
  } catch (error) {
    const isAuthFailure = error instanceof ApiError && error.status === 401;
    if (!isAuthFailure || !refreshToken) throw error;

    try {
      const refreshed = await raw<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
      setTokens(refreshed.accessToken, refreshed.refreshToken);
      return await raw<T>(path, init);
    } catch {
      setTokens(null, null);
      onSessionLost?.();
      throw error;
    }
  }
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
