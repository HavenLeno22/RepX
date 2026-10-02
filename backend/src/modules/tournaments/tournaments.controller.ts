import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { createTournamentSchema } from '@repx/shared';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { JwtAuthGuard, type AuthedRequest } from '../auth/jwt-auth.guard';
import { TournamentsService } from './tournaments.service';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list() {
    return this.tournaments.list();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  detail(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.tournaments.detail(id, req.userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body(new ZodValidationPipe(createTournamentSchema)) body: unknown) {
    return this.tournaments.create(body as never);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  async join(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.tournaments.join(id, req.userId);
    return this.tournaments.detail(id, req.userId);
  }

  @Delete(':id/join')
  @UseGuards(JwtAuthGuard)
  async leave(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.tournaments.leave(id, req.userId);
    return this.tournaments.detail(id, req.userId);
  }

  /**
   * Makes the draw.
   *
   * Open to any entrant rather than to an admin role, because RepX has no admin
   * role and a tournament nobody can start is a tournament that never happens.
   * The guards that matter are in the service: the caller must be entered, the
   * tournament must still be open, and it needs at least two entrants.
   */
  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  async start(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.tournaments.start(id, req.userId);
    return this.tournaments.detail(id, req.userId);
  }
}
