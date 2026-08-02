import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthResponse, LoginInput, RegisterInput } from '@repx/shared';
import { STARTING_RATING } from '@repx/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { toPublicUser } from '../users/user.mapper';
import { hashPassword, verifyPassword } from './password';

/**
 * Owns credentials, sessions, and token lifecycle.
 *
 * Passwords use Argon2id (OWASP's current recommendation). Refresh tokens are
 * stored hashed and rotated on every use, so a stolen token is single-use and a
 * database read cannot mint sessions. See docs/AUTHENTICATION.md.
 */
@Injectable()
export class AuthService {
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

    const user = await this.prisma.user.create({
      data: {
        email,
        username: input.username,
        passwordHash,
        rating: STARTING_RATING,
        peakRating: STARTING_RATING,
        identities: { create: { provider: 'email', providerUserId: email } },
      },
    });

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

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired — please sign in again');
    }

    // Rotation: the presented token is burned before a new one is issued.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

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
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
        expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
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
