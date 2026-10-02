import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import {
  CONSENT_VERSION,
  loginSchema,
  oauthSignInSchema,
  refreshSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@repx/shared';
import type {
  AuthResponse,
  LoginInput,
  OAuthSignInInput,
  RegisterInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '@repx/shared';
import { RateLimit } from '../../common/rate-limit';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { AccountService } from './account.service';
import { AuthService } from './auth.service';
import { JwtAuthGuard, type AuthedRequest } from './jwt-auth.guard';
import { OAuthService } from './oauth.service';

/**
 * Rate limits, per bucket (buckets and their sizes are defined in
 * app.module.ts).
 *
 * `auth` guards anything that takes a credential; `sensitive` guards anything
 * that sends mail, because abusing those costs money and gets a sending domain
 * suspended. Both are keyed on IP by the global guard, and both are *opt-in* —
 * a route without `@RateLimit` is covered by the `default` bucket only.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly account: AccountService,
    private readonly oauth: OAuthService,
  ) {}

  /* ------------------------------------------------------- credentials -- */

  @Post('register')
  @RateLimit('auth')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
  ): Promise<AuthResponse> {
    const session = await this.auth.register(body);
    // Fire-and-forget: a slow mail provider must not make signup slow, and a
    // send that fails is recoverable from inside the app with "resend".
    void this.account.sendVerification(session.user.id);
    return session;
  }

  @Post('login')
  @HttpCode(200)
  @RateLimit('auth')
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<AuthResponse> {
    return this.auth.login(body);
  }

  /**
   * Refresh is deliberately *not* on the `auth` bucket.
   *
   * It carries no guessable credential — the token is 48 random bytes — and it
   * is called automatically by every client whenever an access token ages out.
   * Five a minute would sign people out for using the app normally in two tabs.
   * The default bucket still covers it against a flood.
   */
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

  /* ------------------------------------------------------------- oauth -- */

  /** Which providers this deployment can actually offer, so the sign-in screen
   *  only shows buttons that will work. */
  @Get('providers')
  providers(): { google: boolean; apple: boolean } {
    return {
      google: this.oauth.isConfigured('google'),
      apple: this.oauth.isConfigured('apple'),
    };
  }

  @Post('oauth')
  @HttpCode(200)
  @RateLimit('auth')
  async oauthSignIn(
    @Body(new ZodValidationPipe(oauthSignInSchema)) body: OAuthSignInInput,
  ): Promise<AuthResponse> {
    // Verify first, then act. Everything the session is built from comes out of
    // the verified token, never out of the request body.
    const identity = await this.oauth.verify(body.provider, body.idToken);
    return this.auth.signInWithProvider(identity, body.username);
  }

  /* ------------------------------------------------------ verification -- */

  /**
   * Not on the `auth` bucket, for the same reason refresh is not.
   *
   * This takes a 32-byte random token, not a credential — there is nothing here
   * to brute force, and the token is single-use and expiring besides. Rate
   * limiting it like a login form only punishes the real user: click the link in
   * your mail, hit a hiccup, click it again a couple of times, and a 5/minute
   * limit locks you out of verifying your own account. The default bucket still
   * covers it against a flood.
   */
  @Post('verify')
  @HttpCode(204)
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput,
  ): Promise<void> {
    await this.account.verifyEmail(body.token);
  }

  @Post('verify/resend')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @RateLimit('sensitive')
  async resendVerification(@Req() req: AuthedRequest): Promise<void> {
    await this.account.sendVerification(req.userId);
  }

  /* ---------------------------------------------------- password reset -- */

  /**
   * Always 204, whatever happened.
   *
   * An unknown address, a social-only account and a successful send are
   * indistinguishable from out here — otherwise this endpoint is a free
   * membership oracle: submit a list of addresses and keep the ones that behave
   * differently.
   */
  @Post('password/forgot')
  @HttpCode(204)
  @RateLimit('sensitive')
  async forgotPassword(
    @Body(new ZodValidationPipe(requestPasswordResetSchema)) body: RequestPasswordResetInput,
  ): Promise<void> {
    await this.account.requestPasswordReset(body.email);
  }

  /**
   * Also not on the `auth` bucket: the credential-shaped thing here is the
   * emailed token, which is 32 random bytes and single-use. What *does* need
   * throttling is asking for the mail, and that is `password/forgot` above.
   */
  @Post('password/reset')
  @HttpCode(204)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
  ): Promise<void> {
    await this.account.resetPassword(body.token, body.password);
  }

  /* ----------------------------------------------------------- consent -- */

  /** The version currently in force, so a client can tell whether the signed-in
   *  user's recorded consent is still current. */
  @Get('consent')
  consentVersion(): { version: string } {
    return { version: CONSENT_VERSION };
  }
}
