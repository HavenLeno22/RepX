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

let onReachabilityChange: ((reachable: boolean) => void) | null = null;

/**
 * Notified on every request with whether the API answered at all.
 *
 * Registered once at the app root so a single banner can report "the server is
 * unreachable" instead of every screen independently guessing why its own fetch
 * failed.
 */
export function setReachabilityHandler(handler: (reachable: boolean) => void): void {
  onReachabilityChange = handler;
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
  let response: Response;

  try {
    response = await fetch(`${BASE}/api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    /**
     * The server could not be reached at all — it is down, the machine is
     * offline, or DNS failed. `fetch` signals this by rejecting with a bare
     * `TypeError`, which is emphatically NOT an ApiError, so without this every
     * screen's `catch (e) { if (e instanceof ApiError) … }` fell through to a
     * generic message. The result was an app that said "Could not load your
     * battles — this is on us, not you" on every single screen when the actual
     * problem was that the API was not running, which is both unhelpful and
     * needlessly self-incriminating.
     *
     * Status 0 is the convention for "no HTTP response happened". It matters
     * that this is distinguishable from a 500: a 500 means try something else,
     * a 0 means try again later.
     */
    onReachabilityChange?.(false);
    throw new ApiError('Cannot reach the RepX server', 'OFFLINE', 0);
  }

  // Any HTTP response at all — even a 500 — proves the server is there.
  onReachabilityChange?.(true);

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

/**
 * The refresh currently in flight, if any.
 *
 * Refresh tokens rotate: presenting one burns it. Most screens fire several
 * requests at once, so when the access token ages out they all 401 within the
 * same tick and every one of them used to start its own refresh with the same
 * token. Exactly one could win. The rest were rejected, and a rejected refresh
 * clears the session — so the reward for opening a screen that loads three
 * things in parallel was being signed out.
 *
 * Sharing one promise means the first 401 refreshes and the others wait for it.
 */
let refreshing: Promise<void> | null = null;

/** Whatever is in storage right now — which may be another tab's rotation. */
function readStored(): { access: string; refresh: string } | null {
  try {
    const raw = localStorage.getItem('repx.tokens');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { access?: string; refresh?: string };
    return parsed.access && parsed.refresh
      ? { access: parsed.access, refresh: parsed.refresh }
      : null;
  } catch {
    return null;
  }
}

function refreshSession(): Promise<void> {
  refreshing ??= (async () => {
    const presented = readStored()?.refresh ?? refreshToken;
    if (!presented) throw new ApiError('No session', 'UNAUTHORIZED', 401);

    try {
      const refreshed = await raw<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: presented }),
      });
      setTokens(refreshed.accessToken, refreshed.refreshToken);
    } catch (error) {
      /**
       * Another tab may have rotated the token while this request was in the
       * air, which makes ours stale rather than invalid — the session is alive
       * and the credentials for it are sitting in storage. Adopting them beats
       * signing out of a session that is working perfectly in the next tab.
       */
      const latest = readStored();
      if (!latest || latest.refresh === presented) throw error;
      setTokens(latest.access, latest.refresh);
    }
  })().finally(() => {
    refreshing = null;
  });

  return refreshing;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await raw<T>(path, init);
  } catch (error) {
    const isAuthFailure = error instanceof ApiError && error.status === 401;
    if (!isAuthFailure || !refreshToken) throw error;

    try {
      await refreshSession();
      return await raw<T>(path, init);
    } catch {
      setTokens(null, null);
      onSessionLost?.();
      throw error;
    }
  }
}

/**
 * Turns a failed request into a sentence the player can act on.
 *
 * Screens used to write their own, and almost all of them wrote the same one:
 * some variation of "check your connection". That is a guess, and it was
 * usually wrong — a 429, a 500 and a failed DNS lookup all rendered as a
 * network problem, which sends someone to restart their router over a fault
 * that is entirely ours and clears itself in a minute. Worse, it hides the one
 * failure with a real instruction attached: being rate limited only needs you
 * to wait.
 *
 * Only status 0 is a connectivity claim, because only status 0 means no HTTP
 * response happened at all.
 */
export function describeError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;

  switch (true) {
    case error.status === 0:
      return 'Can’t reach the RepX server. Your connection is fine — it should come back on its own.';
    case error.status === 429:
      return 'Too many requests from here just now. Wait a minute and try again.';
    // 5xx messages describe the server's internals and mean nothing to a player.
    case error.status >= 500:
      return fallback;
    // 4xx are written for this audience — "That username is taken" beats anything
    // generic a screen could substitute for it.
    default:
      return error.message || fallback;
  }
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export const patch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });
