import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { loginSchema, refreshSchema, registerSchema } from '@repx/shared';
import type { AuthResponse, LoginInput, RegisterInput } from '@repx/shared';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput): Promise<AuthResponse> {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<AuthResponse> {
    return this.auth.login(body);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: { refreshToken: string },
  ): Promise<AuthResponse> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body(new ZodValidationPipe(refreshSchema)) body: { refreshToken: string },
  ): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }
}
