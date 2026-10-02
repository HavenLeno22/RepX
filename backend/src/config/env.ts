/**
 * Environment validation, run once at boot.
 *
 * The rule this file exists to enforce: **a misconfigured production server must
 * refuse to start rather than start insecurely.** The previous setup read
 * secrets with `process.env.X ?? 'dev-secret-change-me'`, which meant deploying
 * without setting them produced a server that worked perfectly and could have
 * every session forged by anyone who had read the repository. A crash on boot is
 * a five-minute outage; a silently weak signing key is a breach nobody notices.
 *
 * Development keeps its conveniences — defaults, a console mailer, no HTTPS
 * requirement — because the cost of friction there is real and the risk is not.
 * Every one of those conveniences is switched off by `NODE_ENV=production`.
 */

import { z } from 'zod';

/** Placeholders shipped in `.env.example`. Never valid outside development. */
const PLACEHOLDER_SECRETS = new Set([
  'dev-access-secret-change-me',
  'dev-refresh-secret-change-me',
  'change-me',
  'secret',
]);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().default('dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().default('dev-refresh-secret-change-me'),
  JWT_ACCESS_TTL: z.string().default('15m'),

  /**
   * How many reverse proxies sit in front of this server.
   *
   * Feeds Express's `trust proxy`, which decides whether `X-Forwarded-For` is
   * believed — and `req.ip` is what every rate-limit bucket is keyed on. Trust
   * it when nothing is actually in front and the limiter becomes decorative:
   * anyone can send a header nobody put there and get a fresh bucket on every
   * request, which is exactly the protection the login form depends on.
   *
   * So it defaults to 0 — trust nothing — and each deployment states its own
   * topology. One load balancer is 1. Cloudflare in front of a load balancer
   * is 2. Setting this higher than the real hop count is the same hole again,
   * because the extra hops are attacker-supplied.
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),

  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  /** Used in verification and reset links, so it must be the *public* origin. */
  PUBLIC_APP_URL: z.string().url().default('http://localhost:5173'),

  /* ------------------------------------------------------------- mail -- */
  /** Unset in development: mail is written to the log instead of sent. */
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('RepX <no-reply@repx.app>'),

  /* ------------------------------------------------------------ oauth -- */
  /**
   * Only *public* client identifiers live here. Both Google and Apple sign-in
   * are implemented as ID-token verification against the provider's published
   * JWKS, which needs the audience but never a client secret — so this server
   * holds no third-party secret at all, and there is none to leak.
   */
  GOOGLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${problems.join('\n')}`);
  }

  const env = parsed.data;

  if (env.NODE_ENV === 'production') {
    const fatal: string[] = [];

    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      const value = env[key];
      if (PLACEHOLDER_SECRETS.has(value)) {
        fatal.push(`${key} is still the development placeholder`);
      } else if (value.length < 32) {
        // 32 bytes of entropy is the floor for an HMAC signing key. Anything a
        // human typed by hand is below it.
        fatal.push(`${key} must be at least 32 characters (use: openssl rand -hex 32)`);
      }
    }

    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      fatal.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
    }

    // A password-reset link sent to an http:// origin is a token in cleartext.
    if (!env.PUBLIC_APP_URL.startsWith('https://')) {
      fatal.push('PUBLIC_APP_URL must be https in production');
    }
    if (env.CORS_ALLOWED_ORIGINS.split(',').some((o) => o.trim().startsWith('http://'))) {
      fatal.push('CORS_ALLOWED_ORIGINS must not contain http:// origins in production');
    }
    if (!env.SMTP_URL) {
      // Without this, verification and reset mail silently goes to the log —
      // which in production means users are locked out with no way to recover.
      fatal.push('SMTP_URL is required in production so account mail can be delivered');
    }

    if (fatal.length > 0) {
      throw new Error(
        `Refusing to start in production with an insecure configuration:\n${fatal
          .map((f) => `  - ${f}`)
          .join('\n')}`,
      );
    }
  }

  cached = env;
  return env;
}

export function isProduction(): boolean {
  return loadEnv().NODE_ENV === 'production';
}

/**
 * Whether the database behind us is PostgreSQL, inferred from the URL scheme.
 *
 * A handful of Prisma features are provider-specific, and the ones that matter
 * here fail in the worst possible way: `mode: 'insensitive'` throws on SQLite,
 * and omitting it makes `contains` case-*sensitive* on PostgreSQL only. Either
 * way the difference does not appear until the code runs on the other engine,
 * which by definition is production.
 *
 * Read from `DATABASE_URL` rather than `DATABASE_PROVIDER` because the URL is
 * the value the query actually runs against — the two can disagree, and when
 * they do it is the URL that is right.
 */
export function isPostgres(): boolean {
  const url = loadEnv().DATABASE_URL;
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}
