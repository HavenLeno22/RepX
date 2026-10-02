/**
 * End-to-end account lifecycle against a running API.
 *
 * Covers the paths that are impossible to check by reading code and expensive to
 * get wrong: that a verification link actually verifies, that a reset link
 * actually resets *and* kills every existing session, that the reset endpoint
 * cannot be used to discover who has an account, and that deleting an account
 * really removes it.
 *
 * Tokens are read out of the database rather than out of a mailbox — that is
 * exactly what clicking the emailed link does, minus the mail server.
 *
 *   npm run dev:backend        # in one terminal
 *   npm run test:auth -w @repx/backend
 */

import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

const API = process.env.API_URL ?? 'http://localhost:4000/api';
const prisma = new PrismaClient();

let failures = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✔ ${label}`);
  } else {
    failures++;
    console.error(`  ✘ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/**
 * Calls the API, waiting out the rate limiter rather than disabling it.
 *
 * This test spends more than five credential calls a minute, which is exactly
 * what the `auth` bucket exists to stop. The tempting fix is to switch
 * throttling off under NODE_ENV=test — and that is wrong, because it means the
 * configuration being tested is not the configuration being deployed, and a
 * limiter that is skipped in every test is a limiter nobody notices breaking.
 *
 * So a 429 is treated as backpressure and honoured, using the `Retry-After` the
 * server sends. It makes the run slower and it keeps the limits real. A 429
 * arriving where the test did not expect one still shows up, because the retried
 * result is what gets asserted on.
 */
async function call(path, { method = 'POST', body, token } = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get('retry-after')) || 60;
      process.stdout.write(`    (rate limited — waiting ${retryAfter}s)\n`);
      await new Promise((resolve) => setTimeout(resolve, (retryAfter + 1) * 1000));
      continue;
    }

    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }
  throw new Error(`${path} stayed rate limited across every retry`);
}

/** The server stores only the hash, so this is how a "link" is recovered. */
async function latestToken(userId, purpose) {
  const rows = await prisma.verificationToken.findMany({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  return rows[0] ?? null;
}

/**
 * Tokens are unrecoverable by design, so the test issues its own and writes the
 * hash the same way the server does. This proves the *consumption* path, which
 * is the half that carries the security properties.
 */
async function plantToken(userId, purpose, ttlMs) {
  const token = randomBytes(32).toString('base64url');
  await prisma.verificationToken.create({
    data: {
      userId,
      purpose,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  return token;
}

async function main() {
  const stamp = randomBytes(5).toString('hex');
  const email = `e2e-${stamp}@repx.test`;
  const username = `e2e${stamp}`;
  const password = 'original-password-1';
  const newPassword = 'replacement-password-2';

  console.log('\n→ register');
  const registered = await call('/auth/register', {
    body: { email, username, password },
  });
  check('registration succeeds', registered.status === 201, `got ${registered.status}`);
  if (!registered.body?.user) {
    console.error('cannot continue without a session');
    return;
  }

  const userId = registered.body.user.id;
  const firstRefresh = registered.body.refreshToken;
  check('new account starts unverified', registered.body.user.emailVerified === false);
  check('new account has recorded no consent', registered.body.user.consentVersion === null);

  console.log('\n→ email verification');
  const issued = await latestToken(userId, 'email_verification');
  check('registration issued a verification token', issued !== null);

  const planted = await plantToken(userId, 'email_verification', 60_000);
  const verified = await call('/auth/verify', { body: { token: planted } });
  check('a valid link verifies', verified.status === 204, `got ${verified.status}`);

  const replayed = await call('/auth/verify', { body: { token: planted } });
  check('the same link cannot be used twice', replayed.status === 400, `got ${replayed.status}`);

  const bogus = await call('/auth/verify', { body: { token: 'not-a-real-token' } });
  check('a forged token is rejected', bogus.status === 400, `got ${bogus.status}`);

  const me = await call('/users/me', { method: 'GET', token: registered.body.accessToken });
  check('the account now reports as verified', me.body?.emailVerified === true);

  console.log('\n→ consent');
  const version = (await call('/auth/consent', { method: 'GET' })).body.version;
  const consented = await call('/users/me/consent', {
    body: { version },
    token: registered.body.accessToken,
  });
  check('consent is recorded', consented.status === 204, `got ${consented.status}`);

  const stale = await call('/users/me/consent', {
    body: { version: '1999-01-01' },
    token: registered.body.accessToken,
  });
  check('consent to an out-of-date policy is refused', stale.status === 400, `got ${stale.status}`);

  console.log('\n→ password reset');
  const unknown = await call('/auth/password/forgot', { body: { email: 'nobody@repx.test' } });
  const known = await call('/auth/password/forgot', { body: { email } });
  check(
    'an unknown address is indistinguishable from a real one',
    unknown.status === 204 && known.status === 204,
    `${unknown.status} vs ${known.status}`,
  );

  const resetToken = await plantToken(userId, 'password_reset', 60_000);

  const crossPurpose = await call('/auth/verify', { body: { token: resetToken } });
  check(
    'a reset token cannot be used as a verification token',
    crossPurpose.status === 400,
    `got ${crossPurpose.status}`,
  );

  const reset = await call('/auth/password/reset', {
    body: { token: resetToken, password: newPassword },
  });
  check('the reset completes', reset.status === 204, `got ${reset.status}`);

  console.log('\n→ session invalidation');
  const oldSession = await call('/auth/refresh', { body: { refreshToken: firstRefresh } });
  check(
    'every pre-reset session is revoked',
    oldSession.status === 401,
    `got ${oldSession.status} — an attacker would still be signed in`,
  );

  const oldPassword = await call('/auth/login', { body: { email, password } });
  check('the old password no longer works', oldPassword.status === 401, `got ${oldPassword.status}`);

  const signedIn = await call('/auth/login', { body: { email, password: newPassword } });
  check('the new password works', signedIn.status === 200, `got ${signedIn.status}`);

  console.log('\n→ erasure');
  const wrongName = await call('/users/me/delete', {
    body: { confirmUsername: 'not-my-username' },
    token: signedIn.body.accessToken,
  });
  check('deletion requires the correct username', wrongName.status === 400, `got ${wrongName.status}`);

  const deleted = await call('/users/me/delete', {
    body: { confirmUsername: username },
    token: signedIn.body.accessToken,
  });
  check('the account deletes', deleted.status === 204, `got ${deleted.status}`);

  const gone = await prisma.user.findUnique({ where: { id: userId } });
  check('the row is really gone', gone === null);

  const orphans = await prisma.verificationToken.count({ where: { userId } });
  check('its tokens cascaded away', orphans === 0, `${orphans} left behind`);

  console.log(
    failures === 0
      ? '\n✔ auth end-to-end passed\n'
      : `\n✘ auth end-to-end failed — ${failures} check(s)\n`,
  );
}

main()
  .catch((error) => {
    failures++;
    console.error('\n✘ auth end-to-end threw:', error);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
  });
