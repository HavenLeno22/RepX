import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  // Before anything is constructed: a server that cannot be configured safely
  // must not start. See config/env.ts for what "safely" means.
  const env = loadEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });

  /**
   * Security headers.
   *
   * `contentSecurityPolicy` is off here deliberately, not by oversight: this
   * process serves JSON and a WebSocket and never returns HTML, so a CSP on
   * these responses protects nothing. The CSP that matters belongs on whatever
   * serves the frontend bundle — see docs/DEPLOYMENT.md.
   *
   * `crossOriginResourcePolicy` is same-site because the API and the app sit on
   * different subdomains in every deployed environment.
   */
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      // Browsers only honour HSTS over TLS, so this is inert in development.
      hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  /**
   * Whether to believe `X-Forwarded-For`, and for how many hops.
   *
   * Both directions of this are a real failure. Trust too little behind a load
   * balancer and every request appears to come from the balancer, bucketing the
   * entire internet into one per-IP rate limit. Trust too much — including the
   * old unconditional `1`, which applied when running with nothing in front —
   * and the header is attacker-supplied: a client sends its own XFF, gets a
   * fresh bucket per request, and the limit protecting the login form stops
   * existing.
   *
   * There is no default that is right for both, so the deployment declares it.
   */
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  const origins = env.CORS_ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({ origin: origins, credentials: true });
  // Request validation is zod-based per-route (see common/zod.pipe.ts) using the
  // exact schemas the client uses — no class-validator/DTO-decorator layer.
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api');

  await app.listen(env.PORT);

  const logger = new Logger('Bootstrap');
  logger.log(`RepX API listening on http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
  logger.log(`WebSocket gateway ready on ws://localhost:${env.PORT}`);
  if (!env.SMTP_URL) {
    logger.warn('SMTP_URL is unset — account mail is written to this log, not sent');
  }
}

void bootstrap();
