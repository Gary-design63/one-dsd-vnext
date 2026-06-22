// =====================================================================
// One DSD vNext — auth routes (Layer 6)
// POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
// The cookie is HttpOnly + SameSite and (in prod) Secure. The raw token is
// never persisted; logout revokes the server-side session.
// =====================================================================
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Db } from "../db.js";
import { loadConfig } from "../config.js";
import { login } from "../auth/login.js";
import { revokeSession } from "../auth/session.js";
import { currentViewer } from "../auth/middleware.js";
import {
  readJsonBody,
  sendJson,
  setCookie,
  clearCookie,
  parseCookies,
  clientIp,
} from "../http/http.js";

interface LoginBody {
  identifier?: unknown;
  password?: unknown;
}

export async function handleLogin(
  db: Db,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const cfg = loadConfig();
  let body: LoginBody | null;
  try {
    body = await readJsonBody<LoginBody>(req);
  } catch {
    sendJson(res, 400, { error: "invalid_request" });
    return;
  }
  const identifier = typeof body?.identifier === "string" ? body.identifier : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!identifier || !password) {
    sendJson(res, 400, { error: "missing_credentials" });
    return;
  }

  const result = await login(db, {
    identifier,
    password,
    ip: clientIp(req),
    userAgent: req.headers["user-agent"] ?? null,
  });

  if (!result.ok) {
    const status = result.reason === "locked_out" ? 429 : 401;
    sendJson(res, status, { error: result.reason });
    return;
  }

  setCookie(res, cfg.cookieName, result.token, {
    httpOnly: true,
    secure: cfg.cookieSecure,
    sameSite: "Lax",
    maxAgeSeconds: cfg.sessionAbsoluteMinutes * 60,
  });
  sendJson(res, 200, { userId: result.userId, roles: result.roles });
}

export async function handleLogout(
  db: Db,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const cfg = loadConfig();
  const token = parseCookies(req)[cfg.cookieName];
  if (token) await revokeSession(db, token);
  clearCookie(res, cfg.cookieName);
  sendJson(res, 200, { ok: true });
}

export async function handleMe(
  db: Db,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const viewer = await currentViewer(db, req);
  if (!viewer) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }
  sendJson(res, 200, { userId: viewer.userId, roles: viewer.roles });
}
