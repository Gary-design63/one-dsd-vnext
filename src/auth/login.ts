// =====================================================================
// One DSD vNext — login flow (Layer 6)
// Rebuilds the live app's fn_login logic in the new codebase:
//   - look up active user by username OR email
//   - verify password against the stored hash (constant-time)
//   - throttle by recent failures (session_events)
//   - on success: mint a server-side session, transparently rehash if needed
//   - record login_success / login_failure to session_events + audit
// AI never bypasses this; there is no "act as user" path.
// =====================================================================
import type { Db } from "../db.js";
import { loadConfig } from "../config.js";
import { audit, newTraceId } from "../audit/audit.js";
import { verifyPassword, hashPassword, needsRehash } from "./password.js";
import { createSession } from "./session.js";

export interface LoginInput {
  identifier: string; // username or email
  password: string;
  ip?: string | null;
  userAgent?: string | null;
}

export type LoginResult =
  | { ok: true; token: string; userId: string; roles: string[] }
  | { ok: false; reason: "invalid_credentials" | "locked_out" | "inactive" };

interface UserRow {
  id: string;
  password_hash: string;
  active: boolean;
}

async function recentFailures(db: Db, identifier: string): Promise<number> {
  const cfg = loadConfig();
  const res = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM session_events
       WHERE kind = 'login_failure'
         AND detail = $1
         AND created_at > now() - ($2 || ' minutes')::interval`,
    [identifier, String(cfg.loginWindowMinutes)],
  );
  return Number.parseInt(res.rows[0]?.n ?? "0", 10);
}

async function rolesFor(db: Db, userId: string): Promise<string[]> {
  const res = await db.query<{ role_key: string }>(
    `SELECT role_key FROM role_assignments WHERE user_id = $1`,
    [userId],
  );
  return res.rows.map((r) => r.role_key);
}

export async function login(db: Db, input: LoginInput): Promise<LoginResult> {
  const cfg = loadConfig();
  const trace = newTraceId();
  const id = input.identifier.trim().toLowerCase();

  if ((await recentFailures(db, id)) >= cfg.maxLoginFailuresPerWindow) {
    await db.query(
      `INSERT INTO session_events (kind, detail, ip_address) VALUES ('login_failure', $1, $2)`,
      [id, input.ip ?? null],
    );
    await audit(db, { action: "login_lockout", detail: { identifier: id }, traceId: trace });
    return { ok: false, reason: "locked_out" };
  }

  const res = await db.query<UserRow>(
    `SELECT id, password_hash, active FROM users
       WHERE lower(username) = $1 OR lower(email) = $1
       LIMIT 1`,
    [id],
  );
  const user = res.rows[0];

  const fail = async (): Promise<LoginResult> => {
    await db.query(
      `INSERT INTO session_events (kind, detail, ip_address) VALUES ('login_failure', $1, $2)`,
      [id, input.ip ?? null],
    );
    await audit(db, { action: "login_failure", detail: { identifier: id }, traceId: trace });
    return { ok: false, reason: "invalid_credentials" };
  };

  if (!user) {
    // Verify against a dummy hash to keep timing uniform (no user enumeration).
    await verifyPassword(input.password, "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
    return fail();
  }
  if (!user.active) {
    await audit(db, { actorId: user.id, action: "login_inactive", traceId: trace });
    return { ok: false, reason: "inactive" };
  }

  const good = await verifyPassword(input.password, user.password_hash);
  if (!good) return fail();

  if (needsRehash(user.password_hash)) {
    const fresh = await hashPassword(input.password);
    await db.query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [
      user.id,
      fresh,
    ]);
  }

  const { token } = await createSession(db, user.id, {
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });
  await db.query(
    `INSERT INTO session_events (user_id, kind, detail, ip_address) VALUES ($1, 'login_success', $2, $3)`,
    [user.id, id, input.ip ?? null],
  );
  await audit(db, { actorId: user.id, action: "login_success", traceId: trace });

  const roles = await rolesFor(db, user.id);
  return { ok: true, token, userId: user.id, roles };
}

