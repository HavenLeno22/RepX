/**
 * Sign in with Google and Sign in with Apple.
 *
 * Both providers are driven through their own browser SDK, which returns a
 * signed ID token; that token goes to `/auth/oauth`, where the server verifies
 * it against the provider's published keys. **No client secret is involved on
 * either side** — the page holds a public client id, the server holds the same
 * public client id, and the signature does the rest.
 *
 * The SDKs are loaded on demand rather than in `index.html`. Two third-party
 * scripts on every page load — including for the large majority of visits, which
 * are already signed in — is real bytes and a real third-party dependency in the
 * critical path of a product whose first screen is a live camera.
 *
 * Buttons render only for providers the server says it can actually handle
 * (`/auth/providers`), so a deployment without an Apple client id shows no Apple
 * button rather than one that fails when pressed.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OAuthProvider } from '@repx/shared';
import { Icon } from './Icon';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            ux_mode?: string;
          }) => void;
          prompt: () => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          usePopup: boolean;
        }) => void;
        signIn: () => Promise<{ authorization: { id_token: string } }>;
      };
    };
  }
}

const GOOGLE_SDK = 'https://accounts.google.com/gsi/client';
const APPLE_SDK =
  'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

/** Loads a script once and resolves when it is ready. */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') resolve();
      else existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`Could not load ${src}`)));
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => {
      script.dataset.loaded = '1';
      resolve();
    });
    script.addEventListener('error', () => reject(new Error(`Could not load ${src}`)));
    document.head.appendChild(script);
  });
}

