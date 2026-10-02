import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Liveness and readiness probes.
 *
 * Every hosting platform worth deploying to — Fly, Railway, Render, Cloud Run,
 * any Kubernetes — wants a URL it can poll to decide whether a container is
 * ready for traffic and whether a deploy succeeded. Without one they fall back
 * to "did the process stay up", which is a much weaker claim: a Nest app whose
 * database credentials are wrong stays up perfectly and serves 500s to everyone.
 *
 * Two endpoints rather than one, because they answer different questions and
 * conflating them causes a specific outage:
 *
 *   /health   Am I alive? Touches nothing. If this fails the process is wedged
 *             and should be restarted.
 *   /ready    Can I serve? Round-trips the database. If this fails the process
 *             should be taken out of the load balancer but NOT restarted.
 *
 * Pointing a liveness probe at a database check is how a brief database blip
 * turns into a restart loop across every replica at once — each restart drops
 * live matches and the reconnect stampede keeps the database busy enough to keep
 * failing the check. Liveness stays dependency-free for that reason.
 */
@Controller()
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deliberately does no work. Throttling is skipped on both routes because a
   * platform polls these every few seconds from a small set of IPs and would
   * otherwise exhaust the default bucket and mark a healthy node as down.
   */
  @Get('health')
  live(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }

  @Get('ready')
  async ready(): Promise<{ status: 'ready'; database: 'up' }> {
    try {
      // The cheapest statement that proves the connection pool can actually
      // reach the server. `$connect()` alone can report success against a pool
      // that has not yet opened a socket.
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      // 503 rather than 500: this is "not ready yet", which is a state a load
      // balancer knows how to wait out. The error is not echoed back — a probe
      // response is public and a database error string names the host.
      throw new ServiceUnavailableException('Database is unreachable');
    }

    return { status: 'ready', database: 'up' };
  }
}
