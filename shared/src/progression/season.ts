/**
 * Seasons.
 *
 * A season is the deadline that makes a ladder position mean something. Without
 * one, rating is a number that drifts; with one, it is a standing that gets
 * locked in on a date the player can see.
 *
 * Like missions, seasons are **computed from the clock, not stored**. Season 4
 * begins the instant Season 3 ends whether or not anything ran at midnight, and
 * a client that is offline over a rollover comes back with the right answer.
 */

/** Seasons started here. Any future change to this anchor renumbers history, so
 *  it is deliberately a constant rather than configuration. */
export const SEASON_EPOCH = Date.UTC(2026, 0, 5); // Monday 5 Jan 2026
export const SEASON_LENGTH_DAYS = 56; // eight weeks

const DAY_MS = 86400000;

/** Names cycle so a season has an identity beyond its number. */
const SEASON_NAMES = ['Ignition', 'Ascent', 'Overdrive', 'Apex', 'Momentum', 'Threshold'];

export interface Season {
  number: number;
  name: string;
  startsAt: string;
  endsAt: string;
  /** 0..1 through the season. */
  progress: number;
  daysLeft: number;
  /** Set on the final week — the client uses it to raise the urgency of the
   *  season card rather than inventing its own threshold. */
  endingSoon: boolean;
}

export function currentSeason(now: Date = new Date()): Season {
  const elapsed = Math.max(0, now.getTime() - SEASON_EPOCH);
  const index = Math.floor(elapsed / (SEASON_LENGTH_DAYS * DAY_MS));
  const startsAt = SEASON_EPOCH + index * SEASON_LENGTH_DAYS * DAY_MS;
  const endsAt = startsAt + SEASON_LENGTH_DAYS * DAY_MS;
  const progress = Math.max(0, Math.min(1, (now.getTime() - startsAt) / (endsAt - startsAt)));
  const daysLeft = Math.max(0, Math.ceil((endsAt - now.getTime()) / DAY_MS));

  return {
    number: index + 1,
    name: SEASON_NAMES[index % SEASON_NAMES.length],
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
    progress,
    daysLeft,
    endingSoon: daysLeft <= 7,
  };
}
