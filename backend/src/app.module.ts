import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AntiCheatModule } from './modules/anti-cheat/anti-cheat.module';
import { AuthModule } from './modules/auth/auth.module';
import { EloModule } from './modules/elo/elo.module';
import { ExercisesModule } from './modules/exercises/exercises.module';
import { MatchModule } from './modules/match/match.module';
import { MatchmakingModule } from './modules/matchmaking/matchmaking.module';
import { ProgressionModule } from './modules/progression/progression.module';
import { SocialModule } from './modules/social/social.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ExercisesModule,
    EloModule,
    AntiCheatModule,
    MatchmakingModule,
    MatchModule,
    ProgressionModule,
    SocialModule,
  ],
})
export class AppModule {}
