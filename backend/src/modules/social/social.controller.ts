import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  JwtAuthGuard,
  OptionalJwtGuard,
  type AuthedRequest,
  type MaybeAuthedRequest,
} from '../auth/jwt-auth.guard';
import { PresenceService } from './presence.service';
import { SocialService } from './social.service';

@Controller()
export class SocialController {
  constructor(
    private readonly social: SocialService,
    private readonly presence: PresenceService,
  ) {}

  @Get('friends')
  @UseGuards(JwtAuthGuard)
  friends(@Req() req: AuthedRequest) {
    return this.social.friends(req.userId);
  }

  @Get('friends/requests')
  @UseGuards(JwtAuthGuard)
  requests(@Req() req: AuthedRequest) {
    return this.social.incomingRequests(req.userId);
  }

  @Post('friends/:id')
  @UseGuards(JwtAuthGuard)
  add(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.social.request(req.userId, id);
  }

  @Post('friends/requests/:id/accept')
  @UseGuards(JwtAuthGuard)
  accept(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.social.accept(req.userId, id);
  }

  @Delete('friends/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.social.remove(req.userId, id);
  }

  /**
   * The ladder. Anonymous callers get the global board; a signed-in caller can
   * additionally scope it to friends or country.
   */
  @Get('leaderboard')
  @UseGuards(OptionalJwtGuard)
  leaderboard(
    @Req() req: MaybeAuthedRequest,
    @Query('scope') scope?: string,
    @Query('country') country?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = Number(limit);
    return this.social.leaderboard({
      viewerId: req.userId ?? null,
      scope: scope === 'friends' || scope === 'country' ? scope : 'global',
      country: country ?? null,
      search: search?.trim() || null,
      limit: Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 50,
    });
  }

  /** Live player counts. Powers the "N playing now" indicator, which has to be
   *  a real number for the social proof to be worth anything. */
  @Get('pulse')
  pulse() {
    return {
      online: this.presence.onlineCount(),
      inMatch: this.presence.inMatchCount(),
    };
  }
}
