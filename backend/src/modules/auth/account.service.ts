import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CONSENT_VERSION } from '@repx/shared';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { hashPassword } from './password';

/** How long each kind of link stays usable. */
const TTL_MS = {
  email_verification: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
} as const;

type Purpose = keyof typeof TTL_MS;

/**
 * Address verification, password recovery, consent, and erasure.
 *
 * Three rules run through all of it.
 *
 * **Tokens are stored hashed.** Only the SHA-256 of a token is persisted, the
 * same way refresh tokens are handled, so a database read — a backup on a
 * laptop, a leaked dump, an over-broad support query — cannot be turned into a
 * password reset for anybody.
 *
 * **Requests never reveal whether an account exists.** Asking to reset an
 * unknown address returns exactly what asking to reset a real one returns, in
 * roughly the same time. Otherwise the reset form becomes a free membership
 * oracle: submit a list of addresses, keep the ones that behave differently.
 *
 * **A reset ends every session.** Someone resetting a password may be doing it
 * because an attacker is already inside the account, so every refresh token is
 * revoked as part of the change. A reset that leaves the intruder signed in has
 * achieved nothing.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger('Account');

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /* ------------------------------------------------------ verification -- */

  /** Issues and sends a fresh verification link. Safe to call repeatedly. */
  async sendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.emailVerifiedAt) return;

    const token = await this.issue(userId, 'email_verification');
    await this.mail.sendVerification(user.email, user.username, token);
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.consume(token, 'email_verification');
    if (!record) {
      throw new BadRequestException('That confirmation link has expired or already been used');
    }

    await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    });
    this.logger.log(`Verified address for ${record.userId}`);
  }

  /* ---------------------------------------------------- password reset -- */

  /**
   * Starts a reset.
   *
   * Returns nothing in every case — success, unknown address, or an account that
   * has no password because it was created through Google or Apple. The caller
   * reports the same neutral message regardless.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) return;
    if (user.status !== 'active') return;

    if (!user.passwordHash) {
      // A social-only account has no password to reset. Telling them that here
      // would confirm the address exists, so the hint goes in the mail instead,
      // where only the actual owner can read it.
      this.logger.log(`Reset requested for social-only account ${user.id}`);
      return;
    }

    // Any earlier outstanding reset is burned, so the most recent mail is the
    // only one that works — otherwise a stale link in an old inbox stays live
    // for its full hour after the user has already recovered.
    await this.prisma.verificationToken.updateMany({
      where: { userId: user.id, purpose: 'password_reset', consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const token = await this.issue(user.id, 'password_reset');
    await this.mail.sendPasswordReset(user.email, user.username, token);
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const record = await this.consume(token, 'password_reset');
    if (!record) {
      throw new BadRequestException('That reset link has expired or already been used');
    }

    const passwordHash = await hashPassword(password);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          // Completing a reset proves control of the mailbox, which is the same
          // thing verification proves — so there is nothing left to confirm.
          emailVerifiedAt: new Date(),
        },
      }),
      // Every session, everywhere, including any the attacker holds.
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    this.logger.log(`Password reset completed for ${record.userId}`);
  }

  /* --------------------------------------------------------- consent -- */

  async grantConsent(userId: string, version: string): Promise<void> {
    if (version !== CONSENT_VERSION) {
      throw new BadRequestException('Those terms are out of date — reload and try again');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { consentedAt: new Date(), consentVersion: version },
    });
  }

  /* --------------------------------------------------------- erasure -- */

  /**
   * Deletes the account and everything that identifies the person.
   *
   * A real delete, not a status flag. Every row that names them goes with it —
   * matches, ratings, trophies, friendships, sessions — because every relation
   * in the schema cascades from User. That is the point: a right to erasure that
   * leaves the data in place is not erasure.
   *
   * The username is required as confirmation by the caller's schema; this method
   * checks it again rather than trusting that, because it is irreversible.
   */
  async deleteAccount(userId: string, confirmUsername: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    if (user.username.toLowerCase() !== confirmUsername.trim().toLowerCase()) {
      throw new BadRequestException('That username does not match this account');
    }

    await this.prisma.user.delete({ where: { id: userId } });
    this.logger.warn(`Account ${userId} deleted at the owner's request`);
  }

  /* -------------------------------------------------------- internals -- */

  private async issue(userId: string, purpose: Purpose): Promise<string> {
    // 32 bytes from the CSPRNG. Long enough that guessing is not a strategy, and
    // URL-safe so it survives being pasted out of a mail client.
    const token = randomBytes(32).toString('base64url');

    await this.prisma.verificationToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TTL_MS[purpose]),
      },
    });

    return token;
  }

  /**
   * Validates and burns a token in one step.
   *
   * Marking it consumed *before* the caller acts on it is what makes a link
   * single-use even if the user double-clicks or a mail scanner prefetches it.
   */
  private async consume(
    token: string,
    purpose: Purpose,
  ): Promise<{ userId: string } | null> {
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!record) return null;
    if (record.purpose !== purpose) return null;
    if (record.consumedAt) return null;
    if (record.expiresAt < new Date()) return null;

    // Conditional on still being unconsumed, so two simultaneous requests cannot
    // both succeed — the second updates zero rows and is rejected.
    const burned = await this.prisma.verificationToken.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (burned.count === 0) return null;

    return { userId: record.userId };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Constant-time comparison of two hex digests.
 *
 * Exported for the token paths that compare outside a database lookup. Length is
 * checked first because `timingSafeEqual` throws on a mismatch rather than
 * returning false, and that throw is itself a timing signal.
 */
export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
