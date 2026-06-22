// =====================================================================
// One DSD vNext — auth middleware (Layer 6)
// Resolves the current viewer from the session cookie and exposes role
// guards. Fail-closed: no valid session => no viewer => 401. Guards return
// the viewer or send the error response and return null, so handlers stay
// short and cannot forget to check.
// =====================================================================
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Db } from "../db.js";
import { loadConfig } from "../config.js";
import { parseCookies, sendJson } from "../http/http.js";
import { resolveSession } from "./session.js";
import type { Viewer } from "../access/visibility.js";

export async function currentViewer(
  db: Db,
  req: IncomingMessage,
): Promise<Viewer | null> {
  const cfg = loadConfig();
  const token = parseCookies(req)[cfg.cookieName];
  const session = await resolveSession(db, token);
  if (!session) return null;
  const res = await db.query<{ role_key: string }>(
    `SELECT role_key FROM role_assignments WHERE user_id = $1`,
    [session.userId],
  );
  return { userId: session.userId, roles: res.rows.map((r) => r.role_key) };
}

/** Require any authenticated viewer. Sends 401 and returns null if none. */
export async function requireAuth(
  db: Db,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<Viewer | null> {
  const viewer = await currentViewer(db, req);
  if (!viewer) {
    sendJson(res, 401, { error: "unauthorized" });
    return null;
  }
  return viewer;
}

/** Require at least one of the given roles. Sends 401/403 as appropriate. */
export async function requireRole(
  db: Db,
  req: IncomingMessage,
  res: ServerResponse,
  roles: readonly string[],
): Promise<Viewer | null> {
  const viewer = await requireAuth(db, req, res);
  if (!viewer) return null;
  const ok = viewer.roles.some((r) => roles.includes(r));
  if (!ok) {
    sendJson(res, 403, { error: "forbidden" });
    return null;
  }
  return viewer;
}
