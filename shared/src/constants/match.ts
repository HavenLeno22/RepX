/** Match modes. Only `ranked` moves ELO. See docs/MATCHMAKING.md. */
export const MATCH_MODES = ['ranked', 'quick', 'friendly'] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

export const MATCH_STATUSES = ['pending', 'countdown', 'active', 'completed', 'forfeited', 'voided'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

/** Seconds of countdown between opponent found and the match going live. */
export const COUNTDOWN_SECONDS = 5;

/** Duration of a match round, in seconds. */
export const MATCH_DURATION_SECONDS = 60;

/** How long a disconnected player has to reconnect before forfeiting. */
export const RECONNECT_GRACE_SECONDS = 15;

/**
 * How long a direct challenge stays open before it lapses.
 *
 * Short on purpose. A challenge is an interruption — someone is standing in
 * front of their camera waiting for an answer — and an invite that lingers for
 * minutes trains players to ignore the prompt entirely.
 */
export const CHALLENGE_EXPIRY_SECONDS = 45;

/**
 * Private room codes.
 *
 * Six characters from an alphabet with I, O, 0 and 1 removed, because these get
 * read aloud across a gym floor and dictated over voice chat. 32^6 is about a
 * billion combinations, which is far more than the number of rooms that can be
 * open at once, so collisions are handled by retrying rather than by queueing.
 */
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Rooms with nobody in them are swept after this long. */
export const ROOM_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * How often the server re-evaluates the queue and pushes a fresh status to
 * everyone waiting in it.
 *
 * The queue status used to be sent exactly once, at join. The search screen
 * therefore showed the *initial* rating band forever while captioning it
 * "widening as you wait" — the band really was widening on the server, but the
 * player was watching a frozen number. Pushing on every tick is what makes that
 * claim true on screen.
 */
export const QUEUE_TICK_MS = 1000;

/**
 * Rating band widening schedule for matchmaking: after `afterSeconds` in queue,
 * accept opponents within `+/- band` rating. Trades precision for wait time.
 *
 * Interpolated between steps rather than jumped, so the search screen shows a
 * band that creeps open continuously instead of standing still for ten seconds
 * and then leaping.
 */
export const MATCHMAKING_BANDS = [
  { afterSeconds: 0, band: 100 },
  { afterSeconds: 10, band: 250 },
  { afterSeconds: 20, band: 500 },
  { afterSeconds: 35, band: 1500 },
] as const;

export function bandForWait(waitSeconds: number): number {
  const first = MATCHMAKING_BANDS[0];
  const last = MATCHMAKING_BANDS[MATCHMAKING_BANDS.length - 1];
  if (waitSeconds <= first.afterSeconds) return first.band;
  if (waitSeconds >= last.afterSeconds) return last.band;

  for (let i = 1; i < MATCHMAKING_BANDS.length; i++) {
    const to = MATCHMAKING_BANDS[i];
    if (waitSeconds >= to.afterSeconds) continue;

    const from = MATCHMAKING_BANDS[i - 1];
    const progress = (waitSeconds - from.afterSeconds) / (to.afterSeconds - from.afterSeconds);
    return Math.round(from.band + (to.band - from.band) * progress);
  }

  return last.band;
}
