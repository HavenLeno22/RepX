import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { unlessDeclared } from './common/rate-limit';
import { PrismaModule } from './prisma/prisma.module';
import { AntiCheatModule } from './modules/anti-cheat/anti-cheat.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChallengeModule } from './modules/challenge/challenge.module';
import { EloModule } from './modules/elo/elo.module';
import { ExercisesModule } from './modules/exercises/exercises.module';
import { HealthModule } from './modules/health/health.module';
import { MatchModule } from './modules/match/match.module';
import { MatchmakingModule } from './modules/matchmaking/matchmaking.module';
import { ProgressionModule } from './modules/progression/progression.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { SocialModule } from './modules/social/social.module';
import { TournamentsModule } from './modules/tournaments/tournaments.module';
import { UsersModule } from './modules/users/users.module';

/** Rounds the remaining block into something worth reading on a screen. */
function waitPhrase({ timeToBlockExpire }: { timeToBlockExpire: number }): string {
  if (!Number.isFinite(timeToBlockExpire) || timeToBlockExpire <= 60) {
    return 'Try again in a minute.';
  }
  if (timeToBlockExpire < 3600) {
    return `Try again in about ${Math.ceil(timeToBlockExpire / 60)} minutes.`;
  }
  const hours = Math.ceil(timeToBlockExpire / 3600);
  return `Try again in about ${hours} hour${hours === 1 ? '' : 's'}.`;
}

/**
 * Rate limiting.
 *
 * Three named buckets rather than one, because the routes have genuinely
 * different risk profiles and a single limit would have to be set for the worst
 * of them — throttling ordinary play to protect the login form.
 *
 *   default   generous, and applies to everything. The app polls the
 *             leaderboard and progression on most screens, so this is sized to
 *             be invisible to a real player and closed to a scraper.
 *   auth      credential endpoints. Deliberately harsh: five attempts a minute
 *             is far more than a human needs and far less than a credential
 *             stuffer does.
 *   sensitive things that send mail or mutate an account. Abuse here costs
 *             money and reputation (a mail provider will suspend a sender that
 *             is used to spam strangers), so it is the tightest bucket.
 *
 * `auth` and `sensitive` carry a `skipIf` because registering a throttler is not
 * the same as scoping it: the guard applies every registered bucket to every
 * route unless the route skips it. Without these, `sensitive` capped the whole
 * API at five requests per hour per IP. See common/rate-limit.ts — routes opt in
 * with `@RateLimit('auth' | 'sensitive')`.
 *
 * `default` deliberately has no `skipIf`: it is the bucket that covers routes
 * nobody thought about, so it stays on unless a route opts *out*.
 *
 * Storage is in-process, which throttles per node. Behind more than one replica
 * the effective limit multiplies by the replica count — swap in the Redis
 * storage adapter at that point. See docs/DEPLOYMENT.md.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      /**
       * The default here is `ThrottlerException: Too Many Requests`, which is a
       * class name, and clients render `error.message` straight to the person
       * looking at the screen — so mistyping a password five times answered
       * with a Java-looking string and no indication that waiting fixes it.
       *
       * The wait is quoted from the record rather than fixed, because the
       * buckets differ by two orders of magnitude: telling someone held off a
       * one-hour bucket to "try again in a minute" earns four wrong answers and
       * no explanation.
       */
      errorMessage: (_context, detail) => `Too many requests from here. ${waitPhrase(detail)}`,
      throttlers: [
        { name: 'default', ttl: seconds(60), limit: 300 },
        { name: 'auth', ttl: seconds(60), limit: 5, skipIf: unlessDeclared('auth') },
        { name: 'sensitive', ttl: seconds(3600), limit: 5, skipIf: unlessDeclared('sensitive') },
      ],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ExercisesModule,
    EloModule,
    AntiCheatModule,
    MatchmakingModule,
    ChallengeModule,
    RoomsModule,
    MatchModule,
    ProgressionModule,
    SocialModule,
    TournamentsModule,
  ],
  providers: [
    // Applied globally so a new controller is rate limited by default and has to
    // opt *out*, rather than being unprotected until somebody remembers.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