export function SocialSignIn({
  onToken,
  disabled,
}: {
  onToken: (provider: OAuthProvider, idToken: string) => void;
  disabled?: boolean;
}) {
  const [available, setAvailable] = useState<{ google: boolean; apple: boolean } | null>(null);
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const googleButton = useRef<HTMLDivElement>(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const appleClientId = import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined;

  // Ask the server which providers it can verify. Showing a button the backend
  // cannot honour is worse than showing none.
  useEffect(() => {
    // Same base as lib/api.ts. Plain fetch rather than the api helper because
    // this runs on the sign-in screen, where there is no session to attach and
    // no token to refresh.
    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
    void fetch(`${base}/api/auth/providers`)
      .then((r) => r.json())
      .then(setAvailable)
      .catch(() => setAvailable({ google: false, apple: false }));
  }, []);

  const showGoogle = Boolean(available?.google && googleClientId);
  const showApple = Boolean(available?.apple && appleClientId);

  /**
   * A stable handle on the caller's callback.
   *
   * `onToken` is an inline arrow in the sign-in form, so it is a new function on
   * every render — and the effect below lists it as a dependency. That meant
   * every keystroke in the email field tore down and re-ran Google's
   * `initialize` + `renderButton`, re-entering the Identity Services SDK dozens
   * of times while somebody typed their address. Held in a ref, the effect
   * depends only on things that actually change.
   */
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  const emitToken = useCallback((provider: OAuthProvider, idToken: string) => {
    onTokenRef.current(provider, idToken);
  }, []);

  /**
   * Google renders its own button.
   *
   * Not a stylistic preference — Google's terms require their rendered button
   * for the credential flow, and it is the element their SDK attaches the
   * one-tap handler to.
   */
  useEffect(() => {
    if (!showGoogle || !googleClientId || !googleButton.current) return;

    let cancelled = false;
    void loadScript(GOOGLE_SDK)
      .then(() => {
        if (cancelled || !window.google || !googleButton.current) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => emitToken('google', response.credential),
        });
        window.google.accounts.id.renderButton(googleButton.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 320,
        });
      })
      .catch(() => {
        if (!cancelled) setError('Google sign-in could not load. Check your connection.');
      });

    return () => {
      cancelled = true;
    };
  }, [showGoogle, googleClientId, emitToken]);

  async function signInWithApple() {
    if (!appleClientId) return;
    setBusy('apple');
    setError(null);
    try {
      await loadScript(APPLE_SDK);
      if (!window.AppleID) throw new Error('Apple sign-in unavailable');

      window.AppleID.auth.init({
        clientId: appleClientId,
        scope: 'name email',
        redirectURI: window.location.origin,
        usePopup: true,
      });

      const result = await window.AppleID.auth.signIn();
      emitToken('apple', result.authorization.id_token);
    } catch {
      // Closing the popup lands here too, which is not an error worth shouting
      // about — so this stays quiet unless the SDK genuinely failed.
      setError(null);
    } finally {
      setBusy(null);
    }
  }

  /**
   * Nothing to show.
   *
   * In production this is correct and silent: a deployment without an Apple
   * client id should show no Apple button, not a broken one.
   *
   * In development the same silence is actively misleading — the sign-in code is
   * fully implemented, so an empty space below the form reads as "Google sign-in
   * was never built" when the truth is "no client id is configured yet". This
   * block says which of the two halves is missing, because they are set in
   * different files and getting only one of them is the usual mistake. The whole
   * branch is compiled out of the production bundle by `import.meta.env.DEV`.
   */
  if (!showGoogle && !showApple) {
    if (!import.meta.env.DEV) return null;

    const serverHasGoogle = available?.google === true;
    const clientHasGoogle = Boolean(googleClientId);

    return (
      <div className="col gap-sm" style={{ marginBottom: 'var(--s5)' }}>
        <div className="row" style={{ gap: 'var(--s3)' }}>
          <span className="divider" style={{ flex: 1, margin: 0 }} />
          <span className="t-caption mute">social sign-in</span>
          <span className="divider" style={{ flex: 1, margin: 0 }} />
        </div>
        <div className="alert" style={{ marginBottom: 0, alignItems: 'flex-start' }}>
          <Icon name="info" size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span className="t-sm dim" style={{ lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text)' }}>
              Google sign-in is built, but not configured.
            </strong>
            <br />
            {!clientHasGoogle && (
              <>
                Set <code>VITE_GOOGLE_CLIENT_ID</code> in <code>frontend/.env.local</code>
                {!serverHasGoogle && (
                  <>
                    {' '}
                    and <code>GOOGLE_CLIENT_ID</code> in <code>backend/.env</code>
                  </>
                )}
                , then restart both.
                <br />
              </>
            )}
            {clientHasGoogle && !serverHasGoogle && (
              <>
                The browser has a client id but the server does not — set{' '}
                <code>GOOGLE_CLIENT_ID</code> in <code>backend/.env</code> to the same value and
                restart it.
                <br />
              </>
            )}
            Both values are the <em>same</em> public client id. See docs/DEPLOYMENT.md for where to get
            one. This notice is development-only.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="col gap-sm" style={{ marginBottom: 'var(--s5)' }}>
      <div className="row" style={{ gap: 'var(--s3)' }}>
        <span className="divider" style={{ flex: 1, margin: 0 }} />
        <span className="t-caption mute">or continue with</span>
        <span className="divider" style={{ flex: 1, margin: 0 }} />
      </div>

      {error && (
        <div className="alert alert--error" style={{ marginBottom: 0 }}>
          <Icon name="info" size={16} />
          {error}
        </div>
      )}

      {showGoogle && (
        <div
          ref={googleButton}
          style={{ display: 'grid', placeItems: 'center', minHeight: 44 }}
          aria-busy={busy === 'google'}
        />
      )}

      {showApple && (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          disabled={disabled || busy !== null}
          onClick={() => void signInWithApple()}
        >
          {busy === 'apple' ? (
            <span className="spinner" />
          ) : (
            <>
              {/* Apple's mark, drawn rather than loaded, so it inherits colour
                  and needs no remote asset. */}
              <svg width="16" height="19" viewBox="0 0 16 19" fill="currentColor" aria-hidden>
                <path d="M13.29 10.06c-.02-2.13 1.74-3.15 1.82-3.2-0.99-1.45-2.53-1.65-3.08-1.67-1.31-.13-2.56.77-3.22.77-.67 0-1.69-.75-2.78-.73-1.43.02-2.75.83-3.48 2.1-1.49 2.58-.38 6.4 1.07 8.49.71 1.03 1.55 2.18 2.66 2.14 1.07-.04 1.47-.69 2.76-.69 1.29 0 1.65.69 2.78.67 1.15-.02 1.87-1.04 2.57-2.07.81-1.19 1.15-2.34 1.17-2.4-.03-.01-2.24-.86-2.27-3.41zM11.17 3.62c.59-.72.99-1.71.88-2.7-.85.03-1.88.57-2.49 1.28-.55.63-1.03 1.64-.9 2.61.95.07 1.92-.48 2.51-1.19z" />
              </svg>
              Continue with Apple
            </>
          )}
        </button>
      )}
    </div>
  );
}
