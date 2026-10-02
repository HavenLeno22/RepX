import { Module } from '@nestjs/common';
import { AntiCheatModule } from '../anti-cheat/anti-cheat.module';
import { ChallengeModule } from '../challenge/challenge.module';
import { EloModule } from '../elo/elo.module';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';
import { ProgressionModule } from '../progression/progression.module';
import { RoomsModule } from '../rooms/rooms.module';
import { SocialModule } from '../social/social.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { MatchEngineService } from './match-engine.service';
import { MatchGateway } from './match.gateway';

@Module({
  imports: [
    MatchmakingModule,
    EloModule,
    AntiCheatModule,
    ProgressionModule,
    SocialModule,
    ChallengeModule,
    RoomsModule,
    TournamentsModule,
  ],
  providers: [MatchEngineService, MatchGateway],
  exports: [MatchEngineService],
})
export class MatchModule {}
