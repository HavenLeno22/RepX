import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { OAuthProvider } from '@repx/shared';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { loadEnv } from '../../config/env';

interface ProviderConfig {
  issuers: string[];
  jwksUri: string;
  audience: () => string | undefined;
}

/**
 * Sign in with Google and Sign in with Apple.
 *
 * Implemented as **ID-token verification**, not as an authorization-code
 * exchange. The client completes the provider's own flow in the browser and
 * hands over the resulting ID token; this service checks the signature against
 * the provider's published JWKS and reads the identity out of the verified
 * claims.
 *
 * The reason to prefer this shape is that it needs no client secret. An
 * authorization-code exchange would require RepX to hold Google's client secret
 * and to mint Apple's — a signed JWT built from a downloaded .p8 private key
 * that has to be rotated every six months. Verification needs only the public
 * client id, so **this server holds no third-party secret at all, and there is
 * none to leak, rotate, or accidentally commit.**
 *
 * Nothing in the request body is trusted. The subject and the email both come
 * out of the verified token, because a caller who could supply their own email
 * could sign in as anybody.
 */
const PROVIDERS: Record<OAuthProvider, ProviderConfig> = {
  google: {
    // Google signs with either form of its issuer and both are valid.
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
    jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
    audience: () => loadEnv().GOOGLE_CLIENT_ID,
  },
  apple: {
    issuers: ['https://appleid.apple.com'],
    jwksUri: 'https://appleid.apple.com/auth/keys',
    // The Services ID for web sign-in, or the bundle id from a native client.
    audience: () => loadEnv().APPLE_CLIENT_ID,
  },
};

export interface VerifiedIdentity {
  provider: OAuthProvider;
  /** The provider's stable identifier. Never the email — addresses change. */
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger('OAuth');

  /**
   * One JWKS client per provider, created lazily and kept.
   *
   * `createRemoteJWKSet` caches the key set and refetches only when it sees an
   * unknown key id, which is what makes signing-key rotation a non-event. A new
   * client per request would fetch Google's certificates on every single
   * sign-in and would be rate limited under any real load.
   */
  private readonly jwks = new Map<OAuthProvider, ReturnType<typeof createRemoteJWKSet>>();

  isConfigured(provider: OAuthProvider): boolean {
    return Boolean(PROVIDERS[provider].audience());
  }

  async verify(provider: OAuthProvider, idToken: string): Promise<VerifiedIdentity> {
    const config = PROVIDERS[provider];
    const audience = config.audience();

    if (!audience) {
      // Configuration gap, not a bad request: refusing with 401 would tell the
      // user their account is wrong when the truth is the server was deployed
      // without a client id.
      throw new ServiceUnavailableException(
        `${provider === 'google' ? 'Google' : 'Apple'} sign-in is not configured on this server`,
      );
    }

    let keys = this.jwks.get(provider);
    if (!keys) {
      keys = createRemoteJWKSet(new URL(config.jwksUri));
      this.jwks.set(provider, keys);
    }

    let payload: JWTPayload;
    try {
      // `jwtVerify` enforces signature, issuer, audience and expiry together.
      // Checking any of them by hand afterwards is how tokens from the wrong
      // application get accepted.
      ({ payload } = await jwtVerify(idToken, keys, {
        issuer: config.issuers,
        audience,
        // Providers stamp iat; a little skew tolerance avoids rejecting a token
        // from a client whose clock is a few seconds fast.
        clockTolerance: 60,
      }));
    } catch (error) {
      this.logger.warn(`Rejected ${provider} token: ${String(error)}`);
      throw new UnauthorizedException('That sign-in could not be verified');
    }

    const subject = typeof payload.sub === 'string' ? payload.sub : null;
    if (!subject) {
      throw new UnauthorizedException('That sign-in could not be verified');
    }

    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;

    // Both providers send this as either a boolean or the string "true",
    // depending on provider and flow. Apple in particular sends the string.
    const rawVerified = (payload as { email_verified?: unknown }).email_verified;
    const emailVerified = rawVerified === true || rawVerified === 'true';

    const name =
      typeof (payload as { name?: unknown }).name === 'string'
        ? ((payload as { name: string }).name)
        : null;

    return { provider, subject, email, emailVerified, name };
  }
}
