/**
 * Opt-in rate-limit buckets.
 *
 * `ThrottlerModule.forRoot([...])` registers throttlers; it does **not** scope
 * them. The global `ThrottlerGuard` evaluates *every* registered throttler on
 * *every* request, and a route is only exempt from one if it explicitly skips
 * it. `@Throttle({ auth: … })` does not select a bucket either — it overrides
 * that bucket's limit for one route and leaves the others applying as usual.
 *
 * That default is a trap when the buckets have different sizes. Registering a
 * `sensitive` bucket of five-per-hour to protect account deletion silently
 * capped the entire API at five requests per hour per IP: the sixth call to
 * anything — the exercise list, the leaderboard, a health-adjacent poll —
 * returned 429, and because `blockDuration` defaults to `ttl`, that IP stayed
 * blocked for a full hour. In development, where every browser tab, every HMR
 * reload and every device shares `::1`, the app stopped loading within seconds
 * of boot and did not recover.
 *
 * So the narrow buckets are made opt-in here: they skip themselves unless the
 * handler declared them with `@RateLimit(...)`. `default` stays global and
 * unconditional, because that is the one whose job is to cover routes nobody
 * thought about.
 */

import { SetMetadata, type ExecutionContext } from '@nestjs/common';

/** The buckets a route can opt into. `default` is global and not listed. */
export type RateLimitBucket = 'auth' | 'sensitive';

export const RATE_LIMIT_BUCKET = 'repx:rate-limit-bucket';

/**
 * Puts this route on a narrow bucket, *in addition to* the global `default`
 * one.
 *
 *   `auth`      anything that accepts a credential.
 *   `sensitive` anything that sends mail or mutates an account.
 */
export const RateLimit = (bucket: RateLimitBucket): MethodDecorator & ClassDecorator =>
  SetMetadata(RATE_LIMIT_BUCKET, bucket);

/**
 * `skipIf` for a named throttler: skip unless this route asked for this bucket.
 *
 * Non-HTTP contexts (the WebSocket gateway) skip unconditionally — these
 * buckets are about HTTP endpoints, and the guard's request/response accessors
 * do not describe a socket message.
 */
export function unlessDeclared(bucket: RateLimitBucket) {
  return (context: ExecutionContext): boolean => {
    if (context.getType() !== 'http') return true;

    const declared =
      (Reflect.getMetadata(RATE_LIMIT_BUCKET, context.getHandler()) as
        | RateLimitBucket
        | undefined) ??
      (Reflect.getMetadata(RATE_LIMIT_BUCKET, context.getClass()) as RateLimitBucket | undefined);

    return declared !== bucket;
  };
}
