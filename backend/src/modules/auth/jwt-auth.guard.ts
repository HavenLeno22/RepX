import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { loadEnv } from '../../config/env';

export interface AuthedRequest extends Request {
  userId: string;
}

/** Same as `AuthedRequest` but for routes where signing in is optional. */
export interface MaybeAuthedRequest extends Request {
  userId?: string;
}

/** Verifies the Bearer access token and attaches `userId` to the request. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing access token');
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(header.slice(7), {
        secret: loadEnv().JWT_ACCESS_SECRET,
      });
      request.userId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired');
    }
  }
}

/**
 * Attaches `userId` when a valid token is present and lets the request through
 * either way.
 *
 * The leaderboard needs this: it is public, but a signed-in caller gets their
 * own row highlighted and can scope the board to friends. Without it the choice
 * would be between two near-identical endpoints or making a public page require
 * an account.
 */
@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MaybeAuthedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return true;

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(header.slice(7), {
        secret: loadEnv().JWT_ACCESS_SECRET,
      });
      request.userId = payload.sub;
    } catch {
      // An expired token on a public route is not an error — the caller simply
      // gets the anonymous view rather than a 401 they cannot act on.
    }
    return true;
  }
}
