/**
 * End-to-end match test: two real Socket.IO clients, one real server.
 *
 * This existed for months as a throwaway script that was re-run by hand and
 * then deleted, which meant the highest-risk path in the product — queue,
 * pair, count, settle — was only ever verified when somebody remembered to
 * verify it. It is committed now, and it asserts the things that were
 * previously only eyeballed:
 *
 *   - the queue status is pushed repeatedly and its rating band widens
 *   - `matchmaking:found` carries the server's clock and start time
 *   - reps derived server-side from a landmark stream actually count
 *   - the opponent sees them
 *   - no per-frame progress chatter comes back
 *   - the match settles with the scoreline both players saw
 *
 * Usage (with the API already running on :4000):
 *   npm run test:e2e -w @repx/backend
 */

import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const API = process.env.REPX_API ?? 'http://localhost:4000';
const PASSWORD = 'repx1234';
const A = { email: 'rookie@repx.dev', label: 'rookie' };
const B = { email: 'pat@repx.dev', label: 'plankzilla' };

const EXERCISE = 'squat';
const FPS = 24;
const FRAME_MS = 1000 / FPS;

/* ----------------------------------------------------------------- setup -- */

async function login({ email }) {
  const response = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!response.ok) {
    throw new Error(
      `Could not sign in as ${email} (${response.status}). Is the API running and seeded? ` +
        `Try: npm run db:setup -w @repx/backend`,
    );
  }
  return response.json();
}

