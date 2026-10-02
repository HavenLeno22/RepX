import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthResponse, LoginInput, RegisterInput } from '@repx/shared';
import { STARTING_RATING } from '@repx/shared';
import { loadEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { toPublicUser } from '../users/user.mapper';
import type { VerifiedIdentity } from './oauth.service';
import { hashPassword, verifyPassword } from './password';

/**
 * Owns credentials, sessions, and token lifecycle.
 *
 * Passwords use Argon2id (OWASP's current recommendation). Refresh tokens are
 * stored hashed and rotated on every use, so a stolen token is single-use and a
 * database read cannot mint sessions. See docs/AUTHENTICATION.md.
 */
/**
 * How long after a refresh token is burned a second presentation is still
 * treated as one client racing itself rather than as a leak.
 *
 * Two tabs, or two requests that expired their access token at the same moment,
 * resolve within milliseconds of each other. A token surfacing minutes later
 * has been *kept*, which is what a stolen one looks like.
 */
const REPLAY_GRACE_MS = 30_000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username: input.username }] },
    });
    if (existing) {
      throw new ConflictException(
        existing.email === email ? 'That email is already registered' : 'That username is taken',
      );
    }

    const passwordHash = await hashPassword(input.password);

    // The check above is a courtesy that produces a good message; the unique
    // constraints are the actual guard. Two people submitting the same username
    // at once both pass the read and one loses the write, which surfaced as a
    // 500 and a "something went wrong on our end" on a form the user could have
    // fixed themselves.
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email,
          username: input.username,
          passwordHash,
          rating: STARTING_RATING,
          peakRating: STARTING_RATING,
          identities: { create: { provider: 'email', providerUserId: email } },
        },
      });
    } catch {
      throw new ConflictException('That email or username was just taken — try another');
    }

    return this.issueSession(user.id, user);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Same error either way — never reveal whether an email exists.
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Incorrect email or password');
    }

    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      throw new UnauthorizedException('Incorrect email or password');
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('This account is not active');
    }

    return this.issueSession(user.id, user);
  }

  /**
   * Signs in — or signs up — with a verified provider identity.
   *
   * Three cases, and the order matters:
   *
   * 1. **The identity is already linked.** Sign that user in. This is the common
   *    path and it never touches the email, because addresses change and the
   *    provider's subject id does not.
   *
   * 2. **No link, but the address matches an existing account.** Link them —
   *    *only if the provider vouched for the address*. This is the account
   *    takeover hole in most social-login implementations: without the
   *    `emailVerified` check, anyone can register an unverified provider account
   *    bearing a victim's address and walk straight into it. When the provider
   *    has not verified, we refuse and tell them to sign in with their password,
   *    which proves ownership the other way.
   *
   * 3. **Neither.** Create the account, already verified — the provider has just
   *    proven the address, so asking the user to confirm it again is friction
   *    that buys nothing.
   */
  async signInWithProvider(
    identity: VerifiedIdentity,
    suggestedUsername?: string,
  ): Promise<AuthResponse> {
    const existingLink = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: identity.provider,
          providerUserId: identity.subject,
        },
      },
      include: { user: true },
    });

    if (existingLink) {
      if (existingLink.user.status !== 'active') {
        throw new UnauthorizedException('This account is not active');
      }
      return this.issueSession(existingLink.userId, existingLink.user);
    }

    if (!identity.email) {
      // Apple lets a user hide their address, and only sends it on the very
      // first authorization. Without an address and without an existing link
      // there is nothing to attach the account to.
      throw new UnauthorizedException(
        'That sign-in did not share an email address, so we cannot match it to an account',
      );
    }

    const byEmail = await this.prisma.user.findUnique({ where: { email: identity.email } });

    if (byEmail) {
      if (!identity.emailVerified) {
        throw new UnauthorizedException(
          'That address already has a RepX account. Sign in with your password to link it.',
        );
      }
      if (byEmail.status !== 'active') {
        throw new UnauthorizedException('This account is not active');
      }

      await this.prisma.authIdentity.create({
        data: {
          userId: byEmail.id,
          provider: identity.provider,
          providerUserId: identity.subject,
        },
      });
      // Linking a provider-verified address verifies the account, if it was not.
      const user = byEmail.emailVerifiedAt
        ? byEmail
        : await this.prisma.user.update({
            where: { id: byEmail.id },
            data: { emailVerifiedAt: new Date() },
          });

      return this.issueSession(user.id, user);
    }

    const username = await this.allocateUsername(
      suggestedUsername ?? identity.name ?? identity.email.split('@')[0],
    );

    const created = await this.prisma.user.create({
      data: {
        email: identity.email,
        username,
        // No passwordHash: this account signs in through the provider. It can
        // gain a password later via the reset flow, which proves the address.
        rating: STARTING_RATING,
        peakRating: STARTING_RATING,
        emailVerifiedAt: identity.emailVerified ? new Date() : null,
        identities: {
          create: { provider: identity.provider, providerUserId: identity.subject },
        },
      },
    });

    return this.issueSession(created.id, created);
  }

  /**
   * Finds a free ladder name close to what the provider suggested.
   *
   * Providers hand over display names ("Jane Doe") and email locals
   * ("jane.doe"), neither of which satisfies the username rules, and both of
   * which collide constantly. Sanitise, then add a numeric suffix until it
   * sticks — a signup that fails because someone else is called jane is a
   * signup that does not happen.
   */
  private async allocateUsername(seed: string): Promise<string> {
    const base =
      seed
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 16) || 'athlete';

    // Usernames must be at least 3 characters, so a one-letter seed gets padded
    // rather than rejected.
    const stem = base.length >= 3 ? base : `${base}rep`;

    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = attempt === 0 ? stem : `${stem}${attempt + 1}`.slice(0, 20);
      const taken = await this.prisma.user.findUnique({ where: { username: candidate } });
      if (!taken) return candidate;
    }

    // Fall back to something that cannot realistically collide.
    return `athlete${randomBytes(4).toString('hex')}`;
  }

  /**
   * Exchanges a refresh token for a new session, rotating the token.
   *
   * Three things have to hold here, and each was a real hole.
   *
   * **Rotation must be atomic.** It used to read the row, check `revokedAt`, and
   * then write it — so two requests arriving together both passed the check and
   * both minted a session from one token. The burn is now a conditional update,
   * and losing that race is indistinguishable from presenting a dead token.
   *
   * **A token presented after it was burned is evidence.** Either it leaked, or
   * a client of ours raced itself. Those are told apart by *when*: a race
   * resolves in milliseconds, so a replay inside `REPLAY_GRACE_MS` is refused on
   * its own and nothing else happens. Later than that, the only explanation is
   * that a burned token was kept — so every live session for that user is
   * revoked, which is what turns a stolen token into a single stolen request
   * instead of indefinite access.
   *
   * **The account still has to be active.** Login and social sign-in both check
   * this; refresh did not, so suspending an account left its holder able to renew
   * their session forever and the suspension only took effect when they signed
   * out voluntarily.
   */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired — please sign in again');
    }

    if (stored.revokedAt) {
      const replayedAfter = Date.now() - stored.revokedAt.getTime();
      if (replayedAfter > REPLAY_GRACE_MS) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        this.logger.warn(
          `Refresh token replayed ${Math.round(replayedAfter / 1000)}s after use for ${stored.userId} — every session revoked`,
        );
      }
      throw new UnauthorizedException('Session expired — please sign in again');
    }

    // Rotation: the presented token is burned before a new one is issued, and
    // only the request that actually burns it may continue.
    const burned = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (burned.count === 0) {
      throw new UnauthorizedException('Session expired — please sign in again');
    }

    if (stored.user.status !== 'active') {
      throw new UnauthorizedException('This account is not active');
    }

    return this.issueSession(stored.userId, stored.user);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueSession(
    userId: string,
    user: Parameters<typeof toPublicUser>[0],
  ): Promise<AuthResponse> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, username: user.username },
      {
        secret: loadEnv().JWT_ACCESS_SECRET,
        expiresIn: loadEnv().JWT_ACCESS_TTL,
      },
    );

    const refreshToken = randomBytes(48).toString('hex');
    const ttlDays = 30;
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken, user: toPublicUser(user) };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
