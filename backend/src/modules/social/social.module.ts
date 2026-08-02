import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PresenceService } from './presence.service';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  imports: [PrismaModule],
  controllers: [SocialController],
  providers: [PresenceService, SocialService],
  exports: [PresenceService, SocialService],
})
export class SocialModule {}