function connect(token, label) {
  const socket = io(API, { auth: { token }, transports: ['websocket'] });
  const seen = { queued: [], found: null, started: null, reps: [], opponent: [], progress: 0, ended: null };

  socket.on('matchmaking:queued', (p) => seen.queued.push(p));
  socket.on('matchmaking:found', (p) => (seen.found = p));
  socket.on('match:started', (p) => (seen.started = p));
  socket.on('rep:counted', (p) => seen.reps.push(p));
  socket.on('match:opponentProgress', (p) => seen.opponent.push(p));
  socket.on('match:progress', () => (seen.progress += 1));
  socket.on('match:ended', (p) => (seen.ended = p));
  socket.on('error', (e) => console.error(`[${label}] server error`, e));

  return { socket, seen, label };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(predicate, timeoutMs, description) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await wait(60);
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for: ${description}`);
}

/* ------------------------------------------------------------- landmarks -- */

const L = (x, y) => ({ x, y, z: 0, visibility: 0.9 });

/** Front-view squat at depth `d`, matching the engine's own test fixture. */
function frontSquat(d) {
  const f = Array.from({ length: 33 }, () => L(0.5, 0.5));
  f[11] = L(0.44, 0.25 + 0.17 * d);
  f[12] = L(0.56, 0.25 + 0.17 * d);
  f[23] = L(0.46, 0.45 + 0.17 * d);
  f[24] = L(0.54, 0.45 + 0.17 * d);
  f[25] = L(0.45, 0.65 + 0.01 * d);
  f[26] = L(0.55, 0.65 + 0.01 * d);
  f[27] = L(0.46, 0.85);
  f[28] = L(0.54, 0.85);
  return f;
}

/**
 * Streams a continuous squat cycle in real time. Real pacing matters: the
 * server's anti-cheat rejects a client whose timestamps advance faster than the
 * server's own wall clock, so this cannot be fast-forwarded.
 */
function startStreaming(client, matchId, periodMs) {
  let seq = 0;
  const startedAt = Date.now();

  const timer = setInterval(() => {
    const t = (Date.now() - startedAt) % periodMs;
    // Triangle wave: down for half the period, up for the other half.
    const half = periodMs / 2;
    const d = t < half ? t / half : (periodMs - t) / half;

    client.socket.emit('match:landmarks', {
      matchId,
      frameSeq: seq++,
      clientTimestamp: Date.now(),
      landmarks: frontSquat(d),
    });
  }, FRAME_MS);

  return () => clearInterval(timer);
}

/* ------------------------------------------------------------------ run -- */

async function main() {
  console.log('→ signing in two players');
  const [sessionA, sessionB] = await Promise.all([login(A), login(B)]);

  const alice = connect(sessionA.accessToken, A.label);
  const bob = connect(sessionB.accessToken, B.label);

  await until(() => alice.socket.connected && bob.socket.connected, 5000, 'both sockets to connect');
  console.log('→ both connected');

  /* --- the band widens while waiting -------------------------------------
   *
   * Deliberately checked with only ONE player queued. Judging it from a real
   * pairing made the test order-dependent: the ratings it relied on are the
   * ratings the match itself moves, so a second run had a different gap and the
   * pair formed before the assertion could observe anything. Alone in the
   * queue, nobody can be matched and the widening is unambiguous.
   */
  alice.socket.emit('matchmaking:join', { exerciseSlug: EXERCISE, mode: 'ranked' });

  // Several statuses land at join time, all reporting a zero-second wait, so
  // widening can only be judged once real time has passed.
  await until(
    () => (alice.seen.queued.at(-1)?.waitSeconds ?? 0) >= 3,
    12000,
    'queue status to keep arriving as time passes',
  );

  const bands = alice.seen.queued.map((q) => q.ratingBand);
  console.log(`→ queue status pushed ${alice.seen.queued.length}x, bands ${bands[0]} → ${bands.at(-1)}`);
  assert.ok(
    alice.seen.queued.length >= 4,
    `status must be pushed repeatedly, not once at join (got ${alice.seen.queued.length})`,
  );
  assert.ok(
    bands.at(-1) > bands[0],
    `the rating band must widen while waiting (saw ${bands.join(', ')})`,
  );
  assert.equal(alice.seen.queued.at(-1).searching, 1, 'queue status must report the queue depth');
  assert.ok(!alice.seen.found, 'a lone player must not be matched');

  alice.socket.emit('matchmaking:leave');
  await wait(300);
  alice.seen.queued.length = 0;

  /* --- an actual match ---------------------------------------------------- */

  alice.socket.emit('matchmaking:join', { exerciseSlug: EXERCISE, mode: 'ranked' });
  bob.socket.emit('matchmaking:join', { exerciseSlug: EXERCISE, mode: 'ranked' });

  await until(() => alice.seen.found && bob.seen.found, 40000, 'an opponent to be found');
  console.log('→ matched');

  const found = alice.seen.found;
  assert.equal(found.exerciseSlug, EXERCISE);
  assert.ok(typeof found.startsAt === 'number', 'found payload must carry startsAt');
  assert.ok(typeof found.serverNow === 'number', 'found payload must carry serverNow');
  const countdownMs = found.startsAt - found.serverNow;
  assert.ok(
    countdownMs > 3000 && countdownMs <= found.countdownSeconds * 1000 + 500,
    `startsAt must be one countdown ahead of serverNow (was ${countdownMs}ms)`,
  );
  assert.equal(alice.seen.found.matchId, bob.seen.found.matchId, 'both players in the same match');

  await until(() => alice.seen.started && bob.seen.started, 12000, 'the match to go live');
  console.log('→ live');
  assert.ok(typeof alice.seen.started.serverNow === 'number', 'started payload must carry serverNow');

  const matchId = found.matchId;
  // Alice squats briskly, Bob slowly, so the scoreline is unambiguous.
  const stopA = startStreaming(alice, matchId, 1400);
  const stopB = startStreaming(bob, matchId, 2600);

  console.log('→ streaming squats for 14s');
  await wait(14000);
  stopA();
  stopB();

  assert.ok(alice.seen.reps.length >= 4, `alice should have scored reps (got ${alice.seen.reps.length})`);
  assert.ok(bob.seen.reps.length >= 2, `bob should have scored reps (got ${bob.seen.reps.length})`);
  assert.ok(
    alice.seen.reps.length > bob.seen.reps.length,
    'the faster player must be ahead',
  );
  assert.ok(bob.seen.opponent.length > 0, 'bob must see alice scoring');
  assert.equal(
    alice.seen.progress,
    0,
    `no per-frame progress chatter should be sent (got ${alice.seen.progress} messages)`,
  );

  const qualities = alice.seen.reps.map((r) => r.quality);
  assert.ok(
    qualities.every((q) => q > 0 && q <= 1),
    'every counted rep must carry a usable quality score',
  );
  console.log(
    `→ alice ${alice.seen.reps.length} reps, bob ${bob.seen.reps.length} reps, quality ${qualities.at(-1)}`,
  );

  // Bob concedes so the match settles now rather than in another 45 seconds.
  bob.socket.emit('match:leave', { matchId });

  await until(() => alice.seen.ended && bob.seen.ended, 10000, 'the match to settle');
  console.log('→ settled');

  assert.equal(alice.seen.ended.result, 'win', 'the player who stayed wins');
  assert.equal(bob.seen.ended.result, 'loss');
  assert.equal(
    alice.seen.ended.yourReps,
    alice.seen.reps.length,
    'the final scoreline must match what was counted live',
  );
  assert.equal(alice.seen.ended.opponentReps, bob.seen.ended.yourReps, 'both players see one scoreline');
  assert.ok(alice.seen.ended.ratingDelta > 0, 'a ranked win must raise the rating');
  assert.deepEqual(alice.seen.ended.flags, [], `clean play must raise no flags (got ${alice.seen.ended.flags})`);

  alice.socket.close();
  bob.socket.close();

  console.log(
    `\n✔ end-to-end match passed — ${alice.seen.ended.yourReps}–${alice.seen.ended.opponentReps}, ` +
      `rating ${alice.seen.ended.ratingBefore} → ${alice.seen.ended.ratingAfter}`,
  );
}

main().catch((error) => {
  console.error(`\n✖ ${error.message}`);
  process.exit(1);
});
