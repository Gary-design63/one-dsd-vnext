// =====================================================================
// One DSD vNext — password hashing (Layer 6)
// Reuses the logic of the live app's login (verify a stored hash; never
// store plaintext) but in a portable, zero-native-dependency form using
// Node's built-in scrypt. The stored value is a self-describing PHC-style
// string, so the algorithm/params can evolve (incl. swapping to argon2id)
// without a schema change; needsRehash flags legacy hashes at login time.
// =====================================================================
import {
  randomBytes,
  scrypt as _scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

// promisify infers the no-options overload; declare the options-bearing form.
const scrypt = promisify(_scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

// scrypt cost parameters (OWASP-aligned baseline).
const N = 1 << 15; // 32768
const R = 8;
const P = 1;
const KEYLEN = 32;
const SALT_BYTES = 16;
const MAXMEM = 256 * 1024 * 1024;

const SCHEME = "scrypt";

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(plain.normalize("NFKC"), salt, KEYLEN, {
    N,
    r: R,
    p: P,
    maxmem: MAXMEM,
  });
  return `${SCHEME}$${N}$${R}$${P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== SCHEME) return false;
  const n = Number.parseInt(parts[1]!, 10);
  const r = Number.parseInt(parts[2]!, 10);
  const p = Number.parseInt(parts[3]!, 10);
  const salt = Buffer.from(parts[4]!, "base64");
  const expected = Buffer.from(parts[5]!, "base64");
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }
  const derived = await scrypt(plain.normalize("NFKC"), salt, expected.length, {
    N: n,
    r,
    p,
    maxmem: MAXMEM,
  });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

// Returns true when the stored hash uses weaker-than-current parameters and
// should be re-derived the next time the user authenticates.
export function needsRehash(stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== SCHEME) return true;
  const n = Number.parseInt(parts[1]!, 10);
  return !(n >= N);
}
