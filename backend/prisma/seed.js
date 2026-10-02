/**
 * Seeds demo accounts so the leaderboard isn't empty on a fresh install and you
 * can sign in as a second player to test a real match.
 *
 * Idempotent — safe to re-run.
 *
 * The demo data is deliberately *lived-in* rather than minimal: XP, day streaks,
 * countries, friendships and a few notifications. A brand-new install that opens
 * on a screen full of empty states is impossible to judge the design of, and the
 * screens most worth reviewing (friends online, the country board, the
 * notification centre) are exactly the ones that need other people to exist.
 *
 * NOTE: the hash format below must stay in sync with
 * src/modules/auth/password.ts. It's duplicated rather than imported because
 * this script runs before the TypeScript build on a clean checkout.
 */
const { PrismaClient } = require('@prisma/client');
const { randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');

const scryptAsync = promisify(scrypt);
const prisma = new PrismaClient();

const N = 2 ** 15;
const R = 8;
const P = 1;

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64, {
    N,
    r: R,
    p: P,
    maxmem: 128 * N * R * 2,
  });
  return `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

const DEMO_PASSWORD = 'repx1234';

const DEMO_USERS = [
  {
    username: 'ironmike',
    email: 'mike@repx.dev',
    rating: 1480,
    wins: 24,
    losses: 11,
    country: 'United Kingdom',
    bio: 'Push-ups at dawn. Ranked at night.',
    xp: 7400,
    dayStreak: 12,
    totalReps: 3120,
  },
  {
    username: 'squatqueen',
    email: 'sasha@repx.dev',
    rating: 1725,
    wins: 41,
    losses: 14,
    country: 'Poland',
    bio: 'Never skipped leg day. Ever.',
    xp: 16800,
    dayStreak: 34,
    totalReps: 7890,
  },
  {
    username: 'plankzilla',
    email: 'pat@repx.dev',
    rating: 1190,
    wins: 12,
    losses: 15,
    country: 'United Kingdom',
    bio: 'Holding on.',
    xp: 3100,
    dayStreak: 4,
    totalReps: 1420,
  },
  {
    username: 'repmachine',
    email: 'rio@repx.dev',
    rating: 2040,
    wins: 68,
    losses: 19,
    country: 'Brazil',
    bio: 'Grandmaster or nothing.',
    xp: 41200,
    dayStreak: 61,
    totalReps: 18400,
  },
  {
    username: 'rookie',
    email: 'rookie@repx.dev',
    rating: 1000,
    wins: 0,
    losses: 0,
    country: 'United Kingdom',
    bio: null,
    xp: 0,
    dayStreak: 0,
    totalReps: 0,
  },
];

/** Everyone is friends with the rookie account, so signing in as the documented
 *  demo user immediately shows a populated friends list and friends board. */
const FRIENDSHIPS = [
  ['rookie@repx.dev', 'mike@repx.dev', 'accepted'],
  ['rookie@repx.dev', 'sasha@repx.dev', 'accepted'],
  ['pat@repx.dev', 'rookie@repx.dev', 'accepted'],
  // One left pending so the incoming-request state is reviewable without
  // needing two browsers.
  ['rio@repx.dev', 'rookie@repx.dev', 'pending'],
];

const NOTIFICATIONS = [
  {
    email: 'rookie@repx.dev',
    category: 'system',
    title: 'Welcome to RepX',
    body: 'Ten placement matches decide where you start on the ladder.',
    href: '/play',
  },
  {
    email: 'rookie@repx.dev',
    category: 'season',
    title: 'Season is live',
    body: 'Your rank locks in when it ends. Climb while it counts.',
    href: '/leaderboard',
  },
];

async function main() {
  /**
   * Never seed a production database.
   *
   * `npm run db:setup` runs this, and `db:setup` is the command anybody reaches
   * for when a fresh environment has no tables. Run once against production it
   * creates five working accounts whose shared password is printed in the
   * README, on the seed's own final line, and in this file — five back doors,
   * installed by the setup instructions.
   *
   * It refuses rather than warns because a warning scrolls past in a deploy log.
   * SEED_DEMO_DATA=1 is the deliberate override for a staging environment that
   * genuinely wants a populated leaderboard.
   */
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_DATA !== '1') {
    console.error(
      'Refusing to seed demo accounts with NODE_ENV=production.\n' +
        `These accounts share a well-known password ("${DEMO_PASSWORD}") and would be\n` +
        'usable by anyone who has read this repository.\n\n' +
        'Production needs migrations, not seed data:\n' +
        '  npm run db:deploy -w @repx/backend\n\n' +
        'If this really is a staging environment that wants demo players, set\n' +
        'SEED_DEMO_DATA=1 to override.',
    );
    process.exit(1);
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const user of DEMO_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      // Progression fields are refreshed on re-run so a seed written before
      // these columns existed does not leave permanently empty demo profiles.
      update: {
        country: user.country,
        bio: user.bio,
        xp: user.xp,
        dayStreak: user.dayStreak,
        totalReps: user.totalReps,
      },
      create: {
        email: user.email,
        username: user.username,
        passwordHash,
        rating: user.rating,
        peakRating: user.rating,
        wins: user.wins,
        losses: user.losses,
        matchesPlayed: user.wins + user.losses,
        currentStreak: 0,
        longestStreak: Math.min(user.wins, 7),
        country: user.country,
        bio: user.bio,
        xp: user.xp,
        dayStreak: user.dayStreak,
        lastPlayedOn: user.dayStreak > 0 ? new Date().toISOString().slice(0, 10) : null,
        totalReps: user.totalReps,
        flawlessMatches: Math.floor(user.wins / 4),
        perfectGrades: Math.floor(user.wins / 6),
        identities: { create: { provider: 'email', providerUserId: user.email } },
      },
    });
  }

  const byEmail = new Map(
    (await prisma.user.findMany({ where: { email: { in: DEMO_USERS.map((u) => u.email) } } })).map(
      (u) => [u.email, u.id],
    ),
  );

  for (const [from, to, status] of FRIENDSHIPS) {
    const requesterId = byEmail.get(from);
    const addresseeId = byEmail.get(to);
    if (!requesterId || !addresseeId) continue;
    await prisma.friendship.upsert({
      where: { requesterId_addresseeId: { requesterId, addresseeId } },
      update: {},
      create: {
        requesterId,
        addresseeId,
        status,
        acceptedAt: status === 'accepted' ? new Date() : null,
      },
    });
  }

  for (const notification of NOTIFICATIONS) {
    const userId = byEmail.get(notification.email);
    if (!userId) continue;
    const existing = await prisma.notification.findFirst({
      where: { userId, title: notification.title },
    });
    if (existing) continue;
    await prisma.notification.create({
      data: {
        userId,
        category: notification.category,
        title: notification.title,
        body: notification.body,
        href: notification.href,
      },
    });
  }

  console.log(`Seeded ${DEMO_USERS.length} demo accounts (password: ${DEMO_PASSWORD})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
