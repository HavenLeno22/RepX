/**
 * Stamps the datasource provider in prisma/schema.prisma from DATABASE_PROVIDER.
 *
 * Prisma forbids `env()` in the provider position — the provider decides which
 * query engine is compiled into the client, so it must be statically known — but
 * we still want one schema file serving SQLite locally and PostgreSQL in
 * production. This runs ahead of every db:* script and writes the one line that
 * cannot be an environment variable.
 *
 * Idempotent, and a no-op when the file already says the right thing, so it
 * produces no spurious diff on the common path.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUPPORTED = new Set(['sqlite', 'postgresql']);

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Reads one key out of `backend/.env`.
 *
 * npm does not load `.env`, and neither does plain node — only the Prisma CLI
 * does, and it runs *after* this script. So `DATABASE_PROVIDER=postgresql` sat
 * in `.env` exactly where the template tells you to put it, was never read, and
 * `db:deploy` stamped `sqlite` into the schema and generated a SQLite client
 * against a Postgres URL. The failure lands at runtime, on the deployed box,
 * with an error about the URL scheme rather than about the provider.
 *
 * A real environment variable still wins — that is how every platform supplies
 * configuration, and it must be able to override the file.
 */
function fromEnvFile(key) {
  const envPath = resolve(here, '../.env');
  if (!existsSync(envPath)) return undefined;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line);
    if (!match || match[1] !== key) continue;
    // Strip a trailing comment, then matching quotes.
    return match[2]
      .replace(/\s+#.*$/, '')
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');
  }
  return undefined;
}

const provider = process.env.DATABASE_PROVIDER ?? fromEnvFile('DATABASE_PROVIDER') ?? 'sqlite';
if (!SUPPORTED.has(provider)) {
  console.error(
    `DATABASE_PROVIDER must be one of ${[...SUPPORTED].join(', ')} — got "${provider}"`,
  );
  process.exit(1);
}

const schemaPath = resolve(here, '../prisma/schema.prisma');
const original = readFileSync(schemaPath, 'utf8');

// Anchored to the datasource block so a `provider` line belonging to the
// generator block above it can never be rewritten by accident.
const updated = original.replace(
  /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"[^"]*"/,
  `$1"${provider}"`,
);

if (updated === original) {
  process.exit(0);
}

writeFileSync(schemaPath, updated);
console.log(`prisma datasource provider set to "${provider}"`);
