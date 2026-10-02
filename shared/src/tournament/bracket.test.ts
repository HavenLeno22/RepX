/**
 * Bracket regression tests.
 *
 * A bracket is the kind of structure that looks right until the moment it is
 * wrong in public. The failures these guard against — a favourite knocked out in
 * round one by the other favourite, a bye handed to the weakest entrant, a final
 * with the same player on both sides — are all invisible in code review and
 * humiliating in a live tournament.
 *
 * Run with the rest: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type Entrant,
  bracketSize,
  buildFirstRound,
  matchesInRound,
  nextSlot,
  roundCount,
  roundName,
  seedOrder,
} from './bracket';

function field(count: number): Entrant[] {
  // Rating descending, so entrant i is seed i+1.
  return Array.from({ length: count }, (_, i) => ({
    userId: `u${i + 1}`,
    rating: 3000 - i * 10,
  }));
}

/* ------------------------------------------------------------- sizing -- */

test('bracket rounds up to a power of two', () => {
  assert.equal(bracketSize(2), 2);
  assert.equal(bracketSize(3), 4);
  assert.equal(bracketSize(8), 8);
  assert.equal(bracketSize(9), 16);
  assert.equal(bracketSize(31), 32);
});

test('round count is the log of the bracket size', () => {
  assert.equal(roundCount(2), 1);
  assert.equal(roundCount(8), 3);
  assert.equal(roundCount(9), 4);
});

test('a round holds half as many matches as the one before it', () => {
  assert.equal(matchesInRound(8, 0), 4);
  assert.equal(matchesInRound(8, 1), 2);
  assert.equal(matchesInRound(8, 2), 1);
});

/* ------------------------------------------------------------ seeding -- */

test('seed order mirrors recursively', () => {
  assert.deepEqual(seedOrder(1), [1]);
  assert.deepEqual(seedOrder(2), [1, 2]);
  assert.deepEqual(seedOrder(4), [1, 4, 2, 3]);
  assert.deepEqual(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
});

test('every seed appears exactly once', () => {
  for (const size of [2, 4, 8, 16, 32]) {
    const order = seedOrder(size);
    assert.equal(order.length, size);
    assert.deepEqual(
      [...order].sort((a, b) => a - b),
      Array.from({ length: size }, (_, i) => i + 1),
    );
  }
});

test('each pairing sums to one more than the bracket size', () => {
  // The defining property of a mirrored draw: seed 1 plays the last seed, seed 2
  // plays the second-last, and so on down the round.
  for (const size of [4, 8, 16]) {
    const order = seedOrder(size);
    for (let i = 0; i < size; i += 2) {
      assert.equal(order[i] + order[i + 1], size + 1);
    }
  }
});

test('the top two seeds cannot meet before the final', () => {
  // Walk the draw assuming every favourite wins, and check seeds 1 and 2 only
  // collide in the last round. This is the whole point of seeding.
  for (const count of [4, 8, 16, 32]) {
    const total = roundCount(count);

    // The winners of round 0 are the entrants of round 1, so the counter starts
    // at 1 — not 0, which would report the final as happening a round early.
    let alive = buildFirstRound(field(count)).map((p) => {
      const seeds = [p.aSeed, p.bSeed].filter((s): s is number => s !== null);
      return Math.min(...seeds); // the favourite wins
    });
    let round = 1;

    while (alive.length > 1) {
      for (let i = 0; i < alive.length; i += 2) {
        const pair = [alive[i], alive[i + 1]];
        if (pair.includes(1) && pair.includes(2)) {
          assert.equal(round, total - 1, `seeds 1 and 2 met in round ${round} of ${total}`);
        }
      }

      const winners: number[] = [];
      for (let i = 0; i < alive.length; i += 2) {
        winners.push(Math.min(alive[i], alive[i + 1]));
      }
      alive = winners;
      round++;
    }
    assert.equal(alive[0], 1, 'the top seed should win a bracket where form holds');
  }
});

/* --------------------------------------------------------------- byes -- */

test('byes go to the top seeds', () => {
  // Five entrants in an eight-bracket means three byes, and they belong to seeds
  // 1, 2 and 3 — not to whoever registered last.
  const pairings = buildFirstRound(field(5));
  assert.equal(pairings.length, 4);

  const byes = pairings.filter((p) => p.aUserId === null || p.bUserId === null);
  assert.equal(byes.length, 3);

  const advancing = byes.map((p) => p.aSeed ?? p.bSeed).sort((a, b) => (a ?? 0) - (b ?? 0));
  assert.deepEqual(advancing, [1, 2, 3]);
});

test('a full field has no byes', () => {
  for (const p of buildFirstRound(field(8))) {
    assert.ok(p.aUserId !== null && p.bUserId !== null);
  }
});

test('every entrant is placed exactly once', () => {
  for (const count of [2, 3, 5, 7, 8, 13]) {
    const ids = buildFirstRound(field(count))
      .flatMap((p) => [p.aUserId, p.bUserId])
      .filter((id): id is string => id !== null);
    assert.equal(ids.length, count);
    assert.equal(new Set(ids).size, count, 'an entrant was placed in two slots');
  }
});

/* -------------------------------------------------------- advancement -- */

test('adjacent matches feed opposite slots of the same parent', () => {
  const left = nextSlot(0, 0);
  const right = nextSlot(0, 1);
  assert.deepEqual(left, { round: 1, position: 0, slot: 'a' });
  assert.deepEqual(right, { round: 1, position: 0, slot: 'b' });

  // …and the next pair feeds the next parent, not the same one.
  assert.deepEqual(nextSlot(0, 2), { round: 1, position: 1, slot: 'a' });
  assert.deepEqual(nextSlot(0, 3), { round: 1, position: 1, slot: 'b' });
});

test('advancement never puts two winners in the same slot', () => {
  const seen = new Set<string>();
  for (let position = 0; position < 16; position++) {
    const next = nextSlot(0, position);
    const key = `${next.round}:${next.position}:${next.slot}`;
    assert.ok(!seen.has(key), `two matches feed ${key}`);
    seen.add(key);
  }
});

/* -------------------------------------------------------------- names -- */

test('rounds are named back from the final', () => {
  assert.equal(roundName(2, 3), 'Final');
  assert.equal(roundName(1, 3), 'Semi-final');
  assert.equal(roundName(0, 3), 'Quarter-final');
  assert.equal(roundName(0, 4), 'Round of 16');
  assert.equal(roundName(0, 5), 'Round of 32');
});
