import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../mail/mail.module';
import { AccountService } from './account.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard, OptionalJwtGuard } from './jwt-auth.guard';
import { OAuthService } from './oauth.service';

@Global()
@Module({
  imports: [JwtModule.register({}), MailModule],
  controllers: [AuthController],
  providers: [AuthService, AccountService, OAuthService, JwtAuthGuard, OptionalJwtGuard],
  exports: [AuthService, AccountService, OAuthService, JwtAuthGuard, OptionalJwtGuard, JwtModule],
})
export class AuthModule {}
