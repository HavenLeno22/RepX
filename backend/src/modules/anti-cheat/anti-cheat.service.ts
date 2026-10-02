import { Injectable, Logger } from '@nestjs/common';
import type { PoseFrame } from '@repx/shared';
import { distance, LM } from '@repx/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface FrameVerdict {
  accept: boolean;
  reason?: string;
  severity?: 'low' | 'medium' | 'high';
}

/** Per-participant rolling state used to spot implausible input. */
export class AntiCheatSession {
  private lastSeq = -1;
  private lastClientTs = 0;
  private lastServerTs = 0;
  private lastFrameHash = '';
  private identicalFrames = 0;
  private lastTorsoSize = 0;
  readonly flags = new Set<string>();

  /**
   * Screens one incoming frame. This runs before the exercise plugin, so a
   * rejected frame never reaches rep counting at all.
   */
  inspect(frame: PoseFrame, frameSeq: number, clientTimestamp: number): FrameVerdict {
    const now = Date.now();

    // --- Replay / reorder: sequence numbers must strictly increase. ----------
    if (frameSeq <= this.lastSeq) {
      this.flags.add('out_of_order_frames');
      return { accept: false, reason: 'Out-of-order frame', severity: 'high' };
    }
    this.lastSeq = frameSeq;

    // --- Time travel: client clock must move forward, and no faster than the
    //     server's own wall clock allows (a client cannot fast-forward time).
    if (this.lastClientTs > 0) {
      const clientDelta = clientTimestamp - this.lastClientTs;
      const serverDelta = now - this.lastServerTs;
      if (clientDelta <= 0) {
        this.flags.add('non_monotonic_clock');
        return { accept: false, reason: 'Invalid frame timing', severity: 'high' };
      }
      if (clientDelta > serverDelta + 750) {
        this.flags.add('accelerated_clock');
        return { accept: false, reason: 'Frame timing does not match real time', severity: 'high' };
      }
    }
    this.lastClientTs = clientTimestamp;
    this.lastServerTs = now;

    // --- Static/looped input: a real camera never produces byte-identical
    //     landmark frames back to back.
    const hash = hashFrame(frame);
    if (hash === this.lastFrameHash) {
      this.identicalFrames += 1;
      if (this.identicalFrames > 15) {
        this.flags.add('static_input');
        return { accept: false, reason: 'No movement detected', severity: 'medium' };
      }
    } else {
      this.identicalFrames = 0;
    }
    this.lastFrameHash = hash;

    // --- Teleporting body: torso size cannot change drastically frame to
    //     frame. A sudden jump means a different person or a spliced feed.
    const torso = torsoSize(frame);
    if (this.lastTorsoSize > 0 && torso > 0) {
      const ratio = torso / this.lastTorsoSize;
      if (ratio > 1.8 || ratio < 0.55) {
        this.flags.add('subject_discontinuity');
        return { accept: false, reason: 'Camera subject changed', severity: 'high' };
      }
    }
    if (torso > 0) this.lastTorsoSize = torso;

    return { accept: true };
  }
}

/**
 * Server-side integrity checks over the landmark stream.
 *
 * This module never trusts the client's own rep count — it only inspects the
 * raw landmark stream the client sends, and the exercise plugin re-derives reps
 * from that same stream. See docs/ANTI_CHEAT.md.
 */
@Injectable()
export class AntiCheatService {
  private readonly logger = new Logger('AntiCheat');

  constructor(private readonly prisma: PrismaService) {}

  createSession(): AntiCheatSession {
    return new AntiCheatSession();
  }

  async recordFlags(userId: string, matchId: string, flags: Set<string>): Promise<void> {
    if (flags.size === 0) return;
    this.logger.warn(`Flags for user ${userId} in match ${matchId}: ${[...flags].join(', ')}`);

    await this.prisma.cheatFlag.createMany({
      data: [...flags].map((reason) => ({
        userId,
        matchId,
        reason,
        severity: SEVERITY[reason] ?? 'low',
      })),
    });
  }
}

const SEVERITY: Record<string, string> = {
  out_of_order_frames: 'high',
  non_monotonic_clock: 'high',
  accelerated_clock: 'high',
  subject_discontinuity: 'high',
  static_input: 'medium',
};

/**
 * Whether a set of flags is serious enough to void the match.
 *
 * Only `high` counts. The high-severity signals all mean the *frame stream
 * itself* was manipulated — replayed, reordered, or run against a clock that
 * does not move like a clock — which no amount of bad network explains.
 * `static_input` is medium because a genuinely still player at the start of a
 * set trips it, and a false positive there is a real player told they cheated.
 */
export function isDisqualifying(flags: Iterable<string>): boolean {
  for (const flag of flags) {
    if (SEVERITY[flag] === 'high') return true;
  }
  return false;
}

function torsoSize(frame: PoseFrame): number {
  const shoulder = frame[LM.LEFT_SHOULDER];
  const hip = frame[LM.LEFT_HIP];
  if (!shoulder || !hip) return 0;
  return distance(shoulder, hip);
}

/** Cheap positional fingerprint — enough to detect a repeated frame. */
function hashFrame(frame: PoseFrame): string {
  let out = '';
  for (const i of [LM.NOSE, LM.LEFT_WRIST, LM.RIGHT_WRIST, LM.LEFT_KNEE, LM.RIGHT_KNEE]) {
    const lm = frame[i];
    if (lm) out += `${lm.x.toFixed(4)},${lm.y.toFixed(4)};`;
  }
  return out;
}
