/**
 * Single-elimination bracket mathematics.
 *
 * Kept as pure functions in `shared` rather than inside the backend service for
 * the same reason the ELO and exercise-engine maths live here: the bracket is
 * the part of a tournament that is easy to get subtly wrong and impossible to
 * debug from a screenshot, so it is testable in isolation and the client can
 * render a bracket without asking the server to explain its own shape.
 *
 * The design is standard competitive seeding, not naive pairing. Naive pairing
 * (1v2, 3v4, …) puts the two strongest entrants against each other in round one
 * and produces a final between the 5th and 6th seeds. Proper seeding spreads the
 * field so that, if every favourite wins, seed 1 meets seed 2 in the final and
 * not before.
 */

/** The smallest power of two that fits `n` — the true size of the bracket. */
export function bracketSize(entrantCount: number): number {
  if (entrantCount <= 1) return 1;
  let size = 1;
  while (size < entrantCount) size *= 2;
  return size;
}

export function roundCount(entrantCount: number): number {
  return Math.log2(bracketSize(entrantCount));
}

/**
 * The seed positions of a bracket, in slot order.
 *
 * Built by recursive mirroring: a bracket of size 2n is the bracket of size n
 * with each seed `s` immediately followed by its mirror `2n + 1 - s`. This is
 * the construction every real tournament uses, and it is why seed 1 sits at the
 * top of the draw and seed 2 at the bottom.
 *
 *   size 4 → [1, 4, 2, 3]        pairs (1v4) (2v3), so 1 meets 2 in the final
 *   size 8 → [1, 8, 4, 5, 2, 7, 3, 6]
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const round = order.length * 2;
    const next: number[] = [];
    for (const seed of order) {
      next.push(seed, round + 1 - seed);
    }
    order = next;
  }
  return order;
}

export interface Entrant {
  userId: string;
  /** Seeding is by rating, highest first. */
  rating: number;
}

export interface BracketPairing {
  round: number;
  position: number;
  /** `null` where the slot is a bye. */
  aUserId: string | null;
  bUserId: string | null;
  aSeed: number | null;
  bSeed: number | null;
}

/**
 * The first round, with byes assigned to the strongest entrants.
 *
 * A bracket only divides evenly when the field is a power of two. For every
 * other size the surplus slots become byes, and they go to the top seeds —
 * that is the reward for seeding well and it is what every sanctioned bracket
 * does. A bye is represented as a real pairing with one empty side, so the
 * advancement logic has no special case to forget.
 */
export function buildFirstRound(entrants: Entrant[]): BracketPairing[] {
  const seeded = [...entrants].sort((a, b) => b.rating - a.rating);
  const size = bracketSize(seeded.length);
  const order = seedOrder(size);

  // seed number (1-based) → entrant, or undefined where the slot is empty
  const bySeed = new Map<number, Entrant>();
  seeded.forEach((entrant, i) => bySeed.set(i + 1, entrant));

  const pairings: BracketPairing[] = [];
  for (let i = 0; i < size; i += 2) {
    const aSeed = order[i];
    const bSeed = order[i + 1];
    const a = bySeed.get(aSeed);
    const b = bySeed.get(bSeed);

    pairings.push({
      round: 0,
      position: i / 2,
      aUserId: a?.userId ?? null,
      bUserId: b?.userId ?? null,
      aSeed: a ? aSeed : null,
      bSeed: b ? bSeed : null,
    });
  }
  return pairings;
}

/**
 * Where a winner goes next.
 *
 * Two adjacent matches feed one match in the following round, and which side of
 * it you land on is decided by parity: the even-positioned match feeds slot A,
 * the odd one feeds slot B. Getting this backwards is invisible until a final
 * has the same player on both sides.
 */
export function nextSlot(round: number, position: number): {
  round: number;
  position: number;
  slot: 'a' | 'b';
} {
  return {
    round: round + 1,
    position: Math.floor(position / 2),
    slot: position % 2 === 0 ? 'a' : 'b',
  };
}

/** How many matches a round of a given bracket holds. */
export function matchesInRound(entrantCount: number, round: number): number {
  return bracketSize(entrantCount) / 2 ** (round + 1);
}

/**
 * What a round is called, counted back from the final.
 *
 * Named rather than numbered because "Semi-final" tells a player how close they
 * are and "Round 3" does not.
 */
export function roundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round - 1;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semi-final';
  if (fromEnd === 2) return 'Quarter-final';
  return `Round of ${2 ** (fromEnd + 1)}`;
}
