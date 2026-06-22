// =====================================================================
// One DSD vNext — server-side sessions (Layer 6)
// Opaque random token in an HttpOnly cookie; only its sha256 is stored
// (sessions.token_hash, migration 0001). Sessions are revocable and carry
// both idle and absolute expiry. This is the live app's session model,
// rebuilt cleanly and server-authoritative.
// =====================================================================
import { createHash, randomBytes } from "node:crypto";
import type { Db } from "../db.js";
import { loadConfig } from "../config.js";

export interface SessionRow {
  id: string;
  user_id: string;
  absolute_expiry: Date;
  idle_expiry: Date;
  revoked_at: Date | null;
}

export interface ActiveSession {
  sessionId: string;
  userId: string;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function minutesFromNow(min: number): Date {
  return new Date(Date.now() + min * 60_000);
}

/** Create a session; returns the RAW token to put in the cookie (never stored). */
export async function createSession(
  db: Db,
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; sessionId: string }> {
  const cfg = loadConfig();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const res = await db.query<{ id: string }>(
    `INSERT INTO sessions
       (user_id, token_hash, absolute_expiry, idle_expiry, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      userId,
      tokenHash,
      minutesFromNow(cfg.sessionAbsoluteMinutes),
      minutesFromNow(cfg.sessionIdleMinutes),
      meta.ip ?? null,
      meta.userAgent ?? null,
    ],
  );
  return { token, sessionId: res.rows[0]!.id };
}

/** Validate a raw cookie token. Fail-closed: any expiry/revocation => null.
 *  On success, slides the idle window forward. */
export async function resolveSession(
  db: Db,
  rawToken: string | undefined,
): Promise<ActiveSession | null> {
  if (!rawToken) return null;
  const cfg = loadConfig();
  const tokenHash = sha256(rawToken);
  const res = await db.query<SessionRow>(
    `SELECT id, user_id, absolute_expiry, idle_expiry, revoked_at
       FROM sessions WHERE token_hash = $1`,
    [tokenHash],
  );
  const row = res.rows[0];
  if (!row) return null;
  const now = Date.now();
  if (row.revoked_at) return null;
  if (new Date(row.absolute_expiry).getTime() <= now) return null;
  if (new Date(row.idle_expiry).getTime() <= now) return null;
  // slide idle window
  await db.query(
    `UPDATE sessions SET idle_expiry = $2, last_seen_at = now() WHERE id = $1`,
    [row.id, minutesFromNow(cfg.sessionIdleMinutes)],
  );
  return { sessionId: row.id, userId: row.user_id };
}

export async function revokeSession(db: Db, rawToken: string): Promise<void> {
  await db.query(
    `UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`,
    [sha256(rawToken)],
  );
}

export async function revokeAllForUser(db: Db, userId: string): Promise<void> {
  await db.query(
    `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
}
