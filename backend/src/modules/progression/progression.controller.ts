import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { currentSeason } from '@repx/shared';
import { JwtAuthGuard, type AuthedRequest } from '../auth/jwt-auth.guard';
import { ProgressionService } from './progression.service';

@Controller()
export class ProgressionController {
  constructor(private readonly progression: ProgressionService) {}

  /** Everything the home screen needs, in one request. */
  @Get('users/me/summary')
  @UseGuards(JwtAuthGuard)
  summary(@Req() req: AuthedRequest) {
    return this.progression.summaryFor(req.userId);
  }

  @Get('users/me/missions')
  @UseGuards(JwtAuthGuard)
  missions(@Req() req: AuthedRequest) {
    return this.progression.missionsFor(req.userId);
  }

  @Get('users/me/achievements')
  @UseGuards(JwtAuthGuard)
  achievements(@Req() req: AuthedRequest) {
    return this.progression.achievementsFor(req.userId);
  }

  @Get('users/me/battles')
  @UseGuards(JwtAuthGuard)
  battles(@Req() req: AuthedRequest, @Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.progression.battlesFor(
      req.userId,
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 50,
    );
  }

  @Get('users/me/notifications')
  @UseGuards(JwtAuthGuard)
  notifications(@Req() req: AuthedRequest) {
    return this.progression.notificationsFor(req.userId);
  }

  @Post('users/me/notifications/read')
  @UseGuards(JwtAuthGuard)
  markRead(@Req() req: AuthedRequest, @Body() body: { ids?: string[] }) {
    return this.progression.markNotificationsRead(req.userId, body?.ids);
  }

  /** Public — the season is the same for everyone, and the sign-in screen shows
   *  it before there is a user to scope it to. */
  @Get('season')
  season() {
    return currentSeason();
  }
}
