// The leaderboard used to live here. It moved to SocialService, which owns the
// friends graph and presence, because a ladder you can scope to your friends is
// a social query that happens to be ordered by rating — not a user query.
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import {
  deleteAccountSchema,
  grantConsentSchema,
  updateProfileSchema,
  type DeleteAccountInput,
  type GrantConsentInput,
  type PublicUser,
  type UpdateProfileInput,
} from '@repx/shared';
import { RateLimit } from '../../common/rate-limit';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { AccountService } from '../auth/account.service';
import { JwtAuthGuard, type AuthedRequest } from '../auth/jwt-auth.guard';
import { UsersService, type UserStats } from './users.service';

@Controller()
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly account: AccountService,
  ) {}

  @Get('users/me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthedRequest): Promise<PublicUser> {
    return this.users.findPublic(req.userId);
  }

  @Patch('users/me')
  @UseGuards(JwtAuthGuard)
  updateMe(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ): Promise<PublicUser> {
    return this.users.updateProfile(req.userId, body);
  }

  @Get('users/me/stats')
  @UseGuards(JwtAuthGuard)
  myStats(@Req() req: AuthedRequest): Promise<UserStats> {
    return this.users.getStats(req.userId);
  }

  @Get('users/:id/stats')
  stats(@Param('id') id: string): Promise<UserStats> {
    return this.users.getStats(id);
  }

  /* ---------------------------------------------- consent and erasure -- */

  /**
   * Records agreement to the current privacy terms.
   *
   * RepX processes a live camera feed and body-pose landmarks, so this is the
   * gate in front of the first match rather than a checkbox buried in settings.
   * The version is stored with the timestamp, because consent to an earlier
   * policy is not consent to a later one.
   */
  @Post('users/me/consent')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async consent(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(grantConsentSchema)) body: GrantConsentInput,
  ): Promise<void> {
    await this.account.grantConsent(req.userId, body.version);
  }

  /**
   * Deletes the account and everything that identifies its owner.
   *
   * Irreversible, cascading, and gated on typing the username — see
   * AccountService.deleteAccount. Rate limited on the sensitive bucket because
   * it is the single most destructive call in the API.
   */
  @Post('users/me/delete')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @RateLimit('sensitive')
  async deleteMe(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(deleteAccountSchema)) body: DeleteAccountInput,
  ): Promise<void> {
    await this.account.deleteAccount(req.userId, body.confirmUsername);
  }
}
