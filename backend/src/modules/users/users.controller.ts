// The leaderboard used to live here. It moved to SocialService, which owns the
// friends graph and presence, because a ladder you can scope to your friends is
// a social query that happens to be ordered by rating — not a user query.
import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { updateProfileSchema, type PublicUser, type UpdateProfileInput } from '@repx/shared';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { JwtAuthGuard, type AuthedRequest } from '../auth/jwt-auth.guard';
import { UsersService, type UserStats } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

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
}
