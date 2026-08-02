/**
 * Password hashing.
 *
 * Uses Node's built-in scrypt — a memory-hard KDF on the OWASP-recommended
 * list. Chosen over Argon2id specifically because argon2 is a native addon that
 * requires a C++ build toolchain (`node-gyp rebuild`) on Windows, which would
 * make the repository impossible to `npm install` for part of the team. This is
 * a deliberate portability-over-marginal-strength trade; see
 * docs/AUTHENTICATION.md for the note on revisiting it in production images
 * where the toolchain is guaranteed.
 *
 * Format: scrypt$N$r$p$<salt-hex>$<hash-hex> — self-describing, so parameters
 * can be raised later without invalidating existing hashes.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const N = 2 ** 15; // CPU/memory cost
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAXMEM = 128 * N * R * 2;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');

  const derived = await scrypt(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 128 * Number(n) * Number(r) * 2,
  });

  // Constant-time compare — a length mismatch alone must not short-circuit.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
